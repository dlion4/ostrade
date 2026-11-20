import {
  alertKinds,
  channels,
  commands,
  defaultDigest,
  deliveryTargets,
  digestSections,
  eventCatalog,
  seedNonPriceRules,
  smsCost,
  type AlertDraft,
  type AlertRule,
  type Channel,
  type ChatScope,
  type DeliveryPolicy,
  type DigestSettings,
  type EventClass,
  type LinkedChat,
  type QuietPolicy,
} from "@/data/notifications";
import { latency } from "./_latency";
import {
  getAccounts,
  getEconomicEvents,
  getLocalKillSwitch,
  getPositions,
  getSignalRules,
} from "./dashboard";
import {
  createPriceAlert,
  getMarketUniverse,
  getPriceAlerts,
  removePriceAlert,
  updatePriceAlertState,
  type PriceAlert,
} from "./markets";
import {
  getRecordExports,
  getTradeRecords,
  queueRecordExport,
} from "./records";
import { getSchedulerSchedules } from "./scheduler";
import { runRiskControl } from "./risk";
import {
  allDeliveryProof,
  dailyRouteUsage,
  deliverySettings,
  eatClock,
  eatDate,
  getMatrixSnapshot,
  isQuietAt,
  linkedChats,
  mutedClasses,
  notifyChanged,
  publishNotice,
  quietSettings,
  rehearseChannel,
  removeNotices,
  reviewFallback,
  setChannelRoute,
  setDelivery,
  setMutedClass,
  setQuiet,
  storeChats,
  updateRead,
  visibleNotices,
} from "./notificationStore";
export {
  alertKinds,
  channels,
  commands,
  deliveryTargets,
  digestSections,
  eventCatalog,
  smsCost,
};
export { subscribeNotifications } from "./notificationStore";
export type {
  AlertDraft,
  AlertKind,
  AlertRule,
  Channel,
  ChatScope,
  Delivery,
  DeliveryPolicy,
  DigestSettings,
  EventClass,
  LinkedChat,
  Notice,
  QuietPolicy,
} from "@/data/notifications";

const minute = 60_000,
  day = 1440 * minute;
const now = () => new Date().toISOString();
export const notificationTime = (at: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(at));
const timeOk = (value: string) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
export const notificationKey = ["notifications"] as const;
export type NoticeFilters = {
  event?: EventClass;
  channel?: Channel;
  state?: "Unread" | "Read";
  from?: string;
  to?: string;
  search?: string;
};
export const getNotifications = (filters: NoticeFilters = {}) =>
  latency(
    visibleNotices().filter((n) => {
      const d = eatDate(n.createdAt),
        search = filters.search?.trim().toLowerCase();
      return (
        (!filters.event || n.event === filters.event) &&
        (!filters.channel ||
          n.deliveries.some((c) => c.channel === filters.channel)) &&
        (!filters.state || (filters.state === "Read") === !!n.readAt) &&
        (!filters.from || d >= filters.from) &&
        (!filters.to || d <= filters.to) &&
        (!search ||
          [n.title, n.body, n.ref, n.accountLabel]
            .join(" ")
            .toLowerCase()
            .includes(search))
      );
    }),
  );
export const getNotificationOverview = () => {
  const n = visibleNotices(),
    d = Date.now();
  const clock = new Date(d + 10_800_000),
    weekday = clock.getUTCDay() || 7,
    start = eatDate(d - (weekday - 1) * day);
  const unread = n.filter((x) => !x.readAt);
  return latency({
    unread: unread.length,
    today: n.filter((x) => eatDate(x.createdAt) === eatDate(d)).length,
    week: n.filter((x) => eatDate(x.createdAt) >= start).length,
    muted: mutedClasses().length,
    critical: unread.filter((x) => x.severity === "Critical").length,
    recent: unread.slice(0, 4),
    clock: eatClock(d),
  });
};
export async function updateNotifications(input: {
  action: "read" | "unread" | "delete" | "read-all" | "clear-read";
  ids?: string[];
}) {
  const ids = input.ids ?? [];
  if (input.action === "read-all")
    return latency({ count: updateRead(visibleNotices().map((n) => n.id)) });
  if (input.action === "clear-read")
    return latency({
      count: removeNotices(
        visibleNotices()
          .filter((n) => n.readAt)
          .map((n) => n.id),
      ),
    });
  if (input.action === "delete") return latency({ count: removeNotices(ids) });
  if (input.action !== "read" && input.action !== "unread")
    throw new Error("Invalid inbox action.");
  return latency({ count: updateRead(ids, input.action === "read") });
}
export const getNotificationMatrix = () => latency(getMatrixSnapshot());
export async function updateNotificationRoute(input: {
  event: EventClass;
  channel: Channel;
  enabled: boolean;
}) {
  if (typeof input.enabled !== "boolean")
    throw new Error("Invalid routing state.");
  setChannelRoute(input.event, input.channel, input.enabled);
  return latency({ message: "Route preference saved locally." });
}
export async function updateMutedClass(input: {
  event: EventClass;
  muted: boolean;
}) {
  if (typeof input.muted !== "boolean") throw new Error("Invalid mute state.");
  setMutedClass(input.event, input.muted);
  return latency({
    message: input.muted
      ? "Class muted. Critical notices are not affected."
      : "Class restored to the inbox.",
  });
}
export const getDeliveryPreferences = () =>
  latency({
    quiet: quietSettings,
    delivery: deliverySettings,
    usage: dailyRouteUsage(),
    clock: eatClock(),
    quietNow: isQuietAt(Date.now()),
  });
export async function saveQuietHours(input: QuietPolicy) {
  if (
    typeof input.enabled !== "boolean" ||
    !timeOk(input.start) ||
    !timeOk(input.end) ||
    input.start === input.end
  )
    throw new Error("Use two different, valid times in EAT.");
  setQuiet({ enabled: input.enabled, start: input.start, end: input.end });
  return latency({
    message: "Quiet hours saved. Critical routes bypass the quiet window.",
  });
}
export async function saveDeliveryPolicy(input: DeliveryPolicy) {
  if (
    !input.limits ||
    !Number.isFinite(input.smsBudget) ||
    input.smsBudget < 0 ||
    input.smsBudget > 1000 ||
    typeof input.fallback !== "boolean" ||
    typeof input.nativeDedupe !== "boolean"
  )
    throw new Error(
      "Use valid channel settings and a KES budget from 0 to 1,000.",
    );
  const limits = Object.fromEntries(
    channels.map((c) => [c, input.limits[c]]),
  ) as DeliveryPolicy["limits"];
  for (const c of channels) {
    const n = limits[c];
    if (
      !Number.isInteger(n) ||
      n < (c === "In-app" ? 1 : 0) ||
      n > (c === "SMS" ? 100 : 1000)
    )
      throw new Error(`Invalid daily limit for ${c}.`);
  }
  setDelivery({
    limits,
    smsBudget: Math.round(input.smsBudget * 100) / 100,
    fallback: input.fallback,
    nativeDedupe: input.nativeDedupe,
  });
  return latency({
    message: "Channel caps and fallback policy saved locally.",
  });
}
export async function testNotificationChannel(input: {
  channel: Channel;
  chatId?: string;
  nativeSms?: boolean;
}) {
  if (!channels.includes(input.channel)) throw new Error("Choose a channel.");
  const chat = input.chatId
    ? linkedChats.find((c) => c.id === input.chatId)
    : undefined;
  if (input.chatId && (!chat || input.channel !== "Telegram"))
    throw new Error("Choose an existing demo chat.");
  if (input.nativeSms && input.channel !== "SMS")
    throw new Error("Native M-Pesa dedupe is an SMS-only scenario.");
  return latency(
    rehearseChannel(input.channel, Date.now(), chat?.masked, input.nativeSms),
  );
}
export const getDeliveryLog = () => latency(allDeliveryProof());
export async function runFallbackReview() {
  return latency(reviewFallback());
}
export async function exportDeliveryProof(ids?: string[]) {
  const set = ids ? new Set(ids) : undefined;
  const proof = allDeliveryProof().filter((p) => !set || set.has(p.id));
  return latency({
    name: `ostrade-delivery-proof-${eatDate()}.json`,
    count: proof.length,
    text: JSON.stringify(proof, null, 2),
  });
}

const createdAt = now();
const extras = new Map<string, AlertRule>(
  seedNonPriceRules.map((r) => [
    r.id,
    { ...r, createdAt, status: r.active ? "Active" : "Paused" },
  ]),
);
const priceMeta = new Map<string, AlertRule>();
const matches = new Map<string, boolean>();
let scanning = false;
const stateFor = (r: AlertRule): AlertRule["status"] =>
  !r.repeat && r.firedCount > 0
    ? "Completed"
    : !r.active
      ? "Paused"
      : r.snoozedUntil && Date.parse(r.snoozedUntil) > Date.now()
        ? "Snoozed"
        : "Active";
const toRule = (p: PriceAlert): AlertRule => {
  const saved = priceMeta.get(p.id);
  if (saved) return { ...saved, status: stateFor(saved) };
  const channelsFor = channels.filter((c) =>
    p.channel.split(" + ").includes(c),
  );
  return {
    id: p.id,
    priceKey: p.id,
    kind: "PRICE",
    title: `${p.canonical} price ${p.condition}`,
    target: p.canonical,
    direction: p.condition,
    threshold: p.price,
    repeat: false,
    channels: channelsFor,
    active: p.status === "armed",
    firedCount: p.status === "triggered" ? 1 : 0,
    status:
      p.status === "expired"
        ? "Completed"
        : p.status === "triggered"
          ? "Completed"
          : p.status === "armed"
            ? "Active"
            : "Paused",
    createdAt,
    source: "Markets",
  };
};
export const getAlertRules = async () => [
  ...(await getPriceAlerts()).map(toRule),
  ...[...extras.values()].map((r) => ({ ...r, status: stateFor(r) })),
];
async function alertContext() {
  const [markets, accounts, events] = await Promise.all([
    getMarketUniverse(),
    getAccounts(),
    getEconomicEvents(),
  ]);
  return { markets, accounts, events };
}
export async function getAlertCatalog() {
  const { markets, accounts, events } = await alertContext();
  return {
    markets: markets.map((s) => ({
      id: s.canonical,
      label: s.canonical,
      bid: s.bid,
    })),
    accounts: accounts.map((a) => ({ id: a.id, label: a.label })),
    events: events.map((e) => ({ id: e.id, label: e.title, time: e.timeEat })),
  };
}
function validateAlert(
  input: AlertDraft,
  ctx: Awaited<ReturnType<typeof alertContext>>,
) {
  const { kind, target, direction, threshold, basis, repeat } = input;
  if (
    !alertKinds.some((k) => k.id === kind) ||
    !["above", "below"].includes(direction) ||
    !Number.isFinite(threshold) ||
    typeof repeat !== "boolean" ||
    !Array.isArray(input.channels) ||
    input.channels.some((c) => !channels.includes(c))
  )
    throw new Error("Choose valid alert conditions and channels.");
  if (kind === "PRICE" && (threshold <= 0 || threshold > 1e10))
    throw new Error("Enter a positive price.");
  if (
    kind === "PCT_MOVE" &&
    (Math.abs(threshold) > 100 || !basis || !["Open", "24h"].includes(basis))
  )
    throw new Error("Choose a move basis and a threshold from −100% to +100%.");
  if (kind === "MARGIN" && (threshold < 1 || threshold > 10000))
    throw new Error("Enter a margin level from 1% to 10,000%.");
  if (kind === "PNL" && Math.abs(threshold) > 1e6)
    throw new Error("Enter a USD threshold between −1,000,000 and +1,000,000.");
  if (
    kind === "EVENT" &&
    (!Number.isInteger(threshold) || threshold < 5 || threshold > 240)
  )
    throw new Error("Choose a whole lead time from 5–240 minutes.");
  const name =
    kind === "EVENT"
      ? ctx.events.find((e) => e.id === target)?.title
      : kind === "PRICE" || kind === "PCT_MOVE"
        ? ctx.markets.find((s) => s.canonical === target)?.canonical
        : ctx.accounts.find((a) => a.id === target)?.label;
  if (!name)
    throw new Error(
      "Select a symbol, account, or event from the local catalog.",
    );
  return {
    name,
    draft: {
      kind,
      target,
      direction,
      threshold,
      basis: kind === "PCT_MOVE" ? basis : undefined,
      repeat: kind === "EVENT" ? false : repeat,
      channels: channels.filter(
        (c) => c === "In-app" || input.channels.includes(c),
      ),
    },
  };
}
export async function createAlertRule(
  input: AlertDraft,
  source: AlertRule["source"] = "Dashboard",
) {
  const ctx = await alertContext(),
    { name, draft } = validateAlert(input, ctx);
  const price =
    draft.kind === "PRICE"
      ? await createPriceAlert({
          canonical: draft.target,
          price: draft.threshold,
          condition: draft.direction,
          note: source,
          channel: draft.channels.join(" + "),
        })
      : undefined;
  const id = price?.id ?? `NT-RULE-${crypto.randomUUID().slice(0, 10)}`;
  const rule: AlertRule = {
    ...draft,
    id,
    priceKey: price?.id,
    title: `${name} · ${alertKinds.find((r) => r.id === draft.kind)!.label}`,
    status: "Active",
    active: true,
    firedCount: 0,
    createdAt: now(),
    source,
  };
  (price ? priceMeta : extras).set(id, rule);
  notifyChanged();
  return latency(rule);
}
const priceState = (rule: AlertRule) => {
  if (rule.priceKey) {
    const s = stateFor(rule);
    updatePriceAlertState(
      rule.priceKey,
      s === "Active"
        ? "armed"
        : s === "Completed"
          ? "triggered"
          : s === "Snoozed"
            ? "snoozed"
            : "paused",
    );
  }
};
export async function changeAlertRule(input: {
  id: string;
  action: "pause" | "activate" | "snooze" | "delete";
  minutes?: number;
}) {
  if (scanning) throw new Error("Wait for the local snapshot check to finish.");
  const rule = (await getAlertRules()).find((r) => r.id === input.id);
  if (!rule) throw new Error("Alert rule not found.");
  if (input.action === "delete") {
    if (rule.priceKey) await removePriceAlert(rule.priceKey);
    if (rule.priceKey) priceMeta.delete(rule.id);
    else extras.delete(rule.id);
    matches.delete(rule.id);
    notifyChanged();
    return latency({ message: "Alert removed." });
  }
  if (rule.status === "Completed")
    throw new Error(
      "One-shot rule is complete. Create a new rule to watch again.",
    );
  if (input.action === "snooze") {
    if (!input.minutes || ![15, 60, 240].includes(input.minutes))
      throw new Error("Choose 15, 60, or 240 minutes.");
    rule.snoozedUntil = new Date(
      Date.now() + input.minutes * minute,
    ).toISOString();
    rule.active = true;
  } else if (input.action === "pause" || input.action === "activate") {
    rule.active = input.action === "activate";
    rule.snoozedUntil = undefined;
  } else throw new Error("Unknown alert action.");
  rule.status = stateFor(rule);
  (rule.priceKey ? priceMeta : extras).set(rule.id, rule);
  priceState(rule);
  notifyChanged();
  return latency({ message: `${rule.title} · ${rule.status}.` });
}
const minsUntil = (countdown: string) =>
  [...countdown.matchAll(/(\d+)\s*([dhm])/g)].reduce(
    (n, m) => n + Number(m[1]) * ({ d: 1440, h: 60, m: 1 }[m[2]] ?? 0),
    0,
  );
export async function checkAlertRules() {
  if (scanning) throw new Error("A local alert scan is already running.");
  scanning = true;
  try {
    const [rules, ctx] = await Promise.all([getAlertRules(), alertContext()]);
    const output: {
      id: string;
      title: string;
      observed: string;
      outcome: string;
    }[] = [];
    let fired = 0;
    for (const rule of rules) {
      if (rule.status !== "Active") continue;
      const market = ctx.markets.find((m) => m.canonical === rule.target),
        account = ctx.accounts.find((a) => a.id === rule.target),
        event = ctx.events.find((e) => e.id === rule.target);
      let observed: number | undefined,
        unit = "";
      if (rule.kind === "PRICE") observed = market?.bid;
      if (rule.kind === "PCT_MOVE") {
        observed =
          rule.basis === "24h"
            ? market?.changePct
            : market?.sparkline[0]
              ? 100 * (market.bid / market.sparkline[0] - 1)
              : undefined;
        unit = "%";
      }
      if (rule.kind === "MARGIN") {
        observed = account
          ? account.marginUsedPct > 0
            ? 10000 / account.marginUsedPct
            : Infinity
          : undefined;
        unit = "%";
      }
      if (rule.kind === "PNL") {
        observed = account?.realizedToday;
        unit = " USD";
      }
      if (rule.kind === "EVENT" && event?.countdown.startsWith("in ")) {
        observed = minsUntil(event.countdown);
        unit = " min to event";
      }
      const met =
        observed !== undefined &&
        (rule.kind === "EVENT"
          ? observed <= rule.threshold
          : rule.direction === "above"
            ? observed > rule.threshold
            : observed < rule.threshold);
      const fresh = met && !matches.get(rule.id);
      matches.set(rule.id, met);
      const label =
        observed === undefined
          ? "Unavailable"
          : Number.isFinite(observed)
            ? `${Number(observed.toFixed(market?.digits ?? 2))}${unit}`
            : "No margin used";
      output.push({
        id: rule.id,
        title: rule.title,
        observed: label,
        outcome: fresh ? "Triggered" : met ? "Already matched" : "Not met",
      });
      if (!fresh) continue;
      const updated = {
        ...rule,
        lastFiredAt: now(),
        firedCount: rule.firedCount + 1,
        active: rule.repeat,
      };
      updated.status = stateFor(updated);
      (rule.priceKey ? priceMeta : extras).set(rule.id, updated);
      priceState(updated);
      fired++;
      publishNotice({
        id: `${rule.id}:${updated.firedCount}`,
        event: rule.kind === "EVENT" ? "news.reminder" : "alert.triggered",
        title: `Alert: ${rule.title}`,
        body: `Fixed snapshot: ${label}. ${rule.kind === "EVENT" ? "Calendar lead time reached." : `Threshold ${rule.direction} ${rule.threshold}${unit}.`} No price feed or provider was contacted.`,
        accountLabel: account?.label,
        ref: rule.id,
        destination:
          rule.kind === "EVENT" ||
          rule.kind === "PRICE" ||
          rule.kind === "PCT_MOVE"
            ? "markets"
            : "risk",
        selectedChannels: rule.channels,
      });
    }
    notifyChanged();
    return latency({ checked: output.length, fired, output });
  } finally {
    scanning = false;
  }
}

let digest = structuredClone(defaultDigest);
let weeklyJobId: string | undefined;
export const getDigestSettings = () => latency(digest);
export async function saveDigestSettings(input: DigestSettings) {
  if (
    !timeOk(input.time) ||
    !Array.isArray(input.contents) ||
    input.contents.some((s) => !digestSections.includes(s)) ||
    (input.daily && !input.contents.length) ||
    [input.daily, input.weekly, input.attachPdf, input.monthly].some(
      (v) => typeof v !== "boolean",
    )
  )
    throw new Error(
      "Set a valid EAT time and choose at least one daily section when enabled.",
    );
  digest = {
    daily: input.daily,
    time: input.time,
    contents: digestSections.filter((s) => input.contents.includes(s)),
    weekly: input.weekly,
    attachPdf: input.weekly && input.attachPdf,
    monthly: input.monthly,
  };
  return latency({
    message: "Digest preferences saved. Nothing is scheduled or sent.",
  });
}
export async function getDigestPreview() {
  const settings = structuredClone(digest);
  const [accounts, positions, rules, schedules, events, jobList] =
    await Promise.all([
      getAccounts(),
      getPositions(),
      getSignalRules(),
      getSchedulerSchedules(),
      getEconomicEvents(),
      getRecordExports(),
    ]);
  const date = eatDate(Date.now() + (eatClock() >= settings.time ? day : 0));
  const content: Record<(typeof digestSections)[number], string[]> = {
    "P&L": accounts
      .filter((a) => a.realizedToday !== 0)
      .map(
        (a) =>
          `${a.label}: ${a.realizedToday < 0 ? "−" : "+"}$${Math.abs(a.realizedToday).toFixed(2)} realized`,
      ),
    "Open positions": [
      `Workspace: ${positions.length} open positions · ${positions.filter((p) => p.broker === "paper").length} Paper`,
      `${positions.filter((p) => p.sl <= 0).length} positions without a stop in the snapshot`,
    ],
    Automation: [
      `${rules.filter((r) => r.enabled).length} enabled rules · ${schedules.filter((s) => s.status === "armed").length} armed schedules`,
      `Emergency state: ${getLocalKillSwitch().toUpperCase()}`,
    ],
    "Tomorrow’s events": events
      .filter((e) => e.timeEat.startsWith("Tomorrow"))
      .map((e) => `${e.title} · ${e.timeEat}`),
  };
  return latency({
    date,
    time: settings.time,
    settings,
    sections: settings.contents.map((label) => ({
      label,
      lines: content[label].length
        ? content[label]
        : ["No matching items in the snapshot."],
    })),
    pdf:
      settings.weekly && settings.attachPdf
        ? jobList.find((j) => j.id === weeklyJobId && j.status === "Ready")
            ?.name
        : undefined,
  });
}
export async function queueDigestReport() {
  if (!digest.weekly || !digest.attachPdf)
    throw new Error("Enable the weekly report and PDF attachment first.");
  const start = eatDate(Date.now() - 6 * day),
    end = eatDate();
  const records = await getTradeRecords();
  const ids = records
    .filter((r) => eatDate(r.closedAt) >= start && eatDate(r.closedAt) <= end)
    .map((r) => r.id);
  if (!ids.length)
    throw new Error("No records in the current seven-day local window.");
  const job = await queueRecordExport({
    format: "PDF",
    tradeIds: ids,
    email: false,
    sms: false,
  });
  weeklyJobId = job.id;
  return {
    message:
      "A local PDF was queued in Records. It is not attached to a real delivery.",
    jobId: job.id,
  };
}

let pairing: { code: string; expiresAt: string } | undefined;
export const getTelegramPanel = () =>
  latency({
    chats: linkedChats,
    provider: "Offline preview" as const,
    pairing:
      pairing && Date.parse(pairing.expiresAt) > Date.now()
        ? pairing
        : undefined,
  });
export async function resetTelegramPreview() {
  const count = linkedChats.length;
  storeChats([]);
  pairing = undefined;
  commandPrompt.clear();
  return latency(count);
}
export async function startTelegramPairing() {
  if (linkedChats.length >= 10)
    throw new Error("Up to ten demo chats are allowed.");
  const code = String(
    100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000),
  );
  pairing = {
    code,
    expiresAt: new Date(Date.now() + 5 * minute).toISOString(),
  };
  return latency(pairing);
}
export async function confirmTelegramPairing(input: {
  code: string;
  label: string;
  scope: ChatScope;
}) {
  if (
    !pairing ||
    Date.parse(pairing.expiresAt) <= Date.now() ||
    pairing.code !== input.code
  )
    throw new Error("Use the current demo pairing code before it expires.");
  const label = input.label.trim();
  if (
    !/^[a-z\d][a-z\d ._-]{1,31}$/i.test(label) ||
    /\d{4}/.test(label) ||
    !["All", "Critical only"].includes(input.scope)
  )
    throw new Error(
      "Use a short demo label with no phone numbers, handles, or credentials.",
    );
  if (
    linkedChats.length >= 10 ||
    linkedChats.some((c) => c.label.toLowerCase() === label.toLowerCase())
  )
    throw new Error("Use a unique demo label, up to ten chats.");
  pairing = undefined;
  const id = crypto.randomUUID().slice(0, 8),
    chat: LinkedChat = {
      id: `NT-CHAT-${id}`,
      label,
      masked: `Demo chat ••${id.slice(-2)}`,
      scope: input.scope,
      pairedAt: now(),
      source: "Local pairing",
    };
  storeChats([...linkedChats, chat]);
  return latency(chat);
}
export async function changeTelegramChat(input: {
  id: string;
  action: "scope" | "unlink";
  scope?: ChatScope;
}) {
  const chat = linkedChats.find((c) => c.id === input.id);
  if (!chat) throw new Error("Choose an existing demo chat.");
  if (input.action === "unlink")
    storeChats(linkedChats.filter((c) => c.id !== input.id));
  else if (
    input.action === "scope" &&
    input.scope &&
    ["All", "Critical only"].includes(input.scope)
  )
    storeChats(
      linkedChats.map((c) =>
        c.id === input.id ? { ...c, scope: input.scope! } : c,
      ),
    );
  else throw new Error("Choose a valid chat scope.");
  return latency({
    message:
      input.action === "unlink"
        ? "Demo chat removed locally."
        : "Demo chat scope saved.",
  });
}
const emergencyCommands = {
  "/pause": "pause",
  "/resume": "rearm",
  "/kill": "lockdown",
  "/closeall": "flatten",
} as const;
const commandPrompt = new Map<
  string,
  {
    expires: number;
    action?: (typeof emergencyCommands)[keyof typeof emergencyCommands];
    draft?: AlertDraft;
  }
>();
export async function previewTelegramCommand(raw: string) {
  const text = raw.trim();
  if (text.length > 80)
    throw new Error("Use one of the supported demo commands.");
  if (text === "/status") {
    const accounts = await getAccounts();
    return latency({
      title: "Workspace status",
      lines: [
        `${accounts.length} local account profiles`,
        `Emergency state: ${getLocalKillSwitch().toUpperCase()}`,
        "No Telegram request was made.",
      ],
      review: undefined,
    });
  }
  if (text === "/positions") {
    const p = await getPositions();
    return latency({
      title: "Open positions",
      lines: [
        `${p.length} positions in the local snapshot`,
        ...p
          .slice(0, 5)
          .map((r) => `${r.symbol} ${r.side} · ${r.accountLabel}`),
      ],
      review: undefined,
    });
  }
  if (text === "/pending") {
    const s = (await getSchedulerSchedules()).filter(
      (r) => r.status === "armed",
    );
    return latency({
      title: "Armed schedule snapshots",
      lines: [
        `${s.length} armed local previews`,
        ...s.slice(0, 5).map((r) => `${r.ref} · ${r.name}`),
      ],
      review: undefined,
    });
  }
  const action = Object.entries(emergencyCommands).find(
    ([command]) => command === text,
  )?.[1];
  const match = text.match(/^\/alert\s+([a-z0-9_]+)\s+(\d+(?:\.\d+)?)$/i);
  let draft: AlertDraft | undefined;
  if (match) {
    const target = match[1].toUpperCase(),
      threshold = Number(match[2]),
      m = (await getMarketUniverse()).find((s) => s.canonical === target);
    if (!m || threshold === m.bid)
      throw new Error(
        "Choose a supported instrument and a price different from the fixed bid.",
      );
    draft = {
      kind: "PRICE",
      target,
      threshold,
      direction: threshold > m.bid ? "above" : "below",
      repeat: false,
      channels: ["In-app", "Telegram"],
    };
    validateAlert(draft, await alertContext());
  }
  if (!action && !draft)
    throw new Error("Unsupported command. Try /status or /alert EURUSD 1.09.");
  for (const [id, item] of commandPrompt)
    if (item.expires <= Date.now()) commandPrompt.delete(id);
  if (commandPrompt.size >= 30)
    throw new Error(
      "Too many pending local reviews. Confirm one or wait for expiry.",
    );
  const key = crypto.randomUUID();
  commandPrompt.set(key, { expires: Date.now() + 5 * minute, action, draft });
  return latency({
    title: draft ? `Review ${draft.target} price alert` : `Review ${text}`,
    lines: draft
      ? [
          `${draft.direction} ${draft.threshold} · one-shot · In-app and Telegram preview`,
          "Confirm to create the local rule.",
        ]
      : [
          action === "flatten"
            ? "Only Paper positions can close; broker positions stay untouched."
            : "Uses the same local Risk control and audit as the dashboard.",
          "This is a browser rehearsal, not a Telegram message or a remote action.",
        ],
    review: { key, protected: !!action },
  });
}
export async function confirmTelegramCommand(input: {
  key: string;
  confirm: boolean;
  reason?: string;
  code?: string;
}) {
  const p = commandPrompt.get(input.key);
  if (!p || Date.now() >= p.expires || !input.confirm)
    throw new Error("Open and explicitly confirm a current command preview.");
  if (
    p.action &&
    (input.code !== "123456" || (input.reason?.trim().length ?? 0) < 12)
  )
    throw new Error(
      "Enter a reason of at least 12 characters and the example code 123456.",
    );
  commandPrompt.delete(input.key);
  if (p.action) {
    const result = await runRiskControl({
      kind: p.action,
      reason: input.reason!,
      code: input.code,
      source: "Telegram rehearsal",
    });
    return { message: result.message, ref: result.ref };
  }
  const r = await createAlertRule(p.draft!, "Telegram rehearsal");
  return {
    message: "Price alert created in the shared Markets/Notifications store.",
    ref: r.id,
  };
}
