import { publishNotice } from "./notificationStore";
import { brokerRails, convertToUSD, depositAgents, fundingRails, initialDeposits, manualMethods, networkProfiles, recoveryReasons, sampleBanks, sampleUsdKes, supportUrls, type CryptoNetwork, type DepositDetails, type DepositRailId, type DepositRecord, type RecoveryEvent } from "@/data/finance";
import { providerCapabilities, readyMessage } from "@/data/accounts";
import { applySimulatedFunding, getAccounts } from "./dashboard";
import { getFinanceLedger, postFinanceLedger } from "./financeLedger";
import { getRailOverrides, getRailPreference } from "./fundingPolicy";
import { latency } from "./_latency";

export { convertToUSD, fundingRails, manualMethods, networkProfiles, readyMessage, recoveryReasons, sampleBanks, sampleUsdKes };
export type { CryptoNetwork, DepositAgent, DepositRailId, DepositRecord, DepositStatus, FailureReason, FinanceLedgerEntry, FundingCurrency, Rail, RecoveryEvent } from "@/data/finance";
const store = structuredClone(initialDeposits);
const proofs = new Map<string, File>();
const recoveryAudit: RecoveryEvent[] = [];
const whitelisted = new Set<CryptoNetwork>();
let tolerance = { underpaid: 0.5, overpaid: 1 };
let seq = 5100;
const uuid = () => globalThis.crypto.randomUUID();
const cents = (amount: number) => Math.round(amount * 100) / 100;
const eatDateTime = (at: number) => `${new Date(at + 3 * 3600_000).toISOString().slice(0, 23)}+03:00`;
const eatDay = (at: number) => eatDateTime(at).slice(0, 10);
export const getDepositHistory = () => latency(store);
export const getDepositLedger = () => getFinanceLedger("DEPOSIT");
export const getDepositRecovery = () => latency({ items: store.filter((o) => o.failure), events: recoveryAudit });
export function getKenyaAgents() { return latency(depositAgents.slice().sort((a, b) => Number(b.available) - Number(a.available) || Number(b.city === "Juja") - Number(a.city === "Juja"))); }
export async function getFundingAccounts() {
  const accounts = await getAccounts();
  const settings=getRailOverrides();
  return accounts.map((a) => {
    const preferred=getRailPreference(a.id)?.rail;
    const rails=brokerRails[a.broker].flatMap(id=>{
      const rail=fundingRails[id], policy=settings.find(p=>p.id===(id==="mpesa-agent"?"mpesa":id));
      if (policy && !policy.enabled) return [];
      return [{...rail,min:policy?Math.max(rail.min,policy.min):rail.min,max:policy?Math.min(rail.max,policy.max):rail.max,fee:policy?.fee??rail.fee}];
    }).filter(r=>r.min<=r.max).sort((x,y)=>+(preferred===(y.id==="mpesa-agent"?"mpesa":y.id))-+(preferred===(x.id==="mpesa-agent"?"mpesa":x.id)));
    return ({ id: a.id, label: a.label, broker: a.broker, environment: a.environment, currency: a.currency, balance: a.balance, snapshot: a.connected, rails, depositCapability: providerCapabilities(a.broker).find((c) => c.id === "deposit") }); });
}
export type FundingAccount = Awaited<ReturnType<typeof getFundingAccounts>>[number];
export async function getDepositSummary() {
  const now = Date.now(), today = eatDay(now), week = eatDay(now - 6 * 864e5);
  const confirmed = store.filter((o) => o.status === "CONFIRMED" && o.settledAt);
  const timing = Object.values(fundingRails).flatMap((rail) => {
    const samples = confirmed.filter((o) => o.rail === rail.id && o.origin === "Snapshot");
    return samples.length ? [{ rail: rail.id, label: rail.title, minutes: Math.round(samples.reduce((s, o) => s + (Date.parse(o.settledAt!) - Date.parse(o.initiatedAt)) / 60000, 0) / samples.length) }] : [];
  });
  return latency({ month: cents(confirmed.filter((o) => eatDay(Date.parse(o.settledAt!)).startsWith(today.slice(0,7))).reduce((n,o) => n + o.amountUSD, 0)), pending: store.filter((o) => o.status === "PENDING").length, today: confirmed.filter((o) => eatDay(Date.parse(o.settledAt!)) === today).length, failed: store.filter((o) => o.status === "FAILED" && eatDay(Date.parse(o.initiatedAt)) >= week).length, timing });
}
export interface DepositInput {
  accountId: string; rail: DepositRailId; amount: number; idempotencyKey: string; parentRef?: string;
  agentId?: string; phone?: string; phoneConfirmed?: boolean; network?: CryptoNetwork; cryptoAcknowledged?: boolean;
  proof?: File; brokerReference?: string; expectedCredit?: number; manualRail?: string; reviewedProof?: boolean; bankLabel?: string; achAuthorized?: boolean;
  internalWallet?: string; cashierWindow?: number;
}
export async function previewDeposit(input: DepositInput) {
  const account = (await getFundingAccounts()).find((a) => a.id === input.accountId);
  const rail = account?.rails.find((r) => r.id === input.rail);
  if (!account || !rail) throw new Error("This funding method is not available for the selected account profile.");
  let min = rail.min, max = rail.max, fee = rail.fee;
  let details: DepositDetails | undefined;
  if (rail.id === "mpesa-agent") {
    const agent = depositAgents.find((a) => a.id === input.agentId && a.available);
    if (!agent) throw new Error("Choose an available sample Kenya agent.");
    if (!/^\+?254[17]\d{8}$/.test(input.phone?.replace(/\s/g, "") ?? "") || !input.phoneConfirmed) throw new Error("Confirm a sample Kenyan mobile number (such as +254700000000).");
    min = Math.max(agent.min,rail.min); max = Math.min(agent.max,rail.max); fee = getRailOverrides().find(p=>p.id==="mpesa")?.fee ?? agent.fee;
    details = { rail: "mpesa-agent", agentLabel: agent.name, maskedPhone: `+254 ••• ••${input.phone!.slice(-3)}` };
  }
  if (!Number.isFinite(input.amount) || input.amount !== cents(input.amount) || input.amount < min || input.amount > max) throw new Error(`Enter ${rail.currency} ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")} with up to two decimals.`);
  if (rail.id === "crypto") {
    if (!input.network || !networkProfiles.some((n) => n.id === input.network) || !input.cryptoAcknowledged) throw new Error("Select a network and acknowledge that the demo address cannot receive funds.");
    if (!whitelisted.has(input.network)) throw new Error("Use the example verification code for this network first. No email is sent.");
  }
  if (rail.mode === "Proof required") {
    if (!input.proof || input.proof.size <= 0 || input.proof.size > 10_000_000 || !["image/png", "image/jpeg", "application/pdf"].includes(input.proof.type)) throw new Error("Attach a sample PNG, JPEG or PDF under 10 MB.");
    if (!/^[A-Za-z0-9._-]{4,48}$/.test(input.brokerReference?.trim() ?? "")) throw new Error("Enter a sample broker reference (4–48 letters, numbers, dots, hyphens or underscores).");
    if (!input.expectedCredit || input.expectedCredit <= 0 || input.expectedCredit !== cents(input.expectedCredit) || input.expectedCredit > input.amount || !input.reviewedProof) throw new Error("Confirm the expected credit and acknowledge that the broker balance has not been verified.");
    const methods = rail.id === "wire" ? ["Bank wire"] : account.broker === "exness" ? manualMethods : manualMethods.slice(0,1);
    if (!input.manualRail || !methods.some((method) => method === input.manualRail)) throw new Error("Choose a sample broker portal method for this profile.");
    details = { rail: rail.id === "wire" ? "wire" : "manual", method: input.manualRail, expectedCredit: input.expectedCredit };
  }
  if (rail.id === "ach") {
    if (!input.achAuthorized || !input.bankLabel || !Object.prototype.hasOwnProperty.call(sampleBanks,input.bankLabel)) throw new Error("Choose a sample bank relationship and acknowledge the authorization preview.");
    details = { rail: "ach", bankLabel: sampleBanks[input.bankLabel as keyof typeof sampleBanks] };
  }
  if (rail.id === "internal") {
    if (!input.internalWallet || !["Funding wallet", "Spot wallet"].includes(input.internalWallet)) throw new Error("Choose a sample source wallet.");
    details = { rail: "internal", wallet: input.internalWallet };
  }
  if (rail.id === "cashier") {
    if (!input.cashierWindow || ![15, 30, 60].includes(input.cashierWindow)) throw new Error("Choose a cashier matching window.");
    details = { rail: "cashier", matchingWindowMinutes: input.cashierWindow };
  }
  if (input.parentRef && !store.some((r) => r.ref === input.parentRef && r.failure)) throw new Error("The original deposit cannot be retried from this draft.");
  return latency({ account, rail, details, fee, amount: input.amount, total: cents(input.amount + fee), amountUSD: convertToUSD(input.amount, rail.currency), eta: rail.eta });
}
export type DepositQuote = Awaited<ReturnType<typeof previewDeposit>>;
export async function requestDeposit(input: DepositInput) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 100) throw new Error("Missing deposit request identifier.");
  const existing = store.find((entry) => entry.idempotencyKey === input.idempotencyKey);
  if (existing) {
    if (existing.accountId !== input.accountId || existing.rail !== input.rail || existing.amountNative !== input.amount) throw new Error("This request identifier belongs to a different deposit.");
    return latency(existing);
  }
  const quote = await previewDeposit(input);
  // Both callers may validate concurrently. Re-check immediately before the synchronous write.
  const duplicate = store.find((entry) => entry.idempotencyKey === input.idempotencyKey);
  if (duplicate) {
    if (duplicate.accountId !== input.accountId || duplicate.rail !== input.rail || duplicate.amountNative !== input.amount) throw new Error("This request identifier belongs to a different deposit.");
    return latency(duplicate);
  }
  const simulated = quote.rail.id === "paper";
  const now = new Date().toISOString(), ref = `OS-FIN-${String(++seq).padStart(6, "0")}`;
  const row: DepositRecord = { id: uuid(), ref, type: "DEPOSIT", accountId: quote.account.id, accountLabel: quote.account.label, broker: quote.account.broker, rail: quote.rail.id, amountNative: quote.amount, currencyNative: quote.rail.currency, amountUSD: quote.amountUSD, fee: quote.fee, status: simulated ? "CONFIRMED" : "INITIATED", origin: simulated ? "Simulated" : "Preview", initiatedAt: now, idempotencyKey: input.idempotencyKey, details: quote.details, network: quote.rail.id === "crypto" ? input.network : undefined, confirmations: quote.rail.id === "crypto" ? 0 : undefined, parentRef: input.parentRef, brokerRef: quote.rail.mode === "Proof required" ? input.brokerReference?.trim() : undefined };
  if (simulated) {
    const remaining = applySimulatedFunding(row.accountId, row.amountNative);
    row.settledAt = now; row.ledgerRef = ref.replace("FIN", "LED");
    postFinanceLedger({ id: row.ledgerRef, txType: "DEPOSIT", currencyNative: row.currencyNative, debitAccountId: "paper-funding-clearing", creditAccountId: row.accountId, accountLabel: row.accountLabel, amountNative: row.amountNative, amountUSD: row.amountUSD, sourceRef: row.ref, postedAt: now, balanceAfterCredit: remaining, memo: "Balanced simulator-only funding entry", origin: "Simulated" });
  } else if (input.proof && quote.rail.mode === "Proof required") {
    row.proof = { id: uuid(), label: "Local proof attachment" };
    proofs.set(row.proof.id, input.proof);
  }
  store.unshift(row);
  if (simulated) publishNotice({event:"deposit.confirmed",title:"Paper deposit confirmed",body:"A Paper top-up was posted to the local ledger. No funds moved.",ref:row.ref,id:`deposit.confirmed:${row.ref}`,accountLabel:row.accountLabel});
  return latency(row);
}
export async function getDepositProof(id: string) {
  const file = proofs.get(id);
  if (!file) throw new Error("The sample record has no downloadable attachment.");
  await latency(null);
  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/jpeg" ? "jpg" : "png";
  return { blob: file, filename: `ostrade-local-deposit-proof.${extension}` };
}
export function previewCashier() {
  return latency({ url: null, message: readyMessage, checks: ["Request a scoped hosted session", "Observe broker balance and transaction events", "Match amount and currency inside the selected window", "Store receipt and post to the ledger on confirmed credit" ] });
}
export function getCryptoPreferences() { return latency({ verifiedNetworks: [...whitelisted], ...tolerance }); }
export async function verifyDemoNetwork(input: { network: CryptoNetwork; code: string }) {
  if (!networkProfiles.some((n) => n.id === input.network) || input.code !== "000000") throw new Error("Enter the example code 000000. No email is sent.");
  whitelisted.add(input.network);
  return latency({ message: "Demo whitelist saved for this session. No email or real address was verified." });
}
export async function updateCryptoTolerance(input: typeof tolerance) {
  if (![input.underpaid, input.overpaid].every((n) => Number.isFinite(n) && n >= 0 && n <= 5)) throw new Error("Use tolerances from 0 to 5 percent.");
  tolerance = { ...input };
  return latency({ ...tolerance });
}
export function getDemoAddress(input: { network: CryptoNetwork; broker: "binance" | "deriv"; expired?: boolean }) {
  const network = networkProfiles.find((n) => n.id === input.network);
  if (!network) throw new Error("Choose a supported network.");
  const expired = !!input.expired;
  return latency({ network: network.id, required: network.required, confirmed: expired ? 0 : 8, mode: input.broker === "binance" ? "Reusable address model" : "Per-request address model", state: expired ? "Expired sample" : "Demo only", expires: input.broker === "binance" ? "Reusable model · verify before each future use" : `Example validity: ${network.ttl}`, address: `DEMO-NOT-PAYABLE-${input.broker.toUpperCase()}-${network.id}`, expired });
}
export async function recordRecoveryAction(input: { ref: string; action: RecoveryEvent["action"]; txHash?: string }) {
  const deposit = store.find((r) => r.ref === input.ref && r.failure);
  if (!deposit) throw new Error("This deposit is not in the recovery queue.");
  const allowed = deposit.failure === "Timeout" ? "Retry reviewed" : deposit.failure === "Agent unreachable" ? "Agent contact preview" : deposit.failure === "Broker rejection" ? "Support opened" : "Manual match staged";
  if (input.action !== allowed) throw new Error("This recovery action does not apply to the sample case.");
  if (input.action === "Manual match staged" && !/^(?:0x)?[a-f0-9]{64}$/i.test(input.txHash?.trim() ?? "")) throw new Error("Enter a 64-character sample hexadecimal transaction hash.");
  const detail = input.action === "Retry reviewed" ? "Retry reviewed; original deposit was not resubmitted." : input.action === "Support opened" ? "Official support link prepared; no account details were shared." : input.action === "Agent contact preview" ? "Reviewed sample agent handoff. No message or M-Pesa request sent." : "Sample hash format checked. Broker verification and ledger matching require the backend.";
  recoveryAudit.unshift({ id: uuid(), at: new Date().toISOString(), depositRef: deposit.ref, action: input.action, detail });
  return latency({ message: detail, url: input.action === "Support opened" ? supportUrls[deposit.broker] : undefined });
}
export async function exportDeposits(ids: string[]) {
  const entries = ids.flatMap((id) => store.find((r) => r.id === id) ?? []);
  if (!entries.length) throw new Error("No deposits match these filters.");
  const cells = [["Reference", "Initiated (EAT)", "Account", "Method", "Native amount", "Currency", "USD display", "Fee (native)", "Status", "Mode", "Broker reference", "Confirmed (EAT)", "Proof", "Ledger ref"], ...entries.map((r) => [r.ref, eatDateTime(Date.parse(r.initiatedAt)), r.accountLabel, fundingRails[r.rail].title, r.amountNative, r.currencyNative, r.amountUSD, r.fee, r.status, r.origin, r.brokerRef ?? "", r.settledAt ? eatDateTime(Date.parse(r.settledAt)) : "", r.proof?.label ?? "", r.ledgerRef ?? ""])];
  const text = cells.map((row) => row.map((cell) => typeof cell === "number" ? cell : `"${(/^[=+@\-\t\r\n]/.test(cell) ? `'${cell}` : cell).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  return latency({ text, filename: "ostrade-deposit-history.csv" });
}
