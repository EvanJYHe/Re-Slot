# Customer AI Pool Design

## Goal

Turn the Customers page from a collection of raw records into a clear demo of the scheduling intelligence REVIVE can use. Staff should immediately understand who is already booked, who is actively waiting for a specific opening, who is available for future outreach, and why a recurring customer is a credible match.

## Relationship model

- A customer is the durable CRM record. One customer may have many past and future appointments and may submit multiple waitlist requests over time.
- An appointment is an actual reservation with a service, barber, start time, and status. A future confirmed appointment makes the customer `booked`.
- A waitlist entry is an explicit request for a service and time window that could not yet be booked. An active, paused, or offered entry makes an otherwise unbooked customer `waitlisted`.
- A customer with neither a future confirmed appointment nor an active waitlist request is `outreach_ready` when past-customer outreach is enabled, and otherwise `not_eligible`.
- Past confirmed appointments supply relationship history: last visit, visit count, usual service, and usual barber. These are derived rather than copied onto the customer record, preventing CRM values from drifting away from scheduling truth.

State precedence is `booked`, then `waitlisted`, then `outreach_ready`, then `not_eligible`. Customers may have historical or fulfilled waitlist records without being classified as actively waitlisted.

## Projection contract

The customer-list projection will expose a compact, safe CRM summary:

- `bookingState`
- `bookingStateLabel`
- `nextAppointmentAt`, `nextBarberName`, and `nextServiceName`
- `activeWaitlistCount` and `waitlistRequestSummary`
- `lastVisitAt`, `visitCount`, `usualServiceName`, and `usualBarberName`
- `outreachEligible`
- `matchReason`, a deterministic plain-language explanation assembled from the same data

The detail projection will add a `relationship` object with the same derived facts. No phone number, Telegram identifier, provider identifier, or agent-only state will be exposed.

## Seed narrative

The seed will deliberately contain more customers than customers with upcoming appointments. The dense 75% calendar stays intact, but reservations reuse a bounded group of active customers. Other customers represent:

- active waitlist demand with a precise service/time preference;
- returning regulars with several historical visits and no current booking;
- lapsed regulars eligible for targeted vacancy outreach;
- customers who are known but have not opted into automated outreach.

Historical appointments will live before the demo week and avoid all current calendar slots. They will use realistic repeat intervals, services, and barber affinities so the UI can tell a coherent barbershop story.

## UI design

The page heading becomes “Customer intelligence” and explains that REVIVE ranks real demand and recurring relationships when openings appear.

A four-part funnel across the top shows:

1. all CRM customers;
2. customers with an upcoming booking;
3. customers actively waiting for a better-fit opening;
4. unbooked customers eligible for outreach.

The left customer pool supports filters for all, booked, waitlisted, and outreach-ready customers. Every row shows one unambiguous state badge plus the most relevant scheduling fact. The detail header adds a relationship summary with the current state, next reservation or requested window, last visit, visit count, usual service/barber, channel, and deterministic match rationale.

Appointments, waitlist entries, preferences, and notes remain available below as supporting evidence. The established restrained green, warm neutral, border, typography, and density system is retained.

## Boundaries

- Do not change candidate ranking, refill automation, conversation context, providers, or agent prompts.
- Do not persist denormalized booking-state or relationship-summary fields.
- Do not expose raw customer identifiers.
- Preserve existing calendar density and the seeded conversation showcase.
- Keep the UI read-only for the new intelligence summary; existing preference and note controls remain unchanged.

## Verification

- Projection tests prove state precedence, future-versus-past appointment handling, recurring history, and safe match reasons.
- Seed tests prove total customers exceed distinct upcoming-booked customers and include booked, waitlisted-only, outreach-ready, and ineligible records.
- Customer-page tests prove funnel counts, filters, state labels, relationship facts, and existing preference/note interactions.
- Typecheck and production build must pass.

