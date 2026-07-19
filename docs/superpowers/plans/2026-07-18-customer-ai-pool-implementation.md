# Customer AI Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a demo-ready customer intelligence pool with clear booked, waitlisted, outreach-ready, and recurring-customer context backed by believable seed data.

**Architecture:** Derive CRM state from the existing customer, appointment, and waitlist collections inside the operator projection layer. Keep the agent path unchanged, then present the derived contract in the existing Customers page with a compact funnel, state filters, and relationship evidence.

**Tech Stack:** TypeScript, Luxon, React, Tailwind CSS, Vitest, Testing Library

## Global Constraints

- Do not change agent prompts, conversation context, refill candidate ranking, or provider behavior.
- Preserve the dense calendar and seeded conversation showcase.
- Do not expose raw phone numbers, Telegram IDs, or provider identifiers.
- Use derived relationship facts rather than persisted denormalized CRM fields.
- Keep existing preference and private-note mutations working.

---

### Task 1: Derived customer intelligence contract

**Files:**
- Modify: `src/server/operator-projections.test.ts`
- Modify: `src/server/operator-projections.ts`
- Modify: `src/web/types.ts`

**Interfaces:**
- Consumes: `ReSlotState.customers`, `appointments`, `waitlist`, `barbers`, and `services`
- Produces: enriched `CustomerSummary` fields and `CustomerDetail.relationship`

- [ ] **Step 1: Write failing projection expectations**

Add assertions that Sarah is booked, Alex is waitlisted when he has no future booking, a returning opted-in customer is outreach-ready, past appointments produce last-visit and visit-count values, and the earliest future confirmed appointment is selected.

- [ ] **Step 2: Run the focused projection test and verify RED**

Run: `npm run test:run -- src/server/operator-projections.test.ts`

Expected: failure because `bookingState`, relationship history, and `matchReason` do not exist.

- [ ] **Step 3: Implement one shared customer-intelligence derivation**

Add a private helper in `operator-projections.ts` that accepts state, customer ID, and a reference time, separates past and future confirmed appointments, counts active waitlist entries, finds usual service/barber by frequency, and returns the specified state plus display facts. Reuse it in list and detail projections.

- [ ] **Step 4: Extend frontend types**

Add a `CustomerBookingState` union and the new fields to `CustomerSummary` and `CustomerDetail.relationship` in `src/web/types.ts`.

- [ ] **Step 5: Run the focused projection test and verify GREEN**

Run: `npm run test:run -- src/server/operator-projections.test.ts`

Expected: all projection tests pass.

### Task 2: Credible recurring-customer seed

**Files:**
- Modify: `src/server/seed.test.ts`
- Modify: `src/server/seed.ts`

**Interfaces:**
- Consumes: `seededAppointment`, services, barbers, and demo-date helpers
- Produces: a larger customer CRM pool, a bounded current booking pool, historical visits, and additional active waitlist requests

- [ ] **Step 1: Write failing seed distribution expectations**

Assert that total customers exceed distinct future-booked customers, all four booking states can be derived, several customers have at least three historical confirmed visits, and current-week occupancy remains between 70% and 80%.

- [ ] **Step 2: Run the focused seed test and verify RED**

Run: `npm run test:run -- src/server/seed.test.ts`

Expected: the distribution assertions fail because nearly every seeded customer currently has a future reservation and most lack visit history.

- [ ] **Step 3: Bound the dense-calendar customer pool**

Mark a subset of seeded customers as current-booking customers and make `fillBusyWeek` rotate only through that group. Keep the existing explicit golden-path customers and barber occupancy targets.

- [ ] **Step 4: Add returning-customer history and waitlist-only demand**

Generate deterministic prior visits for regulars before the demo week, using stable service and barber preferences. Add active waitlist entries for customers without future bookings and set a useful mix of outreach consent values.

- [ ] **Step 5: Run the focused seed test and verify GREEN**

Run: `npm run test:run -- src/server/seed.test.ts`

Expected: the new distribution checks pass; any older seed assertions that intentionally contradict the already-approved dense/conversation seed are documented separately as baseline debt.

### Task 3: Customer intelligence page

**Files:**
- Modify: `src/web/pages/CustomersPage.test.tsx`
- Modify: `src/web/pages/CustomersPage.tsx`

**Interfaces:**
- Consumes: enriched `CustomerSummary[]` and `CustomerDetail.relationship`
- Produces: funnel metrics, state filters, unambiguous customer rows, and relationship summary cards

- [ ] **Step 1: Write failing page expectations**

Update fixtures with booked, waitlisted, outreach-ready, and ineligible examples. Assert visible funnel counts, filters, booking-state labels, match rationale, last visit, visit count, and next/requested scheduling context.

- [ ] **Step 2: Run the focused page test and verify RED**

Run: `npm run test:run -- src/web/pages/CustomersPage.test.tsx`

Expected: failure because the funnel, filters, and relationship summary are not rendered.

- [ ] **Step 3: Implement funnel and customer-pool filters**

Render four compact metrics above the record workspace. Add state-filter buttons beside search and filter the already-loaded summaries without additional API calls.

- [ ] **Step 4: Implement state-led customer rows and detail header**

Replace the waitlist-only pill with state badges and relevant row copy. Add a relationship section that explains current state, next reservation or waitlist request, last visit, total visits, usual service/barber, contact channel, and the deterministic match reason.

- [ ] **Step 5: Preserve existing record actions**

Keep preference toggles, appointments, waitlist history, private notes, search, and selected-record behavior intact.

- [ ] **Step 6: Run the focused page test and verify GREEN**

Run: `npm run test:run -- src/web/pages/CustomersPage.test.tsx`

Expected: all customer-page tests pass without console warnings.

### Task 4: Seed application and final verification

**Files:**
- Modify: no additional source files expected

**Interfaces:**
- Consumes: configured application datastore and completed source changes
- Produces: populated demo database plus verification evidence

- [ ] **Step 1: Run focused tests**

Run: `npm run test:run -- src/server/operator-projections.test.ts src/server/seed.test.ts src/web/pages/CustomersPage.test.tsx`

Expected: all new/updated customer-intelligence expectations pass; any unrelated baseline assertions remain called out explicitly.

- [ ] **Step 2: Run static and production verification**

Run: `npm run typecheck && npm run build`

Expected: both commands exit successfully.

- [ ] **Step 3: Apply the demo reset/seed**

Use the repository's configured reset path or datastore seed mechanism so the active database receives the new customer pool. Do not print secrets.

- [ ] **Step 4: Audit the resulting distribution**

Read the customer-list API or seeded state and report totals for all customers, booked customers, waitlisted-only customers, outreach-ready customers, and customers with recurring history. Confirm total customers exceeds booked customers.

- [ ] **Step 5: Inspect the browser UI**

Use `browser-harness` against the user's running Chrome to open the local Customers page, verify the funnel and state filters, and capture any visible layout regressions before completion.

