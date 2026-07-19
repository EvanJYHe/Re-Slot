# REVIVE

REVIVE is a deterministic scheduling and cancellation-refill operator for a Toronto barbershop. Customers talk through real Telegram and phone channels; Backboard and ElevenLabs interpret the conversation, while a TypeScript state machine is the only code allowed to mutate appointments.

The demo path is deliberately concrete: Josh cancels a 5 PM haircut, Sarah accepts 5 PM by voice and frees 6 PM, then Alex accepts 6 PM through Telegram. The live calendar updates from authoritative state over SSE.

## Quick start for teammates

Requirements: Node.js 22+ and npm. MongoDB Atlas and provider credentials are optional for normal UI/domain development.

```bash
git clone https://github.com/ManagementMO/REVIVE.git
cd REVIVE
git switch --track origin/agent/revive-local-only
npm install
cp .env.example .env
npm run dev
```

Open `http://127.0.0.1:5174`. The default `.env.example` uses seeded in-memory data, so teammates can build the calendar, agent workspace, CRM, and scheduling engine without shared credentials. Fastify runs at `http://127.0.0.1:3100`, and Vite proxies API, health, and webhook traffic to it.

For the production-shaped local demo in one process:

```bash
npm run local
```

Open `http://127.0.0.1:3100`. Fastify serves the built React assets and listens only on the loopback interface. The front-desk routes intentionally have no PIN or browser session because this is a trusted, local hackathon workspace.

### Start contributing

Create a feature branch from the shared local-only branch:

```bash
git switch agent/revive-local-only
git pull
git switch -c feat/<short-description>
```

Before pushing a change, run:

```bash
npm run check
```

This runs TypeScript, all Vitest suites, and the production build. For a faster focused loop:

```bash
npm run test:run -- src/domain/engine.test.ts
npm run test:run -- src/web/pages/CalendarPage.test.tsx
```

### Project map

```text
src/domain/   Deterministic availability, booking, cancellation, and refill logic
src/server/   Fastify APIs, MongoDB store, webhooks, workers, and provider adapters
src/web/      React/Tailwind front-desk workspace
scripts/      Backboard and Telegram setup helpers
docs/         Approved designs and implementation records
```

Keep scheduling mutations inside the deterministic engine—Backboard, Telegram, and ElevenLabs may request typed operations but must never write MongoDB directly. Do not commit `.env`, provider tokens, phone numbers, or Atlas credentials. Preserve Telegram and ElevenLabs webhook authentication even though the localhost operator UI is intentionally open.

### Working with the shared demo

- Use `DATA_STORE=memory` for isolated feature work and repeatable tests.
- Use `DATA_STORE=mongodb` only with a securely shared Atlas URI and an Atlas Network Access entry for your current IP.
- Use Settings → **Reset demo week** to restore the seeded Josh/Sarah/Alex scenario.
- Telegram and ElevenLabs cannot reach localhost directly. Live inbound testing requires a temporary HTTPS tunnel to port 3100 and matching provider webhook URLs.

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

For live localhost scheduling, start an HTTPS tunnel to the Fastify port, put its URL in
`PUBLIC_BASE_URL`, and update the agent's scheduling tools:

```bash
ngrok http 3100
npm run setup:elevenlabs
```

The setup command repoints the existing ElevenLabs tools to the temporary tunnel and gives the
agent an availability-first booking flow. Keep the local server and tunnel running during calls.
To place a recording-disabled demo call with a signed customer identity:

```bash
DESTINATION_PHONE=+1XXXXXXXXXX npm run demo:call
```

Recording stays off by default. Enable it only with the caller's explicit consent:

```bash
CALL_RECORDING_ENABLED=true DESTINATION_PHONE=+1XXXXXXXXXX npm run demo:call
```

The agent asks for the service, date, preferred time range, and barber preference one question at
a time. It reads live slots and creates an appointment only after the caller confirms the exact
service, barber, date, and time.

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
