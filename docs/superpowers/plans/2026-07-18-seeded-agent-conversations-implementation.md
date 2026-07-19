# Seeded Agent Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed five polished Agent conversations through the existing normalized backend models and apply them to the connected MongoDB.

**Architecture:** Extend `createDemoState` with stable prior-week scheduling artifacts plus five normalized conversation summaries and chronological events. Keep all records in the backend seed so existing conversation APIs and the finished Agent UI render them without frontend changes.

**Tech Stack:** TypeScript, Luxon, Fastify projections, MongoDB

## Global Constraints

- Use Liam, Ava, Mateo, Zoe, and Benjamin.
- Seed three Telegram and two voice conversations with both inbound and outbound directions.
- Preserve the current-week Josh/Sarah/Alex live walkthrough.
- Use safe `demo-` provider identifiers and no raw payloads, tokens, credentials, or audio.
- Do not modify frontend files.
- Per user request, add no new test files; verify with typecheck, seed invariants, and live API reads.

---

### Task 1: Normalized conversation seed

**Files:**
- Modify: `src/server/seed.ts`

**Interfaces:**
- Consumes: `createDemoState(options: CreateDemoStateOptions): ReSlotState`, existing `Appointment`, `RefillJob`, `OutreachOffer`, `Conversation`, and `ConversationEvent` domain types.
- Produces: five stable `Conversation` records and their chronological `ConversationEvent` ledger, plus prior-week appointment/refill context.

- [x] **Step 1: Import the normalized conversation and refill types**

Add `Conversation`, `ConversationEvent`, `OutreachOffer`, and `RefillJob` to the type imports in `src/server/seed.ts`.

- [x] **Step 2: Add a focused seed helper**

Add a pure helper with this interface:

```ts
interface AgentConversationSeed {
  appointments: Appointment[];
  refillJobs: RefillJob[];
  offers: OutreachOffer[];
  conversations: Conversation[];
  conversationEvents: ConversationEvent[];
}

function createAgentConversationSeed(input: {
  now: string;
  demoDate: string;
  timezone: string;
  haircut: Service;
}): AgentConversationSeed
```

The helper must create:

```ts
[
  { customerId: "liam", channel: "telegram", direction: "inbound" },
  { customerId: "ava", channel: "voice", direction: "outbound" },
  { customerId: "mateo", channel: "telegram", direction: "outbound" },
  { customerId: "zoe", channel: "telegram", direction: "inbound" },
  { customerId: "benjamin", channel: "voice", direction: "inbound" },
]
```

Use stable IDs such as `conversation-demo-liam`, `demo-telegram-liam`, `demo-job-liam-opening`, and `demo-offer-ava`. Timestamps must be derived from `now` with Luxon and events must be stored oldest-to-newest.

The Liam → Ava → Mateo chain uses completed prior-week refill jobs and accepted offers. Zoe gets a completed booking ledger. Benjamin gets a completed reschedule ledger. Voice events include only scalar `timeInCallSeconds` metadata.

- [x] **Step 3: Merge the helper output into `createDemoState`**

After the dense operational appointments are generated, call:

```ts
const agentSeed = createAgentConversationSeed({
  now: options.now,
  demoDate,
  timezone: options.timezone,
  haircut,
});
appointments.push(...agentSeed.appointments);
```

Return `agentSeed.refillJobs`, `agentSeed.offers`, `agentSeed.conversations`, and `agentSeed.conversationEvents` instead of empty arrays.

- [x] **Step 4: Verify the seed without adding tests**

Run:

```bash
npm run typecheck
```

Expected: exit code `0`.

Run a `tsx` seed audit that asserts:

```ts
state.conversations.length === 5
state.conversations.filter((item) => item.channel === "telegram").length === 3
state.conversations.filter((item) => item.channel === "voice").length === 2
new Set(state.conversations.map((item) => item.direction)).size === 2
state.conversationEvents.every((event) => event.text.trim() !== "")
```

Also assert zero confirmed barber/customer overlaps and that `josh-appt` and `sarah-appt` remain at 5 PM and 6 PM Monday.

- [x] **Step 5: Apply the seed to MongoDB**

Use `MongoReSlotStore.replace` with a fresh `createDemoState` result. Preserve current linked identities, Backboard thread mappings, and processed provider event IDs. Replace stale demo conversations with the five approved seeded conversations.

- [x] **Step 6: Verify the running APIs**

Read `/api/v1/conversations` and all five `/api/v1/conversations/:id` responses from `http://127.0.0.1:3100`. Expected:

- five summaries;
- three Telegram and two voice;
- both inbound and outbound directions;
- every detail has at least three chronological events;
- Ava and Mateo show completed refill context;
- no raw provider IDs or secrets appear in serialized responses.

- [x] **Step 7: Review scope**

Run `git diff --name-only` and confirm this task changed only `src/server/seed.ts` plus this plan. Do not stage, modify, or revert concurrent frontend work.
