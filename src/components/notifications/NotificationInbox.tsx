import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  Filter,
  Inbox,
  LockKeyhole,
  Search,
  Trash2,
} from "lucide-react";
import {
  channels,
  eventCatalog,
  getNotificationMatrix,
  getNotifications,
  notificationTime,
  updateMutedClass,
  updateNotificationRoute,
  updateNotifications,
  type Channel,
  type EventClass,
  type NoticeFilters,
} from "@/services/notifications";
import {
  Busy,
  Button,
  channelIcons,
  ChannelName,
  deliveryTone,
  Drawer,
  Empty,
  eventIcon,
  Failure,
  Message,
  PanelHead,
  Tag,
  toneFor,
  WorkspaceLink,
} from "./NotificationUI";

export function NotificationInbox({
  initialUnread,
  requestId,
}: {
  initialUnread: boolean;
  requestId: number;
}) {
  return <InboxView key={requestId} initialUnread={initialUnread} />;
}
function InboxView({ initialUnread }: { initialUnread: boolean }) {
  const [filters, setFilters] = useState<NoticeFilters>(
      initialUnread ? { state: "Unread" } : {},
    ),
    [advanced, setAdvanced] = useState(false),
    [page, setPage] = useState(0),
    [inspect, setInspect] = useState<string>(),
    [confirm, setConfirm] = useState<"clear-read" | "delete">(),
    [note, setNote] = useState("");
  const q = useQuery({
    queryKey: ["notifications", "stream", filters],
    queryFn: () => getNotifications(filters),
  });
  const details = useQuery({
    queryKey: ["notifications", "stream", {}],
    queryFn: () => getNotifications(),
    enabled: !!inspect,
  });
  const selected = (details.data ?? q.data)?.find((r) => r.id === inspect);
  const update = useMutation({
    mutationFn: updateNotifications,
    onSuccess: (r, v) => {
      setNote(
        `${r.count} notice${r.count === 1 ? "" : "s"} ${v.action === "delete" || v.action === "clear-read" ? "removed" : v.action === "unread" ? "marked unread" : "marked read"}.`,
      );
      if (v.action === "delete") setInspect(undefined);
      setConfirm(undefined);
    },
  });
  const mute = useMutation({
    mutationFn: updateMutedClass,
    onSuccess: (r) => {
      setNote(r.message);
      setInspect(undefined);
    },
  });
  const set = <K extends keyof NoticeFilters>(
    key: K,
    val: NoticeFilters[K],
  ) => {
    setFilters((f) => ({ ...f, [key]: val }));
    setPage(0);
    setNote("");
  };
  const rows = q.data ?? [],
    pages = Math.max(1, Math.ceil(rows.length / 6)),
    current = Math.min(page, pages - 1);
  const dateError = !!filters.from && !!filters.to && filters.from > filters.to;
  return (
    <div className="os-nt-card os-nt-inbox">
      <div className="os-nt-toolbar">
        <PanelHead
          eyebrow="WORKSPACE ACTIVITY"
          title="Notification stream"
          copy="One place to review local events and external routing previews."
        />
        <div className="os-nt-actions">
          <Button
            disabled={update.isPending}
            onClick={() => update.mutate({ action: "read-all" })}
          >
            <CheckCheck size={15} /> Mark all read
          </Button>
          <Button
            disabled={update.isPending}
            onClick={() => setConfirm("clear-read")}
          >
            <Trash2 size={14} /> Clear read
          </Button>
        </div>
      </div>
      <div className="os-nt-inbox-controls">
        <div className="os-nt-segments" aria-label="Read state">
          {(["All", "Unread", "Read"] as const).map((s) => (
            <button
              type="button"
              aria-pressed={(filters.state ?? "All") === s}
              key={s}
              onClick={() => set("state", s === "All" ? undefined : s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="os-nt-actions">
          <label className="os-nt-search">
            <span className="visually-hidden">Search notifications</span>
            <Search size={15} />
            <input
              className="form-control"
              placeholder="Search notices…"
              value={filters.search ?? ""}
              onChange={(e) => set("search", e.target.value)}
            />
          </label>
          <Button
            aria-expanded={advanced}
            aria-controls="nt-stream-filters"
            onClick={() => setAdvanced(!advanced)}
          >
            <Filter size={14} /> Filters
            {[filters.event, filters.channel, filters.from, filters.to].some(
              Boolean,
            ) && " · On"}
          </Button>
        </div>
      </div>
      {advanced && (
        <div id="nt-stream-filters" className="os-nt-filter-grid">
          <label className="os-nt-field">
            <span>Event class</span>
            <select
              className="form-select"
              value={filters.event ?? ""}
              onChange={(e) =>
                set("event", (e.target.value as EventClass) || undefined)
              }
            >
              <option value="">All classes</option>
              {eventCatalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="os-nt-field">
            <span>Delivery channel</span>
            <select
              className="form-select"
              value={filters.channel ?? ""}
              onChange={(e) =>
                set("channel", (e.target.value as Channel) || undefined)
              }
            >
              <option value="">All channels</option>
              {channels.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="os-nt-field">
            <span>From (EAT)</span>
            <input
              className="form-control"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => set("from", e.target.value || undefined)}
            />
          </label>
          <label className="os-nt-field">
            <span>To (EAT)</span>
            <input
              className="form-control"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => set("to", e.target.value || undefined)}
            />
          </label>
          <Button
            onClick={() => {
              setFilters({});
              setPage(0);
            }}
          >
            Reset filters
          </Button>
        </div>
      )}
      {note && (
        <div className="os-nt-inline">
          <Message>{note}</Message>
        </div>
      )}
      {!confirm && !inspect && <Failure error={update.error ?? mute.error} />}
      {dateError ? (
        <div className="os-nt-inline">
          <Message error>
            Choose an EAT end date on or after the start date.
          </Message>
        </div>
      ) : q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <div className="os-nt-inline">
          <Failure error={q.error} />
          <Button onClick={() => void q.refetch()}>Retry inbox</Button>
        </div>
      ) : rows.length ? (
        <ul className="os-nt-feed">
          {rows.slice(current * 6, (current + 1) * 6).map((n) => {
            const Icon = eventIcon(n.event);
            return (
              <li className={!n.readAt ? "os-nt-unread-row" : ""} key={n.id}>
                <span className={`os-nt-icon os-nt-${toneFor(n.severity)}`}>
                  <Icon size={18} />
                </span>
                <div className="os-nt-story">
                  <div>
                    <strong>{n.title}</strong>
                    {!n.readAt && (
                      <i className="os-nt-dot" aria-label="Unread" />
                    )}
                    <Tag tone={toneFor(n.severity)}>{n.severity}</Tag>
                  </div>
                  <p>{n.body}</p>
                  <div className="os-nt-story-meta">
                    <span>{n.accountLabel}</span>
                    {n.ref && <code>{n.ref}</code>}
                    {[...new Set(n.deliveries.map((d) => d.channel))].map(
                      (ch) => {
                        const C = channelIcons[ch];
                        const status = n.deliveries
                          .filter((d) => d.channel === ch)
                          .map((d) => d.status)
                          .join(", ");
                        return (
                          <span
                            className="os-nt-route-dot"
                            title={`${ch}: ${status}`}
                            aria-label={`${ch}: ${status}`}
                            key={ch}
                          >
                            <C size={12} />
                          </span>
                        );
                      },
                    )}
                  </div>
                </div>
                <div className="os-nt-feed-end">
                  <time dateTime={n.createdAt}>
                    {notificationTime(n.createdAt)} EAT
                  </time>
                  <Button
                    onClick={() => setInspect(n.id)}
                    aria-label={`Inspect ${n.title}`}
                  >
                    Inspect <ChevronRight size={14} />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>
          <Inbox size={24} />
          <strong>No matching notifications</strong>
          <span>Try another filter or run a local channel test.</span>
        </Empty>
      )}
      <div className="os-nt-toolbar os-nt-pagination">
        <small>
          {rows.length} matching · Page {current + 1} of {pages}
        </small>
        <div className="os-nt-actions">
          <Button disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Button
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      {selected && !confirm && (
        <Drawer
          title={selected.title}
          kicker={selected.event.toUpperCase()}
          onClose={() => setInspect(undefined)}
          busy={update.isPending || mute.isPending}
        >
          <div className="os-nt-flow">
            <div className="os-nt-actions">
              <Tag tone={toneFor(selected.severity)}>{selected.severity}</Tag>
              <Tag>{selected.source}</Tag>
              <Tag>{selected.readAt ? "Read" : "Unread"}</Tag>
            </div>
            <p>{selected.body}</p>
            <p className="os-nt-muted">
              {selected.accountLabel} · {notificationTime(selected.createdAt)}{" "}
              EAT {selected.ref && <code> · {selected.ref}</code>}
            </p>
            <h3>Routing proof</h3>
            <div className="os-nt-proof-list">
              {selected.deliveries.map((d) => (
                <div key={d.id}>
                  <strong>
                    <ChannelName channel={d.channel} />
                  </strong>
                  <Tag tone={deliveryTone(d.status)}>{d.status}</Tag>
                  <small>
                    {d.target} · {d.detail}
                  </small>
                </div>
              ))}
            </div>
            <WorkspaceLink notice={selected} />
            <Failure error={update.error ?? mute.error} />
            <div className="os-nt-actions">
              <Button
                onClick={() =>
                  update.mutate({
                    action: selected.readAt ? "unread" : "read",
                    ids: [selected.id],
                  })
                }
                disabled={update.isPending}
              >
                {selected.readAt ? "Mark unread" : "Mark read"}
              </Button>
              <Button
                disabled={
                  selected.severity === "Critical" ||
                  mute.isPending ||
                  eventCatalog.find((c) => c.id === selected.event)
                    ?.severity === "Critical"
                }
                onClick={() =>
                  mute.mutate({ event: selected.event, muted: true })
                }
              >
                Mute class
              </Button>
              <Button kind="danger" onClick={() => setConfirm("delete")}>
                Delete
              </Button>
            </div>
          </div>
        </Drawer>
      )}
      {confirm && (
        <Drawer
          title={
            confirm === "delete"
              ? "Delete notification?"
              : "Clear read notifications?"
          }
          kicker="LOCAL INBOX"
          onClose={() => setConfirm(undefined)}
          busy={update.isPending}
        >
          <div className="os-nt-flow">
            <p>
              Removed notices no longer appear in the inbox. Routing proof
              remains in the delivery log.
            </p>
            <Failure error={update.error} />
            <div className="os-nt-actions">
              <Button
                onClick={() => setConfirm(undefined)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button
                kind="danger"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    action: confirm,
                    ids: inspect ? [inspect] : undefined,
                  })
                }
              >
                {update.isPending
                  ? "Removing…"
                  : confirm === "delete"
                    ? "Confirm delete"
                    : "Confirm clear read"}
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
export function RoutingMatrix() {
  const [group, setGroup] = useState("All"),
    [onlyMuted, setOnlyMuted] = useState(false),
    [note, setNote] = useState("");
  const q = useQuery({
    queryKey: ["notifications", "matrix"],
    queryFn: getNotificationMatrix,
  });
  const cache = useQueryClient();
  const route = useMutation({
    mutationFn: updateNotificationRoute,
    onMutate: (input) => {
      const key = ["notifications", "matrix"] as const;
      void cache.cancelQueries({ queryKey: key });
      const before =
        cache.getQueryData<Awaited<ReturnType<typeof getNotificationMatrix>>>(
          key,
        );
      if (before)
        cache.setQueryData(
          key,
          before.map((row) =>
            row.id === input.event
              ? {
                  ...row,
                  channels: channels.filter((ch) =>
                    ch === input.channel
                      ? input.enabled
                      : row.channels.includes(ch),
                  ),
                }
              : row,
          ),
        );
      return before;
    },
    onError: (_error, _input, before) => {
      if (before) cache.setQueryData(["notifications", "matrix"], before);
    },
    onSuccess: (r) => setNote(r.message),
  });
  const mute = useMutation({
    mutationFn: updateMutedClass,
    onSuccess: (r) => setNote(r.message),
  });
  const rows =
    q.data?.filter(
      (c) => (group === "All" || c.group === group) && (!onlyMuted || c.muted),
    ) ?? [];
  return (
    <div className="os-nt-card">
      <div className="os-nt-toolbar">
        <PanelHead
          eyebrow="ROUTING POLICIES"
          title="Event × channel matrix"
          copy="Control where future notices are routed. The emergency row is locked."
        />
        <Tag tone="amber">SMS estimate · 1.50 KES / route</Tag>
      </div>
      <div className="os-nt-inbox-controls">
        <div className="os-nt-segments" aria-label="Event groups">
          {["All", "Trading", "Risk", "Automation", "Finance", "Workspace"].map(
            (s) => (
              <button
                type="button"
                aria-pressed={s === group}
                key={s}
                onClick={() => setGroup(s)}
              >
                {s}
              </button>
            ),
          )}
        </div>
        <label className="form-check os-nt-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={onlyMuted}
            onChange={(e) => setOnlyMuted(e.target.checked)}
          />{" "}
          Muted only
        </label>
      </div>
      {note && (
        <div className="os-nt-inline">
          <Message>{note}</Message>
        </div>
      )}
      <Failure error={route.error ?? mute.error} />
      {q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <div className="os-nt-inline">
          <Failure error={q.error} />
          <Button onClick={() => void q.refetch()}>Retry routes</Button>
        </div>
      ) : rows.length ? (
        <div
          className="os-nt-table-wrap"
          role="region"
          aria-label="Event routing matrix"
          tabIndex={0}
        >
          <table className="table os-nt-table os-nt-matrix">
            <thead>
              <tr>
                <th scope="col">Event class</th>
                {channels.map((ch) => (
                  <th scope="col" key={ch}>
                    <ChannelName channel={ch} />
                  </th>
                ))}
                <th scope="col">Mute class</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    <strong>{c.label}</strong>
                    <code>{c.id}</code>
                  </th>
                  {channels.map((ch) => {
                    const locked =
                      c.id === "killswitch.engaged" ||
                      (ch === "In-app" && c.severity === "Critical");
                    return (
                      <td key={ch}>
                        <label className="form-check form-switch os-nt-toggle">
                          <input
                            type="checkbox"
                            role="switch"
                            className="form-check-input"
                            checked={c.channels.includes(ch)}
                            aria-label={`${c.label} via ${ch}`}
                            disabled={locked || route.isPending}
                            onChange={(e) =>
                              route.mutate({
                                event: c.id,
                                channel: ch,
                                enabled: e.target.checked,
                              })
                            }
                          />
                          {locked && (
                            <LockKeyhole size={11} aria-label="Locked" />
                          )}
                        </label>
                      </td>
                    );
                  })}
                  <td>
                    <Button
                      disabled={c.severity === "Critical" || mute.isPending}
                      onClick={() =>
                        mute.mutate({ event: c.id, muted: !c.muted })
                      }
                      aria-label={`${c.muted ? "Unmute" : "Mute"} ${c.label}`}
                    >
                      {c.muted ? "Unmute" : "Mute"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>
          <Bell size={18} /> No classes match this selection.
        </Empty>
      )}
      <div className="os-nt-inline">
        <small className="os-nt-muted">
          Critical classes remain visible in-app. Muting a noncritical class
          hides it from the inbox and pauses its future routing.
        </small>
      </div>
    </div>
  );
}
