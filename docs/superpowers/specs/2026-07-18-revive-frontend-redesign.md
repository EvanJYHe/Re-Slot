# REVIVE front-desk workspace redesign

**Status:** Approved visual direction; awaiting written-spec review  
**Audience:** A front-desk owner supervising REVIVE  
**Reference:** Visual companion session `64389-1784414982`, locked three-column Agent workspace

## Objective

Replace the current decorative chair board with a calm, familiar front-desk workspace that makes REVIVE's backend work understandable. The interface must let an owner schedule customers, watch real Telegram and voice interactions, inspect waitlist decisions, and intervene when necessary without turning REVIVE into a broad salon-management product.

The scheduling engine, MongoDB store, refill worker, Telegram integration, Backboard integration, ElevenLabs integration, and Railway deployment remain the product's core. This project rewrites the web application and adds the smallest server interfaces needed by the new views. It does not rewrite the deterministic scheduling engine.

## Product principles

1. **Calendar first.** The schedule is the default page and the primary source of truth.
2. **Ordinary interface, exceptional backend.** The UI should feel as immediately legible as Calendly or LettuceMeet rather than advertise its visual style.
3. **Real activity only.** Telegram messages, voice transcripts, delivery states, and scheduling actions must come from persisted provider and domain events. No simulated chat panels.
4. **Autonomous by default, interruptible by exception.** REVIVE continues work without approval unless a deterministic rule requires consent or an operator pauses it.
5. **Progressive disclosure.** Each page shows only the information needed for its job; detailed records open on selection.
6. **No duplicate state.** SSE signals a change and the client refetches authoritative API state. Scheduling mutations always pass through the domain engine.
7. **Tailwind first.** Layout, spacing, typography, responsive behavior, and interaction states are composed with Tailwind utilities. Custom CSS is reserved for global tokens, font setup, and calendar geometry that depends on runtime values.

## Information architecture

The application has four persistent top-level destinations:

- **Calendar:** day, week, and month schedule views; barber filter; manual appointment operations.
- **Agent:** real conversations, open waitlist, and a plain-language action ledger.
- **Customers:** lightweight customer records, contact identity, consent, appointments, waitlist state, and private notes.
- **Settings:** scheduling automation policies, provider connection status, and demo reset.

The global shell contains only the REVIVE wordmark, these four destinations, and a compact live-connection indicator. Page-specific controls stay inside their page. There is no marketing masthead, dashboard introduction, persistent legend, footer, analytics summary, or global command centre.

## Visual direction

- Near-white canvas, charcoal text, muted green for healthy/committed state, and pale amber only for an opening or exception in progress.
- Instrument Sans for interface typography and IBM Plex Mono only for timestamps or provider metadata.
- Thin neutral dividers, restrained eight-pixel radii, minimal shadows, and generous whitespace.
- No gradients, paper textures, oversized display type, ornamental numbering, editorial copy, or decorative status widgets.
- Desktop-first at the hackathon demo resolution, with usable tablet fallback. Mobile optimization is not part of this rewrite.
- Transitions are limited to panel selection, drawer entry, and live state changes. Motion must never compete with the demo.

### Styling architecture

- Tailwind CSS 3.4 is the primary styling system for the rewrite. The React markup should use utilities directly and extract small reusable components only where the same interface pattern recurs.
- `tailwind.config.cjs` defines the REVIVE palette, fonts, radii, shadows, and shared sizing tokens so visual decisions stay consistent without creating a second class system.
- `src/web/styles.css` is reduced to Tailwind directives, font declarations, root variables, minimal browser normalization, and the few calendar-positioning primitives that need runtime CSS custom properties.
- The existing large semantic stylesheet and one-off decorative classes are removed as their screens are replaced. No component library or parallel CSS-in-JS layer is introduced.
- A tiny local class-name helper may be used for conditional Tailwind states; it must not become a styling abstraction of its own.

## Calendar

### Header and controls

The Calendar page opens by default in **Day / All barbers**. Its compact toolbar contains:

- previous and next period controls;
- a date label and Today action;
- Day, Week, and Month segmented views;
- barber chips: All, Jeremy, Maya, and Devon;
- one `New appointment` button.

The barber chips are filters, not navigation. The chosen filter persists while switching calendar views.

### Views

- **Day:** All shows one time-aligned column per barber. Selecting a barber expands that barber into one full-width column.
- **Week:** Each day is a column. With All selected, appointments are stacked and labelled by barber; selecting a barber removes those labels and shows only that barber's work.
- **Month:** Each date shows appointment count and a restrained load indicator, not miniature appointment cards. Selecting a date opens its Day view.

The calendar operates from 10 AM to 8 PM in the shop timezone. Empty time remains visually quiet.

### Appointment and opening cards

A confirmed appointment shows time, customer, and service. Barber name appears only when the current view does not already communicate it. Selecting a card opens a compact appointment drawer with customer link, contact channel, status, history, and edit/cancel actions.

An active refill occupies the real open interval and uses pale amber. Its label is plain language such as `REVIVE is finding a match` or `Waiting for Sarah`. Selecting it opens the refill timeline and a link to the related Agent conversation.

Cancelled appointments do not remain as full calendar cards. Their cancellation remains visible in the appointment history and Agent action ledger. This keeps the schedule focused on current capacity.

### Manual scheduling

`New appointment` and appointment edit actions use the same availability and transaction rules as Telegram and voice. The operator selects customer, service, barber, date, and a live available time. Stale slots return a conflict and refresh availability; the browser never force-writes an appointment.

Drag-and-drop rescheduling is out of scope for the first rewrite. Click-to-edit is clearer and safer for the demo.

## Agent

The locked Agent design uses three columns because each has one distinct purpose:

1. **Conversation list:** recent real Telegram threads and voice calls, with customer, channel, direction, last line, timestamp, and exception state.
2. **Conversation and action ledger:** the selected message transcript or voice transcript, interleaved with scheduling confirmations and committed domain actions.
3. **Compact context widget:** the selected customer, affected appointment or offer, automation state, and one private-note entry point.

The right context widget is intentionally retained. It prevents the owner from leaving the conversation to understand who the person is and which appointment REVIVE changed. It must remain compact and cannot become a general customer profile.

### Agent subsections

- **Inbox:** unified Telegram and voice conversations.
- **Waitlist:** open entries in candidate order, including requested service, barber flexibility, date/time window, contact channel, and outreach state.
- **Activity:** a concise chronological list of provider delivery events and committed scheduling actions.

### Conversation rules

- Telegram inbound/outbound messages and ElevenLabs transcripts are normalized and persisted as conversation events.
- Voice recording remains disabled; only text transcript and call metadata are displayed.
- Tool calls are not shown as raw JSON. A successful operation becomes a human-readable event such as `Sarah moved from 6 PM to 5 PM`.
- Provider errors appear inline with a retry or review state. They are not silently converted into successful-looking messages.
- Internal identifiers, authentication tokens, provider secrets, and raw webhook payloads never reach the browser.
- REVIVE remains in control by default. `Pause automation` and `Take over` live in a small overflow menu. A manual composer appears only after takeover.

### Waitlist controls

The owner may add a private note, remove/cross out an entry, pause outreach for an entry, or open the related customer. Removing an entry records who changed it and when. Candidate ranking remains deterministic and recalculates after a change.

## Customers

Customers is a lightweight operational record, not a sales CRM.

The page contains a searchable customer list and one selected-customer detail surface. The detail shows:

- name and linked Telegram/phone identities;
- preferred contact channel;
- earlier-move consent;
- flexible-barber preference;
- past-customer outreach opt-in;
- upcoming and past appointments;
- active waitlist entries;
- private operator notes.

The owner can update preferences, consent, and notes. Identity values are masked by default. There are no marketing segments, campaigns, loyalty scores, payments, tags, bulk actions, or analytics.

## Settings

Settings keeps only controls backed by real behavior:

- automatic refill enabled;
- earlier moves enabled;
- waitlist outreach enabled;
- past-customer outreach enabled;
- alternate barbers allowed;
- move limit;
- discount ceiling;
- offer expiry;
- Telegram, Backboard, MongoDB, and ElevenLabs connection status;
- PIN-authenticated demo reset.

Connection cards show configured/healthy/unavailable state and masked provider identity where useful. They do not expose secrets. A prompt editor, voice laboratory, analytics dashboard, and provider-specific advanced settings are out of scope. The ElevenLabs dashboard remains the source of truth for voice selection and low-level agent configuration.

## Demo data

Reset creates one realistic operational week in `America/Toronto` while preserving linked provider identities.

### Staff and services

- Jeremy: Signature haircut, Skin fade, Beard sculpt.
- Maya: Signature haircut, Skin fade.
- Devon: Signature haircut, Beard sculpt.

### Golden-path Monday

- 5 PM: Josh, Signature haircut with Jeremy.
- 6 PM: Sarah, Signature haircut with Jeremy.
- 7 PM: open with Jeremy.
- Alex: waitlisted for a Jeremy Signature haircut between 5 and 7 PM.

### Background data

The rest of the week contains enough confirmed appointments across all three barbers to make Day, Week, and Month views legible. Additional waitlist entries must target other dates, services, or barbers so they cannot change golden-path candidate order. The seed includes customer consent and contact-preference combinations needed to demonstrate filtering, but it does not seed fabricated Telegram messages or voice calls. Real demo interactions populate the Agent inbox.

## Server and persistence changes

### Normalized conversation data

Add persisted conversations and conversation events:

- conversation: customer, channel, provider thread/call identity, direction, state, created/updated timestamps;
- event: conversation, event kind, safe text, delivery state, domain/refill/offer references, timestamp, and normalized metadata;
- private customer notes with author and timestamp.

Telegram webhook handling stores inbound messages and final outbound replies. The outbound offer sender stores delivery attempts and messages. ElevenLabs context, tool, and post-call handling stores call state and transcripts without audio. Provider event identifiers remain idempotent.

### Operator APIs

Keep existing public interfaces and add the minimum operator surfaces:

- calendar range reads for week/month while preserving the current single-date query;
- manual appointment create, reschedule, and cancel through the domain engine;
- customer list/detail and preference/note updates;
- conversation list/detail;
- waitlist list and controlled status/note updates;
- activity list.

Customer, conversation, waitlist, note, and operator-mutation APIs require the existing short-lived admin session. The public demo calendar can remain read-only. API responses expose safe display models rather than raw Mongo documents.

## Data flow

1. A provider webhook or front-desk action enters an authenticated Fastify route.
2. Provider payloads are normalized and deduplicated.
3. Scheduling mutations call the deterministic engine; models and UI code never write MongoDB directly.
4. The transaction commits appointment/refill state, consent history, normalized conversation events, and a domain event.
5. SSE signals the browser.
6. The active page refetches authoritative data and updates Calendar, Agent, or Customers.

This preserves one scheduling truth while allowing the Agent page to explain why state changed.

## Error and empty states

- A disconnected SSE stream shows one quiet reconnecting label and automatically retries.
- A failed page request keeps the last successful state visible with a small stale-state notice.
- A stale appointment mutation refreshes the slot and explains that another change won the race.
- Provider delivery failure appears in the conversation/action ledger and the refill worker continues according to policy.
- An empty Agent inbox explains that real Telegram messages and calls will appear after they occur; it never inserts sample conversations.
- An empty waitlist provides one `Add entry` action.
- Destructive operator actions require confirmation and remain recoverable through recorded history where the domain permits.

## Testing and acceptance

### Automated verification

- Component tests for navigation, date/view controls, barber filtering, calendar density, appointment/refill selection, and empty states.
- Component tests for unified conversation rendering, channel/direction labels, normalized action events, compact context widget, waitlist controls, customer preferences, and settings.
- API tests for calendar ranges, admin authorization, safe projections, conversation idempotency, manual scheduling conflicts, notes, and waitlist updates.
- Integration tests proving real Telegram and ElevenLabs events create normalized conversation records and SSE signals.
- Regression coverage for the existing golden-path scheduling engine and provider webhooks.

### Browser acceptance

Using local Chrome through browser-harness:

1. Reset shows the realistic seeded week and Monday golden path.
2. Day, Week, Month, and each barber filter work without visual overflow.
3. Josh's real Telegram cancellation opens Jeremy's 5 PM interval.
4. The Agent inbox shows Josh's Telegram interaction and the committed cancellation event.
5. Sarah's real outbound call appears with transcript metadata and compact customer/appointment context.
6. Sarah's acceptance moves her from 6 PM to 5 PM in the calendar.
7. Alex's real Telegram offer and reply appear; acceptance fills 6 PM.
8. The final calendar shows Sarah at 5 PM, Alex at 6 PM, and 7 PM open.
9. No fabricated provider message, exposed secret, raw tool payload, or recorded audio appears anywhere.

## Rewrite boundaries

### In scope

- Replace the React application structure and visual system.
- Rebuild the interface with Tailwind utilities and a small configured design-token layer, replacing the bespoke stylesheet.
- Extend the seed to a realistic week without affecting golden-path order.
- Add normalized conversation persistence and operator read models.
- Add the minimal authenticated operator mutations described above.
- Preserve live SSE refetch behavior and all real provider integrations.

### Out of scope

- Rewriting the scheduling engine, refill worker, or provider integrations from scratch.
- Multi-tenancy, payments, analytics, campaigns, loyalty, inventory, staff payroll, or a barber-facing app.
- Drag-and-drop scheduling, mobile-first layout, seeded fake conversations, call recording, or a general AI command centre.

## Completion criterion

The rewrite is complete when a front-desk owner can understand the schedule immediately, switch calendar views and barbers, schedule or modify a customer safely, observe the entire real cancellation-to-refill chain through Calendar and Agent, inspect the relevant customer record, and intervene in waitlist outreach without reading internal provider or database state.
