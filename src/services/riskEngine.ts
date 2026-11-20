import {
  defaultSession,
  defaultShields,
  riskPolicies,
  sampleSessionMinutes,
  seedRiskAudit,
  type RiskAudit,
  type RiskCheck,
  type RiskEngagement,
  type RiskRule,
  type RiskShields,
  type RiskTicket,
  type SessionPolicy,
} from "@/data/risk";
import { type OpenPosition, type TradingAccount } from "@/data/dashboard";
import { marketSymbols, type MarketSymbol } from "@/data/markets";
import { eatDay, netPnl, type TradeRecord } from "@/data/records";
import { mappedBrokerSymbol } from "./symbolMappings";

export const policies: RiskRule[] = riskPolicies.map((p) => ({
  id: p.id,
  scope: "all",
  enabled: p.id !== "hold",
  value: p.value,
  unit: p.unit,
}));
export let shields: RiskShields = { ...defaultShields };
export function updateShields(value: RiskShields) {
  shields = { ...value };
}
export const sessionPolicies = new Map<string, SessionPolicy>();
const dayLocks = new Map<string, string>();
export const accountPauses = new Set<string>();
export const rulePauses = new Set<string>();
export let lockdown = false;
export function setLockdown(value: boolean) {
  lockdown = value;
}
export let lastEngagement: RiskEngagement | undefined;
export function markEngagement(value: RiskEngagement) {
  lastEngagement = value;
}
const audit = structuredClone(seedRiskAudit);
let auditSerial = 0;
export function addRiskAudit(row: Omit<RiskAudit, "id" | "at">) {
  const item = {
    ...row,
    id: `RISK-${String(++auditSerial).padStart(5, "0")}`,
    at: new Date().toISOString(),
  };
  audit.unshift(item);
  return item;
}
export const readRiskAudit = () => audit.map((row) => ({ ...row }));
export function lockDay(scope: string, now = Date.now()) {
  dayLocks.set(scope, eatDay(now));
}
export function dayLocked(scope: string, now = Date.now()) {
  const day = eatDay(now);
  return dayLocks.get("all") === day || dayLocks.get(scope) === day;
}
export const safeRiskText = (value: string) =>
  value
    .trim()
    .replace(
      /\b(?:https?|wss?):\/\/\S+|\b(?:token|password|secret|bearer|api[ _-]?key|otp)\s*[:=]?\s*\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b\d{6}\b/gi,
      "[redacted]",
    )
    .slice(0, 240);
const usd = (n: number) => `$${n.toFixed(2)}`;
const symbols = new Map(marketSymbols.map((s) => [s.canonical, s]));
const attempts: { at: number; channel: RiskTicket["channel"] }[] = [];
const fills: { at: number; accountId: string; key: string }[] = [];
const fingerprint = (t: RiskTicket) =>
  [t.accountId, t.symbol, t.side, t.size, t.entry, t.sl, t.tp].join("|");
export function noteAttempt(ticket: RiskTicket) {
  const now = Date.now();
  while (attempts[0] && attempts[0].at < now - 60_000) attempts.shift();
  attempts.push({ at: now, channel: ticket.channel });
}
export function noteFill(ticket: RiskTicket) {
  const now = Date.now();
  while (fills[0] && fills[0].at < now - 86_400_000 * 2) fills.shift();
  fills.push({
    at: now,
    accountId: ticket.accountId,
    key: fingerprint(ticket),
  });
}
const contract = (s: MarketSymbol) =>
  Number(s.contractSize.match(/^[\d,]+/)?.[0].replace(/,/g, "")) || 1;
function usdRate(s: MarketSymbol) {
  if (s.assetClass !== "Forex") return 1;
  const c = s.canonical.slice(3),
    direct = symbols.get(`${c}USD`),
    inverse = symbols.get(`USD${c}`);
  return c === "USD"
    ? 1
    : (direct?.bid ?? (inverse?.bid ? 1 / inverse.bid : 1));
}
function stopRisk(
  t: Pick<RiskTicket, "side" | "entry" | "sl" | "size">,
  s?: MarketSymbol,
) {
  if (!s) return null;
  if (s.volumeUnit === "stake") return t.size;
  if (!(t.sl > 0)) return null;
  return Math.max(
    0,
    (t.side === "BUY" ? t.entry - t.sl : t.sl - t.entry) *
      t.size *
      contract(s) *
      usdRate(s),
  );
}
export function positionRisk(pos: OpenPosition) {
  return stopRisk({ ...pos, entry: pos.current }, symbols.get(pos.symbol));
}
export function originalPositionRisk(pos: OpenPosition, size = pos.size) {
  return stopRisk(
    { ...pos, size, sl: pos.initialSl ?? pos.sl },
    symbols.get(pos.symbol),
  );
}
export const policyLabel = (r: RiskRule) =>
  riskPolicies.find((p) => p.id === r.id)?.name ?? r.id;
const sessionSnapshotDay = eatDay(Date.now());
export function getProfileSession(
  account: TradingAccount,
  index: number,
  records: TradeRecord[],
  now = Date.now(),
) {
  const day = eatDay(now),
    settings = sessionPolicies.get(account.id) ?? defaultSession;
  const usedBuckets = new Set(
    fills
      .filter((f) => f.accountId === account.id && eatDay(f.at) === day)
      .map((f) => Math.floor(f.at / 60_000)),
  );
  const minutes = Math.min(
    1440,
    (day === sessionSnapshotDay ? (sampleSessionMinutes[index] ?? 0) : 0) +
      usedBuckets.size,
  );
  const rows = records
    .filter((r) => r.accountId === account.id && eatDay(r.closedAt) === day)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
  let streak = 0;
  for (const r of rows) {
    if (netPnl(r) < 0) streak++;
    else break;
  }
  const cap = Math.min(
    1440,
    ...policies
      .filter(
        (r) =>
          r.id === "minutes" &&
          r.enabled &&
          (r.scope === account.id || r.scope === "all"),
      )
      .map((r) => r.value),
  );
  const reminderDue = settings.reminder > 0 && minutes >= settings.reminder;
  return {
    accountId: account.id,
    accountLabel: account.label,
    broker: account.broker,
    minutes,
    streak,
    cap,
    settings: { ...settings },
    reminderDue,
    stopped:
      dayLocked(account.id, now) ||
      streak >= settings.lossStreak ||
      minutes >= cap,
  };
}
export function breachedLossPolicy(accounts: TradingAccount[]) {
  return policies
    .filter((r) => r.id === "dailyLoss" && r.enabled)
    .find((r) => {
      const scope = accounts.filter(
        (a) => r.scope === "all" || a.id === r.scope,
      );
      const equity = scope.reduce((n, a) => n + a.equity, 0),
        pnl = scope.reduce((n, a) => n + a.realizedToday, 0);
      return (
        scope.length > 0 && (equity <= 0 || -pnl >= (equity * r.value) / 100)
      );
    });
}
export function riskSnapshot(
  accounts: TradingAccount[],
  positions: OpenPosition[],
) {
  const sum = (list: TradingAccount[], key: "realizedToday" | "equity") =>
    list.reduce((n, a) => n + a[key], 0);
  const exposure = accounts.map((a) => {
    const rows = positions.filter((p) => p.accountId === a.id);
    return {
      id: a.id,
      label: a.label,
      broker: a.broker,
      equity: a.equity,
      pnl: a.realizedToday,
      margin: a.marginUsedPct,
      open: rows.length,
      unprotected: rows.filter((p) => positionRisk(p) === null).length,
      risk: rows.reduce((n, p) => n + (positionRisk(p) ?? 0), 0),
    };
  });
  const global = policies.find(
    (p) => p.id === "dailyLoss" && p.scope === "all" && p.enabled,
  );
  return {
    exposure,
    pnl: sum(accounts, "realizedToday"),
    equity: sum(accounts, "equity"),
    lossLimit: global ? (sum(accounts, "equity") * global.value) / 100 : null,
    risk: exposure.reduce((n, e) => n + e.risk, 0),
    unprotected: exposure.reduce((n, e) => n + e.unprotected, 0),
    margin: accounts.length
      ? Math.min(
          ...accounts.map((a) =>
            a.marginUsedPct > 0 ? 10000 / a.marginUsedPct : Infinity,
          ),
        )
      : Infinity,
  };
}
export function evaluateTicket(
  t: RiskTicket,
  ctx: {
    accounts: TradingAccount[];
    positions: OpenPosition[];
    records: TradeRecord[];
    state: "armed" | "paused" | "flattened";
    now?: number;
    ruleRef?: string;
  },
) {
  const checks: RiskCheck[] = [];
  const now = ctx.now ?? Date.now();
  const push = (
    id: string,
    label: string,
    ok: boolean,
    detail: string,
    flags?: Pick<RiskCheck, "shield" | "overridable">,
  ) =>
    checks.push({
      id,
      label,
      decision: ok ? "PASS" : "BLOCK",
      detail,
      ...flags,
    });
  const a = ctx.accounts.find((row) => row.id === t.accountId),
    s = symbols.get(t.symbol);
  const capital = s && Number.isFinite(t.size) ? stopRisk(t, s) : null;
  const state = lockdown ? "lockdown" : ctx.state;
  const auto = t.channel !== "Manual";
  const lockReason =
      state === "lockdown"
        ? "Workspace lockdown"
        : state === "flattened"
          ? "Workspace flattened"
          : auto && state === "paused"
            ? "Workspace automation paused"
            : auto && accountPauses.has(t.accountId)
              ? "Account automation paused"
              : auto && ctx.ruleRef && rulePauses.has(ctx.ruleRef)
                ? "Rule paused"
                : "",
    locked = !!lockReason;
  push(
    "workspace",
    "Emergency state",
    !locked,
    locked
      ? `${lockReason}; new ${auto ? "automated" : "manual"} entries are blocked.`
      : state === "paused"
        ? "Manual tickets are allowed while automation is paused."
        : "Emergency state allows this route.",
  );
  push(
    "market",
    "Instrument tradable",
    !!s?.tradeableNow,
    s?.tradeableNow
      ? `${t.symbol} is open in the fixed snapshot.`
      : "Unknown instrument or market closed in the fixed snapshot.",
  );
  const mapped = a && mappedBrokerSymbol(s, a);
  push(
    "capability",
    "Account capability",
    !!mapped,
    mapped
      ? `${mapped} · ${a.broker === "paper" ? "local simulator" : "offline broker preview"}.`
      : "No account instrument mapping available.",
  );
  const validSize =
    !!s &&
    Number.isFinite(t.size) &&
    t.size >= s.minVolume &&
    t.size <= s.maxVolume;
  const prices =
    [t.entry, t.sl, t.tp].every(Number.isFinite) &&
    t.entry > 0 &&
    t.sl >= 0 &&
    t.tp >= 0 &&
    (t.side === "BUY" || t.side === "SELL");
  const protective =
    prices &&
    (s?.volumeUnit === "stake" ||
      (t.sl > 0 && (t.side === "BUY" ? t.sl < t.entry : t.sl > t.entry))) &&
    (!t.tp || (t.side === "BUY" ? t.tp > t.entry : t.tp < t.entry));
  push(
    "bounds",
    "Volume and price bounds",
    validSize && prices,
    validSize && prices
      ? `${t.size} ${s.volumeUnit} within broker bounds.`
      : s
        ? `Use ${s.minVolume}–${s.maxVolume} ${s.volumeUnit} and finite prices.`
        : "No volume bounds for this symbol.",
  );
  push(
    "protective",
    "Protective stop",
    protective,
    protective
      ? "Stake is defined or protective levels are correctly placed."
      : "Attach a correctly sided stop (or use a fixed-stake instrument).",
  );
  const breaker = !!breachedLossPolicy(ctx.accounts);
  if (breaker)
    push(
      "circuit",
      "Daily loss circuit breaker",
      false,
      "An active daily loss limit is breached. Automation pauses on admission; no override is allowed.",
    );
  if (a && s && validSize && protective && capital !== null) {
    const needed =
      s.volumeUnit === "stake"
        ? t.size
        : (t.entry * t.size * contract(s) * usdRate(s) * s.marginRatePct) / 100;
    const margin =
      a.equity > 0 ? a.marginUsedPct + (needed / a.equity) * 100 : Infinity;
    for (const r of policies.filter(
      (r) => r.enabled && (r.scope === "all" || r.scope === a.id),
    )) {
      const global = r.scope === "all",
        scope = global ? ctx.accounts : [a],
        orders = global
          ? ctx.positions
          : ctx.positions.filter((p) => p.accountId === a.id);
      const equity = scope.reduce((n, p) => n + p.equity, 0),
        pnl = scope.reduce((n, p) => n + p.realizedToday, 0);
      const label = `${policyLabel(r)}${global ? "" : " · account"}`;
      let ok = true,
        detail = "";
      switch (r.id) {
        case "dailyLoss": {
          const cap = (equity * r.value) / 100;
          ok = cap > 0 && -pnl < cap;
          detail = `Daily realized ${usd(pnl)} · ${usd(cap)} loss limit. Non-overridable.`;
          break;
        }
        case "openCount": {
          const total = global && r.unit === "positions total",
            count = total
              ? orders.length
              : ctx.positions.filter((p) => p.accountId === a.id).length;
          ok = count < r.value;
          detail = `${count} open ${total ? "across the workspace" : "on this profile"} · ${r.value} maximum.`;
          break;
        }
        case "stake": {
          const cap = r.unit === "USD" ? r.value : (a.equity * r.value) / 100;
          ok = capital <= cap + 0.0001;
          detail = `${usd(capital)} estimated loss at stop or contract stake · ${usd(cap)} cap.`;
          break;
        }
        case "leverage": {
          const ratio = Number(a.leverage.match(/:\s*(\d+)/)?.[1] ?? 1);
          ok = ratio <= r.value;
          detail = `${ratio}× configured · ${r.value}× cap.`;
          break;
        }
        case "symbol":
        case "asset": {
          const matched = orders.filter((p) =>
            r.id === "symbol"
              ? p.symbol === s.canonical
              : symbols.get(p.symbol)?.assetClass === s.assetClass,
          );
          const value =
            capital + matched.reduce((n, p) => n + (positionRisk(p) ?? 0), 0);
          ok = value <= (equity * r.value) / 100;
          detail = `${usd(value)} modeled post-trade stop-risk · ${r.value}% equity cap.`;
          break;
        }
        case "hourly": {
          const count = fills.filter((f) => f.at > now - 3600000).length;
          ok = count < r.value;
          detail = `${count} local fills in the last hour · ${r.value} max.`;
          break;
        }
        case "hold":
          ok =
            r.value === 0 ||
            !t.carry ||
            t.carry === "Intraday" ||
            (r.value === 1 && t.carry === "Overnight");
          detail = `${t.carry ?? "Intraday"} intent · ${r.value === 2 ? "intraday only" : r.value === 1 ? "no weekend carry" : "carries allowed"}.`;
          break;
        case "margin":
          ok = margin < r.value;
          detail = `${margin.toFixed(1)}% estimated used · under ${r.value}% required.`;
          break;
        case "minutes":
          continue;
      }
      push(`${r.id}:${r.scope}`, label, ok, detail);
    }
    const duplicate = fills.some(
      (f) =>
        f.key === fingerprint(t) &&
        f.at > now - shields.duplicateSeconds * 1000,
    );
    const recent = attempts.filter((f) => f.at > now - 60_000);
    const signals = recent.filter((f) => f.channel === "Signal").length;
    const risks = ctx.records
      .filter(
        (r) =>
          Date.parse(r.closedAt) > now - 30 * 86400000 &&
          r.risk !== null &&
          r.risk > 0,
      )
      .map((r) => r.risk!)
      .sort((x, y) => x - y);
    const median = risks.length
      ? (risks[Math.floor((risks.length - 1) / 2)] +
          risks[Math.floor(risks.length / 2)]) /
        2
      : 75;
    const quote = t.side === "BUY" ? s.ask : s.bid,
      dev = (Math.abs(t.entry - quote) / quote) * 100;
    push(
      "duplicate",
      "Duplicate detector",
      !duplicate,
      duplicate
        ? `Matching fill inside ${shields.duplicateSeconds} seconds.`
        : `No matching fill inside ${shields.duplicateSeconds} seconds.`,
      { shield: true },
    );
    push(
      "rapid",
      "Rapid-fire limiter",
      recent.length < shields.perMinute,
      `${recent.length} prior submissions this minute · ${shields.perMinute} max.`,
      { shield: true },
    );
    if (t.channel === "Signal")
      push(
        "storm",
        "Signal storm quarantine",
        signals < shields.signalPerMinute,
        `${signals} prior signal submissions this minute · ${shields.signalPerMinute} max.`,
        { shield: true },
      );
    push(
      "fat-finger",
      "Stake vs. median",
      capital <= median * shields.medianFactor,
      `${usd(capital)} vs. ${usd(median)} reference median × ${shields.medianFactor}.`,
      { shield: true, overridable: true },
    );
    push(
      "price",
      "Price sanity",
      dev <= shields.priceDeviationPct,
      `${dev.toFixed(2)}% from ${quote.toFixed(s.digits)} · ${shields.priceDeviationPct}% band.`,
      { shield: true, overridable: true },
    );
    const session = getProfileSession(
      a,
      ctx.accounts.indexOf(a),
      ctx.records,
      now,
    );
    push(
      "session",
      "Session & reality limit",
      !session.stopped,
      session.stopped
        ? `EAT session stopped · ${session.minutes} min / ${session.cap} min · ${session.streak} consecutive losses.`
        : `${session.minutes} / ${session.cap} min · ${session.streak} consecutive losses.${session.reminderDue ? " Break reminder due." : ""}`,
    );
  }
  return {
    checks,
    breaker,
    risk: capital,
    scope: a?.label ?? "Unknown profile",
    subject: safeRiskText(
      t.subject ?? `${t.channel} · ${t.side} ${t.symbol} ${t.size}`,
    ),
  };
}
