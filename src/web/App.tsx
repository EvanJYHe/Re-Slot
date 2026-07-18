import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { defaultApi } from "./api.js";
import type {
  ActiveRefill,
  CalendarAppointment,
  CalendarResponse,
  EventSourceLike,
  ReviveApi,
  SchedulingSettings,
} from "./types.js";

interface DashboardAppProps {
  api?: ReviveApi;
  initialDate?: string;
  eventSourceFactory?: (url: string) => EventSourceLike | undefined;
}

const defaultEventSourceFactory = (url: string): EventSourceLike => new EventSource(url);

function nextOperationalDate(): string {
  let date = DateTime.now().setZone("America/Toronto").startOf("day");
  while (date.weekday > 5) date = date.plus({ days: 1 });
  return date.toISODate()!;
}

function formatDay(date: string): { weekday: string; long: string } {
  const value = DateTime.fromISO(date);
  return {
    weekday: value.toFormat("cccc").toUpperCase(),
    long: value.toFormat("LLLL d, yyyy"),
  };
}

function timeLabel(iso: string, timezone: string): string {
  return DateTime.fromISO(iso).setZone(timezone).toFormat("h:mm a");
}

function minuteOfDay(iso: string, timezone: string): number {
  const value = DateTime.fromISO(iso).setZone(timezone);
  return value.hour * 60 + value.minute;
}

function cardPosition(
  startAt: string,
  endAt: string,
  timezone: string,
  startMinutes: number,
  pixelsPerHour: number,
): CSSProperties {
  const top = ((minuteOfDay(startAt, timezone) - startMinutes) / 60) * pixelsPerHour;
  const height = Math.max(42, ((minuteOfDay(endAt, timezone) - minuteOfDay(startAt, timezone)) / 60) * pixelsPerHour - 8);
  return { "--card-top": `${top + 4}px`, "--card-height": `${height}px` } as CSSProperties;
}

function StatusMark({ status }: { status: CalendarAppointment["status"] }) {
  return <span className={`status-mark status-mark--${status}`}>{status === "confirmed" ? "Confirmed" : "Cancelled"}</span>;
}

function AppointmentCard({ appointment, timezone, style }: {
  appointment: CalendarAppointment;
  timezone: string;
  style: CSSProperties;
}) {
  const durationMinutes = DateTime.fromISO(appointment.endAt)
    .diff(DateTime.fromISO(appointment.startAt), "minutes")
    .minutes;
  const compact = durationMinutes < 45;
  return (
    <button
      className={`appointment-card appointment-card--${appointment.status}${compact ? " appointment-card--compact" : ""}`}
      style={style}
      aria-label={`${appointment.customerName}, ${appointment.serviceName}, ${timeLabel(appointment.startAt, timezone)}`}
      type="button"
    >
      <span className="appointment-card__time">{timeLabel(appointment.startAt, timezone)}</span>
      <strong>{appointment.customerName}</strong>
      <span>{appointment.serviceName}</span>
      <StatusMark status={appointment.status} />
    </button>
  );
}

function RefillCard({ refill, timezone, style, onOpen }: {
  refill: ActiveRefill;
  timezone: string;
  style: CSSProperties;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="refill-card"
      style={style}
      onClick={onOpen}
      aria-label={`${refill.customerState} Open refill timeline`}
    >
      <span className="refill-card__eyebrow"><i /> LIVE REFILL</span>
      <strong>{refill.customerState}</strong>
      <span>{timeLabel(refill.slotStartAt, timezone)} · {refill.barberName}</span>
    </button>
  );
}

function CalendarGrid({ calendar, onOpenRefill }: {
  calendar: CalendarResponse;
  onOpenRefill: (refill: ActiveRefill) => void;
}) {
  const startHour = Number(calendar.businessHours.start.slice(0, 2));
  const endHour = Number(calendar.businessHours.end.slice(0, 2));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const pixelsPerHour = 88;
  const laneHeight = (endHour - startHour) * pixelsPerHour;
  return (
    <section
      className="schedule-shell"
      aria-label="Day schedule"
      style={{ "--barber-count": calendar.barbers.length } as CSSProperties}
    >
      <div className="schedule-header" role="row">
        <div className="time-column-head" aria-hidden="true">LOCAL</div>
        {calendar.barbers.map((barber, index) => (
          <div className="barber-head" role="columnheader" aria-label={`${barber.name}, barber`} key={barber.id}>
            <span className="barber-head__index">0{index + 1}</span>
            <strong>{barber.name}</strong>
            <span>{barber.serviceIds.length} disciplines</span>
          </div>
        ))}
      </div>
      <div className="schedule-body" role="table" style={{ "--lane-height": `${laneHeight}px` } as CSSProperties}>
        <div className="time-ruler" aria-hidden="true">
          {hours.map((hour) => (
            <span key={hour} style={{ top: `${(hour - startHour) * pixelsPerHour}px` }}>
              {DateTime.fromObject({ hour }).toFormat("h a")}
            </span>
          ))}
        </div>
        {calendar.barbers.map((barber) => (
          <div className="barber-lane" role="rowgroup" key={barber.id} style={{ height: `${laneHeight}px` }}>
            {calendar.appointments
              .filter((appointment) => appointment.barberId === barber.id)
              .map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  timezone={calendar.timezone}
                  style={cardPosition(
                    appointment.startAt,
                    appointment.endAt,
                    calendar.timezone,
                    startHour * 60,
                    pixelsPerHour,
                  )}
                />
              ))}
            {calendar.activeRefills
              .filter((refill) => refill.barberId === barber.id)
              .map((refill) => (
                <RefillCard
                  key={refill.id}
                  refill={refill}
                  timezone={calendar.timezone}
                  style={cardPosition(
                    refill.slotStartAt,
                    refill.slotEndAt,
                    calendar.timezone,
                    startHour * 60,
                    pixelsPerHour,
                  )}
                  onOpen={() => onOpenRefill(refill)}
                />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Drawer({ title, label, children, onClose }: {
  title: string;
  label: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        <div className="drawer__head">
          <div><span className="section-kicker">OPERATOR VIEW</span><h2>{title}</h2></div>
          <button className="icon-button" type="button" aria-label={`Close ${label}`} onClick={onClose}>×</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function TimelineDrawer({ refill, timezone, onClose }: {
  refill: ActiveRefill;
  timezone: string;
  onClose: () => void;
}) {
  return (
    <Drawer title={`${timeLabel(refill.slotStartAt, timezone)} opening`} label="Refill timeline" onClose={onClose}>
      <div className="drawer-summary drawer-summary--amber">
        <span>Current state</span>
        <strong>{refill.customerState}</strong>
        <p>{refill.serviceName} with {refill.barberName} · move {refill.moveDepth} of 3</p>
      </div>
      <ol className="timeline">
        {refill.timeline.map((event, index) => (
          <li key={`${event.at}-${index}`}>
            <time>{DateTime.fromISO(event.at).setZone(timezone).toFormat("h:mm:ss a")}</time>
            <div><i /><p>{event.message}</p></div>
          </li>
        ))}
      </ol>
    </Drawer>
  );
}

const settingRows: Array<{
  key: keyof Pick<SchedulingSettings,
    "refillEnabled" | "moveEarlierEnabled" | "allowAlternateBarbers" | "waitlistEnabled" | "pastCustomerOutreachEnabled">;
  label: string;
  detail: string;
}> = [
  { key: "refillEnabled", label: "Automatic refill", detail: "Start a search when a chair opens." },
  { key: "moveEarlierEnabled", label: "Earlier moves", detail: "Contact opted-in later appointments first." },
  { key: "allowAlternateBarbers", label: "Allow alternate barbers", detail: "Offer other qualified barbers after consent." },
  { key: "waitlistEnabled", label: "Waitlist outreach", detail: "Use matching waitlist entries after moves." },
  { key: "pastCustomerOutreachEnabled", label: "Past customer outreach", detail: "Contact opted-in past customers last." },
];

function SettingsDrawer({ value, api, onSaved, onClose, onReset }: {
  value: SchedulingSettings;
  api: ReviveApi;
  onSaved: (value: SchedulingSettings) => void;
  onClose: () => void;
  onReset: (pin: string) => Promise<void>;
}) {
  const [status, setStatus] = useState("Ready");
  const [pin, setPin] = useState("");
  const save = async (patch: Partial<SchedulingSettings>) => {
    setStatus("Saving…");
    try {
      const updated = await api.patchSettings(patch);
      onSaved(updated);
      setStatus("Saved");
    } catch {
      setStatus("Save failed");
    }
  };
  return (
    <Drawer title="Shop settings" label="Shop settings" onClose={onClose}>
      <div className="settings-status"><i className={status === "Saved" ? "is-saved" : ""} />{status}</div>
      <div className="settings-list">
        {settingRows.map((row) => (
          <label className="setting-row" key={row.key}>
            <span><strong>{row.label}</strong><small>{row.detail}</small></span>
            <input
              type="checkbox"
              aria-label={row.label}
              checked={value[row.key]}
              onChange={(event) => void save({ [row.key]: event.target.checked })}
            />
          </label>
        ))}
      </div>
      <div className="setting-block">
        <div className="setting-block__title"><strong>Move limit</strong><span>{value.moveLimit} appointments</span></div>
        <div className="segmented" role="group" aria-label="Move limit">
          {[0, 1, 2, 3].map((limit) => (
            <button type="button" className={value.moveLimit === limit ? "is-active" : ""} key={limit} onClick={() => void save({ moveLimit: limit })}>{limit}</button>
          ))}
        </div>
      </div>
      <div className="setting-block">
        <div className="setting-block__title"><strong>Discount ceiling</strong><span>{value.maxDiscountPercent}%</span></div>
        <input
          className="range"
          aria-label="Discount ceiling"
          type="range"
          min="0"
          max="15"
          step="5"
          value={value.maxDiscountPercent}
          onChange={(event) => void save({ maxDiscountPercent: Number(event.target.value) })}
        />
      </div>
      <div className="reset-box">
        <span className="section-kicker">DEMO CONTROL</span>
        <h3>Reset the golden path</h3>
        <p>Restores Josh at 5, Sarah at 6, and Alex on the waitlist. Linked identities stay intact.</p>
        <div className="reset-box__actions">
          <input aria-label="Admin PIN" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Admin PIN" />
          <button type="button" onClick={() => void onReset(pin)}>Reset</button>
        </div>
      </div>
    </Drawer>
  );
}

function HealthPanel({ health, onClose }: { health: CalendarResponse["channelHealth"]; onClose: () => void }) {
  return (
    <div className="health-panel" role="dialog" aria-label="Channel health">
      <div className="health-panel__head"><strong>Channel health</strong><button type="button" onClick={onClose}>×</button></div>
      {Object.entries(health).map(([name, status]) => (
        <div className="health-row" key={name}>
          <span><i className={status === "unconfigured" ? "is-off" : ""} />{name === "elevenlabs" ? "ElevenLabs" : name[0]!.toUpperCase() + name.slice(1)}</span>
          <code>{status}</code>
        </div>
      ))}
      <p>Provider status only. No simulated chat or call controls.</p>
    </div>
  );
}

export function DashboardApp({
  api = defaultApi,
  initialDate = nextOperationalDate(),
  eventSourceFactory = defaultEventSourceFactory,
}: DashboardAppProps) {
  const [date, setDate] = useState(initialDate);
  const [calendar, setCalendar] = useState<CalendarResponse>();
  const [settings, setSettings] = useState<SchedulingSettings>();
  const [selectedRefill, setSelectedRefill] = useState<ActiveRefill>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [refreshing, setRefreshing] = useState(true);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setCalendar(await api.getCalendar(date));
      setError(undefined);
    } catch {
      setError("Calendar connection interrupted. Retrying on the next event.");
    } finally {
      setRefreshing(false);
    }
  }, [api, date]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const source = eventSourceFactory("/api/v1/events");
    if (source === undefined) return;
    source.addEventListener("domain", () => { void refresh(); });
    return () => source.close();
  }, [eventSourceFactory, refresh]);

  const openSettings = async () => {
    setSettingsOpen(true);
    try { setSettings(await api.getSettings()); } catch { setError("Settings could not be loaded."); }
  };
  const reset = async (pin: string) => {
    try {
      const { token } = await api.createAdminSession(pin);
      const result = await api.resetDemo(token);
      setDate(result.demoDate);
      setSettingsOpen(false);
      await refresh();
    } catch {
      setError("Reset failed. Check the admin PIN and connection.");
    }
  };
  const day = useMemo(() => formatDay(date), [date]);
  const readyChannels = calendar === undefined
    ? 0
    : Object.values(calendar.channelHealth).filter((status) => status !== "unconfigured").length;

  return (
    <div className="app-shell min-h-screen">
      <header className="masthead">
        <div className="brand-block">
          <span className="brand-block__edition">TORONTO · CHAIR BOARD 01</span>
          <h1 aria-label="REVIVE"><span>RE</span><i>•</i><span>VIVE</span></h1>
          <p>Scheduling that recovers the day.</p>
        </div>
        <div className="date-block">
          <div className="date-block__nav">
            <button type="button" aria-label="Previous day" onClick={() => setDate(DateTime.fromISO(date).minus({ days: 1 }).toISODate()!)}>←</button>
            <span>{day.weekday}</span>
            <button type="button" aria-label="Next day" onClick={() => setDate(DateTime.fromISO(date).plus({ days: 1 }).toISODate()!)}>→</button>
          </div>
          <strong>{day.long}</strong>
          <button className="today-link" type="button" onClick={() => calendar && setDate(calendar.demoDate)}>Demo day</button>
        </div>
        <div className="utility-block">
          <div className="utility-block__actions">
            <div className="health-anchor">
              <button className="health-button" type="button" onClick={() => setHealthOpen((open) => !open)}>
                <i className={readyChannels === 4 ? "" : "is-warn"} /> {readyChannels} / 4 channels ready
              </button>
              {calendar !== undefined && healthOpen && <HealthPanel health={calendar.channelHealth} onClose={() => setHealthOpen(false)} />}
            </div>
            <button className="settings-button" type="button" aria-label="Open settings" onClick={() => void openSettings()}>Settings ↗</button>
          </div>
          <div className="utility-block__meta"><span>{refreshing ? "SYNCING" : "LIVE"}</span><code>{calendar?.timezone ?? "America/Toronto"}</code></div>
        </div>
      </header>

      <main>
        <div className="board-intro">
          <div><span className="section-kicker">OPERATING DAY</span><h2>Every chair,<br /><em>in motion.</em></h2></div>
          <p>Confirmed work stays in ink. When a chair opens, REVIVE marks the gap in amber and shows the refill story as it happens.</p>
          <div className="legend"><span><i className="legend__confirmed" /> Confirmed</span><span><i className="legend__refill" /> Active refill</span><span><i className="legend__cancelled" /> Cancelled</span></div>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {calendar === undefined
          ? <div className="loading-board"><i /><span>Pulling the live chair board</span></div>
          : <CalendarGrid calendar={calendar} onOpenRefill={setSelectedRefill} />}
      </main>

      <footer><span>REVIVE / DEMO OPERATOR</span><span>Authoritative state · SSE connected</span><span>{calendar?.shop.location ?? "Toronto, ON"}</span></footer>

      {selectedRefill !== undefined && calendar !== undefined && (
        <TimelineDrawer refill={selectedRefill} timezone={calendar.timezone} onClose={() => setSelectedRefill(undefined)} />
      )}
      {settingsOpen && settings !== undefined && (
        <SettingsDrawer
          value={settings}
          api={api}
          onSaved={setSettings}
          onClose={() => setSettingsOpen(false)}
          onReset={reset}
        />
      )}
    </div>
  );
}
