import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import rawBody from "fastify-raw-body";
import { DateTime } from "luxon";
import { z, ZodError } from "zod";

import type { OperationResult, ReviveEngine } from "../domain/engine.js";
import { findAvailableSlots } from "../domain/scheduling.js";
import type { ReviveStore } from "../domain/store.js";
import type { SchedulingSettings } from "../domain/types.js";
import type { AppConfig } from "./config.js";
import {
  projectActivity,
  projectConversationDetail,
  projectConversationList,
  projectCustomerDetail,
  projectCustomerList,
  projectWaitlist,
} from "./operator-projections.js";
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

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const calendarQuerySchema = z.object({
  date: isoDateSchema.optional(),
  start: isoDateSchema.optional(),
  end: isoDateSchema.optional(),
}).strict().superRefine((value, context) => {
  const hasDate = value.date !== undefined;
  const hasRange = value.start !== undefined || value.end !== undefined;
  if (hasDate === hasRange || (hasRange && (value.start === undefined || value.end === undefined))) {
    context.addIssue({ code: "custom", message: "Provide either date or start and end." });
  }
});

const availabilityQuerySchema = z.object({
  date: isoDateSchema,
  serviceId: z.string().min(1),
  barberId: z.string().min(1).optional(),
  includeAlternates: z.enum(["true", "false"]).optional(),
}).strict();

const appointmentCreateSchema = z.object({
  customerId: z.string().min(1),
  barberId: z.string().min(1),
  serviceId: z.string().min(1),
  startAt: z.string().datetime({ offset: true }),
}).strict();

const appointmentMoveSchema = z.object({
  barberId: z.string().min(1),
  startAt: z.string().datetime({ offset: true }),
}).strict();

const customerPatchSchema = z.object({
  contactPreference: z.enum(["telegram", "voice"]).optional(),
  earlierMoveConsent: z.boolean().optional(),
  flexibleBarberPreference: z.boolean().optional(),
  pastCustomerOptIn: z.boolean().optional(),
}).strict();

const customerNoteSchema = z.object({
  text: z.string().trim().min(1).max(500),
}).strict();

const waitlistPatchSchema = z.object({
  status: z.enum(["active", "paused", "withdrawn"]).optional(),
  operatorNote: z.string().trim().max(500).nullable().optional(),
}).strict();

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
    scope: "operator",
    exp: DateTime.fromISO(issuedAt).plus({ hours: 1 }).toUnixInteger(),
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
    const parsed = z.object({ scope: z.literal("operator"), exp: z.number().int() })
      .parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    return parsed.exp > DateTime.fromISO(now).toUnixInteger();
  } catch {
    return false;
  }
}

function sendOperation(reply: FastifyReply, result: OperationResult) {
  if (result.type === "conflict") return reply.status(409).send(result);
  if (result.type === "error") {
    return reply.status(result.code === "NOT_FOUND" ? 404 : 400).send(result);
  }
  if (result.type === "confirmation_required") return reply.status(400).send(result);
  return reply.send(result);
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
  const operatorOnly = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!verifySession(request, options.config, clock())) {
      return reply.status(401).send({ error: "unauthorized" });
    }
  };

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
    const query = calendarQuerySchema.parse(request.query);
    const start = query.date ?? query.start!;
    const end = query.date ?? query.end!;
    const localStart = DateTime.fromISO(start, { zone: options.config.timezone });
    const localEnd = DateTime.fromISO(end, { zone: options.config.timezone });
    const rangeDays = localEnd.diff(localStart, "days").days;
    if (
      !localStart.isValid
      || !localEnd.isValid
      || localStart.toISODate() !== start
      || localEnd.toISODate() !== end
      || rangeDays < 0
      || rangeDays > 41
    ) {
      return reply.status(400).send({ error: "invalid_date" });
    }
    const state = await options.store.read();
    const customerById = new Map(state.customers.map((customer) => [customer.id, customer]));
    const barberById = new Map(state.barbers.map((barber) => [barber.id, barber]));
    const serviceById = new Map(state.services.map((service) => [service.id, service]));
    const inRange = (iso: string) => {
      const localDate = DateTime.fromISO(iso).setZone(state.settings.timezone).toISODate();
      return localDate !== null && localDate >= start && localDate <= end;
    };
    const appointments = state.appointments
      .filter((appointment) => inRange(appointment.startAt))
      .map((appointment) => ({
        ...appointment,
        customerName: customerById.get(appointment.customerId)?.name ?? "Unknown customer",
        barberName: barberById.get(appointment.barberId)?.name ?? "Unknown barber",
        serviceName: serviceById.get(appointment.serviceId)?.name ?? "Unknown service",
      }))
      .sort((left, right) => left.startAt.localeCompare(right.startAt));
    const activeRefills = state.refillJobs
      .filter((job) => inRange(job.slotStartAt))
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
      date: start,
      range: { start, end },
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

  app.patch("/api/v1/settings", { preHandler: operatorOnly }, async (request) => {
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

  app.get("/api/v1/availability", { preHandler: operatorOnly }, async (request, reply) => {
    const query = availabilityQuerySchema.parse(request.query);
    const date = DateTime.fromISO(query.date, { zone: options.config.timezone });
    if (!date.isValid || date.toISODate() !== query.date) {
      return reply.status(400).send({ error: "invalid_date" });
    }
    const state = await options.store.read();
    const service = state.services.find((candidate) => candidate.id === query.serviceId);
    if (service === undefined) return reply.status(404).send({ error: "service_not_found" });
    const slots = findAvailableSlots({
      date: query.date,
      timezone: state.settings.timezone,
      service,
      barbers: state.barbers,
      appointments: state.appointments,
      ...(query.barberId === undefined ? {} : { requestedBarberId: query.barberId }),
      includeAlternates: query.includeAlternates === "true" && state.settings.allowAlternateBarbers,
    }).map((slot) => ({
      ...slot,
      barberName: state.barbers.find((barber) => barber.id === slot.barberId)?.name ?? "Unknown barber",
      localTime: DateTime.fromISO(slot.startAt).setZone(state.settings.timezone).toFormat("h:mm a"),
    }));
    return {
      date: query.date,
      timezone: state.settings.timezone,
      service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
      slots,
    };
  });

  app.post("/api/v1/appointments", { preHandler: operatorOnly }, async (request, reply) => {
    const input = appointmentCreateSchema.parse(request.body);
    const result = await options.engine.book({
      actor: { provider: "admin" },
      customerId: input.customerId,
      barberId: input.barberId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      confirmed: true,
      now: clock(),
    });
    return sendOperation(reply, result);
  });

  app.patch<{ Params: { id: string } }>("/api/v1/appointments/:id", { preHandler: operatorOnly }, async (request, reply) => {
    const input = appointmentMoveSchema.parse(request.body);
    const result = await options.engine.reschedule({
      actor: { provider: "admin" },
      appointmentId: request.params.id,
      barberId: input.barberId,
      startAt: input.startAt,
      confirmed: true,
      now: clock(),
    });
    return sendOperation(reply, result);
  });

  app.post<{ Params: { id: string } }>("/api/v1/appointments/:id/cancel", { preHandler: operatorOnly }, async (request, reply) => {
    const result = await options.engine.cancel({
      actor: { provider: "admin" },
      appointmentId: request.params.id,
      now: clock(),
    });
    return sendOperation(reply, result);
  });

  app.get("/api/v1/customers", { preHandler: operatorOnly }, async (request) => {
    const query = z.object({ q: z.string().max(100).optional() }).strict().parse(request.query);
    return projectCustomerList(await options.store.read(), query.q ?? "");
  });

  app.get<{ Params: { id: string } }>("/api/v1/customers/:id", { preHandler: operatorOnly }, async (request, reply) => {
    const detail = projectCustomerDetail(await options.store.read(), request.params.id);
    return detail ?? reply.status(404).send({ error: "not_found" });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/customers/:id", { preHandler: operatorOnly }, async (request, reply) => {
    const patch = customerPatchSchema.parse(request.body);
    const found = await options.store.transaction((state) => {
      const customer = state.customers.find((candidate) => candidate.id === request.params.id);
      if (customer === undefined) return false;
      Object.assign(customer, patch, { updatedAt: clock() });
      state.events.push({
        id: randomUUID(),
        type: "customer.updated",
        aggregateId: customer.id,
        occurredAt: clock(),
        data: { customerId: customer.id },
      });
      return true;
    });
    if (!found) return reply.status(404).send({ error: "not_found" });
    return projectCustomerDetail(await options.store.read(), request.params.id)!;
  });

  app.post<{ Params: { id: string } }>("/api/v1/customers/:id/notes", { preHandler: operatorOnly }, async (request, reply) => {
    const input = customerNoteSchema.parse(request.body);
    const result = await options.store.transaction((state) => {
      const customer = state.customers.find((candidate) => candidate.id === request.params.id);
      if (customer === undefined) return undefined;
      const note = {
        id: randomUUID(),
        customerId: customer.id,
        text: input.text,
        author: "operator" as const,
        createdAt: clock(),
      };
      state.customerNotes.push(note);
      state.events.push({
        id: randomUUID(),
        type: "customer.note_added",
        aggregateId: customer.id,
        occurredAt: clock(),
        data: { customerId: customer.id },
      });
      return { id: note.id, text: note.text, author: note.author, createdAt: note.createdAt };
    });
    return result ?? reply.status(404).send({ error: "not_found" });
  });

  app.get("/api/v1/conversations", { preHandler: operatorOnly }, async () => (
    projectConversationList(await options.store.read())
  ));

  app.get<{ Params: { id: string } }>("/api/v1/conversations/:id", { preHandler: operatorOnly }, async (request, reply) => {
    const detail = projectConversationDetail(await options.store.read(), request.params.id);
    return detail ?? reply.status(404).send({ error: "not_found" });
  });

  app.get("/api/v1/waitlist", { preHandler: operatorOnly }, async () => (
    projectWaitlist(await options.store.read())
  ));

  app.patch<{ Params: { id: string } }>("/api/v1/waitlist/:id", { preHandler: operatorOnly }, async (request, reply) => {
    const patch = waitlistPatchSchema.parse(request.body);
    const found = await options.store.transaction((state) => {
      const entry = state.waitlist.find((candidate) => candidate.id === request.params.id);
      if (entry === undefined) return false;
      if (patch.status !== undefined) entry.status = patch.status;
      if (patch.operatorNote !== undefined) {
        if (patch.operatorNote === null || patch.operatorNote === "") delete entry.operatorNote;
        else entry.operatorNote = patch.operatorNote;
      }
      entry.updatedAt = clock();
      state.events.push({
        id: randomUUID(),
        type: "waitlist.updated",
        aggregateId: entry.id,
        occurredAt: clock(),
        data: { customerId: entry.customerId },
      });
      return true;
    });
    if (!found) return reply.status(404).send({ error: "not_found" });
    return projectWaitlist(await options.store.read()).find((entry) => entry.id === request.params.id)!;
  });

  app.get("/api/v1/activity", { preHandler: operatorOnly }, async () => (
    projectActivity(await options.store.read())
  ));

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
        id: offer.id,
        status: offer.status,
        channel: offer.channel,
        proposedStartAt: offer.proposedStartAt,
        proposedEndAt: offer.proposedEndAt,
        discountPercent: offer.discountPercent,
        expiresAt: offer.expiresAt,
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
    return { token: signSession(options.config, clock()), expiresInSeconds: 3_600 };
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
