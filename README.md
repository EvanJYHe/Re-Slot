# Re-Slot: The AI Workforce That Fills Empty Time

## Inspiration

In appointment-based businesses, time is perishable inventory.

When a customer cancels, the employee is still working, the rent is still due, and the empty hour can never be sold again. Salons, clinics, repair shops, and other staffed businesses lose revenue while front-desk teams manually call customers, search waitlists, offer discounts, and coordinate schedules.

Existing scheduling software records the cancellation.

Re-Slot responds to it.

We wanted to build an AI agent that could reason through the entire recovery process, contact the right customers, negotiate a new time, update the schedule safely, and continue working until every recoverable opening was filled.

## What it does

Re-Slot is an autonomous revenue recovery and customer operations platform for appointment-based businesses.

When an appointment is cancelled, Re-Slot launches a multi-step recovery workflow:

1. It identifies the exact employee, service, time, and revenue at risk.
2. It searches the CRM for customers who could take the opening.
3. It evaluates later appointments, waitlist entries, customer preferences, consent, staff compatibility, and previous outreach.
4. It ranks candidates based on business policy.
5. It decides whether to call or message each customer.
6. It creates a personalized offer, including a coupon when needed.
7. It interprets the customer's response through natural conversation.
8. It verifies explicit confirmation and commits the change.
9. If moving that customer creates another opening, it starts a new recovery chain automatically.
10. It reports the entire process to the front desk in real time.

Our demo shows the full chain:

> Josh cancels his 5 PM haircut through Telegram. Re-Slot reasons that Sarah, currently booked for 6 PM, is the best candidate because she previously consented to earlier appointments. It calls Sarah using an AI voice agent. Sarah accepts 5 PM, opening her original 6 PM slot. Re-Slot then finds Alex on the waitlist, contacts him through Telegram, and fills 6 PM.

One cancellation becomes two successful conversations and two optimized appointments.

### AI-powered CRM

Re-Slot includes a customer operations CRM containing:

- Contact identities and preferred channels
- Appointment and cancellation history
- Staff and service preferences
- Waitlist availability
- Earlier-time consent
- Flexible staff preferences
- Past-customer outreach eligibility
- Active offers and conversations
- Private operator notes
- Voice transcripts and Telegram history

This gives the agent the context required to make personalized decisions instead of sending generic mass notifications.

### Intelligent coupons and incentives

When the best candidates decline, Re-Slot can progressively increase the incentive.

Its coupon engine generates controlled offers such as 5%, 10%, or 15% off, while respecting a business-defined maximum. Re-Slot can use incentives only when necessary, helping recover revenue without immediately discounting every opening.

### A complete front-desk command center

Staff can supervise Re-Slot through a live workspace with:

- Day, week, and month calendars
- Multi-employee filtering
- Customer and appointment management
- Unified voice and Telegram conversations
- Waitlist controls
- Customer CRM profiles
- Recovery timelines
- Automation and coupon policies
- Integration health
- Live schedule updates

The goal is not to replace the front desk. It is to give one person the operational capacity of an entire scheduling team.

## How we built it

Re-Slot combines conversational AI, telephony, messaging, transactional scheduling, CRM data, and a durable agent workflow.

### The agent reasoning layer

Gemini supplies Re-Slot's language understanding and conversational reasoning through Backboard's agent infrastructure. Backboard maintains an isolated thread for each customer, carries the active scheduling context, and orchestrates typed tool calls such as:

- Check availability
- Book an appointment
- Cancel an appointment
- Reschedule an appointment
- Accept or decline an offer

The agent can reason and communicate naturally, but it cannot directly edit the database.

### The deterministic action layer

We built a custom TypeScript scheduling engine that is the only component allowed to change appointments.

Every action verifies:

- Authenticated customer ownership
- Explicit confirmation
- Real-time availability
- Employee and service compatibility
- Working hours
- Offer expiration
- Appointment versions
- Concurrent responses
- Consent and outreach policies

This architecture gives us the intelligence of an AI agent with the safety of a transactional system.

### The recovery state machine

Every cancellation creates a persistent recovery job. A background worker leases the job, ranks candidates, creates offers, sends them, waits for responses, retries failures, expires stale offers, and continues through the candidate list.

If accepting an offer creates another opening, the engine creates a successor job. This turns schedule recovery into a graph of linked decisions rather than a single notification.

The worker is restart-safe, idempotent, and designed for real provider failures.

### Voice, messaging, and CRM

- **ElevenLabs and Twilio** power natural AI phone calls.
- **Telegram** supports real-time customer messaging.
- **Gemini via Backboard** handles natural-language reasoning, isolated conversation threads, and typed tool orchestration.
- **MongoDB Atlas** stores appointments, CRM records, offers, waitlists, conversations, events, and recovery jobs.
- **Fastify and Node.js** power the API, webhooks, workers, and provider integrations.
- **React, Vite, and Tailwind CSS** power the operator workspace.
- **Server-Sent Events** update the live calendar whenever the agent commits an action.

Both voice and Telegram interactions are normalized into one conversation history, allowing Re-Slot to reason across channels while giving staff a single operational view.

## Challenges we ran into

### Building an agent that can take real actions safely

Letting an LLM directly modify appointments would create serious risks. A hallucinated customer ID, stale time slot, or duplicated webhook could corrupt the schedule.

We separated reasoning from authority. The AI proposes typed operations, while the scheduling engine authenticates, validates, and commits them atomically.

### Coordinating cascading schedule changes

Moving one customer often creates another opening. Re-Slot needed to continue reasoning across multiple appointments without creating infinite chains, contacting the same person twice, or losing progress after a restart.

We solved this with persistent recovery jobs, worker leases, movement limits, candidate history, and successor jobs.

### Handling concurrency across phone and messaging

A customer might accept by phone while another reply is arriving through Telegram. Offers can also expire while a conversation is still happening.

Re-Slot validates the offer and slot inside a transaction immediately before committing. Only one acceptance can win. Every stale response receives a safe explanation.

### Creating real autonomy instead of a scripted demo

We did not hard-code the cancellation sequence. The agent uses real customer records, provider events, ranking policies, conversations, and scheduling transactions.

The demo works because the system actually reasons through the workflow.

## Accomplishments that we're proud of

We built an agent that does much more than chat.

Re-Slot identifies lost revenue, searches its CRM, ranks customers, selects a communication channel, creates an offer, calls or messages the customer, interprets their response, safely updates the calendar, and continues recovering the schedule.

We are especially proud of:

- The end-to-end voice and Telegram recovery chain
- The deterministic safety layer underneath the AI
- Atomic protection against double bookings
- Persistent, restart-safe agent workflows
- Cross-channel customer memory
- Automated coupon escalation
- A complete scheduling CRM and operator workspace
- Real-time visibility into every agent decision

Watching Sarah accept by voice, move into Josh's appointment, and trigger a new Telegram offer for Alex felt like watching an actual operations employee work.

## What we learned

We learned that the most valuable AI agents do not just answer questions. They own outcomes.

A chatbot might tell a business that an appointment was cancelled. Re-Slot keeps working until the business has recovered as much value as possible.

We also learned that reliable agents need strong boundaries. Natural language is ideal for understanding people, but deterministic code must control money, identity, consent, and scheduling state.

Most importantly, we learned that cancellations are not isolated events. A schedule is a connected system. One change can create a chain of opportunities, and an agent can reason through that chain far faster than a human operator.

## What's next for Re-Slot

Next, we are turning Re-Slot into a complete AI operations platform for the staffing and appointment industry.

Planned capabilities include:

- SMS, WhatsApp, email, and web chat
- Integrations with existing booking platforms
- AI-generated customer segments and campaigns
- Personalized coupons based on acceptance probability
- Predictive cancellation and no-show detection
- Multi-location and multi-employee optimization
- Automatic staff reallocation when demand changes
- Revenue forecasting and recovered-revenue analytics
- Customer loyalty and re-engagement workflows
- Human approval rules for high-value decisions
- Multi-agent coordination for scheduling, retention, and customer support

Our long-term vision is an AI workforce that continuously protects business utilization.

Scheduling software records empty time.

**Re-Slot fills it.**
