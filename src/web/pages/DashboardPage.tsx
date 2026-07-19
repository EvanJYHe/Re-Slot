import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { EmptyState, StatusDot } from "../components/ui.js";
import type { DashboardResponse, ReviveApi } from "../types.js";

interface DashboardPageProps {
  api: ReviveApi;
  anchorDate: string;
  refreshKey: number;
}

const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
});

function currency(cents: number): string {
  return money.format(cents / 100).replace("CA", "");
}

function MetricCard({ label, value, detail, primary = false }: {
  label: string;
  value: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <article className={primary
      ? "rounded-xl border border-[#c9dfd1] bg-[#edf5f0] p-5"
      : "rounded-xl border border-line bg-panel p-5"
    }>
      <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-muted">{label}</p>
      <strong className="mt-3 block text-3xl font-semibold tracking-[-0.04em] text-ink">{value}</strong>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </article>
  );
}

function RevenueChart({ dashboard }: { dashboard: DashboardResponse }) {
  const maximum = Math.max(1, ...dashboard.daily.map((day) => day.confirmedRevenueCents));
  return (
    <section aria-label="Weekly revenue chart" className="rounded-xl border border-line bg-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Revenue by day</h3>
          <p className="mt-1 text-xs text-muted">Confirmed value with REVIVE recoveries highlighted.</p>
        </div>
        <span className="flex items-center gap-2 text-[10px] text-muted"><StatusDot />Recovered</span>
      </div>
      <div className="mt-7 grid h-48 grid-cols-5 items-end gap-3 border-b border-line px-1">
        {dashboard.daily.map((day) => {
          const totalHeight = Math.max(2, day.confirmedRevenueCents / maximum * 160);
          const recoveredHeight = Math.min(totalHeight, day.recoveredRevenueCents / maximum * 160);
          return (
            <div className="flex h-full flex-col items-center justify-end gap-2" key={day.date}>
              <div className="relative w-full max-w-14 rounded-t bg-[#e5e9e5]" style={{ height: totalHeight }}>
                {recoveredHeight === 0 ? null : (
                  <span className="absolute inset-x-0 bottom-0 rounded-t bg-revive" style={{ height: recoveredHeight }} />
                )}
              </div>
              <span className="pb-2 font-mono text-[9px] text-muted">{DateTime.fromISO(day.date).toFormat("ccc")}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardPage({ api, anchorDate, refreshKey }: DashboardPageProps) {
  const range = useMemo(() => {
    const start = DateTime.fromISO(anchorDate).startOf("week");
    return { start: start.toISODate()!, end: start.plus({ days: 4 }).toISODate()! };
  }, [anchorDate]);
  const [dashboard, setDashboard] = useState<DashboardResponse>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void api.getDashboard(range.start, range.end).then((result) => {
      if (!active) return;
      setDashboard(result);
      setError(undefined);
    }).catch(() => {
      if (active) setError("Impact metrics could not be refreshed.");
    });
    return () => { active = false; };
  }, [api, range.end, range.start, refreshKey]);

  if (dashboard === undefined) {
    return <div className="p-5 lg:p-8"><div className="h-72 animate-pulse rounded-xl bg-[#edf0ec]" /></div>;
  }

  const { metrics } = dashboard;
  return (
    <section className="mx-auto w-full max-w-[1500px] px-5 py-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.035em]">Impact</h2>
          <p className="mt-1.5 text-sm text-muted">What REVIVE protected this week, calculated from live scheduling state.</p>
        </div>
        <span className="font-mono text-[10px] text-muted">
          {DateTime.fromISO(range.start).toFormat("LLL d")}–{DateTime.fromISO(range.end).toFormat("LLL d")}
        </span>
      </header>
      {error === undefined ? null : <p className="mb-4 rounded-revive bg-amber-soft px-3 py-2 text-sm text-[#7c5b22]">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Revenue from cancelled chairs that REVIVE successfully refilled." label="Revenue recovered" primary value={currency(metrics.recoveredRevenueCents)} />
        <MetricCard detail="Current confirmed appointment value after discounts." label="Confirmed revenue" value={currency(metrics.confirmedRevenueCents)} />
        <MetricCard detail={`${metrics.refillSuccessRate}% terminal refill success rate.`} label="Chairs recovered" value={String(metrics.chairsRecovered)} />
        <MetricCard detail="Booked minutes across available barber hours." label="Chair utilization" value={`${metrics.chairUtilizationRate}%`} />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
        <RevenueChart dashboard={dashboard} />
        <section className="rounded-xl border border-line bg-panel">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-sm font-semibold">Recent recoveries</h3>
            <p className="mt-1 text-xs text-muted">Average fill time {metrics.averageRefillMinutes} min · {metrics.activeRecoveries} active</p>
          </div>
          {dashboard.recentOutcomes.length === 0 ? (
            <EmptyState detail="Accepted refill offers will appear here during the demo." title="No recovered revenue yet" />
          ) : (
            <div className="divide-y divide-line">
              {dashboard.recentOutcomes.map((outcome) => (
                <article className="px-5 py-4" key={outcome.jobId}>
                  <p className="text-sm font-medium">{outcome.customerName}'s {outcome.serviceName} recovered {currency(outcome.revenueCents)}</p>
                  <time className="mt-1.5 block font-mono text-[9px] text-muted">{DateTime.fromISO(outcome.occurredAt).setZone(dashboard.timezone).toFormat("ccc · h:mm a")}</time>
                </article>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 border-t border-line">
            <div className="p-4"><span className="text-[10px] uppercase tracking-wide text-muted">Waitlist</span><strong className="mt-1 block text-xl">{metrics.activeWaitlist}</strong></div>
            <div className="border-l border-line p-4"><span className="text-[10px] uppercase tracking-wide text-muted">Active refills</span><strong className="mt-1 block text-xl">{metrics.activeRecoveries}</strong></div>
          </div>
        </section>
      </div>
    </section>
  );
}
