# Decorative Dot and Panel Radius Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove decorative status dots and give only the application’s outer panel and modal shells subtly softened 4px corners.

**Architecture:** Keep the change local to existing React components and Tailwind utility classes. Remove the shared decorative-dot primitive, preserve meaningful warning state with text or border treatment, and apply `rounded-[4px]` only to explicitly approved outer shells rather than changing the global radius token.

**Tech Stack:** React, TypeScript, Tailwind CSS 3.4, Vitest, Testing Library

## Global Constraints

- Calendar layout, card geometry, and functional circular selectors remain unchanged.
- Nested cards, inputs, selects, buttons, badges, message bubbles, alerts, skeletons, and segmented controls retain their current radii.
- Only Customers, Agent, Settings, and shared modal outer shells change from 12px to 4px corners.
- Existing uncommitted Customers page changes are user-owned and must be preserved.
- No state may be communicated by color alone.

---

### Task 1: Remove Agent decorative dots and preserve state meaning

**Files:**
- Modify: `src/web/pages/AgentPage.test.tsx`
- Modify: `src/web/pages/AgentPage.tsx`
- Modify: `src/web/components/ui.tsx`

**Interfaces:**
- Consumes: `ConversationSummary.hasException`, `ConversationEvent.kind`, and `ConversationEvent.deliveryState`.
- Produces: explicit `Exception` copy for exceptional conversation rows and dot-free Agent event/activity layouts.

- [ ] **Step 1: Write failing Agent tests**

Set one fixture’s `hasException` to `true`, then assert that the row renders `Exception` explicitly. Capture the render container and assert that decorative green and amber dot utility combinations are absent. Assert that the inbox, waitlist, and activity outer shells use `rounded-[4px]` after visiting each tab.

```tsx
const { container } = render(<AgentPage api={api()} refreshKey={0} />);
expect(await screen.findByText("Exception")).toBeInTheDocument();
expect(container.querySelector(".rounded-full.bg-revive")).toBeNull();
expect(container.querySelector(".rounded-full.bg-amber")).toBeNull();
expect(screen.getByRole("region", { name: "Agent inbox" })).toHaveClass("rounded-[4px]");
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm run test:run -- src/web/pages/AgentPage.test.tsx`

Expected: FAIL because `Exception` and the `Agent inbox` region are absent and dot elements still render.

- [ ] **Step 3: Implement the Agent cleanup**

In `AgentPage.tsx`:

- remove `StatusDot` from the import;
- render the word `Exception` when `conversation.hasException` is true;
- remove the leading ledger dot and simplify the grid to centered event text plus timestamp;
- retain warning meaning with amber border/text classes on the ledger container;
- render automation state as text only;
- remove the activity dot column and use a two-column message/time layout;
- apply `rounded-[4px]` to the inbox, waitlist, and activity outer shells;
- add `aria-label="Agent inbox"` and `role="region"` to the inbox shell.

Delete `StatusDot` from `src/web/components/ui.tsx` after all imports are removed.

- [ ] **Step 4: Run the focused test and verify success**

Run: `npm run test:run -- src/web/pages/AgentPage.test.tsx`

Expected: all AgentPage tests PASS.

### Task 2: Remove Calendar decorative dots without changing Calendar geometry

**Files:**
- Modify: `src/web/pages/CalendarPage.test.tsx`
- Modify: `src/web/pages/CalendarPage.tsx`

**Interfaces:**
- Consumes: existing refill card, month-cell refill state, and refill timeline data.
- Produces: the same Calendar interactions and content with no decorative marker dots.

- [ ] **Step 1: Write failing Calendar tests**

Extend the refill drawer test to assert that the refill card and timeline do not contain marker elements while keeping their labels and messages visible.

```tsx
const refillCard = screen.getByRole("button", { name: /Waiting for Sarah/ });
expect(refillCard.querySelector(".rounded-full")).toBeNull();
await user.click(refillCard);
const refill = screen.getByRole("dialog", { name: "Refill timeline" });
expect(refill.querySelector(".rounded-full.bg-revive")).toBeNull();
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm run test:run -- src/web/pages/CalendarPage.test.tsx`

Expected: FAIL because the refill card and timeline still contain dot spans.

- [ ] **Step 3: Implement the Calendar dot cleanup**

In `CalendarPage.tsx`:

- remove `StatusDot` from the import;
- remove the white dot from the `Open chair` label without changing the refill card radius, position, size, or color;
- remove the warning dot from month cells while retaining the date and appointment-count treatment;
- remove the green timeline dots while retaining the vertical timeline rule and spacing;
- leave the functional barber-filter circles and all progress bars untouched.

- [ ] **Step 4: Run the focused test and verify success**

Run: `npm run test:run -- src/web/pages/CalendarPage.test.tsx`

Expected: all CalendarPage tests PASS.

### Task 3: Tighten only outer Customers, Settings, and modal shells

**Files:**
- Modify: `src/web/pages/CustomersPage.test.tsx`
- Modify: `src/web/pages/CustomersPage.tsx`
- Modify: `src/web/pages/SettingsPage.test.tsx`
- Modify: `src/web/pages/SettingsPage.tsx`
- Modify: `src/web/pages/CalendarPage.test.tsx`
- Modify: `src/web/components/ui.tsx`

**Interfaces:**
- Consumes: existing page and shared modal markup.
- Produces: `rounded-[4px]` on approved outer shells only.

- [ ] **Step 1: Write failing shell-radius tests**

Assert the Customers summary and workspace parents, Settings section shells, and shared modal shell use `rounded-[4px]`. Also assert representative nested inputs retain `rounded-revive`.

```tsx
const allCustomers = await screen.findByRole("button", { name: /All customers/ });
expect(allCustomers.parentElement).toHaveClass("rounded-[4px]");
expect(screen.getByRole("searchbox")).toHaveClass("rounded-revive");

const automation = screen.getByRole("heading", { name: "Automation" }).closest("section");
expect(automation).toHaveClass("rounded-[4px]");

const dialog = screen.getByRole("dialog", { name: "New appointment" });
expect(dialog).toHaveClass("rounded-[4px]");
expect(within(dialog).getByLabelText("Customer")).toHaveClass("rounded-revive");
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test:run -- src/web/pages/CustomersPage.test.tsx src/web/pages/SettingsPage.test.tsx src/web/pages/CalendarPage.test.tsx`

Expected: FAIL because approved outer shells still use `rounded-xl`.

- [ ] **Step 3: Implement targeted 4px shell corners**

Replace `rounded-xl` with `rounded-[4px]` only on:

- the Customers funnel summary shell and customer workspace shell;
- the Settings Automation and Demo week section shells;
- the shared `Modal` section in `src/web/components/ui.tsx`.

Preserve the user’s concurrent Customers booking-section changes. Do not replace any nested `rounded-xl`, `rounded-revive`, `rounded-lg`, or `rounded-full` classes outside the approved shells.

- [ ] **Step 4: Run the focused tests and verify success**

Run: `npm run test:run -- src/web/pages/CustomersPage.test.tsx src/web/pages/SettingsPage.test.tsx src/web/pages/CalendarPage.test.tsx`

Expected: all focused tests PASS.

### Task 4: Verify the complete UI cleanup

**Files:**
- Verify: `src/web/**/*.tsx`

**Interfaces:**
- Consumes: all changes from Tasks 1–3.
- Produces: verified build with no decorative-dot primitive or unintended radius changes.

- [ ] **Step 1: Search for forbidden remnants**

Run: `rg -n "StatusDot|rounded-full bg-(revive|amber|white)" src/web`

Expected: no `StatusDot` occurrences and no decorative dot combinations. Functional circular controls and progress bars may remain when they do not match the forbidden combinations.

- [ ] **Step 2: Run static and automated verification**

Run: `npm run check`

Expected: TypeScript, full Vitest suite, and production build all PASS.

- [ ] **Step 3: Inspect the running UI in local Chrome**

Use `browser-harness` against the user’s existing Chrome session. Inspect Customers, Agent inbox/waitlist/activity, Settings, a Calendar refill card/drawer, and a shared modal.

Expected: decorative dots are absent; approved outer shells have subtle 4px corners; Calendar geometry, functional selectors, fields, buttons, badges, nested cards, and message bubbles are visually unchanged.

- [ ] **Step 4: Review the final diff without disturbing user changes**

Run: `git diff --check && git status --short && git diff -- src/web`

Expected: no whitespace errors; only scoped UI/test changes plus the pre-existing user-owned Customers edits are present.
