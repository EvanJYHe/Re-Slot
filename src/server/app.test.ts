import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReviveEngine } from "../domain/engine.js";
import { InMemoryStore } from "../domain/store.js";
import type { ActorContext } from "../domain/types.js";
import { buildServer } from "./app.js";
import type { AppConfig } from "./config.js";
import { createDemoState, getDemoDate } from "./seed.js";

const now = "2026-07-18T16:00:00.000Z";
const config: AppConfig = {
  nodeEnv: "test",
  port: 3000,
  publicBaseUrl: "http://localhost:3000",
  timezone: "America/Toronto",
  demoMode: true,
  demoAdminPin: "4242",
  adminSessionSecret: "test-session-secret-with-enough-length",
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
    expect(response.body).not.toContain("test-session-secret");
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
  });

  it("authenticates demo reset and preserves provider-linked identities", async () => {
    const denied = await app.inject({ method: "POST", url: "/api/v1/demo/reset" });
    expect(denied.statusCode).toBe(401);

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/admin/session",
      payload: { pin: "4242" },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json<{ token: string }>().token;

    await store.transaction((state) => {
      state.customers.find((customer) => customer.id === "josh")!.telegramChatId = "updated-josh";
      state.customers.find((customer) => customer.id === "alex")!.telegramChatId = "updated-alex";
      state.customers.find((customer) => customer.id === "sarah")!.phone = "+14165550999";
    });
    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/demo/reset",
      headers: { authorization: `Bearer ${token}` },
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
});
