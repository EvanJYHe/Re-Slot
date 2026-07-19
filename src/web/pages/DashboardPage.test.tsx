// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardResponse, ReviveApi } from "../types.js";
import { DashboardPage } from "./DashboardPage.js";

const response: DashboardResponse = {
  range: { start: "2026-07-20", end: "2026-07-24" },
  timezone: "America/Toronto",
  metrics: {
    recoveredRevenueCents: 4050,
    confirmedRevenueCents: 28500,
    chairsRecovered: 1,
    refillSuccessRate: 50,
    averageRefillMinutes: 18,
    chairUtilizationRate: 42.5,
    activeWaitlist: 3,
    activeRecoveries: 1,
  },
  daily: [
    { date: "2026-07-20", confirmedRevenueCents: 9000, recoveredRevenueCents: 4050 },
    { date: "2026-07-21", confirmedRevenueCents: 19500, recoveredRevenueCents: 0 },
  ],
  recentOutcomes: [{
    jobId: "job-1",
    customerName: "Alex",
    serviceName: "Signature haircut",
    occurredAt: "2026-07-20T21:05:00.000Z",
    revenueCents: 4050,
  }],
};

function api(payload = response): ReviveApi {
  return {
    getDashboard: vi.fn(async () => payload),
  } as unknown as ReviveApi;
}

afterEach(cleanup);

describe("DashboardPage", () => {
  it("renders source-backed money, operating metrics, trend, and outcomes", async () => {
    const client = api();
    render(<DashboardPage api={client} anchorDate="2026-07-20" refreshKey={0} />);

    expect(await screen.findByRole("heading", { name: "Impact" })).toBeInTheDocument();
    expect(screen.getByText("$40.50")).toBeInTheDocument();
    expect(screen.getByText("$285.00")).toBeInTheDocument();
    expect(screen.getByText("42.5%")).toBeInTheDocument();
    expect(screen.getByLabelText("Weekly revenue chart")).toBeInTheDocument();
    expect(screen.getByText("Alex's Signature haircut recovered $40.50")).toBeInTheDocument();
    expect(client.getDashboard).toHaveBeenCalledWith("2026-07-20", "2026-07-24");
  });

  it("keeps zero savings honest and refetches after a domain refresh", async () => {
    const client = api({
      ...response,
      metrics: { ...response.metrics, recoveredRevenueCents: 0, chairsRecovered: 0 },
      recentOutcomes: [],
    });
    const { rerender } = render(<DashboardPage api={client} anchorDate="2026-07-20" refreshKey={0} />);

    expect(await screen.findByText("No recovered revenue yet")).toBeInTheDocument();
    rerender(<DashboardPage api={client} anchorDate="2026-07-20" refreshKey={1} />);
    await waitFor(() => expect(client.getDashboard).toHaveBeenCalledTimes(2));
  });
});
