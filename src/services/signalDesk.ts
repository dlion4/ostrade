import { mappedBrokerSymbol } from "./symbolMappings";
import {
  channels,
  deskExamples,
  seedSignals,
  seedFeeds,
  seedGuardEvents,
  defaultGuardPolicy,
  starterText,
  snapshotAt,
  importExample,
  type SourceKey,
  type DeskSignal,
  type SignalOrder,
  type GuardEvent,
} from "@/data/signalDesk";
import {
  marketSymbols,
  symbolAliases,
  type MarketSymbol,
} from "@/data/markets";
import { contractUnits, parseSignalText } from "@/utils/signalParser";
import {
  createSchedule,
  getAccounts,
  getSignalAttribution,
  placeDashboardOrder,
  recordDeskEvent,
  type TradingAccount,
} from "./dashboard";
import { latency } from "./_latency";

export type {
  SourceKey,
  DeskSignal,
  DeskSource,
  DeskFeed,
  SignalOrder,
  SignalStatus,
  GuardEvent,
} from "@/data/signalDesk";
export type GuardPolicy = typeof defaultGuardPolicy;
export type DeskExample = (typeof deskExamples)[number];
export type Incoming = {
  raw: string;
  order: SignalOrder;
  feed: string;
  id?: string;
  externalId?: string;
};
export type RouteOptions = {
  accounts: string[];
  sizing: "signal" | "fixed" | "equity" | "risk";
  amount: number;
  protection: "signal" | "scaled" | "none";
  scale: number;
  spreadCap: number;
};
export type Receipt = {
  id: string;
  signalId: string;
  account: string;
  symbol: string;
  side: string;
  size: number;
  price: number;
  ref: string;
  status: "Filled" | "Preview" | "Blocked" | "Pending";
  message: string;
  time: number;
};
export type RouteLeg = {
  signalId: string;
  account: TradingAccount;
  symbol: string;
  mapped: string;
  order: SignalOrder;
  size: number;
  sl: number;
  tp: number;
  error: string;
  spread: number;
  unit: string;
  targetIndex: number;
};

let inbox = structuredClone(seedSignals);
const feeds = structuredClone(seedFeeds);
const sources = structuredClone(channels);
let guardEvents = structuredClone(seedGuardEvents);
let policy = { ...defaultGuardPolicy };
let receipts: Receipt[] = [];
let nextId = 249;
let previewSecret = "os_preview_47b19f2c";
const started = Date.now();
const now = () => snapshotAt + Date.now() - started;
const uid = () => crypto.randomUUID();
const parse = (raw: string, source: SourceKey | "auto") =>
  parseSignalText(raw, marketSymbols, symbolAliases, source);
export const getDeskSetup = () =>
  latency(
    {
      sources,
      examples: deskExamples,
      first: starterText,
      parsed: parse(starterText, "telegram"),
      csvExample: importExample,
      secret: previewSecret,
      snapshotAt,
    },
    300,
    410,
  );
export const getSignals = (): Promise<DeskSignal[]> =>
  latency(
    inbox.map((row) => {
      if (
        row.status !== "Filled" ||
        !receipts.some((r) => r.signalId === row.id)
      )
        return row;
      const linked = getSignalAttribution(row.refs);
      return { ...row, pnl: linked.floating + linked.realized };
    }),
    300,
    460,
  );
export const getSourcePerformance = () =>
  latency(
    feeds.map((feed) => {
      const refs = receipts
        .filter(
          (r) =>
            r.status === "Filled" &&
            inbox.some((s) => s.id === r.signalId && s.feed === feed.name),
        )
        .map((r) => r.ref);
      const closed = refs
        .map((ref) => getSignalAttribution([ref]))
        .filter((x) => x.closed);
      const priorCloses =
        seedFeeds.find((f) => f.id === feed.id)?.executed ?? 0;
      return {
        ...feed,
        pnl: feed.pnl + closed.reduce((sum, v) => sum + v.realized, 0),
        winRate: closed.length
          ? (((priorCloses * feed.winRate) / 100 +
              closed.filter((v) => v.realized > 0).length) /
              (priorCloses + closed.length)) *
            100
          : feed.winRate,
      };
    }),
    300,
    450,
  );
export const getGuardLog = () =>
  latency({ events: guardEvents, policy }, 300, 450);
export const getDeskReceipts = () => latency(receipts, 300, 450);
export const parseSignal = (raw: string, source: SourceKey | "auto") =>
  latency(parse(raw, source), 300, 390);
export const eatTime = (time: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(time);

function journal(
  row: DeskSignal,
  text: string,
  status: "Staged" | "Blocked" = "Staged",
) {
  return recordDeskEvent({
    accountId: "acc-paper-main",
    accountLabel: "Signal Desk",
    broker: "paper",
    origin: status === "Blocked" ? "Guard" : "Signal",
    symbol: row.order.symbol || "UNRESOLVED",
    side: row.order.side || "—",
    status,
    summary: `${row.id} | ${text}`,
    impact: "No funds moved",
  });
}

function inspect(row: DeskSignal): Pick<GuardEvent, "type" | "reason"> | null {
  const o = row.order,
    s = marketSymbols.find((m) => m.canonical === o.symbol);
  if (!s || !o.side || !Number.isFinite(o.entry) || o.entry <= 0)
    return {
      type: "Malformed",
      reason:
        "A mapped instrument, direction, and positive entry price are required.",
    };
  if (feeds.some((f) => f.name === row.feed && f.muted))
    return {
      type: "Muted",
      reason: `${row.feed} is muted in source performance.`,
    };
  const others = inbox.filter(
    (r) => r.id !== row.id && r.feed === row.feed && r.status !== "Discarded",
  );
  if (others.filter((r) => now() - r.time < 60000).length >= policy.stormRate)
    return {
      type: "Storm",
      reason: `More than ${policy.stormRate} signals per minute from ${row.feed}.`,
    };
  if (
    others.some(
      (r) =>
        now() - r.time < policy.duplicateMinutes * 60000 &&
        r.order.symbol === o.symbol &&
        r.order.side === o.side &&
        r.order.entry === o.entry,
    )
  )
    return {
      type: "Duplicate",
      reason: `Same source, symbol, side and entry within ${policy.duplicateMinutes} minutes.`,
    };
  if ((Math.abs(o.entry - s.bid) / s.bid) * 100 > policy.stalePercent)
    return {
      type: "Stale",
      reason: `Entry differs from the market snapshot by more than ${policy.stalePercent}%.`,
    };
  return null;
}

function ingest(input: Incoming, status: "Parsed" | "Staged") {
  let row = input.id ? inbox.find((r) => r.id === input.id) : undefined;
  const existing = !!row;
  if (row && ["Filled", "Pending", "Preview"].includes(row.status))
    throw new Error(
      "This signal already has a receipt. Use Re-execute to start a new review.",
    );
  const changed =
    !row ||
    row.raw !== input.raw ||
    JSON.stringify(row.order) !== JSON.stringify(input.order);
  if (!row)
    row = {
      id: `SIG-${String(nextId++).padStart(4, "0")}`,
      raw: input.raw,
      order: structuredClone(input.order),
      feed: input.feed,
      time: now(),
      status,
      accounts: [],
      refs: [],
      pnl: null,
      notes: [],
      externalId: input.externalId,
    };
  if (existing && !changed && row.status === "Quarantined") return row;
  Object.assign(row, {
    raw: input.raw,
    order: structuredClone(input.order),
    feed: input.feed,
    status,
  });
  const overridden =
    !changed &&
    guardEvents.some((g) => g.signalId === row.id && g.overrideReason);
  const problem = overridden ? null : inspect(row);
  if (problem) {
    row.status = "Quarantined";
    guardEvents = [
      {
        id: uid(),
        signalId: row.id,
        symbol: row.order.symbol || "Unknown",
        time: now(),
        ...problem,
      },
      ...guardEvents,
    ];
    journal(row, problem.reason, "Blocked");
  } else if (status === "Staged") journal(row, "Staged for operator review");
  if (!existing) {
    inbox = [row, ...inbox];
    const feed = feeds.find((f) => f.name === row.feed);
    if (feed) {
      feed.received++;
      if (problem) feed.held++;
    } else
      feeds.push({
        id: uid(),
        name: row.feed,
        source: row.order.source,
        received: 1,
        executed: 0,
        winRate: 0,
        pnl: 0,
        slippage: 0,
        held: problem ? 1 : 0,
        muted: false,
      });
  }
  return row;
}
export const saveSignal = (input: Incoming, status: "Parsed" | "Staged") =>
  latency(ingest(input, status), 330, 480);

export async function importSignals(
  rows: { raw: string; ticket: string }[],
  source: SourceKey,
) {
  let added = 0,
    skipped = 0,
    held = 0;
  if (rows.length > 500) throw new Error("Import up to 500 rows at a time.");
  for (const r of rows) {
    if (
      r.ticket &&
      inbox.some((s) => s.externalId === `${source}:${r.ticket}`)
    ) {
      skipped++;
      continue;
    }
    const signal = ingest(
      {
        raw: r.raw,
        order: parse(r.raw, source),
        feed: source === "csv" ? "Statement import" : "Copy provider",
        externalId: r.ticket ? `${source}:${r.ticket}` : undefined,
      },
      "Parsed",
    );
    added++;
    if (signal.status === "Quarantined") held++;
  }
  return latency({ added, skipped, held }, 400, 650);
}

export function buildRoutes(
  signals: DeskSignal[],
  accounts: TradingAccount[],
  markets: MarketSymbol[],
  options: RouteOptions,
  halted: boolean,
): RouteLeg[] {
  return signals.flatMap((row) =>
    accounts
      .filter((a) => options.accounts.includes(a.id))
      .flatMap((account) => {
        const o = row.order,
          s = markets.find((m) => m.canonical === o.symbol),
          unit = s?.volumeUnit || "lots",
          c = s ? contractUnits(s) : 1;
        const dollarRate =
          s?.assetClass === "Forex" && !o.symbol.endsWith("USD")
            ? 1 / Math.max(o.entry, 1e-6)
            : 1;
        let size = o.size;
        if (options.sizing === "fixed") size = options.amount;
        if (options.sizing === "equity")
          size =
            (account.equity * options.amount) /
            100 /
            (Math.max(o.entry, 1e-6) * c * dollarRate);
        const scale = options.protection === "scaled" ? options.scale : 1;
        const sl =
          options.protection === "none" || !o.sl
            ? 0
            : +(o.entry + (o.sl - o.entry) * scale).toFixed(s?.digits ?? 5);
        if (options.sizing === "risk")
          size =
            (account.equity * options.amount) /
            100 /
            (Math.max(Math.abs(o.entry - sl), 1e-8) * c * dollarRate);
        const targets = o.targets.length ? o.targets : [0],
          step = s?.volumeStep || 0.01;
        const stepCount = Math.floor(size / step + 1e-8),
          baseSteps = Math.floor(stepCount / targets.length);
        return targets.map((target, i) => {
          const qty = +(
            (baseSteps + (i < stepCount % targets.length ? 1 : 0)) *
            step
          ).toFixed(6);
          const tp =
            options.protection === "none" || !target
              ? 0
              : +(o.entry + (target - o.entry) * scale).toFixed(s?.digits ?? 5);
          const mapped = mappedBrokerSymbol(s, account) || "";
          const spread = s?.spreads[account.broker] ?? 0;
          const error = halted
            ? "Workspace is flattened. Re-arm the kill switch first."
            : row.status === "Quarantined"
              ? "Quarantined: review the guard decision first."
              : ["Filled", "Discarded", "Pending", "Preview"].includes(
                    row.status,
                  )
                ? "This signal is not staged for a new execution."
                : feeds.some((f) => f.name === row.feed && f.muted)
                  ? `Source ${row.feed} is muted. Unmute it before placing an order.`
                  : !mapped
                    ? `Instrument is not listed on ${account.brokerName}.`
                    : !Number.isFinite(options.spreadCap) ||
                        options.spreadCap < 0
                      ? "Set a nonnegative spread cap."
                      : options.protection === "scaled" &&
                          (!Number.isFinite(scale) || scale <= 0)
                        ? "The stop distance multiplier must be positive."
                        : !Number.isFinite(o.sl) ||
                            o.targets.some((t) => !Number.isFinite(t) || t <= 0)
                          ? "Stop and target levels must be valid prices."
                          : !o.side || !Number.isFinite(o.entry) || o.entry <= 0
                            ? "A side and valid entry are required."
                            : !s?.tradeableNow
                              ? "Market session is closed in this snapshot."
                              : options.sizing === "risk" && (!sl || !o.sl)
                                ? "Risk sizing requires a protective stop."
                                : !sl && o.kind !== "Contract"
                                  ? "Mandatory stop-loss guard: add a protective stop."
                                  : !Number.isFinite(qty) ||
                                      qty < s.minVolume ||
                                      qty > s.maxVolume
                                    ? `Each target needs ${s.minVolume} to ${s.maxVolume} ${unit}.`
                                    : sl &&
                                        (o.side === "BUY"
                                          ? sl >= o.entry
                                          : sl <= o.entry)
                                      ? "Stop loss is on the wrong side of entry."
                                      : tp &&
                                          (o.side === "BUY"
                                            ? tp <= o.entry
                                            : tp >= o.entry)
                                        ? "Take profit is on the wrong side of entry."
                                        : spread > options.spreadCap
                                          ? `Spread ${spread} exceeds your cap of ${options.spreadCap}.`
                                          : unit === "stake" && size > 200
                                            ? "The $200 maximum contract stake would be exceeded."
                                            : sl &&
                                                Math.abs(o.entry - sl) *
                                                  size *
                                                  c *
                                                  dollarRate >
                                                  200
                                              ? "The estimated loss at the stop exceeds the $200 per-trade guard. Reduce the size."
                                              : "";
          return {
            signalId: row.id,
            account,
            order: o,
            symbol: o.symbol,
            mapped,
            size: qty,
            sl,
            tp,
            error,
            spread,
            unit,
            targetIndex: i + 1,
          };
        });
      }),
  );
}

const batches = new Map<string, Promise<Receipt[]>>();
const pendingLegs = new Map<string, RouteLeg>();
const pendingReplays = new Map<string, Promise<Receipt>>();
export function executeSignals(
  ids: string[],
  options: RouteOptions,
  key: string,
  halted: boolean,
): Promise<Receipt[]> {
  const cached = batches.get(key);
  if (cached) return cached;
  const task = (async () => {
    const rows = inbox.filter((r) => ids.includes(r.id));
    const legs = buildRoutes(
      rows,
      await getAccounts(),
      marketSymbols,
      options,
      halted,
    );
    if (!legs.length)
      throw new Error("Select at least one signal and target account.");
    const results = await Promise.all(
      legs.map(async (leg): Promise<Receipt> => {
        const { account: a, order: o } = leg;
        const base = {
          id: uid(),
          signalId: leg.signalId,
          account: a.label,
          symbol: leg.symbol,
          side: o.side,
          size: leg.size,
          price: o.entry,
          time: now(),
        };
        const entry = {
          accountId: a.id,
          accountLabel: a.label,
          broker: a.broker,
          origin: "Signal" as const,
          symbol: leg.symbol,
          side: o.side || ("—" as const),
          impact: "No funds moved",
        };
        if (leg.error) {
          const ref = recordDeskEvent({
            ...entry,
            status: "Blocked",
            summary: `${leg.signalId}: ${leg.error}`,
          });
          return { ...base, ref, status: "Blocked", message: leg.error };
        }
        if (a.environment !== "paper") {
          const ref = recordDeskEvent({
            ...entry,
            status: "Staged",
            summary: `${leg.signalId}: ${leg.mapped} broker preview. No order sent.`,
          });
          return {
            ...base,
            ref,
            status: "Preview",
            message:
              "Ready when the backend is connected. No broker order was sent.",
          };
        }
        if (o.kind === "Limit" || o.kind === "Stop") {
          const s = marketSymbols.find((m) => m.canonical === o.symbol)!;
          const crossed =
            o.kind === "Limit"
              ? o.side === "BUY"
                ? s.ask <= o.entry
                : s.bid >= o.entry
              : o.side === "BUY"
                ? s.ask >= o.entry
                : s.bid <= o.entry;
          if (!crossed) {
            const ref = recordDeskEvent({
              ...entry,
              status: "Staged",
              summary: `${leg.signalId} | SIMULATED ${o.kind} pending at ${o.entry}. Snapshot has not crossed the entry.`,
            });
            pendingLegs.set(base.id, structuredClone(leg));
            return {
              ...base,
              ref,
              status: "Pending",
              message:
                "Paper order staged. The static quote has not crossed the entry.",
            };
          }
        }
        const result = await placeDashboardOrder({
          accountId: a.id,
          symbol: leg.symbol,
          side: o.side as "BUY" | "SELL",
          size: leg.size,
          entry: o.entry,
          sl: leg.sl,
          tp: leg.tp,
          sizeUnit: marketSymbols.find((m) => m.canonical === leg.symbol)
            ?.volumeUnit,
          origin: "Signal",
          sourceRef: leg.signalId,
          sourceLabel: leg.signalId,
          channelNote: `${leg.signalId} | TP${leg.targetIndex} | ${o.duration || o.kind}`,
        });
        return {
          ...base,
          ref: result.ref,
          status:
            result.mode === "simulated"
              ? "Filled"
              : result.mode === "blocked"
                ? "Blocked"
                : "Preview",
          message: result.detail,
        };
      }),
    );
    receipts = [...results, ...receipts];
    rows.forEach((r) => {
      const legs = results.filter((l) => l.signalId === r.id);
      r.status = legs.some((l) => l.status === "Filled")
        ? "Filled"
        : legs.some((l) => l.status === "Pending")
          ? "Pending"
          : legs.some((l) => l.status === "Preview")
            ? "Preview"
            : "Quarantined";
      r.refs = legs.map((l) => l.ref);
      r.accounts = [...options.accounts];
      if (r.status === "Filled") {
        r.pnl = 0;
        const f = feeds.find((f) => f.name === r.feed);
        if (f) f.executed++;
      }
      if (r.status === "Quarantined")
        guardEvents.unshift({
          id: uid(),
          signalId: r.id,
          symbol: r.order.symbol,
          type: "Malformed",
          reason: legs[0]?.message || "No eligible leg",
          time: now(),
        });
    });
    return results;
  })();
  batches.set(key, task);
  void task.catch(() => batches.delete(key));
  return task;
}

/** Manual replay of a paper trigger; the shared quote snapshot stays unchanged. */
export function replayPaperTrigger(
  id: string,
  halted: boolean,
): Promise<Receipt> {
  if (halted)
    return Promise.reject(
      new Error("Re-arm the workspace before simulating a fill."),
    );
  const prior = pendingReplays.get(id);
  if (prior) return prior;
  const task = (async () => {
    const leg = pendingLegs.get(id),
      receipt = receipts.find((r) => r.id === id);
    if (
      !leg ||
      !receipt ||
      receipt.status !== "Pending" ||
      leg.account.environment !== "paper" ||
      !leg.order.side
    )
      throw new Error("This paper order is no longer pending.");
    const fill = await placeDashboardOrder({
      accountId: leg.account.id,
      symbol: leg.symbol,
      side: leg.order.side,
      size: leg.size,
      entry: leg.order.entry,
      sl: leg.sl,
      tp: leg.tp,
      origin: "Signal",
      sourceRef: leg.signalId,
      sourceLabel: leg.signalId,
      channelNote: `${leg.signalId} | manual paper trigger | ${receipt.ref}`,
      sizeUnit: marketSymbols.find((s) => s.canonical === leg.symbol)
        ?.volumeUnit,
    });
    if (fill.mode !== "simulated") throw new Error(fill.detail);
    const row = inbox.find((r) => r.id === leg.signalId)!;
    row.refs.push(fill.ref);
    row.notes.push(`Manual paper trigger replayed for ${receipt.ref}.`);
    row.status = "Filled";
    row.pnl = 0;
    Object.assign(receipt, {
      status: "Filled",
      ref: fill.ref,
      message: `Simulated trigger filled ${leg.size} ${leg.symbol} at ${leg.order.entry}.`,
      time: now(),
    });
    pendingLegs.delete(id);
    return structuredClone(receipt);
  })();
  pendingReplays.set(id, task);
  void task.catch(() => pendingReplays.delete(id));
  return task;
}

export async function discardSignal(id: string) {
  const row = inbox.find((r) => r.id === id);
  if (!row || !["Staged", "Parsed", "Quarantined"].includes(row.status))
    throw new Error("Only an unexecuted signal can be discarded.");
  row.status = "Discarded";
  journal(row, "Discarded by operator");
  return latency(row, 300, 440);
}
export async function saveJournalNote(id: string, text: string) {
  const row = inbox.find((r) => r.id === id);
  if (!row || !text.trim()) throw new Error("A journal note is required.");
  row.notes.push(text.trim());
  const ref = journal(row, `Operator note: ${text.trim()}`);
  return latency(ref, 300, 460);
}
export async function scheduleDeskSignal(
  id: string,
  accountId: string,
  at: string,
) {
  const row = inbox.find((r) => r.id === id),
    account = (await getAccounts()).find((a) => a.id === accountId);
  if (!row || !account || !row.order.side)
    throw new Error("Select a valid signal and account.");
  if (row.status === "Quarantined" || row.status === "Discarded")
    throw new Error("Resolve this signal before scheduling it.");
  if (
    !mappedBrokerSymbol(marketSymbols.find((s) => s.canonical === row.order.symbol), account)
  )
    throw new Error("This instrument is not offered on the selected account.");
  const time = Date.parse(`${at}:00+03:00`);
  if (!Number.isFinite(time) || time <= now())
    throw new Error("Choose a time after the local workspace snapshot.");
  const result = await createSchedule({
    symbol: row.order.symbol,
    side: row.order.side,
    lots: String(row.order.size),
    accountId,
    timeEat: `${at.replace("T", " ")} EAT`,
    countdown: "Local schedule",
    trigger: "Time Window",
  });
  if (result.mode !== "blocked") {
    row.notes.push(
      `Scheduled for ${at.replace("T", " ")} EAT on ${account.label} (${result.ref}).`,
    );
    row.refs.push(result.ref);
  }
  return result;
}
export async function muteFeed(id: string) {
  const feed = feeds.find((f) => f.id === id);
  if (!feed) throw new Error("Source not found.");
  feed.muted = !feed.muted;
  return latency(feed, 300, 410);
}
export async function updateGuards(next: GuardPolicy) {
  if (
    !Number.isInteger(next.duplicateMinutes) ||
    next.duplicateMinutes < 1 ||
    next.duplicateMinutes > 1440 ||
    !Number.isInteger(next.stormRate) ||
    next.stormRate < 1 ||
    next.stormRate > 100 ||
    !Number.isFinite(next.stalePercent) ||
    next.stalePercent <= 0 ||
    next.stalePercent > 25
  )
    throw new Error(
      "Use 1-1440 minutes, 1-100 signals/min, and a price tolerance up to 25%.",
    );
  policy = { ...next };
  return latency(policy, 330, 460);
}
export async function overrideGuard(id: string, reason: string) {
  if (reason.trim().length < 8)
    throw new Error("Give a reason of at least 8 characters.");
  const ev = guardEvents.find((g) => g.id === id);
  if (!ev) throw new Error("Decision not found.");
  const row = inbox.find((r) => r.id === ev.signalId);
  if (!row || row.status !== "Quarantined")
    throw new Error("This signal is not in quarantine.");
  ev.overrideReason = reason.trim();
  row.status = "Staged";
  row.notes.push(`Override: ${reason.trim()}`);
  journal(row, `Guard override: ${reason.trim()}`);
  return latency(row, 330, 510);
}
export async function configureSource(id: SourceKey, value: string) {
  const s = sources.find((s) => s.id === id)!;
  if (id === "telegram" && !/^@[A-Za-z0-9_]{4,}$/.test(value))
    throw new Error(
      "Use a channel handle beginning with @ and at least four characters.",
    );
  if (id === "copyfactory" && !/^[A-Za-z0-9_-]{4,80}$/.test(value))
    throw new Error(
      "Enter a valid provider strategy ID (4-80 letters, numbers, hyphens or underscores).",
    );
  if (id === "telegram" || id === "copyfactory") s.value = value;
  return latency(
    "Ready when the backend is connected. Configuration validated locally; no external connection was made.",
    350,
    590,
  );
}
export async function rotatePreviewSecret() {
  previewSecret = `os_preview_${uid().slice(0, 8)}`;
  return latency(previewSecret, 300, 440);
}
