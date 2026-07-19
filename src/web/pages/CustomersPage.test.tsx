// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CustomersPage } from "./CustomersPage.js";
import type {
  CustomerDetail,
  CustomerSummary,
  ReviveApi,
  SchedulingSettings,
} from "../types.js";

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

const summaries: CustomerSummary[] = [
  {
    id: "alex",
    name: "Alex",
    contactPreference: "telegram",
    identitySummary: "Telegram linked",
    activeWaitlistCount: 1,
  },
  {
    id: "sarah",
    name: "Sarah",
    contactPreference: "voice",
    identitySummary: "Phone linked",
    activeWaitlistCount: 0,
    nextAppointmentAt: "2026-07-20T22:00:00.000Z",
    nextBarberName: "Jeremy",
  },
];

function customer(id: string): CustomerDetail {
  const sarah = id === "sarah";
  return {
    id,
    name: sarah ? "Sarah" : "Alex",
    identities: sarah
      ? { telegram: "Not linked", phone: "••• ••• 0101" }
      : { telegram: "Linked account", phone: "Not linked" },
    preferences: {
      contactPreference: sarah ? "voice" : "telegram",
      earlierMoveConsent: sarah,
      flexibleBarberPreference: false,
      pastCustomerOptIn: sarah,
    },
    appointments: [
      {
        id: `${id}-future`,
        customerId: id,
        customerName: sarah ? "Sarah" : "Alex",
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
        id: `${id}-past`,
        customerId: id,
        customerName: sarah ? "Sarah" : "Alex",
        barberId: "maya",
        barberName: "Maya",
        serviceId: "haircut",
        serviceName: "Signature haircut",
        startAt: "2026-07-10T18:00:00.000Z",
        endAt: "2026-07-10T19:00:00.000Z",
        status: "confirmed",
        discountPercent: 0,
        version: 1,
        history: [],
      },
    ],
    waitlist: sarah ? [] : [{
      id: "waitlist-alex",
      customerId: "alex",
      customerName: "Alex",
      serviceId: "haircut",
      serviceName: "Signature haircut",
      barberId: "jeremy",
      barberName: "Jeremy",
      date: "2026-07-20",
      earliestStart: "2026-07-20T21:00:00.000Z",
      latestStart: "2026-07-20T23:00:00.000Z",
      status: "active",
      channel: "telegram",
      outreachState: "not_contacted",
      createdAt: "2026-07-18T16:00:00.000Z",
    }],
    notes: [{
      id: `${id}-note`,
      text: sarah ? "Prefers a quick phone call." : "Usually free after work.",
      author: "operator",
      createdAt: "2026-07-18T16:00:00.000Z",
    }],
  };
}

function api(): ReviveApi {
  const details = new Map(summaries.map((summary) => [summary.id, customer(summary.id)]));
  return {
    getCalendar: vi.fn(async () => { throw new Error("unused"); }),
    getCalendarRange: vi.fn(async () => { throw new Error("unused"); }),
    getAvailability: vi.fn(async () => { throw new Error("unused"); }),
    getSettings: vi.fn(async () => settings),
    patchSettings: vi.fn(async (patch) => ({ ...settings, ...patch })),
    resetDemo: vi.fn(async () => ({ status: "reset", demoDate: "2026-07-20" })),
    getCustomers: vi.fn(async (query) => summaries.filter((summary) => summary.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))),
    getCustomer: vi.fn(async (id) => structuredClone(details.get(id)!)),
    patchCustomer: vi.fn(async (id, patch) => {
      const current = details.get(id)!;
      const updated = { ...current, preferences: { ...current.preferences, ...patch } };
      details.set(id, updated);
      return structuredClone(updated);
    }),
    addCustomerNote: vi.fn(async (id, text) => {
      const current = details.get(id)!;
      const note = { id: `note-${Date.now()}`, text, author: "operator" as const, createdAt: "2026-07-18T17:00:00.000Z" };
      details.set(id, { ...current, notes: [note, ...current.notes] });
      return note;
    }),
    getConversations: vi.fn(async () => []),
    getConversation: vi.fn(async () => { throw new Error("unused"); }),
    getWaitlist: vi.fn(async () => []),
    patchWaitlist: vi.fn(async () => { throw new Error("unused"); }),
    getActivity: vi.fn(async () => []),
    bookAppointment: vi.fn(async () => { throw new Error("unused"); }),
    rescheduleAppointment: vi.fn(async () => { throw new Error("unused"); }),
    cancelAppointment: vi.fn(async () => { throw new Error("unused"); }),
  };
}

afterEach(cleanup);

describe("CustomersPage", () => {
  it("searches customers and shows one masked operational record", async () => {
    const user = userEvent.setup();
    render(<CustomersPage api={api()} refreshKey={0} />);

    expect(await screen.findByRole("heading", { name: "Customers" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Sarah/ }));
    const record = await screen.findByRole("region", { name: "Sarah customer record" });

    expect(within(record).getByText("••• ••• 0101")).toBeInTheDocument();
    expect(within(record).getByText("Not linked")).toBeInTheDocument();
    expect(screen.queryByText("+14165550101")).not.toBeInTheDocument();
    for (const section of ["Preferences", "Appointments", "Waitlist", "Private notes"]) {
      expect(within(record).getByRole("heading", { name: section })).toBeInTheDocument();
    }
    expect(within(record).getByText("Upcoming")).toBeInTheDocument();
    expect(within(record).getByText("Past")).toBeInTheDocument();
    expect(within(record).getByText("Prefers a quick phone call.")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Search customers" }));
    await user.type(screen.getByRole("searchbox", { name: "Search customers" }), "Sarah");
    await waitFor(() => expect(screen.queryByRole("button", { name: /Alex/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Sarah/ })).toBeInTheDocument();
  });

  it("updates consent preferences and adds trimmed private notes", async () => {
    const user = userEvent.setup();
    const client = api();
    render(<CustomersPage api={client} refreshKey={0} />);

    await user.click(await screen.findByRole("button", { name: /Sarah/ }));
    await screen.findByRole("region", { name: "Sarah customer record" });

    await user.click(screen.getByRole("checkbox", { name: "Offer earlier appointments" }));
    await waitFor(() => expect(client.patchCustomer).toHaveBeenCalledWith(
      "sarah",
      { earlierMoveConsent: false },
    ));
    await user.click(screen.getByRole("checkbox", { name: "Any qualified barber" }));
    await waitFor(() => expect(client.patchCustomer).toHaveBeenCalledWith(
      "sarah",
      { flexibleBarberPreference: true },
    ));
    await user.click(screen.getByRole("checkbox", { name: "Past-customer outreach" }));
    await waitFor(() => expect(client.patchCustomer).toHaveBeenCalledWith(
      "sarah",
      { pastCustomerOptIn: false },
    ));

    await user.type(screen.getByLabelText("New private note"), "  Ask about a beard trim next time.  ");
    await user.click(screen.getByRole("button", { name: "Add private note" }));
    await waitFor(() => expect(client.addCustomerNote).toHaveBeenCalledWith(
      "sarah",
      "Ask about a beard trim next time.",
    ));
    expect(await screen.findByText("Ask about a beard trim next time.")).toBeInTheDocument();
    expect(client.getCustomer).toHaveBeenCalledTimes(6);
    expect(screen.queryByText(/segments|lifetime value|campaign/i)).not.toBeInTheDocument();
  });
});
