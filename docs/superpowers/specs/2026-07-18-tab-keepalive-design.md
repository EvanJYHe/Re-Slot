# Tab Keep-Alive Design

## Goal

Make repeat navigation between Calendar, Agent, Customers, and Settings feel immediate during the hackathon demo. A page may show its normal loading state on its first visit, but returning to an already visited page must preserve its loaded data and local UI state instead of remounting and refetching solely because of navigation.

## Root Cause

`DashboardApp` conditionally renders only the active page. React therefore unmounts a page when the operator leaves it. Returning creates a new component instance, resets its local state, and re-runs its API-loading effects. Browser reproduction confirmed that returning to Customers repeats both the customer-list and selected-customer requests.

## Design

`DashboardApp` will track which destinations have been visited. Calendar remains mounted from startup. Agent, Customers, and Settings mount lazily on their first visit, then remain mounted inside containers that use the HTML `hidden` attribute when inactive.

This preserves each page's fetched data, selected record, search input, and other local state without adding a dependency or a second data cache. Hidden pages remain part of the React tree, so the existing `refreshKey` updates from server-sent domain events continue to refresh authoritative data. Existing mutations and calendar refresh behavior remain unchanged.

The first visit retains the current loading and error behavior. A tab switch by itself does not create a new request or loading screen after that page has been visited.

## Accessibility and Layout

Inactive page containers use the native `hidden` attribute, removing their descendants from layout and the accessibility tree. The active navigation button continues to use `aria-current="page"`.

## Verification

No new automated tests will be added, per the user's request. Verification consists of:

- TypeScript type checking.
- A production build.
- Browser-harness navigation in the user's Chrome, confirming that returning to Customers does not add customer API resource entries or show the loading skeleton.

