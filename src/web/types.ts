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

export interface ReviveApi {
  getCalendar(date: string): Promise<CalendarResponse>;
  getSettings(): Promise<SchedulingSettings>;
  patchSettings(patch: Partial<SchedulingSettings>): Promise<SchedulingSettings>;
  createAdminSession(pin: string): Promise<{ token: string }>;
  resetDemo(token: string): Promise<{ status: string; demoDate: string }>;
}

export interface EventSourceLike {
  addEventListener(type: string, listener: () => void): void;
  close(): void;
}
