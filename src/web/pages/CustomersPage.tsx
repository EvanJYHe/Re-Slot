import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { Button, EmptyState, cn } from "../components/ui.js";
import type { CustomerBookingState, CustomerDetail, CustomerSummary, OperatorWaitlistEntry, ReviveApi } from "../types.js";

interface CustomersPageProps {
  api: ReviveApi;
  refreshKey: number;
}

function formatDate(value: string): string {
  return DateTime.fromISO(value).setZone("America/Toronto").toFormat("ccc, LLL d · h:mm a");
}

function formatVisitDate(value: string): string {
  return DateTime.fromISO(value).setZone("America/Toronto").toFormat("LLL d, yyyy");
}

function formatWaitlistWindow(entry: OperatorWaitlistEntry): string {
  const start = entry.earliestStart.includes("T")
    ? DateTime.fromISO(entry.earliestStart).setZone("America/Toronto")
    : DateTime.fromISO(`${entry.date}T${entry.earliestStart}`, { zone: "America/Toronto" });
  const end = entry.latestStart.includes("T")
    ? DateTime.fromISO(entry.latestStart).setZone("America/Toronto")
    : DateTime.fromISO(`${entry.date}T${entry.latestStart}`, { zone: "America/Toronto" });
  return `${start.toFormat("ccc, LLL d")} · ${start.toFormat("h:mm a")}–${end.toFormat("h:mm a")}`;
}

const stateStyles: Record<CustomerBookingState, string> = {
  booked: "border-[#bed3c3] bg-[#e9f3ec] text-[#28543a]",
  waitlisted: "border-[#e5d3ae] bg-[#fbf2df] text-[#74551f]",
  outreach_ready: "border-[#c8d8cd] bg-white text-[#315b40]",
  not_eligible: "border-line bg-[#f3f4f1] text-muted",
};

function BookingStateBadge({ state, label }: { state: CustomerBookingState; label: string }) {
  return (
    <span className={cn(
      "inline-flex shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em]",
      stateStyles[state],
    )}>
      {label}
    </span>
  );
}

function customerSchedulingLine(customer: CustomerSummary): string {
  if (customer.bookingState === "booked") {
    return `${formatDate(customer.nextAppointmentAt!)} · ${customer.nextServiceName} with ${customer.nextBarberName}`;
  }
  if (customer.bookingState === "waitlisted") return customer.waitlistRequestSummary ?? "Active scheduling request";
  if (customer.lastVisitAt !== undefined) {
    return `Last visit ${formatVisitDate(customer.lastVisitAt)} · ${customer.visitCount} ${customer.visitCount === 1 ? "visit" : "visits"}`;
  }
  return customer.bookingState === "outreach_ready" ? "Known customer · no upcoming booking" : "No active booking or request";
}

function CustomerList({ customers, selectedId, onSelect }: {
  customers: CustomerSummary[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (customers.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">No customers match that search.</p>;
  }
  return (
    <div className="divide-y divide-line">
      {customers.map((customer) => (
        <button
          aria-pressed={selectedId === customer.id}
          className={cn(
            "w-full px-4 py-3.5 text-left transition-colors",
            selectedId === customer.id ? "bg-[#edf4ef]" : "hover:bg-[#fafbf9]",
          )}
          key={customer.id}
          onClick={() => onSelect(customer.id)}
          type="button"
        >
          <span className="flex items-center justify-between gap-2">
            <strong className="text-sm font-semibold">{customer.name}</strong>
            <BookingStateBadge label={customer.bookingStateLabel} state={customer.bookingState} />
          </span>
          <span className="mt-1.5 block truncate text-[11px] leading-4 text-[#5f665f]">{customerSchedulingLine(customer)}</span>
          <span className="mt-1 block text-[10px] text-muted">{customer.identitySummary}</span>
        </button>
      ))}
    </div>
  );
}

function PreferenceToggle({ label, detail, checked, disabled, onChange }: {
  label: string;
  detail: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 border-b border-line py-3.5 last:border-b-0">
      <span>
        <strong className="block text-sm font-medium">{label}</strong>
        <span className="mt-1 block text-xs leading-5 text-muted">{detail}</span>
      </span>
      <input
        aria-label={label}
        checked={checked}
        className="mt-0.5 h-4 w-4 accent-revive"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function AppointmentList({ detail }: { detail: CustomerDetail }) {
  const now = DateTime.now().toUTC();
  const upcoming = detail.appointments.filter((appointment) => (
    appointment.status === "confirmed" && DateTime.fromISO(appointment.startAt).toUTC() >= now
  ));
  const past = detail.appointments.filter((appointment) => !upcoming.some((candidate) => candidate.id === appointment.id));

  const group = (label: string, appointments: CustomerDetail["appointments"]) => (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{label}</span>
      {appointments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None</p>
      ) : (
        <div className="mt-2 divide-y divide-line rounded-revive border border-line">
          {appointments.map((appointment) => (
            <article className="flex items-center justify-between gap-4 px-3.5 py-3" key={appointment.id}>
              <div>
                <strong className="block text-sm font-medium">{appointment.serviceName}</strong>
                <span className="mt-1 block text-xs text-muted">{appointment.barberName}</span>
              </div>
              <time className="text-right font-mono text-[10px] text-muted">{formatDate(appointment.startAt)}</time>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  return <div className="grid gap-5 lg:grid-cols-2">{group("Upcoming", upcoming)}{group("Past", past)}</div>;
}

function CustomerRecord({ api, detail, saving, onDetailChange, onSavingChange }: {
  api: ReviveApi;
  detail: CustomerDetail;
  saving: string | undefined;
  onDetailChange: (detail: CustomerDetail) => void;
  onSavingChange: (status: string | undefined) => void;
}) {
  const [note, setNote] = useState("");

  const refresh = async () => {
    onDetailChange(await api.getCustomer(detail.id));
  };
  const updatePreference = async (patch: Partial<CustomerDetail["preferences"]>) => {
    onSavingChange("Saving…");
    try {
      await api.patchCustomer(detail.id, patch);
      await refresh();
      onSavingChange("Saved");
    } catch (error) {
      onSavingChange(error instanceof Error ? error.message : "That preference could not be saved.");
    }
  };
  const addNote = async () => {
    const text = note.trim();
    if (text === "") return;
    onSavingChange("Saving note…");
    try {
      await api.addCustomerNote(detail.id, text);
      setNote("");
      await refresh();
      onSavingChange("Saved");
    } catch (error) {
      onSavingChange(error instanceof Error ? error.message : "That note could not be saved.");
    }
  };

  return (
    <section aria-label={`${detail.name} customer record`} className="min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5 lg:px-7">
        <div>
          <span className="flex items-center gap-2">
            <h3 className="text-xl font-semibold tracking-[-0.02em]">{detail.name}</h3>
            <span className="rounded-full bg-[#edf4ef] px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-revive-dark">
              {detail.preferences.contactPreference}
            </span>
          </span>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span>Telegram: <strong className="font-normal">{detail.identities.telegram}</strong></span>
            <span>Phone: <strong className="font-normal">{detail.identities.phone}</strong></span>
          </div>
        </div>
        {saving === undefined ? null : <span className="font-mono text-[10px] text-muted">{saving}</span>}
      </header>
      <div className="divide-y divide-line">
        <section className="px-5 py-5 lg:px-7">
          <div className="py-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-semibold">Booking</h4>
              <BookingStateBadge label={detail.relationship.bookingStateLabel} state={detail.relationship.bookingState} />
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Current request</dt>
                <dd className="mt-1 text-sm font-medium">
                  {detail.relationship.bookingState === "booked"
                    ? `${detail.relationship.nextServiceName} · ${detail.relationship.nextBarberName}`
                    : detail.relationship.bookingState === "waitlisted"
                      ? detail.relationship.waitlistRequestSummary
                      : "No active request"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Visits</dt>
                <dd className="mt-1 text-sm font-medium">{detail.relationship.visitCount} {detail.relationship.visitCount === 1 ? "visit" : "visits"}</dd>
                <span className="mt-0.5 block text-xs text-muted">
                  {detail.relationship.lastVisitAt === undefined ? "No visit recorded" : `Last ${formatVisitDate(detail.relationship.lastVisitAt)}`}
                </span>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Usually books</dt>
                <dd className="mt-1 text-sm font-medium">
                  {detail.relationship.usualServiceName === undefined
                    ? "Still learning"
                    : `${detail.relationship.usualServiceName} · ${detail.relationship.usualBarberName ?? "Any barber"}`}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Reaches them by</dt>
                <dd className="mt-1 text-sm font-medium capitalize">{detail.preferences.contactPreference}</dd>
                <span className="mt-0.5 block text-xs text-muted">
                  {detail.relationship.outreachEligible ? "When an opening matches" : "Active requests only"}
                </span>
              </div>
            </dl>
          </div>
        </section>
        <section className="px-5 py-5 lg:px-7">
          <h4 className="text-sm font-semibold">Preferences</h4>
          <div className="mt-2 max-w-2xl">
            <PreferenceToggle
              checked={detail.preferences.earlierMoveConsent}
              detail="Re-Slot may offer an earlier opening when the same service and barber match."
              disabled={saving === "Saving…"}
              label="Offer earlier appointments"
              onChange={(checked) => void updatePreference({ earlierMoveConsent: checked })}
            />
            <PreferenceToggle
              checked={detail.preferences.flexibleBarberPreference}
              detail="Include another qualified barber when the requested barber is unavailable."
              disabled={saving === "Saving…"}
              label="Any qualified barber"
              onChange={(checked) => void updatePreference({ flexibleBarberPreference: checked })}
            />
            <PreferenceToggle
              checked={detail.preferences.pastCustomerOptIn}
              detail="Allow vacancy outreach after waitlist and same-day moves have been exhausted."
              disabled={saving === "Saving…"}
              label="Past-customer outreach"
              onChange={(checked) => void updatePreference({ pastCustomerOptIn: checked })}
            />
          </div>
        </section>
        <section className="px-5 py-5 lg:px-7">
          <h4 className="text-sm font-semibold">Appointments</h4>
          <div className="mt-4"><AppointmentList detail={detail} /></div>
        </section>
        <section className="px-5 py-5 lg:px-7">
          <h4 className="text-sm font-semibold">Waitlist</h4>
          {detail.waitlist.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No waitlist entries.</p>
          ) : (
            <div className="mt-3 divide-y divide-line rounded-revive border border-line">
              {detail.waitlist.map((entry) => (
                <article className="flex items-center justify-between gap-4 px-3.5 py-3" key={entry.id}>
                  <div>
                    <strong className="block text-sm font-medium">{entry.serviceName} · {entry.barberName}</strong>
                    <span className="mt-1 block text-xs capitalize text-muted">{entry.status} · {entry.channel}</span>
                  </div>
                  <time className="font-mono text-[10px] text-muted">{formatWaitlistWindow(entry)}</time>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="px-5 py-5 lg:px-7">
          <h4 className="text-sm font-semibold">Private notes</h4>
          <div className="mt-3 flex max-w-2xl gap-2">
            <label className="sr-only" htmlFor="customer-note">New private note</label>
            <textarea
              className="min-h-20 flex-1 resize-none rounded-revive border border-line bg-white px-3 py-2.5 text-sm placeholder:text-[#9fa69f]"
              id="customer-note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add useful front-desk context"
              value={note}
            />
            <Button className="self-end" disabled={note.trim() === ""} onClick={() => void addNote()} variant="primary">Add private note</Button>
          </div>
          {detail.notes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No private notes.</p>
          ) : (
            <ol className="mt-4 max-w-2xl space-y-2">
              {detail.notes.map((item) => (
                <li className="rounded-revive border border-line bg-[#fafbf9] px-3.5 py-3 text-sm leading-6" key={item.id}>
                  {item.text}
                  <time className="mt-1 block font-mono text-[9px] text-muted">{formatDate(item.createdAt)}</time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}

export function CustomersPage({ api, refreshKey }: CustomersPageProps) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [filter, setFilter] = useState<"all" | CustomerBookingState>("all");
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<CustomerDetail>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState<string>();

  useEffect(() => {
    let active = true;
    void api.getCustomers("").then((results) => {
      if (!active) return;
      setCustomers(results);
      if (results.length === 0) setDetail(undefined);
    });
    return () => { active = false; };
  }, [api, refreshKey]);

  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const statePriority: Record<CustomerBookingState, number> = {
      waitlisted: 0,
      outreach_ready: 1,
      booked: 2,
      not_eligible: 3,
    };
    return customers
      .filter((customer) => (
        (filter === "all" || customer.bookingState === filter)
        && customer.name.toLocaleLowerCase().includes(normalizedQuery)
      ))
      .sort((left, right) => (
        statePriority[left.bookingState] - statePriority[right.bookingState]
        || right.visitCount - left.visitCount
        || left.name.localeCompare(right.name)
      ));
  }, [customers, filter, query]);

  useEffect(() => {
    setSelectedId((current) => (
      current !== undefined && filteredCustomers.some((customer) => customer.id === current)
        ? current
        : filteredCustomers[0]?.id
    ));
    if (filteredCustomers.length === 0) setDetail(undefined);
  }, [filteredCustomers]);

  useEffect(() => {
    if (selectedId === undefined) return;
    let active = true;
    setLoadingDetail(true);
    void api.getCustomer(selectedId).then((nextDetail) => {
      if (active) setDetail(nextDetail);
    }).finally(() => {
      if (active) setLoadingDetail(false);
    });
    return () => { active = false; };
  }, [api, refreshKey, selectedId]);

  const funnel = [
    { id: "all" as const, label: "All customers", value: customers.length },
    { id: "booked" as const, label: "Booked", value: customers.filter((customer) => customer.bookingState === "booked").length },
    { id: "waitlisted" as const, label: "Waitlisted", value: customers.filter((customer) => customer.bookingState === "waitlisted").length },
    { id: "outreach_ready" as const, label: "Ready to contact", value: customers.filter((customer) => customer.bookingState === "outreach_ready").length },
  ];

  return (
    <section>
      <div className="border-b border-line bg-panel px-5 py-4 lg:px-8">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Customer intelligence</h2>
      </div>
      <div className="p-5 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid overflow-hidden rounded-[4px] border border-line bg-panel shadow-panel sm:grid-cols-2 lg:grid-cols-4">
            {funnel.map((item, index) => (
              <button
                aria-label={`${item.label} ${item.value}`}
                aria-pressed={filter === item.id}
                className={cn(
                  "group min-h-24 border-line px-4 py-4 text-left transition-colors sm:px-5",
                  index > 0 ? "border-t sm:border-t-0 sm:border-l" : "",
                  index === 2 ? "sm:border-l-0 lg:border-l" : "",
                  filter === item.id ? "bg-[#edf4ef]" : "bg-white hover:bg-[#f8faf7]",
                )}
                key={item.id}
                onClick={() => setFilter(item.id)}
                type="button"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{item.label}</span>
                <strong className="mt-2 block text-3xl font-semibold tracking-[-0.05em]">{item.value}</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="mx-auto mt-4 grid min-h-[680px] max-w-7xl overflow-hidden rounded-[4px] border border-line bg-panel shadow-panel md:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="min-h-0 border-r border-line">
            <div className="border-b border-line p-4">
              <label className="sr-only" htmlFor="customer-search">Search customers</label>
              <input
                className="h-9 w-full rounded-revive border border-line bg-white px-3 text-sm placeholder:text-[#9fa69f]"
                id="customer-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search customers"
                role="searchbox"
                value={query}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted">{filteredCustomers.length} customer{filteredCustomers.length === 1 ? "" : "s"}</span>
                {filter === "all" ? null : (
                  <button className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-revive-dark transition-colors hover:border-revive hover:bg-[#edf4ef]" onClick={() => setFilter("all")} type="button">Clear filter</button>
                )}
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <CustomerList customers={filteredCustomers} onSelect={setSelectedId} selectedId={selectedId} />
            </div>
          </aside>
          {loadingDetail ? (
            <div className="m-6 animate-pulse rounded-xl bg-[#f1f3f0]" />
          ) : detail === undefined ? (
            <EmptyState detail="Choose a customer to view their scheduling record." title="No customer selected" />
          ) : (
            <CustomerRecord
              api={api}
              detail={detail}
              onDetailChange={setDetail}
              onSavingChange={setSaving}
              saving={saving}
            />
          )}
        </div>
      </div>
    </section>
  );
}
