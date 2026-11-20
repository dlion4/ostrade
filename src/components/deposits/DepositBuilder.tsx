import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CircleCheck, FileText, FlaskConical, LockKeyhole, ShieldCheck } from "lucide-react";
import { convertToUSD, getKenyaAgents, manualMethods, previewDeposit, readyMessage, requestDeposit, sampleBanks, sampleUsdKes, type CryptoNetwork, type DepositInput, type DepositRailId, type DepositRecord, type FundingAccount } from "@/services/deposits";
import { amountLabel, Badge, Busy, Dialog, errorText, MethodDetails, Note, RailTag, whole } from "./DepositUI";
import { CryptoPreview } from "./CryptoPreview";

export type BuilderStart = { accountId?: string; rail?: DepositRailId; amount?: number; agentId?: string; parentRef?: string };
const labels = ["Account & rail", "Amount", "Details", "Review"];
export function DepositBuilder({ accounts, start, close, view }: { accounts: FundingAccount[]; start: BuilderStart; close: () => void; view: (row: DepositRecord) => void }) {
  const [step, setStep] = useState(0);
  const [accountId, setAccountId] = useState(start.accountId ?? accounts[0]?.id ?? "");
  const account = accounts.find((a) => accountId === a.id);
  const [railId, setRail] = useState<DepositRailId>(start.rail ?? account?.rails[0]?.id ?? "paper");
  const rail = account?.rails.find((r) => r.id === railId);
  const [amount, setAmount] = useState(start.amount?.toString() ?? "");
  const [key, setKey] = useState(() => globalThis.crypto.randomUUID());
  const [agentId, setAgent] = useState(start.agentId ?? "");
  const [phone, setPhone] = useState("");
  const [phoneConfirm, setPhoneConfirm] = useState(false);
  const [windowMinutes, setWindowMinutes] = useState(30);
  const [network, setNetwork] = useState<CryptoNetwork>("TRC20");
  const [cryptoAck, setCryptoAck] = useState(false);
  const [proof, setProof] = useState<File>();
  const [ref, setRef] = useState("");
  const [credit, setCredit] = useState("");
  const [manualRail, setManualRail] = useState("Bank transfer");
  const [proofAck, setProofAck] = useState(false);
  const [bank, setBank] = useState("");
  const [achAck, setAchAck] = useState(false);
  const [wallet, setWallet] = useState("Funding wallet");
  const [failure, setFailure] = useState("");
  const agents = useQuery({ queryKey: ["deposit-agents"], queryFn: getKenyaAgents, enabled: railId === "mpesa-agent" });
  const selectedAgent = agents.data?.find((a) => a.id === agentId);
  const qc = useQueryClient();
  // Sensitive draft fields are captured only in the form closure, never in React Query mutation variables.
  const input = (): DepositInput => ({ accountId, rail: railId, amount: Number(amount), idempotencyKey: key, parentRef: start.parentRef,
    agentId, phone, phoneConfirmed: phoneConfirm, network: railId === "crypto" ? network : undefined, cryptoAcknowledged: cryptoAck,
    proof: rail?.mode === "Proof required" ? proof : undefined, brokerReference: ref, expectedCredit: Number(credit), manualRail: railId === "wire" ? "Bank wire" : manualRail, reviewedProof: proofAck,
    bankLabel: bank, achAuthorized: achAck, internalWallet: wallet, cashierWindow: windowMinutes });
  const quote = useMutation({ mutationFn: () => previewDeposit(input()) });
  const submit = useMutation({ mutationFn: () => requestDeposit(input()), onSuccess: (row) => {
    for (const queryKey of [["deposit-history"], ["deposit-ledger"], ["deposit-summary"], ["account-finance"], ["account-detail"], ...(row.origin === "Simulated" ? [["accounts"], ["funding-accounts"]] : [])]) void qc.invalidateQueries({ queryKey });
    setPhone(""); setProof(undefined);
  } });
  const pending = quote.isPending || submit.isPending;
  const goNext = async (e: FormEvent) => {
    e.preventDefault(); setFailure("");
    if (step === 0 && !rail) { setFailure("Choose an account and funding method."); return; }
    if (step === 1 && !credit) setCredit(amount);
    if (step < 2) { setStep(step + 1); return; }
    try { if (step === 2) { await quote.mutateAsync(); setStep(3); } else await submit.mutateAsync(); } catch (e) { setFailure(errorText(e)); }
  };
  const switchAccount = (id: string) => {
    setAccountId(id); setRail(accounts.find((a) => a.id === id)?.rails[0]?.id ?? "paper"); setAmount(""); setCredit(""); setProof(undefined); setManualRail("Bank transfer"); setKey(globalThis.crypto.randomUUID());
  };
  return <Dialog title="New deposit" kicker="FUNDING WORKSPACE" close={() => { if (!pending) close(); }} drawer>
    {!submit.data && <ol className="os-dep-stepper" aria-label="Deposit progress">{labels.map((label, i) => <li key={label} aria-current={step === i ? "step" : undefined}><span>{i < step ? <CircleCheck size={14} /> : i + 1}</span>{label}</li>)}</ol>}
    {start.parentRef && !submit.data && <Note>Retry draft for {start.parentRef}. The original deposit remains unchanged; verify its status at the broker first.</Note>}
    {submit.data ? <div className="os-dep-flow">
      <div className="os-dep-outcome"><span>{submit.data.origin === "Simulated" ? <FlaskConical size={25} /> : <LockKeyhole size={25} />}</span><Badge tone={submit.data.origin === "Simulated" ? "green" : "blue"}>{submit.data.origin === "Simulated" ? "SIMULATED" : "OFFLINE PREVIEW"}</Badge><h3>{submit.data.origin === "Simulated" ? "Paper balance credited" : "Deposit preview staged"}</h3><p>{submit.data.origin === "Simulated" ? `${amountLabel(submit.data.amountNative)} credited to ${submit.data.accountLabel} for this session. No money moved.` : readyMessage}</p><code>{submit.data.ref}</code></div>
      {submit.data.origin === "Preview" && <Note>No payment request, webhook, or broker credit occurred. This record is not a receipt.</Note>}
      <div className="os-dep-actions"><button className="btn os-dep-btn" onClick={close}>Done</button><button className="btn os-dep-btn os-dep-primary" onClick={() => view(submit.data)}><FileText size={15} /> View deposit record</button></div>
    </div> : <form className="os-dep-flow" onSubmit={(e) => void goNext(e)}>
      {step === 0 && <><label className="os-dep-field"><span>Destination account</span><select className="form-select" value={accountId} onChange={(e) => switchAccount(e.target.value)} required>{accounts.map((a) => <option value={a.id} key={a.id}>{a.label}{a.broker === "paper" ? " · Simulation" : " · Offline profile"}</option>)}</select></label>
      <fieldset className="os-dep-flow"><legend>Funding method</legend>{account?.rails.map((r) => <label className="os-dep-rail-option" key={r.id}><input className="form-check-input" type="radio" name="rail" checked={railId === r.id} onChange={() => { setRail(r.id); setAmount(""); setCredit(""); setKey(globalThis.crypto.randomUUID()); }} /><span><RailTag rail={r.id} /><small>{r.note}</small></span><Badge tone={r.id === "paper" ? "green" : "neutral"}>{r.mode}</Badge></label>)}</fieldset></>}
      {step === 1 && rail && <><div className="os-dep-inset"><RailTag rail={rail.id} /><p>{whole(rail.min,rail.currency)} to {whole(rail.max,rail.currency)} · {rail.eta}{rail.id === "mpesa-agent" ? " · agent limits apply" : ""}</p></div>
      <label className="os-dep-field"><span>Deposit amount ({rail.currency})</span><input className="form-control" type="number" inputMode="decimal" min={rail.min} max={rail.max} step="0.01" required value={amount} onChange={(e) => { setAmount(e.target.value); setCredit(""); }} autoFocus /></label>
      <div className="os-dep-quote-inline"><span>Estimated display value</span><strong>{amountLabel(convertToUSD(Number(amount) || 0, rail.currency))} USD</strong></div><small>{rail.currency === "KES" ? `Illustrative rate: 1 USD = ${sampleUsdKes} KES.` : rail.currency === "USDT" ? "Display preview assumes 1 USDT = 1 USD." : "Deposit and display currencies are both USD."} No live FX quote is used.</small></>}
      {step === 2 && rail && <>
        {rail.id === "paper" && <Note><strong>Simulation only.</strong> This credits the local Paper balance and creates a matching ledger entry. It does not count as trading P&L.</Note>}
        {rail.id === "mpesa-agent" && <>
          <Note>Use fictional agents and a sample phone only. No M-Pesa prompt or message will be sent.</Note>
          <label className="os-dep-field"><span>Kenya payment agent</span><select className="form-select" value={agentId} onChange={(e) => setAgent(e.target.value)} required><option value="">{agents.isPending ? "Loading sample agents…" : "Choose an agent"}</option>{agents.data?.map((a) => <option key={a.id} value={a.id} disabled={!a.available}>{a.name}{a.available ? "" : " · Offline"}</option>)}</select></label>
          {selectedAgent && <div className="os-dep-inset">{whole(selectedAgent.min, "KES")} – {whole(selectedAgent.max, "KES")} · fee {whole(selectedAgent.fee,"KES")} · Kenya</div>}
          <label className="os-dep-field"><span>Sample M-Pesa phone number</span><input className="form-control" type="tel" autoComplete="off" value={phone} placeholder="+254700000000" onChange={(e) => { setPhone(e.target.value); setPhoneConfirm(false); }} required /></label>
          <label className="os-dep-check"><input type="checkbox" className="form-check-input" required checked={phoneConfirm} onChange={(e) => setPhoneConfirm(e.target.checked)} /> Confirm this is an example phone number.</label>
        </>}
        {rail.id === "cashier" && <><Note>The hosted URL and broker transaction stream require the backend. No cashier page is loaded.</Note><label className="os-dep-field"><span>Credit matching window</span><select className="form-select" value={windowMinutes} onChange={(e) => setWindowMinutes(Number(e.target.value))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label></>}
        {rail.id === "crypto" && <><label className="os-dep-check"><input type="checkbox" className="form-check-input" required checked={cryptoAck} onChange={(e) => setCryptoAck(e.target.checked)} /> I understand the sample QR is non-payable.</label><CryptoPreview network={network} setNetwork={(n) => { setNetwork(n); setCryptoAck(false); }} amount={Number(amount)} broker={account?.broker === "deriv" ? "deriv" : "binance"} compact copyAcknowledged={cryptoAck} /></>}
        {rail.mode === "Proof required" && <><Note>Attach sample proof only. No document is uploaded or used to update a broker balance.</Note>
          {rail.id === "manual" && <label className="os-dep-field"><span>Broker portal method</span><select className="form-select" value={manualRail} onChange={(e) => setManualRail(e.target.value)}>{(account?.broker === "exness" ? manualMethods : manualMethods.slice(0,1)).map((method) => <option key={method}>{method}</option>)}</select></label>}
          <div className="os-dep-form-grid"><label className="os-dep-field"><span>Sample broker reference</span><input className="form-control" placeholder="DEMO-REF-101" value={ref} onChange={(e) => setRef(e.target.value)} minLength={4} maxLength={48} required /></label><label className="os-dep-field"><span>Expected credit ({rail.currency})</span><input className="form-control" type="number" required min="0.01" step="0.01" max={amount} value={credit} onChange={(e) => setCredit(e.target.value)} /></label></div>
          <label className="os-dep-field"><span>Sample proof · PNG, JPEG or PDF, max 10 MB</span><input className="form-control" type="file" accept="image/png,image/jpeg,application/pdf" required={!proof} onChange={(e) => setProof(e.target.files?.[0])} />{proof && <small>Sample attachment selected · {(proof.size / 1024).toFixed(1)} KB</small>}</label>
          <label className="os-dep-check"><input type="checkbox" className="form-check-input" required checked={proofAck} onChange={(e) => setProofAck(e.target.checked)} /> I understand the broker balance and proof are not verified.</label>
        </>}
        {rail.id === "ach" && <><Note>ACH requires an eligible verified US bank at the broker. No bank or routing number is collected.</Note><label className="os-dep-field"><span>Sample bank relationship</span><select className="form-select" required value={bank} onChange={(e) => setBank(e.target.value)}><option value="">Select a sample bank</option>{Object.entries(sampleBanks).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="os-dep-check"><input type="checkbox" className="form-check-input" required checked={achAck} onChange={(e) => setAchAck(e.target.checked)} /> Review the sample authorization. Do not debit any bank.</label></>}
        {rail.id === "internal" && <label className="os-dep-field"><span>Sample source wallet</span><select className="form-select" value={wallet} onChange={(e) => setWallet(e.target.value)}><option>Funding wallet</option><option>Spot wallet</option></select></label>}
      </>}
      {step === 3 && quote.data && <div className="os-dep-flow"><dl className="os-dep-review">
        <div><dt>Destination</dt><dd>{quote.data.account.label}</dd></div><div><dt>Funding method</dt><dd><RailTag rail={quote.data.rail.id} /></dd></div><div><dt>Deposit amount</dt><dd>{amountLabel(quote.data.amount,quote.data.rail.currency)}</dd></div><div><dt>Estimated fee</dt><dd>{amountLabel(quote.data.fee,quote.data.rail.currency)}</dd></div><div><dt>Estimated total</dt><dd>{amountLabel(quote.data.total,quote.data.rail.currency)}</dd></div><div><dt>Display value (USD)</dt><dd>{amountLabel(quote.data.amountUSD)}</dd></div><div><dt>Example ETA</dt><dd>{quote.data.eta}</dd></div>{railId === "crypto" && <div><dt>Preview network</dt><dd>{network}</dd></div>}<MethodDetails details={quote.data.details} currency={quote.data.rail.currency} />{rail?.mode === "Proof required" && <div><dt>Sample broker reference</dt><dd>{ref.trim()}</dd></div>}<div><dt>Request key</dt><dd className="os-dep-mono">{key.slice(0,8)}…</dd></div>
      </dl><Note>{railId === "paper" ? "This adds simulated buying power to the current browser session." : "This only saves a preview record. You are not authorizing a real payment."}</Note></div>}
      {failure && <Note danger>{failure}</Note>}
      <div className="os-dep-drawer-actions"><button className="btn os-dep-btn" type="button" disabled={pending} onClick={() => step ? (setStep(step - 1), setFailure("")) : close()}>{step > 0 && <ArrowLeft size={14} />}{step ? "Back" : "Cancel"}</button><button className="btn os-dep-btn os-dep-primary" type="submit" disabled={pending || !rail}>{pending ? <Busy>{step === 3 ? "Saving…" : "Checking…"}</Busy> : step < 2 ? <>Continue <ArrowRight size={15} /></> : step === 2 ? <>Review deposit <ArrowRight size={15} /></> : railId === "paper" ? <><FlaskConical size={15} /> Simulate deposit</> : <><ShieldCheck size={15} /> Stage deposit preview</>}</button></div>
    </form>}
  </Dialog>;
}
