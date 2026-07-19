# Re-Slot scheduling operator design

**Date:** 2026-07-18
**Scope:** one Toronto barbershop, one operational week, demo-first production channels

## Product boundary

Re-Slot recovers newly opened appointment time without giving a language model authority over scheduling state. It supports booking, cancellation, rescheduling, availability and business questions, earlier-move consent, waitlist outreach, alternate qualified barbers, and opted-in past-customer outreach. It intentionally excludes multi-tenancy, payments, analytics, and a general command centre.

The golden path is Josh cancelling by Telegram, Sarah explicitly accepting the earlier 5 PM time by phone, and Alex accepting Sarah's resulting 6 PM opening by Telegram.

## Architecture

One Railway service runs Fastify, the persisted refill worker, and the built React calendar. MongoDB Atlas is authoritative. Telegram calls Fastify directly; customer language goes to one Backboard assistant with an isolated thread per customer and `memory=off`. ElevenLabs owns the native Twilio phone channel and calls authenticated Fastify context, tool, and post-call endpoints.

```text
Telegram ──secret webhook──┐
                          ├── Fastify ── deterministic engine ── MongoDB Atlas
ElevenLabs/Twilio ─auth───┘       │                    │
                                  ├── Backboard        └── persisted refill worker
Browser ──calendar API + SSE──────┘
```

LLMs can request typed tools. The server binds every tool call to an authenticated `ActorContext`; customer IDs from a model payload are not trusted. MongoDB is never exposed to a provider.

## State and invariants

Collections hold customers, barbers, services, appointments, waitlist entries, refill jobs, outreach offers, Backboard thread mappings, processed provider events, calendar events, and shop settings.

Key invariants are enforced both in domain logic and indexes:

- one confirmed appointment for a barber/start time;
- unique normalized phone and Telegram chat identities;
- one active pending/delivered offer per refill job;
- unique provider/event IDs and Backboard thread/customer mappings;
- refill-job idempotency for a source appointment and opening;
- all customer-facing mutations require authenticated ownership;
- booking, rescheduling, alternate-barber changes, and offer acceptance require an exact confirmation turn;
- one identified direct cancellation is immediate explicit consent.

Appointments carry a version and consent-backed history. Provider event IDs and worker leases make retries safe across duplicate delivery and process restarts.

## Refill state machine

Cancellation changes the appointment to cancelled and creates a pending job for the exact barber, service, and interval. A worker atomically leases the oldest eligible job, then ranks candidates:

1. later same-day appointments for the same barber/service with earlier-move consent;
2. matching active waitlist entries;
3. opted-in same-service past customers not contacted in the prior seven days.

Only one candidate is contacted at a time. Offers expire after 120 seconds in demo mode. Delivery is retried three times before a visible failure returns the job to the queue. Past-customer discounts progress 5%, 10%, and 15%, capped by settings.

An acceptance transaction verifies ownership, offer freshness, slot freshness, and the original appointment version. A moved appointment is updated in place with explicit consent history; its former interval becomes a successor refill job. After three moves, appointment shifting stops, while the final opening may still go to waitlist or past-customer candidates. Simultaneous or stale acceptances return safe conflicts.

## Channel contracts

Telegram validates `X-Telegram-Bot-Api-Secret-Token`, deduplicates updates, and links Josh/Alex through signed private deep links. Backboard receives customer-safe schemas and completes bounded OpenAI-style tool loops.

ElevenLabs inbound context maps the caller's normalized phone and returns signed secret dynamic variables. Server tools validate that signed actor token. Outbound calls include offer/customer/barber/service/time context and disable recording. Signed post-call events deduplicate no-answer or failure handling.

## Calendar

The desktop-first calendar uses a shop-ledger visual language: paper, ink, oxblood appointments, and amber active recovery. Barber columns align to local-time rows. Appointment cards show customer, service, time, and status. Active jobs show “Finding a replacement…” or “Waiting for Sarah.” A drawer explains the cancellation/refill timeline in plain language.

The settings drawer changes refill, consent, waitlist, past-customer, alternate-barber, move-limit, expiry, and discount policies. A PIN-authenticated reset preserves linked Telegram IDs, Sarah's phone, Backboard threads, and idempotency records. SSE only signals change; the browser always refetches authoritative calendar state.

## Failure posture

Provider errors never imply that a mutation committed. Duplicate webhooks are acknowledged without replay. Stale slots/offers are explicit conflicts. Worker leases recover after restart. Health reports configuration state without returning secrets. Local development may use an in-memory store, but `DATA_STORE=mongodb` fails closed in production if Atlas is unavailable.
