# REVIVE frontend polish and impact dashboard

**Status:** Approved for implementation through direct visual feedback
**Audience:** A front-desk owner supervising REVIVE during the hackathon demo

## Objective

Polish the existing light REVIVE interface without replacing its information architecture or applying the previously discussed dark/liquid-glass theme. Add a compact, source-backed impact dashboard and make the calendar behave like a professional desktop scheduling surface: it fills the available application viewport, exposes a complete 24-hour timeline, avoids browser-page and horizontal overflow, and keeps short appointments legible.

## Visual direction

- Preserve the current near-white canvas, charcoal text, muted green committed state, and amber refill state.
- Keep Instrument Sans and IBM Plex Mono.
- Improve hierarchy through spacing, typography, alignment, borders, and interaction states rather than decorative effects.
- Use Tailwind utilities and the existing token layer. Do not add a component library, dark theme, glass effects, gradients, or ornamental dashboard elements.
- Keep the interface desktop-first and professional, with graceful tablet behavior.

## Application shell

- Keep the REVIVE wordmark, top navigation, and live-connection indicator.
- Add `Dashboard` as a top-level destination while preserving `Calendar` as the default page.
- The production-shaped local application is built and served by Fastify at `http://localhost:3100`; Vite at `http://localhost:5174` remains the real React development server, not a prototype.
- On Calendar, the shell and toolbar fit within the viewport. The browser document itself must not grow because of the time grid.

## Calendar behavior

### Viewport and scrolling

- Day and Week use a 24-hour timeline from midnight through midnight.
- The calendar occupies the remaining viewport below the global header and calendar toolbar.
- Only the time-grid body scrolls vertically, matching the Google Calendar desktop pattern. The browser page does not scroll to reach later hours.
- Column headers and the time ruler remain sticky while the grid scrolls.
- On first entry or date/view change, the grid positions itself one hour before the earliest confirmed appointment or active refill, capped to a useful morning default when no event exists.
- The grid must not produce a horizontal scrollbar at the 1512px demo viewport. All-barber Day and five-day Week columns share the available width; a selected barber expands to the full schedule width.

### Appointment cards

- Appointment height remains proportional to duration.
- Appointments shorter than 45 minutes use one compact line containing customer and service; the detail drawer remains available on click.
- Appointments of 45 minutes or longer show customer and service on separate lines when space permits.
- Text must never be visibly cut midway through a line. Use explicit compact/full variants instead of relying on `overflow: hidden` to mask excess content.
- Cards show a clear hover/focus state and preserve at least a practical clickable target without visually claiming a longer appointment duration.

### Calendar surface

- Remove the rounded, shadowed outer card treatment that makes the calendar look embedded in an iframe.
- Keep a subtle top/side boundary and grid lines, but let the calendar align directly with the page content.
- Remove nested horizontal scrolling on the supported desktop viewport.
- Preserve Day, Week, Month, date navigation, Today, barber filters, appointment creation, appointment details, and refill timelines.

## Dashboard

Add `GET /api/v1/dashboard?start=YYYY-MM-DD&end=YYYY-MM-DD` and a Dashboard page backed by authoritative `ReviveState` data.

### Metric definitions

- **Recovered revenue:** Sum of service price after discount for accepted offers that filled an opening. A move-earlier offer does not count as recovered revenue until its successor opening is filled.
- **Confirmed revenue:** Sum of service price after appointment discount for confirmed appointments whose start time falls in the selected range.
- **Chairs recovered:** Count of completed refill jobs whose timeline contains `opening_filled`.
- **Refill success rate:** Completed opening-filling refill jobs divided by terminal refill jobs (`completed`, `exhausted`, or `failed`). Move-only intermediate jobs are excluded from the numerator.
- **Average refill time:** Mean elapsed time from creation to completion for completed opening-filling jobs.
- **Chair utilization:** Confirmed appointment minutes divided by available barber working minutes in the selected range.
- **Active waitlist:** Count of active or offered waitlist entries.
- **Active recoveries:** Count of refill jobs in pending, leased, or awaiting-offer states.

The API also returns a daily series for confirmed revenue and recovered revenue plus recent accepted/refill outcomes. Values are calculated from MongoDB-backed domain state and must reconcile with displayed appointments, services, offers, and refill jobs. Empty data displays zero with honest explanatory copy; no fake savings are seeded.

### Dashboard layout

- Compact period header with current operational week as the default.
- One primary recovered-revenue card, followed by confirmed revenue, chairs recovered, utilization, and refill-speed/supporting metrics.
- One simple weekly revenue chart built with native React/CSS or SVG; do not add a charting dependency.
- One recent outcomes list for operator context.
- Keep the page scannable and consistent with the existing Calendar, Agent, Customers, and Settings pages.

## UI quality fixes

- Modal and drawer surfaces close on Escape, label themselves correctly, and prevent accidental background-page scrolling while open.
- Loading, empty, stale, and error states retain stable layout and do not flash misleading content.
- Top navigation remains usable at narrower desktop/tablet widths without colliding with the connection indicator.
- Focus states remain visible and controls retain accessible names.

## Testing

- Unit tests cover dashboard metric calculations, including discount arithmetic, move-only jobs, terminal failures, utilization, empty ranges, and daily reconciliation.
- API tests cover dashboard range validation and response shape.
- React tests cover Dashboard navigation/rendering, 24-hour Day/Week grids, compact short appointments, sticky/full-height calendar structure, and absence of the old nested horizontal-scroll wrapper.
- Existing scheduling, provider, Agent, Customer, Settings, and calendar mutation tests remain green.
- Browser QA uses local Chrome through browser-harness against the production-shaped app at `http://localhost:3100`, at 1512×753 and a narrower desktop viewport.

## Completion criteria

The change is complete when the built application opens at `http://localhost:3100`, the current light UI feels deliberately refined, the Dashboard reports source-backed impact, the Day and Week calendars expose all 24 hours within a viewport-sized workspace, short appointments never clip, the supported demo viewport has no horizontal scrollbar, and automated/browser verification passes.
