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
