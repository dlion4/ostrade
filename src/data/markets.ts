// T-2 Markets — canonical symbol universe (§3.4 symbol_map shape) + price alerts + mappings.
// Static snapshot at 16:40 EAT. Quotes never tick. Extend this file for T-3/T-4; never fork it.
import type { BrokerKey } from "./dashboard";
import { buildSparkline, roundTo } from "./_seed";

export type AssetClass = "Forex" | "Synthetics" | "Metals" | "Indices" | "Crypto" | "Stocks";
export const ASSET_CLASSES: AssetClass[] = ["Forex", "Synthetics", "Metals", "Indices", "Crypto", "Stocks"];

export interface SessionWindow { label: string; hoursEat: string }

export interface MarketSymbol {
  canonical: string;
  name: string;
  assetClass: AssetClass;
  digits: number;
  pip: number;
  bid: number;
  ask: number;
  changePct: number;
  high24: number;
  low24: number;
  volumeRank: number;
  brokerSymbols: Partial<Record<BrokerKey, string>>;
  spreads: Partial<Record<BrokerKey, number>>;
  spreadUnit: "pips" | "pts" | "¢" | "$";
  sessionsEat: string;
  sessions: SessionWindow[];
  tradeableNow: boolean;
  is247: boolean;
  contractSize: string;
  pipSizeLabel: string;
  volumeUnit: "lots" | "stake" | "shares" | "units";
  minVolume: number;
  maxVolume: number;
  volumeStep: number;
  marginRatePct: number;
  leverage: string;
  swapLong: string;
  swapShort: string;
  suffixNote: string;
  sparkline: number[];
}

type Seed = Omit<MarketSymbol, "ask" | "high24" | "low24" | "sparkline">;

function finalize(s: Seed): MarketSymbol {
  const sparkline = buildSparkline(s.canonical, s.bid, s.changePct, s.digits);
  const base = s.spreads.paper ?? Object.values(s.spreads)[0] ?? 1;
  return {
    ...s,
    ask: roundTo(s.bid + base * s.pip, s.digits),
    high24: roundTo(Math.max(...sparkline) * 1.0006, s.digits),
    low24: roundTo(Math.min(...sparkline) * 0.9994, s.digits),
    sparkline,
  };
}

const FX_SESSIONS: SessionWindow[] = [
  { label: "Sydney", hoursEat: "01:00 – 10:00" },
  { label: "Tokyo", hoursEat: "03:00 – 12:00" },
  { label: "London", hoursEat: "10:00 – 19:00" },
  { label: "New York", hoursEat: "15:00 – 00:00" },
];
const ALL_DAY: SessionWindow[] = [{ label: "Continuous", hoursEat: "00:00 – 24:00 · 7 days" }];
const METAL_SESSIONS: SessionWindow[] = [
  { label: "Main session", hoursEat: "01:05 – 23:55" },
  { label: "Daily break", hoursEat: "23:55 – 01:05" },
];
const US_CASH: SessionWindow[] = [
  { label: "Pre-market (CFD)", hoursEat: "11:00 – 16:30" },
  { label: "US cash session", hoursEat: "16:30 – 23:00" },
];

const EXNESS_FX_NOTE = "Exness resolves the suffix per account type: 'm' Standard, 'c' Raw, 'z' Zero.";

function fx(canonical: string, name: string, bid: number, changePct: number, volumeRank: number, spreadPaper: number, digits = 5, swap: [string, string] = ["−6.8", "+1.9"]): MarketSymbol {
  const pip = digits === 3 ? 0.01 : 0.0001;
  const oanda = `${canonical.slice(0, 3)}_${canonical.slice(3)}`;
  return finalize({
    canonical, name, assetClass: "Forex", digits, pip, bid, changePct, volumeRank,
    brokerSymbols: { paper: canonical, deriv: `frx${canonical}`, exness: `${canonical}m`, oanda, ctrader: canonical, icmarkets: canonical, pepperstone: canonical, xm: canonical },
    spreads: { paper: spreadPaper, deriv: roundTo(spreadPaper * 1.6, 1), exness: roundTo(spreadPaper * 1.1, 1), oanda: roundTo(spreadPaper * 1.3, 1), ctrader: roundTo(spreadPaper * 0.6, 1), icmarkets: roundTo(spreadPaper * 0.5, 1) },
    spreadUnit: "pips", sessionsEat: "Mon 00:05 – Sat 00:00 (24/5)", sessions: FX_SESSIONS,
    tradeableNow: true, is247: false, contractSize: "100,000 units", pipSizeLabel: digits === 3 ? "0.01" : "0.0001",
    volumeUnit: "lots", minVolume: 0.01, maxVolume: 200, volumeStep: 0.01, marginRatePct: 0.5, leverage: "1:200 (Exness) · 1:100 Paper",
    swapLong: swap[0], swapShort: swap[1], suffixNote: EXNESS_FX_NOTE,
  });
}

function synth(canonical: string, name: string, bid: number, changePct: number, volumeRank: number, spread: number, digits = 2): MarketSymbol {
  return finalize({
    canonical, name, assetClass: "Synthetics", digits, pip: digits === 3 ? 0.001 : 0.01, bid, changePct, volumeRank,
    brokerSymbols: { paper: canonical, deriv: canonical },
    spreads: { paper: spread, deriv: spread },
    spreadUnit: "pts", sessionsEat: "24/7 · no weekend gaps", sessions: ALL_DAY,
    tradeableNow: true, is247: true, contractSize: "Stake-based (multiplier)", pipSizeLabel: digits === 3 ? "0.001" : "0.01",
    volumeUnit: "stake", minVolume: 1, maxVolume: 2000, volumeStep: 1, marginRatePct: 0, leverage: "Multiplier ×50 – ×400",
    swapLong: "n/a (contract)", swapShort: "n/a (contract)",
    suffixNote: "Deriv synthetic index — no cross-broker equivalent. Orders buy a contract (proposal → buy).",
  });
}

const exnessIdx: Record<string, string> = { US30: "US30m", NAS100: "USTECm", SPX500: "US500m", GER40: "DE30m", UK100: "UK100m", JP225: "JP225m", HK50: "HK50m" };
const derivIdx: Record<string, string> = { US30: "OTC_DJI", NAS100: "OTC_NDX", SPX500: "OTC_SPC", GER40: "OTC_GDAXI", UK100: "OTC_FTSE", JP225: "OTC_N225" };
const oandaIdx: Record<string, string> = { US30: "US30_USD", NAS100: "NAS100_USD", SPX500: "SPX500_USD", GER40: "DE30_EUR", UK100: "UK100_GBP", JP225: "JP225_USD", HK50: "HK33_HKD" };

function idx(canonical: string, name: string, bid: number, changePct: number, volumeRank: number, spread: number, sessions: SessionWindow[], sessionsEat: string, open: boolean): MarketSymbol {
  const brokerSymbols: Partial<Record<BrokerKey, string>> = { paper: canonical, exness: exnessIdx[canonical], oanda: oandaIdx[canonical], ctrader: canonical };
  if (derivIdx[canonical]) brokerSymbols.deriv = derivIdx[canonical];
  const spreads: Partial<Record<BrokerKey, number>> = { paper: spread, exness: roundTo(spread * 1.2, 1), oanda: roundTo(spread * 1.4, 1), ctrader: roundTo(spread * 0.9, 1) };
  if (derivIdx[canonical]) spreads.deriv = roundTo(spread * 1.8, 1);
  return finalize({
    canonical, name, assetClass: "Indices", digits: 1, pip: 0.1, bid, changePct, volumeRank,
    brokerSymbols, spreads, spreadUnit: "pts", sessionsEat, sessions,
    tradeableNow: open, is247: false, contractSize: "1 × index", pipSizeLabel: "0.1",
    volumeUnit: "lots", minVolume: 0.1, maxVolume: 100, volumeStep: 0.1, marginRatePct: 1, leverage: "1:100 (Exness) · 1:50 Paper",
    swapLong: "−4.12", swapShort: "−1.06",
    suffixNote: `Exness lists this as ${exnessIdx[canonical]}; Deriv uses OTC_ prefixes where available.`,
  });
}

function metal(canonical: string, name: string, bid: number, changePct: number, volumeRank: number, spread: number, digits: number, contract: string): MarketSymbol {
  const brokerSymbols: Partial<Record<BrokerKey, string>> = { paper: canonical, exness: `${canonical}m`, oanda: `${canonical.slice(0, 3)}_${canonical.slice(3)}`, icmarkets: canonical };
  if (canonical !== "XPTUSD") brokerSymbols.deriv = `frx${canonical}`;
  if (canonical === "XAUUSD") brokerSymbols.binance = "PAXGUSDT";
  const spreads: Partial<Record<BrokerKey, number>> = { paper: spread, exness: roundTo(spread * 1.1, 1), oanda: roundTo(spread * 1.3, 1), icmarkets: roundTo(spread * 0.6, 1) };
  if (brokerSymbols.deriv) spreads.deriv = roundTo(spread * 1.7, 1);
  if (brokerSymbols.binance) spreads.binance = roundTo(spread * 2.2, 1);
  return finalize({
    canonical, name, assetClass: "Metals", digits, pip: digits === 2 ? 0.01 : 0.001, bid, changePct, volumeRank,
    brokerSymbols, spreads, spreadUnit: "¢", sessionsEat: "Mon–Fri 01:05 – 23:55", sessions: METAL_SESSIONS,
    tradeableNow: true, is247: false, contractSize: contract, pipSizeLabel: digits === 2 ? "0.01" : "0.001",
    volumeUnit: "lots", minVolume: 0.01, maxVolume: 50, volumeStep: 0.01, marginRatePct: 1, leverage: "1:200 (Exness) · 1:100 Paper",
    swapLong: "−28.40", swapShort: "+9.75",
    suffixNote: canonical === "XAUUSD" ? "Binance has no spot gold — PAXGUSDT is a tokenised proxy and is flagged for confirmation." : EXNESS_FX_NOTE,
  });
}

function crypto(canonical: string, name: string, bid: number, changePct: number, volumeRank: number, spread: number, digits: number, brokerSymbols: Partial<Record<BrokerKey, string>>, note: string): MarketSymbol {
  const spreads: Partial<Record<BrokerKey, number>> = {};
  (Object.keys(brokerSymbols) as BrokerKey[]).forEach((b) => {
    spreads[b] = b === "binance" ? roundTo(spread * 0.4, 2) : b === "deriv" ? roundTo(spread * 1.8, 2) : b === "alpaca" ? roundTo(spread * 1.3, 2) : spread;
  });
  return finalize({
    canonical, name, assetClass: "Crypto", digits, pip: digits === 2 ? 0.01 : 0.0001, bid, changePct, volumeRank,
    brokerSymbols, spreads, spreadUnit: "$", sessionsEat: "24/7 · exchange maintenance excluded", sessions: ALL_DAY,
    tradeableNow: true, is247: true, contractSize: "1 coin", pipSizeLabel: digits === 2 ? "0.01" : "0.0001",
    volumeUnit: "units", minVolume: 0.001, maxVolume: 25, volumeStep: 0.001, marginRatePct: 20, leverage: "1:5 CFD · Spot 1:1",
    swapLong: "−0.031%/day", swapShort: "−0.018%/day", suffixNote: note,
  });
}

function stock(canonical: string, name: string, bid: number, changePct: number, volumeRank: number, exnessListed: boolean): MarketSymbol {
  const brokerSymbols: Partial<Record<BrokerKey, string>> = { paper: canonical, alpaca: canonical };
  const spreads: Partial<Record<BrokerKey, number>> = { paper: 2, alpaca: 1 };
  if (exnessListed) {
    brokerSymbols.exness = `${canonical}m`;
    spreads.exness = 6;
  }
  return finalize({
    canonical, name, assetClass: "Stocks", digits: 2, pip: 0.01, bid, changePct, volumeRank,
    brokerSymbols, spreads, spreadUnit: "¢", sessionsEat: "Mon–Fri 16:30 – 23:00", sessions: US_CASH,
    tradeableNow: true, is247: false, contractSize: "1 share", pipSizeLabel: "0.01",
    volumeUnit: "shares", minVolume: 1, maxVolume: 5000, volumeStep: 1, marginRatePct: 20, leverage: "1:2 (Alpaca Reg T) · 1:5 CFD",
    swapLong: "−0.024%/day", swapShort: "−0.012%/day",
    suffixNote: exnessListed ? `Alpaca trades the cash equity; Exness offers ${canonical}m as a CFD.` : "Cash equity on Alpaca only; no CFD listing on connected brokers.",
  });
}

export const marketSymbols: MarketSymbol[] = [
  fx("EURUSD", "Euro / US Dollar", 1.0842, 0.12, 1, 1.2, 5, ["−7.12", "+2.04"]),
  fx("GBPUSD", "British Pound / US Dollar", 1.27118, -0.08, 3, 1.2, 5, ["−4.86", "+0.92"]),
  fx("USDJPY", "US Dollar / Japanese Yen", 156.102, 0.09, 2, 1.4, 3, ["+14.20", "−28.65"]),
  fx("AUDUSD", "Australian Dollar / US Dollar", 0.66401, 0.06, 6, 1.1),
  fx("USDCAD", "US Dollar / Canadian Dollar", 1.36842, -0.11, 8, 1.6),
  fx("USDCHF", "US Dollar / Swiss Franc", 0.90412, 0.04, 9, 1.5, 5, ["+5.10", "−11.80"]),
  fx("NZDUSD", "New Zealand Dollar / US Dollar", 0.60785, -0.19, 12, 1.8),
  fx("EURGBP", "Euro / British Pound", 0.85291, 0.21, 14, 1.4),
  fx("GBPJPY", "British Pound / Japanese Yen", 198.436, 0.17, 10, 2.6, 3, ["+9.40", "−22.10"]),

  synth("R_10", "Volatility 10 Index", 4532.11, 0.27, 4, 0.6, 3),
  synth("R_25", "Volatility 25 Index", 1871.442, -0.41, 11, 0.9, 3),
  synth("R_50", "Volatility 50 Index", 342.6188, 0.66, 13, 1.1, 3),
  synth("R_75", "Volatility 75 Index", 416420.0, 0.85, 5, 28, 2),
  synth("R_100", "Volatility 100 Index", 2210.37, -0.92, 7, 1.4, 2),
  synth("1HZ10V", "Volatility 10 (1s) Index", 9214.556, 0.14, 15, 0.7, 3),
  synth("1HZ50V", "Volatility 50 (1s) Index", 187340.22, -1.12, 16, 6, 2),
  synth("BOOM1000", "Boom 1000 Index", 12455.871, 0.58, 18, 1.8, 3),
  synth("CRASH1000", "Crash 1000 Index", 8312.409, -0.73, 19, 1.8, 3),

  metal("XAUUSD", "Gold / US Dollar", 2385.5, 0.41, 2, 22, 2, "100 troy oz"),
  metal("XAGUSD", "Silver / US Dollar", 28.415, 0.94, 9, 2.5, 3, "5,000 troy oz"),
  metal("XPTUSD", "Platinum / US Dollar", 984.6, -0.58, 20, 35, 2, "50 troy oz"),

  idx("US30", "Wall Street 30", 39120.0, -0.19, 3, 2.4, US_CASH, "Mon–Fri 01:05 – 23:55 (cash 16:30 – 23:00)", true),
  idx("NAS100", "US Tech 100", 19842.5, 0.33, 2, 1.3, US_CASH, "Mon–Fri 01:05 – 23:55 (cash 16:30 – 23:00)", true),
  idx("SPX500", "US 500", 5308.4, 0.15, 4, 0.6, US_CASH, "Mon–Fri 01:05 – 23:55 (cash 16:30 – 23:00)", true),
  idx("GER40", "Germany 40", 18692.3, 0.48, 6, 1.4, [{ label: "Xetra cash", hoursEat: "10:00 – 18:30" }, { label: "Extended", hoursEat: "04:15 – 00:00" }], "Mon–Fri 04:15 – 00:00", true),
  idx("UK100", "UK 100", 8241.7, -0.12, 8, 1.2, [{ label: "LSE cash", hoursEat: "10:00 – 18:30" }, { label: "Extended", hoursEat: "03:00 – 23:00" }], "Mon–Fri 03:00 – 23:00", true),
  idx("JP225", "Japan 225", 38912.0, -0.36, 10, 7, [{ label: "Tokyo cash", hoursEat: "03:00 – 09:30" }, { label: "Extended", hoursEat: "02:00 – 11:00" }], "Mon–Fri 02:00 – 11:00", false),
  idx("HK50", "Hong Kong 50", 18411.0, 0.71, 14, 9, [{ label: "HKEX cash", hoursEat: "04:15 – 11:00" }], "Mon–Fri 04:15 – 11:00", false),

  crypto("BTCUSDT", "Bitcoin / Tether", 64120.0, -0.62, 1, 12, 2, { paper: "BTCUSDT", binance: "BTCUSDT", exness: "BTCUSDz" }, "Exness 'z' suffix = zero-spread account; commission applies instead."),
  crypto("BTCUSD", "Bitcoin / US Dollar", 64136.5, -0.58, 3, 14, 2, { paper: "BTCUSD", deriv: "cryBTCUSD", exness: "BTCUSDm", alpaca: "BTC/USD" }, "Alpaca uses slash notation (BTC/USD); Deriv uses the cry prefix."),
  crypto("ETHUSDT", "Ethereum / Tether", 3120.0, -0.24, 2, 1.6, 2, { paper: "ETHUSDT", binance: "ETHUSDT", deriv: "cryETHUSD", exness: "ETHUSDm", alpaca: "ETH/USD" }, "Mapped to ETH/USD on Alpaca and cryETHUSD on Deriv."),
  crypto("SOLUSDT", "Solana / Tether", 146.82, 2.31, 5, 0.12, 2, { paper: "SOLUSDT", binance: "SOLUSDT", alpaca: "SOL/USD" }, "Not listed on Exness or Deriv — routing is blocked there."),
  crypto("XRPUSDT", "XRP / Tether", 0.5214, 1.48, 7, 0.0012, 4, { paper: "XRPUSDT", binance: "XRPUSDT", exness: "XRPUSDm" }, "Four-decimal pricing; minimum notional applies on Binance."),

  stock("AAPL", "Apple Inc.", 227.6, 0.44, 2, true),
  stock("NVDA", "NVIDIA Corp.", 128.3, 1.65, 1, true),
  stock("TSLA", "Tesla Inc.", 176.42, -1.28, 3, true),
  stock("MSFT", "Microsoft Corp.", 421.15, 0.21, 4, true),
  stock("AMZN", "Amazon.com Inc.", 184.07, 0.62, 5, true),
  stock("META", "Meta Platforms Inc.", 496.33, -0.47, 6, false),
];

export const defaultWatchlist: string[] = ["EURUSD", "XAUUSD", "R_10", "BTCUSDT", "US30", "GBPUSD", "NAS100", "USDJPY"];

export type AlertCondition = "above" | "below";
export interface PriceAlert {
  id: string;
  canonical: string;
  condition: AlertCondition;
  price: number;
  note: string;
  createdEat: string;
  status: "armed" | "triggered" | "expired" | "paused" | "snoozed";
  channel: string;
}

export const initialPriceAlerts: PriceAlert[] = [
  { id: "pa-01", canonical: "XAUUSD", condition: "above", price: 2400.0, note: "Breakout above weekly high", createdEat: "Today 09:12", status: "armed", channel: "In-app + Telegram" },
  { id: "pa-02", canonical: "EURUSD", condition: "below", price: 1.08, note: "Pre-NFP support", createdEat: "Today 10:40", status: "armed", channel: "In-app" },
  { id: "pa-03", canonical: "BTCUSDT", condition: "below", price: 62500, note: "Invalidates swing long", createdEat: "Yesterday 22:05", status: "armed", channel: "In-app + Email" },
  { id: "pa-04", canonical: "US30", condition: "above", price: 39300, note: "NY open range high", createdEat: "Today 15:55", status: "armed", channel: "In-app" },
  { id: "pa-05", canonical: "R_75", condition: "above", price: 420000, note: "Scalper take-profit zone", createdEat: "Today 13:30", status: "armed", channel: "In-app + Telegram" },
  { id: "pa-06", canonical: "USDJPY", condition: "above", price: 157.0, note: "Intervention watch", createdEat: "Mon 07:20", status: "armed", channel: "In-app + Telegram" },
  { id: "pa-07", canonical: "GBPUSD", condition: "below", price: 1.268, note: "BoE positioning", createdEat: "Mon 11:05", status: "triggered", channel: "In-app" },
  { id: "pa-08", canonical: "NVDA", condition: "above", price: 132.0, note: "Momentum continuation", createdEat: "Today 16:31", status: "armed", channel: "In-app + Email" },
  { id: "pa-09", canonical: "ETHUSDT", condition: "below", price: 3050, note: "Stop-hunt level", createdEat: "Sun 19:40", status: "expired", channel: "In-app" },
  { id: "pa-10", canonical: "NAS100", condition: "above", price: 20000, note: "Round-number test", createdEat: "Today 16:02", status: "armed", channel: "In-app" },
];

export interface MappingOverride {
  id: string;
  input: string;
  broker: BrokerKey;
  accountLabel: string;
  canonical: string;
  brokerSymbol: string;
  method: "exact" | "suffix" | "ai-confirmed";
  confidence: number;
  confirmedEat: string;
}

export const initialMappingOverrides: MappingOverride[] = [
  { id: "mo-01", input: "EURUSDm", broker: "exness", accountLabel: "Exness MT5 Trial 1", canonical: "EURUSD", brokerSymbol: "EURUSDm", method: "suffix", confidence: 1, confirmedEat: "Mon 09:14" },
  { id: "mo-02", input: "GOLD", broker: "exness", accountLabel: "Exness MT5 Trial 1", canonical: "XAUUSD", brokerSymbol: "XAUUSDm", method: "ai-confirmed", confidence: 0.86, confirmedEat: "Mon 09:20" },
  { id: "mo-03", input: "frxGBPUSD", broker: "deriv", accountLabel: "Deriv Demo Synthetics", canonical: "GBPUSD", brokerSymbol: "frxGBPUSD", method: "exact", confidence: 1, confirmedEat: "Mon 10:02" },
  { id: "mo-04", input: "V75", broker: "deriv", accountLabel: "Deriv Demo Synthetics", canonical: "R_75", brokerSymbol: "R_75", method: "ai-confirmed", confidence: 0.81, confirmedEat: "Tue 08:45" },
  { id: "mo-05", input: "DOW", broker: "exness", accountLabel: "Exness MT5 Trial 1", canonical: "US30", brokerSymbol: "US30m", method: "ai-confirmed", confidence: 0.84, confirmedEat: "Tue 15:58" },
  { id: "mo-06", input: "USTEC", broker: "exness", accountLabel: "Exness MT5 Trial 1", canonical: "NAS100", brokerSymbol: "USTECm", method: "suffix", confidence: 0.97, confirmedEat: "Tue 16:10" },
  { id: "mo-07", input: "BTC/USD", broker: "alpaca", accountLabel: "Alpaca Paper US", canonical: "BTCUSD", brokerSymbol: "BTC/USD", method: "exact", confidence: 1, confirmedEat: "Wed 11:31" },
  { id: "mo-08", input: "Volatility 10 Index", broker: "deriv", accountLabel: "Deriv Demo Synthetics", canonical: "R_10", brokerSymbol: "R_10", method: "ai-confirmed", confidence: 0.88, confirmedEat: "Wed 12:04" },
  { id: "mo-09", input: "XAUUSD", broker: "paper", accountLabel: "Paper Main", canonical: "XAUUSD", brokerSymbol: "XAUUSD", method: "exact", confidence: 1, confirmedEat: "Thu 09:00" },
  { id: "mo-10", input: "DE40", broker: "exness", accountLabel: "Exness MT5 Trial 1", canonical: "GER40", brokerSymbol: "DE30m", method: "ai-confirmed", confidence: 0.83, confirmedEat: "Thu 10:22" },
];

/** Plain-language aliases the resolver understands before falling back to fuzzy matching. */
export const symbolAliases: Record<string, string> = {
  gold: "XAUUSD", silver: "XAGUSD", platinum: "XPTUSD", dow: "US30", djia: "US30", "wall street": "US30",
  nasdaq: "NAS100", ustec: "NAS100", us100: "NAS100", spx: "SPX500", us500: "SPX500", sp500: "SPX500",
  dax: "GER40", de40: "GER40", de30: "GER40", ftse: "UK100", nikkei: "JP225", hsi: "HK50",
  v10: "R_10", v25: "R_25", v50: "R_50", v75: "R_75", v100: "R_100", "volatility 10 index": "R_10",
  "volatility 75 index": "R_75", bitcoin: "BTCUSDT", btc: "BTCUSDT", ethereum: "ETHUSDT", eth: "ETHUSDT",
  fiber: "EURUSD", cable: "GBPUSD", gopher: "USDJPY", aussie: "AUDUSD", kiwi: "NZDUSD", loonie: "USDCAD",
  swissy: "USDCHF", guppy: "GBPJPY", paxg: "XAUUSD", paxgusdt: "XAUUSD",
};
