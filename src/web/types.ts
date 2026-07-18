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

export interface Barber {
  id: string;
  name: string;
  serviceIds: string[];
  weeklyHours: Record<string, Array<{ start: string; end: string }>>;
}

export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
}

export interface TimelineEvent {
  type: string;
  at: string;
  message: string;
  customerId?: string;
  offerId?: string;
}

export interface CalendarAppointment {
  id: string;
  customerId: string;
  customerName: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  status: "confirmed" | "cancelled";
  discountPercent: number;
  version: number;
  history: unknown[];
}

export interface ActiveRefill {
  id: string;
  sourceAppointmentId: string;
  barberId: string;
  barberName: string;
  serviceId: string;
  serviceName: string;
  slotStartAt: string;
  slotEndAt: string;
  status: string;
  moveDepth: number;
  attemptedCustomerIds: string[];
  currentOfferId?: string;
  customerState: string;
  timeline: TimelineEvent[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelHealth {
  mongodb: string;
  telegram: string;
  backboard: string;
  elevenlabs: string;
}

export interface CalendarResponse {
  date: string;
  range?: { start: string; end: string };
  timezone: string;
  generatedAt: string;
  demoDate: string;
  shop: { name: string; location: string };
  businessHours: { start: string; end: string };
  barbers: Barber[];
  services: Service[];
  appointments: CalendarAppointment[];
  activeRefills: ActiveRefill[];
  channelHealth: ChannelHealth;
}

export interface AvailabilitySlot {
  barberId: string;
  barberName: string;
  startAt: string;
  endAt: string;
  localTime: string;
}

export interface AvailabilityResponse {
  date: string;
  timezone: string;
  service: { id: string; name: string; durationMinutes: number };
  slots: AvailabilitySlot[];
}

export interface CustomerSummary {
  id: string;
  name: string;
  contactPreference: "telegram" | "voice";
  identitySummary: string;
  activeWaitlistCount: number;
  nextAppointmentAt?: string;
  nextBarberName?: string;
}

export interface OperatorWaitlistEntry {
  id: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  barberId?: string;
  barberName: string;
  date: string;
  earliestStart: string;
  latestStart: string;
  status: "active" | "paused" | "offered" | "fulfilled" | "withdrawn";
  channel: "telegram" | "voice";
  outreachState: string;
  operatorNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerNote {
  id: string;
  text: string;
  author: "operator";
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  identities: { telegram: string; phone: string };
  preferences: {
    contactPreference: "telegram" | "voice";
    earlierMoveConsent: boolean;
    flexibleBarberPreference: boolean;
    pastCustomerOptIn: boolean;
  };
  appointments: CalendarAppointment[];
  waitlist: OperatorWaitlistEntry[];
  notes: CustomerNote[];
}

export interface ConversationSummary {
  id: string;
  customerId: string;
  customerName: string;
  channel: "telegram" | "voice";
  direction: "inbound" | "outbound";
  state: "active" | "completed" | "failed";
  preview: string;
  updatedAt: string;
  hasException: boolean;
}

export interface ConversationEvent {
  id: string;
  kind: "message" | "transcript" | "action" | "delivery" | "error";
  direction?: "inbound" | "outbound";
  speaker: "customer" | "agent" | "system";
  text: string;
  deliveryState?: "pending" | "delivered" | "failed";
  appointmentId?: string;
  refillJobId?: string;
  offerId?: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ActivityItem {
  id: string;
  type: string;
  occurredAt: string;
  message: string;
  customerId?: string;
  customerName?: string;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  events: ConversationEvent[];
  activity: ActivityItem[];
  context: {
    customer: {
      id: string;
      name: string;
      contactPreference: "telegram" | "voice";
      identitySummary: string;
    };
    appointment?: {
      id?: string;
      barberName: string;
      serviceName: string;
      startAt: string;
      endAt: string;
      status: string;
    };
    automation: {
      state: string;
      offerStatus?: string;
      expiresAt?: string;
      refillStatus?: string;
      moveDepth?: number;
    };
    privateNote?: CustomerNote;
  };
}

export type OperationResult =
  | { type: "committed"; operation: string; message: string; appointmentId?: string; refillJobId?: string }
  | { type: "conflict"; code: "STALE_SLOT" | "STALE_OFFER"; message: string }
  | { type: "error"; code: string; message: string };

export interface AppointmentInput {
  customerId: string;
  barberId: string;
  serviceId: string;
  startAt: string;
}

export interface ReviveApi {
  getCalendar(date: string): Promise<CalendarResponse>;
  getCalendarRange(start: string, end: string): Promise<CalendarResponse>;
  getAvailability(input: {
    date: string;
    serviceId: string;
    barberId?: string;
    includeAlternates?: boolean;
  }, token: string): Promise<AvailabilityResponse>;
  getSettings(): Promise<SchedulingSettings>;
  patchSettings(patch: Partial<SchedulingSettings>, token?: string): Promise<SchedulingSettings>;
  createAdminSession(pin: string): Promise<{ token: string }>;
  resetDemo(token: string): Promise<{ status: string; demoDate: string }>;
  getCustomers(query: string, token: string): Promise<CustomerSummary[]>;
  getCustomer(id: string, token: string): Promise<CustomerDetail>;
  patchCustomer(id: string, patch: Partial<CustomerDetail["preferences"]>, token: string): Promise<CustomerDetail>;
  addCustomerNote(id: string, text: string, token: string): Promise<CustomerNote>;
  getConversations(token: string): Promise<ConversationSummary[]>;
  getConversation(id: string, token: string): Promise<ConversationDetail>;
  getWaitlist(token: string): Promise<OperatorWaitlistEntry[]>;
  patchWaitlist(
    id: string,
    patch: { status?: "active" | "paused" | "withdrawn"; operatorNote?: string | null },
    token: string,
  ): Promise<OperatorWaitlistEntry>;
  getActivity(token: string): Promise<ActivityItem[]>;
  bookAppointment(input: AppointmentInput, token: string): Promise<OperationResult>;
  rescheduleAppointment(
    id: string,
    input: { barberId: string; startAt: string },
    token: string,
  ): Promise<OperationResult>;
  cancelAppointment(id: string, token: string): Promise<OperationResult>;
}

export interface EventSourceLike {
  addEventListener(type: string, listener: () => void): void;
  close(): void;
}
