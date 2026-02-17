/**
 * API client for Path Boarding backend.
 * Base URL from NEXT_PUBLIC_API_URL.
 * - Empty or unset on production: use same origin (relative URLs)
 * - http://localhost:8000: for local dev
 */

function getApiBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env !== undefined && env !== null && env !== "") return env;
  // In browser on production domain: use same origin
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return "";
  }
  return "http://localhost:8000";
}

const API_BASE = getApiBase();

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
  const text = await res.text();
  const json = (() => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { _raw: text };
    }
  })();
  if (!res.ok) {
    const detail = (json as { detail?: unknown }).detail ?? (json as { message?: unknown }).message;
    let err = errorMessage(detail);
    if (err === "Request failed" && (json as { _raw?: string })._raw) {
      const raw = (json as { _raw: string })._raw;
      err = `Request failed (${res.status}): ${raw.slice(0, 150)}${raw.length > 150 ? "…" : ""}`;
    } else if (err === "Request failed" && res.status) {
      err = `Request failed (HTTP ${res.status})`;
    }
    const validationErrors = (json as { validation_errors?: Record<string, string[]> }).validation_errors;
    return {
      error: err,
      validation_errors: validationErrors,
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
  const text = await res.text();
  const json = (() => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { _raw: text };
    }
  })();
  if (!res.ok) {
    const detail = (json as { detail?: unknown }).detail ?? (json as { message?: unknown }).message;
    let err = errorMessage(detail);
    if (err === "Request failed" && (json as { _raw?: string })._raw) {
      const raw = (json as { _raw: string })._raw;
      err = `Request failed (${res.status}): ${raw.slice(0, 150)}${raw.length > 150 ? "…" : ""}`;
    } else if (err === "Request failed" && res.status) {
      err = `Request failed (HTTP ${res.status})`;
    }
    const validationErrors = (json as { validation_errors?: Record<string, string[]> }).validation_errors;
    return {
      error: err,
      validation_errors: validationErrors,
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
