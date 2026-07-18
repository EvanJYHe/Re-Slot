import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { rankRefillCandidates } from "../domain/scheduling.js";
import { createDemoState, getDemoDate } from "./seed.js";

describe("demo seed", () => {
  it("uses the next operational weekday for a weekend reset", () => {
    expect(getDemoDate("2026-07-18T12:00:00.000-04:00", "America/Toronto")).toBe("2026-07-20");
  });

  it("creates the Josh, Sarah, and Alex golden path with 7 PM open", () => {
    const state = createDemoState({
      now: "2026-07-18T16:00:00.000Z",
      timezone: "America/Toronto",
    });
    const demoDate = "2026-07-20";
    const at = (hour: number) => DateTime.fromISO(`${demoDate}T${hour}:00`, {
      zone: "America/Toronto",
    }).toUTC().toISO();

    expect(state.appointments).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerId: "josh", barberId: "jeremy", startAt: at(17) }),
      expect.objectContaining({ customerId: "sarah", barberId: "jeremy", startAt: at(18) }),
    ]));
    expect(state.appointments).not.toContainEqual(
      expect.objectContaining({ barberId: "jeremy", startAt: at(19), status: "confirmed" }),
    );
    expect(state.waitlist).toContainEqual(expect.objectContaining({
      customerId: "alex",
      barberId: "jeremy",
      earliestStart: "17:00",
      latestStart: "19:00",
      status: "active",
    }));
    expect(state.customers.find((customer) => customer.id === "sarah")).toMatchObject({
      contactPreference: "voice",
      earlierMoveConsent: true,
    });
  });

  it("preserves linked Telegram IDs and Sarah's configured phone across reset", () => {
    const state = createDemoState({
      now: "2026-07-18T16:00:00.000Z",
      timezone: "America/Toronto",
      preservedIdentities: {
        joshTelegramChatId: "1001",
        alexTelegramChatId: "2002",
        sarahPhone: "+14165550101",
      },
    });

    expect(state.customers.find((customer) => customer.id === "josh")?.telegramChatId).toBe("1001");
    expect(state.customers.find((customer) => customer.id === "alex")?.telegramChatId).toBe("2002");
    expect(state.customers.find((customer) => customer.id === "sarah")?.phone).toBe("+14165550101");
  });

  it("creates a realistic collision-free operational week without fake provider activity", () => {
    const state = createDemoState({
      now: "2026-07-18T16:00:00.000Z",
      timezone: "America/Toronto",
    });
    const confirmed = state.appointments.filter((appointment) => appointment.status === "confirmed");
    const uniqueSlots = new Set(confirmed.map((appointment) => `${appointment.barberId}:${appointment.startAt}`));

    expect(confirmed.length).toBeGreaterThanOrEqual(20);
    expect(uniqueSlots.size).toBe(confirmed.length);
    for (const barber of state.barbers) {
      const workingDates = new Set(confirmed
        .filter((appointment) => appointment.barberId === barber.id)
        .map((appointment) => DateTime.fromISO(appointment.startAt)
          .setZone(state.settings.timezone)
          .toISODate()));
      expect(workingDates.size).toBeGreaterThanOrEqual(3);
    }
    expect(state.conversations).toEqual([]);
    expect(state.conversationEvents).toEqual([]);
    expect(state.customerNotes).toHaveLength(2);
  });

  it("keeps Alex first for Sarah's successor opening", () => {
    const state = createDemoState({
      now: "2026-07-18T16:00:00.000Z",
      timezone: "America/Toronto",
    });
    const sarah = state.appointments.find((appointment) => appointment.id === "sarah-appt")!;
    const originalStartAt = sarah.startAt;
    const originalEndAt = sarah.endAt;
    sarah.startAt = DateTime.fromISO(sarah.startAt).minus({ hours: 1 }).toUTC().toISO()!;
    sarah.endAt = DateTime.fromISO(sarah.endAt).minus({ hours: 1 }).toUTC().toISO()!;

    const ranked = rankRefillCandidates({
      job: {
        id: "successor-job",
        sourceAppointmentId: "sarah-appt",
        barberId: "jeremy",
        serviceId: "haircut",
        slotStartAt: originalStartAt,
        slotEndAt: originalEndAt,
        status: "pending",
        moveDepth: 1,
        attemptedCustomerIds: [],
        timeline: [],
        version: 1,
        createdAt: "2026-07-20T16:01:00.000Z",
        updatedAt: "2026-07-20T16:01:00.000Z",
      },
      customers: state.customers,
      appointments: state.appointments,
      waitlist: state.waitlist,
      settings: state.settings,
      now: "2026-07-20T16:01:00.000Z",
    });

    expect(ranked[0]).toMatchObject({ customerId: "alex", kind: "waitlist" });
    expect(state.waitlist.filter((entry) => entry.date === "2026-07-20")).toHaveLength(1);
  });
});
