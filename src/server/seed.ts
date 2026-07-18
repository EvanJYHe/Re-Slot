import { DateTime } from "luxon";

import type { ReviveState } from "../domain/store.js";
import type {
  Appointment,
  AppointmentHistoryEvent,
  Barber,
  Customer,
  SchedulingSettings,
  Service,
} from "../domain/types.js";

interface PreservedIdentities {
  joshTelegramChatId?: string;
  alexTelegramChatId?: string;
  sarahPhone?: string;
}

interface CreateDemoStateOptions {
  now: string;
  timezone: string;
  preservedIdentities?: PreservedIdentities;
}

export function getDemoDate(now: string, timezone: string): string {
  let date = DateTime.fromISO(now).setZone(timezone).startOf("day");
  if (!date.isValid) throw new Error("Cannot seed REVIVE from an invalid date.");
  while (date.weekday > 5) date = date.plus({ days: 1 });
  return date.toISODate()!;
}

function at(date: string, hour: number, minute: number, timezone: string): string {
  return DateTime.fromObject(
    {
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
      hour,
      minute,
    },
    { zone: timezone },
  ).toUTC().toISO()!;
}

function standardHours(): Barber["weeklyHours"] {
  return {
    1: [{ start: "10:00", end: "20:00" }],
    2: [{ start: "10:00", end: "20:00" }],
    3: [{ start: "10:00", end: "20:00" }],
    4: [{ start: "10:00", end: "20:00" }],
    5: [{ start: "10:00", end: "20:00" }],
  };
}

function seededAppointment(
  id: string,
  customerId: string,
  barberId: string,
  service: Service,
  startAt: string,
  now: string,
  status: Appointment["status"] = "confirmed",
): Appointment {
  const history: AppointmentHistoryEvent = {
    type: status === "confirmed" ? "booked" : "cancelled",
    actor: "demo-reset",
    consent: "admin_reset",
    createdAt: now,
    ...(status === "confirmed" ? { toStartAt: startAt } : { fromStartAt: startAt }),
  };
  return {
    id,
    customerId,
    barberId,
    serviceId: service.id,
    startAt,
    endAt: DateTime.fromISO(startAt).plus({ minutes: service.durationMinutes }).toUTC().toISO()!,
    status,
    discountPercent: 0,
    version: 1,
    history: [history],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDemoState(options: CreateDemoStateOptions): ReviveState {
  const demoDate = getDemoDate(options.now, options.timezone);
  const operationalDate = (offsetDays: number): string => DateTime
    .fromISO(demoDate, { zone: options.timezone })
    .plus({ days: offsetDays })
    .toISODate()!;
  const identities = options.preservedIdentities ?? {};
  const haircut: Service = {
    id: "haircut",
    name: "Signature haircut",
    durationMinutes: 60,
    priceCents: 4500,
  };
  const fade: Service = {
    id: "fade",
    name: "Skin fade",
    durationMinutes: 60,
    priceCents: 5200,
  };
  const beard: Service = {
    id: "beard",
    name: "Beard sculpt",
    durationMinutes: 30,
    priceCents: 2800,
  };
  const services = [haircut, fade, beard];
  const barbers: Barber[] = [
    {
      id: "jeremy",
      name: "Jeremy",
      serviceIds: services.map((service) => service.id),
      weeklyHours: standardHours(),
    },
    {
      id: "maya",
      name: "Maya",
      serviceIds: [haircut.id, fade.id],
      weeklyHours: standardHours(),
    },
    {
      id: "devon",
      name: "Devon",
      serviceIds: [haircut.id, beard.id],
      weeklyHours: standardHours(),
    },
  ];
  const customers: Customer[] = [
    {
      id: "josh",
      name: "Josh",
      ...(identities.joshTelegramChatId === undefined ? {} : {
        telegramChatId: identities.joshTelegramChatId,
      }),
      contactPreference: "telegram",
      earlierMoveConsent: false,
      flexibleBarberPreference: false,
      pastCustomerOptIn: false,
    },
    {
      id: "sarah",
      name: "Sarah",
      ...(identities.sarahPhone === undefined || identities.sarahPhone === "" ? {} : {
        phone: identities.sarahPhone,
      }),
      contactPreference: "voice",
      earlierMoveConsent: true,
      flexibleBarberPreference: false,
      pastCustomerOptIn: true,
    },
    {
      id: "alex",
      name: "Alex",
      ...(identities.alexTelegramChatId === undefined ? {} : {
        telegramChatId: identities.alexTelegramChatId,
      }),
      contactPreference: "telegram",
      earlierMoveConsent: false,
      flexibleBarberPreference: false,
      pastCustomerOptIn: false,
    },
    {
      id: "nadia",
      name: "Nadia",
      contactPreference: "telegram",
      earlierMoveConsent: false,
      flexibleBarberPreference: true,
      pastCustomerOptIn: true,
    },
    {
      id: "marco",
      name: "Marco",
      contactPreference: "voice",
      earlierMoveConsent: false,
      flexibleBarberPreference: true,
      pastCustomerOptIn: true,
    },
    {
      id: "eli",
      name: "Eli",
      contactPreference: "telegram",
      earlierMoveConsent: false,
      flexibleBarberPreference: false,
      pastCustomerOptIn: false,
    },
    {
      id: "imani",
      name: "Imani",
      contactPreference: "telegram",
      earlierMoveConsent: true,
      flexibleBarberPreference: true,
      pastCustomerOptIn: false,
    },
  ];
  const appointments: Appointment[] = [
    seededAppointment("josh-appt", "josh", "jeremy", haircut, at(demoDate, 17, 0, options.timezone), options.now),
    seededAppointment("sarah-appt", "sarah", "jeremy", haircut, at(demoDate, 18, 0, options.timezone), options.now),
    seededAppointment("nadia-appt", "nadia", "maya", fade, at(demoDate, 13, 0, options.timezone), options.now),
    seededAppointment("eli-appt", "eli", "devon", beard, at(demoDate, 15, 0, options.timezone), options.now),
    seededAppointment("imani-appt", "imani", "maya", haircut, at(demoDate, 17, 0, options.timezone), options.now),
    seededAppointment("tue-marco", "marco", "jeremy", beard, at(operationalDate(1), 11, 0, options.timezone), options.now),
    seededAppointment("tue-nadia", "nadia", "maya", haircut, at(operationalDate(1), 10, 0, options.timezone), options.now),
    seededAppointment("tue-imani", "imani", "maya", fade, at(operationalDate(1), 14, 0, options.timezone), options.now),
    seededAppointment("tue-eli", "eli", "devon", haircut, at(operationalDate(1), 12, 0, options.timezone), options.now),
    seededAppointment("tue-josh", "josh", "devon", beard, at(operationalDate(1), 17, 0, options.timezone), options.now),
    seededAppointment("wed-nadia", "nadia", "jeremy", fade, at(operationalDate(2), 10, 0, options.timezone), options.now),
    seededAppointment("wed-marco", "marco", "jeremy", haircut, at(operationalDate(2), 14, 0, options.timezone), options.now),
    seededAppointment("wed-sarah", "sarah", "maya", fade, at(operationalDate(2), 11, 0, options.timezone), options.now),
    seededAppointment("wed-imani", "imani", "devon", haircut, at(operationalDate(2), 16, 0, options.timezone), options.now),
    seededAppointment("thu-eli", "eli", "jeremy", beard, at(operationalDate(3), 10, 0, options.timezone), options.now),
    seededAppointment("thu-josh", "josh", "jeremy", haircut, at(operationalDate(3), 13, 0, options.timezone), options.now),
    seededAppointment("thu-imani", "imani", "maya", haircut, at(operationalDate(3), 15, 0, options.timezone), options.now),
    seededAppointment("thu-marco", "marco", "devon", beard, at(operationalDate(3), 17, 0, options.timezone), options.now),
    seededAppointment("fri-nadia", "nadia", "jeremy", haircut, at(operationalDate(4), 11, 0, options.timezone), options.now),
    seededAppointment("fri-marco", "marco", "maya", fade, at(operationalDate(4), 14, 0, options.timezone), options.now),
    seededAppointment("fri-eli", "eli", "devon", haircut, at(operationalDate(4), 10, 0, options.timezone), options.now),
    seededAppointment("fri-sarah", "sarah", "devon", beard, at(operationalDate(4), 16, 0, options.timezone), options.now),
    seededAppointment(
      "marco-history",
      "marco",
      "jeremy",
      haircut,
      at(DateTime.fromISO(demoDate).minus({ days: 21 }).toISODate()!, 14, 0, options.timezone),
      options.now,
      "cancelled",
    ),
  ];
  const settings: SchedulingSettings = {
    timezone: options.timezone,
    refillEnabled: true,
    moveEarlierEnabled: true,
    moveLimit: 3,
    allowAlternateBarbers: true,
    waitlistEnabled: true,
    pastCustomerOutreachEnabled: true,
    maxDiscountPercent: 15,
    offerExpirySeconds: 120,
  };

  return {
    customers,
    barbers,
    services,
    appointments,
    waitlist: [
      {
        id: "alex-waitlist",
        customerId: "alex",
        serviceId: haircut.id,
        barberId: "jeremy",
        date: demoDate,
        earliestStart: "17:00",
        latestStart: "19:00",
        status: "active",
        createdAt: DateTime.fromISO(options.now).minus({ hours: 1 }).toUTC().toISO()!,
        updatedAt: options.now,
      },
      {
        id: "nadia-waitlist",
        customerId: "nadia",
        serviceId: fade.id,
        date: operationalDate(1),
        earliestStart: "16:00",
        latestStart: "18:00",
        status: "active",
        createdAt: DateTime.fromISO(options.now).minus({ minutes: 42 }).toUTC().toISO()!,
        updatedAt: options.now,
      },
      {
        id: "marco-waitlist",
        customerId: "marco",
        serviceId: beard.id,
        barberId: "devon",
        date: operationalDate(3),
        earliestStart: "11:00",
        latestStart: "15:00",
        status: "active",
        operatorNote: "Afternoons are easiest; a short-notice call is okay.",
        createdAt: DateTime.fromISO(options.now).minus({ minutes: 18 }).toUTC().toISO()!,
        updatedAt: options.now,
      },
    ],
    refillJobs: [],
    offers: [],
    processedEvents: [],
    backboardThreads: [],
    conversations: [],
    conversationEvents: [],
    customerNotes: [
      {
        id: "sarah-note",
        customerId: "sarah",
        text: "Prefers a phone call for same-day appointment changes.",
        author: "operator",
        createdAt: DateTime.fromISO(options.now).minus({ days: 2 }).toUTC().toISO()!,
      },
      {
        id: "nadia-note",
        customerId: "nadia",
        text: "Comfortable with any qualified barber.",
        author: "operator",
        createdAt: DateTime.fromISO(options.now).minus({ days: 1 }).toUTC().toISO()!,
      },
    ],
    events: [{
      id: "demo-reset-event",
      type: "demo.reset",
      aggregateId: demoDate,
      occurredAt: options.now,
      data: { demoDate },
    }],
    settings,
  };
}
