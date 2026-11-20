import {
  channels,
  defaultDelivery,
  defaultQuiet,
  deliveryTargets,
  eventCatalog,
  initialLinkedChats,
  seedNotices,
  smsCost,
  type Channel,
  type Delivery,
  type DeliveryPolicy,
  type EventClass,
  type LinkedChat,
  type Notice,
  type NoticeInput,
  type QuietPolicy,
} from "@/data/notifications";

const items = structuredClone(seedNotices);
const notices = new Map(items.map((n) => [n.id, n]));
const proofs: Delivery[] = items.flatMap((n) => n.deliveries);
const removed = new Set<string>(),
  eventKeys = new Map<string, Notice>();
const routes = new Map<EventClass, Set<Channel>>(
  eventCatalog.map((c) => [c.id, new Set(c.defaults)]),
);
export let linkedChats = structuredClone(initialLinkedChats);
export function storeChats(value: LinkedChat[]) {
  linkedChats = value;
  notifyChanged();
}
const muted = new Set<EventClass>();
const watchers = new Set<() => void>();
let serial = 0;
export let quietSettings = structuredClone(defaultQuiet),
  deliverySettings = structuredClone(defaultDelivery);
export const locateEvent = (id: EventClass) =>
  eventCatalog.find((c) => c.id === id);
export const eatDate = (value: number | string = Date.now()) =>
  new Date((typeof value === "string" ? Date.parse(value) : value) + 10_800_000)
    .toISOString()
    .slice(0, 10);
export function eatClock(value = Date.now()) {
  return new Date(value + 10_800_000).toISOString().slice(11, 16);
}
export const subscribeNotifications = (listener: () => void) => {
  watchers.add(listener);
  return () => {
    watchers.delete(listener);
  };
};
export const notifyChanged = () => watchers.forEach((listener) => listener());
const next = (prefix: string) =>
  `${prefix}-${String(++serial).padStart(5, "0")}`;
export const isQuietAt = (at: number, policy: QuietPolicy = quietSettings) => {
  if (!policy.enabled) return false;
  const t = eatClock(at);
  return policy.start < policy.end
    ? t >= policy.start && t < policy.end
    : t >= policy.start || t < policy.end;
};
export function visibleNotices() {
  return [...notices.values()]
    .filter(
      (n) =>
        !removed.has(n.id) &&
        (n.severity === "Critical" || !muted.has(n.event)) &&
        n.deliveries.some(
          (d) => d.channel === "In-app" && d.status === "In inbox",
        ),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const allDeliveryProof = () =>
  proofs
    .slice()
    .reverse()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const hasReadNotice = (id: string) =>
  !!notices.get(id)?.readAt ||
  removed.has(id) ||
  !visibleNotices().some((n) => n.id === id);
export function updateRead(ids: string[], read = true) {
  let changed = 0;
  const stamp = new Date().toISOString();
  for (const id of new Set(ids)) {
    const item = notices.get(id);
    if (item && !removed.has(id) && !!item.readAt !== read) {
      item.readAt = read ? stamp : undefined;
      changed++;
    }
  }
  if (changed) notifyChanged();
  return changed;
}
export function removeNotices(ids: string[]) {
  let count = 0;
  for (const id of new Set(ids))
    if (notices.has(id) && !removed.has(id)) {
      removed.add(id);
      count++;
    }
  if (count) notifyChanged();
  return count;
}
export const getMatrixSnapshot = () =>
  eventCatalog.map((c) => ({
    ...c,
    channels: channels.filter((ch) => routes.get(c.id)?.has(ch)),
    muted: muted.has(c.id),
  }));
export function setChannelRoute(
  event: EventClass,
  channel: Channel,
  on: boolean,
) {
  const entry = routes.get(event);
  if (!entry || !channels.includes(channel))
    throw new Error("Invalid event or channel.");
  if (
    event === "killswitch.engaged" ||
    (channel === "In-app" && locateEvent(event)?.severity === "Critical")
  )
    throw new Error(
      "Emergency routing and critical in-app visibility are locked.",
    );
  if (on) entry.add(channel);
  else entry.delete(channel);
  notifyChanged();
}
export function setMutedClass(event: EventClass, value: boolean) {
  const c = locateEvent(event);
  if (!c) throw new Error("Unknown notification class.");
  if (c.severity === "Critical")
    throw new Error("Critical notification classes cannot be muted.");
  if (value) muted.add(event);
  else muted.delete(event);
  notifyChanged();
}
export const mutedClasses = () => [...muted];
export function setQuiet(value: QuietPolicy) {
  quietSettings = { ...value };
  notifyChanged();
}
export function setDelivery(value: DeliveryPolicy) {
  deliverySettings = { ...value, limits: { ...value.limits } };
  notifyChanged();
}
export function dailyRouteUsage(at = Date.now()) {
  const day = eatDate(at);
  const used = Object.fromEntries(
    channels.map((channel) => [
      channel,
      proofs.filter(
        (p) =>
          p.channel === channel &&
          p.mode !== "Sample" &&
          (p.status === "In inbox" || p.status === "Offline preview") &&
          eatDate(p.createdAt) === day,
      ).length,
    ]),
  ) as Record<Channel, number>;
  return { ...used, smsSpend: used.SMS * smsCost };
}
function makeProof(input: {
  channel: Channel;
  mode: Delivery["mode"];
  subject: string;
  at: number;
  critical?: boolean;
  nativeSms?: boolean;
  notificationId?: string;
  target?: string;
}): Delivery {
  const { channel, mode, at } = input,
    used = dailyRouteUsage(at),
    target = deliveryTargets[channel];
  const quiet = channel !== "In-app" && !input.critical && isQuietAt(at);
  const duplicate =
    channel === "SMS" && input.nativeSms && deliverySettings.nativeDedupe;
  const capped =
    used[channel] >= deliverySettings.limits[channel] ||
    (channel === "SMS" && used.smsSpend + smsCost > deliverySettings.smsBudget);
  // In-app visibility for critical events is never suppressed by caps.
  const proof: Delivery = {
    id: next("NT-PROOF"),
    channel,
    mode,
    notificationId: input.notificationId,
    createdAt: new Date(at).toISOString(),
    subject: input.subject,
    target: input.target ?? target.target,
    status: duplicate
      ? "Duplicate SMS"
      : quiet
        ? "Quiet hours"
        : capped && !(channel === "In-app" && input.critical)
          ? "Rate capped"
          : channel === "In-app"
            ? "In inbox"
            : "Offline preview",
    detail: duplicate
      ? "Skipped: the native M-Pesa message already covers this event."
      : quiet
        ? `Suppressed in ${quietSettings.start}–${quietSettings.end} EAT. No delayed send is scheduled.`
        : capped && !(channel === "In-app" && input.critical)
          ? "Suppressed by the local day cap or illustrative SMS budget."
          : channel === "In-app"
            ? "Recorded in the local inbox."
            : target.detail,
  };
  proofs.push(proof);
  return proof;
}
export function publishNotice(input: NoticeInput, at = Date.now()) {
  const definition = locateEvent(input.event);
  if (!definition) throw new Error("Unknown notification class.");
  if (input.id && eventKeys.has(input.id)) return eventKeys.get(input.id);
  const severity = input.severity ?? definition.severity,
    critical = severity === "Critical" || definition.severity === "Critical";
  // Muted classes hide prior noncritical items and suppress new ones for all channels.
  if (muted.has(input.event) && !critical) return undefined;
  const id = next("NT"),
    selected = new Set(input.selectedChannels ?? routes.get(input.event));
  if (critical) selected.add("In-app");
  if (input.event === "killswitch.engaged")
    channels.forEach((c) => selected.add(c));
  else if (input.event === "guard.blocked" && critical) selected.add("Push");
  const deliveries = channels
    .filter((c) => selected.has(c))
    .flatMap((channel) => {
      if (channel === "Telegram") {
        const targets = linkedChats.filter(
          (c) => c.scope === "All" || critical,
        );
        if (!targets.length) {
          const skipped: Delivery = {
            id: next("NT-PROOF"),
            channel,
            mode: "Event",
            status: "No eligible chat",
            target: "Local chat routing",
            createdAt: new Date(at).toISOString(),
            subject: input.title,
            detail:
              "No demo chat matches this event severity. Nothing was sent.",
            notificationId: id,
          };
          proofs.push(skipped);
          return [skipped];
        }
        return targets.map((c) =>
          makeProof({
            channel,
            mode: "Event",
            subject: input.title,
            critical,
            at,
            notificationId: id,
            target: c.masked,
          }),
        );
      }
      return [
        makeProof({
          channel,
          mode: "Event",
          subject: input.title,
          critical,
          at,
          nativeSms: input.nativeSms,
          notificationId: id,
        }),
      ];
    });
  const row: Notice = {
    id,
    event: input.event,
    title: input.title,
    body: input.body,
    severity: critical ? "Critical" : severity,
    destination: input.destination ?? definition.destination,
    accountLabel: input.accountLabel ?? "Workspace",
    ref: input.ref,
    createdAt: new Date(at).toISOString(),
    deliveries,
    source: "Local",
  };
  notices.set(id, row);
  if (input.id) eventKeys.set(input.id, row);
  notifyChanged();
  return row;
}
export function rehearseChannel(
  channel: Channel,
  at = Date.now(),
  target?: string,
  nativeSms = false,
) {
  if (channel === "In-app") {
    const id = next("NT");
    const proof = makeProof({
      channel,
      mode: "Test",
      subject: "Local in-app channel test",
      at,
      notificationId: id,
      target,
    });
    if (proof.status === "In inbox")
      notices.set(id, {
        id,
        event: "alert.triggered",
        title: "Local in-app channel test",
        body: "The demo envelope was recorded here. No external message was sent.",
        severity: "Info",
        destination: "notifications",
        accountLabel: "Workspace",
        createdAt: proof.createdAt,
        deliveries: [proof],
        source: "Local",
      });
    notifyChanged();
    return proof;
  }
  const proof = makeProof({
    channel,
    mode: "Test",
    subject: nativeSms
      ? "M-Pesa SMS dedupe rehearsal"
      : `${channel} routing test`,
    at,
    target,
    nativeSms,
  });
  notifyChanged();
  return proof;
}
export function reviewFallback(at = Date.now()) {
  if (!deliverySettings.fallback)
    return { matched: 0, previews: 0, blocked: 0 };
  const eligible = visibleNotices().filter(
    (n) =>
      n.severity === "Critical" &&
      !n.readAt &&
      at - Date.parse(n.createdAt) >= 600_000 &&
      n.deliveries.some(
        (d) => d.channel === "Push" && d.status === "Offline preview",
      ) &&
      !n.deliveries.some(
        (d) => d.channel === "SMS" && d.status === "Offline preview",
      ) &&
      !n.deliveries.some((d) => d.mode === "Fallback"),
  );
  let previews = 0,
    blocked = 0;
  for (const n of eligible) {
    const proof = makeProof({
      channel: "SMS",
      mode: "Fallback",
      subject: n.title,
      at,
      critical: true,
      notificationId: n.id,
    });
    n.deliveries.push(proof);
    if (proof.status === "Offline preview") previews++;
    else blocked++;
  }
  if (eligible.length) notifyChanged();
  return { matched: eligible.length, previews, blocked };
}
