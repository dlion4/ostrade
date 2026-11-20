import { demoWebhookUrl } from "./settings";
import { quickSignalDrafts } from "./dashboard";
import { signalSamples } from "./landing";

export type SourceKey =
  | "paste"
  | "telegram"
  | "webhook"
  | "email"
  | "csv"
  | "copyfactory";
export type SignalStatus =
  | "Parsed"
  | "Staged"
  | "Filled"
  | "Quarantined"
  | "Pending"
  | "Preview"
  | "Discarded";
export type SignalOrder = {
  symbol: string;
  side: "BUY" | "SELL" | "";
  entry: number;
  sl: number;
  targets: number[];
  size: number;
  kind: "Market" | "Limit" | "Stop" | "Contract";
  duration: string;
  source: SourceKey;
  confidence: number;
  warnings: string[];
};
export interface DeskSignal {
  id: string;
  raw: string;
  order: SignalOrder;
  feed: string;
  time: number;
  status: SignalStatus;
  accounts: string[];
  pnl: number | null;
  refs: string[];
  notes: string[];
  externalId?: string;
}
export interface DeskFeed {
  id: string;
  name: string;
  source: SourceKey;
  received: number;
  executed: number;
  winRate: number;
  pnl: number;
  slippage: number;
  held: number;
  muted: boolean;
}
export interface GuardEvent {
  id: string;
  signalId: string;
  symbol: string;
  type: "Duplicate" | "Storm" | "Stale" | "Malformed";
  reason: string;
  time: number;
  overrideReason?: string;
}
export interface DeskSource {
  id: SourceKey;
  name: string;
  status: "Available" | "Preview";
  field: string;
  value: string;
  hint: string;
}
export const channels: DeskSource[] = [
  {
    id: "paste",
    name: "Paste console",
    status: "Available",
    field: "Input format",
    value: "Plain text or JSON",
    hint: "Paste or drop a text signal into the composer. Parsing never places an order.",
  },
  {
    id: "telegram",
    name: "Telegram",
    status: "Preview",
    field: "Channel handle",
    value: "@gold_desk_vip",
    hint: "Preview a channel configuration for @OStradeBot. No Telegram account is linked.",
  },
  {
    id: "webhook",
    name: "Webhook",
    status: "Preview",
    field: "Webhook URL",
    value: demoWebhookUrl("TradingView"),
    hint: "This example URL is deliberately inactive. Paste a TradingView JSON payload to test locally.",
  },
  {
    id: "email",
    name: "Email relay",
    status: "Preview",
    field: "Forwarding address",
    value: "desk@inbox.ostrade.invalid",
    hint: "This preview address does not receive email. Paste a forwarded message to try the parser.",
  },
  {
    id: "csv",
    name: "CSV import",
    status: "Available",
    field: "Supported formats",
    value: "CSV, TSV, HTML",
    hint: "Import a statement or map your own columns. All file contents stay in this browser.",
  },
  {
    id: "copyfactory",
    name: "CopyFactory",
    status: "Preview",
    field: "Provider strategy ID",
    value: "strategy-2231",
    hint: "Prepare a provider strategy configuration. A backend connection is needed to receive trades.",
  },
];

const first = signalSamples[0];
export const starterText = `# Gold Desk VIP\nBUY ${first.symbol} @ ${first.entry}\nSL ${first.sl}\nTP ${first.tp}\nSIZE ${first.lots} lots`;
export const deskExamples = signalSamples.map((s, i) => ({
  id: s.id,
  label: `${s.symbol} ${s.side}`,
  feed: s.channel,
  source: (s.source === "TradingView"
    ? "webhook"
    : s.source === "Copy provider"
      ? "copyfactory"
      : "telegram") as SourceKey,
  raw:
    i === 0
      ? starterText
      : i === 1
        ? "SELL EURUSD LIMIT 1.0850\nSL 40p\nTP 80p\nlot 0.20"
        : i === 2
          ? JSON.stringify(
              {
                symbol: s.symbol,
                action: "LONG",
                entry: 64000,
                sl: 62500,
                tp: 68000,
                size: 0.05,
              },
              null,
              2,
            )
          : i === 4
            ? "R_10 RISE stake 5 USD ticks 5"
            : `# ${s.channel}\n${s.side} ${s.symbol} @ ${s.entry}\nSL ${s.sl}\nTP ${s.tp}\nSIZE ${s.lots}`,
}));

export const snapshotAt = Date.UTC(2025, 2, 14, 13, 40);
const statuses: SignalStatus[] = [
  "Filled",
  "Staged",
  "Parsed",
  "Filled",
  "Quarantined",
  "Staged",
  "Filled",
  "Parsed",
  "Staged",
  "Filled",
  "Quarantined",
  "Parsed",
];
export const seedSignals: DeskSignal[] = Array.from({ length: 24 }, (_, i) => {
  const s = quickSignalDrafts[i % quickSignalDrafts.length];
  const source: SourceKey =
    s.source === "Telegram"
      ? "telegram"
      : s.source === "TradingView"
        ? "webhook"
        : "copyfactory";
  const status = statuses[i % statuses.length];
  return {
    id: `SIG-${String(248 - i).padStart(4, "0")}`,
    raw: `${s.rawText} | size ${s.size}`,
    feed: s.channel,
    status,
    time: snapshotAt - (i > 17 ? 86400000 : 0) - (i * 19 + 2) * 60000,
    order: {
      symbol: s.symbol,
      side: s.side,
      entry: +s.entry,
      sl: +s.sl,
      targets: [+s.tp],
      size: +s.size,
      source,
      kind: "Market",
      duration: "",
      confidence: 100,
      warnings: [],
    },
    accounts: status === "Filled" ? ["acc-paper-main"] : [],
    pnl: status === "Filled" ? [111, 48, 42.4, -12.8, 39.6][i % 5] : null,
    refs:
      status === "Filled"
        ? [`OST-2025-${String(148 - i).padStart(5, "0")}`]
        : [],
    notes: [],
  };
});
const uniqueFeeds = [
  ...new Map(
    [
      ...quickSignalDrafts,
      ...signalSamples.map((s) => ({
        ...s,
        channel: s.channel,
        source: s.source === "Copy provider" ? "CopyFactory" : s.source,
      })),
    ].map((s, i) => [
      s.channel,
      { id: `feed-${i + 1}`, channel: s.channel, source: s.source },
    ]),
  ).values(),
].slice(0, 12);
export const seedFeeds: DeskFeed[] = uniqueFeeds.map((q, i) => ({
  id: q.id,
  name: q.channel,
  source:
    q.source === "Telegram"
      ? "telegram"
      : q.source === "TradingView"
        ? "webhook"
        : "copyfactory",
  received: 86 - i * 6,
  executed: 74 - i * 6,
  winRate: 78 - i * 2.3,
  pnl: +(742.8 - i * 79.6).toFixed(2),
  slippage: +(0.3 + i * 0.07).toFixed(2),
  held: i % 4,
  muted: false,
}));
const guardExamples = [
  ...seedSignals.filter((s) => s.status === "Quarantined"),
  ...seedSignals.filter((s) => s.status !== "Quarantined").slice(0, 6),
];
export const seedGuardEvents: GuardEvent[] = guardExamples.map((s, i) => ({
  id: `GUARD-${120 - i}`,
  signalId: s.id,
  symbol: s.order.symbol,
  time: s.time,
  type: (["Duplicate", "Stale", "Storm", "Malformed"] as const)[i % 4],
  reason: [
    "Repeated entry from the same source inside the 10-minute window.",
    "Entry was more than 3% away from the market snapshot.",
    "Source exceeded 8 signals in one minute.",
    "A required order field was missing.",
  ][i % 4],
  overrideReason:
    s.status !== "Quarantined"
      ? "Reviewed and corrected in the sample workspace."
      : undefined,
}));
export const importExample =
  "ticket,symbol,side,entry,sl,tp,size\n" +
  quickSignalDrafts
    .map(
      (s, i) =>
        `MT-${4401 + i},${s.symbol},${s.side},${s.entry},${s.sl},${s.tp},${s.size}`,
    )
    .join("\n");
export const defaultGuardPolicy = {
  duplicateMinutes: 10,
  stormRate: 8,
  stalePercent: 3,
};
