// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardApp } from "./App.js";
import type { CalendarResponse, EventSourceLike, ReviveApi, SchedulingSettings } from "./types.js";

const settings: SchedulingSettings = {
  timezone: "America/Toronto",
  refillEnabled: true,
  moveEarlierEnabled: true,
  moveLimit: 3,
  allowAlternateBarbers: true,
  waitlistEnabled: true,
  pastCustomerOutreachEnabled: true,
  maxDiscountPercent: 15,
  offerExpirySeconds: 120,
};

function calendar(date = "2026-07-20"): CalendarResponse {
  return {
    date,
    range: { start: date, end: date },
    timezone: "America/Toronto",
    generatedAt: "2026-07-18T16:00:00.000Z",
    demoDate: "2026-07-20",
    shop: { name: "REVIVE", location: "Toronto, ON" },
    businessHours: { start: "10:00", end: "20:00" },
    barbers: [
      { id: "jeremy", name: "Jeremy", serviceIds: ["haircut"], weeklyHours: {} },
      { id: "maya", name: "Maya", serviceIds: ["haircut"], weeklyHours: {} },
      { id: "devon", name: "Devon", serviceIds: ["haircut"], weeklyHours: {} },
    ],
    services: [{ id: "haircut", name: "Signature haircut", durationMinutes: 60, priceCents: 4500 }],
    appointments: [{
      id: "sarah-appt",
      customerId: "sarah",
      customerName: "Sarah",
      barberId: "jeremy",
      barberName: "Jeremy",
      serviceId: "haircut",
      serviceName: "Signature haircut",
      startAt: "2026-07-20T22:00:00.000Z",
      endAt: "2026-07-20T23:00:00.000Z",
      status: "confirmed",
      discountPercent: 0,
      version: 1,
      history: [],
    }],
    activeRefills: [],
    channelHealth: {
      mongodb: "mongodb",
      telegram: "configured",
      backboard: "configured",
      elevenlabs: "configured",
    },
  };
}

function api(): ReviveApi {
  return {
    getCalendar: vi.fn(async (date: string) => calendar(date)),
    getCalendarRange: vi.fn(async (start: string, end: string) => ({
      ...calendar(start),
      range: { start, end },
    })),
    getAvailability: vi.fn(async () => ({
      date: "2026-07-20",
      timezone: "America/Toronto",
      service: { id: "haircut", name: "Signature haircut", durationMinutes: 60 },
      slots: [],
    })),
    getSettings: vi.fn(async () => settings),
    patchSettings: vi.fn(async (patch) => ({ ...settings, ...patch })),
    createAdminSession: vi.fn(async () => ({ token: "operator-token" })),
    resetDemo: vi.fn(async () => ({ status: "reset", demoDate: "2026-07-20" })),
    getCustomers: vi.fn(async () => []),
    getCustomer: vi.fn(async () => { throw new Error("unused"); }),
    patchCustomer: vi.fn(async () => { throw new Error("unused"); }),
    addCustomerNote: vi.fn(async () => { throw new Error("unused"); }),
    getConversations: vi.fn(async () => []),
    getConversation: vi.fn(async () => { throw new Error("unused"); }),
    getWaitlist: vi.fn(async () => []),
    patchWaitlist: vi.fn(async () => { throw new Error("unused"); }),
    getActivity: vi.fn(async () => []),
    bookAppointment: vi.fn(async () => ({ type: "committed" as const, operation: "book", message: "Booked" })),
    rescheduleAppointment: vi.fn(async () => ({ type: "committed" as const, operation: "reschedule", message: "Moved" })),
    cancelAppointment: vi.fn(async () => ({ type: "committed" as const, operation: "cancel", message: "Cancelled" })),
  };
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe("DashboardApp shell", () => {
  it("opens on a quiet Calendar workspace with four persistent destinations", async () => {
    const client = api();
    render(<DashboardApp api={client} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    expect(await screen.findByRole("heading", { name: "REVIVE" })).toBeInTheDocument();
    for (const destination of ["Calendar", "Agent", "Customers", "Settings"]) {
      expect(screen.getByRole("button", { name: destination })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
    expect(screen.getByText("Live updates unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/living chair board/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/disciplines/i)).not.toBeInTheDocument();
    expect(client.getCalendarRange).toHaveBeenCalledWith("2026-07-20", "2026-07-20");
  });

  it("queries the authoritative range for each calendar view", async () => {
    const user = userEvent.setup();
    const client = api();
    render(<DashboardApp api={client} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    await waitFor(() => expect(client.getCalendarRange).toHaveBeenLastCalledWith("2026-07-20", "2026-07-20"));
    await user.click(screen.getByRole("button", { name: "Week" }));
    await waitFor(() => expect(client.getCalendarRange).toHaveBeenLastCalledWith("2026-07-20", "2026-07-24"));
    await user.click(screen.getByRole("button", { name: "Month" }));
    await waitFor(() => expect(client.getCalendarRange).toHaveBeenLastCalledWith("2026-06-29", "2026-08-09"));
  });

  it("keeps Calendar visible while requesting operator access for scheduling", async () => {
    const user = userEvent.setup();
    render(<DashboardApp api={api()} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    await screen.findByRole("heading", { name: "Calendar" });
    await user.click(screen.getByRole("button", { name: "New appointment" }));

    expect(screen.getByRole("heading", { name: "Unlock operator workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
  });

  it("unlocks protected workspaces with one short-lived operator session", async () => {
    const user = userEvent.setup();
    const client = api();
    render(<DashboardApp api={client} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Agent" }));
    expect(screen.getByRole("heading", { name: "Unlock operator workspace" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Admin PIN"), "4242");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByRole("heading", { name: "Agent" })).toBeInTheDocument();
    expect(client.createAdminSession).toHaveBeenCalledWith("4242");
    expect(window.sessionStorage.getItem("revive.operator-token")).toBe("operator-token");
    await waitFor(() => expect(client.getConversations).toHaveBeenCalledWith("operator-token"));

    await user.click(screen.getByRole("button", { name: "Customers" }));
    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Unlock operator workspace" })).not.toBeInTheDocument();
    await waitFor(() => expect(client.getCustomers).toHaveBeenCalledWith("", "operator-token"));
  });

  it("reports SSE connection state and refetches authoritative calendar data", async () => {
    const listeners = new Map<string, () => void>();
    const source: EventSourceLike = {
      addEventListener: (type, listener) => { listeners.set(type, listener); },
      close: vi.fn(),
    };
    const client = api();
    render(<DashboardApp api={client} initialDate="2026-07-20" eventSourceFactory={() => source} />);

    await waitFor(() => expect(client.getCalendarRange).toHaveBeenCalledTimes(1));
    listeners.get("open")?.();
    expect(await screen.findByText("Live updates connected")).toBeInTheDocument();
    listeners.get("domain")?.();
    await waitFor(() => expect(client.getCalendarRange).toHaveBeenCalledTimes(2));
  });

  it("invalidates the active protected workspace after a domain event", async () => {
    const user = userEvent.setup();
    const listeners = new Map<string, () => void>();
    const source: EventSourceLike = {
      addEventListener: (type, listener) => { listeners.set(type, listener); },
      close: vi.fn(),
    };
    const client = api();
    render(
      <DashboardApp
        api={client}
        initialDate="2026-07-20"
        initialOperatorToken="operator-token"
        eventSourceFactory={() => source}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Agent" }));
    await waitFor(() => expect(client.getConversations).toHaveBeenCalledTimes(1));
    listeners.get("domain")?.();
    await waitFor(() => expect(client.getConversations).toHaveBeenCalledTimes(2));
  });
});
