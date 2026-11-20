import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, Download, History, Pencil, RefreshCw, Search, Sparkles } from "lucide-react";
import { exportAccountAudit, getAccountAudit, getAccountFinance, getAccountMappings, getHubAdapters, runAccountAction, updateHubMapping, type AccountAudit, type AdapterAction, type BrokerKey, type HubMapping, type TradingAccount } from "@/services/accounts";
import { BrokerMark, Busy, Chip, Dialog, Empty, StateNote, dollars, eatDate, errorText, names } from "./AccountUI";

export type ActionInput = { broker: BrokerKey; accountId?: string; action: AdapterAction };
export function AdapterActionDialog({ input, close }: { input: ActionInput; close: () => void }) {
  const qc = useQueryClient();
  const action = useMutation({ mutationFn: runAccountAction, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["account-audit"] }); void qc.invalidateQueries({ queryKey: ["account-detail"] }); } });
  return <Dialog title={input.action} kicker={`${names[input.broker]} · ADAPTER OPERATIONS`} close={close}>
    <div className="os-hub-flow">
      {action.data ? <><StateNote>{action.data.message}</StateNote>{action.data.checks.length > 0 && <div className="os-hub-result-steps">{action.data.checks.map((c) => <div key={c.name}><span><strong>{c.name}</strong><small>{c.detail}</small></span><Chip tone={c.status === "Pass" ? "green" : "neutral"}>{c.status}</Chip></div>)}</div>}</> : <p>{input.action === "Run diagnostics" ? "Review authentication, quote feed, positions and clock checks. Only local Paper probes can run here." : input.broker === "paper" && ["Refresh symbols", "Re-sync history"].includes(input.action) ? "Re-read the local workspace snapshot. No external broker will be contacted." : "Review the request in offline mode. This will not change access, open a session, or contact the broker."}</p>}
      {action.isError && <StateNote error>{errorText(action.error)}</StateNote>}
      <div className="os-hub-dialog-actions"><button className="btn os-hub-btn" onClick={close}>{action.data ? "Done" : "Cancel"}</button>{!action.data && <button className="btn os-hub-btn os-hub-primary" disabled={action.isPending} onClick={() => action.mutate(input)}>{action.isPending ? <Busy>Checking…</Busy> : input.action}</button>}</div>
    </div>
  </Dialog>;
}
export function AdapterHealth({ start }: { start: (input: ActionInput) => void }) {
  const adapters = useQuery({ queryKey: ["hub-adapters"], queryFn: getHubAdapters });
  const [filter, setFilter] = useState("configured");
  const [expanded, setExpanded] = useState("");
  const rows = (adapters.data ?? []).filter((a) => filter === "all" || (filter === "configured" ? a.status !== "standby" : a.status === "standby"));
  return <div className="os-hub-card os-hub-panel">
    <div className="os-hub-panel-head"><div><h3>Adapter diagnostics</h3><p>Latency, rate limits and incidents are sample measurements, not live telemetry.</p></div><select className="form-select form-select-sm" aria-label="Adapter filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="configured">Configured adapters</option><option value="all">All adapters</option><option value="standby">Standby only</option></select></div>
    {adapters.isPending ? <Empty><Busy>Loading adapter snapshots…</Busy></Empty> : adapters.isError ? <Empty><button className="btn os-hub-btn" onClick={() => void adapters.refetch()}>Retry adapter list</button></Empty> : <div className="os-hub-scroll" tabIndex={0} role="region" aria-label="Adapter diagnostics table"><table className="table os-hub-table"><thead><tr><th>Adapter</th><th>Session state</th><th>p50 / p95</th><th>Tick age</th><th>Retries · 24h</th><th>Budget / incident</th><th>Actions</th></tr></thead><tbody>{rows.map((a) => <AdapterRow key={a.id} adapter={a} expanded={expanded === a.id} expand={() => setExpanded(expanded === a.id ? "" : a.id)} start={start} />)}</tbody></table></div>}
  </div>;
}
type Adapter = Awaited<ReturnType<typeof getHubAdapters>>[number];
function AdapterRow({ adapter: a, expanded, expand, start }: { adapter: Adapter; expanded: boolean; expand: () => void; start: (input: ActionInput) => void }) {
  return <><tr><td><div className="os-hub-table-id"><BrokerMark broker={a.broker} compact /><span><strong>{a.name}</strong><small>{a.protocol}</small></span></div></td><td><Chip tone={a.broker === "paper" ? "green" : a.error ? "orange" : "neutral"}>{a.ws}</Chip></td><td className="os-hub-num">{a.p50} / {a.p95} ms</td><td className="os-hub-num">{a.broker === "paper" ? "Static" : `${a.snapshotAgeSec}s`}</td><td className="os-hub-num">{a.reconnects}</td><td><button className="os-hub-link" onClick={expand} aria-expanded={expanded}>{a.error ? "Sample incident" : `${a.rateHeadroomPct}% remaining`} <ChevronRight size={13} /></button></td><td><div className="os-hub-actions"><button className="btn os-hub-btn os-hub-small" onClick={() => start({ broker: a.broker, action: "Run diagnostics" })}>Diagnostics</button><button className="btn os-hub-btn os-hub-icon-btn" title="Reconnect" aria-label={`Reconnect ${a.name}`} onClick={() => start({ broker: a.broker, action: "Reconnect" })}><RefreshCw size={14} /></button><button className="btn os-hub-btn os-hub-icon-btn" title="Refresh symbols" aria-label={`Refresh ${a.name} symbols`} onClick={() => start({ broker: a.broker, action: "Refresh symbols" })}><Sparkles size={14} /></button></div></td></tr>
    {expanded && <tr><td colSpan={7}><div className="os-hub-budget"><div><strong>{a.error || "No incident in this snapshot."}</strong><small>Endpoint headroom is illustrative.</small></div>{a.limits.map((limit) => <div key={limit.name}><span>{limit.name} · {limit.pct}%</span><div className="progress" role="progressbar" aria-label={`${limit.name} headroom`} aria-valuenow={limit.pct}><div className="progress-bar" style={{ width: `${limit.pct}%` }} /></div></div>)}</div></td></tr>}
  </>;
}

const priorities = ["XAUUSD", "EURUSD", "NAS100", "BTCUSDT", "R_75", "USDJPY", "GBPUSD", "US30"];
export function MappingTable({ accounts, preferred, inline = false }: { accounts: TradingAccount[]; preferred: string; inline?: boolean }) {
  const [selection, select] = useState(preferred);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<HubMapping>();
  const id = accounts.some((a) => a.id === selection) ? selection : accounts[0]?.id;
  const account = accounts.find((a) => a.id === id);
  const q = useQuery({ queryKey: ["account-mappings", id], queryFn: () => getAccountMappings(id!), enabled: !!id });
  const qc = useQueryClient();
  const mut = useMutation({ mutationFn: updateHubMapping, onSuccess: () => {
    void qc.invalidateQueries({ queryKey: ["account-mappings", id] }); void qc.invalidateQueries({ queryKey: ["account-audit"] }); void qc.invalidateQueries({ queryKey: ["symbol-mappings"] }); void qc.invalidateQueries({ queryKey: ["account-detail", id] }); setEditing(undefined);
  } });
  const rows = (q.data ?? []).filter((r) => `${r.canonical} ${r.brokerSymbol ?? ""} ${r.name}`.toLowerCase().includes(search.toLowerCase().trim()) && (status === "all" || (status === "unmapped" ? !r.brokerSymbol : status === "suggestions" ? !!r.suggestion && r.source === "Catalog" : r.source !== "Catalog"))).sort((a, b) => (priorities.includes(a.canonical) ? priorities.indexOf(a.canonical) : 99) - (priorities.includes(b.canonical) ? priorities.indexOf(b.canonical) : 99));
  const total = Math.max(1, Math.ceil(rows.length / 6));
  return <div className={inline ? "os-hub-mapping-inline" : "os-hub-card os-hub-panel"}>
    <div className="os-hub-panel-head"><div><h3>{inline ? "Account symbol overrides" : "Canonical symbol map"}</h3><p>Review account-scoped aliases before routing. Suggestions are local and require approval.</p></div><div className="os-hub-actions">{!inline && <select className="form-select form-select-sm" aria-label="Mapping account" value={id ?? ""} onChange={(e) => { select(e.target.value); setPage(0); mut.reset(); }}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>}<select className="form-select form-select-sm" aria-label="Mapping status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="all">All symbols</option><option value="unmapped">Unmapped</option><option value="suggestions">AI suggestions</option><option value="overrides">Overrides</option></select></div></div>
    <div className="os-hub-toolbar"><label className="os-hub-search"><Search size={15} /><input className="form-control form-control-sm" aria-label="Search symbol mappings" placeholder="Search symbols and aliases…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} /></label><Chip tone="blue">{q.data?.filter((r) => r.brokerSymbol).length ?? 0} mapped · {q.data?.filter((r) => !r.brokerSymbol).length ?? 0} unmapped</Chip></div>
    {mut.isError && !editing && <StateNote error>{errorText(mut.error)}</StateNote>}{mut.isSuccess && <StateNote>Mapping updated for this account. No broker verification was requested.</StateNote>}
    {q.isPending && id ? <Empty><Busy>Loading symbol catalog…</Busy></Empty> : q.isError ? <Empty><button className="btn os-hub-btn" onClick={() => void q.refetch()}>Retry symbol catalog</button></Empty> : rows.length === 0 ? <Empty>No symbols match the selected filters.</Empty> : <div className="os-hub-scroll" tabIndex={0} role="region" aria-label="Symbol mappings table"><table className="table os-hub-table"><thead><tr><th>Canonical</th><th>Broker symbol</th>{!inline && <><th>Pip / step</th><th>Min / max</th><th>Sessions</th></>}<th>Source</th><th>Mapping action</th></tr></thead><tbody>{rows.slice(page * 6, page * 6 + 6).map((r) => <tr key={r.canonical}><td><strong>{r.canonical}</strong><small>{r.name}</small></td><td className="os-hub-num">{r.brokerSymbol ?? <Chip tone="orange">Unmapped</Chip>}</td>{!inline && <><td className="os-hub-num">{r.pip} / {r.step}</td><td className="os-hub-num">{r.min} / {r.max} {r.unit}</td><td><span className="os-hub-truncate" title={r.sessions}>{r.sessions}</span></td></>}<td><Chip tone={r.source === "Catalog" ? "neutral" : "green"}>{r.source}</Chip></td><td><div className="os-hub-actions">{r.brokerSymbol && <button className="btn os-hub-btn os-hub-small" aria-label={`Edit ${r.canonical} mapping`} onClick={() => { mut.reset(); setEditing(r); }}><Pencil size={13} /> Edit</button>}{r.suggestion && r.source === "Catalog" && <button title={r.suggestion.note} className="btn os-hub-btn os-hub-small" disabled={mut.isPending} onClick={() => mut.mutate({ accountId: id!, canonical: r.canonical, brokerSymbol: r.suggestion!.brokerSymbol, source: "AI accepted" })}><Sparkles size={13} /> Accept {Math.round(r.suggestion.confidence * 100)}%</button>}</div></td></tr>)}</tbody></table></div>}
    <div className="os-hub-table-foot"><span>{rows.length} matching symbols {account && `· ${names[account.broker]}`}</span><Pagination current={page} total={total} set={setPage} /></div>
    {editing && <MappingEditor row={editing} close={() => setEditing(undefined)} pending={mut.isPending} error={mut.error} submit={(values) => mut.mutate({ ...values, canonical: editing.canonical, accountId: id!, source: "Manual" })} />}
  </div>;
}
function MappingEditor({ row, close, pending, error, submit }: { row: HubMapping; close: () => void; pending: boolean; error: unknown; submit: (input: { brokerSymbol: string; suffix?: string; reset?: boolean }) => void }) {
  const [kind, setKind] = useState("symbol");
  const [symbol, setSymbol] = useState(row.brokerSymbol ?? "");
  const [suffix, setSuffix] = useState(row.suffix ?? "");
  return <Dialog title={`Edit ${row.canonical} mapping`} kicker="ACCOUNT SYMBOL OVERRIDE" close={close}><form className="os-hub-flow" onSubmit={(e: FormEvent) => { e.preventDefault(); submit({ brokerSymbol: kind === "suffix" ? `${row.canonical}${suffix.trim()}` : symbol, suffix: kind === "suffix" ? suffix : undefined }); }}>
    <p>Catalog symbol: <strong className="os-hub-num">{row.defaultSymbol}</strong>. Override only this account’s local naming. Always verify exact identifiers at the broker before live use.</p>
    <label className="os-hub-field"><span>Override method</span><select className="form-select" value={kind} onChange={(e) => setKind(e.target.value)}><option value="symbol">Exact broker symbol</option><option value="suffix">Canonical + suffix</option></select></label>
    {kind === "symbol" ? <label className="os-hub-field"><span>Broker symbol</span><input className="form-control" required maxLength={32} value={symbol} onChange={(e) => setSymbol(e.target.value)} /></label> : <label className="os-hub-field"><span>Account-type suffix</span><input className="form-control" maxLength={12} value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="e.g. m, .raw, or leave blank" /><small>Result: {row.canonical}{suffix.trim()}</small></label>}
    {error != null && <StateNote error>{errorText(error)}</StateNote>}<div className="os-hub-dialog-actions">{row.source !== "Catalog" && <button type="button" className="btn os-hub-btn" disabled={pending} onClick={() => submit({ brokerSymbol: row.defaultSymbol ?? "", reset: true })}>Restore catalog</button>}<button className="btn os-hub-btn os-hub-primary" disabled={pending}>{pending ? <Busy>Saving…</Busy> : "Save local mapping"}</button></div>
  </form></Dialog>;
}

export function Pagination({ current, total, set }: { current: number; total: number; set: (page: number) => void }) { return <div className="os-hub-actions"><button className="btn os-hub-btn os-hub-icon-btn" disabled={current <= 0} onClick={() => set(current - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button><span>{current + 1} / {total}</span><button className="btn os-hub-btn os-hub-icon-btn" disabled={current + 1 >= total} onClick={() => set(current + 1)} aria-label="Next page"><ChevronRight size={15} /></button></div>; }
export function AuditTable({ accounts, data }: { accounts: TradingAccount[]; data?: AccountAudit[] }) {
  const [account, setAccount] = useState("");
  const [broker, setBroker] = useState("");
  const [event, setEvent] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["account-audit"], queryFn: getAccountAudit, enabled: data === undefined });
  const entries = data ?? q.data ?? [];
  const rows = entries.filter((a) => (!account || a.accountId === account) && (!broker || a.broker === broker) && (!event || a.event === event)).slice().sort((a,b) => b.at.localeCompare(a.at));
  const exportJob = useMutation({ mutationFn: exportAccountAudit, onSuccess: ({ filename, text }) => { const href = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/csv" })); const a = document.createElement("a"); a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 1500); } });
  return <div className={data ? "os-hub-audit-inline" : "os-hub-card os-hub-panel"}>
    <div className="os-hub-panel-head"><div><h3>Account event log</h3><p>Local activity and sample snapshots · all timestamps in EAT.</p></div><button className="btn os-hub-btn" disabled={!rows.length || exportJob.isPending} onClick={() => exportJob.mutate(rows.map((r) => r.id))}><Download size={15} /> {exportJob.isPending ? "Preparing…" : "Export CSV"}</button></div>
    {!data && <div className="os-hub-toolbar"><div className="os-hub-actions">
      <select className="form-select form-select-sm" aria-label="Audit account" value={account} onChange={(e) => { setAccount(e.target.value); setPage(0); }}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      <select className="form-select form-select-sm" aria-label="Audit adapter" value={broker} onChange={(e) => { setBroker(e.target.value); setPage(0); }}><option value="">All adapters</option>{[...new Set(entries.map((a) => a.broker))].map((b) => <option value={b} key={b}>{names[b]}</option>)}</select>
      <select className="form-select form-select-sm" aria-label="Audit event" value={event} onChange={(e) => { setEvent(e.target.value); setPage(0); }}><option value="">All events</option>{[...new Set(entries.map((a) => a.event))].sort().map((entry) => <option key={entry}>{entry}</option>)}</select>
    </div></div>}
    {exportJob.isError && <StateNote error>{errorText(exportJob.error)}</StateNote>}
    {!data && q.isPending ? <Empty><Busy>Loading account activity…</Busy></Empty> : !data && q.isError ? <Empty><button className="btn os-hub-btn" onClick={() => void q.refetch()}>Retry audit log</button></Empty> : rows.length === 0 ? <Empty>No account events match this view.</Empty> : <div className="os-hub-scroll" tabIndex={0} role="region" aria-label="Account audit table"><table className="table os-hub-table"><thead><tr><th>Time · EAT</th><th>Adapter / account</th><th>Event</th><th>Outcome</th><th>Description</th></tr></thead><tbody>{rows.slice(page * 6, page * 6 + 6).map((a) => <tr key={a.id}><td className="os-hub-num">{eatDate(a.at)}</td><td><strong>{names[a.broker]}</strong><small>{accounts.find((account) => account.id === a.accountId)?.label ?? "Workspace"}</small></td><td>{a.event}</td><td><Chip tone={a.outcome === "Local" ? "green" : a.outcome === "Ready" ? "orange" : "neutral"}>{a.outcome === "Ready" ? "Backend required" : a.outcome}</Chip></td><td className="os-hub-cell-wrap">{a.detail}</td></tr>)}</tbody></table></div>}
    <div className="os-hub-table-foot"><span>{rows.length} events</span><Pagination current={page} total={Math.max(1, Math.ceil(rows.length / 6))} set={setPage} /></div>
  </div>;
}

export function FinanceSync({ accounts, showDetail }: { accounts: TradingAccount[]; showDetail: (id: string, tab: "Finance" | "History sync") => void }) {
  const finance = useQuery({ queryKey: ["account-finance"], queryFn: getAccountFinance });
  const shortlist = accounts.filter((a) => a.connected).slice(0, 4);
  return <div className="os-hub-two"><div className="os-hub-card os-hub-panel"><div className="os-hub-panel-head"><div><h3>Funding activity</h3><p>Recent ledger examples · no funds were moved.</p></div><ArrowLeftRight size={17} /></div><div className="os-hub-list">{finance.isPending ? <Empty><Busy>Loading sample activity…</Busy></Empty> : finance.isError ? <Empty><button className="btn os-hub-btn" onClick={() => void finance.refetch()}>Retry funding activity</button></Empty> : (finance.data ?? []).slice(0, 4).map((f) => <button key={f.id} className="os-hub-list-item" type="button" onClick={() => showDetail(f.accountId, "Finance")}><span className="os-hub-list-icon"><ArrowDownToLine size={16} /></span><span><strong>{f.kind} · {accounts.find((a) => a.id === f.accountId)?.label}</strong><small>{f.rail} · {f.status}</small></span><strong className="os-hub-num">{dollars(f.amount, f.currency)}</strong><ArrowUpRight size={14} /></button>)}</div></div>
    <div className="os-hub-card os-hub-panel"><div className="os-hub-panel-head"><div><h3>History coverage</h3><p>Review local records and preview broker backfill.</p></div><History size={17} /></div><div className="os-hub-list">{shortlist.map((account) => <button type="button" className="os-hub-list-item" key={account.id} onClick={() => showDetail(account.id, "History sync")}><BrokerMark broker={account.broker} compact /><span><strong>{account.label}</strong><small>{account.broker === "paper" ? "Local ledger coverage" : "Static sample coverage"}</small></span><Clock3 size={15} /><ArrowUpRight size={14} /></button>)}</div></div>
  </div>;
}

export const detailTabs = ["Overview", "Symbols", "Health", "Finance", "History sync", "Audit"] as const;
export type DetailTab = (typeof detailTabs)[number];
