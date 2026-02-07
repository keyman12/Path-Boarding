/**
 * API client for Path Boarding backend.
 * Base URL from NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function errorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) return String((first as { msg: unknown }).msg);
    return detail.map((d) => (typeof d === "object" && d && "msg" in d ? (d as { msg: unknown }).msg : d)).join("; ");
  }
  if (detail && typeof detail === "object" && "message" in (detail as object)) return String((detail as { message: unknown }).message);
  return "Request failed";
}

export type ApiResponse<T> =
  | { data: T; error?: never; statusCode?: never }
  | { data?: never; error: string; validation_errors?: Record<string, string[]>; statusCode?: number };

export async function apiGet<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "GET",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: errorMessage(json.detail ?? json.message),
      validation_errors: json.validation_errors ?? json.detail,
      statusCode: res.status,
    };
  }
  return { data: json as T };
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: errorMessage(json.detail ?? json.message),
      validation_errors: json.validation_errors ?? json.detail,
      statusCode: res.status,
    };
  }
  return { data: json as T };
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: errorMessage(json.detail ?? json.message),
      validation_errors: json.validation_errors ?? json.detail,
      statusCode: res.status,
    };
  }
  return { data: json as T };
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: errorMessage(json.detail ?? json.message),
      validation_errors: json.validation_errors ?? json.detail,
      statusCode: res.status,
    };
  }
  return { data: json as T };
}

export async function apiDelete<T = void>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "DELETE",
    headers: { ...options?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: errorMessage(json.detail ?? json.message),
      validation_errors: json.validation_errors ?? json.detail,
      statusCode: res.status,
    };
  }
  return { data: (res.status === 204 ? undefined : json) as T };
}

export { API_BASE };
