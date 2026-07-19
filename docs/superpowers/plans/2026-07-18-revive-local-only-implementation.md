# REVIVE Local-Only Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove operator PIN friction and all Railway hosting so REVIVE runs as a trusted loopback-only hackathon demo.

**Architecture:** Keep the deterministic engine, Atlas store, provider integrations, webhook authentication, SSE, and four-page Tailwind UI. Delete only the human operator session boundary, make the typed browser API tokenless, bind Fastify to `127.0.0.1`, and remove hosted infrastructure/configuration.

**Tech Stack:** TypeScript 5, React, Vite, Tailwind CSS, Fastify, MongoDB driver, Zod, Vitest, React Testing Library, browser-harness, Railway CLI.

## Global Constraints

- Preserve Telegram secret-token checks, ElevenLabs HMAC verification, and signed voice actor context.
- Never expose provider credentials, raw webhook payloads, phone numbers, or actor tokens in browser responses.
- Bind the API to `127.0.0.1`; unauthenticated operator routes must not listen on all interfaces.
- Keep MongoDB Atlas and all seeded/demo data intact.
- Do not delete the Telegram bot, Backboard assistant, ElevenLabs agent, Twilio number, or Atlas project.
- Remove the Railway `revive` project only after an exact service/resource read-back.
- Preserve unrelated uncommitted ElevenLabs readiness and Backboard work; stage only local-only simplification hunks.

---

### Task 1: Remove the server-side operator session boundary

**Files:**
- Modify: `src/server/app.test.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/config.test.ts`
- Modify: `src/server/config.ts`
- Modify: `src/server/runtime.ts`
- Modify: `src/server/index.ts`

**Interfaces:**
- Produces: tokenless operator routes and `AppConfig.voiceActorSecret: string`.
- Consumes: existing Zod request schemas, `ReviveEngine`, provider webhook validation, and SSE.

- [ ] **Step 1: Write failing API tests for local operator access**

Replace the bearer-auth expectations with direct requests and add an absent-session-route assertion:

```ts
it("opens local operator routes without a bearer session", async () => {
  expect((await app.inject({ method: "GET", url: "/api/v1/customers" })).statusCode).toBe(200);
  expect((await app.inject({ method: "GET", url: "/api/v1/conversations" })).statusCode).toBe(200);
  expect((await app.inject({ method: "GET", url: "/api/v1/waitlist" })).statusCode).toBe(200);
  expect((await app.inject({ method: "GET", url: "/api/v1/activity" })).statusCode).toBe(200);
  expect((await app.inject({ method: "POST", url: "/api/v1/admin/session", payload: { pin: "4242" } })).statusCode).toBe(404);
});
```

Update appointment, preference, note, settings, waitlist, and reset tests to omit `Authorization` headers.

- [ ] **Step 2: Run the server test and verify RED**

Run: `npm run test:run -- src/server/app.test.ts`

Expected: FAIL because operator routes still return 401 and `/api/v1/admin/session` still exists.

- [ ] **Step 3: Write failing config tests for the retired admin settings**

```ts
it("derives a provider actor secret without admin-session configuration", () => {
  const config = loadConfig({ ELEVENLABS_WEBHOOK_SECRET: "voice-secret" });
  expect(config.voiceActorSecret).toBe("voice-secret");
  expect("demoAdminPin" in config).toBe(false);
  expect("adminSessionSecret" in config).toBe(false);
});
```

Also assert that the fallback is a non-empty string when providers are absent.

- [ ] **Step 4: Run the config test and verify RED**

Run: `npm run test:run -- src/server/config.test.ts`

Expected: FAIL because `voiceActorSecret` does not exist and retired fields remain.

- [ ] **Step 5: Implement the minimal server simplification**

In `app.ts`, remove `safePinEqual`, `signSession`, `verifySession`, `operatorOnly`, and the admin-session route. Remove `{ preHandler: operatorOnly }` from settings, availability, appointment, customer, conversation, waitlist, and activity routes. Make demo reset call its existing reset body directly.

In `config.ts`, delete `DEMO_ADMIN_PIN` and `ADMIN_SESSION_SECRET`. Add:

```ts
const providerSecret = parsed.ELEVENLABS_WEBHOOK_SECRET ?? parsed.TELEGRAM_WEBHOOK_SECRET;
const voiceActorSecret = providerSecret ?? createHash("sha256")
  .update("revive-local-voice-actor")
  .digest("hex");
```

Expose `voiceActorSecret` on `AppConfig`, pass it from `runtime.ts` to `ProviderOfferSender`, and change `index.ts` to listen with `{ host: "127.0.0.1", port: config.port }`.

- [ ] **Step 6: Verify the focused server suite is GREEN**

Run: `npm run test:run -- src/server/config.test.ts src/server/app.test.ts src/server/runtime.test.ts src/server/webhook-routes.test.ts src/server/providers/elevenlabs.test.ts`

Expected: PASS with tokenless operator access and provider authentication unchanged.

- [ ] **Step 7: Commit only the local-only server hunks**

Use partial staging so pre-existing readiness changes stay unstaged:

```bash
git add -p src/server/app.ts src/server/app.test.ts src/server/config.ts src/server/config.test.ts
git add src/server/runtime.ts src/server/index.ts
git commit -m "feat: make operator API local-only"
```

### Task 2: Remove browser tokens and the unlock interface

**Files:**
- Modify: `src/web/App.test.tsx`
- Modify: `src/web/App.tsx`
- Modify: `src/web/api.test.ts`
- Modify: `src/web/api.ts`
- Modify: `src/web/types.ts`
- Modify: `src/web/pages/AgentPage.tsx`
- Modify: `src/web/pages/AgentPage.test.tsx`
- Modify: `src/web/pages/CalendarPage.tsx`
- Modify: `src/web/pages/CalendarPage.test.tsx`
- Modify: `src/web/pages/CustomersPage.tsx`
- Modify: `src/web/pages/CustomersPage.test.tsx`
- Modify: `src/web/pages/SettingsPage.tsx`
- Modify: `src/web/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: tokenless operator routes from Task 1.
- Produces: `ReviveApi` methods with no token arguments and four immediately accessible pages.

- [ ] **Step 1: Write failing shell tests**

Add assertions that selecting every destination renders its real page without an unlock heading and that New appointment opens the editor immediately:

```tsx
await user.click(screen.getByRole("button", { name: "Agent" }));
expect(await screen.findByRole("heading", { name: "Conversations" })).toBeInTheDocument();
expect(screen.queryByText("Unlock operator workspace")).not.toBeInTheDocument();
```

Delete test setup for `sessionStorage`, `initialOperatorToken`, and `createAdminSession`.

- [ ] **Step 2: Run shell tests and verify RED**

Run: `npm run test:run -- src/web/App.test.tsx`

Expected: FAIL because Agent still renders `OperatorGate`.

- [ ] **Step 3: Write failing tokenless API tests**

Call protected resources with their new desired signatures and assert no Authorization header:

```ts
await defaultApi.getCustomers("sarah");
expect(fetchMock).toHaveBeenCalledWith(
  "/api/v1/customers?q=sarah",
  expect.objectContaining({ headers: undefined }),
);
```

Cover settings, reset, availability, appointment mutations, conversations, waitlist, and activity.

- [ ] **Step 4: Run API tests and verify RED**

Run: `npm run test:run -- src/web/api.test.ts`

Expected: FAIL because the method signatures require tokens and emit bearer headers.

- [ ] **Step 5: Implement tokenless browser interfaces**

Remove token parameters from every `ReviveApi` operator method and remove `authorization()`. Delete `createAdminSession`. Make requests use only content-type headers when a JSON body exists.

Delete `OperatorGate`, `tokenStorageKey`, `storedOperatorToken`, `initialOperatorToken`, `operatorToken`, and `calendarUnlockRequested` from `App.tsx`. Render pages directly:

```tsx
{page === "agent" ? <AgentPage api={api} refreshKey={domainVersion} /> : null}
{page === "customers" ? <CustomersPage api={api} refreshKey={domainVersion} /> : null}
{page === "settings" ? <SettingsPage api={api} channelHealth={calendar?.channelHealth} refreshKey={domainVersion} onReset={handleReset} /> : null}
```

Remove `token` props and arguments from Agent, Calendar, Customers, and Settings components. Calendar calls scheduling APIs directly and no longer accepts `onRequireOperator` or `operatorToken`.

- [ ] **Step 6: Run the complete web suite and verify GREEN**

Run: `npm run test:run -- src/web && npm run typecheck`

Expected: PASS with no unlock copy, no browser token storage, and no bearer headers.

- [ ] **Step 7: Commit the browser simplification**

```bash
git add src/web
git commit -m "feat: remove local operator gate"
```

### Task 3: Make localhost the documented and configured product

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `.env.example`
- Modify: `.env` (untracked, preserve secret values)
- Modify: `README.md`
- Delete: `railway.json`

**Interfaces:**
- Produces: `npm run local` at `http://127.0.0.1:3100` and hot reload at `http://127.0.0.1:5174`.
- Consumes: loopback API from Task 1 and built frontend from Task 2.

- [ ] **Step 1: Add local runtime scripts and ports**

Set scripts to:

```json
{
  "dev": "concurrently -k -n api,web -c yellow,cyan \"PORT=3100 PUBLIC_BASE_URL=http://127.0.0.1:3100 tsx watch src/server/index.ts\" \"vite --host 127.0.0.1 --port 5174\"",
  "local": "npm run build && NODE_ENV=production PORT=3100 PUBLIC_BASE_URL=http://127.0.0.1:3100 npm start"
}
```

Change Vite proxy targets to `http://127.0.0.1:3100`.

- [ ] **Step 2: Retire hosted configuration**

Delete `railway.json`. Remove Railway deployment/setup text and the admin PIN/API route from README. Document `npm run local`, loopback-only trust, provider-webhook tunnel limitations, and Atlas remaining external.

Remove `DEMO_ADMIN_PIN` and `ADMIN_SESSION_SECRET` from `.env.example`. Set its `PUBLIC_BASE_URL=http://127.0.0.1:3100` and `PORT=3100`.

- [ ] **Step 3: Mechanically sanitize the untracked local `.env`**

Without printing values, delete lines whose keys are `DEMO_ADMIN_PIN` or `ADMIN_SESSION_SECRET`, set `PUBLIC_BASE_URL` to `http://127.0.0.1:3100`, and set/add `PORT=3100`. Preserve all Atlas and provider values byte-for-byte.

- [ ] **Step 4: Verify local configuration**

Run a key-only check that reports no retired variables, then run:

```bash
npm run typecheck
npm run build
```

Expected: PASS; `.env` remains ignored and contains no operator-auth keys.

- [ ] **Step 5: Commit tracked local-runtime changes**

```bash
git add package.json vite.config.ts .env.example README.md railway.json
git commit -m "chore: make revive localhost-only"
```

### Task 4: Tear down hosted infrastructure

**Files:** None.

**Interfaces:**
- Consumes: Railway project/service IDs and the local Telegram token.
- Produces: no active Railway `revive` project and no Telegram webhook pointing at its old domain.

- [ ] **Step 1: Re-read the exact destructive target**

Run Railway project discovery and assert project `e2a09144-46d4-4afe-b29d-c3298edc1dad` contains exactly service `cbac2524-fb70-4246-aaa1-cf1fc9486c07` and no database/bucket service.

- [ ] **Step 2: Delete the Railway project**

```bash
railway project delete --project e2a09144-46d4-4afe-b29d-c3298edc1dad --yes --json
```

Expected: deletion acknowledgement for the exact project ID.

- [ ] **Step 3: Unlink the local repository**

Run `railway unlink --yes` if supported; otherwise remove only the CLI link through Railway's documented unlink command. Do not delete any project files except the tracked `railway.json` from Task 3.

- [ ] **Step 4: Remove the dead Telegram webhook target**

Read `getWebhookInfo` without printing the token. If the URL equals `https://revive-production-57e8.up.railway.app/webhooks/telegram`, call Telegram `deleteWebhook` with `drop_pending_updates=false`. Do not delete the bot.

- [ ] **Step 5: Verify teardown**

Railway project discovery must show the project deleted or absent, the former public URL must stop returning REVIVE, and Telegram webhook info must have an empty URL. Report Railway's deletion/recovery semantics exactly.

### Task 5: Full local acceptance

**Files:**
- Modify: `docs/superpowers/plans/2026-07-18-revive-local-only-implementation.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified localhost demo and completed execution record.

- [ ] **Step 1: Run the complete suite**

Run: `npm run check`

Expected: every Vitest file, TypeScript, Vite, and tsup pass.

- [ ] **Step 2: Restart the local server**

Stop the existing REVIVE session, run `npm run local`, and verify `/health`, `/`, Atlas-backed calendar data, and SSE at `http://127.0.0.1:3100`.

- [ ] **Step 3: Perform browser-harness acceptance**

In the user's existing Chrome, verify Calendar, Agent, Customers, and Settings open without an unlock screen; New appointment opens directly; demo reset remains deliberate; the body has zero horizontal overflow; and Josh/Sarah seeded appointments render.

- [ ] **Step 4: Final repository audit**

Run `git diff --check`, confirm `.env` is ignored, confirm no tracked credential pattern, and list unrelated preserved working-tree files without staging them.

- [ ] **Step 5: Complete the execution record**

Mark all plan checkboxes complete only after the corresponding evidence exists. Do not push or redeploy; this project is intentionally local-only.
