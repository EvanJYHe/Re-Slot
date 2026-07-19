# REVIVE Frontend Polish and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a source-backed impact dashboard and rebuild Day/Week calendar presentation into a viewport-sized, 24-hour, non-clipping scheduling workspace while preserving REVIVE's current light visual identity.

**Architecture:** Add a pure dashboard projection beside the existing operator projections, expose it through one validated Fastify route, and consume it through the existing typed web API. Keep calendar data authoritative and change only rendering geometry: a fixed application workspace contains a vertically scrollable 24-hour grid with sticky headers and explicit compact/full appointment variants.

**Tech Stack:** Strict TypeScript, React, Tailwind CSS 3.4, Fastify, Luxon, MongoDB-backed `ReviveStore`, Vitest, React Testing Library, browser-harness.

## Global Constraints

- Preserve the existing light theme; no liquid glass, dark theme, gradients, or new component library.
- `Calendar` remains the default route and `Dashboard` is a persistent top-level destination.
- Day and Week expose midnight-to-midnight and keep browser-page height fixed.
- Metrics come only from authoritative `ReviveState`; do not seed fake savings.
- All behavior changes follow red-green-refactor.

---

### Task 1: Dashboard metric projection

**Files:**
- Create: `src/server/dashboard.ts`
- Create: `src/server/dashboard.test.ts`

**Interfaces:**
- Consumes: `ReviveState`, inclusive ISO local-date range, and timezone.
- Produces: `projectDashboard(state, { start, end }): DashboardProjection`.

- [ ] **Step 1: Write failing tests for empty metrics, discounts, opening fills, move-only chains, utilization, and daily reconciliation.** Build states from `createDemoState` and assert integer cents/minutes plus rounded rates.
- [ ] **Step 2: Run `npx vitest run src/server/dashboard.test.ts` and verify the module is missing.**
- [ ] **Step 3: Implement pure date-range helpers and `projectDashboard`.** Match accepted offers to completed refill jobs and services; count recovered revenue only when a timeline contains `opening_filled`.
- [ ] **Step 4: Re-run the targeted test and verify it passes.**
- [ ] **Step 5: Commit `feat: add dashboard impact metrics`.**

### Task 2: Dashboard API contract

**Files:**
- Modify: `src/server/app.ts`
- Modify: `src/server/app.test.ts`
- Modify: `src/web/types.ts`
- Modify: `src/web/api.ts`
- Modify: `src/web/api.test.ts`

**Interfaces:**
- Produces: `GET /api/v1/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD` and `ReviveApi.getDashboard(start, end)`.

- [ ] **Step 1: Add failing API tests for a valid week and invalid/reversed ranges.** Expect HTTP 200 for `2026-07-20` through `2026-07-24` and HTTP 400 for malformed or greater-than-41-day ranges.
- [ ] **Step 2: Run the targeted server/API tests and verify 404/type failures.**
- [ ] **Step 3: Add `DashboardResponse`, daily-series, recent-outcome, and KPI types; add the typed fetch method; register the validated route.** Reuse the calendar date validation rule.
- [ ] **Step 4: Run the targeted tests and typecheck.**
- [ ] **Step 5: Commit `feat: expose dashboard metrics`.**

### Task 3: Dashboard page and navigation

**Files:**
- Create: `src/web/pages/DashboardPage.tsx`
- Create: `src/web/pages/DashboardPage.test.tsx`
- Modify: `src/web/App.tsx`
- Modify: `src/web/App.test.tsx`
- Modify: `src/web/components/icons.tsx`

**Interfaces:**
- Consumes: `ReviveApi.getDashboard`, `refreshKey`, and the operational-week date range.
- Produces: a Dashboard destination with KPI cards, native SVG/CSS daily chart, recent outcomes, loading, empty, and error states.

- [ ] **Step 1: Write failing component tests for navigation, currency/rate formatting, daily labels, live refetch, and honest zero state.**
- [ ] **Step 2: Run the Dashboard/App tests and verify expected missing-page failures.**
- [ ] **Step 3: Implement the page and add the fifth shell destination without changing Calendar's default selection.**
- [ ] **Step 4: Run targeted tests and typecheck.**
- [ ] **Step 5: Commit `feat: add operator impact dashboard`.**

### Task 4: Viewport-sized 24-hour calendar

**Files:**
- Modify: `src/web/pages/CalendarPage.tsx`
- Modify: `src/web/pages/CalendarPage.test.tsx`
- Modify: `src/web/App.tsx`
- Modify: `src/web/styles.css`

**Interfaces:**
- Day and Week render `data-start-hour="0"`, `data-end-hour="24"`, `data-calendar-scroll-region`, sticky headers, and no `overflow-x-auto` desktop wrapper.

- [ ] **Step 1: Add failing tests asserting 12 AM and 11 PM labels, 24-hour geometry markers, a dedicated vertical scroll region, and absence of the old horizontal-scroll class.** Add a 30-minute beard appointment and assert `data-density="compact"` with one visible line.
- [ ] **Step 2: Run `npx vitest run src/web/pages/CalendarPage.test.tsx` and verify failures describe the old 10–20 geometry/clipping behavior.**
- [ ] **Step 3: Set calendar geometry to 0–24, wrap header/body in a viewport-height workspace, make headers sticky, remove the rounded shadow container and desktop horizontal scroll, and auto-position the scroll region near the earliest event.**
- [ ] **Step 4: Implement explicit compact/full card markup based on appointment duration.** Compact copy is `${customerName} · ${serviceName}` on one line; full copy uses two lines.
- [ ] **Step 5: Run targeted tests and typecheck.**
- [ ] **Step 6: Commit `fix: make calendar viewport sized and legible`.**

### Task 5: Shell and overlay polish

**Files:**
- Modify: `src/web/App.tsx`
- Modify: `src/web/components/ui.tsx`
- Modify: `src/web/App.test.tsx`
- Create or modify: `src/web/components/ui.test.tsx`

**Interfaces:**
- `Drawer` and `Modal` close on Escape and lock document overflow while mounted.

- [ ] **Step 1: Write failing tests for Escape dismissal, scroll locking/restoration, and compact navigation at narrower desktop widths.**
- [ ] **Step 2: Run targeted tests and verify the missing behaviors.**
- [ ] **Step 3: Add the shared overlay lifecycle and refine shell breakpoints/labels without changing page behavior.**
- [ ] **Step 4: Run targeted tests and typecheck.**
- [ ] **Step 5: Commit `fix: polish shell and overlays`.**

### Task 6: Full verification and browser QA

**Files:**
- Modify only files required by evidence from verification.

- [ ] **Step 1: Run `npm run check` and fix only regressions caused by this branch.**
- [ ] **Step 2: Run the built service on an unused local port with MongoDB and verify `/health`, `/api/v1/dashboard`, and the React shell.**
- [ ] **Step 3: Use browser-harness at 1512×753 to verify Dashboard, Day/Week/Month, All/single barber, 30-minute cards, vertical grid scrolling, no horizontal overflow, modal/drawer Escape, Agent, Customers, and Settings.**
- [ ] **Step 4: Repeat layout checks at a narrower desktop viewport and confirm `documentElement.scrollWidth === clientWidth`.**
- [ ] **Step 5: Commit any evidence-driven fixes, then record final `git status`, test count, and branch name.**
