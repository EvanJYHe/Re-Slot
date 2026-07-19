import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import { defaultApi } from "./api.js";
import {
  AgentIcon,
  CalendarIcon,
  CustomersIcon,
  SettingsIcon,
} from "./components/icons.js";
import { cn } from "./components/ui.js";
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
  eventSourceFactory?: (url: string) => EventSourceLike | undefined;
}

const defaultEventSourceFactory = (url: string): EventSourceLike => new EventSource(url);

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

export function DashboardApp({
  api = defaultApi,
  initialDate = nextOperationalDate(),
  eventSourceFactory = defaultEventSourceFactory,
}: DashboardAppProps) {
  const [page, setPage] = useState<AppPage>("calendar");
  const [visitedPages, setVisitedPages] = useState<ReadonlySet<AppPage>>(
    () => new Set<AppPage>(["calendar"]),
  );
  const [anchorDate, setAnchorDate] = useState(initialDate);
  const [calendarView, setCalendarView] = useState<CalendarView>("day");
  const [barberFilter, setBarberFilter] = useState("all");
  const [calendar, setCalendar] = useState<CalendarResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [domainVersion, setDomainVersion] = useState(0);
  const requestSequence = useRef(0);
  const range = useMemo(() => periodRange(anchorDate, calendarView), [anchorDate, calendarView]);

  const navigateTo = (destination: AppPage) => {
    setVisitedPages((current) => current.has(destination)
      ? current
      : new Set([...current, destination]));
    setPage(destination);
  };

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
    if (source === undefined) return;
    source.addEventListener("domain", () => {
      setDomainVersion((version) => version + 1);
      void refreshCalendarRef.current();
    });
    return () => source.close();
  }, [eventSourceFactory]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-panel px-5 lg:px-8">
        <h1 aria-label="Re-Slot" className="justify-self-start text-[19px] font-semibold tracking-[-0.05em]">
          RE<span className="px-0.5 text-revive">·</span>SLOT
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
                onClick={() => navigateTo(destination.id)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {destination.label}
              </button>
            );
          })}
        </nav>
        <div aria-hidden="true" />
      </header>
      {error === undefined ? null : (
        <div className="border-b border-[#ead9b9] bg-amber-soft px-6 py-2.5 text-center text-sm text-[#7c5b22]">{error}</div>
      )}
      <main>
        <div hidden={page !== "calendar"}>
          <CalendarPage
            anchorDate={anchorDate}
            api={api}
            barberFilter={barberFilter}
            calendar={calendar}
            loading={loading}
            onAnchorDateChange={setAnchorDate}
            onBarberFilterChange={setBarberFilter}
            onMutated={refreshCalendar}
            onViewChange={setCalendarView}
            view={calendarView}
          />
        </div>
        {visitedPages.has("agent") ? (
          <div hidden={page !== "agent"}>
            <AgentPage api={api} refreshKey={domainVersion} />
          </div>
        ) : null}
        {visitedPages.has("customers") ? (
          <div hidden={page !== "customers"}>
            <CustomersPage api={api} refreshKey={domainVersion} />
          </div>
        ) : null}
        {visitedPages.has("settings") ? (
          <div hidden={page !== "settings"}>
            <SettingsPage
              api={api}
              onReset={async () => {
                setDomainVersion((version) => version + 1);
                await refreshCalendar();
              }}
              refreshKey={domainVersion}
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
