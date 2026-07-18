import type { ReviveState } from "../domain/store.js";
import type { Appointment, CalendarEvent, ConversationEvent, WaitlistEntry } from "../domain/types.js";

function customerName(state: ReviveState, customerId: string): string {
  return state.customers.find((customer) => customer.id === customerId)?.name ?? "Unknown customer";
}

function barberName(state: ReviveState, barberId: string | undefined): string {
  if (barberId === undefined) return "Any barber";
  return state.barbers.find((barber) => barber.id === barberId)?.name ?? "Unknown barber";
}

function serviceName(state: ReviveState, serviceId: string): string {
  return state.services.find((service) => service.id === serviceId)?.name ?? "Unknown service";
}

function maskPhone(phone: string | undefined): string {
  if (phone === undefined) return "Not linked";
  const lastFour = phone.replace(/\D/g, "").slice(-4);
  return `••• ••• ${lastFour}`;
}

function projectAppointment(state: ReviveState, appointment: Appointment) {
  return {
    id: appointment.id,
    customerId: appointment.customerId,
    customerName: customerName(state, appointment.customerId),
    barberId: appointment.barberId,
    barberName: barberName(state, appointment.barberId),
    serviceId: appointment.serviceId,
    serviceName: serviceName(state, appointment.serviceId),
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    discountPercent: appointment.discountPercent,
    version: appointment.version,
    history: appointment.history.map((event) => ({
      type: event.type,
      actor: event.actor,
      consent: event.consent,
      createdAt: event.createdAt,
      ...(event.fromStartAt === undefined ? {} : { fromStartAt: event.fromStartAt }),
      ...(event.toStartAt === undefined ? {} : { toStartAt: event.toStartAt }),
      ...(event.note === undefined ? {} : { note: event.note }),
    })),
  };
}

function projectWaitlistEntry(state: ReviveState, entry: WaitlistEntry) {
  const customer = state.customers.find((candidate) => candidate.id === entry.customerId);
  const offer = state.offers
    .filter((candidate) => candidate.waitlistEntryId === entry.id)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  return {
    id: entry.id,
    customerId: entry.customerId,
    customerName: customer?.name ?? "Unknown customer",
    serviceId: entry.serviceId,
    serviceName: serviceName(state, entry.serviceId),
    ...(entry.barberId === undefined ? {} : { barberId: entry.barberId }),
    barberName: barberName(state, entry.barberId),
    date: entry.date,
    earliestStart: entry.earliestStart,
    latestStart: entry.latestStart,
    status: entry.status,
    channel: customer?.contactPreference ?? "telegram",
    outreachState: offer?.status ?? (entry.status === "paused" ? "paused" : "not_contacted"),
    ...(entry.operatorNote === undefined ? {} : { operatorNote: entry.operatorNote }),
    createdAt: entry.createdAt,
    ...(entry.updatedAt === undefined ? {} : { updatedAt: entry.updatedAt }),
  };
}

export function projectCustomerList(state: ReviveState, query = "") {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return state.customers
    .filter((customer) => customer.name.toLocaleLowerCase().includes(normalizedQuery))
    .map((customer) => {
      const nextAppointment = state.appointments
        .filter((appointment) => appointment.customerId === customer.id && appointment.status === "confirmed")
        .sort((left, right) => left.startAt.localeCompare(right.startAt))[0];
      const linkedPreferredChannel = customer.contactPreference === "telegram"
        ? customer.telegramChatId !== undefined
        : customer.phone !== undefined;
      return {
        id: customer.id,
        name: customer.name,
        contactPreference: customer.contactPreference,
        identitySummary: linkedPreferredChannel
          ? customer.contactPreference === "telegram" ? "Telegram linked" : "Phone linked"
          : "No linked channel",
        activeWaitlistCount: state.waitlist.filter((entry) => (
          entry.customerId === customer.id && ["active", "paused", "offered"].includes(entry.status)
        )).length,
        ...(nextAppointment === undefined ? {} : {
          nextAppointmentAt: nextAppointment.startAt,
          nextBarberName: barberName(state, nextAppointment.barberId),
        }),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function projectCustomerDetail(state: ReviveState, customerId: string) {
  const customer = state.customers.find((candidate) => candidate.id === customerId);
  if (customer === undefined) return undefined;
  return {
    id: customer.id,
    name: customer.name,
    identities: {
      telegram: customer.telegramChatId === undefined ? "Not linked" : "Linked account",
      phone: maskPhone(customer.phone),
    },
    preferences: {
      contactPreference: customer.contactPreference,
      earlierMoveConsent: customer.earlierMoveConsent,
      flexibleBarberPreference: customer.flexibleBarberPreference,
      pastCustomerOptIn: customer.pastCustomerOptIn,
    },
    appointments: state.appointments
      .filter((appointment) => appointment.customerId === customer.id)
      .map((appointment) => projectAppointment(state, appointment))
      .sort((left, right) => right.startAt.localeCompare(left.startAt)),
    waitlist: state.waitlist
      .filter((entry) => entry.customerId === customer.id)
      .map((entry) => projectWaitlistEntry(state, entry))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    notes: state.customerNotes
      .filter((note) => note.customerId === customer.id)
      .map((note) => ({
        id: note.id,
        text: note.text,
        author: note.author,
        createdAt: note.createdAt,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

export function projectConversationList(state: ReviveState) {
  return state.conversations
    .map((conversation) => ({
      id: conversation.id,
      customerId: conversation.customerId,
      customerName: customerName(state, conversation.customerId),
      channel: conversation.channel,
      direction: conversation.direction,
      state: conversation.state,
      preview: conversation.preview,
      updatedAt: conversation.updatedAt,
      hasException: conversation.state === "failed" || state.conversationEvents.some((event) => (
        event.conversationId === conversation.id && event.kind === "error"
      )),
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function projectConversationEvent(event: ConversationEvent) {
  return {
    id: event.id,
    kind: event.kind,
    ...(event.direction === undefined ? {} : { direction: event.direction }),
    speaker: event.speaker,
    text: event.text,
    ...(event.deliveryState === undefined ? {} : { deliveryState: event.deliveryState }),
    ...(event.appointmentId === undefined ? {} : { appointmentId: event.appointmentId }),
    ...(event.refillJobId === undefined ? {} : { refillJobId: event.refillJobId }),
    ...(event.offerId === undefined ? {} : { offerId: event.offerId }),
    occurredAt: event.occurredAt,
    ...(event.metadata === undefined ? {} : { metadata: { ...event.metadata } }),
  };
}

function eventCustomerId(state: ReviveState, event: CalendarEvent): string | undefined {
  const direct = event.data?.customerId;
  if (typeof direct === "string") return direct;
  const appointment = state.appointments.find((candidate) => candidate.id === event.aggregateId);
  if (appointment !== undefined) return appointment.customerId;
  const offer = state.offers.find((candidate) => candidate.id === event.aggregateId);
  return offer?.customerId;
}

function eventMessage(state: ReviveState, event: CalendarEvent): string {
  const appointment = state.appointments.find((candidate) => candidate.id === event.aggregateId);
  const offer = state.offers.find((candidate) => candidate.id === event.aggregateId);
  const name = eventCustomerId(state, event) === undefined
    ? "the customer"
    : customerName(state, eventCustomerId(state, event)!);
  switch (event.type) {
    case "appointment.booked": return `${name}'s appointment was booked.`;
    case "appointment.cancelled": return `${name}'s appointment was cancelled; REVIVE opened refill work.`;
    case "appointment.rescheduled": return `${name}'s appointment was rescheduled.`;
    case "appointment.moved_earlier": return `${name} accepted an earlier appointment.`;
    case "offer.created": return `REVIVE prepared an appointment offer for ${name}.`;
    case "offer.delivered": {
      const channel = offer?.channel ?? event.data?.channel;
      return `REVIVE delivered an appointment offer to ${name} via ${channel === "telegram" ? "Telegram" : "voice"}.`;
    }
    case "offer.declined": return `${name} declined the appointment offer.`;
    case "offer.expired": return `${name}'s appointment offer expired.`;
    case "settings.updated": return "Automation settings were updated.";
    case "demo.reset": return "The demo week was reset.";
    case "customer.updated": return `${name}'s preferences were updated.`;
    case "customer.note_added": return `A private note was added for ${name}.`;
    case "waitlist.updated": return `${name}'s waitlist entry was updated.`;
    default: return appointment === undefined ? "REVIVE updated scheduling state." : `${name}'s appointment was updated.`;
  }
}

export function projectActivity(state: ReviveState) {
  return state.events
    .map((event) => ({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      message: eventMessage(state, event),
      ...(eventCustomerId(state, event) === undefined ? {} : {
        customerId: eventCustomerId(state, event),
        customerName: customerName(state, eventCustomerId(state, event)!),
      }),
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function projectConversationDetail(state: ReviveState, conversationId: string) {
  const conversation = state.conversations.find((candidate) => candidate.id === conversationId);
  if (conversation === undefined) return undefined;
  const summary = projectConversationList(state).find((candidate) => candidate.id === conversation.id)!;
  const offer = conversation.offerId === undefined
    ? undefined
    : state.offers.find((candidate) => candidate.id === conversation.offerId);
  const refill = offer === undefined
    ? undefined
    : state.refillJobs.find((candidate) => candidate.id === offer.jobId);
  const linkedAppointment = conversation.appointmentId === undefined
    ? undefined
    : state.appointments.find((candidate) => candidate.id === conversation.appointmentId);
  const contextAppointment = offer !== undefined && refill !== undefined
    ? {
        barberName: barberName(state, refill.barberId),
        serviceName: serviceName(state, refill.serviceId),
        startAt: offer.proposedStartAt,
        endAt: offer.proposedEndAt,
        status: offer.status,
      }
    : linkedAppointment === undefined
      ? undefined
      : projectAppointment(state, linkedAppointment);
  const customer = state.customers.find((candidate) => candidate.id === conversation.customerId)!;
  const latestNote = state.customerNotes
    .filter((note) => note.customerId === customer.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const automationState = refill?.status === "awaiting_offer"
    ? `Waiting for ${customer.name}`
    : refill?.status === "pending"
      ? "Finding a match"
      : refill?.status === "completed"
        ? "Opening filled"
        : conversation.state === "failed"
          ? "Needs review"
          : "Monitoring";
  return {
    conversation: summary,
    events: state.conversationEvents
      .filter((event) => event.conversationId === conversation.id)
      .map(projectConversationEvent)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)),
    activity: projectActivity(state).filter((event) => event.customerId === customer.id),
    context: {
      customer: {
        id: customer.id,
        name: customer.name,
        contactPreference: customer.contactPreference,
        identitySummary: customer.contactPreference === "telegram"
          ? customer.telegramChatId === undefined ? "Telegram not linked" : "Telegram linked"
          : maskPhone(customer.phone),
      },
      ...(contextAppointment === undefined ? {} : { appointment: contextAppointment }),
      automation: {
        state: automationState,
        ...(offer === undefined ? {} : { offerStatus: offer.status, expiresAt: offer.expiresAt }),
        ...(refill === undefined ? {} : { refillStatus: refill.status, moveDepth: refill.moveDepth }),
      },
      ...(latestNote === undefined ? {} : {
        privateNote: { id: latestNote.id, text: latestNote.text, createdAt: latestNote.createdAt },
      }),
    },
  };
}

export function projectWaitlist(state: ReviveState) {
  return state.waitlist
    .map((entry) => projectWaitlistEntry(state, entry))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export { projectAppointment };
