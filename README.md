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

The calendar runs at `http://localhost:5173`; Fastify runs at `http://localhost:3000`. Vite proxies API, health, and webhook traffic to Fastify. `DATA_STORE=memory` is the quickest local path. Use `DATA_STORE=mongodb` only when `MONGODB_URI` points to a reachable replica set, because booking and offer acceptance use transactions.

Production uses one process:

```bash
npm run build
NODE_ENV=production npm start
```

Fastify serves the built React assets from `dist/public` and listens on `PORT`.

## Front-desk workspace

The operator UI is a focused four-page workspace:

- **Calendar** — Day, Week, and Month views, an All/Jeremy/Maya/Devon filter, live refill state, and engine-backed booking, rescheduling, and cancellation.
- **Agent** — real Telegram and voice conversations, scheduling actions, waitlist supervision, and compact customer context. No provider activity is fabricated for the demo.
- **Customers** — masked contact identities, scheduling preferences, appointments, waitlist entries, and private operator notes.
- **Settings** — refill policies, connection health, and the authenticated demo reset.

Calendar viewing is public. Protected actions and the other three pages ask for `DEMO_ADMIN_PIN`; the resulting one-hour operator session is kept only in the browser's `sessionStorage`. Reset seeds a realistic Monday-to-Friday shop week while preserving linked demo identities and Sarah's configured phone number.

## Provider setup

Keep real credentials only in `.env` locally or sealed Railway variables. Never commit them.

### Backboard

Create or reuse the single REVIVE assistant:

```bash
npm run setup:backboard
```

Copy the returned assistant ID into `BACKBOARD_ASSISTANT_ID`. Each customer receives a separate persisted Backboard thread and every message uses `memory=off`. Models receive scheduling tools, never MongoDB access or a caller-supplied customer identity.

### Telegram

After `PUBLIC_BASE_URL` is the deployed HTTPS URL:

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

## Railway and Atlas

`railway.json` pins Railpack, the build/start commands, one replica, restart-on-failure, and `/health`. Configure these production variables:

- `NODE_ENV=production`, `DATA_STORE=mongodb`, `SHOP_TIMEZONE=America/Toronto`, and `DEMO_MODE=true`
- `PUBLIC_BASE_URL`, `DEMO_ADMIN_PIN`, and a random `ADMIN_SESSION_SECRET`
- `MONGODB_URI` and `MONGODB_DB=revive`
- Telegram, Backboard, and ElevenLabs values from `.env.example`
- `SARAH_PHONE` in E.164 format

Atlas must allow Railway's outbound traffic. For a short hackathon, an Atlas network-access entry covering Railway's dynamic egress can be used with TLS and a least-privilege database user; a Railway static outbound IP is the tighter option. Remove temporary broad access after judging.

Deploy from the repository root with an audit message, then wait for terminal `SUCCESS`:

```bash
railway up --service revive --environment production --detach -m "Deploy REVIVE scheduling operator"
railway deployment list --service revive --environment production --json
```

Generate a Railway domain, set that HTTPS URL as `PUBLIC_BASE_URL`, then register Telegram and configure the ElevenLabs URLs.

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
- `POST /api/v1/admin/session`
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
