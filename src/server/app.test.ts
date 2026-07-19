import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReviveEngine } from "../domain/engine.js";
import { InMemoryStore } from "../domain/store.js";
import type { ActorContext } from "../domain/types.js";
import { buildServer } from "./app.js";
import type { AppConfig } from "./config.js";
import { recordConversationEvent } from "./conversations.js";
import { createDemoState, getDemoDate } from "./seed.js";

const now = "2026-07-18T16:00:00.000Z";
const config: AppConfig = {
  nodeEnv: "test",
  port: 3000,
  publicBaseUrl: "http://localhost:3000",
  timezone: "America/Toronto",
  demoMode: true,
  voiceActorSecret: "test-voice-actor-secret-with-enough-length",
  dataStore: "memory",
  mongoUri: undefined,
  mongoDatabase: "revive_test",
  telegramBotToken: undefined,
  telegramWebhookSecret: undefined,
  backboardApiKey: undefined,
  backboardAssistantId: undefined,
  elevenLabsApiKey: undefined,
  elevenLabsAgentId: undefined,
  elevenLabsPhoneNumberId: undefined,
  elevenLabsWebhookSecret: undefined,
  sarahPhone: "+14165550101",
};

describe("REVIVE Fastify API", () => {
  let store: InMemoryStore;
  let engine: ReviveEngine;
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    store = new InMemoryStore(createDemoState({
      now,
      timezone: config.timezone,
      preservedIdentities: {
        joshTelegramChatId: "1001",
        alexTelegramChatId: "2002",
        sarahPhone: config.sarahPhone!,
      },
    }));
    engine = new ReviveEngine(store);
    app = await buildServer({ config, store, engine, clock: () => now });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns health and explicit provider readiness without exposing secrets", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "revive",
      providers: {
        mongodb: "memory",
        telegram: "unconfigured",
        backboard: "unconfigured",
        elevenlabs: "unconfigured",
      },
    });
    expect(response.body).not.toContain("test-voice-actor-secret");
  });

  it("opens local operator routes without a bearer session", async () => {
    const responses = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/customers" }),
      app.inject({ method: "GET", url: "/api/v1/conversations" }),
      app.inject({ method: "GET", url: "/api/v1/waitlist" }),
      app.inject({ method: "GET", url: "/api/v1/activity" }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200]);
    expect((await app.inject({
      method: "POST",
      url: "/api/v1/admin/session",
      payload: { pin: "4242" },
    })).statusCode).toBe(404);
  });

  it("returns an authoritative enriched calendar with active refill state", async () => {
    const actor: ActorContext = { provider: "telegram", customerId: "josh" };
    await engine.cancel({ actor, appointmentId: "josh-appt", now });
    const date = getDemoDate(now, config.timezone);

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/calendar?date=${date}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      date,
      timezone: config.timezone,
      appointments: expect.arrayContaining([
        expect.objectContaining({ customerName: "Josh", status: "cancelled" }),
        expect.objectContaining({ customerName: "Sarah", status: "confirmed" }),
      ]),
      activeRefills: [expect.objectContaining({
        customerState: "Finding a replacement…",
        status: "pending",
      })],
    });
  });

  it("validates and persists settings patches", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings",
      payload: { moveLimit: 2, maxDiscountPercent: 10, allowAlternateBarbers: false },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      moveLimit: 2,
      maxDiscountPercent: 10,
      allowAlternateBarbers: false,
    });
    expect((await store.read()).settings.moveLimit).toBe(2);

    const invalid = await app.inject({
      method: "PATCH",
      url: "/api/v1/settings",
      payload: { moveLimit: 9 },
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("returns the plain-language timeline for a refill job", async () => {
    await engine.cancel({
      actor: { provider: "telegram", customerId: "josh" },
      appointmentId: "josh-appt",
      now,
    });
    const jobId = (await store.read()).refillJobs[0]!.id;
    await store.transaction((state) => {
      const job = state.refillJobs[0]!;
      job.status = "awaiting_offer";
      job.currentOfferId = "safe-offer";
      state.offers.push({
        id: "safe-offer",
        jobId,
        customerId: "sarah",
        candidateKind: "move_earlier",
        channel: "voice",
        status: "delivered",
        proposedStartAt: job.slotStartAt,
        proposedEndAt: job.slotEndAt,
        originalAppointmentId: "sarah-appt",
        originalStartAt: "2026-07-20T22:00:00.000Z",
        discountPercent: 0,
        expiresAt: "2026-07-20T16:02:00.000Z",
        providerMessageId: "private-provider-message-id",
        deliveryAttempts: 1,
        createdAt: now,
        updatedAt: now,
      });
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/refill-jobs/${jobId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: jobId,
      barberName: "Jeremy",
      serviceName: "Signature haircut",
      timeline: [expect.objectContaining({ message: expect.stringContaining("cancelled") })],
    });
    expect(response.body).not.toContain("private-provider-message-id");
  });

  it("resets the local demo and preserves provider-linked identities", async () => {
    await store.transaction((state) => {
      state.customers.find((customer) => customer.id === "josh")!.telegramChatId = "updated-josh";
      state.customers.find((customer) => customer.id === "alex")!.telegramChatId = "updated-alex";
      state.customers.find((customer) => customer.id === "sarah")!.phone = "+14165550999";
    });
    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/demo/reset",
    });

    expect(reset.statusCode).toBe(200);
    const snapshot = await store.read();
    expect(snapshot.customers.find((customer) => customer.id === "josh")?.telegramChatId).toBe("updated-josh");
    expect(snapshot.customers.find((customer) => customer.id === "alex")?.telegramChatId).toBe("updated-alex");
    expect(snapshot.customers.find((customer) => customer.id === "sarah")?.phone).toBe("+14165550999");
  });

  it("emits an SSE-compatible authoritative refresh event", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/events?once=true" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain("event: connected");
    expect(response.body).toContain("data:");
  });

  it("returns inclusive calendar ranges and rejects ranges longer than 42 days", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/calendar?start=2026-07-20&end=2026-07-24",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      date: "2026-07-20",
      range: { start: "2026-07-20", end: "2026-07-24" },
      appointments: expect.arrayContaining([
        expect.objectContaining({ id: "josh-appt" }),
        expect.objectContaining({ id: "fri-nadia" }),
      ]),
    });

    const tooLong = await app.inject({
      method: "GET",
      url: "/api/v1/calendar?start=2026-07-01&end=2026-08-20",
    });
    expect(tooLong.statusCode).toBe(400);
  });

  it("returns safe customer, waitlist, conversation, and activity models", async () => {
    await recordConversationEvent(store, {
      customerId: "alex",
      channel: "telegram",
      conversationDirection: "inbound",
      providerConversationId: "2002",
      providerEventId: "update-44",
      kind: "message",
      direction: "inbound",
      speaker: "customer",
      text: "Is six still open?",
      occurredAt: now,
    });

    const customers = await app.inject({ method: "GET", url: "/api/v1/customers?q=alex" });
    const detail = await app.inject({ method: "GET", url: "/api/v1/customers/alex" });
    const waitlist = await app.inject({ method: "GET", url: "/api/v1/waitlist" });
    const conversations = await app.inject({ method: "GET", url: "/api/v1/conversations" });
    const conversationId = conversations.json<Array<{ id: string }>>()[0]!.id;
    const conversation = await app.inject({
      method: "GET",
      url: `/api/v1/conversations/${conversationId}`,
    });
    const activity = await app.inject({ method: "GET", url: "/api/v1/activity" });

    for (const response of [customers, detail, waitlist, conversations, conversation, activity]) {
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain("+14165550101");
      expect(response.body).not.toContain("telegramChatId");
      expect(response.body).not.toContain("providerConversationId");
    }
    expect(customers.json()).toEqual([expect.objectContaining({ name: "Alex" })]);
    expect(conversation.json()).toMatchObject({
      events: [expect.objectContaining({ text: "Is six still open?" })],
    });
  });

  it("uses live availability and the deterministic engine for operator appointment mutations", async () => {
    const availability = await app.inject({
      method: "GET",
      url: "/api/v1/availability?date=2026-07-20&serviceId=haircut&barberId=jeremy",
    });
    expect(availability.statusCode).toBe(200);
    expect(availability.json()).toMatchObject({
      date: "2026-07-20",
      slots: expect.arrayContaining([
        expect.objectContaining({ barberId: "jeremy", startAt: "2026-07-20T20:00:00.000Z" }),
      ]),
    });

    const booking = await app.inject({
      method: "POST",
      url: "/api/v1/appointments",
      payload: {
        customerId: "alex",
        barberId: "jeremy",
        serviceId: "haircut",
        startAt: "2026-07-20T20:00:00.000Z",
      },
    });
    expect(booking.statusCode).toBe(200);
    const appointmentId = booking.json<{ appointmentId: string }>().appointmentId;
    const collision = await app.inject({
      method: "POST",
      url: "/api/v1/appointments",
      payload: {
        customerId: "nadia",
        barberId: "jeremy",
        serviceId: "haircut",
        startAt: "2026-07-20T20:00:00.000Z",
      },
    });
    expect(collision.statusCode).toBe(409);

    const moved = await app.inject({
      method: "PATCH",
      url: `/api/v1/appointments/${appointmentId}`,
      payload: { barberId: "jeremy", startAt: "2026-07-20T19:00:00.000Z" },
    });
    expect(moved.statusCode).toBe(200);
    const cancelled = await app.inject({
      method: "POST",
      url: `/api/v1/appointments/${appointmentId}/cancel`,
    });
    expect(cancelled.statusCode).toBe(200);
    expect((await store.read()).appointments.find((item) => item.id === appointmentId)).toMatchObject({
      startAt: "2026-07-20T19:00:00.000Z",
      status: "cancelled",
    });
  });

  it("updates customer preferences, notes, and waitlist state with SSE-visible events", async () => {
    const updated = await app.inject({
      method: "PATCH",
      url: "/api/v1/customers/sarah",
      payload: { flexibleBarberPreference: true, earlierMoveConsent: false },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      preferences: { flexibleBarberPreference: true, earlierMoveConsent: false },
    });
    const note = await app.inject({
      method: "POST",
      url: "/api/v1/customers/sarah/notes",
      payload: { text: "  Please confirm major changes by phone.  " },
    });
    expect(note.statusCode).toBe(200);
    expect(note.json()).toMatchObject({ text: "Please confirm major changes by phone." });
    const waitlist = await app.inject({
      method: "PATCH",
      url: "/api/v1/waitlist/nadia-waitlist",
      payload: { status: "paused", operatorNote: "Hold until tomorrow." },
    });
    expect(waitlist.statusCode).toBe(200);
    expect(waitlist.json()).toMatchObject({ status: "paused", operatorNote: "Hold until tomorrow." });

    const events = (await store.read()).events.map((event) => event.type);
    expect(events).toEqual(expect.arrayContaining([
      "customer.updated",
      "customer.note_added",
      "waitlist.updated",
    ]));
  });
});
