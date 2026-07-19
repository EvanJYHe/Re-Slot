# Mongo Snapshot Cache Design

## Goal

Make read-only operator interactions effectively immediate while keeping MongoDB as Re-Slot's durable source of persistence. This design targets the hackathon deployment shape: one backend process is the only writer to the database.

## Root Cause

Every call to `MongoReSlotStore.read()` currently reloads the complete domain state using fourteen sequential Mongo queries. Operator pages call several read endpoints, conversation and customer selection each trigger another complete reload, and the refill worker performs two reads every second while idle. Against remote Atlas this produces roughly 0.55–0.96 seconds of server latency per request.

SSE is not streaming the records from MongoDB. It only broadcasts an invalidation event after an in-process store transaction commits.

## Design

`MongoReSlotStore` will own a `latestState` snapshot:

- Initialization loads Mongo once, or uses the seeded replacement state, before the server accepts traffic.
- `read()` returns a structured clone of `latestState` without querying Mongo.
- `transaction()` continues to read and write inside a Mongo transaction. Only after the transaction commits does it replace `latestState` with the committed state and notify subscribers.
- `replace()` similarly updates `latestState` and subscribers only after Mongo commits.
- Failed transactions never alter the cached snapshot.

This matches the existing single-writer architecture: provider webhooks, the operator UI, the engine, and the refill worker all mutate state through the same store instance. It also removes the extra full Mongo reread currently performed after every mutation.

MongoDB remains the durable backing store; no customer, conversation, appointment, or settings data is hardcoded.

## Consistency Boundary

The cache is process-local. Direct database edits or writes from another backend instance are not reflected until process restart. That trade-off is explicit and acceptable for the approved single-process hackathon deployment. The current whole-state transaction/write model is already not designed for horizontally scaled independent writers.

## Verification

- A regression test proves repeated `read()` calls reuse the initialized snapshot.
- Existing Mongo integration coverage proves transactions, replacements, subscriber notifications, and uniqueness behavior still work.
- TypeScript, the focused Mongo integration suite, and the production build pass.
- Live endpoint timings are compared before and after restart, including lists and individual conversation/customer details.

