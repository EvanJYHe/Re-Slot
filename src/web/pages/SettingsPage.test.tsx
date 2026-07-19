// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./SettingsPage.js";
import type { ChannelHealth, ReviveApi, SchedulingSettings } from "../types.js";

const settings: SchedulingSettings = {
  timezone: "America/Toronto",
  refillEnabled: true,
  moveEarlierEnabled: true,
  moveLimit: 3,
  allowAlternateBarbers: true,
  waitlistEnabled: true,
  pastCustomerOutreachEnabled: true,
  maxDiscountPercent: 15,
  offerExpirySeconds: 120,
};

const channelHealth: ChannelHealth = {
  mongodb: "mongodb",
  telegram: "configured",
  backboard: "configured",
  elevenlabs: "unavailable",
};

function api(): ReviveApi {
  let current = { ...settings };
  return {
    getCalendar: vi.fn(async () => { throw new Error("unused"); }),
    getCalendarRange: vi.fn(async () => { throw new Error("unused"); }),
    getAvailability: vi.fn(async () => { throw new Error("unused"); }),
    getSettings: vi.fn(async () => ({ ...current })),
    patchSettings: vi.fn(async (patch) => {
      current = { ...current, ...patch };
      return { ...current };
    }),
    resetDemo: vi.fn(async () => ({ status: "reset", demoDate: "2026-07-20" })),
    getCustomers: vi.fn(async () => []),
    getCustomer: vi.fn(async () => { throw new Error("unused"); }),
    patchCustomer: vi.fn(async () => { throw new Error("unused"); }),
    addCustomerNote: vi.fn(async () => { throw new Error("unused"); }),
    getConversations: vi.fn(async () => []),
    getConversation: vi.fn(async () => { throw new Error("unused"); }),
    getWaitlist: vi.fn(async () => []),
    patchWaitlist: vi.fn(async () => { throw new Error("unused"); }),
    getActivity: vi.fn(async () => []),
    bookAppointment: vi.fn(async () => { throw new Error("unused"); }),
    rescheduleAppointment: vi.fn(async () => { throw new Error("unused"); }),
    cancelAppointment: vi.fn(async () => { throw new Error("unused"); }),
  };
}

afterEach(cleanup);

describe("SettingsPage", () => {
  it("shows only behavior-backed automation and safe provider health", async () => {
    render(
      <SettingsPage
        api={api()}
        channelHealth={channelHealth}
        onReset={vi.fn(async () => undefined)}
        refreshKey={0}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Automation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connections" })).toBeInTheDocument();
    for (const label of [
      "Automatic vacancy refill",
      "Offer earlier appointments",
      "Allow alternate barbers",
      "Use the waitlist",
      "Past-customer outreach",
    ]) {
      expect(screen.getByRole("checkbox", { name: label })).toBeChecked();
    }
    expect(screen.getByRole("spinbutton", { name: "Maximum appointment moves" })).toHaveValue(3);
    expect(screen.getByRole("spinbutton", { name: "Maximum discount percent" })).toHaveValue(15);
    expect(screen.getByRole("combobox", { name: "Offer expiry" })).toHaveValue("120");
    for (const provider of ["MongoDB", "Telegram", "Backboard", "ElevenLabs"]) {
      expect(screen.getByRole("status", { name: `${provider} connection` })).toBeInTheDocument();
    }
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/prompt editor|voice laboratory|analytics|API key/i)).not.toBeInTheDocument();
  });

  it("saves one policy at a time and confirms the local demo reset", async () => {
    const user = userEvent.setup();
    const client = api();
    const onReset = vi.fn(async () => undefined);
    render(
      <SettingsPage
        api={client}
        channelHealth={channelHealth}
        onReset={onReset}
        refreshKey={0}
      />,
    );

    await screen.findByRole("heading", { name: "Automation" });
    await user.click(screen.getByRole("checkbox", { name: "Automatic vacancy refill" }));
    await waitFor(() => expect(client.patchSettings).toHaveBeenCalledWith(
      { refillEnabled: false },
    ));
    expect(await screen.findByText("Saved")).toBeInTheDocument();

    const moveLimit = screen.getByRole("spinbutton", { name: "Maximum appointment moves" });
    await user.clear(moveLimit);
    await user.type(moveLimit, "2");
    await user.tab();
    await waitFor(() => expect(client.patchSettings).toHaveBeenCalledWith(
      { moveLimit: 2 },
    ));

    await waitFor(() => expect(screen.getByRole("button", { name: "Reset demo week" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Reset demo week" }));
    expect(screen.getByText("This restores the seeded week while preserving linked demo identities.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm demo reset" }));
    await waitFor(() => expect(client.resetDemo).toHaveBeenCalledWith());
    expect(onReset).toHaveBeenCalledOnce();
  });
});
