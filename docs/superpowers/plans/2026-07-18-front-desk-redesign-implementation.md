# REVIVE Front-Desk Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the decorative day board with a Tailwind-first front-desk workspace where an owner can operate the calendar and supervise real Telegram and ElevenLabs activity across Calendar, Agent, Customers, and Settings.

**Architecture:** Preserve the deterministic `ReviveEngine`, worker, and provider boundaries. Extend the shared state with normalized conversation events and operator notes, expose safe admin-authenticated read models and mutations through Fastify, and rebuild the React client as four focused page components that refetch authoritative state after SSE invalidation.

**Tech Stack:** TypeScript 5, React, Vite, Tailwind CSS 3.4, Fastify, Zod, Luxon, MongoDB driver, Vitest, React Testing Library, browser-harness, Railway.

## Global Constraints

- Tailwind CSS 3.4 is the primary styling system; custom CSS is limited to Tailwind directives, font/base declarations, and runtime calendar geometry.
- Keep the REVIVE palette near-white, charcoal, muted green, and pale amber; no gradients, textures, oversized display typography, or decorative dashboard widgets.
- Preserve `ReviveEngine`, refill ranking, offer sequencing, provider authentication, SSE refetch, and the golden path.
- Persist and display real provider activity only. Never seed Telegram messages, voice transcripts, fake calls, or fake delivery state.
- Keep voice recording disabled and never expose provider secrets, raw webhook payloads, actor tokens, or internal tool JSON to the browser.
- Keep the Agent page's locked three-column structure: conversation list, transcript/action ledger, compact context widget.
- Use a short-lived admin session for customer, conversation, waitlist, note, availability, and operator appointment routes.
- Build desktop-first with a usable tablet fallback; mobile-first work and drag-and-drop scheduling are out of scope.
- Follow red-green-refactor for every behavior change and keep all pre-existing tests green.

---

## File map

### Domain and persistence

- `src/domain/types.ts` — add normalized conversation, conversation-event, customer-note, and paused waitlist types.
- `src/domain/store.ts` — add the new arrays to `ReviveState`.
- `src/server/mongo-store.ts` — persist new collections and create provider/event indexes.
- `src/server/conversations.ts` — upsert conversations and append safe normalized events.
- `src/server/operator-projections.ts` — create browser-safe calendar, conversation, customer, waitlist, and activity read models.
- `src/server/seed.ts` — seed a realistic operational week and private notes while leaving conversations empty.

### Provider and API boundaries

- `src/server/providers/telegram.ts` — persist real inbound and outbound Telegram messages and failures.
- `src/server/providers/offer-sender.ts` — persist the exact outbound offer wording and initiated voice calls.
- `src/server/providers/elevenlabs.ts` — parse documented transcript turns and persist call/failure events after HMAC validation.
- `src/server/app.ts` — add calendar ranges, operator authentication, appointment, availability, customer, conversation, waitlist, and activity routes.
- `src/server/runtime.ts` — inject the recorder into provider services.

### React application

- `src/web/types.ts` — define safe API display models.
- `src/web/api.ts` — implement authenticated operator requests.
- `src/web/lib/dates.ts` — period navigation and calendar range helpers.
- `src/web/components/icons.tsx` — small inline SVG icon set.
- `src/web/components/ui.tsx` — shared button, segmented control, drawer, modal, empty-state, and status primitives.
- `src/web/pages/CalendarPage.tsx` — day/week/month calendar, barber filters, details, and manual scheduling modal.
- `src/web/pages/AgentPage.tsx` — locked three-column Inbox/Waitlist/Activity workspace.
- `src/web/pages/CustomersPage.tsx` — lightweight operational customer record.
- `src/web/pages/SettingsPage.tsx` — automation policies, provider health, and reset.
- `src/web/App.tsx` — global shell, page routing, admin unlock, SSE invalidation, and authoritative refetch orchestration.
- `src/web/styles.css` — Tailwind directives and the minimal base layer.
- `tailwind.config.cjs` — REVIVE design tokens.

---

### Task 1: Normalized operator data and Mongo persistence

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/store.ts`
- Create: `src/server/conversations.ts`
- Create: `src/server/conversations.test.ts`
- Modify: `src/server/mongo-store.ts`
- Modify: `src/server/mongo-store.integration.test.ts`
- Modify: test fixtures that construct `ReviveState`

**Interfaces:**
- Produces: `Conversation`, `ConversationEvent`, `CustomerNote`, `recordConversationEvent(store, input)`, and state arrays `conversations`, `conversationEvents`, `customerNotes`.
- Consumes: existing `ReviveStore.transaction` semantics and provider/customer identifiers.

- [x] **Step 1: Write the failing normalized-conversation test**

Add a test that records two Telegram turns with the same provider conversation ID and asserts one conversation, ordered events, safe direction fields, updated preview text, and idempotency for a repeated provider event ID:

```ts
await recordConversationEvent(store, {
  customerId: "alex",
  channel: "telegram",
  conversationDirection: "inbound",
  providerConversationId: "chat-2002",
  providerEventId: "update-1",
  kind: "message",
  direction: "inbound",
  speaker: "customer",
  text: "Is the 6 PM opening still available?",
  occurredAt: now,
});
await recordConversationEvent(store, {
  customerId: "alex",
  channel: "telegram",
  conversationDirection: "inbound",
  providerConversationId: "chat-2002",
  providerEventId: "message-9",
  kind: "message",
  direction: "outbound",
  speaker: "agent",
  text: "Yes — would you like me to reserve it?",
  occurredAt: later,
});
expect(snapshot.conversations).toHaveLength(1);
expect(snapshot.conversationEvents.map((event) => event.text)).toEqual([
  "Is the 6 PM opening still available?",
  "Yes — would you like me to reserve it?",
]);
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm run test:run -- src/server/conversations.test.ts`

Expected: FAIL because the conversation types, state arrays, and recorder do not exist.

- [x] **Step 3: Add the normalized types and recorder**

Define the exact model:

```ts
export type ConversationChannel = "telegram" | "voice";
export type ConversationDirection = "inbound" | "outbound";
export type ConversationState = "active" | "completed" | "failed";
export type ConversationEventKind = "message" | "transcript" | "action" | "delivery" | "error";

export interface Conversation {
  id: string;
  customerId: string;
  channel: ConversationChannel;
  direction: ConversationDirection;
  providerConversationId: string;
  state: ConversationState;
  preview: string;
  offerId?: string;
  appointmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationEvent {
  id: string;
  conversationId: string;
  kind: ConversationEventKind;
  direction?: ConversationDirection;
  speaker: "customer" | "agent" | "system";
  text: string;
  deliveryState?: "pending" | "delivered" | "failed";
  providerEventId?: string;
  appointmentId?: string;
  refillJobId?: string;
  offerId?: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  text: string;
  author: "operator";
  createdAt: string;
}
```

`recordConversationEvent` derives a stable conversation ID from channel and provider conversation ID, deduplicates a supplied `providerEventId` inside that conversation, updates preview/state/timestamps, strips blank text, and stores only the supplied normalized metadata.

- [x] **Step 4: Extend Mongo persistence and indexes**

Add `conversations`, `conversation_events`, and `customer_notes` collections to full-state reads and transaction replacement. Create `provider_conversation_identity` on `{ channel: 1, providerConversationId: 1 }`, `conversation_event_identity` on `{ conversationId: 1, providerEventId: 1 }` with a partial filter for string IDs, and indexes for customer/timestamp reads.

- [x] **Step 5: Run persistence tests and verify GREEN**

Run: `npm run test:run -- src/server/conversations.test.ts src/server/mongo-store.integration.test.ts`

Expected: PASS with the new collections round-tripping and duplicate provider events suppressed.

- [x] **Step 6: Commit the state boundary**

Run:

```bash
git add src/domain src/server/conversations.ts src/server/conversations.test.ts src/server/mongo-store.ts src/server/mongo-store.integration.test.ts
git commit -m "feat: persist operator conversations"
```

### Task 2: Capture real Telegram and ElevenLabs activity

**Files:**
- Modify: `src/server/providers/telegram.ts`
- Modify: `src/server/providers/telegram.test.ts`
- Modify: `src/server/providers/offer-sender.ts`
- Modify: `src/server/providers/offer-sender.test.ts`
- Modify: `src/server/providers/elevenlabs.ts`
- Modify: `src/server/providers/elevenlabs.test.ts`
- Modify: `src/server/runtime.ts`

**Interfaces:**
- Consumes: `recordConversationEvent` from Task 1.
- Produces: persisted real Telegram turns, exact outbound offer copy, voice transcript turns, call completion, and call initiation failures.

- [x] **Step 1: Write failing Telegram recording tests**

Extend the webhook test to send a linked customer's Telegram message and assert that the store contains the inbound message and the exact final Backboard reply as outbound. Repeat the update and assert no duplicate conversation event. Add an outbound-offer test that asserts the composed text is persisted only after provider delivery succeeds.

- [x] **Step 2: Run Telegram tests and verify RED**

Run: `npm run test:run -- src/server/providers/telegram.test.ts src/server/providers/offer-sender.test.ts`

Expected: FAIL because provider handlers do not record conversations.

- [x] **Step 3: Record Telegram turns at delivery boundaries**

Record inbound text after actor resolution and webhook deduplication. Record outbound Backboard text with the provider message ID returned by `sendMessage`. On Backboard or transport failure, append one system error event without recording a successful delivery. `ProviderOfferSender` records the exact composed offer with `offerId` and `refillJobId` after Telegram delivery, and records a voice delivery event after ElevenLabs returns a conversation ID.

- [x] **Step 4: Write failing ElevenLabs transcript tests**

Use the documented post-call structure:

```ts
transcript: [
  { role: "agent", message: "Hi Sarah, an earlier time opened up.", time_in_call_secs: 0 },
  { role: "user", message: "Yes, please move me to five.", time_in_call_secs: 4 },
],
conversation_initiation_client_data: {
  dynamic_variables: { customer_id: "sarah", offer_id: "offer-1" },
},
```

Assert the two turns are persisted in order, roles normalize to agent/customer, the conversation is completed, and the payload remains idempotent. Add a `call_initiation_failure` assertion with safe failure text and no raw Twilio body.

- [x] **Step 5: Run ElevenLabs tests and verify RED**

Run: `npm run test:run -- src/server/providers/elevenlabs.test.ts`

Expected: FAIL because the schema ignores transcript turns and does not record calls.

- [x] **Step 6: Parse and persist voice activity**

Extend the permissive Zod post-call schema with `transcript[]` roles/messages/timing. Add `customer_id` to inbound and outbound dynamic variables. After HMAC verification and provider-event deduplication, persist transcript turns using `conversation_id`, attach only `timeInCallSeconds` as normalized metadata, record safe call completion/failure state, and preserve the existing decline-on-no-answer behavior. Never persist audio or raw metadata.

- [x] **Step 7: Run provider and webhook regression tests**

Run: `npm run test:run -- src/server/providers src/server/webhook-routes.test.ts src/server/runtime.test.ts`

Expected: PASS with existing authentication, Backboard, offer, and webhook behavior unchanged.

- [x] **Step 8: Commit real activity capture**

Run:

```bash
git add src/server/providers src/server/runtime.ts src/server/webhook-routes.test.ts
git commit -m "feat: capture real provider activity"
```

### Task 3: Seed a realistic operational week

**Files:**
- Modify: `src/server/seed.ts`
- Modify: `src/server/seed.test.ts`
- Modify: fixtures that compare reset state

**Interfaces:**
- Produces: deterministic five-day appointment density, non-conflicting extra waitlist entries, initial customer notes, and empty real-conversation collections.
- Consumes: the state arrays from Task 1 and existing `getDemoDate` behavior.

- [x] **Step 1: Write failing seed-density tests**

Assert all three barbers have confirmed appointments on at least three operational dates, the seed has at least 20 confirmed appointments, every confirmed barber/start pair is unique, Alex remains the only matching candidate for Jeremy's Monday 5–7 PM haircut opening after Sarah moves, and `conversations`/`conversationEvents` remain empty.

- [x] **Step 2: Run the seed tests and verify RED**

Run: `npm run test:run -- src/server/seed.test.ts src/server/golden-path.integration.test.ts`

Expected: FAIL on operational-week density while the existing golden path still passes.

- [x] **Step 3: Add deterministic week data**

Use the existing seven customers across Monday through Friday, allow multiple appointments on different dates, and create 20–24 confirmed appointments. Keep Jeremy Monday at 5 PM Josh, 6 PM Sarah, and 7 PM open. Add Nadia and Marco waitlist entries only for Tuesday/Thursday or non-haircut services. Seed two private operational notes, but initialize `conversations` and `conversationEvents` as empty arrays.

- [x] **Step 4: Verify ranking and reset identity preservation**

Run: `npm run test:run -- src/server/seed.test.ts src/server/golden-path.integration.test.ts src/server/app.test.ts`

Expected: PASS; Sarah remains first, Alex remains the successor candidate, and linked identities survive reset.

- [x] **Step 5: Commit the realistic seed**

Run:

```bash
git add src/server/seed.ts src/server/seed.test.ts src/server/golden-path.integration.test.ts src/server/app.test.ts
git commit -m "feat: seed a realistic shop week"
```

### Task 4: Add safe operator projections and authenticated APIs

**Files:**
- Create: `src/server/operator-projections.ts`
- Create: `src/server/operator-projections.test.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/app.test.ts`
- Modify: `src/web/types.ts`
- Modify: `src/web/api.ts`

**Interfaces:**
- Produces: `GET /api/v1/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD`, `/availability`, `/customers`, `/customers/:id`, `/conversations`, `/conversations/:id`, `/waitlist`, `/activity`; customer/note/waitlist mutations; and appointment create/reschedule/cancel operations.
- Consumes: `findAvailableSlots`, `ReviveEngine`, the Task 1 state, and a bearer operator session.

- [x] **Step 1: Write failing safe-projection tests**

Test that customer list/detail masks Telegram/phone identities, includes enriched appointments/waitlist/notes, conversation detail sorts normalized events and related domain activity, waitlist entries contain customer/service/barber labels, and no response includes `telegramChatId`, raw phone, provider secrets, actor tokens, or raw webhook metadata.

- [x] **Step 2: Run projection tests and verify RED**

Run: `npm run test:run -- src/server/operator-projections.test.ts`

Expected: FAIL because the projections do not exist.

- [x] **Step 3: Implement pure safe read models**

Create projection functions that accept `ReviveState` and return explicit display objects. Mask a phone as `••• ••• 0101` and Telegram as `Linked account`; enrich references with names; sort newest lists descending and transcript events ascending; derive active offer/refill context; never spread raw domain documents into operator responses.

- [x] **Step 4: Write failing authenticated route tests**

Assert operator endpoints return 401 without a bearer session and 200 after `POST /api/v1/admin/session`. Cover a 42-day maximum calendar range, availability for one service/date, booking/rescheduling/cancellation through `ReviveEngine`, stale-slot 409, customer consent update, note creation, waitlist pause/withdraw/note update, and SSE-visible domain events.

- [x] **Step 5: Run route tests and verify RED**

Run: `npm run test:run -- src/server/app.test.ts`

Expected: FAIL because the routes and operator scope do not exist.

- [x] **Step 6: Implement operator authentication and routes**

Change the signed token scope from `demo:reset` to `operator`, keep a one-hour expiry, and reuse it for reset. Validate every query/body with strict Zod schemas. Call `engine.book`, `engine.reschedule`, or `engine.cancel` with `{ provider: "admin" }` and `confirmed: true`. Return 409 for engine conflicts, 400/404 for safe engine errors, and explicit display models on success. Record customer, note, and waitlist changes as domain events so SSE refetches the active page.

- [x] **Step 7: Extend the typed browser client**

Add exact methods that accept the in-memory operator token and attach `Authorization: Bearer <token>` without persisting it outside `sessionStorage`. Include `getCalendarRange`, `getAvailability`, appointment mutations, customers, conversations, waitlist, activity, settings, and reset.

- [x] **Step 8: Run API/type regressions**

Run: `npm run typecheck && npm run test:run -- src/server/app.test.ts src/server/operator-projections.test.ts`

Expected: PASS with no unsafe fields in serialized fixtures.

- [x] **Step 9: Commit operator APIs**

Run:

```bash
git add src/server/app.ts src/server/app.test.ts src/server/operator-projections.ts src/server/operator-projections.test.ts src/web/types.ts src/web/api.ts
git commit -m "feat: add front desk operator APIs"
```

### Task 5: Build the Tailwind shell and shared interface system

**Files:**
- Modify: `tailwind.config.cjs`
- Modify: `index.html`
- Modify: `src/web/styles.css`
- Create: `src/web/components/icons.tsx`
- Create: `src/web/components/ui.tsx`
- Modify: `src/web/App.tsx`
- Modify: `src/web/App.test.tsx`

**Interfaces:**
- Produces: `AppPage`, `AppShell`, `OperatorGate`, `Button`, `IconButton`, `SegmentedControl`, `Drawer`, `Modal`, `EmptyState`, `StatusDot`, and `cn`.
- Consumes: the Task 4 typed `ReviveApi` and operator token.

- [x] **Step 1: Write failing shell tests**

Assert the default selected page is Calendar, the four top-level buttons are Calendar/Agent/Customers/Settings, selecting Agent shows an operator unlock form when no token exists, a successful PIN session unlocks the page, and the connection state has accessible text. Assert the old editorial copy and global legend are absent.

- [x] **Step 2: Run the shell test and verify RED**

Run: `npm run test:run -- src/web/App.test.tsx`

Expected: FAIL against the current decorative masthead/day board.

- [x] **Step 3: Configure REVIVE Tailwind tokens**

Extend Tailwind with `canvas`, `panel`, `ink`, `muted`, `line`, `revive`, `revive-dark`, `amber`, and `amber-soft`; use Instrument Sans and IBM Plex Mono; use restrained radii and a single subtle panel shadow. Add font links in `index.html`.

- [x] **Step 4: Replace the global stylesheet**

Keep only Tailwind directives, `color-scheme`, body font/background/antialiasing, focus-visible behavior, scrollbar styling, and `.calendar-card` declarations that read `--card-top`/`--card-height`. Remove every masthead, editorial, paper texture, gradient, oversized brand, and bespoke page selector.

- [x] **Step 5: Build the semantic shell in Tailwind utilities**

Use a 64-pixel white header with the compact `RE·VIVE` wordmark, centered four-item navigation, and a right-aligned live/reconnecting label. Keep page controls below the header. Store only the short-lived token in `sessionStorage`; render a calm inline operator unlock surface for protected pages and operations.

- [x] **Step 6: Run shell tests and verify GREEN**

Run: `npm run test:run -- src/web/App.test.tsx && npm run typecheck`

Expected: PASS; JSX is utility-first and `styles.css` no longer contains old semantic UI selectors.

- [x] **Step 7: Commit the Tailwind foundation**

Run:

```bash
git add tailwind.config.cjs index.html src/web/styles.css src/web/components src/web/App.tsx src/web/App.test.tsx
git commit -m "feat: build Tailwind front desk shell"
```

### Task 6: Implement Calendar day, week, month, filters, and manual scheduling

**Files:**
- Create: `src/web/lib/dates.ts`
- Create: `src/web/lib/dates.test.ts`
- Create: `src/web/pages/CalendarPage.tsx`
- Create: `src/web/pages/CalendarPage.test.tsx`
- Modify: `src/web/App.tsx`
- Modify: `src/web/App.test.tsx`

**Interfaces:**
- Produces: `CalendarView = "day" | "week" | "month"`, `periodRange`, `movePeriod`, `CalendarPage` and `AppointmentEditor`.
- Consumes: range calendar data, availability, customers, services, appointment mutations, and `onRequireOperator` from the shell.

- [x] **Step 1: Write failing date-helper tests**

Assert day range is one date, week starts Monday and ends Friday for the operational shop view, month query covers the visible six-week grid, previous/next preserve view semantics, and selecting a month cell returns Day view on that date.

- [x] **Step 2: Run date tests and verify RED**

Run: `npm run test:run -- src/web/lib/dates.test.ts`

Expected: FAIL because the period helpers do not exist.

- [x] **Step 3: Implement pure period helpers**

Use Luxon in `America/Toronto`, keep ISO dates in component state, and return `{ start, end, visibleDates }`. Never derive appointment local time with the browser's local timezone.

- [x] **Step 4: Write failing calendar interaction tests**

Cover Day/Week/Month switching, All/Jeremy/Maya/Devon filters, the Day all-barber columns, confirmed-only schedule cards, amber active refill text, appointment/refill selection, month counts, clicking a month date, period navigation, and SSE-triggered range refetch. Test the appointment modal's customer/service/barber/date selection, live availability, confirm, success close, and 409 stale-slot message.

- [x] **Step 5: Run calendar tests and verify RED**

Run: `npm run test:run -- src/web/pages/CalendarPage.test.tsx src/web/App.test.tsx`

Expected: FAIL because the page and controls do not exist.

- [x] **Step 6: Build the Tailwind calendar**

Day uses a quiet hourly grid from 10 AM–8 PM with one column per visible barber and absolutely positioned cards. Week uses Monday–Friday columns with time-aligned compact cards and barber labels only for All. Month uses a six-row grid with count and one muted load bar per date. Filter chips persist across view switches; cancelled appointments stay out of the live grid. Refill cards use pale amber and open the plain-language timeline drawer.

- [x] **Step 7: Add safe manual appointment operations**

Open a modal from `New appointment` or an appointment drawer. Require an operator token before fetching protected options. Fetch live slots after service/barber/date are selected, require an explicit final confirmation click, call the engine-backed route, and refetch the current range. Show stale conflicts inline without optimistic calendar writes.

- [x] **Step 8: Run calendar and regression tests**

Run: `npm run test:run -- src/web/lib/dates.test.ts src/web/pages/CalendarPage.test.tsx src/web/App.test.tsx src/server/app.test.ts`

Expected: PASS for all three views and manual operations.

- [x] **Step 9: Commit the calendar**

Run:

```bash
git add src/web/lib src/web/pages/CalendarPage.tsx src/web/pages/CalendarPage.test.tsx src/web/App.tsx src/web/App.test.tsx
git commit -m "feat: add multi-view front desk calendar"
```

### Task 7: Implement Agent, Customers, and Settings

**Files:**
- Create: `src/web/pages/AgentPage.tsx`
- Create: `src/web/pages/AgentPage.test.tsx`
- Create: `src/web/pages/CustomersPage.tsx`
- Create: `src/web/pages/CustomersPage.test.tsx`
- Create: `src/web/pages/SettingsPage.tsx`
- Create: `src/web/pages/SettingsPage.test.tsx`
- Modify: `src/web/App.tsx`

**Interfaces:**
- Produces: the locked Agent workspace and focused Customers/Settings pages.
- Consumes: Task 4 display models and API mutations, Task 5 primitives, and shell authorization/refetch callbacks.

- [x] **Step 1: Write failing Agent page tests**

Assert the three columns are labelled Conversations, Conversation, and Context; real Telegram/voice channel and direction labels render; transcript events are chronological; actions are plain language; raw tool JSON is absent; the right widget contains Customer, Appointment, Automation, and Private note; and an empty inbox explicitly says real interactions will appear. Cover Inbox/Waitlist/Activity tabs plus pause, remove, and note waitlist actions.

- [x] **Step 2: Run Agent tests and verify RED**

Run: `npm run test:run -- src/web/pages/AgentPage.test.tsx`

Expected: FAIL because the page does not exist.

- [x] **Step 3: Build the locked three-column Agent page**

Use `grid-cols-[280px_minmax(0,1fr)_300px]` at desktop and collapse the context widget below the transcript at tablet width. Keep the conversation list searchable and compact. Render message bubbles only for actual message/transcript events, render scheduling/delivery events as ledger rows, show safe retry/review failures, and keep takeover controls in an overflow menu without a default composer.

- [x] **Step 4: Write failing Customers tests**

Assert search filters the list, selecting a customer shows masked identity, consent/preferences, upcoming/past appointments, waitlist entries, and private notes. Cover toggling earlier-move/flexible-barber/outreach preferences and adding a trimmed private note.

- [x] **Step 5: Run Customers tests and verify RED**

Run: `npm run test:run -- src/web/pages/CustomersPage.test.tsx`

Expected: FAIL because the customer workspace does not exist.

- [x] **Step 6: Build the lightweight customer workspace**

Use a narrow searchable list and one calm detail panel. Keep identity masked by default, avoid tags/analytics/marketing UI, and refetch detail after each confirmed preference or note mutation.

- [x] **Step 7: Write failing Settings tests**

Assert every behavior-backed toggle, move limit, discount ceiling, offer expiry, four provider statuses, and PIN-authenticated demo reset render. Assert there is no prompt editor, voice laboratory, fake provider control, or analytics panel.

- [x] **Step 8: Run Settings tests and verify RED**

Run: `npm run test:run -- src/web/pages/SettingsPage.test.tsx`

Expected: FAIL because settings are still in the old drawer.

- [x] **Step 9: Build the focused Settings page**

Use two white panels: Automation and Connections, followed by a restrained demo-reset row. Save one setting at a time with a visible saved/error status. Provider cards show configured/healthy/unavailable and never expose credentials.

- [x] **Step 10: Run all web tests and commit**

Run: `npm run test:run -- src/web && npm run typecheck`

Expected: PASS for navigation, Agent, Customers, Calendar, and Settings.

Run:

```bash
git add src/web
git commit -m "feat: add agent customer and settings workspaces"
```

### Task 8: Full verification, browser QA, deployment, and integration

**Files:**
- Modify: `README.md` only if operator unlock or UI operation instructions are missing.
- Modify: `docs/superpowers/plans/2026-07-18-front-desk-redesign-implementation.md` to mark executed checkboxes.

**Interfaces:**
- Consumes: all prior tasks and the existing Railway service.
- Produces: a verified production build, browser evidence, deployed smoke checks, and a merge-ready branch.

- [x] **Step 1: Run the complete local verification suite**

Run: `npm run check`

Expected: TypeScript passes, every Vitest file passes, and Vite/tsup create the production build.

- [x] **Step 2: Start the production-shaped local runtime**

Run the built server against the configured `.env` without printing variable values. Confirm `GET /health` returns 200 and the frontend root returns the new shell.

- [x] **Step 3: Perform local Chrome QA with browser-harness**

At desktop and tablet widths, verify Calendar Day/Week/Month, each barber filter, operator unlock, appointment/refill details, Agent empty/real states, customer editing, Settings, and no visual overflow. Capture screenshots for the final handoff. Use the already-running Chrome session first.

- [x] **Step 4: Exercise the deterministic golden path**

Reset the demo, cancel Josh, advance the worker, accept Sarah, advance the successor job, accept Alex, and assert Sarah 5 PM / Alex 6 PM / Jeremy 7 PM open. Confirm SSE refetches Calendar and real provider interactions appear in Agent when the actual webhooks fire.

- [x] **Step 5: Deploy the branch to Railway**

Deploy the existing one-service Railway project without printing secrets. Wait for a terminal successful deployment, then smoke `https://revive-production-57e8.up.railway.app/health`, the root shell, an SSE connection, and an authenticated operator session.

Execution note: the clean feature snapshot reached Railway `SUCCESS`; health, HTML assets, SSE, operator auth, calendar data, and public Chrome QA passed. ElevenLabs' live REVIVE agent and HT6 number assignment were verified. A real outbound Sarah call still requires the external `SARAH_PHONE` variable, and Josh/Alex must open their private Telegram links before the live-account walkthrough.

- [x] **Step 6: Request review and finish the branch**

Review the diff against the approved spec, run `git diff --check`, inspect that no secret or `.env` is tracked, and use `superpowers:finishing-a-development-branch`. Merge the verified feature branch into `main` and push only after the completion checks remain green.

---

## Acceptance matrix

| Approved requirement | Implemented by |
| --- | --- |
| Tailwind-first visual rewrite | Tasks 5–7 |
| Calendar Day/Week/Month and barber toggle | Task 6 |
| Realistic seeded operational week | Task 3 |
| Locked three-column Agent workspace | Task 7 |
| Real Telegram and voice transcript only | Tasks 1–2, 7 |
| Lightweight customer record | Tasks 4, 7 |
| Human-visible waitlist controls | Tasks 4, 7 |
| Minimal behavior-backed settings | Tasks 4, 7 |
| Engine-backed manual scheduling | Tasks 4, 6 |
| SSE authoritative refetch | Tasks 4–7 |
| Provider/golden-path preservation | Tasks 2, 3, 8 |
| Browser and deployed acceptance | Task 8 |
