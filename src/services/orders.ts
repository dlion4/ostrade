// Order service. Paper accounts fully simulate locally; live brokers are inert
// until the backend exists, and say so honestly.
import { latency } from "./_latency";

export interface PlaceOrderInput {
  symbol: string;
  side: "BUY" | "SELL";
  entry: string;
  sl: string;
  tp: string;
  lots: string;
  account: string;
}
export interface PlaceOrderResult {
  ref: string;
  status: "filled" | "ready";
  simulated: boolean;
  message: string;
  filledAt?: string;
}

let seq = 131;

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const isPaper = input.account.toLowerCase().startsWith("paper");
  if (!isPaper) {
    return latency({
      ref: "—",
      status: "ready" as const,
      simulated: false,
      message: "Ready — executes when the backend is connected",
    });
  }
  seq += 1;
  const ref = `OST-2025-${String(seq).padStart(5, "0")}`;
  return latency({
    ref,
    status: "filled" as const,
    simulated: true,
    message: `Simulated fill · ${input.side} ${input.lots} ${input.symbol} @ ${input.entry}`,
    filledAt: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  });
}
