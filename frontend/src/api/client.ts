import type { ApiProblem } from "../types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5080";
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
export const demoProfileStorageKey = "codesk.demoProfileId";
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ApiProblem;
  constructor(status: number, problem: ApiProblem) {
    super(problem.detail ?? problem.title ?? `API error ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (isDemoMode) {
    const profileId = localStorage.getItem(demoProfileStorageKey);
    if (profileId) headers.set("X-Demo-Profile-Id", profileId);
  } else {
    const { supabase } = await import("../auth/supabase");
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token)
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let problem: ApiProblem = {
      status: response.status,
      title: response.statusText,
    };
    try {
      problem = (await response.json()) as ApiProblem;
    } catch {
      /* upstream did not return JSON */
    }
    throw new ApiError(response.status, problem);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const toQuery = (
  values: Record<string, string | number | boolean | null | undefined>,
) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : "";
};
