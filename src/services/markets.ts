import { getAccounts } from "./dashboard";
import { mappedBrokerSymbol } from "./symbolMappings";
// T-2 Markets service layer. TanStack Query consumes only these functions.
// Candles/ticks are deterministic static snapshots — nothing random-walks over time.
import { seededRandom, roundTo } from "@/data/_seed";
import type { BrokerKey } from "@/data/dashboard";
import { tradingAccounts } from "@/data/dashboard";
import {
  ASSET_CLASSES,
  defaultWatchlist,
  initialMappingOverrides,
  initialPriceAlerts,
  marketSymbols,
  symbolAliases,
  type AlertCondition,
  type AssetClass,
  type MappingOverride,
  type MarketSymbol,
  type PriceAlert,
  type SessionWindow,
} from "@/data/markets";
import { latency } from "./_latency";

export { ASSET_CLASSES, mappedBrokerSymbol };
export type { AlertCondition, AssetClass, MappingOverride, MarketSymbol, PriceAlert, SessionWindow };

export type Timeframe = "1m" | "5m" | "15m" | "1H" | "4H" | "1D" | "1W";
export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1H", "4H", "1D", "1W"];

export interface Candle { t: string; o: number; h: number; l: number; c: number; v: number }
export interface Tick { time: string; bid: number; ask: number; dir: "up" | "down" | "flat" }

const TF_MINUTES: Record<Timeframe, number> = { "1m": 1, "5m": 5, "15m": 15, "1H": 60, "4H": 240, "1D": 1440, "1W": 10080 };
const CLASS_VOL: Record<AssetClass, number> = { Forex: 0.00045, Synthetics: 0.0016, Metals: 0.0011, Indices: 0.0009, Crypto: 0.0028, Stocks: 0.0019 };
/** Snapshot instant: 16:40 EAT (13:40 UTC). */
const SNAPSHOT_UTC = Date.UTC(2025, 2, 14, 13, 40, 0);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function eatLabel(utcMs: number, daily: boolean): string {
  const d = new Date(utcMs + 3 * 3600 * 1000);
  if (daily) return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function findSymbol(canonical: string): MarketSymbol | undefined {
  return marketSymbols.find((s) => s.canonical === canonical);
}

/* ── Queries ─────────────────────────────────────────────── */

export const getMarketUniverse = (): Promise<MarketSymbol[]> => latency(marketSymbols, 300, 560);

export async function getMarketSymbol(canonical: string): Promise<MarketSymbol> {
  const s = findSymbol(canonical);
  if (!s) throw new Error(`Unknown symbol ${canonical}`);
  return latency(s, 300, 480);
}

export async function getCandles(canonical: string, timeframe: Timeframe, count = 60): Promise<Candle[]> {
  const s = findSymbol(canonical);
  if (!s) throw new Error(`Unknown symbol ${canonical}`);
  const rand = seededRandom(`candles:${canonical}:${timeframe}`);
  const vol = CLASS_VOL[s.assetClass] * Math.sqrt(TF_MINUTES[timeframe] / 15);
  const path: number[] = [1];
  for (let i = 1; i <= count; i++) {
    const drift = (rand() - 0.48) * vol * 2;
    path.push(path[i - 1] * (1 + drift));
  }
  const scale = s.bid / path[count];
  const closes = path.map((p) => p * scale);
  const daily = TF_MINUTES[timeframe] >= 1440;
  const candles: Candle[] = [];
  for (let i = 1; i <= count; i++) {
    const o = closes[i - 1];
    const c = closes[i];
    const wick = Math.abs(c - o) + s.bid * vol * 0.6;
    const h = Math.max(o, c) + wick * rand() * 0.7;
    const l = Math.min(o, c) - wick * rand() * 0.7;
    const minutesBack = (count - i) * TF_MINUTES[timeframe];
    candles.push({
      t: eatLabel(SNAPSHOT_UTC - minutesBack * 60000, daily),
      o: roundTo(o, s.digits),
      h: roundTo(h, s.digits),
      l: roundTo(l, s.digits),
      c: roundTo(c, s.digits),
      v: Math.round(400 + rand() * 1600 + (Math.abs(c - o) / (s.bid * vol || 1)) * 300),
    });
  }
  return latency(candles, 320, 620);
}

export async function getRecentTicks(canonical: string, broker: BrokerKey = "paper"): Promise<Tick[]> {
  const s = findSymbol(canonical);
  if (!s) throw new Error(`Unknown symbol ${canonical}`);
  const rand = seededRandom(`ticks:${canonical}:${broker}`);
  const spread = (s.spreads[broker] ?? s.spreads.paper ?? 1) * s.pip;
  const ticks: Tick[] = [];
  let price = s.bid;
  let seconds = 0;
  for (let i = 0; i < 20; i++) {
    const t = SNAPSHOT_UTC - seconds * 1000;
    const d = new Date(t + 3 * 3600 * 1000);
    const prev = price;
    price = i === 0 ? s.bid : price - (rand() - 0.5) * s.pip * 6;
    ticks.push({
      time: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`,
      bid: roundTo(price, s.digits),
      ask: roundTo(price + spread, s.digits),
      dir: "flat",
    });
    void prev;
    seconds += 1 + Math.floor(rand() * 4);
  }
  // Newest first: each tick's direction compares with the older tick that follows it.
  for (let i = 0; i < ticks.length - 1; i++) {
    ticks[i].dir = ticks[i].bid > ticks[i + 1].bid ? "up" : ticks[i].bid < ticks[i + 1].bid ? "down" : "flat";
  }
  return latency(ticks, 300, 520);
}

/* ── Watchlist (persisted per user — localStorage today, REST later) ── */

const WATCH_KEY = "os-watchlist";

export async function getWatchlist(): Promise<string[]> {
  let list = defaultWatchlist;
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed.filter((x): x is string => typeof x === "string" && !!findSymbol(x));
    }
  } catch {
    /* fall back to defaults */
  }
  return latency(list, 300, 450);
}

export async function saveWatchlist(list: string[]): Promise<string[]> {
  const clean = Array.from(new Set(list.filter((x) => !!findSymbol(x))));
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable */
  }
  return latency(clean, 200, 360);
}

/* ── Fuzzy symbol search (pure, synchronous — used for instant filtering) ── */

/** Strips broker affixes only (frx / cry / OTC_ prefixes, m / c / z account suffixes, separators). */
export function stripBrokerAffixes(raw: string): string {
  let q = raw.trim().toLowerCase();
  if (!q) return "";
  q = q.replace(/[\s/_.-]/g, "");
  q = q.replace(/^(frx|cry|otc)/, "");
  if (/^[a-z]{6}[mcz]$/.test(q)) q = q.slice(0, 6);
  if (/^[a-z0-9]+[mcz]$/.test(q) && marketSymbols.some((s) => s.canonical.toLowerCase().replace(/[_]/g, "") === q.slice(0, -1))) q = q.slice(0, -1);
  return q;
}

/** Search normalization: plain-language aliases first, then broker affix stripping. */
export function normalizeSymbolQuery(raw: string): string {
  const q = raw.trim().toLowerCase();
  if (!q) return "";
  if (symbolAliases[q]) return symbolAliases[q].toLowerCase().replace(/[_]/g, "");
  return stripBrokerAffixes(q);
}

export function matchesSymbolQuery(s: MarketSymbol, raw: string): boolean {
  const q = normalizeSymbolQuery(raw);
  if (!q) return true;
  const compact = (v: string) => v.toLowerCase().replace(/[\s/_.-]/g, "");
  if (compact(s.canonical).includes(q)) return true;
  if (compact(s.name).includes(q)) return true;
  return Object.values(s.brokerSymbols).some((b) => b && compact(b).includes(q));
}

export function resolvedCanonical(raw: string): string | null {
  const q = normalizeSymbolQuery(raw);
  if (!q) return null;
  const exact = marketSymbols.find((s) => s.canonical.toLowerCase().replace(/[_]/g, "") === q);
  if (exact) return exact.canonical;
  const viaBroker = marketSymbols.find((s) => Object.values(s.brokerSymbols).some((b) => b?.toLowerCase().replace(/[/_]/g, "") === q));
  return viaBroker?.canonical ?? null;
}

/* ── §3.4 Symbol resolution (exact → suffix → AI fuzzy fallback) ── */

export interface ResolutionStep {
  step: 1 | 2 | 3;
  label: string;
  status: "matched" | "skipped" | "miss";
  detail: string;
}
export interface ResolutionResult {
  input: string;
  accountId: string;
  accountLabel: string;
  broker: BrokerKey;
  canonical: string | null;
  brokerSymbol: string | null;
  confidence: number;
  method: "exact" | "suffix" | "ai" | "none";
  needsConfirmation: boolean;
  steps: ResolutionStep[];
}

const MAPPING_KEY = "os-symbol-mappings";
function readPersistedMappings(): MappingOverride[] {
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    return raw ? (JSON.parse(raw) as MappingOverride[]) : [];
  } catch {
    return [];
  }
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const grams = (s: string) => new Set(Array.from({ length: Math.max(1, s.length - 1) }, (_, i) => s.slice(i, i + 2)));
  const ga = grams(a);
  const gb = grams(b);
  let inter = 0;
  ga.forEach((g) => { if (gb.has(g)) inter += 1; });
  return (2 * inter) / (ga.size + gb.size || 1);
}

export async function resolveSymbol(input: string, accountId: string): Promise<ResolutionResult> {
  const acc = (await getAccounts()).find((a) => a.id === accountId) ?? tradingAccounts[0];
  const raw = input.trim();
  const lower = raw.toLowerCase();
  const steps: ResolutionStep[] = [];
  const base = { input: raw, accountId: acc.id, accountLabel: acc.label, broker: acc.broker };

  // 1. exact match on (account.broker, canonical) — or broker symbol, or a saved mapping
  const saved = [...readPersistedMappings(), ...initialMappingOverrides].find((m) => m.broker === acc.broker && m.accountLabel === acc.label && m.input.toLowerCase() === lower);
  const exactCanon = marketSymbols.find((s) => s.canonical.toLowerCase() === lower || mappedBrokerSymbol(s, acc)?.toLowerCase() === lower);
  if (saved) {
    steps.push({ step: 1, label: "Exact / saved mapping", status: "matched", detail: `Saved ${saved.method} mapping from ${saved.confirmedEat}.` });
    steps.push({ step: 2, label: "Account-type suffix", status: "skipped", detail: "Not needed — resolved in step 1." });
    steps.push({ step: 3, label: "AI mapper fallback", status: "skipped", detail: "Not needed — resolved in step 1." });
    return latency({ ...base, canonical: saved.canonical, brokerSymbol: mappedBrokerSymbol(marketSymbols.find((s) => s.canonical === saved.canonical), acc) ?? saved.brokerSymbol, confidence: saved.confidence, method: "exact" as const, needsConfirmation: false, steps }, 420, 720);
  }
  if (exactCanon) {
    const bs = mappedBrokerSymbol(exactCanon, acc) ?? null;
    steps.push({ step: 1, label: "Exact match", status: bs ? "matched" : "miss", detail: bs ? `${acc.brokerName} lists ${exactCanon.canonical} as ${bs}.` : `${exactCanon.canonical} exists, but ${acc.brokerName} does not list it.` });
    steps.push({ step: 2, label: "Account-type suffix", status: "skipped", detail: bs ? "Not needed — resolved in step 1." : "No suffix variant offered." });
    steps.push({ step: 3, label: "AI mapper fallback", status: "skipped", detail: bs ? "Not needed." : "Blocked — the instrument is not offered on this account." });
    return latency({ ...base, canonical: exactCanon.canonical, brokerSymbol: bs, confidence: bs ? 1 : 0, method: bs ? ("exact" as const) : ("none" as const), needsConfirmation: false, steps }, 420, 720);
  }
  steps.push({ step: 1, label: "Exact match", status: "miss", detail: `No exact (${acc.brokerName}, symbol) row for "${raw}".` });

  // 2. account-type-aware suffix (m / c / z) and broker prefixes
  const norm = stripBrokerAffixes(raw);
  const suffixHit = marketSymbols.find((s) => s.canonical.toLowerCase().replace(/[_]/g, "") === norm);
  if (suffixHit && mappedBrokerSymbol(suffixHit, acc)) {
    steps.push({ step: 2, label: "Account-type suffix", status: "matched", detail: `Stripped prefix/suffix → ${suffixHit.canonical}; ${acc.brokerName} symbol ${mappedBrokerSymbol(suffixHit, acc)}.` });
    steps.push({ step: 3, label: "AI mapper fallback", status: "skipped", detail: "Not needed — resolved in step 2." });
    return latency({ ...base, canonical: suffixHit.canonical, brokerSymbol: mappedBrokerSymbol(suffixHit, acc) ?? null, confidence: 0.97, method: "suffix" as const, needsConfirmation: false, steps }, 420, 720);
  }
  steps.push({ step: 2, label: "Account-type suffix", status: "miss", detail: "No m / c / z suffix or frx / cry / OTC_ prefix variant matched." });

  // 3. AI mapper fallback — alias table + bigram similarity, confidence-scored
  const alias = symbolAliases[lower];
  let best: { s: MarketSymbol; score: number } | null = null;
  if (alias) {
    const s = findSymbol(alias);
    if (s) best = { s, score: 0.86 };
  } else {
    marketSymbols.forEach((s) => {
      if (!mappedBrokerSymbol(s, acc)) return;
      const score = Math.max(similarity(norm, s.canonical.toLowerCase()), similarity(lower, s.name.toLowerCase()) * 0.92);
      if (!best || score > best.score) best = { s, score };
    });
  }
  const found = best as { s: MarketSymbol; score: number } | null;
  if (!found || found.score < 0.45 || !mappedBrokerSymbol(found.s, acc)) {
    steps.push({ step: 3, label: "AI mapper fallback", status: "miss", detail: "No candidate above 0.45 confidence. The order would be blocked, never substituted." });
    return latency({ ...base, canonical: null, brokerSymbol: null, confidence: found ? roundTo(found.score, 2) : 0, method: "none" as const, needsConfirmation: false, steps }, 420, 720);
  }
  const confidence = roundTo(Math.min(found.score, 0.95), 2);
  steps.push({ step: 3, label: "AI mapper fallback", status: "matched", detail: `Best candidate ${found.s.canonical} (${mappedBrokerSymbol(found.s, acc)}) at ${Math.round(confidence * 100)}% confidence.` });
  return latency({ ...base, canonical: found.s.canonical, brokerSymbol: mappedBrokerSymbol(found.s, acc) ?? null, confidence, method: "ai" as const, needsConfirmation: confidence < 0.9, steps }, 520, 820);
}

export async function confirmSymbolMapping(result: ResolutionResult): Promise<MappingOverride> {
  const entry: MappingOverride = {
    id: `mo-${Date.now()}`,
    input: result.input,
    broker: result.broker,
    accountLabel: result.accountLabel,
    canonical: result.canonical ?? "",
    brokerSymbol: result.brokerSymbol ?? "",
    method: "ai-confirmed",
    confidence: result.confidence,
    confirmedEat: "Today 16:42",
  };
  try {
    localStorage.setItem(MAPPING_KEY, JSON.stringify([entry, ...readPersistedMappings()].slice(0, 40)));
  } catch {
    /* storage unavailable */
  }
  return latency(entry, 300, 520);
}

export async function getSymbolMappings(): Promise<MappingOverride[]> {
  return latency([...readPersistedMappings(), ...initialMappingOverrides], 300, 500);
}

/* ── Price alerts (armed locally; delivery channels go live with the backend) ── */

let alertsStore: PriceAlert[] = structuredClone(initialPriceAlerts);

export const getPriceAlerts = (): Promise<PriceAlert[]> => latency(alertsStore, 300, 480);

export interface CreatePriceAlertInput { canonical: string; condition: AlertCondition; price: number; note?: string }

export async function createPriceAlert(input: CreatePriceAlertInput): Promise<PriceAlert> {
  const alert: PriceAlert = {
    id: `pa-${Date.now()}`,
    canonical: input.canonical,
    condition: input.condition,
    price: input.price,
    note: input.note?.trim() || "Set from Markets",
    createdEat: "Today 16:42",
    status: "armed",
    channel: "In-app",
  };
  alertsStore = [alert, ...alertsStore];
  return latency(alert, 320, 560);
}

export async function removePriceAlert(id: string): Promise<{ id: string }> {
  alertsStore = alertsStore.filter((a) => a.id !== id);
  return latency({ id }, 240, 420);
}

/* ── Ticket draft handoff to T-3 (ticketStore: survives route changes) ── */

export interface TicketDraft { canonical: string; side: "BUY" | "SELL"; accountId: string; price: number; source: string }

export async function stageTicketDraft(draft: TicketDraft): Promise<TicketDraft> {
  try {
    sessionStorage.setItem("os-ticket-draft", JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
  return latency(draft, 200, 320);
}
