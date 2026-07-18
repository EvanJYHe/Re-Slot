import type {
  ActivityItem,
  AppointmentInput,
  AvailabilityResponse,
  CalendarResponse,
  ConversationDetail,
  ConversationSummary,
  CustomerDetail,
  CustomerNote,
  CustomerSummary,
  OperationResult,
  OperatorWaitlistEntry,
  ReviveApi,
  SchedulingSettings,
} from "./types.js";

export class ReviveApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ReviveApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const text = await response.text();
  const payload = text === "" ? {} : JSON.parse(text) as Record<string, unknown>;
  if (!response.ok) {
    throw new ReviveApiError(
      typeof payload.message === "string" ? payload.message : `REVIVE request failed (${response.status}).`,
      response.status,
      typeof payload.code === "string" ? payload.code : undefined,
    );
  }
  return payload as T;
}

function authorization(token: string | undefined): HeadersInit {
  return token === undefined ? {} : { Authorization: `Bearer ${token}` };
}

export const defaultApi: ReviveApi = {
  getCalendar: (date) => request<CalendarResponse>(`/api/v1/calendar?date=${encodeURIComponent(date)}`),
  getCalendarRange: (start, end) => request<CalendarResponse>(
    `/api/v1/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
  ),
  getAvailability: (input, token) => {
    const query = new URLSearchParams({ date: input.date, serviceId: input.serviceId });
    if (input.barberId !== undefined) query.set("barberId", input.barberId);
    if (input.includeAlternates !== undefined) query.set("includeAlternates", String(input.includeAlternates));
    return request<AvailabilityResponse>(`/api/v1/availability?${query.toString()}`, {
      headers: authorization(token),
    });
  },
  getSettings: () => request<SchedulingSettings>("/api/v1/settings"),
  patchSettings: (patch, token) => request<SchedulingSettings>("/api/v1/settings", {
    method: "PATCH",
    headers: authorization(token),
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
  getCustomers: (query, token) => request<CustomerSummary[]>(
    `/api/v1/customers?q=${encodeURIComponent(query)}`,
    { headers: authorization(token) },
  ),
  getCustomer: (id, token) => request<CustomerDetail>(
    `/api/v1/customers/${encodeURIComponent(id)}`,
    { headers: authorization(token) },
  ),
  patchCustomer: (id, patch, token) => request<CustomerDetail>(
    `/api/v1/customers/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authorization(token),
      body: JSON.stringify(patch),
    },
  ),
  addCustomerNote: (id, text, token) => request<CustomerNote>(
    `/api/v1/customers/${encodeURIComponent(id)}/notes`,
    {
      method: "POST",
      headers: authorization(token),
      body: JSON.stringify({ text }),
    },
  ),
  getConversations: (token) => request<ConversationSummary[]>("/api/v1/conversations", {
    headers: authorization(token),
  }),
  getConversation: (id, token) => request<ConversationDetail>(
    `/api/v1/conversations/${encodeURIComponent(id)}`,
    { headers: authorization(token) },
  ),
  getWaitlist: (token) => request<OperatorWaitlistEntry[]>("/api/v1/waitlist", {
    headers: authorization(token),
  }),
  patchWaitlist: (id, patch, token) => request<OperatorWaitlistEntry>(
    `/api/v1/waitlist/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authorization(token),
      body: JSON.stringify(patch),
    },
  ),
  getActivity: (token) => request<ActivityItem[]>("/api/v1/activity", {
    headers: authorization(token),
  }),
  bookAppointment: (input: AppointmentInput, token) => request<OperationResult>("/api/v1/appointments", {
    method: "POST",
    headers: authorization(token),
    body: JSON.stringify(input),
  }),
  rescheduleAppointment: (id, input, token) => request<OperationResult>(
    `/api/v1/appointments/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: authorization(token),
      body: JSON.stringify(input),
    },
  ),
  cancelAppointment: (id, token) => request<OperationResult>(
    `/api/v1/appointments/${encodeURIComponent(id)}/cancel`,
    { method: "POST", headers: authorization(token) },
  ),
};
