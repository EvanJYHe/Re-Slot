# REVIVE

REVIVE is a deterministic scheduling and cancellation-refill operator for a Toronto barbershop. Customers talk through real Telegram and phone channels; Backboard and ElevenLabs interpret the conversation, while a TypeScript state machine is the only code allowed to mutate appointments.

The demo path is deliberately concrete: Josh cancels a 5 PM haircut, Sarah accepts 5 PM by voice and frees 6 PM, then Alex accepts 6 PM through Telegram. The live calendar updates from authoritative state over SSE.

## Local development

Requirements: Node.js 22+, npm, and optionally MongoDB Atlas.

```bash
cp .env.example .env
npm install
npm run dev
```

The hot-reload UI runs at `http://127.0.0.1:5174`; Fastify runs at `http://127.0.0.1:3100`. Vite proxies API, health, and webhook traffic to Fastify. `DATA_STORE=memory` is the quickest UI path. Use `DATA_STORE=mongodb` when `MONGODB_URI` points to the Atlas replica set, because booking and offer acceptance use transactions.

For the complete built demo in one process:

```bash
npm run local
```

Open `http://127.0.0.1:3100`. Fastify serves the built React assets and listens only on the loopback interface. The front-desk routes intentionally have no PIN or browser session because this is a trusted, local hackathon workspace.

## Front-desk workspace

The operator UI is a focused four-page workspace:

- **Calendar** — Day, Week, and Month views, an All/Jeremy/Maya/Devon filter, live refill state, and engine-backed booking, rescheduling, and cancellation.
- **Agent** — real Telegram and voice conversations, scheduling actions, waitlist supervision, and compact customer context. No provider activity is fabricated for the demo.
- **Customers** — masked contact identities, scheduling preferences, appointments, waitlist entries, and private operator notes.
- **Settings** — refill policies, connection health, and a deliberately confirmed demo reset.

Calendar, Agent, Customers, and Settings open directly on localhost. Reset seeds a realistic Monday-to-Friday shop week while preserving linked demo identities and Sarah's configured phone number. Telegram and ElevenLabs webhooks still require their provider secrets; removing the human operator gate does not weaken provider authentication.

## Provider setup

Keep real credentials only in the ignored local `.env`. Never commit them.

Telegram and ElevenLabs cannot call a loopback address. For a live provider demo, expose port 3100 through a temporary HTTPS tunnel, set `PUBLIC_BASE_URL` to that tunnel URL, and remove the tunnel when the demo ends. The operator workspace itself remains local.

### Backboard

Create or reuse the single REVIVE assistant:

```bash
npm run setup:backboard
```

Copy the returned assistant ID into `BACKBOARD_ASSISTANT_ID`. Each customer receives a separate persisted Backboard thread and every message uses `memory=off`. Models receive scheduling tools, never MongoDB access or a caller-supplied customer identity.

### Telegram

After `PUBLIC_BASE_URL` is the temporary HTTPS tunnel URL:

```bash
npm run setup:telegram
npm run demo:links
```

Open the generated Josh link on Josh's Telegram account and the Alex link on Alex's account. The signed links are private, one-customer demo credentials. Telegram requests must include the configured secret-token header and are deduplicated by update ID.

### ElevenLabs and Twilio

1. Give the ElevenLabs key Conversational AI read/write and calling permissions.
2. Import a voice-capable Twilio number through ElevenLabs' native phone-number integration.
3. Create one low-latency REVIVE agent and set its ID and the imported phone-number ID in the environment.
4. Configure the inbound context URL as `/webhooks/elevenlabs/context`, server tools under `/webhooks/elevenlabs/tools/:tool`, and post-call events at `/webhooks/elevenlabs/post-call`.
5. Put the same strong webhook secret in ElevenLabs and `ELEVENLABS_WEBHOOK_SECRET`, and set Sarah's E.164 demo number in `SARAH_PHONE`.
6. Leave call recording disabled. REVIVE also sends `call_recording_enabled: false` on every outbound request.

Inbound calls are resolved from the authenticated caller number. Tool requests carry a short-lived, signed actor token in a secret dynamic variable; model-supplied customer IDs are ignored. Decline, no-answer, and initiation failures safely advance the persisted refill job.

## Atlas

Atlas remains the external source of truth for the real demo. Set `DATA_STORE=mongodb`, `MONGODB_URI`, and `MONGODB_DB=revive` in `.env`. Allow the current development machine in Atlas Network Access, use TLS and a least-privilege database user, and remove temporary access after the hackathon. The local app falls back to memory only in development when Atlas is unavailable; production-shaped `npm run local` fails closed instead.

## API surface

- `GET /health`
- `GET /api/v1/calendar?date=YYYY-MM-DD`
- `GET /api/v1/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/v1/availability`
- `POST /api/v1/appointments`
- `PATCH /api/v1/appointments/:id`
- `POST /api/v1/appointments/:id/cancel`
- `GET/PATCH /api/v1/customers/:id`
- `POST /api/v1/customers/:id/notes`
- `GET /api/v1/conversations` and `GET /api/v1/conversations/:id`
- `GET/PATCH /api/v1/waitlist/:id`
- `GET /api/v1/activity`
- `GET/PATCH /api/v1/settings`
- `GET /api/v1/refill-jobs/:id`
- `GET /api/v1/events`
- `POST /api/v1/demo/reset`
- `POST /webhooks/telegram`
- `POST /webhooks/elevenlabs/context`
- `POST /webhooks/elevenlabs/post-call`
- `POST /webhooks/elevenlabs/tools/:tool`

## Verification

```bash
npm run check
```

Tests cover availability, confirmation and consent, candidate ordering, discounts and move limits, atomic offer acceptance, expiration and retries, MongoDB transactions/indexes, duplicate webhooks, Backboard tool loops, ElevenLabs signatures, SSE, the live calendar, and the complete golden path.

The approved system design and execution record live in [docs/superpowers/specs/2026-07-18-revive-design.md](docs/superpowers/specs/2026-07-18-revive-design.md) and [docs/superpowers/plans/2026-07-18-revive-implementation.md](docs/superpowers/plans/2026-07-18-revive-implementation.md). The locked front-desk redesign is documented in [docs/superpowers/specs/2026-07-18-revive-frontend-redesign.md](docs/superpowers/specs/2026-07-18-revive-frontend-redesign.md) with its execution plan in [docs/superpowers/plans/2026-07-18-front-desk-redesign-implementation.md](docs/superpowers/plans/2026-07-18-front-desk-redesign-implementation.md).
