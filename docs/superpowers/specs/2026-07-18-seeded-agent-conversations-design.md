# Seeded Agent Conversations Design

## Goal

Populate the Agent inbox with five concise, polished demo conversations that showcase REVIVE's scheduling happy paths through the existing normalized conversation APIs and UI. Preserve the current operational week and its live Josh/Sarah/Alex walkthrough.

## Seeded scenarios

1. **Liam — Telegram inbound cancellation.** Liam asks to cancel a prior-week appointment. REVIVE confirms the cancellation and records that refill automation started.
2. **Ava — outbound voice earlier-slot offer.** REVIVE offers Liam's opening to Ava. Ava confirms the earlier time, and the ledger records consent and the completed move.
3. **Mateo — outbound Telegram refill offer.** REVIVE offers Ava's former time to Mateo. Mateo accepts, and the ledger records that the opening was filled.
4. **Zoe — Telegram inbound booking.** Zoe asks for availability, chooses a concise option, confirms it, and receives a booking confirmation.
5. **Benjamin — voice inbound reschedule.** Benjamin asks to move an appointment, confirms the proposed time, and receives a completed reschedule confirmation.

The set contains three Telegram conversations and two voice conversations. It includes both inbound and outbound conversation directions.

## Data model

Seed the same normalized records produced by real providers:

- one `Conversation` per provider thread or call;
- chronological `ConversationEvent` records for customer/agent turns and human-readable scheduling actions;
- completed prior-week appointments, offers, and refill jobs where required for accurate context;
- safe synthetic provider identifiers prefixed with `demo-`;
- scalar call timing metadata only, with no audio, raw payloads, tokens, or credentials.

The prior-week cancellation/refill chain is internally consistent: Liam's cancelled opening is accepted by Ava, then Ava's former opening is accepted by Mateo. Completed jobs are ignored by the live refill worker.

## UI behavior

No frontend changes are required. The existing Agent page will consume `/api/v1/conversations` and `/api/v1/conversations/:id`, render channel and direction labels, display the normalized transcript/action ledger, and show customer, appointment, automation, and private-note context.

The current-week golden path remains unchanged and available for a live provider walkthrough.

## Reset and persistence

`createDemoState` includes the five conversations, so a demo reset restores them. Existing provider-linked identities continue to be preserved by the reset flow. Applying the seed to the connected MongoDB replaces stale demo scheduling state while retaining linked identities and other explicitly preserved provider records.

## Safety and validation

- Seeded text is concise, natural, and clearly attributable to demo provider identifiers internally.
- Conversation timestamps are ordered and recent relative to the seeded week.
- Appointment and offer references resolve to real seeded records.
- No barber or customer scheduling collisions are introduced.
- The live conversation APIs return five summaries with three Telegram and two voice channels and both inbound/outbound directions.
- No frontend files are modified.
