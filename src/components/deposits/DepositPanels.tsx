import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Building2, Check, ChevronDown, FileCheck2, Fingerprint, Landmark, ReceiptText } from "lucide-react";
import { getDepositLedger, getDepositRecovery, getKenyaAgents, previewCashier, recordRecoveryAction, recoveryReasons, type DepositRecord, type FundingAccount } from "@/services/deposits";
import { amountLabel, Badge, Busy, Dialog, eat, Empty, errorText, Note, RailTag, whole } from "./DepositUI";
import type { BuilderStart } from "./DepositBuilder";

export function CashierPanel({ accounts, open }: { accounts: FundingAccount[]; open: (start: BuilderStart) => void }) {
  const [selected, setSelected] = useState("acc-deriv-demo");
  const [showAll, setShowAll] = useState(false);
  const [dialog, setDialog] = useState(false);
  const derivAccounts = accounts.filter((a) => a.broker === "deriv");
  const q = useQuery({ queryKey: ["deposit-agents"], queryFn: getKenyaAgents });
  const handoff = useMutation({ mutationFn: previewCashier });
  return <div className="os-dep-split">
    <div className="os-dep-card os-dep-panel os-dep-cashier"><span className="os-dep-icon os-dep-tone-orange"><Landmark size={20} /></span><div><span className="os-dep-kicker">HOSTED HANDOFF</span><h3>Deriv Cashier</h3><p>Review the hosted deposit flow and how OStrade will match an incoming credit.</p></div>
      <label className="os-dep-field"><span>Deriv account</span><select className="form-select form-select-sm" value={selected} onChange={(e) => setSelected(e.target.value)}>{derivAccounts.map((a) => <option value={a.id} key={a.id}>{a.label}</option>)}</select></label>
      <div className="os-dep-match-flow"><span><span>01</span> Hosted cashier</span><ArrowRight size={15} /><span><span>02</span> Match credit</span><ArrowRight size={15} /><span><span>03</span> Store receipt</span></div>
      <div className="os-dep-actions"><button className="btn os-dep-btn" disabled={!derivAccounts.length} onClick={() => { handoff.reset(); setDialog(true); }}><ArrowUpRight size={15} /> Preview hosted cashier</button><button className="btn os-dep-btn os-dep-primary" disabled={!derivAccounts.length} onClick={() => open({ accountId: selected, rail: "cashier" })}>Build cashier draft</button></div>
      {dialog && <Dialog title="Hosted cashier preview" kicker="DERIV · OFFLINE HANDOFF" close={() => setDialog(false)}><div className="os-dep-flow"><Note>No hosted URL, iframe, subscription, or credit match is available in frontend-only mode.</Note>{handoff.data ? <><ul className="os-dep-check-list">{handoff.data.checks.map((check) => <li key={check}><Check size={14} /> {check}</li>)}</ul><Note>{handoff.data.message}</Note></> : <button className="btn os-dep-btn os-dep-primary" disabled={handoff.isPending} onClick={() => handoff.mutate()}>{handoff.isPending ? <Busy>Preparing…</Busy> : "Prepare handoff preview"}</button>}</div></Dialog>}
    </div>
    <div className="os-dep-card os-dep-panel"><div className="os-dep-panel-heading"><div><h3>Kenya agent directory</h3><p>Fictional agents · Juja and other Kenyan locations.</p></div><Badge tone="green">KES · M-Pesa</Badge></div>
      {q.isPending ? <Empty><Busy>Loading agents…</Busy></Empty> : q.isError ? <Empty><button className="btn os-dep-btn" onClick={() => void q.refetch()}>Retry directory</button></Empty> : <div className="os-dep-list">{q.data?.slice(0, showAll ? undefined : 3).map((a) => <button key={a.id} type="button" className="os-dep-list-item" onClick={() => open({ accountId: selected, rail: "mpesa-agent", agentId: a.id })} disabled={!a.available || !derivAccounts.length}><span className="os-dep-icon os-dep-tone-green"><Building2 size={15} /></span><span><strong>{a.name}</strong><small>{whole(a.min,"KES")}–{whole(a.max,"KES")} · fee {whole(a.fee,"KES")}</small></span><Badge tone={a.available ? "green" : "neutral"}>{a.available ? "Sample available" : "Sample offline"}</Badge><ArrowUpRight size={14} /></button>)}</div>}
      <button className="os-dep-link" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer agents" : `Show all ${q.data?.length ?? 0} sample agents`} <ChevronDown size={14} /></button>
    </div>
  </div>;
}

export function DepositLedger({ view, rows }: { view: (row: DepositRecord) => void; rows: DepositRecord[] }) {
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ["deposit-ledger"], queryFn: getDepositLedger });
  return <div className="os-dep-card os-dep-panel"><div className="os-dep-panel-heading"><div><h3>Funding ledger trail</h3><p>Simulated credits post matching debit and credit entries. Offline requests never create a ledger entry.</p></div><span className="os-dep-icon os-dep-tone-violet"><Fingerprint size={18} /></span></div>
  {q.isPending ? <Empty><Busy>Reading ledger…</Busy></Empty> : q.isError ? <Empty><button className="btn os-dep-btn" onClick={() => void q.refetch()}>Retry ledger</button></Empty> : <div className="os-dep-scroll" tabIndex={0} role="region" aria-label="Funding ledger"><table className="table os-dep-table"><thead><tr><th>Ledger reference</th><th>Source deposit</th><th>Debit → credit</th><th>USD value</th><th>Posted · EAT</th><th>Posting origin</th></tr></thead><tbody>{q.data?.slice(0, all ? undefined : 4).map((entry) => { const deposit = rows.find((o) => o.ref === entry.sourceRef); return <tr key={entry.id}><td className="os-dep-mono">{entry.id}</td><td>{deposit ? <button className="os-dep-link" onClick={() => view(deposit)}>{entry.sourceRef} <ArrowUpRight size={12} /></button> : entry.sourceRef}</td><td><strong>Funding clearing → {entry.accountLabel}</strong><small>{entry.memo}</small>{entry.balanceAfterCredit !== undefined && <small>Balance after credit: {amountLabel(entry.balanceAfterCredit)}</small>}</td><td className="os-dep-mono">{amountLabel(entry.amountUSD)}</td><td>{eat(entry.postedAt)}</td><td><Badge tone={entry.origin === "Simulated" ? "green" : "neutral"}>{entry.origin}</Badge></td></tr>; })}</tbody></table></div>}
  {q.data && q.data.length > 4 && <button className="os-dep-link" onClick={() => setAll(!all)}>{all ? "Show fewer postings" : `View all ${q.data.length} postings`} <ArrowRight size={14} /></button>}
  </div>;
}

export function RecoveryPanel({ open }: { open: (start: BuilderStart) => void }) {
  const q = useQuery({ queryKey: ["deposit-recovery"], queryFn: getDepositRecovery });
  const [selected, setSelected] = useState<DepositRecord>();
  const [showLog, setShowLog] = useState(false);
  const qc = useQueryClient();
  const [hash, setHash] = useState("");
  const action = useMutation({ mutationFn: recordRecoveryAction, onSuccess: () => void qc.invalidateQueries({ queryKey: ["deposit-recovery"] }) });
  const reason = selected?.failure;
  const followup = reason === "Timeout" ? "Retry reviewed" : reason === "Agent unreachable" ? "Agent contact preview" : reason === "Broker rejection" ? "Support opened" : "Manual match staged";
  return <div className="os-dep-card os-dep-panel"><div className="os-dep-panel-heading"><div><h3>Review queue</h3><p>Investigate examples without retrying a real payment or changing a posted balance.</p></div><Badge tone="orange">{q.data?.items.length ?? 0} sample cases</Badge></div>
    {q.isPending ? <Empty><Busy>Loading recovery queue…</Busy></Empty> : q.isError ? <Empty><button className="btn os-dep-btn" onClick={() => void q.refetch()}>Retry recovery queue</button></Empty> : <div className="os-dep-recovery-grid">{q.data?.items.map((r) => r.failure && <article className="os-dep-recovery-card" key={r.id}><div className="os-dep-actions"><Badge tone="red">{r.failure}</Badge><span className="os-dep-mono">{r.ref}</span></div><strong>{r.accountLabel} · {amountLabel(r.amountNative,r.currencyNative)}</strong><p>{recoveryReasons[r.failure].guidance}</p><button className="os-dep-link" onClick={() => { setHash(""); action.reset(); setSelected(r); }}>{recoveryReasons[r.failure].title} <ArrowRight size={14} /></button></article>)}</div>}
    <button className="btn os-dep-btn" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}><ReceiptText size={15} /> {showLog ? "Hide" : "Show"} recovery activity ({q.data?.events.length ?? 0})</button>
    {showLog && (!q.data?.events.length ? <Empty>No recovery actions logged this session.</Empty> : <div className="os-dep-list">{q.data.events.map((ev) => <div className="os-dep-list-item" key={ev.id}><span className="os-dep-icon os-dep-tone-blue"><FileCheck2 size={15} /></span><span><strong>{ev.action} · {ev.depositRef}</strong><small>{ev.detail}</small></span><small>{eat(ev.at)} EAT</small></div>)}</div>)}
    {selected && reason && <Dialog title={recoveryReasons[reason].title} kicker={`RECOVERY · ${selected.ref}`} close={() => setSelected(undefined)}><form className="os-dep-flow" onSubmit={(e) => { e.preventDefault(); action.mutate({ ref: selected.ref, action: followup, txHash: hash }); }}>
      <div className="os-dep-actions"><RailTag rail={selected.rail} /><Badge tone="red">{reason}</Badge></div><p>{recoveryReasons[reason].guidance}</p>
      {selected.brokerRef && <div className="os-dep-inset">Sample broker reference: <code>{selected.brokerRef}</code></div>}
      {followup === "Manual match staged" && !action.data && <label className="os-dep-field"><span>Sample transaction hash</span><input className="form-control" value={hash} onChange={(e) => setHash(e.target.value)} required maxLength={66} placeholder="64 hexadecimal characters" /><small>Hash format is validated locally. No chain is queried.</small></label>}
      {action.isError && <Note danger>{errorText(action.error)}</Note>}
      {action.data ? <><Note>{action.data.message}</Note><div className="os-dep-actions">{followup === "Retry reviewed" && <button type="button" className="btn os-dep-btn os-dep-primary" onClick={() => { open({ accountId: selected.accountId, rail: selected.rail, amount: selected.amountNative, parentRef: selected.ref }); setSelected(undefined); }}>Open a new retry draft</button>}{action.data.url && <a className="btn os-dep-btn" href={action.data.url} target="_blank" rel="noreferrer noopener">Open official broker support <ArrowUpRight size={14} /></a>}<button type="button" className="btn os-dep-btn" onClick={() => setSelected(undefined)}>Done</button></div></> : <button className="btn os-dep-btn os-dep-primary" disabled={action.isPending}>{action.isPending ? <Busy>Reviewing…</Busy> : followup === "Manual match staged" ? "Validate and stage review" : followup === "Support opened" ? "Prepare support link" : "Record review"}</button>}
    </form></Dialog>}
  </div>;
}
