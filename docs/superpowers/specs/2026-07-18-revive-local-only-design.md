# REVIVE local-only operator design

**Status:** Approved
**Audience:** Hackathon team running REVIVE on one trusted Mac

## Objective

Turn REVIVE into a frictionless localhost demo. Calendar, Agent, Customers, Settings, scheduling mutations, waitlist controls, and demo reset open immediately with no admin PIN or browser session. Remove the hosted Railway copy completely while keeping MongoDB Atlas and optional Telegram, Backboard, and ElevenLabs integrations available to the local process.

## Chosen boundary

REVIVE is a trusted single-user desktop demo, not a public dashboard. Human/operator API routes are therefore intentionally unauthenticated, and the server binds only to `127.0.0.1`. Telegram secret-token validation, ElevenLabs webhook signatures, and signed voice actor context remain unchanged because they authenticate external providers rather than the local operator.

The following are removed:

- The operator unlock screen, PIN input, modal, and lock icon usage.
- `sessionStorage` operator tokens and Authorization headers from the browser client.
- `POST /api/v1/admin/session`, operator bearer-token signing, and `operatorOnly` pre-handlers.
- `DEMO_ADMIN_PIN` and `ADMIN_SESSION_SECRET` configuration.
- Railway-specific configuration and README deployment instructions.
- The Railway `revive` project, its sole service, domain, deployment history, and hosted variables.
- The Telegram webhook registration that points at the deleted Railway domain.

## Local runtime

The canonical command is `npm run local`, serving the built React client and Fastify API together at `http://127.0.0.1:3100`. The API binds to loopback only. `npm run dev` continues to support hot reload on non-conflicting local ports with Vite proxying the same loopback API.

The local `.env` keeps only data and provider configuration actually consumed by the demo:

- Core: `DATA_STORE`, `MONGODB_URI`, `MONGODB_DB`, `SHOP_TIMEZONE`, `DEMO_MODE`, and localhost `PUBLIC_BASE_URL`.
- Telegram: bot token and webhook secret.
- Backboard: API key and assistant ID.
- ElevenLabs: API key, agent ID, imported phone-number ID, webhook secret, and optional Sarah destination.

`DEMO_ADMIN_PIN` and `ADMIN_SESSION_SECRET` are removed. Voice actor tokens derive from the existing ElevenLabs webhook secret, then Telegram webhook secret, with a localhost-only fallback when neither provider is configured.

## Browser and API behavior

All four navigation destinations render immediately. Calendar scheduling opens the appointment editor directly. Agent, Customers, and Settings fetch their data without a token. Demo reset remains a deliberate two-click action in Settings but no longer requests credentials.

The browser API retains the same resource paths and validation but drops token parameters. Customer identities stay masked in read models. Provider credentials, provider payloads, and actor tokens remain server-side.

## Infrastructure teardown

Delete Railway project `revive` (`e2a09144-46d4-4afe-b29d-c3298edc1dad`) after confirming it contains only service `revive` (`cbac2524-fb70-4246-aaa1-cf1fc9486c07`). Unlink the local repository from the deleted project. MongoDB Atlas is not a Railway resource and must not be deleted or modified.

Delete the Telegram webhook only if it still targets the former Railway domain. Do not delete the bot, Backboard assistant, ElevenLabs agent, or imported Twilio number. Live inbound provider events will require a future HTTPS tunnel because external providers cannot call localhost directly.

## Verification

- API tests prove operator reads and mutations return success without Authorization and that `/api/v1/admin/session` returns 404.
- React tests prove Agent, Customers, Settings, and scheduling controls never render an unlock prompt and call tokenless API methods.
- Config tests prove retired admin variables are absent and voice actor signing still has a non-empty secret.
- The full TypeScript, Vitest, and production build suite passes.
- Browser QA confirms every page opens directly at `127.0.0.1:3100`, scheduling opens without a gate, SSE connects, and no horizontal overflow appears.
- Railway project discovery no longer returns an active `revive` project, the public domain stops responding, and the local server continues using Atlas.

