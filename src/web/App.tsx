import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import { defaultApi } from "./api.js";
import {
  AgentIcon,
  CalendarIcon,
  CustomersIcon,
  LockIcon,
  SettingsIcon,
} from "./components/icons.js";
import { Button, Modal, StatusDot, cn } from "./components/ui.js";
import { periodRange, type CalendarView } from "./lib/dates.js";
import { AgentPage } from "./pages/AgentPage.js";
import { CalendarPage } from "./pages/CalendarPage.js";
import { CustomersPage } from "./pages/CustomersPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import type { CalendarResponse, EventSourceLike, ReviveApi } from "./types.js";

export type AppPage = "calendar" | "agent" | "customers" | "settings";

interface DashboardAppProps {
  api?: ReviveApi;
  initialDate?: string;
  initialOperatorToken?: string;
  eventSourceFactory?: (url: string) => EventSourceLike | undefined;
}

const defaultEventSourceFactory = (url: string): EventSourceLike => new EventSource(url);
const tokenStorageKey = "revive.operator-token";

const destinations = [
  { id: "calendar" as const, label: "Calendar", icon: CalendarIcon },
  { id: "agent" as const, label: "Agent", icon: AgentIcon },
  { id: "customers" as const, label: "Customers", icon: CustomersIcon },
  { id: "settings" as const, label: "Settings", icon: SettingsIcon },
];

function nextOperationalDate(): string {
  let date = DateTime.now().setZone("America/Toronto").startOf("day");
  while (date.weekday > 5) date = date.plus({ days: 1 });
  return date.toISODate()!;
}

function storedOperatorToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage.getItem(tokenStorageKey) ?? undefined;
}

function OperatorGate({ api, onUnlocked, overlay = false, onClose }: {
  api: ReviveApi;
  onUnlocked: (token: string) => void;
  overlay?: boolean;
  onClose?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  const unlock = async () => {
    setStatus("submitting");
    try {
      const session = await api.createAdminSession(pin);
      window.sessionStorage.setItem(tokenStorageKey, session.token);
      onUnlocked(session.token);
    } catch {
      setStatus("error");
    }
  };

  const form = (
    <>
      {overlay ? null : (
        <>
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#edf4ef] text-revive"><LockIcon /></div>
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Unlock operator workspace</h2>
        </>
      )}
      <p className={cn("text-sm leading-6 text-muted", overlay ? "" : "mt-2")}>Use the demo admin PIN once to access customer records and live agent activity.</p>
      <label className="mt-6 block text-sm font-medium" htmlFor="operator-pin">Admin PIN</label>
      <input
        autoComplete="one-time-code"
        className="mt-2 h-10 w-full rounded-revive border border-line bg-white px-3 text-sm placeholder:text-[#a2aaa4]"
        id="operator-pin"
        inputMode="numeric"
        onChange={(event) => setPin(event.target.value)}
        type="password"
        value={pin}
      />
      {status === "error" ? <p className="mt-2 text-sm text-[#a44646]">That PIN was not accepted.</p> : null}
      <Button className="mt-5 w-full" disabled={pin === "" || status === "submitting"} onClick={() => void unlock()} variant="primary">
        {status === "submitting" ? "Unlocking…" : "Unlock"}
      </Button>
    </>
  );

  if (overlay) {
    return <Modal onClose={onClose ?? (() => undefined)} title="Unlock operator workspace">{form}</Modal>;
  }

  return (
    <section className="mx-auto mt-20 w-full max-w-sm rounded-xl border border-line bg-panel p-7 shadow-panel">
      {form}
    </section>
  );
}

export function DashboardApp({
  api = defaultApi,
  initialDate = nextOperationalDate(),
  initialOperatorToken,
  eventSourceFactory = defaultEventSourceFactory,
}: DashboardAppProps) {
  const [page, setPage] = useState<AppPage>("calendar");
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [calendarView, setCalendarView] = useState<CalendarView>("day");
  const [barberFilter, setBarberFilter] = useState("all");
  const [calendar, setCalendar] = useState<CalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "unavailable">("connecting");
  const [operatorToken, setOperatorToken] = useState<string | undefined>(initialOperatorToken ?? storedOperatorToken);
  const [calendarUnlockRequested, setCalendarUnlockRequested] = useState(false);
  const [domainVersion, setDomainVersion] = useState(0);
  const requestSequence = useRef(0);
  const range = useMemo(() => periodRange(anchorDate, calendarView), [anchorDate, calendarView]);

  const refreshCalendar = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const nextCalendar = await api.getCalendarRange(range.start, range.end);
      if (requestId === requestSequence.current) {
        setCalendar(nextCalendar);
        setError(undefined);
      }
    } catch {
      if (requestId === requestSequence.current) {
        setError("The calendar could not refresh. The last confirmed state remains visible.");
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [api, range.end, range.start]);
  const refreshCalendarRef = useRef(refreshCalendar);
  refreshCalendarRef.current = refreshCalendar;

  useEffect(() => { void refreshCalendar(); }, [refreshCalendar]);
  useEffect(() => {
    const source = eventSourceFactory("/api/v1/events");
    if (source === undefined) {
      setConnection("unavailable");
      return;
    }
    source.addEventListener("open", () => setConnection("connected"));
    source.addEventListener("error", () => setConnection("reconnecting"));
    source.addEventListener("domain", () => {
      setDomainVersion((version) => version + 1);
      void refreshCalendarRef.current();
    });
    return () => source.close();
  }, [eventSourceFactory]);

  const connectionLabel = connection === "connected"
    ? "Live updates connected"
    : connection === "reconnecting"
      ? "Live updates reconnecting"
      : connection === "unavailable"
        ? "Live updates unavailable"
        : "Connecting live updates";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-panel px-5 lg:px-8">
        <h1 aria-label="REVIVE" className="justify-self-start text-[19px] font-semibold tracking-[-0.05em]">
          RE<span className="px-0.5 text-revive">·</span>VIVE
        </h1>
        <nav aria-label="Primary" className="flex items-center gap-1">
          {destinations.map((destination) => {
            const Icon = destination.icon;
            return (
              <button
                aria-current={page === destination.id ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-revive px-3 text-sm font-medium transition-colors",
                  page === destination.id ? "bg-[#edf1ed] text-ink" : "text-muted hover:bg-[#f2f4f1] hover:text-ink",
                )}
                key={destination.id}
                onClick={() => {
                  setCalendarUnlockRequested(false);
                  setPage(destination.id);
                }}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {destination.label}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 justify-self-end text-xs text-muted">
          <StatusDot tone={connection === "connected" ? "healthy" : connection === "reconnecting" ? "warning" : "offline"} />
          <span>{connectionLabel}</span>
        </div>
      </header>
      {error === undefined ? null : (
        <div className="border-b border-[#ead9b9] bg-amber-soft px-6 py-2.5 text-center text-sm text-[#7c5b22]">{error}</div>
      )}
      <main>
        {page === "calendar" ? (
          <CalendarPage
            anchorDate={anchorDate}
            api={api}
            barberFilter={barberFilter}
            calendar={calendar}
            loading={loading}
            onAnchorDateChange={setAnchorDate}
            onBarberFilterChange={setBarberFilter}
            onMutated={refreshCalendar}
            onRequireOperator={() => setCalendarUnlockRequested(true)}
            onViewChange={setCalendarView}
            operatorToken={operatorToken}
            view={calendarView}
          />
        ) : null}
        {page !== "calendar" && operatorToken === undefined
          ? <OperatorGate api={api} onUnlocked={setOperatorToken} />
          : null}
        {page === "agent" && operatorToken !== undefined ? (
          <AgentPage api={api} refreshKey={domainVersion} token={operatorToken} />
        ) : null}
        {page === "customers" && operatorToken !== undefined ? (
          <CustomersPage api={api} refreshKey={domainVersion} token={operatorToken} />
        ) : null}
        {page === "settings" && operatorToken !== undefined ? (
          <SettingsPage
            api={api}
            channelHealth={calendar?.channelHealth}
            onReset={async () => {
              setDomainVersion((version) => version + 1);
              await refreshCalendar();
            }}
            refreshKey={domainVersion}
            token={operatorToken}
          />
        ) : null}
        {page === "calendar" && operatorToken === undefined && calendarUnlockRequested ? (
          <OperatorGate
            api={api}
            onClose={() => setCalendarUnlockRequested(false)}
            onUnlocked={(token) => {
              setOperatorToken(token);
              setCalendarUnlockRequested(false);
            }}
            overlay
          />
        ) : null}
      </main>
    </div>
  );
}
