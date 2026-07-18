import { createHmac, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import rawBody from "fastify-raw-body";
import { DateTime } from "luxon";
import { z, ZodError } from "zod";

import type { ReviveEngine } from "../domain/engine.js";
import type { ReviveStore } from "../domain/store.js";
import type { SchedulingSettings } from "../domain/types.js";
import type { AppConfig } from "./config.js";
import type { ElevenLabsWebhookService } from "./providers/elevenlabs.js";
import type { TelegramWebhookHandler } from "./providers/telegram.js";
import { createDemoState, getDemoDate } from "./seed.js";

interface BuildServerOptions {
  config: AppConfig;
  store: ReviveStore;
  engine: ReviveEngine;
  clock?: () => string;
  storeKind?: "memory" | "mongodb";
  telegramWebhook?: TelegramWebhookHandler;
  elevenLabsWebhooks?: ElevenLabsWebhookService;
}

const settingsPatchSchema = z.object({
  refillEnabled: z.boolean().optional(),
  moveEarlierEnabled: z.boolean().optional(),
  moveLimit: z.number().int().min(0).max(3).optional(),
  allowAlternateBarbers: z.boolean().optional(),
  waitlistEnabled: z.boolean().optional(),
  pastCustomerOutreachEnabled: z.boolean().optional(),
  maxDiscountPercent: z.number().int().min(0).max(15).optional(),
  offerExpirySeconds: z.number().int().min(30).max(900).optional(),
}).strict();

const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function safePinEqual(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function safeSecretEqual(provided: string | undefined, expected: string | undefined): boolean {
  if (provided === undefined || expected === undefined) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function signSession(config: AppConfig, issuedAt: string): string {
  const payload = Buffer.from(JSON.stringify({
    scope: "demo:reset",
    exp: DateTime.fromISO(issuedAt).plus({ hours: 4 }).toUnixInteger(),
  })).toString("base64url");
  const signature = createHmac("sha256", config.adminSessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(request: FastifyRequest, config: AppConfig, now: string): boolean {
  const authorization = request.headers.authorization;
  if (authorization === undefined || !authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length);
  const [payload, signature, extra] = token.split(".");
  if (payload === undefined || signature === undefined || extra !== undefined) return false;
  const expected = createHmac("sha256", config.adminSessionSecret).update(payload).digest("base64url");
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return false;
  try {
    const parsed = z.object({ scope: z.literal("demo:reset"), exp: z.number().int() })
      .parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return parsed.exp > DateTime.fromISO(now).toUnixInteger();
  } catch {
    return false;
  }
}

function providerReadiness(config: AppConfig, storeKind: "memory" | "mongodb") {
  return {
    mongodb: storeKind,
    telegram: config.telegramBotToken !== undefined && config.telegramWebhookSecret !== undefined
      ? "configured"
      : "unconfigured",
    backboard: config.backboardApiKey !== undefined && config.backboardAssistantId !== undefined
      ? "configured"
      : "unconfigured",
    elevenlabs: config.elevenLabsApiKey !== undefined
      && config.elevenLabsAgentId !== undefined
      && config.elevenLabsPhoneNumberId !== undefined
      && config.elevenLabsWebhookSecret !== undefined
      ? "configured"
      : "unconfigured",
  } as const;
}

export async function buildServer(options: BuildServerOptions): Promise<FastifyInstance> {
  const clock = options.clock ?? (() => new Date().toISOString());
  const storeKind = options.storeKind ?? (options.config.mongoUri === undefined ? "memory" : "mongodb");
  const app = Fastify({
    logger: options.config.nodeEnv === "test" ? false : {
      level: options.config.nodeEnv === "production" ? "info" : "debug",
      redact: [
        "req.headers.authorization",
        "req.headers.x-telegram-bot-api-secret-token",
        "req.headers.elevenlabs-signature",
      ],
    },
  });
  await app.register(rawBody, {
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      void reply.status(400).send({
        error: "invalid_request",
        message: "The request did not match the expected format.",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
      return;
    }
    request.log.error({ err: error }, "request failed");
    void reply.status(500).send({ error: "internal_error", message: "REVIVE could not complete the request." });
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "revive",
    time: clock(),
    providers: providerReadiness(options.config, storeKind),
  }));

  app.post("/webhooks/telegram", async (request, reply) => {
    if (options.telegramWebhook === undefined || options.config.telegramWebhookSecret === undefined) {
      return reply.status(503).send({ error: "telegram_unconfigured" });
    }
    const supplied = request.headers["x-telegram-bot-api-secret-token"];
    if (!safeSecretEqual(
      typeof supplied === "string" ? supplied : supplied?.[0],
      options.config.telegramWebhookSecret,
    )) {
      return reply.status(401).send({ error: "invalid_telegram_secret" });
    }
    const result = await options.telegramWebhook.handle(request.body);
    return { ok: true, ...result };
  });

  app.post("/webhooks/elevenlabs/context", async (request, reply) => {
    if (options.elevenLabsWebhooks === undefined || options.config.elevenLabsWebhookSecret === undefined) {
      return reply.status(503).send({ error: "elevenlabs_unconfigured" });
    }
    const supplied = request.headers["x-revive-webhook-secret"];
    if (!safeSecretEqual(
      typeof supplied === "string" ? supplied : supplied?.[0],
      options.config.elevenLabsWebhookSecret,
    )) {
      return reply.status(401).send({ error: "invalid_elevenlabs_secret" });
    }
    return options.elevenLabsWebhooks.inboundContext(request.body);
  });

  app.post<{ Params: { tool: string } }>("/webhooks/elevenlabs/tools/:tool", async (request, reply) => {
    if (options.elevenLabsWebhooks === undefined) {
      return reply.status(503).send({ error: "elevenlabs_unconfigured" });
    }
    return options.elevenLabsWebhooks.executeTool(
      request.params.tool,
      request.body,
      request.headers.authorization,
    );
  });

  app.post("/webhooks/elevenlabs/post-call", {
    config: { rawBody: true },
  }, async (request, reply) => {
    if (options.elevenLabsWebhooks === undefined) {
      return reply.status(503).send({ error: "elevenlabs_unconfigured" });
    }
    const signature = request.headers["elevenlabs-signature"];
    const raw = typeof request.rawBody === "string"
      ? request.rawBody
      : request.rawBody?.toString("utf8");
    if (raw === undefined) return reply.status(400).send({ error: "missing_raw_body" });
    try {
      return await options.elevenLabsWebhooks.handlePostCall(
        raw,
        typeof signature === "string" ? signature : signature?.[0],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return reply.status(message.includes("signature") ? 401 : 400).send({
        error: message.includes("signature") ? "invalid_signature" : "invalid_webhook",
      });
    }
  });

  app.get("/api/v1/calendar", async (request, reply) => {
    const { date } = dateQuerySchema.parse(request.query);
    const localDate = DateTime.fromISO(date, { zone: options.config.timezone });
    if (!localDate.isValid || localDate.toISODate() !== date) {
      return reply.status(400).send({ error: "invalid_date" });
    }
    const state = await options.store.read();
    const customerById = new Map(state.customers.map((customer) => [customer.id, customer]));
    const barberById = new Map(state.barbers.map((barber) => [barber.id, barber]));
    const serviceById = new Map(state.services.map((service) => [service.id, service]));
    const onDate = (iso: string) => DateTime.fromISO(iso).setZone(state.settings.timezone).toISODate() === date;
    const appointments = state.appointments
      .filter((appointment) => onDate(appointment.startAt))
      .map((appointment) => ({
        ...appointment,
        customerName: customerById.get(appointment.customerId)?.name ?? "Unknown customer",
        barberName: barberById.get(appointment.barberId)?.name ?? "Unknown barber",
        serviceName: serviceById.get(appointment.serviceId)?.name ?? "Unknown service",
      }))
      .sort((left, right) => left.startAt.localeCompare(right.startAt));
    const activeRefills = state.refillJobs
      .filter((job) => onDate(job.slotStartAt))
      .filter((job) => !["completed", "exhausted", "failed"].includes(job.status))
      .map((job) => {
        const offer = job.currentOfferId === undefined
          ? undefined
          : state.offers.find((candidate) => candidate.id === job.currentOfferId);
        const waitingFor = offer === undefined ? undefined : customerById.get(offer.customerId)?.name;
        return {
          ...job,
          barberName: barberById.get(job.barberId)?.name ?? "Unknown barber",
          serviceName: serviceById.get(job.serviceId)?.name ?? "Unknown service",
          customerState: waitingFor === undefined ? "Finding a replacement…" : `Waiting for ${waitingFor}.`,
        };
      });
    return {
      date,
      timezone: state.settings.timezone,
      generatedAt: clock(),
      shop: { name: "REVIVE", location: "Toronto, ON" },
      businessHours: { start: "10:00", end: "20:00" },
      barbers: state.barbers,
      services: state.services,
      appointments,
      activeRefills,
      channelHealth: providerReadiness(options.config, storeKind),
      demoDate: getDemoDate(clock(), state.settings.timezone),
    };
  });

  app.get("/api/v1/settings", async () => (await options.store.read()).settings);

  app.patch("/api/v1/settings", async (request) => {
    const patch = settingsPatchSchema.parse(request.body);
    return options.store.transaction((state) => {
      state.settings = { ...state.settings, ...patch } as SchedulingSettings;
      state.events.push({
        id: crypto.randomUUID(),
        type: "settings.updated",
        aggregateId: "shop",
        occurredAt: clock(),
        data: patch,
      });
      return state.settings;
    });
  });

  app.get<{ Params: { id: string } }>("/api/v1/refill-jobs/:id", async (request, reply) => {
    const state = await options.store.read();
    const job = state.refillJobs.find((candidate) => candidate.id === request.params.id);
    if (job === undefined) return reply.status(404).send({ error: "not_found" });
    const barber = state.barbers.find((candidate) => candidate.id === job.barberId);
    const service = state.services.find((candidate) => candidate.id === job.serviceId);
    const offer = job.currentOfferId === undefined
      ? undefined
      : state.offers.find((candidate) => candidate.id === job.currentOfferId);
    const customer = offer === undefined
      ? undefined
      : state.customers.find((candidate) => candidate.id === offer.customerId);
    return {
      ...job,
      barberName: barber?.name ?? "Unknown barber",
      serviceName: service?.name ?? "Unknown service",
      currentOffer: offer === undefined ? null : {
        ...offer,
        customerName: customer?.name ?? "Unknown customer",
      },
    };
  });

  app.get("/api/v1/events", async (request, reply) => {
    const query = z.object({ once: z.enum(["true", "false"]).optional() }).parse(request.query);
    const initial = `event: connected\ndata: ${JSON.stringify({ at: clock() })}\n\n`;
    if (query.once === "true") {
      return reply.type("text/event-stream; charset=utf-8").send(initial);
    }

    reply.hijack();
    reply.raw.statusCode = 200;
    reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.write(initial);
    const unsubscribe = options.store.subscribe((state) => {
      const event = state.events.at(-1);
      reply.raw.write(`event: domain\ndata: ${JSON.stringify(event ?? { at: clock() })}\n\n`);
    });
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat ${clock()}\n\n`);
    }, 20_000);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.post("/api/v1/admin/session", async (request, reply) => {
    const body = z.object({ pin: z.string() }).parse(request.body);
    if (!safePinEqual(body.pin, options.config.demoAdminPin)) {
      return reply.status(401).send({ error: "invalid_pin" });
    }
    return { token: signSession(options.config, clock()), expiresInSeconds: 14_400 };
  });

  app.post("/api/v1/demo/reset", async (request, reply) => {
    const currentTime = clock();
    if (!verifySession(request, options.config, currentTime)) {
      return reply.status(401).send({ error: "unauthorized" });
    }
    const current = await options.store.read();
    const reset = createDemoState({
      now: currentTime,
      timezone: current.settings.timezone,
      preservedIdentities: {
        ...(current.customers.find((customer) => customer.id === "josh")?.telegramChatId === undefined
          ? {}
          : { joshTelegramChatId: current.customers.find((customer) => customer.id === "josh")!.telegramChatId! }),
        ...(current.customers.find((customer) => customer.id === "alex")?.telegramChatId === undefined
          ? {}
          : { alexTelegramChatId: current.customers.find((customer) => customer.id === "alex")!.telegramChatId! }),
        ...((current.customers.find((customer) => customer.id === "sarah")?.phone
          ?? options.config.sarahPhone) === undefined
          ? {}
          : { sarahPhone: (current.customers.find((customer) => customer.id === "sarah")?.phone
            ?? options.config.sarahPhone)! }),
      },
    });
    reset.backboardThreads = current.backboardThreads;
    reset.processedEvents = current.processedEvents;
    await options.store.replace(reset);
    return { status: "reset", demoDate: getDemoDate(currentTime, current.settings.timezone) };
  });

  return app;
}
