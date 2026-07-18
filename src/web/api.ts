import type { CalendarResponse, ReviveApi, SchedulingSettings } from "./types.js";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`REVIVE request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export const defaultApi: ReviveApi = {
  getCalendar: (date) => request<CalendarResponse>(`/api/v1/calendar?date=${encodeURIComponent(date)}`),
  getSettings: () => request<SchedulingSettings>("/api/v1/settings"),
  patchSettings: (patch) => request<SchedulingSettings>("/api/v1/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  }),
  createAdminSession: (pin) => request<{ token: string }>("/api/v1/admin/session", {
    method: "POST",
    body: JSON.stringify({ pin }),
  }),
  resetDemo: (token) => request<{ status: string; demoDate: string }>("/api/v1/demo/reset", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }),
};
