import { createHash } from "node:crypto";

import { z } from "zod";

const emptyToUndefined = (value: unknown): unknown => value === "" ? undefined : value;
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const booleanString = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return value;
  return value.toLowerCase() === "true";
}, z.boolean());

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  PUBLIC_BASE_URL: z.url().default("http://localhost:3000"),
  SHOP_TIMEZONE: z.string().min(1).default("America/Toronto"),
  DEMO_MODE: booleanString.default(true),
  DEMO_ADMIN_PIN: z.string().min(4).default("4242"),
  ADMIN_SESSION_SECRET: optionalString,
  DATA_STORE: z.enum(["auto", "memory", "mongodb"]).default("auto"),
  MONGODB_URI: optionalUrl,
  MONGODB_DB: z.string().min(1).default("revive"),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_WEBHOOK_SECRET: optionalString,
  BACKBOARD_API_KEY: optionalString,
  BACKBOARD_ASSISTANT_ID: optionalString,
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_AGENT_ID: optionalString,
  ELEVENLABS_PHONE_NUMBER_ID: optionalString,
  ELEVENLABS_WEBHOOK_SECRET: optionalString,
  SARAH_PHONE: optionalString,
});

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  publicBaseUrl: string;
  timezone: string;
  demoMode: boolean;
  demoAdminPin: string;
  adminSessionSecret: string;
  dataStore: "auto" | "memory" | "mongodb";
  mongoUri: string | undefined;
  mongoDatabase: string;
  telegramBotToken: string | undefined;
  telegramWebhookSecret: string | undefined;
  backboardApiKey: string | undefined;
  backboardAssistantId: string | undefined;
  elevenLabsApiKey: string | undefined;
  elevenLabsAgentId: string | undefined;
  elevenLabsPhoneNumberId: string | undefined;
  elevenLabsWebhookSecret: string | undefined;
  sarahPhone: string | undefined;
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.parse(environment);
  const fallbackSessionSecret = createHash("sha256")
    .update(`${parsed.DEMO_ADMIN_PIN}:${parsed.PUBLIC_BASE_URL}:revive-admin-session`)
    .digest("hex");
  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    publicBaseUrl: parsed.PUBLIC_BASE_URL,
    timezone: parsed.SHOP_TIMEZONE,
    demoMode: parsed.DEMO_MODE,
    demoAdminPin: parsed.DEMO_ADMIN_PIN,
    adminSessionSecret: parsed.ADMIN_SESSION_SECRET ?? fallbackSessionSecret,
    dataStore: parsed.DATA_STORE,
    mongoUri: parsed.MONGODB_URI,
    mongoDatabase: parsed.MONGODB_DB,
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
    telegramWebhookSecret: parsed.TELEGRAM_WEBHOOK_SECRET,
    backboardApiKey: parsed.BACKBOARD_API_KEY,
    backboardAssistantId: parsed.BACKBOARD_ASSISTANT_ID,
    elevenLabsApiKey: parsed.ELEVENLABS_API_KEY,
    elevenLabsAgentId: parsed.ELEVENLABS_AGENT_ID,
    elevenLabsPhoneNumberId: parsed.ELEVENLABS_PHONE_NUMBER_ID,
    elevenLabsWebhookSecret: parsed.ELEVENLABS_WEBHOOK_SECRET,
    sarahPhone: parsed.SARAH_PHONE,
  };
}
