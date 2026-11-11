import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { alertEmitter } from "@/shared/utils/alertEmitter";
import { getConnectionStatus, refreshConnectionStatus, OFFLINE_MESSAGE } from "../services/connectionStatus";
import { createPageCacheOwner, readPageCache, writePageCache } from "../services/pageCache";

export interface ApiErrorDetail {
  status: number;
  code: string;
  message: string;
  details?: any;
  responseBody?: any;
}

export class ApiError extends Error {
  public readonly details: ApiErrorDetail;

  constructor(details: ApiErrorDetail) {
    super(details.message);
    this.name = "ApiError";
    this.details = details;
  }
}

interface RequestOptions extends RequestInit {
  retryCount?: number;
  silent?: boolean; // If true, don't show the native Alert on error
  timeoutMs?: number;
  onResponse?: (response: Response) => void;
}

export interface CollectionPage<T> {
  items: T[];
  page: number;
  hasMore: boolean;
  nextPage: number | null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastLogoutAlertTimestamp = 0;

type CachedResponse = { value: unknown; headers: Record<string, string>; savedAt: number };
const responseCache = new Map<string, CachedResponse>();
const requestsInFlight = new Map<string, Promise<unknown>>();
let cacheToken: string | null | undefined;
let cacheVersion = 0;
export function invalidateReadCache() {
  cacheVersion++;
  responseCache.clear();
  requestsInFlight.clear();
}
function syncCacheIdentity() {
  const token = useAuthStore.getState().token;
  if (token !== cacheToken) { cacheToken = token; cacheVersion++; responseCache.clear(); requestsInFlight.clear(); }
}
const cacheableRead = (endpoint: string, options: RequestOptions) =>
  (options.method || "GET").toUpperCase() === "GET" && !options.signal && !options.headers &&
  /^\/api\/(orders|catalog|fashion-houses|admin\/(profile|dashboard-summary)|staff|customers|measurements|preferences|escalations)(\/|\?|$)/.test(endpoint) &&
  !/slots|availability|presign/.test(endpoint);

export function getCachedResponse<T>(endpoint: string): T | undefined {
  syncCacheIdentity();
  return responseCache.get(endpoint)?.value as T | undefined;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  syncCacheIdentity();
  const method = (options.method || "GET").toUpperCase();
  if (!cacheableRead(endpoint, options) || options.cache === "no-store") {
    const value = await fetchNetwork<T>(endpoint, options);
    if (!["GET", "HEAD"].includes(method)) invalidateReadCache();
    return value;
  }
  const version = cacheVersion;
  const token = cacheToken;
  const session = useAuthStore.getState();
  const owner = session.token && session.role && session.email ? createPageCacheOwner(session.role, session.email) : null;
  const restoreOffline = async () => {
    if (!owner) return undefined;
    const saved = await readPageCache<CachedResponse>(owner, `api:${endpoint}`);
    if (!saved || cacheVersion !== version || useAuthStore.getState().token !== token) return undefined;
    responseCache.set(endpoint, saved);
    return saved;
  };
  const load = () => {
    let request = requestsInFlight.get(endpoint) as Promise<T> | undefined;
    if (!request) {
      const headers: Record<string, string> = {};
      request = fetchNetwork<T>(endpoint, { ...options, silent: true, onResponse: response => {
        response.headers.forEach((value, key) => { headers[key] = value; });
      } }).then(value => {
        if (cacheVersion === version && useAuthStore.getState().token === token) {
          if (responseCache.size >= 150) responseCache.delete(responseCache.keys().next().value!);
          responseCache.set(endpoint, { value, headers, savedAt: Date.now() });
          if (owner) void writePageCache(owner, `api:${endpoint}`, { value, headers, savedAt: Date.now() });
        }
        return value;
      }).finally(() => { if (requestsInFlight.get(endpoint) === request) requestsInFlight.delete(endpoint); });
      requestsInFlight.set(endpoint, request);
    }
    return request;
  };
  const offline = getConnectionStatus() === "offline";
  const cached = responseCache.get(endpoint) ?? (offline ? await restoreOffline() : undefined);
  if (cached && (options.cache !== "reload" || offline)) {
    options.onResponse?.(new Response(null, { headers: cached.headers }));
    if (Date.now() - cached.savedAt > 30_000 && getConnectionStatus() !== "offline") void load().catch(() => {});
    return cached.value as T;
  }
  let value: T;
  try { value = await load(); }
  catch (error) {
    // Keep last-known content on connection failures, including explicit refresh.
    // Never hide authorization errors or use cached data to replay a mutation.
    if (error instanceof ApiError && error.details.status === 0) {
      const fallback = responseCache.get(endpoint) ?? await restoreOffline();
      if (fallback && useAuthStore.getState().token === token) {
        options.onResponse?.(new Response(null, { headers: fallback.headers }));
        return fallback.value as T;
      }
    }
    throw error;
  }
  const saved = responseCache.get(endpoint);
  if (saved) options.onResponse?.(new Response(null, { headers: saved.headers }));
  return value;
}

async function fetchNetwork<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  if (getConnectionStatus() === "offline") {
    refreshConnectionStatus();
    // Never queue mutations: a fitting slot or garment price may change offline.
    throw new ApiError({ status: 0, code: "NETWORK_DISCONNECTED", message: OFFLINE_MESSAGE });
  }
  const { token, logout } = useAuthStore.getState();
  const url = `${API_BASE_URL}${endpoint}`;
  const { retryCount: _retryCount, silent: _silent, timeoutMs: _timeoutMs, onResponse, ...requestInit } = options;

  // Configure headers
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const timeoutController = new AbortController();
  const timeoutMs = options.timeoutMs ?? 12_000;
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const callerSignal = options.signal;
  const abortFromCaller = () => timeoutController.abort();
  callerSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const fetchOptions: RequestInit = {
    ...requestInit,
    headers,
    signal: timeoutController.signal,
  };

  const maxRetries = 3;
  const currentRetry = options.retryCount || 0;

  try {
    const response = await fetch(url, fetchOptions);
    onResponse?.(response);

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }

    // Capture structured error format
    let errorDetail: ApiErrorDetail;
    try {
      const body = await response.json();
      let message = "We couldn't complete your request right now. Please try again.";

      if (typeof body.error === "string") {
        message = body.error;
      } else if (body.error && typeof body.error.message === "string") {
        message = body.error.message;
      } else if (typeof body.message === "string") {
        message = body.message;
      }

      if (Array.isArray(body.issues) && body.issues.length > 0) {
        const issuesText = body.issues.map((i: any) => i.message).join(". ");
        if (!message || message === "Validation failed") {
          message = issuesText;
        }
      }

      const code = (typeof body.error === "object" && body.error?.code) || body.code || "HTTP_ERROR";
      errorDetail = {
        status: response.status,
        code,
        message,
        details: body.issues || (typeof body.error === "object" ? body.error?.details : undefined),
        responseBody: body,
      };
    } catch {
      errorDetail = {
        status: response.status,
        code: "HTTP_ERROR",
        message: "We couldn't complete your request right now. Please try again in a moment.",
      };
    }

    // Only safe, read-only requests may be repeated automatically. A mutation
    // may already have committed before its response was lost.
    const transientStatuses = [429, 503, 504];
    const method = (options.method || "GET").toUpperCase();
    const canRetryAutomatically = method === "GET" || method === "HEAD";
    if (canRetryAutomatically && transientStatuses.includes(errorDetail.status) && currentRetry < maxRetries) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
      const backoffMs = retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, 30_000)
        : Math.pow(2, currentRetry) * 1000 + Math.random() * 500;
      console.warn(`[API Client] Transient error ${errorDetail.status}. Retrying in ${backoffMs}ms...`);
      await delay(backoffMs);
      return fetchNetwork<T>(endpoint, { ...options, retryCount: currentRetry + 1 });
    }

    // 2. Global interception: Unauthorized (401) session expiry
    if (errorDetail.status === 401 && token && useAuthStore.getState().token === token) {
      console.warn("[API Client] Session expired. Force logging out...");
      logout();
      const now = Date.now();
      if (!options.silent && now - lastLogoutAlertTimestamp > 10000) {
        lastLogoutAlertTimestamp = now;
        alertEmitter.emit({ title: "Session Expired", message: "Your session has expired. Please log in again to continue." });
      }
      throw new ApiError(errorDetail);
    }

    // 3. Surface other non-retryable errors immediately
    if (!options.silent) {
      alertEmitter.emit({ title: "Notice", message: errorDetail.message });
    }

    throw new ApiError(errorDetail);
  } catch (error) {
    // Handle network disconnect/offline errors
    if (!(error instanceof ApiError)) {
      refreshConnectionStatus();
      if (!options.silent) {
        console.error("[API Client] Network or parsing crash:", error);
      }
      const timedOut = error instanceof Error && error.name === "AbortError" && !callerSignal?.aborted;
      const networkErrorDetail: ApiErrorDetail = {
        status: 0,
        code: timedOut ? "REQUEST_TIMEOUT" : "NETWORK_DISCONNECTED",
        message: timedOut
          ? "The server is taking too long to respond. Please try again."
          : "You seem to be offline. Please check your connection and try again.",
      };
      if (!options.silent) {
        alertEmitter.emit({ title: "Connection Offline", message: networkErrorDetail.message });
      }
      throw new ApiError(networkErrorDetail);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function apiFetchCollectionPage<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<CollectionPage<T>> {
  let page = 1;
  let hasMore = false;
  let nextPage: number | null = null;
  const callerOnResponse = options.onResponse;
  const items = await apiFetch<T[]>(endpoint, {
    ...options,
    onResponse: (response) => {
      callerOnResponse?.(response);
      page = Number(response.headers.get("X-Page") || 1);
      hasMore = response.headers.get("X-Has-More") === "true";
      const nextPageHeader = response.headers.get("X-Next-Page");
      nextPage = nextPageHeader ? Number(nextPageHeader) : null;
    },
  });
  return { items, page, hasMore, nextPage };
}

export interface WeeklyBookingSchedule {
  days: number[];
  startTime: string;
  endTime: string;
  durationMinutes: number;
  blockedDates: string[];
  generatedThrough?: string;
}

export interface AdminOnboardingPayload {
  shopName: string;
  location: string;
  phone?: string;
  bio?: string;
  categories: string[];
  brandLogoUrl?: string;
  currency?: string;
  timezone?: string;
  slotDurationMinutes?: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bookingSchedule?: WeeklyBookingSchedule;
  availableSlots?: Array<{
    date: string;
    time: string;
  }>;
}

export interface AdminSummary {
  staffCount: number;
  customerCount: number;
  invoiceCountThisMonth: number;
  activeOrdersCount: number;
  pendingBookingsCount: number;
  revenueThisMonth: number;
}

export type RevenuePeriod = "this_month" | "last_month" | "this_year" | "all_time";
export type AdminDashboardSummary = Pick<
  AdminSummary,
  "activeOrdersCount" | "pendingBookingsCount" | "revenueThisMonth"
> & { revenue?: number; period?: RevenuePeriod; acceptedOrdersCount?: number };

export const adminApi = {
  getProfile: async () => {
    return apiFetch<{ fashionHouse: any }>("/api/admin/profile", { silent: true });
  },
  getSummary: async () => {
    return apiFetch<AdminSummary>("/api/admin/summary", { silent: true });
  },
  getDashboardSummary: async (period: RevenuePeriod = "this_month") => {
    const suffix = period === "this_month" ? "" : `?period=${encodeURIComponent(period)}`;
    return apiFetch<AdminDashboardSummary>(`/api/admin/dashboard-summary${suffix}`, { silent: true, cache: "reload" });
  },
  completeOnboarding: async (data: AdminOnboardingPayload) => {
    return apiFetch<{ message: string; fashionHouse: any }>("/api/admin/onboarding", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  updatePaymentDetails: async (data: { bankName: string; accountNumber: string; accountName: string }) => {
    return apiFetch<{ message: string; fashionHouse: any }>("/api/admin/payment-details", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

export const invoicesApi = {
  getByOrderId: async (orderId: string) =>
    apiFetch<any>(`/api/invoices/order/${orderId}`, { silent: true }),
  generateForOrder: async (orderId: string) =>
    apiFetch<any>("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }),
};

export const ordersApi = {
  getOrders: async (fresh = false) => {
    const orders: any[] = [];
    let page: number | null = 1;
    while (page !== null) {
      const result: CollectionPage<any> = await apiFetchCollectionPage<any>(`/api/orders?page=${page}&limit=100`, { silent: true, ...(fresh ? { cache: "reload" as const } : {}) });
      orders.push(...result.items);
      page = result.nextPage && result.nextPage > page ? result.nextPage : null;
    }
    return orders;
  },
};

export const escalationsApi = {
  getEscalations: async () => {
    return apiFetch<any[]>("/api/escalations", { silent: true });
  },
  resolveEscalation: async (escalationId: string, assignToStaffId?: string) => {
    return apiFetch<any>(`/api/escalations/${escalationId}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ assignToStaffId }),
      silent: true,
    });
  },
  declineBooking: async (escalationId: string) => {
    return apiFetch<any>(`/api/escalations/${escalationId}/decline`, {
      method: "PATCH",
      silent: true,
    });
  },
};

export interface StaffListItem {
  id: string;
  name?: string | null;
  email: string;
  unreadCount?: number;
  [key: string]: unknown;
}

export const staffApi = {
  getStaff: async () => apiFetch<StaffListItem[]>("/api/staff", { silent: true }),
};

export interface MeasurementCheckResult {
  hasMeasurements: boolean;
  count: number;
  customerId: string | null;
}

export const measurementsApi = {
  checkCustomer: async (customerName: string) =>
    apiFetch<MeasurementCheckResult>(
      `/api/measurements/check/${encodeURIComponent(customerName)}`,
      { silent: true }
    ),
};

export const slotsApi = {
  getSchedule: async () => apiFetch<{ bookingSchedule: WeeklyBookingSchedule | null; timezone: string; slotDurationMinutes: number }>("/api/slots/schedule", { silent: true }),
  saveSchedule: async (schedule: WeeklyBookingSchedule, timezone: string) => apiFetch<{ schedule: WeeklyBookingSchedule; created: number; skippedBooked: number }>("/api/slots/schedule", { method: "PUT", body: JSON.stringify({ schedule, timezone }), silent: true }),
  getSlots: async () => apiFetch<any[]>("/api/slots", { silent: true }),
  createSlot: async (date: string, time: string, durationMinutes?: number) =>
    apiFetch<any>("/api/slots", {
      method: "POST",
      body: JSON.stringify({ date, time, durationMinutes }),
    }),
  deleteSlot: async (id: string) =>
    apiFetch<any>(`/api/slots/${id}`, { method: "DELETE" }),
};
