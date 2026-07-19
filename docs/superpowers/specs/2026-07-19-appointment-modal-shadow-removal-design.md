# Appointment Modal Shadow Removal Design

## Goal

Remove the glow around the New appointment dialog so it sits cleanly over the Calendar.

## Design

Remove the `shadow-panel` utility from the shared `Modal` shell in `src/web/components/ui.tsx`. This shared shell is used only by the New appointment and Reschedule appointment flows, so both variants will receive the same flat treatment.

Keep the modal's white background, thin border, 4px corner radius, opening animation, positioning, overflow behavior, and dismissal behavior unchanged. Do not change the form controls, buttons, Calendar cards, drawer shadows, page-panel shadows, or event popover shadow.

## Verification

- Add a focused Calendar component assertion that the New appointment dialog has no shadow utility.
- Confirm the dialog retains its border, background, 4px radius, and animation hook.
- Run the Calendar tests, web test suite, typecheck, and production build.
- Attempt visual inspection through the configured browser harness when an attachable browser is available.
