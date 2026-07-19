import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("parses the explicit store mode and defaults safe demo settings", () => {
    const config = loadConfig({ DATA_STORE: "memory", DEMO_MODE: "true" });

    expect(config.dataStore).toBe("memory");
    expect(config.port).toBe(3100);
    expect(config.publicBaseUrl).toBe("http://127.0.0.1:3100");
    expect(config.timezone).toBe("America/Toronto");
    expect(config.demoMode).toBe(true);
  });

  it("rejects an unknown persistence mode", () => {
    expect(() => loadConfig({ DATA_STORE: "spreadsheet" })).toThrow();
  });

  it("accepts only an E.164 Sarah destination when one is configured", () => {
    expect(loadConfig({ SARAH_PHONE: "" }).sarahPhone).toBeUndefined();
    expect(loadConfig({ SARAH_PHONE: "+14165550101" }).sarahPhone).toBe("+14165550101");
    expect(() => loadConfig({ SARAH_PHONE: "416-555-0101" })).toThrow();
  });

  it("derives a provider actor secret without admin-session configuration", () => {
    const config = loadConfig({ ELEVENLABS_WEBHOOK_SECRET: "voice-secret" });

    expect(config.voiceActorSecret).toBe("voice-secret");
    expect("demoAdminPin" in config).toBe(false);
    expect("adminSessionSecret" in config).toBe(false);
    expect(loadConfig({}).voiceActorSecret).toEqual(expect.any(String));
    expect(loadConfig({}).voiceActorSecret.length).toBeGreaterThan(0);
  });
});
