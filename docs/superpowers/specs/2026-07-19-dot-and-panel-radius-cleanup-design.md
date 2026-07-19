# Decorative Dot and Panel Radius Cleanup Design

## Goal

Make the interface feel less generically AI-styled by removing the repeated decorative dot motif and reducing the curvature of major application surfaces. The change must preserve the existing layout, behavior, and comfortable rounding of controls and nested content.

## Scope

### Decorative dots

Remove non-interactive dot markers throughout the UI, including:

- healthy and warning dots rendered by the shared `StatusDot` component;
- ledger-event dots in the Agent conversation transcript;
- activity-list dots in the Agent activity view;
- the open-chair dot, refill warning dot, and refill-timeline dots in Calendar.

Functional circular controls remain unchanged. This includes barber-filter selectors, checkboxes, date buttons, and other controls whose shape communicates interaction or selection.

Where a dot currently carries meaning rather than decoration, preserve that meaning without another icon motif:

- conversation exceptions use explicit text;
- failed or warning ledger events use restrained amber border/text styling;
- states already written in text remain text-only.

### Main panel borders

Reduce only the outer corner radius of major bordered surfaces from 12px to 4px:

- Customers summary and customer workspace shells;
- Agent inbox, waitlist, and activity shells;
- Settings section shells;
- the shared modal shell.

Do not change the radius of nested cards, appointment groups, inputs, selects, buttons, badges, message bubbles, alerts, skeletons, or segmented controls. Drawers remain edge-aligned. Calendar geometry and card styling remain unchanged apart from decorative-dot removal.

## Implementation Approach

Use explicit `rounded-[4px]` utility classes on the approved outer shells. This keeps the change local and prevents a global radius-token edit from affecting controls or Calendar.

Remove `StatusDot` after its remaining call sites are removed. Adjust affected layouts so deleted dot columns and gaps do not leave empty space. Keep all data flow, interactions, API contracts, and responsive breakpoints unchanged.

## Accessibility

No state may be communicated by color alone. Conversation exceptions receive visible wording, and warning ledger events retain readable content with a secondary amber treatment. Functional selection controls keep their existing semantics and appearance.

## Verification

- Update or add component tests for explicit exception wording and dot-free affected structures.
- Verify that major Customers, Agent, Settings, and modal shells use 4px rounding.
- Run the relevant web component tests, TypeScript checks, and the full test suite if practical.
- Inspect the affected pages in the existing local Chrome session to confirm that nested controls and Calendar geometry did not change.

## Non-goals

- Redesigning page layout, spacing, typography, colors, or shadows.
- Changing business logic, API behavior, or stored data.
- Flattening nested UI elements or text-entry controls.
- Removing functional circular selectors or changing Calendar structure.
