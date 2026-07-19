// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviveApiError } from "../api.js";
import type { CalendarView } from "../lib/dates.js";
import type { CalendarResponse, ReviveApi, SchedulingSettings } from "../types.js";
import { CalendarPage } from "./CalendarPage.js";

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

function calendar(): CalendarResponse {
  return {
    date: "2026-07-20",
    range: { start: "2026-07-20", end: "2026-08-30" },
    timezone: "America/Toronto",
    generatedAt: "2026-07-18T16:00:00.000Z",
    demoDate: "2026-07-20",
    shop: { name: "REVIVE", location: "Toronto, ON" },
    businessHours: { start: "10:00", end: "20:00" },
    barbers: [
      { id: "jeremy", name: "Jeremy", serviceIds: ["haircut"], weeklyHours: {} },
      { id: "maya", name: "Maya", serviceIds: ["haircut", "fade"], weeklyHours: {} },
      { id: "devon", name: "Devon", serviceIds: ["haircut"], weeklyHours: {} },
    ],
    services: [
      { id: "haircut", name: "Signature haircut", durationMinutes: 60, priceCents: 4500 },
      { id: "fade", name: "Skin fade", durationMinutes: 60, priceCents: 5200 },
    ],
    appointments: [
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
        id: "nadia-appt",
        customerId: "nadia",
        customerName: "Nadia",
        barberId: "maya",
        barberName: "Maya",
        serviceId: "fade",
        serviceName: "Skin fade",
        startAt: "2026-07-20T17:00:00.000Z",
        endAt: "2026-07-20T18:00:00.000Z",
        status: "confirmed",
        discountPercent: 0,
        version: 1,
        history: [],
      },
      {
        id: "eli-tue",
        customerId: "eli",
        customerName: "Eli",
        barberId: "devon",
        barberName: "Devon",
        serviceId: "haircut",
        serviceName: "Signature haircut",
        startAt: "2026-07-21T16:00:00.000Z",
        endAt: "2026-07-21T17:00:00.000Z",
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
    channelHealth: { mongodb: "mongodb", telegram: "configured", backboard: "configured", elevenlabs: "configured" },
  };
}

function api(): ReviveApi {
  return {
    getCalendar: vi.fn(async () => calendar()),
    getCalendarRange: vi.fn(async () => calendar()),
    getAvailability: vi.fn(async () => ({
      date: "2026-07-20",
      timezone: "America/Toronto",
      service: { id: "haircut", name: "Signature haircut", durationMinutes: 60 },
      slots: [{
        barberId: "jeremy",
        barberName: "Jeremy",
        startAt: "2026-07-20T19:00:00.000Z",
        endAt: "2026-07-20T20:00:00.000Z",
        localTime: "3:00 PM",
      }],
    })),
    getSettings: vi.fn(async () => settings),
    patchSettings: vi.fn(async (patch) => ({ ...settings, ...patch })),
    resetDemo: vi.fn(async () => ({ status: "reset", demoDate: "2026-07-20" })),
    getCustomers: vi.fn(async () => [{
      id: "alex",
      name: "Alex",
      contactPreference: "telegram" as const,
      identitySummary: "Telegram linked",
      activeWaitlistCount: 1,
    }]),
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

function Harness({ client = api() }: { client?: ReviveApi }) {
  const [view, setView] = useState<CalendarView>("day");
  const [date, setDate] = useState("2026-07-20");
  const [barber, setBarber] = useState("all");
  return (
    <CalendarPage
      anchorDate={date}
      api={client}
      barberFilter={barber}
      calendar={calendar()}
      loading={false}
      onAnchorDateChange={setDate}
      onBarberFilterChange={setBarber}
      onMutated={vi.fn(async () => undefined)}
      onViewChange={setView}
      view={view}
    />
  );
}

afterEach(cleanup);

describe("CalendarPage", () => {
  it("renders the clean day grid, filters barbers, and hides cancelled cards", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("columnheader", { name: "Jeremy" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Maya" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Devon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sarah, Signature haircut/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nadia, Skin fade/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Josh, Signature haircut/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Maya" }));
    expect(screen.getByRole("columnheader", { name: "Maya" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Jeremy" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sarah")).not.toBeInTheDocument();
  });

  it("switches among day, week, and month and opens a month date in day view", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByLabelText("Week calendar")).toBeInTheDocument();
    expect(screen.getByText("Tue 21")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByLabelText("Month calendar")).toBeInTheDocument();
    expect(screen.getByText("2 appointments")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Tuesday, July 21" }));
    expect(screen.getByLabelText("Day calendar")).toBeInTheDocument();
    expect(screen.getByText("Tuesday, July 21")).toBeInTheDocument();
  });

  it("opens focused appointment and refill detail drawers", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /Sarah, Signature haircut/ }));
    expect(within(screen.getByRole("dialog", { name: "Appointment details" })).getByText("Jeremy")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close Appointment details" }));
    await user.click(screen.getByRole("button", { name: /Waiting for Sarah/ }));
    const refill = screen.getByRole("dialog", { name: "Refill timeline" });
    expect(within(refill).getByText("Josh cancelled his 5 PM appointment.")).toBeInTheDocument();
    expect(within(refill).getByText("REVIVE called Sarah.")).toBeInTheDocument();
  });

  it("books from live availability and refetches after confirmation", async () => {
    const user = userEvent.setup();
    const client = api();
    const mutated = vi.fn(async () => undefined);
    render(
      <CalendarPage
        anchorDate="2026-07-20"
        api={client}
        barberFilter="all"
        calendar={calendar()}
        loading={false}
        onAnchorDateChange={vi.fn()}
        onBarberFilterChange={vi.fn()}
        onMutated={mutated}
        onViewChange={vi.fn()}
        view="day"
      />,
    );

    await user.click(screen.getByRole("button", { name: "New appointment" }));
    const dialog = screen.getByRole("dialog", { name: "New appointment" });
    await waitFor(() => expect(client.getCustomers).toHaveBeenCalled());
    await waitFor(() => expect(client.getAvailability).toHaveBeenCalled());
    await user.selectOptions(within(dialog).getByLabelText("Time"), "2026-07-20T19:00:00.000Z");
    await user.click(within(dialog).getByRole("button", { name: "Confirm appointment" }));

    await waitFor(() => expect(client.bookAppointment).toHaveBeenCalledWith({
      customerId: "alex",
      barberId: "jeremy",
      serviceId: "haircut",
      startAt: "2026-07-20T19:00:00.000Z",
    }));
    expect(mutated).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "New appointment" })).not.toBeInTheDocument();
  });

  it("keeps the editor open when another change wins the slot", async () => {
    const user = userEvent.setup();
    const client = api();
    client.bookAppointment = vi.fn(async () => {
      throw new ReviveApiError("That time was just taken.", 409, "STALE_SLOT");
    });
    render(<Harness client={client} />);

    await user.click(screen.getByRole("button", { name: "New appointment" }));
    const dialog = screen.getByRole("dialog", { name: "New appointment" });
    await waitFor(() => expect(client.getAvailability).toHaveBeenCalled());
    await user.selectOptions(within(dialog).getByLabelText("Time"), "2026-07-20T19:00:00.000Z");
    await user.click(within(dialog).getByRole("button", { name: "Confirm appointment" }));

    expect(await within(dialog).findByText("That time was just taken.")).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });
});
