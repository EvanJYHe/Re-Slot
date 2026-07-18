// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardApp } from "./App.js";
import type { CalendarResponse, ReviveApi, SchedulingSettings } from "./types.js";

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
    timezone: "America/Toronto",
    generatedAt: "2026-07-18T16:00:00.000Z",
    demoDate: "2026-07-20",
    shop: { name: "REVIVE", location: "Toronto, ON" },
    businessHours: { start: "10:00", end: "20:00" },
    barbers: [
      { id: "jeremy", name: "Jeremy", serviceIds: ["haircut"], weeklyHours: {} },
      { id: "maya", name: "Maya", serviceIds: ["haircut"], weeklyHours: {} },
    ],
    services: [{ id: "haircut", name: "Signature haircut", durationMinutes: 60, priceCents: 4500 }],
    appointments: [
      {
        id: "josh-appt",
        customerId: "josh",
        customerName: "Josh",
        barberId: "jeremy",
        barberName: "Jeremy",
        serviceId: "haircut",
        serviceName: "Signature haircut",
        startAt: "2026-07-20T21:00:00.000Z",
        endAt: "2026-07-20T22:00:00.000Z",
        status: "cancelled",
        discountPercent: 0,
        version: 2,
        history: [],
      },
      {
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
      },
    ],
    activeRefills: [{
      id: "job-1",
      sourceAppointmentId: "josh-appt",
      barberId: "jeremy",
      barberName: "Jeremy",
      serviceId: "haircut",
      serviceName: "Signature haircut",
      slotStartAt: "2026-07-20T21:00:00.000Z",
      slotEndAt: "2026-07-20T22:00:00.000Z",
      status: "awaiting_offer",
      moveDepth: 0,
      attemptedCustomerIds: ["sarah"],
      currentOfferId: "offer-1",
      customerState: "Waiting for Sarah.",
      timeline: [
        { type: "opening_created", at: "2026-07-20T16:00:00.000Z", message: "Josh cancelled his 5 PM appointment." },
        { type: "offer_delivered", at: "2026-07-20T16:00:05.000Z", message: "REVIVE called Sarah." },
      ],
      version: 2,
      createdAt: "2026-07-20T16:00:00.000Z",
      updatedAt: "2026-07-20T16:00:05.000Z",
    }],
    channelHealth: {
      mongodb: "mongodb",
      telegram: "configured",
      backboard: "configured",
      elevenlabs: "unconfigured",
    },
  };
}

function api(): ReviveApi & { patchSettings: ReturnType<typeof vi.fn> } {
  return {
    getCalendar: vi.fn(async (date: string) => calendar(date)),
    getCalendarRange: vi.fn(async (start: string) => calendar(start)),
    getAvailability: vi.fn(async () => ({
      date: "2026-07-20",
      timezone: "America/Toronto",
      service: { id: "haircut", name: "Signature haircut", durationMinutes: 60 },
      slots: [],
    })),
    getSettings: vi.fn(async () => settings),
    patchSettings: vi.fn(async (patch: Partial<SchedulingSettings>) => ({ ...settings, ...patch })),
    createAdminSession: vi.fn(async () => ({ token: "admin-token" })),
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
  vi.useRealTimers();
});

describe("DashboardApp", () => {
  it("renders the barber-day grid, appointment state, and active refill signal", async () => {
    render(<DashboardApp api={api()} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    expect(await screen.findByRole("heading", { name: "REVIVE" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Jeremy/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Maya/ })).toBeInTheDocument();
    expect(screen.getByText("Sarah")).toBeInTheDocument();
    expect(screen.getByText("Waiting for Sarah.")).toBeInTheDocument();
    const cancelledAppointment = screen.getByRole("button", { name: /Josh, Signature haircut/ });
    expect(within(cancelledAppointment).getByText("Cancelled", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("3 / 4 channels ready")).toBeInTheDocument();
  });

  it("uses a compact treatment for short appointments", async () => {
    const client = api();
    client.getCalendar = vi.fn(async () => {
      const value = calendar();
      value.appointments.push({
        id: "eli-appt",
        customerId: "eli",
        customerName: "Eli",
        barberId: "maya",
        barberName: "Maya",
        serviceId: "beard",
        serviceName: "Beard sculpt",
        startAt: "2026-07-20T19:00:00.000Z",
        endAt: "2026-07-20T19:30:00.000Z",
        status: "confirmed",
        discountPercent: 0,
        version: 1,
        history: [],
      });
      return value;
    });

    render(<DashboardApp api={client} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    expect(await screen.findByRole("button", { name: /Eli, Beard sculpt/ }))
      .toHaveClass("appointment-card--compact");
  });

  it("opens a plain-language refill timeline drawer", async () => {
    const user = userEvent.setup();
    render(<DashboardApp api={api()} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: /Waiting for Sarah/ }));

    const dialog = screen.getByRole("dialog", { name: "Refill timeline" });
    expect(within(dialog).getByText("Josh cancelled his 5 PM appointment.")).toBeInTheDocument();
    expect(within(dialog).getByText("REVIVE called Sarah.")).toBeInTheDocument();
  });

  it("navigates dates and refetches authoritative calendar state", async () => {
    const user = userEvent.setup();
    const client = api();
    render(<DashboardApp api={client} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);
    await screen.findByText("Sarah");

    await user.click(screen.getByRole("button", { name: "Next day" }));

    await waitFor(() => expect(client.getCalendar).toHaveBeenLastCalledWith("2026-07-21"));
  });

  it("opens on the next operational weekday during a weekend", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-18T16:00:00.000Z"));
    const client = api();

    render(<DashboardApp api={client} eventSourceFactory={() => undefined} />);

    await waitFor(() => expect(client.getCalendar).toHaveBeenCalledWith("2026-07-20"));
  });

  it("edits operational settings from the settings drawer", async () => {
    const user = userEvent.setup();
    const client = api();
    render(<DashboardApp api={client} initialDate="2026-07-20" eventSourceFactory={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Open settings" }));
    const dialog = screen.getByRole("dialog", { name: "Shop settings" });
    await user.click(within(dialog).getByRole("checkbox", { name: "Allow alternate barbers" }));

    await waitFor(() => expect(client.patchSettings).toHaveBeenCalledWith({ allowAlternateBarbers: false }));
    expect(within(dialog).getByText("Saved")).toBeInTheDocument();
  });
});
