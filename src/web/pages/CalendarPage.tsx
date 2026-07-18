import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { ReviveApiError } from "../api.js";
import { Button, Drawer, IconButton, Modal, SegmentedControl, StatusDot, cn } from "../components/ui.js";
import { movePeriod, periodLabel, periodRange, type CalendarView } from "../lib/dates.js";
import type {
  ActiveRefill,
  CalendarAppointment,
  CalendarResponse,
  CustomerSummary,
  ReviveApi,
} from "../types.js";

interface CalendarPageProps {
  api: ReviveApi;
  calendar: CalendarResponse | undefined;
  anchorDate: string;
  view: CalendarView;
  barberFilter: string;
  loading: boolean;
  operatorToken: string | undefined;
  onAnchorDateChange: (date: string) => void;
  onViewChange: (view: CalendarView) => void;
  onBarberFilterChange: (barberId: string) => void;
  onMutated: () => Promise<void>;
  onRequireOperator: () => void;
}

const pixelsPerHour = 72;

function localDate(iso: string, timezone: string): string {
  return DateTime.fromISO(iso).setZone(timezone).toISODate()!;
}

function timeLabel(iso: string, timezone: string): string {
  return DateTime.fromISO(iso).setZone(timezone).toFormat("h:mm a");
}

function minuteOfDay(iso: string, timezone: string): number {
  const value = DateTime.fromISO(iso).setZone(timezone);
  return value.hour * 60 + value.minute;
}

function cardStyle(startAt: string, endAt: string, timezone: string, startMinutes: number): CSSProperties {
  const top = ((minuteOfDay(startAt, timezone) - startMinutes) / 60) * pixelsPerHour;
  const duration = minuteOfDay(endAt, timezone) - minuteOfDay(startAt, timezone);
  const height = Math.max(32, (duration / 60) * pixelsPerHour - 4);
  return {
    "--card-top": `${top + 2}px`,
    "--card-height": `${height}px`,
  } as CSSProperties;
}

function HourLines({ startHour, endHour }: { startHour: number; endHour: number }) {
  return (
    <>
      {Array.from({ length: endHour - startHour + 1 }, (_, index) => (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-line"
          key={index}
          style={{ top: index * pixelsPerHour }}
        />
      ))}
    </>
  );
}

function AppointmentCard({ appointment, timezone, showBarber, onOpen, compact = false, style }: {
  appointment: CalendarAppointment;
  timezone: string;
  showBarber: boolean;
  onOpen: () => void;
  compact?: boolean;
  style: CSSProperties;
}) {
  return (
    <button
      aria-label={`${appointment.customerName}, ${appointment.serviceName}, ${timeLabel(appointment.startAt, timezone)}`}
      className={cn(
        "calendar-card z-10 overflow-hidden rounded-[6px] border border-[#cfe1d6] border-l-[3px] border-l-revive bg-[#f1f7f3] px-2.5 py-1.5 text-left transition-colors hover:bg-[#e9f3ed]",
        compact ? "text-[11px]" : "text-xs",
      )}
      onClick={onOpen}
      style={style}
      type="button"
    >
      <strong className="block truncate font-semibold text-ink">{appointment.customerName}</strong>
      <span className="mt-0.5 block truncate text-muted">{appointment.serviceName}</span>
      {showBarber ? <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-wide text-revive">{appointment.barberName}</span> : null}
    </button>
  );
}

function RefillCard({ refill, timezone, onOpen, style }: {
  refill: ActiveRefill;
  timezone: string;
  onOpen: () => void;
  style: CSSProperties;
}) {
  return (
    <button
      aria-label={`${refill.customerState} Open refill timeline`}
      className="calendar-card z-20 overflow-hidden rounded-[6px] border border-[#ead49f] bg-amber-soft px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[#ffefca]"
      onClick={onOpen}
      style={style}
      type="button"
    >
      <span className="flex items-center gap-1.5 font-medium text-[#72531e]"><StatusDot tone="warning" />Open chair</span>
      <strong className="mt-1 block truncate font-semibold text-ink">{refill.customerState.replace(/\.$/, "")}</strong>
      <span className="mt-0.5 block truncate text-[#80652f]">{timeLabel(refill.slotStartAt, timezone)} · {refill.barberName}</span>
    </button>
  );
}

function TimeRuler({ startHour, endHour }: { startHour: number; endHour: number }) {
  return (
    <div aria-hidden="true" className="relative border-r border-line bg-[#fafbf9]">
      {Array.from({ length: endHour - startHour + 1 }, (_, index) => (
        <span
          className="absolute right-3 -translate-y-1/2 font-mono text-[10px] text-muted"
          key={index}
          style={{ top: index * pixelsPerHour }}
        >
          {DateTime.fromObject({ hour: startHour + index }).toFormat("h a")}
        </span>
      ))}
    </div>
  );
}

function DayCalendar({ calendar, date, barberFilter, onAppointment, onRefill }: {
  calendar: CalendarResponse;
  date: string;
  barberFilter: string;
  onAppointment: (appointment: CalendarAppointment) => void;
  onRefill: (refill: ActiveRefill) => void;
}) {
  const startHour = Number(calendar.businessHours.start.slice(0, 2));
  const endHour = Number(calendar.businessHours.end.slice(0, 2));
  const laneHeight = (endHour - startHour) * pixelsPerHour;
  const barbers = barberFilter === "all"
    ? calendar.barbers
    : calendar.barbers.filter((barber) => barber.id === barberFilter);
  return (
    <section aria-label="Day calendar" className="overflow-x-auto rounded-xl border border-line bg-panel shadow-panel">
      <div className="min-w-[760px]">
        <div
          className="grid min-h-12 border-b border-line bg-[#fafbf9]"
          role="row"
          style={{ gridTemplateColumns: `72px repeat(${barbers.length}, minmax(180px, 1fr))` }}
        >
          <div className="border-r border-line" />
          {barbers.map((barber) => (
            <div aria-label={barber.name} className="flex items-center border-r border-line px-4 text-sm font-semibold last:border-r-0" key={barber.id} role="columnheader">
              {barber.name}
            </div>
          ))}
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: `72px repeat(${barbers.length}, minmax(180px, 1fr))` }}
        >
          <TimeRuler endHour={endHour} startHour={startHour} />
          {barbers.map((barber) => (
            <div className="relative border-r border-line last:border-r-0" key={barber.id} style={{ height: laneHeight }}>
              <HourLines endHour={endHour} startHour={startHour} />
              {calendar.appointments
                .filter((appointment) => appointment.status === "confirmed")
                .filter((appointment) => appointment.barberId === barber.id)
                .filter((appointment) => localDate(appointment.startAt, calendar.timezone) === date)
                .map((appointment) => (
                  <AppointmentCard
                    appointment={appointment}
                    key={appointment.id}
                    onOpen={() => onAppointment(appointment)}
                    showBarber={false}
                    style={{
                      ...cardStyle(appointment.startAt, appointment.endAt, calendar.timezone, startHour * 60),
                      left: 5,
                      right: 5,
                    }}
                    timezone={calendar.timezone}
                  />
                ))}
              {calendar.activeRefills
                .filter((refill) => refill.barberId === barber.id)
                .filter((refill) => localDate(refill.slotStartAt, calendar.timezone) === date)
                .map((refill) => (
                  <RefillCard
                    key={refill.id}
                    onOpen={() => onRefill(refill)}
                    refill={refill}
                    style={{
                      ...cardStyle(refill.slotStartAt, refill.slotEndAt, calendar.timezone, startHour * 60),
                      left: 5,
                      right: 5,
                    }}
                    timezone={calendar.timezone}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WeekCalendar({ calendar, dates, barberFilter, onAppointment, onRefill }: {
  calendar: CalendarResponse;
  dates: string[];
  barberFilter: string;
  onAppointment: (appointment: CalendarAppointment) => void;
  onRefill: (refill: ActiveRefill) => void;
}) {
  const startHour = Number(calendar.businessHours.start.slice(0, 2));
  const endHour = Number(calendar.businessHours.end.slice(0, 2));
  const laneHeight = (endHour - startHour) * pixelsPerHour;
  const visibleBarbers = barberFilter === "all"
    ? calendar.barbers
    : calendar.barbers.filter((barber) => barber.id === barberFilter);
  return (
    <section aria-label="Week calendar" className="overflow-x-auto rounded-xl border border-line bg-panel shadow-panel">
      <div className="min-w-[920px]">
        <div className="grid min-h-12 border-b border-line bg-[#fafbf9]" style={{ gridTemplateColumns: `72px repeat(${dates.length}, minmax(150px, 1fr))` }}>
          <div className="border-r border-line" />
          {dates.map((date) => (
            <div className="flex items-center border-r border-line px-3 text-sm font-semibold last:border-r-0" key={date}>
              {DateTime.fromISO(date).toFormat("ccc d")}
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `72px repeat(${dates.length}, minmax(150px, 1fr))` }}>
          <TimeRuler endHour={endHour} startHour={startHour} />
          {dates.map((date) => (
            <div className="relative border-r border-line last:border-r-0" key={date} style={{ height: laneHeight }}>
              <HourLines endHour={endHour} startHour={startHour} />
              {calendar.appointments
                .filter((appointment) => appointment.status === "confirmed")
                .filter((appointment) => localDate(appointment.startAt, calendar.timezone) === date)
                .filter((appointment) => visibleBarbers.some((barber) => barber.id === appointment.barberId))
                .map((appointment) => {
                  const index = Math.max(0, visibleBarbers.findIndex((barber) => barber.id === appointment.barberId));
                  const width = 94 / visibleBarbers.length;
                  return (
                    <AppointmentCard
                      appointment={appointment}
                      compact
                      key={appointment.id}
                      onOpen={() => onAppointment(appointment)}
                      showBarber={barberFilter === "all"}
                      style={{
                        ...cardStyle(appointment.startAt, appointment.endAt, calendar.timezone, startHour * 60),
                        left: `${3 + index * width}%`,
                        width: `${width - 1}%`,
                      }}
                      timezone={calendar.timezone}
                    />
                  );
                })}
              {calendar.activeRefills
                .filter((refill) => localDate(refill.slotStartAt, calendar.timezone) === date)
                .filter((refill) => visibleBarbers.some((barber) => barber.id === refill.barberId))
                .map((refill) => (
                  <RefillCard
                    key={refill.id}
                    onOpen={() => onRefill(refill)}
                    refill={refill}
                    style={{
                      ...cardStyle(refill.slotStartAt, refill.slotEndAt, calendar.timezone, startHour * 60),
                      left: 5,
                      right: 5,
                    }}
                    timezone={calendar.timezone}
                  />
                ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MonthCalendar({ calendar, anchorDate, dates, barberFilter, onSelectDate }: {
  calendar: CalendarResponse;
  anchorDate: string;
  dates: string[];
  barberFilter: string;
  onSelectDate: (date: string) => void;
}) {
  const anchorMonth = DateTime.fromISO(anchorDate).month;
  return (
    <section aria-label="Month calendar" className="overflow-hidden rounded-xl border border-line bg-panel shadow-panel">
      <div className="grid grid-cols-7 border-b border-line bg-[#fafbf9]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div className="border-r border-line px-3 py-2.5 text-xs font-medium text-muted last:border-r-0" key={day}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const value = DateTime.fromISO(date);
          const appointments = calendar.appointments
            .filter((appointment) => appointment.status === "confirmed")
            .filter((appointment) => localDate(appointment.startAt, calendar.timezone) === date)
            .filter((appointment) => barberFilter === "all" || appointment.barberId === barberFilter);
          const refills = calendar.activeRefills
            .filter((refill) => localDate(refill.slotStartAt, calendar.timezone) === date)
            .filter((refill) => barberFilter === "all" || refill.barberId === barberFilter);
          const countLabel = `${appointments.length} ${appointments.length === 1 ? "appointment" : "appointments"}`;
          return (
            <button
              aria-label={`Open ${value.toFormat("cccc, LLLL d")}`}
              className={cn(
                "min-h-28 border-b border-r border-line p-3 text-left transition-colors hover:bg-[#fafbf9]",
                value.month !== anchorMonth && "bg-[#fbfcfa] text-[#a4aba5]",
              )}
              key={date}
              onClick={() => onSelectDate(date)}
              type="button"
            >
              <span className="flex items-center justify-between text-xs font-medium">
                {value.day}
                {refills.length > 0 ? <StatusDot tone="warning" /> : null}
              </span>
              <span className="mt-5 block text-xs text-muted">{countLabel}</span>
              <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[#edf0ec]">
                <span className="block h-full rounded-full bg-[#a8c7b3]" style={{ width: `${Math.min(100, appointments.length * 18)}%` }} />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RefillDrawer({ refill, timezone, onClose }: {
  refill: ActiveRefill;
  timezone: string;
  onClose: () => void;
}) {
  return (
    <Drawer onClose={onClose} title="Refill timeline">
      <div className="rounded-revive border border-[#ead49f] bg-amber-soft p-4">
        <span className="text-xs font-medium text-[#74551f]">Current state</span>
        <strong className="mt-1.5 block text-base">{refill.customerState}</strong>
        <p className="mt-1 text-sm text-[#80652f]">{refill.serviceName} with {refill.barberName} · {timeLabel(refill.slotStartAt, timezone)}</p>
      </div>
      <ol className="mt-6 space-y-0">
        {refill.timeline.map((event, index) => (
          <li className="grid grid-cols-[74px_1fr] gap-3" key={`${event.at}-${index}`}>
            <time className="pt-0.5 font-mono text-[10px] text-muted">{DateTime.fromISO(event.at).setZone(timezone).toFormat("h:mm:ss a")}</time>
            <div className="relative border-l border-line pb-6 pl-4 text-sm leading-6">
              <span className="absolute -left-1 top-1.5 h-2 w-2 rounded-full bg-revive" />
              {event.message}
            </div>
          </li>
        ))}
      </ol>
    </Drawer>
  );
}

function AppointmentDrawer({ appointment, timezone, api, token, onClose, onEdit, onMutated }: {
  appointment: CalendarAppointment;
  timezone: string;
  api: ReviveApi;
  token: string | undefined;
  onClose: () => void;
  onEdit: () => void;
  onMutated: () => Promise<void>;
}) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [status, setStatus] = useState<string>();
  const cancel = async () => {
    if (token === undefined) return;
    setStatus("Cancelling…");
    try {
      await api.cancelAppointment(appointment.id, token);
      await onMutated();
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The appointment could not be cancelled.");
    }
  };
  return (
    <Drawer onClose={onClose} title="Appointment details">
      <div className="border-b border-line pb-5">
        <span className="font-mono text-[11px] text-muted">{timeLabel(appointment.startAt, timezone)}–{timeLabel(appointment.endAt, timezone)}</span>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em]">{appointment.customerName}</h3>
        <p className="mt-1 text-sm text-muted">{appointment.serviceName}</p>
      </div>
      <dl className="grid grid-cols-[110px_1fr] gap-y-4 py-5 text-sm">
        <dt className="text-muted">Barber</dt><dd className="font-medium">{appointment.barberName}</dd>
        <dt className="text-muted">Status</dt><dd className="font-medium capitalize">{appointment.status}</dd>
        <dt className="text-muted">Discount</dt><dd className="font-medium">{appointment.discountPercent}%</dd>
      </dl>
      {status === undefined ? null : <p className="mb-3 text-sm text-muted">{status}</p>}
      <div className="flex gap-2 border-t border-line pt-5">
        <Button disabled={token === undefined} onClick={onEdit}>Reschedule</Button>
        {confirmingCancel
          ? <Button onClick={() => void cancel()} variant="danger">Confirm cancellation</Button>
          : <Button disabled={token === undefined} onClick={() => setConfirmingCancel(true)} variant="ghost">Cancel appointment</Button>}
      </div>
    </Drawer>
  );
}

function AppointmentEditor({ api, calendar, anchorDate, token, appointment, onClose, onSuccess }: {
  api: ReviveApi;
  calendar: CalendarResponse;
  anchorDate: string;
  token: string;
  appointment?: CalendarAppointment;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [customerId, setCustomerId] = useState(appointment?.customerId ?? "");
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? calendar.services[0]?.id ?? "");
  const [barberId, setBarberId] = useState(appointment?.barberId ?? calendar.barbers[0]?.id ?? "");
  const [date, setDate] = useState(appointment === undefined
    ? anchorDate
    : localDate(appointment.startAt, calendar.timezone));
  const [slots, setSlots] = useState<Array<{ startAt: string; localTime: string }>>([]);
  const [startAt, setStartAt] = useState("");
  const [status, setStatus] = useState("Loading customers…");
  const editing = appointment !== undefined;

  useEffect(() => {
    let active = true;
    void api.getCustomers("", token).then((result) => {
      if (!active) return;
      setCustomers(result);
      if (!editing && result[0] !== undefined) setCustomerId(result[0].id);
      setStatus("");
    }).catch(() => {
      if (active) setStatus("Customers could not be loaded.");
    });
    return () => { active = false; };
  }, [api, editing, token]);

  useEffect(() => {
    if (serviceId === "" || barberId === "" || date === "") return;
    let active = true;
    setStartAt("");
    setStatus("Checking live availability…");
    void api.getAvailability({ date, serviceId, barberId }, token).then((result) => {
      if (!active) return;
      setSlots(result.slots);
      setStatus(result.slots.length === 0 ? "No live times are available for this selection." : "");
    }).catch(() => {
      if (active) setStatus("Availability could not be loaded.");
    });
    return () => { active = false; };
  }, [api, barberId, date, serviceId, token]);

  const submit = async () => {
    if (startAt === "" || barberId === "" || (!editing && customerId === "")) return;
    setStatus(editing ? "Moving appointment…" : "Booking appointment…");
    try {
      if (editing) {
        await api.rescheduleAppointment(appointment.id, { barberId, startAt }, token);
      } else {
        await api.bookAppointment({ customerId, barberId, serviceId, startAt }, token);
      }
      await onSuccess();
      onClose();
    } catch (error) {
      if (error instanceof ReviveApiError && error.status === 409) {
        setStatus(error.message);
        const refreshed = await api.getAvailability({ date, serviceId, barberId }, token).catch(() => undefined);
        if (refreshed !== undefined) setSlots(refreshed.slots);
        return;
      }
      setStatus(error instanceof Error ? error.message : "The appointment could not be saved.");
    }
  };

  const eligibleBarbers = calendar.barbers.filter((barber) => barber.serviceIds.includes(serviceId));
  return (
    <Modal onClose={onClose} title={editing ? "Reschedule appointment" : "New appointment"}>
      <div className="space-y-4">
        {editing ? (
          <div className="rounded-revive border border-line bg-[#fafbf9] p-3 text-sm">
            <strong>{appointment.customerName}</strong><span className="text-muted"> · {appointment.serviceName}</span>
          </div>
        ) : (
          <label className="block text-sm font-medium">
            Customer
            <select className="mt-1.5 h-10 w-full rounded-revive border border-line bg-white px-3 text-sm" onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
              <option value="">Select a customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
        )}
        {!editing ? (
          <label className="block text-sm font-medium">
            Service
            <select className="mt-1.5 h-10 w-full rounded-revive border border-line bg-white px-3 text-sm" onChange={(event) => setServiceId(event.target.value)} value={serviceId}>
              {calendar.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
          </label>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Barber
            <select className="mt-1.5 h-10 w-full rounded-revive border border-line bg-white px-3 text-sm" onChange={(event) => setBarberId(event.target.value)} value={barberId}>
              {eligibleBarbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Date
            <input className="mt-1.5 h-10 w-full rounded-revive border border-line bg-white px-3 text-sm" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Time
          <select className="mt-1.5 h-10 w-full rounded-revive border border-line bg-white px-3 text-sm" onChange={(event) => setStartAt(event.target.value)} value={startAt}>
            <option value="">Select a live opening</option>
            {slots.map((slot) => <option key={slot.startAt} value={slot.startAt}>{slot.localTime}</option>)}
          </select>
        </label>
        {status === "" ? null : <p className={cn("text-sm", status.includes("taken") ? "text-[#a44646]" : "text-muted")}>{status}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button disabled={startAt === "" || (!editing && customerId === "")} onClick={() => void submit()} variant="primary">
            {editing ? "Confirm new time" : "Confirm appointment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function CalendarPage({
  api,
  calendar,
  anchorDate,
  view,
  barberFilter,
  loading,
  operatorToken,
  onAnchorDateChange,
  onViewChange,
  onBarberFilterChange,
  onMutated,
  onRequireOperator,
}: CalendarPageProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment>();
  const [selectedRefill, setSelectedRefill] = useState<ActiveRefill>();
  const [editor, setEditor] = useState<"new" | "edit">();
  const range = useMemo(() => periodRange(anchorDate, view), [anchorDate, view]);

  const openEditor = () => {
    if (operatorToken === undefined) {
      onRequireOperator();
      return;
    }
    setEditor("new");
  };
  const selectMonthDate = (date: string) => {
    onAnchorDateChange(date);
    onViewChange("day");
  };

  return (
    <section>
      <div className="border-b border-line bg-panel px-5 py-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="mr-3 text-xl font-semibold tracking-[-0.02em]">Calendar</h2>
            <IconButton aria-label="Previous period" onClick={() => onAnchorDateChange(movePeriod(anchorDate, view, -1))}>‹</IconButton>
            <IconButton aria-label="Next period" onClick={() => onAnchorDateChange(movePeriod(anchorDate, view, 1))}>›</IconButton>
            <strong className="min-w-40 text-sm font-medium">{periodLabel(anchorDate, view)}</strong>
            <Button className="h-8" onClick={() => onAnchorDateChange(calendar?.demoDate ?? anchorDate)} variant="ghost">Today</Button>
          </div>
          <div className="flex items-center gap-2">
            <SegmentedControl
              label="Calendar view"
              onChange={onViewChange}
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
              value={view}
            />
            <Button aria-label="New appointment" onClick={openEditor} variant="primary">
              <span aria-hidden="true">+</span>
              New appointment
            </Button>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5">
          {[{ id: "all", name: "All" }, ...(calendar?.barbers ?? [])].map((barber) => (
            <button
              aria-pressed={barberFilter === barber.id}
              className={cn(
                "h-8 rounded-full border px-3.5 text-sm transition-colors",
                barberFilter === barber.id
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-panel text-muted hover:border-[#cbd2cc] hover:text-ink",
              )}
              key={barber.id}
              onClick={() => onBarberFilterChange(barber.id)}
              type="button"
            >
              {barber.name}
            </button>
          ))}
          {loading ? <span className="ml-auto font-mono text-[10px] text-muted">Refreshing</span> : null}
        </div>
      </div>
      <div className="p-5 lg:p-8">
        {calendar === undefined ? (
          <div className="min-h-96 animate-pulse rounded-xl border border-line bg-panel" />
        ) : view === "day" ? (
          <DayCalendar
            barberFilter={barberFilter}
            calendar={calendar}
            date={anchorDate}
            onAppointment={setSelectedAppointment}
            onRefill={setSelectedRefill}
          />
        ) : view === "week" ? (
          <WeekCalendar
            barberFilter={barberFilter}
            calendar={calendar}
            dates={range.visibleDates}
            onAppointment={setSelectedAppointment}
            onRefill={setSelectedRefill}
          />
        ) : (
          <MonthCalendar
            anchorDate={anchorDate}
            barberFilter={barberFilter}
            calendar={calendar}
            dates={range.visibleDates}
            onSelectDate={selectMonthDate}
          />
        )}
      </div>
      {selectedAppointment === undefined || editor === "edit" || calendar === undefined ? null : (
        <AppointmentDrawer
          api={api}
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(undefined)}
          onEdit={() => setEditor("edit")}
          onMutated={onMutated}
          timezone={calendar.timezone}
          token={operatorToken}
        />
      )}
      {selectedRefill === undefined || calendar === undefined ? null : (
        <RefillDrawer
          onClose={() => setSelectedRefill(undefined)}
          refill={selectedRefill}
          timezone={calendar.timezone}
        />
      )}
      {editor === undefined || calendar === undefined || operatorToken === undefined ? null : (
        <AppointmentEditor
          anchorDate={anchorDate}
          api={api}
          calendar={calendar}
          onClose={() => {
            setEditor(undefined);
            if (editor === "edit") setSelectedAppointment(undefined);
          }}
          onSuccess={onMutated}
          token={operatorToken}
          {...(editor === "edit" && selectedAppointment !== undefined
            ? { appointment: selectedAppointment }
            : {})}
        />
      )}
    </section>
  );
}
