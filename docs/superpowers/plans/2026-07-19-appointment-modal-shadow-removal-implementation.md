# Appointment Modal Shadow Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the glow from New appointment and Reschedule appointment dialogs without changing any other modal styling or behavior.

**Architecture:** Update the existing shared React `Modal` shell because it is used only by the two appointment-editor variants. Lock the visual contract with the existing Calendar component test before making the one-class production edit.

**Tech Stack:** React, TypeScript, Tailwind CSS 3.4, Vitest, Testing Library

## Global Constraints

- Remove only the `shadow-panel` utility from the shared `Modal` shell.
- Preserve `modal-panel`, `rounded-[4px]`, `border`, `border-line`, `bg-panel`, positioning, overflow, animation, and dismissal behavior.
- Do not modify drawer, page-panel, Calendar-card, or event-popover shadows.
- Preserve unrelated working-tree changes in `src/web/App.tsx` and `tmp/`.

---

### Task 1: Remove the appointment modal shadow

**Files:**
- Modify: `src/web/pages/CalendarPage.test.tsx`
- Modify: `src/web/components/ui.tsx`

**Interfaces:**
- Consumes: the existing shared `Modal` component and Calendar appointment editor.
- Produces: a shadow-free modal shell with all other classes and behavior unchanged.

- [ ] **Step 1: Write the failing visual-contract assertion**

Extend the existing New appointment test:

```tsx
const dialog = screen.getByRole("dialog", { name: "New appointment" });
expect(dialog).not.toHaveClass("shadow-panel");
expect(dialog).toHaveClass("modal-panel", "rounded-[4px]", "border", "border-line", "bg-panel");
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm run test:run -- src/web/pages/CalendarPage.test.tsx`

Expected: FAIL because the shared modal still has `shadow-panel`.

- [ ] **Step 3: Remove only the shadow class**

In `src/web/components/ui.tsx`, change the shared dialog class from:

```tsx
className="modal-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[4px] border border-line bg-panel shadow-panel"
```

to:

```tsx
className="modal-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[4px] border border-line bg-panel"
```

- [ ] **Step 4: Run scoped and project-level verification**

Run:

```bash
npm run test:run -- src/web/pages/CalendarPage.test.tsx
npm run test:run -- src/web
npm run typecheck
npm run build
git diff --check
```

Expected: 7 Calendar tests pass, all web tests pass, typecheck and build exit zero, and the diff has no whitespace errors.
