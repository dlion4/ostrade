import { readyMessage } from "@/data/accounts";
import { convertToUSD, depositAgents, sampleUsdKes, type CryptoNetwork } from "@/data/finance";
import { brokerWithdrawalRails, cryptoWithdrawalNetworks, defaultWithdrawalPolicy, initialWithdrawalAudit, initialWithdrawalDestinations, initialWithdrawals, nativeAmount, statusLabels, withdrawalRails, type WithdrawalAudit, type WithdrawalDestination, type WithdrawalPolicy, type WithdrawalRailId, type WithdrawalRecord } from "@/data/withdrawals";
import { applySimulatedWithdrawal, calculateWithdrawable, getAccounts, getLocalKillSwitch, WITHDRAWAL_MARGIN_GUARD, type TradingAccount } from "./dashboard";
import { getFinanceLedger, postFinanceLedger } from "./financeLedger";
import { getRailOverrides, getRailPreference } from "./fundingPolicy";
import { latency } from "./_latency";

export { cryptoWithdrawalNetworks, readyMessage, sampleUsdKes, statusLabels, withdrawalRails, nativeAmount, convertToUSD, WITHDRAWAL_MARGIN_GUARD };
export type { CryptoNetwork } from "@/data/finance";
export type { WithdrawalAudit, WithdrawalDestination, WithdrawalEvent, WithdrawalPolicy, WithdrawalRailId, WithdrawalRecord, WithdrawalStatus } from "@/data/withdrawals";
const hour = 3_600_000;
const records = structuredClone(initialWithdrawals);
const destinations = structuredClone(initialWithdrawalDestinations);
const events = structuredClone(initialWithdrawalAudit);
const proofs = new Map<string, File>();
let settings = { ...defaultWithdrawalPolicy };
let seq = 7500;
const uuid = () => crypto.randomUUID();
const round = (n: number) => Math.round(n * 100) / 100;
const validMoney = (n: number) => Number.isFinite(n) && n === round(n) && n > 0;
const at = (ms: number) => new Date(ms).toISOString();
export const withdrawalDateEAT = (iso: string) => `${at(Date.parse(iso) + 3 * hour).slice(0,19)}+03:00`;
const day = (ms: number) => at(ms + 3 * hour).slice(0,10);
const writeAudit = (event: Omit<WithdrawalAudit, "id" | "at">) => events.unshift({ id: uuid(), at: at(Date.now()), ...event });

function profile(account: TradingAccount) {
  const { margin, available } = calculateWithdrawable(account);
  const overrides=getRailOverrides(), preferred=getRailPreference(account.id)?.rail;
  const rails = brokerWithdrawalRails[account.broker].map(id => {
    const base=withdrawalRails[id], policy=overrides.find(p=>p.id===id);
    const min=policy?Math.max(base.min,policy.min):base.min, max=policy?Math.min(base.max,policy.max):base.max;
    const reason=policy && (!policy.enabled || min>max) ? "Disabled by the local funding policy. Use another eligible method." : id==="mpesa" && account.environment!=="live-ready" ? "Registered Kenya mobile requires an eligible real profile. Use manual proof for this demo profile." : undefined;
    return {...base,min,max,fee:policy?.fee??base.fee,eligible:!reason,reason};
  }).sort((x,y)=>+(preferred===y.id)-+(preferred===x.id));
  return { id: account.id, label: account.label, broker: account.broker, environment: account.environment, balance: account.balance, equity: account.equity, currency: account.currency, margin, marginPct: account.marginUsedPct, available, rails };
}
export type WithdrawalAccount = ReturnType<typeof profile>;
export async function getWithdrawalAccounts() { return (await getAccounts()).map(profile); }
export const getWithdrawalHistory = () => latency(records);
export const getWithdrawalAudit = () => latency(events);
export const getWithdrawalLedger = () => getFinanceLedger("WITHDRAW");
export const getWithdrawalPolicy = () => latency(settings);
const visibleState = (d: WithdrawalDestination, now: number): WithdrawalDestination["state"] => d.availableAt && Date.parse(d.availableAt) > now ? "Cooling" : "Approved sample";
export const getWithdrawalDestinations = () => latency(destinations.map(d => ({ ...d, state: visibleState(d, Date.now()) })));
export const getWithdrawalAgents = () => latency(depositAgents.filter(a => a.available).sort((a,b) => +(b.city === "Juja") - +(a.city === "Juja")));
export function getWithdrawalSummary() {
  const now = Date.now(), today = day(now), past = day(now - 6 * 24 * hour);
  const settled = records.filter(r => r.status === "SETTLED" && r.settledAt);
  return latency({ month: round(settled.filter(r => r.settledAt && r.settledAt <= at(now) && withdrawalDateEAT(r.settledAt).startsWith(today.slice(0,7))).reduce((sum,r) => sum + r.amountUSD,0)), pending: records.filter(r => ["REQUESTED", "OTP_VERIFIED", "SUBMITTED", "COOLING"].includes(r.status)).length, processing: records.filter(r => r.status === "PROCESSING").length, today: settled.filter(r => r.settledAt && r.settledAt <= at(now) && withdrawalDateEAT(r.settledAt).startsWith(today)).length, failed: records.filter(r => ["REJECTED", "REVERSED"].includes(r.status) && withdrawalDateEAT(r.timeline[r.timeline.length-1].at).slice(0,10) >= past).length });
}
export async function verifyWithdrawalFactor(input: { kind: "totp" | "otp"; code: string; channel?: "email" | "phone" }) {
  if (input.kind === "totp" && input.code !== "123456") throw new Error("Enter the example authenticator code 123456. Never enter a real code.");
  if (input.kind === "otp" && (input.code !== "000000" || !["email", "phone"].includes(input.channel ?? ""))) throw new Error("Choose a sample delivery channel and enter the example code 000000.");
  return latency({ message: input.kind === "totp" ? "Example authenticator code checked locally." : "Example OTP checked locally. Nothing was sent." });
}
export async function updateWithdrawalPolicy(input: { policy: WithdrawalPolicy; code: string }) {
  await verifyWithdrawalFactor({ kind: "totp", code: input.code });
  const p = input.policy;
  if (!validMoney(p.txCap) || p.txCap < 10 || !validMoney(p.dailyCap) || p.dailyCap > 100000 || p.txCap > p.dailyCap) throw new Error("Use $10 or more per transaction, with a 24-hour cap at least as high and no greater than $100,000.");
  if (!Number.isInteger(p.coolingHours) || p.coolingHours < 0 || p.coolingHours > 72 || !Number.isInteger(p.coolingThreshold) || p.coolingThreshold < 0 || p.coolingThreshold > 100000 || !["strict","warn"].includes(p.enforcement) || typeof p.pauseWhenHalted !== "boolean") throw new Error("Review the limits, whitelist mode, and cooling period (0–72 hours).");
  const describe = (policy: WithdrawalPolicy) => `$${policy.txCap} per request · $${policy.dailyCap} per 24h · ${policy.coolingHours}h above $${policy.coolingThreshold} · whitelist ${policy.enforcement} · halt gate ${policy.pauseWhenHalted ? "on" : "off"}`;
  const previous = describe(settings); settings = { ...p };
  writeAudit({ action: "Safety policy updated", outcome: "Simulated", request: `Previous: ${previous}`, result: `New: ${describe(settings)}. Example TOTP checked locally.` });
  return latency(settings);
}
export async function addWithdrawalDestination(input: { label: string; network: CryptoNetwork; otp: string }) {
  await verifyWithdrawalFactor({ kind: "otp", code: input.otp, channel: "email" });
  const label = input.label.trim(), network = cryptoWithdrawalNetworks.find(n => n.id === input.network);
  if (!network || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,29}$/u.test(label) || destinations.some(d => d.label.toLowerCase() === label.toLowerCase())) throw new Error("Enter a unique sample label (2–30 letters, numbers, spaces, or ._-). No wallet addresses are accepted.");
  const id = uuid();
  const item: WithdrawalDestination = { id, label, masked: `DEMO ${network.id} •••• ${id.slice(0,4).toUpperCase()}`, kind: "crypto", network: network.id, state: "Cooling", origin: "Preview", availableAt: at(Date.now() + 24 * hour) };
  destinations.unshift(item);
  writeAudit({ action: "Destination staged", outcome: "Held", request: `New sample destination · ${item.masked}`, result: "Example OTP checked. 24h local destination hold starts; no real address was enrolled." });
  return latency(item);
}

export interface WithdrawalInput {
  accountId: string; rail: WithdrawalRailId; amount: number; idempotencyKey: string;
  destinationId?: string; network?: CryptoNetwork; agentId?: string; warningAccepted?: boolean;
  proof?: File; brokerReference?: string; proofAcknowledged?: boolean; manualPath?: "checklist" | "proof";
}
export type ConfirmWithdrawalInput = WithdrawalInput & { totp: string; otp: string; channel: "email" | "phone"; acknowledgeCooling: boolean };
function resolveQuote(input: WithdrawalInput, account: WithdrawalAccount | undefined, now: number) {
  const rail = account?.rails.find(r => r.id === input.rail);
  if (!account || !rail) throw new Error("This method is unavailable for the selected account.");
  if (!rail.eligible) throw new Error(rail.reason);
  if (settings.pauseWhenHalted && getLocalKillSwitch() !== "armed") throw new Error("Withdrawals are blocked while the kill switch is paused or flattened.");
  let fee = rail.fee, min = rail.min, max = rail.max, eta = rail.eta;
  let method: string | undefined;
  const network = input.rail === "crypto" ? cryptoWithdrawalNetworks.find(n => n.id === input.network) : undefined;
  if (input.rail === "crypto") {
    if (!network) throw new Error("Choose a sample crypto network.");
    fee = round(network.fee + (getRailOverrides().find(p=>p.id==="crypto")?.fee ?? 0)); eta = network.eta;
  }
  if (input.rail === "mpesa") {
    const agent = depositAgents.find(a => a.id === input.agentId && a.available);
    if (!agent) throw new Error("Select an available sample Kenya agent.");
    fee = getRailOverrides().find(p=>p.id==="mpesa")?.fee ?? agent.fee; min = Math.max(agent.min,rail.min); max = Math.min(agent.max,rail.max); method = agent.name;
  }
  if (!validMoney(input.amount) || input.amount < min || input.amount > max || input.amount <= fee) throw new Error(`Enter ${rail.currency} ${min.toLocaleString("en-US")}–${max.toLocaleString("en-US")} with up to two decimals. The amount must exceed the fee.`);
  const exactUSD = rail.currency === "KES" ? input.amount / sampleUsdKes : input.amount;
  const amountUSD = convertToUSD(input.amount, rail.currency);
  if (exactUSD > account.available) throw new Error(`This would exceed the withdrawable balance or breach the ${WITHDRAWAL_MARGIN_GUARD*100}% margin guard.`);
  if (exactUSD > settings.txCap) throw new Error(`This exceeds the $${settings.txCap.toLocaleString("en-US")} per-request limit.`);
  const used = records.filter(r => r.accountId === account.id && r.origin !== "Snapshot" && Date.parse(r.initiatedAt) > now - 24*hour).reduce((n,r) => n + (r.currencyNative === "KES" ? r.amountNative / sampleUsdKes : r.amountNative),0);
  if (used + exactUSD > settings.dailyCap + 1e-8) throw new Error("This account would exceed its rolling 24-hour withdrawal cap. Recent previews and Paper requests count toward the local cap.");
  const kind = input.rail === "crypto" ? "crypto" : input.rail === "ach" ? "bank" : input.rail === "mpesa" ? "phone" : input.rail === "paper" ? "simulation" : "portal";
  const dest = destinations.find(d => d.id === input.destinationId && d.kind === kind && (kind !== "crypto" || d.network === network?.id));
  let masked: string;
  if (!dest) {
    if (kind !== "crypto" || settings.enforcement !== "warn" || input.destinationId !== "unsaved-demo" || !input.warningAccepted) throw new Error("Choose an approved sample destination for this method and network.");
    masked = `Unlisted DEMO ${network?.id} •••• TEST`;
  } else {
    if (visibleState(dest, now) === "Cooling") throw new Error("This destination is still in its 24-hour hold. Choose an approved sample destination.");
    masked = dest.masked;
  }
  if (input.rail === "manual") {
    if (!input.proofAcknowledged || !["checklist", "proof"].includes(input.manualPath ?? "")) throw new Error("Acknowledge that the broker balance and proof are not verified.");
    method = input.manualPath === "proof" ? "Sample proof for review" : "Broker portal checklist";
    if (input.manualPath === "proof") {
      if (!input.proof || input.proof.size <= 0 || input.proof.size > 10_000_000 || !["image/png","image/jpeg","application/pdf"].includes(input.proof.type)) throw new Error("Attach a sample PNG, JPEG or PDF, max 10 MB.");
      if (!/^[a-z0-9._-]{4,48}$/i.test(input.brokerReference?.trim() ?? "")) throw new Error("Enter a sample broker reference (4–48 letters, numbers, dots, hyphens or underscores).");
    }
  }
  const cooling = exactUSD > settings.coolingThreshold ? settings.coolingHours : 0;
  return { account, rail, fee, eta, min, max, method, network: network?.id, amount: input.amount, amountUSD, net: round(input.amount - fee), masked, cooling, marginAfter: account.margin / Math.max(1, account.equity - exactUSD) * 100, remaining24h: round(Math.max(0, settings.dailyCap - used)) };
}
export type WithdrawalQuote = ReturnType<typeof resolveQuote>;
export async function previewWithdrawal(input: WithdrawalInput) {
  const accounts = await getWithdrawalAccounts();
  return latency(resolveQuote(input, accounts.find(a => a.id === input.accountId), Date.now()));
}
export async function requestWithdrawal(input: ConfirmWithdrawalInput) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 100 || input.idempotencyKey.startsWith("sample-")) throw new Error("Missing withdrawal request key.");
  if (input.totp !== "123456" || input.otp !== "000000" || (!["email","phone"].includes(input.channel) || (input.rail === "mpesa" && input.channel !== "phone"))) throw new Error("Complete both example security checks using the required channel.");
  const replay = () => {
    const row = records.find(r => r.idempotencyKey === input.idempotencyKey);
    if (row && (row.rail !== input.rail || row.amountNative !== input.amount || row.accountId !== input.accountId)) throw new Error("This request key belongs to a different withdrawal.");
    return row;
  };
  const prior = replay(); if (prior) return latency(prior);
  const accounts = await getWithdrawalAccounts();
  // No await from re-check through debit, ledger and history writes.
  const duplicate = replay(); if (duplicate) return latency(duplicate);
  const time = Date.now(), now = at(time);
  const quote = resolveQuote(input, accounts.find(a => a.id === input.accountId), time);
  if (!input.acknowledgeCooling) throw new Error("Acknowledge the cooling and offline execution policy.");
  const number = String(++seq).padStart(6,"0"), ref = `OS-FIN-${number}`;
  const simulate = quote.rail.id === "paper" && quote.cooling === 0;
  const status = simulate ? "SETTLED" : quote.cooling ? "COOLING" : "READY";
  const message = simulate ? "Simulated balance and equity debited. No money moved." : quote.cooling ? "Cooling hold recorded locally. Nothing is sent or automatically released when the hold ends." : readyMessage;
  const row: WithdrawalRecord = { id: uuid(), ref, type: "WITHDRAW", accountId: quote.account.id, accountLabel: quote.account.label, broker: quote.account.broker, rail: quote.rail.id, amountNative: quote.amount, currencyNative: quote.rail.currency, amountUSD: quote.amountUSD, fee: quote.fee, receiveNative: quote.net, destinationMasked: quote.masked, status, origin: simulate ? "Simulated" : "Preview", initiatedAt: now, idempotencyKey: input.idempotencyKey, network: quote.network, method: quote.method, message, coolingUntil: quote.cooling ? at(time + quote.cooling*hour) : undefined, timeline: [{ status: "REQUESTED", at: now, note: "Local withdrawal request recorded." }, { status: "OTP_VERIFIED", at: now, note: "Example TOTP and OTP checked locally; no message was sent." }, { status, at: now, note: message }] };
  if (simulate) {
    const balance = applySimulatedWithdrawal(row.accountId, row.amountNative);
    row.settledAt = now; row.settlementRef = `OS-SET-${number}`; row.ledgerRef = `OS-LED-${number}`;
    postFinanceLedger({ id: row.ledgerRef, txType: "WITHDRAW", currencyNative: row.currencyNative, debitAccountId: row.accountId, creditAccountId: "paper-withdrawal-clearing", amountNative: row.amountNative, amountUSD: row.amountUSD, sourceRef: ref, accountLabel: row.accountLabel, postedAt: now, memo: "Balanced simulator-only withdrawal entry", origin: "Simulated", balanceAfterDebit: balance });
  } else if (input.rail === "manual" && input.manualPath === "proof" && input.proof) {
    row.proof = { id: uuid(), label: "Local sample attachment" };
    row.brokerRef = input.brokerReference?.trim();
    proofs.set(row.proof.id, input.proof);
  }
  records.unshift(row);
  writeAudit({ action: simulate ? "Paper debit posted" : "Request staged", ref, outcome: simulate ? "Simulated" : quote.cooling ? "Held" : "Offline", request: `${quote.account.label} · ${quote.rail.name} · ${row.currencyNative} ${row.amountNative.toFixed(2)} · ${row.destinationMasked}`, result: message });
  return latency(row);
}
export async function previewDerivWithdrawal(input: { accountId: string; rail: "deriv-api" | "mpesa" | "cashier"; amount: number }) {
  const account = (await getWithdrawalAccounts()).find(a => a.id === input.accountId && a.broker === "deriv");
  if (!account) throw new Error("Choose a Deriv profile.");
  const rail = account.rails.find(r => r.id === input.rail);
  if (!rail) throw new Error("Choose a Deriv withdrawal method.");
  if (!validMoney(input.amount) || input.amount < rail.min || input.amount > rail.max) throw new Error(`Enter a sample ${rail.currency} amount from ${rail.min} to ${rail.max}.`);
  const checks = [{ title: "Identity verification", state: "Backend required", note: "No KYC state was obtained." }, { title: "Turnover and payment method", state: "Backend required", note: "Origin-of-funds rules would be checked before submitting." }, { title: "Profile and method", state: rail.eligible ? "Previewable" : "Restricted", note: rail.reason ?? "Sample method is available to preview only." }, { title: "Amount and margin", state: convertToUSD(input.amount,rail.currency) <= account.available ? "Within snapshot" : "Over snapshot", note: "Uses static broker-profile balances, not live eligibility." }];
  writeAudit({ action: input.rail === "cashier" ? "Cashier handoff preview" : "Deriv preflight", outcome: "Offline", request: `${account.label} · ${rail.name} · ${rail.currency} ${input.amount.toFixed(2)}`, result: `${checks.map(c => `${c.title}: ${c.state}`).join(" · ")}. No broker request or hosted session.` });
  return latency({ checks, url: null, message: readyMessage, canDraft: rail.eligible && convertToUSD(input.amount,rail.currency) <= account.available });
}
export async function previewDerivStatus(ref: string) {
  const row = records.find(r => r.ref === ref && r.broker === "deriv");
  if (!row) throw new Error("Choose a Deriv withdrawal reference.");
  writeAudit({ action: "Deriv status preview", outcome: "Offline", request: `Inspect ${row.ref} · ${row.destinationMasked}`, result: `Local record: ${statusLabels[row.status]}. No transaction stream subscribed.`, ref });
  return latency({ message: "Status replay only. There is no broker polling or transaction stream.", timeline: row.timeline });
}
export async function getWithdrawalProof(id: string) {
  const file = proofs.get(id);
  if (!file) throw new Error("No document is attached to this sample.");
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  await latency(null); return { blob: file, filename: `ostrade-sample-withdrawal-proof.${ext}` };
}
export async function exportWithdrawals(ids: string[]) {
  const rows = ids.flatMap(id => records.find(r => r.id === id) ?? []);
  if (!rows.length) throw new Error("No withdrawal records to export.");
  const quote = (value: string | number) => typeof value === "number" ? value : `"${(/^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value).replace(/"/g,'""')}"`;
  const data = [["Reference", "Initiated (EAT)", "Account", "Rail", "Amount", "Currency", "USD display", "Fee", "Net", "Masked destination", "Status", "Origin", "Broker reference", "Settlement reference", "Settled (EAT)", "Ledger reference"], ...rows.map(r => [r.ref, withdrawalDateEAT(r.initiatedAt), r.accountLabel, withdrawalRails[r.rail].name, r.amountNative, r.currencyNative, r.amountUSD, r.fee, r.receiveNative, r.destinationMasked, statusLabels[r.status], r.origin, r.brokerRef ?? "", r.settlementRef ?? "", r.settledAt ? withdrawalDateEAT(r.settledAt) : "", r.ledgerRef ?? ""])];
  return latency({ text: data.map(row => row.map(quote).join(",")).join("\r\n"), filename: "ostrade-withdrawals.csv" });
}
export async function downloadWithdrawalReceipt(id: string) {
  const r = records.find(row => row.id === id && row.status === "SETTLED");
  if (!r) throw new Error("A receipt preview exists only for settled records.");
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(22); doc.text("OStrade | Withdrawal record", 16, 22);
  doc.setFontSize(11); doc.text(r.origin === "Snapshot" ? "SAMPLE SNAPSHOT - NOT A PAYMENT RECEIPT" : "PAPER SIMULATION - NO MONEY MOVED",16,33);
  let y = 48;
  for (const line of [`Reference: ${r.ref}`, `Account: ${r.accountLabel}`, `Method: ${withdrawalRails[r.rail].name}`, `Amount: ${r.currencyNative} ${r.amountNative.toFixed(2)}`, `Fee / net: ${r.fee.toFixed(2)} / ${r.receiveNative.toFixed(2)}`, `Destination: ${r.destinationMasked.replace(/•/g,"*")}`, `Settled (EAT): ${withdrawalDateEAT(r.settledAt!)}`, `Settlement reference: ${r.settlementRef}`, `Ledger reference: ${r.ledgerRef}`]) { const lines = doc.splitTextToSize(line, 175) as string[]; doc.text(lines, 16, y); y += 7 * lines.length; }
  return latency({ bytes: new Uint8Array(doc.output("arraybuffer")), filename: `ostrade-${r.ref.toLowerCase()}-withdrawal.pdf` });
}
