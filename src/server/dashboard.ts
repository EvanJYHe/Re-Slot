import { DateTime } from "luxon";

import type { ReviveState } from "../domain/store.js";

export interface DashboardProjection {
  range: { start: string; end: string };
  timezone: string;
  metrics: {
    recoveredRevenueCents: number;
    confirmedRevenueCents: number;
    chairsRecovered: number;
    refillSuccessRate: number;
    averageRefillMinutes: number;
    chairUtilizationRate: number;
    activeWaitlist: number;
    activeRecoveries: number;
  };
  daily: Array<{
    date: string;
    confirmedRevenueCents: number;
    recoveredRevenueCents: number;
  }>;
  recentOutcomes: Array<{
    jobId: string;
    customerName: string;
    serviceName: string;
    occurredAt: string;
    revenueCents: number;
  }>;
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

function discountedCents(priceCents: number, discountPercent: number): number {
  return Math.round(priceCents * (100 - discountPercent) / 100);
}

function minutesBetween(start: string, end: string): number {
  return Math.max(0, DateTime.fromISO(end).diff(DateTime.fromISO(start), "minutes").minutes);
}

function datesBetween(start: string, end: string, timezone: string): string[] {
  const dates: string[] = [];
  let cursor = DateTime.fromISO(start, { zone: timezone }).startOf("day");
  const final = DateTime.fromISO(end, { zone: timezone }).startOf("day");
  while (cursor <= final) {
    dates.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}

export function projectDashboard(
  state: ReviveState,
  range: { start: string; end: string },
): DashboardProjection {
  const timezone = state.settings.timezone;
  const dates = datesBetween(range.start, range.end, timezone);
  const includedDates = new Set(dates);
  const localDate = (iso: string) => DateTime.fromISO(iso).setZone(timezone).toISODate();
  const services = new Map(state.services.map((service) => [service.id, service]));
  const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
  const appointments = state.appointments.filter((appointment) => (
    appointment.status === "confirmed" && includedDates.has(localDate(appointment.startAt) ?? "")
  ));

  const appointmentRevenue = (appointment: (typeof state.appointments)[number]) => {
    const service = services.get(appointment.serviceId);
    return service === undefined ? 0 : discountedCents(service.priceCents, appointment.discountPercent);
  };

  const rangeJobs = state.refillJobs.filter((job) => includedDates.has(localDate(job.slotStartAt) ?? ""));
  const filledJobs = rangeJobs.flatMap((job) => {
    const fill = job.timeline.find((event) => event.type === "opening_filled");
    if (job.status !== "completed" || fill?.offerId === undefined) return [];
    const offer = state.offers.find((candidate) => candidate.id === fill.offerId && candidate.status === "accepted");
    const service = services.get(job.serviceId);
    if (offer === undefined || service === undefined) return [];
    return [{
      job,
      offer,
      revenueCents: discountedCents(service.priceCents, offer.discountPercent),
      serviceName: service.name,
      customerName: customers.get(offer.customerId)?.name ?? "Customer",
    }];
  });

  const terminalJobs = rangeJobs.filter((job) => ["completed", "exhausted", "failed"].includes(job.status));
  const completedMinutes = filledJobs.map(({ job }) => minutesBetween(job.createdAt, job.updatedAt));
  const availableMinutes = dates.reduce((total, date) => {
    const weekday = DateTime.fromISO(date, { zone: timezone }).weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    return total + state.barbers.reduce((barberTotal, barber) => (
      barberTotal + (barber.weeklyHours[weekday] ?? []).reduce((hoursTotal, hours) => {
        const [startHour = 0, startMinute = 0] = hours.start.split(":").map(Number);
        const [endHour = 0, endMinute = 0] = hours.end.split(":").map(Number);
        return hoursTotal + (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
      }, 0)
    ), 0);
  }, 0);
  const bookedMinutes = appointments.reduce(
    (total, appointment) => total + minutesBetween(appointment.startAt, appointment.endAt),
    0,
  );

  const daily = dates.map((date) => ({
    date,
    confirmedRevenueCents: appointments
      .filter((appointment) => localDate(appointment.startAt) === date)
      .reduce((total, appointment) => total + appointmentRevenue(appointment), 0),
    recoveredRevenueCents: filledJobs
      .filter(({ job }) => localDate(job.slotStartAt) === date)
      .reduce((total, outcome) => total + outcome.revenueCents, 0),
  }));

  return {
    range,
    timezone,
    metrics: {
      recoveredRevenueCents: filledJobs.reduce((total, outcome) => total + outcome.revenueCents, 0),
      confirmedRevenueCents: appointments.reduce((total, appointment) => total + appointmentRevenue(appointment), 0),
      chairsRecovered: filledJobs.length,
      refillSuccessRate: percent(filledJobs.length, terminalJobs.length),
      averageRefillMinutes: completedMinutes.length === 0
        ? 0
        : Math.round(completedMinutes.reduce((total, minutes) => total + minutes, 0) / completedMinutes.length),
      chairUtilizationRate: percent(bookedMinutes, availableMinutes),
      activeWaitlist: state.waitlist.filter((entry) => (
        includedDates.has(entry.date) && ["active", "offered"].includes(entry.status)
      )).length,
      activeRecoveries: rangeJobs.filter((job) => ["pending", "leased", "awaiting_offer"].includes(job.status)).length,
    },
    daily,
    recentOutcomes: filledJobs
      .map(({ job, customerName, serviceName, revenueCents }) => ({
        jobId: job.id,
        customerName,
        serviceName,
        occurredAt: job.updatedAt,
        revenueCents,
      }))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 5),
  };
}
