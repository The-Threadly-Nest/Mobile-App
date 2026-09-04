import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { alertEmitter } from "@/shared/utils/alertEmitter";

export interface ApiErrorDetail {
  status: number;
  code: string;
  message: string;
  details?: any;
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
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, logout } = useAuthStore.getState();
  const url = `${API_BASE_URL}${endpoint}`;

  // Configure headers
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  const maxRetries = 3;
  const currentRetry = options.retryCount || 0;

  try {
    const response = await fetch(url, fetchOptions);

    if (response.ok) {
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
      };
    } catch {
      errorDetail = {
        status: response.status,
        code: "HTTP_ERROR",
        message: "We couldn't complete your request right now. Please try again in a moment.",
      };
    }

    // 1. Silent Retry with Exponential Backoff (for transient server errors: 429, 503, 504)
    const transientStatuses = [429, 503, 504];
    if (transientStatuses.includes(errorDetail.status) && currentRetry < maxRetries) {
      const backoffMs = Math.pow(2, currentRetry) * 1000 + Math.random() * 500;
      console.warn(`[API Client] Transient error ${errorDetail.status}. Retrying in ${backoffMs}ms...`);
      await delay(backoffMs);
      return apiFetch<T>(endpoint, { ...options, retryCount: currentRetry + 1 });
    }

    // 2. Global interception: Unauthorized (401) session expiry
    if (errorDetail.status === 401) {
      console.warn("[API Client] Session expired. Force logging out...");
      logout();
      if (!options.silent) {
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
      if (!options.silent) {
        console.error("[API Client] Network or parsing crash:", error);
      }
      const networkErrorDetail: ApiErrorDetail = {
        status: 0,
        code: "NETWORK_DISCONNECTED",
        message: "You seem to be offline. Please check your connection and try again.",
      };
      if (!options.silent) {
        alertEmitter.emit({ title: "Connection Offline", message: networkErrorDetail.message });
      }
      throw new ApiError(networkErrorDetail);
    }
    throw error;
  }
}

export interface AdminOnboardingPayload {
  shopName: string;
  location: string;
  phone?: string;
  bio?: string;
  categories: string[];
  brandLogoUrl?: string;
  currency?: string;
}

export const adminApi = {
  getProfile: async () => {
    return apiFetch<{ fashionHouse: any }>("/api/admin/profile", { silent: true });
  },
  completeOnboarding: async (data: AdminOnboardingPayload) => {
    return apiFetch<{ message: string; fashionHouse: any }>("/api/admin/onboarding", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

export const ordersApi = {
  getOrders: async () => {
    return apiFetch<any[]>("/api/orders", { silent: true });
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


