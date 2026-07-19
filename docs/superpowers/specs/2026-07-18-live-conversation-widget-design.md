# REVIVE live conversation widget

## Purpose

Give the front-desk operator a compact, real-time view of the newest ongoing AI conversation without duplicating the full Agent workspace. The widget acts like a picture-in-picture supervisor surface: glanceable on operational pages and one click away from the complete conversation.

## Scope

- Add one fixed live-conversation widget to the application shell.
- Use the existing conversation list and detail APIs as the authoritative source.
- Open the matching conversation in Agent → Inbox when the widget is clicked.
- Keep the full Agent workspace and scheduling behavior unchanged.
- Do not add chat input, provider controls, fake messages, analytics, or a new backend endpoint.

## Visibility and selection

- Render the widget on Calendar, Customers, and Settings.
- Hide it while the Agent page is visible to avoid duplicate conversation surfaces.
- From the conversation list, select only entries whose state is `active`.
- If several conversations are active, select the one with the newest `updatedAt` timestamp.
- Hide the widget when no active conversation exists.
- When the selected conversation becomes completed or failed after a refresh, remove the widget or replace it with the next-newest active conversation.

## Presentation

- Fix the panel to the bottom-left of the desktop viewport with a small safe margin.
- Use an approximately 340 by 230 pixel dark charcoal panel inspired by compact call overlays, while retaining REVIVE typography and restrained green accents.
- The header shows the customer name, channel (`Telegram` or `Voice`), and a small live indicator.
- The body shows up to the latest three message or transcript events in chronological order.
- Customer messages and agent messages use clearly different alignment and surface treatments.
- While the conversation remains active, show a subtle animated three-dot pending row at the bottom.
- The entire panel is a keyboard-accessible control with an explicit label such as `Open active conversation with Alex`.

## Data flow

1. The widget receives the existing `ReviveApi` and shell `domainVersion`.
2. On mount and every domain-version change, it calls `getConversations()`.
3. It chooses the newest active summary and calls `getConversation(id)` for its transcript.
4. Stale async responses are ignored when the active conversation changes or the component unmounts.
5. A detail failure falls back to the summary preview; list failures hide the widget without affecting the rest of the application.
6. Clicking the widget stores the selected conversation ID in the application shell, marks Agent as visited, and navigates to Agent.
7. Agent receives the requested conversation ID, switches to Inbox, and selects that exact conversation when it exists.

The widget and Agent therefore share the same authoritative APIs and SSE invalidation signal without introducing a global state library or duplicate backend projection.

## Agent integration

- Add an optional focused-conversation ID to `AgentPage`.
- When that ID changes, Agent switches to the Inbox tab and selects it.
- Normal manual conversation selection remains local to Agent.
- Refresh logic preserves the requested selection if it still exists, otherwise it falls back to the newest conversation as it does today.

## Failure and loading behavior

- Do not reserve empty screen space while loading.
- Do not show an error card if conversation reads fail.
- If the summary is available but detail is loading, show the summary preview and the pending dots.
- Never expose raw provider payloads, tool metadata, credentials, or system-only conversation events in the widget.

## Accessibility

- Expose the panel as a button with a descriptive accessible name.
- Keep readable contrast on the dark surface.
- Mark decorative live and typing indicators as hidden from assistive technology.
- Preserve visible keyboard focus and support Enter/Space through native button behavior.
- Respect reduced-motion preferences for the pending-dot animation.

## Verification

- Component tests cover hidden-without-active, newest-active selection, latest-message rendering, preview fallback, pending dots, and click behavior.
- Agent tests cover focusing the requested conversation and switching back to Inbox.
- App tests cover hiding the widget on Agent and opening the exact active conversation from other pages.
- Browser QA at the 1512 by 753 demo viewport verifies the panel does not create page overflow and correctly disappears on Agent.
- Existing frontend tests, TypeScript checks, and the production build remain green.

## Acceptance criteria

The feature is complete when a real active Telegram or voice conversation appears as a compact bottom-left overlay, updates after SSE domain events, displays the latest safe transcript turns plus pending dots, opens the exact matching Agent conversation on click, and disappears when the conversation is no longer active or Agent is already visible.
