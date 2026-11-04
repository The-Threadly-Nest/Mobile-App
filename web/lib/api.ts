export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers, cache: "no-store" });
  } catch {
    throw new ApiError("We couldn't connect. Please check your connection and try again.", 0);
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message = "We couldn't complete your request. Please try again.";
    if (result && typeof result === "object" && "error" in result) {
      const detail = result.error;
      if (typeof detail === "string") message = detail;
      else if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") message = detail.message;
    }
    throw new ApiError(message, response.status);
  }
  if (result === null) throw new ApiError("We couldn't load that information. Please try again.", response.status);
  return result as T;
}
