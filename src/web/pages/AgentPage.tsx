import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { EmptyState, SegmentedControl, StatusDot, cn } from "../components/ui.js";
import type {
  ActivityItem,
  ConversationDetail,
  ConversationEvent,
  ConversationSummary,
  OperatorWaitlistEntry,
  ReviveApi,
} from "../types.js";

type AgentTab = "inbox" | "waitlist" | "activity";

interface AgentPageProps {
  api: ReviveApi;
  refreshKey: number;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}

function timestamp(value: string, format = "h:mm a"): string {
  return DateTime.fromISO(value).setZone("America/Toronto").toFormat(format);
}

function ConversationRow({ conversation, selected, onSelect }: {
  conversation: ConversationSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "w-full border-b border-line px-4 py-3.5 text-left transition-colors",
        selected ? "bg-[#edf4ef]" : "bg-panel hover:bg-[#fafbf9]",
      )}
      onClick={onSelect}
      type="button"
    >
      <span className="flex items-center justify-between gap-3">
        <strong className="truncate text-sm font-semibold">{conversation.customerName}</strong>
        <time className="shrink-0 font-mono text-[9px] text-muted">{timestamp(conversation.updatedAt)}</time>
      </span>
      <span className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
        {conversation.hasException ? <StatusDot tone="warning" /> : null}
        {titleCase(conversation.channel)} · {titleCase(conversation.direction)}
      </span>
      <span className="mt-1.5 block truncate text-xs text-muted">{conversation.preview}</span>
    </button>
  );
}

function MessageEvent({ event }: { event: ConversationEvent }) {
  const isCustomer = event.speaker === "customer";
  return (
    <div className={cn("flex", isCustomer ? "justify-end" : "justify-start")}>
      <article className={cn(
        "max-w-[78%] rounded-xl px-3.5 py-2.5 text-sm leading-6",
        isCustomer ? "rounded-br-[4px] bg-ink text-white" : "rounded-bl-[4px] border border-line bg-panel text-ink",
      )}>
        <p>{event.text}</p>
        <time className={cn("mt-1 block font-mono text-[9px]", isCustomer ? "text-white/60" : "text-muted")}>
          {timestamp(event.occurredAt)}
        </time>
      </article>
    </div>
  );
}

function LedgerEvent({ event }: { event: ConversationEvent }) {
  const warning = event.kind === "error" || event.deliveryState === "failed";
  return (
    <div className="grid grid-cols-[12px_1fr_auto] items-start gap-2 rounded-revive border border-line bg-[#fafbf9] px-3 py-2.5 text-xs">
      <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", warning ? "bg-amber" : "bg-revive")} />
      <span className="leading-5 text-muted">{event.text}</span>
      <time className="font-mono text-[9px] text-muted">{timestamp(event.occurredAt)}</time>
    </div>
  );
}

function Transcript({ detail, loading }: { detail: ConversationDetail | undefined; loading: boolean }) {
  if (loading) return <div className="m-5 min-h-72 animate-pulse rounded-xl bg-[#f1f3f0]" />;
  if (detail === undefined) {
    return (
      <EmptyState
        detail="Select a real Telegram message or voice call to inspect what REVIVE did."
        title="No conversation selected"
      />
    );
  }
  const events = [...detail.events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  return (
    <div className="space-y-3 p-5">
      {events.map((event) => (
        event.kind === "message" || event.kind === "transcript"
          ? <MessageEvent event={event} key={event.id} />
          : <LedgerEvent event={event} key={event.id} />
      ))}
    </div>
  );
}

function ContextPanel({ detail }: { detail: ConversationDetail | undefined }) {
  return (
    <aside aria-label="Context" className="border-l border-t border-line bg-[#fafbf9] lg:col-start-2 xl:col-start-auto xl:min-h-[calc(100vh-177px)] xl:border-t-0">
      <div className="flex h-12 items-center border-b border-line px-4">
        <h3 className="text-sm font-semibold">Context</h3>
      </div>
      {detail === undefined ? (
        <p className="p-4 text-sm leading-6 text-muted">Customer and scheduling context appears with a selected conversation.</p>
      ) : (
        <div className="divide-y divide-line">
          <section className="p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Customer</h4>
            <strong className="mt-2 block text-sm">{detail.context.customer.name}</strong>
            <p className="mt-1 text-xs text-muted">{detail.context.customer.identitySummary}</p>
          </section>
          <section className="p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Appointment</h4>
            {detail.context.appointment === undefined ? (
              <p className="mt-2 text-xs text-muted">No appointment attached</p>
            ) : (
              <>
                <strong className="mt-2 block text-sm">{detail.context.appointment.serviceName}</strong>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {detail.context.appointment.barberName} · {timestamp(detail.context.appointment.startAt, "ccc, LLL d · h:mm a")}
                </p>
              </>
            )}
          </section>
          <section className="p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Automation</h4>
            <p className="mt-2 flex items-center gap-2 text-sm font-medium"><StatusDot tone="healthy" />{detail.context.automation.state}</p>
            {detail.context.automation.offerStatus === undefined ? null : (
              <p className="mt-1.5 text-xs capitalize text-muted">Offer {detail.context.automation.offerStatus.replaceAll("_", " ")}</p>
            )}
          </section>
          <section className="p-4">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">Private note</h4>
            <p className="mt-2 text-sm leading-6 text-muted">{detail.context.privateNote?.text ?? "No private note."}</p>
          </section>
        </div>
      )}
    </aside>
  );
}

function Inbox({ conversations, selectedId, detail, loadingDetail, search, onSearch, onSelect }: {
  conversations: ConversationSummary[];
  selectedId: string | undefined;
  detail: ConversationDetail | undefined;
  loadingDetail: boolean;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return conversations.filter((conversation) => (
      conversation.customerName.toLocaleLowerCase().includes(query)
      || conversation.preview.toLocaleLowerCase().includes(query)
    ));
  }, [conversations, search]);

  return (
    <div className="mx-auto grid w-full max-w-[1500px] overflow-hidden rounded-xl border border-line bg-panel shadow-panel lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
      <section className="border-r border-line">
        <div className="border-b border-line p-4">
          <h3 className="text-sm font-semibold">Conversations</h3>
          <label className="sr-only" htmlFor="conversation-search">Search conversations</label>
          <input
            className="mt-3 h-9 w-full rounded-revive border border-line bg-white px-3 text-xs placeholder:text-[#9fa69f]"
            id="conversation-search"
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search customers"
            value={search}
          />
        </div>
        {conversations.length === 0 ? (
          <EmptyState
            detail="Real Telegram messages and voice calls will appear here as they happen."
            title="No provider activity yet"
          />
        ) : visible.length === 0 ? (
          <p className="p-5 text-center text-sm text-muted">No conversations match that search.</p>
        ) : (
          <div>{visible.map((conversation) => (
            <ConversationRow
              conversation={conversation}
              key={conversation.id}
              onSelect={() => onSelect(conversation.id)}
              selected={conversation.id === selectedId}
            />
          ))}</div>
        )}
      </section>
      <section className="min-w-0">
        <div className="flex h-12 items-center justify-between border-b border-line px-5">
          <h3 className="text-sm font-semibold">Conversation</h3>
          {detail === undefined ? null : (
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
              {titleCase(detail.conversation.channel)} · {titleCase(detail.conversation.direction)}
            </span>
          )}
        </div>
        <Transcript detail={detail} loading={loadingDetail} />
      </section>
      <ContextPanel detail={detail} />
    </div>
  );
}

function WaitlistPanel({ api, entries, onEntriesChange }: {
  api: ReviveApi;
  entries: OperatorWaitlistEntry[];
  onEntriesChange: (entries: OperatorWaitlistEntry[]) => void;
}) {
  const [editingNote, setEditingNote] = useState<string>();
  const [note, setNote] = useState("");
  const [removing, setRemoving] = useState<string>();
  const [status, setStatus] = useState<string>();
  const visible = entries.filter((entry) => entry.status !== "withdrawn" && entry.status !== "fulfilled");

  const update = async (entry: OperatorWaitlistEntry, patch: { status?: "active" | "paused" | "withdrawn"; operatorNote?: string | null }) => {
    setStatus("Saving…");
    try {
      const updated = await api.patchWaitlist(entry.id, patch);
      onEntriesChange(entries.map((candidate) => candidate.id === entry.id ? updated : candidate));
      setStatus("Saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "That waitlist change could not be saved.");
    }
  };

  return (
    <section aria-label="Open waitlist" className="mx-auto max-w-5xl rounded-xl border border-line bg-panel shadow-panel">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">Open waitlist</h3>
          <p className="mt-1 text-xs text-muted">Pause outreach, leave context, or withdraw an entry.</p>
        </div>
        {status === undefined ? null : <span className="font-mono text-[10px] text-muted">{status}</span>}
      </div>
      {visible.length === 0 ? (
        <EmptyState detail="New customer requests will appear here when they join the waitlist." title="Waitlist is clear" />
      ) : (
        <div className="divide-y divide-line">
          {visible.map((entry) => (
            <article className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]" key={entry.id}>
              <div>
                <span className="flex items-center gap-2">
                  <strong className="text-sm font-semibold">{entry.customerName}</strong>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em]",
                    entry.status === "paused" ? "bg-amber-soft text-[#74551f]" : "bg-[#edf4ef] text-revive-dark",
                  )}>{entry.status}</span>
                </span>
                <p className="mt-1 text-sm text-muted">{entry.serviceName} · {entry.barberName}</p>
                <p className="mt-1 font-mono text-[10px] text-muted">
                  {timestamp(entry.earliestStart, "ccc, LLL d · h:mm a")}–{timestamp(entry.latestStart)} · {titleCase(entry.channel)}
                </p>
                {entry.operatorNote === undefined ? null : <p className="mt-2 text-xs italic text-muted">{entry.operatorNote}</p>}
                {editingNote === entry.id ? (
                  <div className="mt-3 flex max-w-lg gap-2">
                    <label className="sr-only" htmlFor={`waitlist-note-${entry.id}`}>Private note for {entry.customerName}</label>
                    <input
                      className="h-9 flex-1 rounded-revive border border-line px-3 text-sm"
                      id={`waitlist-note-${entry.id}`}
                      onChange={(event) => setNote(event.target.value)}
                      value={note}
                    />
                    <button
                      aria-label={`Save note for ${entry.customerName}`}
                      className="rounded-revive bg-ink px-3 text-xs font-medium text-white disabled:opacity-40"
                      disabled={note.trim() === ""}
                      onClick={() => {
                        const text = note.trim();
                        setEditingNote(undefined);
                        setNote("");
                        void update(entry, { operatorNote: text });
                      }}
                      type="button"
                    >Save</button>
                  </div>
                ) : null}
              </div>
              <div className="flex items-start gap-1.5">
                <button
                  aria-label={`${entry.status === "paused" ? "Resume" : "Pause"} ${entry.customerName}`}
                  className="h-8 rounded-revive border border-line px-3 text-xs font-medium text-muted hover:text-ink"
                  onClick={() => void update(entry, { status: entry.status === "paused" ? "active" : "paused" })}
                  type="button"
                >{entry.status === "paused" ? "Resume" : "Pause"}</button>
                <button
                  aria-label={`${entry.operatorNote === undefined ? "Add" : "Edit"} note for ${entry.customerName}`}
                  className="h-8 rounded-revive border border-line px-3 text-xs font-medium text-muted hover:text-ink"
                  onClick={() => {
                    setEditingNote(entry.id);
                    setNote(entry.operatorNote ?? "");
                  }}
                  type="button"
                >Note</button>
                {removing === entry.id ? (
                  <button
                    aria-label={`Confirm remove ${entry.customerName}`}
                    className="h-8 rounded-revive border border-[#e6caca] px-3 text-xs font-medium text-[#9e3f3f]"
                    onClick={() => void update(entry, { status: "withdrawn" })}
                    type="button"
                  >Confirm</button>
                ) : (
                  <button
                    aria-label={`Remove ${entry.customerName}`}
                    className="h-8 rounded-revive px-2 text-xs text-muted hover:text-[#9e3f3f]"
                    onClick={() => setRemoving(entry.id)}
                    type="button"
                  >Remove</button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityPanel({ activity }: { activity: ActivityItem[] }) {
  return (
    <section aria-label="Scheduling activity" className="mx-auto max-w-4xl rounded-xl border border-line bg-panel shadow-panel">
      <div className="border-b border-line px-5 py-4">
        <h3 className="text-sm font-semibold">Scheduling activity</h3>
        <p className="mt-1 text-xs text-muted">Plain-language changes committed by REVIVE and the front desk.</p>
      </div>
      {activity.length === 0 ? (
        <EmptyState detail="Committed scheduling changes will appear here." title="No activity yet" />
      ) : (
        <ol className="divide-y divide-line">
          {activity.map((item) => (
            <li className="grid grid-cols-[8px_1fr_auto] items-start gap-3 px-5 py-4" key={item.id}>
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-revive" />
              <p className="text-sm leading-6">{item.message}</p>
              <time className="font-mono text-[10px] text-muted">{timestamp(item.occurredAt, "LLL d · h:mm a")}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function AgentPage({ api, refreshKey }: AgentPageProps) {
  const [tab, setTab] = useState<AgentTab>("inbox");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [waitlist, setWaitlist] = useState<OperatorWaitlistEntry[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<ConversationDetail>();
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      api.getConversations(),
      api.getWaitlist(),
      api.getActivity(),
    ]).then(([nextConversations, nextWaitlist, nextActivity]) => {
      if (!active) return;
      setConversations(nextConversations);
      setWaitlist(nextWaitlist);
      setActivity(nextActivity);
      setSelectedId((current) => (
        current !== undefined && nextConversations.some((conversation) => conversation.id === current)
          ? current
          : nextConversations[0]?.id
      ));
      if (nextConversations.length === 0) setDetail(undefined);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [api, refreshKey]);

  useEffect(() => {
    if (selectedId === undefined) return;
    let active = true;
    setLoadingDetail(true);
    void api.getConversation(selectedId).then((nextDetail) => {
      if (active) setDetail(nextDetail);
    }).finally(() => {
      if (active) setLoadingDetail(false);
    });
    return () => { active = false; };
  }, [api, selectedId, refreshKey]);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-5 py-4 lg:px-8">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em]">Agent</h2>
          <p className="mt-1 text-sm text-muted">Supervise real conversations and scheduling work.</p>
        </div>
        <SegmentedControl
          label="Agent workspace"
          onChange={setTab}
          options={[
            { value: "inbox", label: "Inbox" },
            { value: "waitlist", label: "Waitlist" },
            { value: "activity", label: "Activity" },
          ]}
          value={tab}
        />
      </div>
      <div className="p-5 lg:p-8">
        {loading ? <span className="sr-only" role="status">Loading agent activity</span> : null}
        {tab === "inbox" ? (
          <Inbox
            conversations={conversations}
            detail={detail}
            loadingDetail={loadingDetail}
            onSearch={setSearch}
            onSelect={setSelectedId}
            search={search}
            selectedId={selectedId}
          />
        ) : tab === "waitlist" ? (
          <WaitlistPanel api={api} entries={waitlist} onEntriesChange={setWaitlist} />
        ) : (
          <ActivityPanel activity={activity} />
        )}
      </div>
    </section>
  );
}
