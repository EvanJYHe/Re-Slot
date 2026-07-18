import { describe, expect, it } from "vitest";

import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("parses the explicit store mode and defaults safe demo settings", () => {
    const config = loadConfig({ DATA_STORE: "memory", DEMO_MODE: "true" });

    expect(config.dataStore).toBe("memory");
    expect(config.timezone).toBe("America/Toronto");
    expect(config.demoMode).toBe(true);
  });

  it("rejects an unknown persistence mode", () => {
    expect(() => loadConfig({ DATA_STORE: "spreadsheet" })).toThrow();
  });
});
