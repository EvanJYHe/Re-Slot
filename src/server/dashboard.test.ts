import { describe, expect, it } from "vitest";

import type { ReviveState } from "../domain/store.js";
import type { RefillJob } from "../domain/types.js";
import { projectDashboard } from "./dashboard.js";

const monday = "2026-07-20";
const timezone = "America/Toronto";

function refill(id: string, status: RefillJob["status"], timelineType: "opening_filled" | "appointment_moved" | "search_exhausted"): RefillJob {
  return {
    id,
    sourceAppointmentId: `${id}-source`,
    barberId: "jeremy",
    serviceId: "haircut",
    slotStartAt: "2026-07-20T14:00:00.000Z",
    slotEndAt: "2026-07-20T15:00:00.000Z",
    status,
    moveDepth: 0,
    attemptedCustomerIds: [],
    timeline: [{
      type: timelineType,
      at: "2026-07-20T14:30:00.000Z",
      message: timelineType,
      ...(timelineType === "opening_filled" ? { offerId: "offer-fill" } : {}),
    }],
    version: 1,
    createdAt: "2026-07-20T14:00:00.000Z",
    updatedAt: "2026-07-20T14:30:00.000Z",
  };
}

function state(): ReviveState {
  return {
    customers: [{
      id: "alex",
      name: "Alex",
      contactPreference: "telegram",
      earlierMoveConsent: false,
      flexibleBarberPreference: false,
      pastCustomerOptIn: false,
    }],
    barbers: [{
      id: "jeremy",
      name: "Jeremy",
      serviceIds: ["haircut"],
      weeklyHours: { 1: [{ start: "10:00", end: "20:00" }] },
    }],
    services: [{ id: "haircut", name: "Signature haircut", durationMinutes: 60, priceCents: 4500 }],
    appointments: [{
      id: "filled-appointment",
      customerId: "alex",
      barberId: "jeremy",
      serviceId: "haircut",
      startAt: "2026-07-20T14:00:00.000Z",
      endAt: "2026-07-20T15:00:00.000Z",
      status: "confirmed",
      discountPercent: 10,
      version: 1,
      history: [{
        type: "booked",
        actor: "telegram",
        consent: "explicit",
        createdAt: "2026-07-20T14:30:00.000Z",
        toStartAt: "2026-07-20T14:00:00.000Z",
        offerId: "offer-fill",
      }],
    }, {
      id: "regular-appointment",
      customerId: "alex",
      barberId: "jeremy",
      serviceId: "haircut",
      startAt: "2026-07-20T16:00:00.000Z",
      endAt: "2026-07-20T17:00:00.000Z",
      status: "confirmed",
      discountPercent: 0,
      version: 1,
      history: [],
    }],
    waitlist: [{
      id: "waitlist-active",
      customerId: "alex",
      serviceId: "haircut",
      date: monday,
      earliestStart: "17:00",
      latestStart: "19:00",
      status: "active",
      createdAt: "2026-07-20T13:00:00.000Z",
    }],
    refillJobs: [
      refill("job-fill", "completed", "opening_filled"),
      refill("job-move", "completed", "appointment_moved"),
      refill("job-failed", "failed", "search_exhausted"),
      refill("job-active", "pending", "appointment_moved"),
    ],
    offers: [{
      id: "offer-fill",
      jobId: "job-fill",
      customerId: "alex",
      candidateKind: "waitlist",
      channel: "telegram",
      status: "accepted",
      proposedStartAt: "2026-07-20T14:00:00.000Z",
      proposedEndAt: "2026-07-20T15:00:00.000Z",
      discountPercent: 10,
      expiresAt: "2026-07-20T14:32:00.000Z",
      deliveryAttempts: 1,
      createdAt: "2026-07-20T14:00:00.000Z",
      updatedAt: "2026-07-20T14:30:00.000Z",
    }],
    processedEvents: [],
    backboardThreads: [],
    conversations: [],
    conversationEvents: [],
    customerNotes: [],
    events: [],
    settings: {
      timezone,
      refillEnabled: true,
      moveEarlierEnabled: true,
      moveLimit: 3,
      allowAlternateBarbers: true,
      waitlistEnabled: true,
      pastCustomerOutreachEnabled: true,
      maxDiscountPercent: 15,
      offerExpirySeconds: 120,
    },
  };
}

describe("projectDashboard", () => {
  it("reconciles revenue, refill outcomes, utilization, and daily totals", () => {
    const result = projectDashboard(state(), { start: monday, end: monday });

    expect(result.metrics).toEqual({
      recoveredRevenueCents: 4050,
      confirmedRevenueCents: 8550,
      chairsRecovered: 1,
      refillSuccessRate: 33.3,
      averageRefillMinutes: 30,
      chairUtilizationRate: 20,
      activeWaitlist: 1,
      activeRecoveries: 1,
    });
    expect(result.daily).toEqual([{
      date: monday,
      confirmedRevenueCents: 8550,
      recoveredRevenueCents: 4050,
    }]);
    expect(result.recentOutcomes[0]).toMatchObject({ jobId: "job-fill", revenueCents: 4050 });
  });

  it("returns honest zero values when the selected range has no activity", () => {
    const result = projectDashboard(state(), { start: "2026-07-21", end: "2026-07-21" });

    expect(result.metrics).toMatchObject({
      recoveredRevenueCents: 0,
      confirmedRevenueCents: 0,
      chairsRecovered: 0,
      averageRefillMinutes: 0,
    });
    expect(result.daily).toEqual([{
      date: "2026-07-21",
      confirmedRevenueCents: 0,
      recoveredRevenueCents: 0,
    }]);
  });
});
