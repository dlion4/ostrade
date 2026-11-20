import { initialAlerts } from "./dashboard";

export const channels = ["In-app", "Email", "SMS", "Push", "Telegram"] as const;
export type Channel = (typeof channels)[number];
export type Severity = "Critical" | "Warning" | "Info" | "Finance";
export const eventClasses = [
  [
    "order.filled",
    "Order filled",
    "Trading",
    "positions",
    "Info",
    ["In-app", "Push"],
  ],
  [
    "order.rejected",
    "Order rejected",
    "Trading",
    "records",
    "Warning",
    ["In-app", "Push", "Email"],
  ],
  [
    "sl.hit",
    "Stop-loss hit",
    "Trading",
    "positions",
    "Warning",
    ["In-app", "Push"],
  ],
  [
    "tp.hit",
    "Take-profit hit",
    "Trading",
    "records",
    "Info",
    ["In-app", "Push"],
  ],
  [
    "margin.warning",
    "Margin warning",
    "Risk",
    "positions",
    "Warning",
    ["In-app", "Push"],
  ],
  [
    "margin.call",
    "Margin call",
    "Risk",
    "risk",
    "Critical",
    ["In-app", "Push", "SMS"],
  ],
  [
    "schedule.fired",
    "Schedule fired",
    "Automation",
    "scheduler",
    "Info",
    ["In-app"],
  ],
  [
    "schedule.failed",
    "Schedule failed",
    "Automation",
    "scheduler",
    "Warning",
    ["In-app", "Push", "Email"],
  ],
  ["rule.fired", "Rule fired", "Automation", "automation", "Info", ["In-app"]],
  ["guard.blocked", "Guardrail blocked", "Risk", "risk", "Warning", ["In-app"]],
  [
    "broker.disconnected",
    "Broker disconnected",
    "Workspace",
    "accounts",
    "Critical",
    ["In-app", "Push", "Email"],
  ],
  [
    "adapter.reconnected",
    "Adapter reconnected",
    "Workspace",
    "accounts",
    "Info",
    ["In-app"],
  ],
  [
    "deposit.confirmed",
    "Deposit confirmed",
    "Finance",
    "deposits",
    "Finance",
    ["In-app", "Push", "Email"],
  ],
  [
    "withdraw.settled",
    "Withdrawal settled",
    "Finance",
    "withdrawals",
    "Finance",
    ["In-app", "Push", "Email", "SMS"],
  ],
  [
    "transfer.completed",
    "Transfer completed",
    "Finance",
    "transfers",
    "Finance",
    ["In-app", "Email"],
  ],
  [
    "copilot.proposal",
    "Co-Pilot proposal",
    "Workspace",
    "copilot",
    "Info",
    ["In-app"],
  ],
  [
    "killswitch.engaged",
    "Kill switch engaged",
    "Risk",
    "risk",
    "Critical",
    channels,
  ],
  [
    "anomaly.detected",
    "Anomaly detected",
    "Risk",
    "copilot",
    "Warning",
    ["In-app", "Push"],
  ],
  [
    "alert.triggered",
    "Custom alert",
    "Workspace",
    "notifications",
    "Info",
    ["In-app"],
  ],
  [
    "news.reminder",
    "News reminder",
    "Workspace",
    "markets",
    "Info",
    ["In-app", "Push"],
  ],
] as const;
export type EventClass = (typeof eventClasses)[number][0];
export type Destination = (typeof eventClasses)[number][3] | "signals";
export const eventCatalog = eventClasses.map(
  ([id, label, group, destination, severity, defaults]) => ({
    id,
    label,
    group,
    destination,
    severity,
    defaults,
  }),
);
export type DeliveryStatus =
  | "In inbox"
  | "Offline preview"
  | "Quiet hours"
  | "Rate capped"
  | "Duplicate SMS"
  | "No eligible chat";
export type Delivery = {
  id: string;
  notificationId?: string;
  channel: Channel;
  status: DeliveryStatus;
  target: string;
  detail: string;
  createdAt: string;
  mode: "Event" | "Test" | "Fallback" | "Sample";
  subject: string;
};
export type Notice = {
  id: string;
  event: EventClass;
  title: string;
  body: string;
  severity: Severity;
  destination: Destination;
  accountLabel: string;
  ref?: string;
  createdAt: string;
  readAt?: string;
  source: "Sample" | "Local";
  deliveries: Delivery[];
};
export type NoticeInput = {
  id?: string;
  event: EventClass;
  title: string;
  body: string;
  accountLabel?: string;
  ref?: string;
  destination?: Destination;
  severity?: Severity;
  selectedChannels?: Channel[];
  nativeSms?: boolean;
};
export type QuietPolicy = { enabled: boolean; start: string; end: string };
export type DeliveryPolicy = {
  limits: Record<Channel, number>;
  smsBudget: number;
  fallback: boolean;
  nativeDedupe: boolean;
};
export const defaultQuiet: QuietPolicy = {
  enabled: false,
  start: "22:00",
  end: "07:00",
};
export const smsCost = 1.5;
export const defaultDelivery: DeliveryPolicy = {
  limits: { "In-app": 200, Email: 60, SMS: 8, Push: 100, Telegram: 60 },
  smsBudget: 12,
  fallback: true,
  nativeDedupe: true,
};
export const deliveryTargets: Record<
  Channel,
  { provider: string; target: string; detail: string }
> = {
  "In-app": {
    provider: "OStrade",
    target: "Local inbox",
    detail: "Visible immediately in this browser session.",
  },
  Email: {
    provider: "Resend",
    target: "a•••@example.test",
    detail: "Sample destination. No email provider is contacted.",
  },
  SMS: {
    provider: "Africa’s Talking",
    target: "+254 ••• •• 482",
    detail: "Illustrative KES cost only. No mobile number receives a message.",
  },
  Push: {
    provider: "Web Push",
    target: "This browser · sample",
    detail: "No registration, browser permission, or device delivery.",
  },
  Telegram: {
    provider: "OStrade Bot",
    target: "Demo chat ••38",
    detail: "No chat verification, Telegram API call, or message.",
  },
};
export type AlertKind = "PRICE" | "PCT_MOVE" | "MARGIN" | "PNL" | "EVENT";
export const alertKinds: { id: AlertKind; label: string; detail: string }[] = [
  {
    id: "PRICE",
    label: "Price level",
    detail: "Bid above or below a fixed price.",
  },
  {
    id: "PCT_MOVE",
    label: "Percentage move",
    detail: "Signed move since the sample open or over 24 hours.",
  },
  {
    id: "MARGIN",
    label: "Margin level",
    detail: "Equity / used margin threshold for an account.",
  },
  {
    id: "PNL",
    label: "Daily P&L",
    detail: "Realized daily P&L crosses a USD threshold.",
  },
  {
    id: "EVENT",
    label: "Calendar reminder",
    detail: "Preview a reminder on a known economic event.",
  },
];
export type AlertDraft = {
  kind: AlertKind;
  target: string;
  direction: "above" | "below";
  threshold: number;
  basis?: "Open" | "24h";
  repeat: boolean;
  channels: Channel[];
};
export type AlertRule = AlertDraft & {
  id: string;
  title: string;
  active: boolean;
  firedCount: number;
  lastFiredAt?: string;
  snoozedUntil?: string;
  priceKey?: string;
  createdAt: string;
  status: "Active" | "Paused" | "Snoozed" | "Completed";
  source: "Dashboard" | "Telegram rehearsal" | "Markets" | "Sample";
};
export const seedNonPriceRules: Omit<AlertRule, "createdAt" | "status">[] = [
  {
    id: "nt-rule-01",
    kind: "PCT_MOVE",
    target: "BTCUSDT",
    title: "BTCUSDT 24h move",
    direction: "below",
    threshold: -2,
    basis: "24h",
    repeat: true,
    channels: ["In-app", "Push"],
    active: true,
    firedCount: 0,
    source: "Sample",
  },
  {
    id: "nt-rule-02",
    kind: "MARGIN",
    target: "acc-exness-trial",
    title: "Exness margin level",
    direction: "below",
    threshold: 170,
    repeat: true,
    channels: ["In-app", "SMS"],
    active: true,
    firedCount: 0,
    source: "Sample",
  },
  {
    id: "nt-rule-03",
    kind: "PNL",
    target: "acc-paper-main",
    title: "Paper Main daily profit",
    direction: "above",
    threshold: 250,
    repeat: false,
    channels: ["In-app"],
    active: true,
    firedCount: 0,
    source: "Sample",
  },
  {
    id: "nt-rule-04",
    kind: "EVENT",
    target: "ev-01",
    title: "Non-farm payrolls reminder",
    direction: "above",
    threshold: 20,
    repeat: false,
    channels: ["In-app", "Email"],
    active: true,
    firedCount: 0,
    source: "Sample",
  },
];
export type ChatScope = "All" | "Critical only";
export type LinkedChat = {
  id: string;
  label: string;
  masked: string;
  scope: ChatScope;
  pairedAt: string;
  source: "Sample" | "Local pairing";
};
export const commands = [
  {
    command: "/status",
    purpose: "Read account and emergency state",
    mode: "Read-only",
  },
  {
    command: "/positions",
    purpose: "Summarize open positions",
    mode: "Read-only",
  },
  {
    command: "/pending",
    purpose: "List armed schedule previews",
    mode: "Read-only",
  },
  {
    command: "/alert EURUSD 1.09",
    purpose: "Review a new one-shot price alert",
    mode: "Review first",
  },
  { command: "/pause", purpose: "Pause local automation", mode: "Demo 2FA" },
  { command: "/resume", purpose: "Re-arm the workspace", mode: "Demo 2FA" },
  { command: "/kill", purpose: "Engage full local lockdown", mode: "Demo 2FA" },
  {
    command: "/closeall",
    purpose: "Close Paper only; leave broker positions untouched",
    mode: "Demo 2FA",
  },
] as const;
export const digestSections = [
  "P&L",
  "Open positions",
  "Automation",
  "Tomorrow’s events",
] as const;
export type DigestSettings = {
  daily: boolean;
  time: string;
  contents: (typeof digestSections)[number][];
  weekly: boolean;
  attachPdf: boolean;
  monthly: boolean;
};
export const defaultDigest: DigestSettings = {
  daily: true,
  time: "07:00",
  contents: [...digestSections],
  weekly: false,
  attachPdf: false,
  monthly: true,
};

const seedAt = Date.now();
const feedFields: [EventClass, string?, Severity?][] = [
  ["broker.disconnected"],
  ["margin.warning"],
  ["guard.blocked", "OST-2025-00136"],
  ["deposit.confirmed", "RDX-992014"],
  ["guard.blocked", "OST-2025-00141", "Info"],
  ["alert.triggered"],
  ["deposit.confirmed"],
  ["news.reminder"],
  ["copilot.proposal"],
  ["anomaly.detected", "", "Info"],
];
const otherEvents: [EventClass, string, string, string, string?, number?][] = [
  [
    "broker.disconnected",
    "Exness Raw heartbeat missing",
    "Historical adapter-health fixture. The offline preview has no live connection to restore.",
    "Exness Raw",
    "ADP-DEMO-14",
    18,
  ],
  [
    "killswitch.engaged",
    "Emergency pause proof recorded",
    "Historical drill: new automated entries were held while manual tickets remained gated. This does not change current risk state.",
    "Workspace",
    "OS-DRILL-14",
    36,
  ],
  [
    "order.filled",
    "EURUSD BUY filled on Paper",
    "0.10 lots filled in the simulator and recorded to the workspace journal.",
    "Paper Main",
    "OST-2025-00135",
    75,
  ],
  [
    "schedule.failed",
    "London slot skipped by spread guard",
    "A historical execution was skipped after its quoted spread exceeded the configured limit.",
    "Paper Main",
    "OS-SCH-2104",
    210,
  ],
  [
    "margin.call",
    "High margin pressure snapshot",
    "Sample threshold breach on an offline profile. Inspect account exposure before any new entry.",
    "Exness MT5 Trial 1",
    "",
    1100,
  ],
  [
    "tp.hit",
    "GBPUSD target achieved",
    "Sample Paper closure at a tracked take-profit level.",
    "Paper Main",
    "OST-2025-00132",
    1620,
  ],
  [
    "order.rejected",
    "US30 size rejected",
    "Sample ticket exceeded the current size bounds. No broker dispatch took place.",
    "Paper Main",
    "OST-2025-00136",
    2150,
  ],
  [
    "adapter.reconnected",
    "Deriv handshake recovered",
    "History fixture only; no connection was opened by the frontend.",
    "Deriv Demo",
    "",
    2370,
  ],
  [
    "withdraw.settled",
    "Paper withdrawal journaled",
    "A simulated debit was reconciled in the local ledger.",
    "Paper Main",
    "OS-FIN-610001",
    3000,
  ],
  [
    "sl.hit",
    "Gold position hit its stop",
    "Sample stop-loss closure linked to the journal snapshot.",
    "Paper Main",
    "OST-2025-00121",
    3420,
  ],
  [
    "rule.fired",
    "FX Pulse rule evaluated",
    "Historical preview decision from the automation audit.",
    "Exness MT5 Trial 1",
    "rul-02",
    3970,
  ],
  [
    "transfer.completed",
    "Paper reserve transfer posted",
    "The sample ledger shows both sides in balance.",
    "Paper Main",
    "OS-FIN-710001",
    4680,
  ],
  [
    "anomaly.detected",
    "Duplicate slot detected",
    "Two sample schedules share an instrument and minute.",
    "Paper Main",
    "",
    5390,
  ],
  [
    "schedule.fired",
    "R_10 session slot evaluated",
    "Sample execution receipt from the scheduling snapshot.",
    "Paper Main",
    "OS-SCH-2101",
    11600,
  ],
];
function seeded(
  id: string,
  event: EventClass,
  title: string,
  body: string,
  accountLabel: string,
  mins: number,
  read: boolean,
  ref?: string,
  severity?: Severity,
  destination?: Destination,
): Notice {
  const c = eventCatalog.find((c) => c.id === event)!;
  const createdAt = new Date(seedAt - mins * 60_000).toISOString();
  const deliveries = c.defaults.map((channel) => ({
    id: `PROOF-${id}-${channel}`,
    notificationId: id,
    channel,
    status:
      channel === "In-app"
        ? ("In inbox" as const)
        : ("Offline preview" as const),
    target: deliveryTargets[channel].target,
    detail:
      channel === "In-app"
        ? "Seeded in the local inbox."
        : "Illustrative route only. No delivery took place.",
    createdAt,
    mode: "Sample" as const,
    subject: title,
  }));
  return {
    id,
    event,
    title,
    body,
    accountLabel,
    ref,
    createdAt,
    readAt: read ? createdAt : undefined,
    source: "Sample",
    severity: severity ?? c.severity,
    destination: destination ?? c.destination,
    deliveries,
  };
}
export const seedNotices: Notice[] = [
  ...initialAlerts.map((a, i) => {
    const [event, ref, severity] = feedFields[i];
    return seeded(
      a.id,
      event,
      a.title,
      a.detail,
      a.accountLabel,
      [2, 11, 28, 60, 78, 105, 180, 190, 240, 300][i],
      a.acknowledged,
      ref,
      severity,
      i === 4 ? "signals" : undefined,
    );
  }),
  ...otherEvents.map(([event, title, body, accountLabel, ref, mins], i) =>
    seeded(
      `nt-example-${i + 1}`,
      event,
      title,
      body,
      accountLabel,
      mins ?? 60,
      i > 3,
      ref,
    ),
  ),
];
export const initialLinkedChats: LinkedChat[] = [
  {
    id: "demo-chat-38",
    label: "Ops desk",
    masked: "Demo chat ••38",
    scope: "All",
    pairedAt: new Date(seedAt - 3 * 86400000).toISOString(),
    source: "Sample",
  },
  {
    id: "demo-chat-62",
    label: "Escalations",
    masked: "Demo chat ••62",
    scope: "Critical only",
    pairedAt: new Date(seedAt - 2 * 86400000).toISOString(),
    source: "Sample",
  },
];
