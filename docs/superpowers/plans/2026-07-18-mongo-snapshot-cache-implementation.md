# Mongo Snapshot Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve operator and worker reads from the latest committed in-process snapshot while MongoDB remains durable persistence.

**Architecture:** `MongoReSlotStore` primes one `ReSlotState` snapshot during initialization. Reads clone that snapshot; successful transactions and replacements atomically publish their committed state to the snapshot and existing subscribers.

**Tech Stack:** TypeScript, MongoDB Node.js driver, Vitest, mongodb-memory-server.

## Global Constraints

- One backend process is the only MongoDB writer.
- Do not hardcode domain or demo data in the read path.
- Do not alter endpoint response contracts or SSE events.
- Do not modify unrelated Calendar worktree changes.

---

### Task 1: Prove Snapshot Reuse

**Files:**
- Modify: `src/server/mongo-store.integration.test.ts`

**Interfaces:**
- Consumes: `MongoReSlotStore.initialize()` and `MongoReSlotStore.read()`.
- Produces: Regression coverage that repeated reads do not reload Mongo state.

- [x] **Step 1: Add a failing repeated-read test**

Spy on the store's private runtime `readState` method after initialization, call `read()` twice, and assert the two returned values are isolated clones while no new Mongo read occurs:

```ts
it("serves isolated reads from the initialized snapshot", async () => {
  const readState = vi.spyOn(
    store as unknown as { readState(): Promise<ReSlotState> },
    "readState",
  );

  const first = await store.read();
  first.customers[0]!.name = "Changed outside the store";
  const second = await store.read();

  expect(second.customers[0]!.name).toBe("Alex");
  expect(readState).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm run test:run -- src/server/mongo-store.integration.test.ts
```

Expected: the new test fails because `readState` is called twice.

### Task 2: Publish the Latest Committed Snapshot

**Files:**
- Modify: `src/server/mongo-store.ts`

**Interfaces:**
- Consumes: `ReSlotState`, Mongo transaction commit semantics, and existing store subscribers.
- Produces: `latestState`, a snapshot publishing helper, and memory-backed `read()` behavior.

- [x] **Step 1: Prime and clone the initialized snapshot**

Add `latestState`, populate it from Mongo during initialization when data already exists, and make `read()` throw before initialization rather than silently performing repeated database loads.

- [x] **Step 2: Publish transaction state only after commit**

Capture the state successfully written by the transaction callback. After `withTransaction()` resolves, publish that state to `latestState`, notify subscribers with isolated clones, and return the isolated result. Do not perform the current post-commit Mongo reread.

- [x] **Step 3: Publish replacement state only after commit**

Clone the replacement before writing, publish it after `withTransaction()` resolves, and notify subscribers without rereading Mongo.

- [x] **Step 4: Run focused Mongo integration coverage**

Run:

```bash
npm run test:run -- src/server/mongo-store.integration.test.ts
```

Expected: all Mongo store integration tests pass.

### Task 3: Verify Runtime Performance

**Files:**
- No code changes.

**Interfaces:**
- Consumes: the running Mongo-backed backend on port 3100.
- Produces: measured API latency evidence for tab and record-detail reads.

- [x] **Step 1: Run static and production checks**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit with status 0.

- [x] **Step 2: Restart the Mongo-backed backend and time endpoints**

Measure Calendar, Customers, Conversations, Waitlist, Activity, Settings, one conversation detail, and one customer detail.

Expected: warmed read endpoints complete in tens of milliseconds or less instead of roughly 0.55–0.96 seconds.

- [x] **Step 3: Verify in Chrome**

Use browser-harness to switch tabs, conversations, and customers against the restarted backend.

Expected: retained tabs switch immediately and first-time detail selections no longer show a perceptible database wait.

- [x] **Step 4: Review the scoped diff**

Run `git diff --check` and inspect only the snapshot-cache files and documentation. Preserve unrelated worktree changes.

## Execution Results

- Mongo integration coverage: 6 tests passed.
- TypeScript and production build: passed.
- Atlas-backed endpoints improved from 0.54–0.78 seconds to 1.1–7.7 milliseconds.
- Chrome interaction timings: Agent first visit 38.9 ms, conversation switch 15.2 ms, Customers first visit 44.5 ms, customer switch 23.5 ms, and retained Agent return 28.3 ms with no request.
- The full suite has 13 pre-existing seed/projection expectation failures introduced before this change; representative failures were reproduced on untouched `main`.
