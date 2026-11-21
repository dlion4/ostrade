// H-2 service layer. These signatures mirror the future read-only public API.
import {
  brokerFaqs,
  connectionMethods,
  demoVenues,
  symbolMappings,
  type BrokerFaq,
  type ConnectionMethodDetail,
  type DemoVenue,
  type SymbolMapping,
} from "@/data/brokers";
import { brokers, capabilityBrokers, capabilityRows, type Broker, type CapValue } from "@/data/landing";
import { latency } from "./_latency";

export type { BrokerFaq, ConnectionMethodDetail, DemoVenue, SymbolMapping };

export const getConnectionMethods = (): Promise<ConnectionMethodDetail[]> => latency(connectionMethods, 300, 500);
export const getDemoVenues = (): Promise<DemoVenue[]> => latency(demoVenues, 300, 500);
export const getSymbolMappings = (): Promise<SymbolMapping[]> => latency(symbolMappings, 300, 600);
export const getBrokerFaqs = (): Promise<BrokerFaq[]> => latency(brokerFaqs, 300, 500);

export interface BrokerCapability {
  id: string;
  label: string;
  hint: string;
  value: CapValue;
  note?: string;
}
export type RailKind = "api" | "deep-link" | "manual" | "simulated";
export interface FinanceRail {
  id: "deposit" | "withdraw" | "transfer";
  label: string;
  kind: RailKind;
  title: string;
  detail: string;
}
export interface BrokerDetail {
  broker: Broker;
  matrixName: string;
  capabilities: BrokerCapability[];
  rails: FinanceRail[];
}

const MATRIX_INDEX: Record<string, number> = {
  deriv: 0,
  exness: 1,
  icmarkets: 1,
  pepperstone: 1,
  xm: 1,
  fxtm: 1,
  tickmill: 1,
  ctrader: 2,
  alpaca: 3,
  binance: 4,
  oanda: 5,
};

function railFor(id: FinanceRail["id"], value: CapValue, note: string | undefined, paper: boolean): FinanceRail {
  const label = id === "deposit" ? "Deposits" : id === "withdraw" ? "Withdrawals" : "Internal transfers";
  if (paper) {
    return { id, label, kind: "simulated", title: "Simulated rail", detail: "Paper balance movements are demonstrations only; no real money moves." };
  }
  if (value === "yes") {
    return { id, label, kind: "api", title: "Automated API flow", detail: `The broker API permits this movement${note ? ` (${note})` : ""}. A receipt is stored in Records.` };
  }
  if (id !== "transfer" && value === "partial") {
    return { id, label, kind: "deep-link", title: "Deep-link or restricted flow", detail: `${note ? `${note}. ` : ""}OStrade hands off to the permitted rail and reconciles the result in your ledger.` };
  }
  return { id, label, kind: "manual", title: "Manual rail, automated ledger", detail: "The broker API does not permit this movement. Complete it at the broker, then attach proof for reconciliation." };
}

export async function getBrokerDetail(id: string): Promise<BrokerDetail> {
  const broker = brokers.find((b) => b.id === id);
  if (!broker) throw new Error("Unknown broker");
  const paper = id === "paper";
  const matrixIndex = MATRIX_INDEX[id] ?? 1;
  const matrixName = paper ? "OStrade local simulation" : capabilityBrokers[matrixIndex];
  const capabilities = capabilityRows.map((row) => {
    if (paper) {
      const supported = !["copy", "deposit", "withdraw", "transfer"].includes(row.id);
      return { id: row.id, label: row.label, hint: row.hint, value: (supported ? "yes" : "partial") as CapValue, note: supported ? "simulated" : "paper only" };
    }
    const value = row.values[matrixIndex];
    return { id: row.id, label: row.label, hint: row.hint, value: value.v, note: value.note };
  });
  const find = (capId: string) => capabilities.find((c) => c.id === capId)!;
  const rails = (["deposit", "withdraw", "transfer"] as const).map((railId) => {
    const capId = railId === "transfer" ? "transfer" : railId;
    const cap = find(capId);
    return railFor(railId, cap.value, cap.note, paper);
  });
  return latency({ broker, matrixName, capabilities, rails });
}

/* ── A-4 broker connect — capability chips straight from the matrix ── */

export type ConnectChipValue = "yes" | "partial" | "no";
export interface ConnectChip { id: "trade" | "deposit" | "transfer"; label: string; v: ConnectChipValue; note?: string; }
export interface BrokerConnectOption {
  id: string;
  name: string;
  initials: string;
  tone: Broker["tone"];
  accountTypes: string[];
  method: string;
  minutes: number;
  chips: ConnectChip[];
  recommended?: boolean;
}

const MATRIX_ORDER = ["deriv", "exness", "ctrader", "alpaca", "binance", "oanda"];
const CHIP_ROWS = [
  { id: "trade" as const, label: "Trade", row: "market" },
  { id: "deposit" as const, label: "Deposit API", row: "deposit" },
  { id: "transfer" as const, label: "Transfer", row: "transfer" },
];

/** The seven first-account choices; capability chips reuse the canonical matrix rows. */
const brokerConnectOptions: BrokerConnectOption[] = (["paper", "deriv", "exness", "ctrader", "alpaca", "binance", "oanda"] as const).map((id) => {
  const b = brokers.find((x) => x.id === id)!;
  const paper = id === "paper";
  const chips: ConnectChip[] = CHIP_ROWS.map(({ id: chipId, label, row }) => {
    if (paper) {
      const v: ConnectChipValue = chipId === "trade" ? "yes" : "partial";
      return { id: chipId, label, v, note: chipId === "trade" ? "local engine" : "paper only" };
    }
    const index = MATRIX_ORDER.indexOf(id);
    const value = capabilityRows.find((r) => r.id === row)!.values[index];
    return { id: chipId, label, v: value.v, note: value.note };
  });
  return {
    id,
    name: b.name,
    initials: b.initials,
    tone: b.tone,
    accountTypes: b.accounts,
    method: b.connect,
    minutes: paper ? 1 : id === "deriv" || id === "ctrader" ? 3 : 2,
    chips,
    recommended: paper,
  };
});

export const getBrokerConnectOptions = (): Promise<BrokerConnectOption[]> => latency(brokerConnectOptions, 300, 500);

export interface DerivOAuthSession {
  appId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  accounts: { id: string; kind: "Demo" | "Real"; currency: string; balance: string }[];
}

/** Step-5 payload of the inert OAuth preview: static account list, never a live session. */
const derivOAuthSession: DerivOAuthSession = {
  appId: "OSTRADE-PREVIEW",
  redirectUri: "https://app.ostrade.test/auth/deriv/callback",
  state: "os-csrf-7f3a9c",
  scopes: ["Read account list and balances", "Trade on the account you select", "Never withdraw — no withdrawal scope exists"],
  accounts: [
    { id: "VRTC1234567", kind: "Demo", currency: "USD", balance: "10,000.00" },
    { id: "CRD••••4102", kind: "Real", currency: "USD", balance: "••••••" },
  ],
};
export const getDerivOAuthSession = (): Promise<DerivOAuthSession> => latency(derivOAuthSession, 300, 500);

export interface Mt5Proof {
  accountId: string;
  server: string;
  leverage: string;
  currency: string;
  balance: string;
}
const mt5Proof: Mt5Proof = { accountId: "MT••••882130", server: "Exness-MT5Trial7", leverage: "1 : 200", currency: "USD", balance: "7,432.10" };

/** Provision → deploy → getAccountInformation, staged so every hop is visible, then the proof. */
export async function testMt5Connection(): Promise<Mt5Proof> {
  await latency({ stage: "provision" }, 250, 400);
  await latency({ stage: "deploy" }, 300, 450);
  return latency(mt5Proof, 300, 500);
}

export interface KeyProof {
  accountId: string;
  label: string;
  currency: string;
  balance: string;
  extra?: string;
}
const keyProofs: Record<string, KeyProof> = {
  alpaca: { accountId: "PKT••••771", label: "Alpaca paper endpoint", currency: "USD", balance: "100,000.00", extra: "Buying power $400,000.00" },
  binance: { accountId: "BIN••••55901", label: "Binance testnet spot", currency: "USDT", balance: "15,000.00", extra: "Trade-only key · IP allow-list checked" },
  oanda: { accountId: "101-•••-8822", label: "OANDA practice v20", currency: "USD", balance: "100,000.00", extra: "Practice environment confirmed" },
  ctrader: { accountId: "cT••••5521", label: "cTrader demo (OAuth)", currency: "EUR", balance: "50,000.00", extra: "OAuth hand-off simulated — no token issued" },
};
/** Inline "Test" for the key-based cards: fetch account info before anything is saved. */
export async function testKeyConnection(broker: "alpaca" | "binance" | "oanda" | "ctrader"): Promise<KeyProof> {
  await latency({ stage: "handshake" }, 250, 400);
  return latency(keyProofs[broker], 300, 500);
}

export interface SaveConnectionInput {
  broker: string;
  accountId: string;
  accountType: "LIVE" | "DEMO" | "PAPER";
  currency: string;
  balance: string;
}

/** Future REST shape: POST /me/connections. Stops at a labelled state — no credential leaves the browser. */
export async function saveBrokerConnection(input: SaveConnectionInput): Promise<InertConnectionResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: `The ${input.broker} connection format passed every local check. Nothing was saved and no broker session was opened.`,
    detail: `Next in the real flow: ${input.accountId} is vaulted with AES-256-GCM, the adapter probes the account once, and the dashboard loads with live data.`,
    reference: "CONNECT-PREVIEW-001",
  }, 500, 800);
}

export interface InertConnectionResult {
  status: "ready";
  simulated: boolean;
  title: string;
  message: string;
  detail: string;
  reference: string;
}
