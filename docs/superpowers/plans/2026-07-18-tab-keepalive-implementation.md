# Tab Keep-Alive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve already visited front-desk pages across navigation so repeat tab switches are immediate and do not refetch solely because of remounting.

**Architecture:** `DashboardApp` owns a small visited-page set. It mounts a destination on first visit and retains it in a native `hidden` container afterward, leaving each page's existing fetching and domain-event invalidation logic intact.

**Tech Stack:** React, TypeScript, Vite, browser-harness.

## Global Constraints

- Do not add a client caching dependency.
- Do not preload every page at startup.
- Do not add new automated tests, per the user's request.
- Preserve existing SSE/domain-event refreshes and mutation refresh behavior.
- Preserve unrelated working-tree changes.

---

### Task 1: Retain Visited Page Instances

**Files:**
- Modify: `src/web/App.tsx`

**Interfaces:**
- Consumes: `AppPage`, the existing `page` state, page components, and `domainVersion` refresh props.
- Produces: A `visitedPages` state set and navigation/rendering behavior that keeps visited destinations mounted while hiding inactive ones.

- [x] **Step 1: Track destination visits in the app shell**

Initialize a `ReadonlySet<AppPage>` with Calendar and update it before selecting a destination:

```tsx
const [visitedPages, setVisitedPages] = useState<ReadonlySet<AppPage>>(
  () => new Set<AppPage>(["calendar"]),
);

const navigateTo = (destination: AppPage) => {
  setVisitedPages((current) => current.has(destination)
    ? current
    : new Set([...current, destination]));
  setPage(destination);
};
```

- [x] **Step 2: Keep visited pages mounted and hide inactive pages**

Replace active-page-only conditionals with native hidden containers. Calendar is always mounted; the other destinations mount only after their first visit:

```tsx
<div hidden={page !== "calendar"}>
  <CalendarPage {...existingCalendarProps} />
</div>
{visitedPages.has("agent") ? (
  <div hidden={page !== "agent"}>
    <AgentPage api={api} refreshKey={domainVersion} />
  </div>
) : null}
```

Apply the same wrapper pattern to Customers and Settings without changing their current props or callbacks.

- [x] **Step 3: Run static and production verification**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit with status 0.

- [x] **Step 4: Verify repeat navigation in Chrome**

Using browser-harness against `http://127.0.0.1:5174/`, visit Customers, return to Calendar, clear resource timings, and revisit Customers.

Expected: the retained customer record appears without an `.animate-pulse` loading skeleton, and the return navigation creates no `/api/v1/customers` resource entries.

- [x] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git diff -- src/web/App.tsx docs/superpowers/specs/2026-07-18-tab-keepalive-design.md docs/superpowers/plans/2026-07-18-tab-keepalive-implementation.md
```

Expected: no whitespace errors and no unrelated files in the scoped diff.
