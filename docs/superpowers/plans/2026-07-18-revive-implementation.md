# REVIVE implementation plan and execution record

**Date:** 2026-07-18
**Branch:** `feat/revive-operator`

## Delivered sequence

1. **Foundation** — strict TypeScript, React/Vite/Tailwind, Fastify, MongoDB driver, Zod, Luxon, Vitest, structured Fastify logs, validated environment loading, graceful shutdown, static serving, and `/health`.
2. **Scheduling engine** — deterministic availability, booking, cancellation, rescheduling, consent, candidate ranking, discounts, move limits, atomic accepted moves, successor jobs, stale conflicts, and a recoverable leased worker.
3. **Persistence** — Atlas-shaped collections and indexes, transaction-backed store, provider idempotency records, settings, domain events, and listener-driven SSE invalidation.
4. **Telegram and Backboard** — secret validation, signed private account links, update deduplication, isolated persisted threads with memory disabled, safe tool loops, natural replies, and outbound offer wording.
5. **Voice** — caller context mapping, signed actor variables, authenticated shared scheduling tools, signed post-call processing, and ElevenLabs native Twilio outbound requests with recording disabled.
6. **Calendar** — live day board, barber/time grid, appointment/refill states, timeline and settings drawers, provider health, SSE refetch, and authenticated reset without simulated channel panels.
7. **Deployment** — one-service production build, Railway service config, provider setup scripts, environment template, and operating documentation.

## Test-first checkpoints

The implementation was driven by failing tests for each boundary, then made green:

- availability and qualified alternate barbers;
- refill candidate ordering and seven-day exclusions;
- confirmation, consent, settings, move-depth and discount caps;
- offer expiry, retry, visible failure and worker lease recovery;
- atomic moves, successor openings and simultaneous acceptance;
- Mongo transactions, uniqueness indexes and live subscriber events;
- seed/reset identity preservation;
- Backboard tool loops and memory isolation;
- Telegram deep links, deduplication and actor binding;
- ElevenLabs payloads, caller resolution, signatures and failures;
- webhook validation, SSE, calendar/settings UI, and the complete golden path.

## Seed and acceptance

The relative demo weekday begins with:

- 5 PM — Josh, haircut with Jeremy;
- 6 PM — Sarah, haircut with Jeremy, voice-preferred and opted into earlier moves;
- 7 PM — open;
- Alex — waitlisted for a Jeremy haircut between 5 and 7 PM.

Acceptance is complete when a deployed run proves:

1. Josh links and cancels through real Telegram.
2. The calendar exposes 5 PM and shows active refill work.
3. Sarah receives a real outbound call and clearly accepts 5 PM.
4. SSE moves Sarah from 6 PM to 5 PM.
5. Alex receives the resulting 6 PM Telegram offer.
6. Alex asks a natural question and confirms acceptance.
7. The authoritative final calendar contains Sarah at 5, Alex at 6, and 7 open.

## External completion gates

Application code and local verification do not manufacture provider readiness. Before live acceptance, Atlas must permit Railway egress, the ElevenLabs key must have Conversational AI permissions, an ElevenLabs agent and imported Twilio number must exist, Sarah's E.164 number must be configured, and the stable Railway HTTPS URL must be registered with both providers. Each gate is checked through `/health` and a real channel smoke test.
