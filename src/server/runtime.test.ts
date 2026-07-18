import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "./config.js";
import { createRuntime, type ReviveRuntime } from "./runtime.js";

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
  mongoDatabase: "revive_runtime_test",
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

describe("REVIVE runtime", () => {
  let runtime: ReviveRuntime | undefined;
  let staticRoot: string | undefined;

  afterEach(async () => {
    await runtime?.close();
    if (staticRoot !== undefined) await rm(staticRoot, { recursive: true, force: true });
  });

  it("boots a seeded memory-backed service with an idle worker lifecycle", async () => {
    runtime = await createRuntime(config, { clock: () => now, workerIntervalMs: 10 });

    const health = await runtime.app.inject({ method: "GET", url: "/health" });
    const calendar = await runtime.app.inject({
      method: "GET",
      url: "/api/v1/calendar?date=2026-07-20",
    });

    expect(runtime.storeKind).toBe("memory");
    expect(runtime.workerEnabled).toBe(false);
    expect(health.json()).toMatchObject({ status: "ok", providers: { mongodb: "memory" } });
    expect(calendar.json()).toMatchObject({
      appointments: expect.arrayContaining([
        expect.objectContaining({ customerName: "Josh", status: "confirmed" }),
        expect.objectContaining({ customerName: "Sarah", status: "confirmed" }),
      ]),
    });
  });

  it("serves the built React shell and preserves API 404s", async () => {
    staticRoot = await mkdtemp(join(tmpdir(), "revive-static-"));
    await writeFile(join(staticRoot, "index.html"), "<!doctype html><title>REVIVE board</title>");
    runtime = await createRuntime(config, { clock: () => now, staticRoot });

    const page = await runtime.app.inject({ method: "GET", url: "/" });
    const missingApi = await runtime.app.inject({ method: "GET", url: "/api/v1/missing" });

    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.body).toContain("REVIVE board");
    expect(missingApi.statusCode).toBe(404);
    expect(missingApi.headers["content-type"]).toContain("application/json");
  });

  it("idempotently registers the production Telegram webhook", async () => {
    const fetchImpl = vi.fn(async (
      _input: string | URL | Request,
      _init?: RequestInit,
    ) => new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    runtime = await createRuntime({
      ...config,
      nodeEnv: "production",
      publicBaseUrl: "https://revive.example",
      telegramBotToken: "test-bot-token",
      telegramWebhookSecret: "test-webhook-secret",
    }, { clock: () => now, fetchImpl });

    const result = await runtime.configureWebhooks();

    expect(result).toEqual({ telegram: "registered" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const request = fetchImpl.mock.calls[0];
    expect(String(request?.[0])).toContain("/setWebhook");
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      url: "https://revive.example/webhooks/telegram",
      secret_token: "test-webhook-secret",
      allowed_updates: ["message"],
    });
  });
});
