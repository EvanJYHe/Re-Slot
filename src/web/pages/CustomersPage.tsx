import { useEffect, useState } from "react";
import { DateTime } from "luxon";

import { Button, EmptyState, StatusDot, cn } from "../components/ui.js";
import type { CustomerDetail, CustomerSummary, ReviveApi } from "../types.js";

interface CustomersPageProps {
  api: ReviveApi;
  token: string;
  refreshKey: number;
}

function formatDate(value: string): string {
  return DateTime.fromISO(value).setZone("America/Toronto").toFormat("ccc, LLL d · h:mm a");
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
            {customer.activeWaitlistCount > 0 ? (
              <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[9px] font-medium text-[#74551f]">WAITLIST</span>
            ) : null}
          </span>
          <span className="mt-1.5 block text-xs text-muted">{customer.identitySummary}</span>
          {customer.nextAppointmentAt === undefined ? null : (
            <span className="mt-1 block truncate font-mono text-[9px] text-muted">
              {formatDate(customer.nextAppointmentAt)} · {customer.nextBarberName}
            </span>
          )}
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

function CustomerRecord({ api, token, detail, saving, onDetailChange, onSavingChange }: {
  api: ReviveApi;
  token: string;
  detail: CustomerDetail;
  saving: string | undefined;
  onDetailChange: (detail: CustomerDetail) => void;
  onSavingChange: (status: string | undefined) => void;
}) {
  const [note, setNote] = useState("");

  const refresh = async () => {
    onDetailChange(await api.getCustomer(detail.id, token));
  };
  const updatePreference = async (patch: Partial<CustomerDetail["preferences"]>) => {
    onSavingChange("Saving…");
    try {
      await api.patchCustomer(detail.id, patch, token);
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
      await api.addCustomerNote(detail.id, text, token);
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
          <h4 className="text-sm font-semibold">Preferences</h4>
          <div className="mt-2 max-w-2xl">
            <PreferenceToggle
              checked={detail.preferences.earlierMoveConsent}
              detail="REVIVE may offer an earlier opening when the same service and barber match."
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
                  <time className="font-mono text-[10px] text-muted">{formatDate(entry.earliestStart)}</time>
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

export function CustomersPage({ api, token, refreshKey }: CustomersPageProps) {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<CustomerDetail>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState<string>();

  useEffect(() => {
    let active = true;
    void api.getCustomers(query, token).then((results) => {
      if (!active) return;
      setCustomers(results);
      setSelectedId((current) => (
        current !== undefined && results.some((customer) => customer.id === current)
          ? current
          : results[0]?.id
      ));
      if (results.length === 0) setDetail(undefined);
    });
    return () => { active = false; };
  }, [api, query, refreshKey, token]);

  useEffect(() => {
    if (selectedId === undefined) return;
    let active = true;
    setLoadingDetail(true);
    void api.getCustomer(selectedId, token).then((nextDetail) => {
      if (active) setDetail(nextDetail);
    }).finally(() => {
      if (active) setLoadingDetail(false);
    });
    return () => { active = false; };
  }, [api, refreshKey, selectedId, token]);

  return (
    <section>
      <div className="border-b border-line bg-panel px-5 py-4 lg:px-8">
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Customers</h2>
        <p className="mt-1 text-sm text-muted">Contact preferences and the scheduling context REVIVE needs.</p>
      </div>
      <div className="p-5 lg:p-8">
        <div className="mx-auto grid min-h-[620px] max-w-7xl overflow-hidden rounded-xl border border-line bg-panel shadow-panel md:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-r border-line">
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
            </div>
            <CustomerList customers={customers} onSelect={setSelectedId} selectedId={selectedId} />
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
              token={token}
            />
          )}
        </div>
      </div>
    </section>
  );
}
