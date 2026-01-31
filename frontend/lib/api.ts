/**
 * API client for Path Boarding backend.
 * Base URL from NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiResponse<T> =
  | { data: T; error?: never }
  | { data?: never; error: string; validation_errors?: Record<string, string[]> };

export async function apiGet<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    method: "GET",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      error: json.detail ?? json.message ?? "Request failed",
      validation_errors: json.validation_errors ?? json.detail,
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
      error: json.detail ?? json.message ?? "Request failed",
      validation_errors: json.validation_errors ?? json.detail,
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
      error: json.detail ?? json.message ?? "Request failed",
      validation_errors: json.validation_errors ?? json.detail,
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
      error: json.detail ?? json.message ?? "Request failed",
      validation_errors: json.validation_errors ?? json.detail,
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
      error: json.detail ?? json.message ?? "Request failed",
      validation_errors: json.validation_errors ?? json.detail,
    };
  }
  return { data: (res.status === 204 ? undefined : json) as T };
}

export { API_BASE };
