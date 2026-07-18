export type ContactPreference = "telegram" | "voice";
export type AppointmentStatus = "confirmed" | "cancelled";
export type RefillJobStatus =
  | "pending"
  | "leased"
  | "awaiting_offer"
  | "completed"
  | "exhausted"
  | "failed";
export type OfferStatus =
  | "pending"
  | "delivered"
  | "accepted"
  | "declined"
  | "expired"
  | "delivery_failed";
export type CandidateKind = "move_earlier" | "waitlist" | "past_customer";
export type ProviderName = "telegram" | "elevenlabs" | "backboard" | "worker" | "admin";

export interface TimeRange {
  start: string;
  end: string;
}

export interface Customer {
  id: string;
  name: string;
  telegramChatId?: string;
  phone?: string;
  contactPreference: ContactPreference;
  earlierMoveConsent: boolean;
  flexibleBarberPreference: boolean;
  pastCustomerOptIn: boolean;
  lastOutreachAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Barber {
  id: string;
  name: string;
  serviceIds: string[];
  weeklyHours: Partial<Record<1 | 2 | 3 | 4 | 5 | 6 | 7, TimeRange[]>>;
}

export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
}

export interface AppointmentHistoryEvent {
  type: "booked" | "cancelled" | "rescheduled" | "moved_earlier";
  actor: string;
  consent: "explicit" | "direct_cancellation" | "admin_reset";
  createdAt: string;
  fromStartAt?: string;
  toStartAt?: string;
  offerId?: string;
  note?: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  barberId: string;
  serviceId: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  discountPercent: number;
  version: number;
  history: AppointmentHistoryEvent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WaitlistEntry {
  id: string;
  customerId: string;
  serviceId: string;
  barberId?: string;
  date: string;
  earliestStart: string;
  latestStart: string;
  status: "active" | "offered" | "fulfilled" | "withdrawn";
  createdAt: string;
  updatedAt?: string;
}

export interface TimelineEvent {
  type:
    | "opening_created"
    | "offer_created"
    | "offer_delivered"
    | "offer_declined"
    | "offer_expired"
    | "delivery_failed"
    | "appointment_moved"
    | "opening_filled"
    | "search_exhausted";
  at: string;
  message: string;
  customerId?: string;
  offerId?: string;
}

export interface RefillJob {
  id: string;
  sourceAppointmentId: string;
  barberId: string;
  serviceId: string;
  slotStartAt: string;
  slotEndAt: string;
  status: RefillJobStatus;
  moveDepth: number;
  attemptedCustomerIds: string[];
  currentOfferId?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  retryAt?: string;
  error?: string;
  timeline: TimelineEvent[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RefillCandidate {
  customerId: string;
  kind: CandidateKind;
  channel: ContactPreference;
  appointmentId?: string;
  waitlistEntryId?: string;
}

export interface OutreachOffer {
  id: string;
  jobId: string;
  customerId: string;
  candidateKind: CandidateKind;
  channel: ContactPreference;
  status: OfferStatus;
  proposedStartAt: string;
  proposedEndAt: string;
  originalAppointmentId?: string;
  originalStartAt?: string;
  waitlistEntryId?: string;
  discountPercent: number;
  expiresAt: string;
  providerMessageId?: string;
  deliveryAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingSettings {
  timezone: string;
  refillEnabled: boolean;
  moveEarlierEnabled: boolean;
  moveLimit: number;
  allowAlternateBarbers: boolean;
  waitlistEnabled: boolean;
  pastCustomerOutreachEnabled: boolean;
  maxDiscountPercent: number;
  offerExpirySeconds: number;
}

export interface BackboardThreadMapping {
  id: string;
  customerId: string;
  threadId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessedProviderEvent {
  id: string;
  provider: ProviderName;
  eventId: string;
  processedAt: string;
}

export interface CalendarEvent {
  id: string;
  type: string;
  occurredAt: string;
  aggregateId: string;
  data?: Record<string, unknown>;
}

export interface ActorContext {
  provider: ProviderName;
  customerId?: string;
  providerEventId?: string;
  requestId?: string;
}

export interface AvailabilitySlot {
  barberId: string;
  startAt: string;
  endAt: string;
}
