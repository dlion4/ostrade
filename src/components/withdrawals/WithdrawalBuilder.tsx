import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Clock3, FlaskConical, LockKeyhole } from "lucide-react";
import { convertToUSD, cryptoWithdrawalNetworks, getWithdrawalAgents, getWithdrawalDestinations, getWithdrawalPolicy, nativeAmount, previewWithdrawal, requestWithdrawal, sampleUsdKes, verifyWithdrawalFactor, WITHDRAWAL_MARGIN_GUARD, type CryptoNetwork, type WithdrawalAccount, type WithdrawalInput, type WithdrawalRailId, type WithdrawalRecord } from "@/services/withdrawals";
import { amountLabel, Badge, Busy, CodeField, Dialog, eat, errorText, Note, RailTag, whole } from "./WithdrawalUI";
export type BuilderStart = { accountId?: string; rail?: WithdrawalRailId; amount?: number; network?: CryptoNetwork; destinationId?: string };
const steps = ["Account", "Amount", "Destination", "Safety"];
export function WithdrawalBuilder({ accounts, start, close, view }: { accounts: WithdrawalAccount[]; start: BuilderStart; close: () => void; view: (row: WithdrawalRecord) => void }) {
  const [index, setIndex] = useState(0), [safety, setSafety] = useState(0);
  const [accountId, setAccount] = useState(start.accountId ?? accounts[0]?.id ?? "");
  const account = accounts.find(a => a.id === accountId);
  const [railId, setRail] = useState(start.rail ?? account?.rails.find(r => r.eligible)?.id ?? "manual");
  const rail = account?.rails.find(r => r.id === railId);
  const [amount, setAmount] = useState(start.amount?.toString() ?? "");
  const [destination, setDestination] = useState(start.destinationId ?? "");
  const [network, setNetwork] = useState<CryptoNetwork>(start.network ?? "TRC20");
  const [agent, setAgent] = useState("");
  const [warning, setWarning] = useState(false);
  const [manualPath, setManualPath] = useState<"checklist" | "proof">("checklist");
  const [proof, setProof] = useState<File>();
  const [brokerRef, setBrokerRef] = useState("");
  const [proofAck, setProofAck] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const [totp, setTotp] = useState(""), [otp, setOtp] = useState("");
  const [channel, setChannel] = useState<"phone" | "email">(railId === "mpesa" ? "phone" : "email");
  const [ack, setAck] = useState(false);
  const [failure, setFailure] = useState("");
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["withdrawal-destinations"], queryFn: getWithdrawalDestinations });
  const agents = useQuery({ queryKey: ["withdrawal-agents"], queryFn: getWithdrawalAgents, enabled: railId === "mpesa" });
  const policy = useQuery({ queryKey: ["withdrawal-policy"], queryFn: getWithdrawalPolicy });
  const kind = railId === "crypto" ? "crypto" : railId === "ach" ? "bank" : railId === "mpesa" ? "phone" : railId === "paper" ? "simulation" : "portal";
  const options = saved.data?.filter(d => d.kind === kind && (kind !== "crypto" || d.network === network)) ?? [];
  const chosen = options.length === 1 && !destination ? options[0].id : destination;
  const currentAgent = agents.data?.find(a => a.id === agent);
  const selectedNetwork = cryptoWithdrawalNetworks.find(n => n.id === network);
  const input = (): WithdrawalInput => ({ accountId, rail: railId, amount: Number(amount), idempotencyKey: key, destinationId: chosen, network, agentId: agent, warningAccepted: warning, manualPath, proof, brokerReference: brokerRef, proofAcknowledged: proofAck });
  // Never put codes or the draft proof into the query/mutation cache as variables.
  const quote = useMutation({ mutationFn: () => previewWithdrawal(input()) });
  const factor = useMutation({ mutationFn: (kind: "totp" | "otp") => verifyWithdrawalFactor({ kind, code: kind === "totp" ? totp : otp, channel }) });
  const submit = useMutation({ mutationFn: () => requestWithdrawal({ ...input(), totp, otp, channel, acknowledgeCooling: ack }), onSuccess: row => {
    setOtp(""); setTotp(""); setProof(undefined);
    const keys = ["withdrawal-history", "withdrawal-summary", "withdrawal-audit", "withdrawal-ledger", "account-finance", "account-detail", ...(row.origin === "Simulated" ? ["accounts", "withdrawal-accounts", "funding-accounts"] : [])];
    keys.forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
  } });
  const busy = quote.isPending || factor.isPending || submit.isPending;
  function changeRail(id: WithdrawalRailId) { setRail(id); setDestination(""); setAmount(""); setAgent(""); setWarning(false); setProof(undefined); setManualPath("checklist"); setProofAck(false); setBrokerRef(""); setChannel(id === "mpesa" ? "phone" : "email"); }
  async function next(e: FormEvent) {
    e.preventDefault(); setFailure("");
    try {
      if (index < 2) { if (!rail?.eligible) throw new Error("Choose an available rail or use manual proof."); setIndex(index+1); return; }
      if (index === 2) { await quote.mutateAsync(); setSafety(0); setIndex(3); return; }
      if (safety < 2) { await factor.mutateAsync(safety === 0 ? "totp" : "otp"); setSafety(safety+1); return; }
      await submit.mutateAsync();
    } catch (err) { setFailure(errorText(err)); }
  }
  const back = () => { setFailure(""); if (index === 3) { if (safety > 0) { setSafety(safety-1); setAck(false); return; } setTotp(""); setOtp(""); setAck(false); } if (index) setIndex(index-1); else close(); };
  const result = submit.data;
  const fee = railId === "crypto" ? selectedNetwork?.fee : railId === "mpesa" ? currentAgent?.fee : rail?.fee;
  return <Dialog title="New withdrawal" kicker="SECURE OUTFLOW BUILDER" close={close} drawer busy={busy}>
    {result ? <div className="os-wd-flow"><div className="os-wd-outcome"><span>{result.origin === "Simulated" ? <FlaskConical size={26} /> : result.coolingUntil ? <Clock3 size={26} /> : <LockKeyhole size={26} />}</span><Badge tone={result.origin === "Simulated" ? "green" : "blue"}>{result.origin === "Simulated" ? "SIMULATED" : "OFFLINE PREVIEW"}</Badge><h3>{result.origin === "Simulated" ? "Paper withdrawal settled" : result.coolingUntil ? "Cooling hold recorded" : "Withdrawal preview staged"}</h3><p>{result.message}</p><code>{result.ref}</code></div>{result.coolingUntil && <Note>Example hold ends {eat(result.coolingUntil)} EAT. No automatic release.</Note>}<div className="os-wd-actions"><button type="button" className="btn os-wd-btn" onClick={close}>Done</button><button type="button" className="btn os-wd-btn os-wd-primary" onClick={() => view(result)}>View withdrawal record</button></div></div> : <>
    <ol className="os-wd-stepper" aria-label="Withdrawal progress">{steps.map((s,i) => <li key={s} aria-current={i === index ? "step" : undefined}><span>{i < index ? <Check size={12} /> : i+1}</span>{s}</li>)}</ol>
    <form className="os-wd-flow" onSubmit={e => void next(e)}>
      {index === 0 && <><label className="os-wd-field"><span>Source account</span><select className="form-select" value={accountId} onChange={e => { setAccount(e.target.value); changeRail(accounts.find(a => a.id === e.target.value)?.rails.find(r => r.eligible)?.id ?? "manual"); }}>{accounts.map(a => <option key={a.id} value={a.id}>{a.label} · {a.broker === "paper" ? "Simulation" : "Offline profile"}</option>)}</select></label>
      <fieldset className="os-wd-flow"><legend>Withdrawal method</legend>{account?.rails.map(r => <label className="os-wd-rail-option" key={r.id}><input className="form-check-input" name="withdrawal-rail" type="radio" checked={railId === r.id} disabled={!r.eligible} onChange={() => changeRail(r.id)} /><span><RailTag id={r.id} /><small>{r.reason ?? r.note}</small></span><Badge tone={r.id === "paper" ? "green" : "neutral"}>{r.eligible ? r.mode : "Use manual"}</Badge></label>)}</fieldset></>}
      {index === 1 && rail && account && <><div className="os-wd-quote-inline"><span>Withdrawable snapshot</span><strong>{amountLabel(nativeAmount(account.available,rail.currency),rail.currency)}</strong></div><Note>Equity {amountLabel(account.equity,account.currency)} · margin used {account.marginPct.toFixed(1)}%. Amount is blocked if post-withdrawal margin would exceed {WITHDRAWAL_MARGIN_GUARD*100}%.</Note><label className="os-wd-field"><span>Withdrawal amount ({rail.currency})</span><input type="number" inputMode="decimal" className="form-control" min={rail.min} max={Math.min(rail.max,Math.floor(nativeAmount(Math.min(account.available,policy.data?.txCap ?? Infinity),rail.currency)*100)/100)} step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} /></label><small>Method limits: {whole(rail.min,rail.currency)}–{whole(rail.max,rail.currency)} · Display estimate {amountLabel(convertToUSD(Number(amount) || 0,rail.currency))} USD. {rail.currency === "KES" ? `Sample FX: ${sampleUsdKes} KES per USD.` : rail.currency === "USDT" ? "Sample rate: 1 USDT = 1 USD." : "No live FX."}</small></>}
      {index === 2 && rail && <>
        {railId === "crypto" && <label className="os-wd-field"><span>Crypto network</span><select className="form-select" value={network} onChange={e => { setNetwork(e.target.value as CryptoNetwork); setDestination(""); setWarning(false); }}>{cryptoWithdrawalNetworks.map(n => <option key={n.id} value={n.id}>{n.id} · {n.name}</option>)}</select></label>}
        {railId === "mpesa" && <label className="os-wd-field"><span>Sample Kenya payment agent</span><select className="form-select" value={agent} onChange={e => setAgent(e.target.value)} required><option value="">{agents.isPending ? "Loading agents…" : "Choose an agent"}</option>{agents.data?.map(a => <option key={a.id} value={a.id}>{a.name} · fee {a.fee} KES</option>)}</select>{currentAgent && <small>Agent limit: {whole(currentAgent.min,"KES")}–{whole(currentAgent.max,"KES")}.</small>}</label>}
        <label className="os-wd-field"><span>{kind === "phone" ? "Registered sample mobile" : kind === "bank" ? "Approved sample bank" : kind === "crypto" ? "Sample withdrawal address" : "Masked destination"}</span><select className="form-select" required value={chosen} onChange={e => { setDestination(e.target.value); setWarning(false); }}><option value="">{saved.isPending ? "Loading sample destinations…" : "Choose a destination"}</option>{options.map(d => <option key={d.id} value={d.id} disabled={d.state === "Cooling"}>{d.label} · {d.masked}{d.state === "Cooling" ? " · Cooling" : ""}</option>)}{kind === "crypto" && policy.data?.enforcement === "warn" && <option value="unsaved-demo">Unlisted demo destination</option>}</select></label>
        {chosen === "unsaved-demo" && <label className="os-wd-check"><input type="checkbox" className="form-check-input" checked={warning} onChange={e => setWarning(e.target.checked)} required /> Acknowledge the unlisted destination warning. This is a synthetic preview only.</label>}
        {kind === "phone" && <Note>This registered sample mobile is used for the phone OTP preview. No message is sent.</Note>}
        {railId === "manual" && <><label className="os-wd-field"><span>Manual flow</span><select className="form-select" value={manualPath} onChange={e => setManualPath(e.target.value as typeof manualPath)}><option value="checklist">Preview broker portal checklist</option><option value="proof">Attach sample proof for review</option></select></label>{manualPath === "proof" && <><label className="os-wd-field"><span>Sample broker reference</span><input className="form-control" value={brokerRef} onChange={e => setBrokerRef(e.target.value)} minLength={4} maxLength={48} placeholder="DEMO-WD-101" required /></label><label className="os-wd-field"><span>Sample proof (PNG, JPEG or PDF, max 10 MB)</span><input type="file" className="form-control" accept="image/png,image/jpeg,application/pdf" required={!proof} onChange={e => setProof(e.target.files?.[0])} /></label></>}{manualPath === "checklist" && <div className="os-wd-inset">Confirm the original funding method in the broker portal, obtain a receipt, and reconcile only after the broker confirms. No portal session starts here.</div>}<label className="os-wd-check"><input type="checkbox" className="form-check-input" checked={proofAck} onChange={e => setProofAck(e.target.checked)} required /> I understand that neither the proof nor broker balance is verified.</label></>}
        <div className="os-wd-quote-inline"><span>Static fee: {fee === undefined ? "Select agent" : amountLabel(fee,rail.currency)}</span><strong>Receive {fee === undefined ? "—" : amountLabel(Math.max(0,Number(amount)-fee),rail.currency)}</strong></div>
      </>}
      {index === 3 && quote.data && <><div className="os-wd-safety-steps" aria-label="Safety ladder">{["Authenticator", "Delivery code", "Review & hold"].map((x,i) => <Badge key={x} tone={i < safety ? "green" : i === safety ? "orange" : "neutral"}>{i+1}. {x}</Badge>)}</div>
        {safety === 0 && <CodeField title="Demo authenticator code (TOTP)" value={totp} set={setTotp} example="123456" />}
        {safety === 1 && <><label className="os-wd-field"><span>Sample delivery channel</span><select className="form-select" value={channel} disabled={railId === "mpesa"} onChange={e => { setChannel(e.target.value as typeof channel); setOtp(""); }}><option value="email">Demo email · a•••@example.test</option><option value="phone">Demo mobile · +254 7•• ••• 024</option></select></label><CodeField title="Example delivery OTP" example="000000" value={otp} set={setOtp} /><Note>No email or SMS is sent. This is a local code check only.</Note></>}
        {safety === 2 && <><dl className="os-wd-review"><div><dt>Source account</dt><dd>{quote.data.account.label}</dd></div><div><dt>Method</dt><dd><RailTag id={quote.data.rail.id} /></dd></div><div><dt>Masked destination</dt><dd>{quote.data.masked}</dd></div><div><dt>Amount / estimated fee</dt><dd>{amountLabel(quote.data.amount,quote.data.rail.currency)} / {amountLabel(quote.data.fee,quote.data.rail.currency)}</dd></div><div><dt>Net receive</dt><dd>{amountLabel(quote.data.net,quote.data.rail.currency)}</dd></div><div><dt>Remaining 24-hour cap before request</dt><dd>{amountLabel(quote.data.remaining24h)}</dd></div><div><dt>Estimated margin after</dt><dd>{quote.data.marginAfter.toFixed(1)}%</dd></div><div><dt>Example ETA</dt><dd>{quote.data.eta}</dd></div><div><dt>Cooling period</dt><dd>{quote.data.cooling ? `${quote.data.cooling} hours` : "No hold"}</dd></div>{quote.data.method && <div><dt>Method detail</dt><dd>{quote.data.method}</dd></div>}</dl><Note>{quote.data.cooling ? "This only records a hold. Nothing moves, and it never releases automatically." : railId === "paper" ? "Only the local Paper balance and equity change. Trading P&L is unaffected." : "This stages an offline preview, not a bank or broker instruction."}</Note><label className="os-wd-check"><input type="checkbox" className="form-check-input" checked={ack} onChange={e => setAck(e.target.checked)} required /> I understand the cooling and execution policy.</label></>}
      </>}
      {failure && <Note danger>{failure}</Note>}
      <div className="os-wd-drawer-actions"><button type="button" className="btn os-wd-btn" disabled={busy} onClick={back}>{index > 0 && <ArrowLeft size={15} />}{index ? "Back" : "Cancel"}</button><button type="submit" className="btn os-wd-btn os-wd-primary" disabled={busy || !rail?.eligible || (index === 2 && saved.isPending)}>{busy ? <Busy>Checking…</Busy> : index < 2 ? <>Continue <ArrowRight size={15} /></> : index === 2 ? <>Start safety checks <ArrowRight size={15} /></> : safety === 0 ? "Check example authenticator" : safety === 1 ? "Check example OTP" : quote.data?.cooling ? "Record cooling hold" : railId === "paper" ? "Simulate withdrawal" : "Stage withdrawal preview"}</button></div>
    </form></>}
  </Dialog>;
}
