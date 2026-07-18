import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

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
});
