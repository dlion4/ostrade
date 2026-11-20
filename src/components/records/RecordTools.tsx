import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpRight, BookOpen, Check, CircleHelp, Download, FileBarChart, FileSpreadsheet, FileText, FolderUp, Image, LockKeyhole, Plus, X } from "lucide-react";
import { BrokerBadge } from "@/components/DashboardShell";
import { addJournalNote, downloadRecordExport, eatDay, getReconciliation, getRecordExports, getTradeJournal, reconcileStatement, resolveStatementException, setLessonDigest, type ExportFormat, type JournalNote, type StatementException, type StatementFormat, type TradeRecord } from "@/services/records";
import { brokerName, shortDate, usd } from "./recordsView";
import { SourceLink } from "./History";

export function RecordDialog({ title, eyebrow, close, children, drawer = false }: { title: string; eyebrow: string; close: () => void; children: ReactNode; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog className={`os-rec-dialog ${drawer ? "os-rec-drawer" : ""}`} ref={ref} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); close(); }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
    <div className="os-rec-dialog-inner"><header><div><span className="os-rec-kicker">{eyebrow}</span><h2 id={titleId}>{title}</h2></div><button className="btn os-rec-btn os-rec-square" type="button" onClick={close} aria-label="Close dialog"><X size={18} /></button></header>{children}</div>
  </dialog>;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
export function Reconciliation() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["record-reconciliation"], queryFn: getReconciliation });
  const [selected, setSelected] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [resolution, setResolution] = useState<StatementException | null>(null);
  const [notice, setNotice] = useState("");
  const [includeResolved, setIncludeResolved] = useState(false);
  const resolve = useMutation({ mutationFn: (choice: NonNullable<StatementException["resolution"]>) => resolveStatementException(resolution!.id, choice), onSuccess: (out) => { setNotice(out.message); setResolution(null); void qc.invalidateQueries({ queryKey: ["record-reconciliation"] }); } });
  const exceptions = (q.data?.exceptions ?? []).filter((row) => (!selected || row.accountId === selected) && (includeResolved || !row.resolution || row.resolution === "Flag for review"));
  return <div className="os-rec-card os-rec-flow-card">
    <div className="os-rec-card-head"><div><h3>Statement workspace</h3><p>Match a broker file to the local ledger without contacting the broker.</p></div><button className="btn os-rec-btn" disabled={!q.data} onClick={() => setImportOpen(true)}><FolderUp size={16} /> Import statement</button></div>
    <div className="os-rec-account-grid">{q.data?.accounts.map((a) => <button key={a.id} className="os-rec-inset" type="button" aria-pressed={selected === a.id} onClick={() => setSelected(selected === a.id ? "" : a.id)}><span><BrokerBadge broker={a.broker} label={brokerName[a.broker] ?? a.broker} /><span className={`os-rec-pill ${a.status === "SYNCED" ? "os-rec-green" : "os-rec-orange"}`}>{a.status}</span></span><strong>{a.label}</strong><small>Local check · {shortDate(a.checked)}</small></button>)}</div>
    <div className="os-rec-subhead"><strong>Exceptions <span className="os-rec-pill os-rec-orange">{exceptions.length}</span></strong><div className="os-rec-actions">{selected && <button className="os-rec-text-btn" onClick={() => setSelected("")}>Show all accounts</button>}<label><input className="form-check-input" type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} /> Include resolved</label></div></div>
    {notice && <div className="os-rec-inline" role="status">{notice}</div>}
    {q.isPending ? <div className="os-rec-empty">Loading local review log…</div> : q.isError ? <div className="os-rec-empty">Unable to read reconciliation. <button className="os-rec-text-btn" onClick={() => void q.refetch()}>Retry</button></div> : exceptions.length ? <div className="os-rec-scroll"><table className="table os-rec-table"><thead><tr><th>Trade reference</th><th>Exception</th><th>Internal USD</th><th>Broker USD</th><th>Review</th></tr></thead><tbody>{exceptions.map((row) => <tr key={row.id}><td className="os-rec-num">{row.ref}</td><td><span className="os-rec-pill os-rec-orange">{row.kind}</span></td><td>{row.internal === undefined ? "—" : usd(row.internal)}</td><td>{row.broker === undefined ? "—" : usd(row.broker)}</td><td><button className="os-rec-text-btn os-rec-source" onClick={() => { resolve.reset(); setResolution(row); }}>{row.resolution ?? "Resolve"} <ArrowUpRight size={12} /></button></td></tr>)}</tbody></table></div> : <div className="os-rec-empty">No exceptions in this view.</div>}
    {importOpen && q.data && <StatementImport accounts={q.data.accounts} initial={selected} close={() => setImportOpen(false)} done={(message) => { setNotice(message); setSelected(""); void qc.invalidateQueries({ queryKey: ["record-reconciliation"] }); setImportOpen(false); }} />}
    {resolution && <RecordDialog title="Resolve an exception" eyebrow={resolution.ref} close={() => setResolution(null)}><div className="os-rec-flow"><p>{resolution.kind}. Your decision is saved in the local review log. It will not change the original ledger or send anything to the broker.</p><div className="os-rec-actions">{(["Accept broker", "Keep internal", "Flag for review"] as const).map((choice) => <button key={choice} className="btn os-rec-btn" disabled={resolve.isPending} onClick={() => resolve.mutate(choice)}>{choice}</button>)}</div>{resolve.isPending && <div role="status">Saving local decision…</div>}</div></RecordDialog>}
  </div>;
}

const formats: StatementFormat[] = ["MT5 HTML", "Deriv CSV", "Binance XLSX", "Alpaca CSV", "OANDA CSV"];
function StatementImport({ accounts, initial, close, done }: { accounts: { id: string; label: string }[]; initial: string; close: () => void; done: (message: string) => void }) {
  const [accountId, setAccount] = useState(initial || accounts[0]?.id || "");
  const [format, setFormat] = useState<StatementFormat>("MT5 HTML");
  const [file, setFile] = useState<File>();
  const [tolerance, setTolerance] = useState("1.00");
  const [columns, setColumns] = useState({ ref: "", net: "", commission: "", swap: "" });
  const mut = useMutation({ mutationFn: (sample: boolean) => reconcileStatement({ accountId, file: sample ? undefined : file, format, tolerance: tolerance.trim() ? Number(tolerance) : NaN, columns }), onSuccess: (r) => done(`Checked ${r.reviewed} statement rows locally · ${r.found} differences detected.`) });
  return <RecordDialog title="Import a broker statement" eyebrow="LOCAL RECONCILIATION" close={close}>
    <form className="os-rec-flow" onSubmit={(e) => { e.preventDefault(); if (file) mut.mutate(false); }}>
      <div className="os-rec-form-grid"><label className="os-rec-field"><span>Account</span><select className="form-select" value={accountId} onChange={(e) => setAccount(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label><label className="os-rec-field"><span>Statement format</span><select className="form-select" value={format} onChange={(e) => { setFormat(e.target.value as StatementFormat); setFile(undefined); }}>{formats.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <label className="os-rec-field"><span>Broker statement · up to 5 MB</span><input key={format} type="file" className="form-control" accept={format === "MT5 HTML" ? ".htm,.html" : format === "Binance XLSX" ? ".xlsx" : ".csv"} onChange={(e) => setFile(e.target.files?.[0])} /></label>
      <label className="os-rec-field"><span>Difference tolerance (USD)</span><input className="form-control" type="number" min="0" step="0.01" required value={tolerance} onChange={(e) => setTolerance(e.target.value)} /></label>
      <details className="os-rec-inset"><summary>Map statement columns</summary><p>Leave blank to detect common headers. Net P&L and a trade reference are required.</p><div className="os-rec-form-grid">{([['ref', 'Trade reference'], ['net', 'Net P&L'], ['commission', 'Commission'], ['swap', 'Swap / financing']] as const).map(([key, label]) => <label className="os-rec-field" key={key}><span>{label}</span><input className="form-control form-control-sm" placeholder="Auto-detect" value={columns[key]} onChange={(e) => setColumns({ ...columns, [key]: e.target.value })} /></label>)}</div></details>
      {mut.isError && <div className="os-rec-inline os-rec-rose" role="alert">{errorText(mut.error)}</div>}
      <div className="os-rec-actions"><button className="btn os-rec-btn os-rec-primary" disabled={!file || mut.isPending}><FolderUp size={15} /> {mut.isPending ? "Comparing…" : "Compare statement"}</button><button className="btn os-rec-btn" type="button" disabled={mut.isPending} onClick={() => mut.mutate(true)}>Run local sample</button></div>
    </form>
  </RecordDialog>;
}

const exportTiles = [
  { format: "CSV", label: "CSV / Excel", copy: "Full history or the filtered view", icon: FileSpreadsheet, color: "green" },
  { format: "PDF", label: "Monthly summary", copy: "Realized curve, stats and top trades", icon: FileBarChart, color: "orange" },
  { format: "KES", label: "KES tax draft", copy: "Annual realized P&L by account", icon: FileText, color: "violet" },
  { format: "JSON", label: "JSON dump", copy: "Structured trade records for analysis", icon: Download, color: "blue" },
] as const;
export type ExportRequest = { format: ExportFormat; tradeIds?: string[]; month?: string; year?: string; rate?: number; email: boolean; sms: boolean };
export function ExportCenter({ open }: { open: (format: ExportFormat) => void }) {
  const jobs = useQuery({ queryKey: ["record-exports"], queryFn: getRecordExports, refetchInterval: (q) => q.state.data?.some((job) => job.status === "Queued") ? 900 : false });
  const download = useMutation({ mutationFn: downloadRecordExport, onSuccess: ({ file, name }) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  } });
  return <div className="os-rec-card os-rec-flow-card">
    <div className="os-rec-export-grid">{exportTiles.map(({ format, label, copy, icon: Icon, color }) => <button className="os-rec-inset" type="button" key={format} onClick={() => open(format)}><span><span className={`os-rec-icon os-rec-${color}`}><Icon size={18} /></span><ArrowUpRight size={15} /></span><strong>{label}</strong><small>{copy}</small></button>)}</div>
    <div className="os-rec-subhead"><strong>Local export queue</strong><span><LockKeyhole size={13} /> Files stay in this browser</span></div>
    {download.isError && <div className="os-rec-inline os-rec-rose" role="alert">{errorText(download.error)}</div>}
    {jobs.data?.length ? <div className="os-rec-scroll"><table className="table os-rec-table"><thead><tr><th>File</th><th>Scope</th><th>Status</th><th>Size</th><th>Notification</th><th>Download</th></tr></thead><tbody>{jobs.data.map((job) => <tr key={job.id}><td className="fw-semibold">{job.name}</td><td>{job.scope}</td><td><span className={`os-rec-pill ${job.status === "Ready" ? "os-rec-green" : job.status === "Failed" ? "os-rec-rose" : "os-rec-orange"}`}>{job.status}</span></td><td>{job.size === undefined ? "—" : `${(job.size / 1024).toFixed(1)} KB`}</td><td>{job.email || job.sms ? `${[job.email && "Email", job.sms && "SMS"].filter(Boolean).join(" + ")} · offline` : "Off"}</td><td>{job.status === "Ready" ? <button className="btn os-rec-btn os-rec-square" disabled={download.isPending} aria-label={`Download ${job.name}`} onClick={() => download.mutate(job.id)}><ArrowDownToLine size={15} /></button> : "—"}</td></tr>)}</tbody></table></div> : <div className="os-rec-empty">{jobs.isPending ? "Loading queue…" : "No export jobs yet. Choose a format to generate a file."}</div>}
  </div>;
}
export function ExportForm({ initial, allCount, filtered, close, submit, pending, error }: { initial: ExportFormat; allCount: number; filtered: string[]; close: () => void; submit: (input: ExportRequest) => void; pending: boolean; error: unknown }) {
  const [format, setFormat] = useState(initial);
  const [scope, setScope] = useState("all");
  const [month, setMonth] = useState(eatDay(new Date()).slice(0, 7));
  const [year, setYear] = useState(eatDay(new Date()).slice(0, 4));
  const [rate, setRate] = useState("");
  const [email, setEmail] = useState(false);
  const [sms, setSms] = useState(false);
  return <RecordDialog title="Create a local export" eyebrow="EXPORT CENTER" close={close}>
    <form className="os-rec-flow" onSubmit={(e) => { e.preventDefault(); submit({ format, tradeIds: scope === "filtered" ? filtered : undefined, month, year, rate: Number(rate), email, sms }); }}>
      <div className="os-rec-form-grid"><label className="os-rec-field"><span>Format</span><select className="form-select" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}><option>CSV</option><option>XLSX</option><option>PDF</option><option value="KES">KES tax draft (CSV)</option><option>JSON</option></select></label><label className="os-rec-field"><span>Trade scope</span><select className="form-select" value={scope} onChange={(e) => setScope(e.target.value)}><option value="all">All history ({allCount})</option><option value="filtered">Filtered view ({filtered.length})</option></select></label></div>
      {format === "PDF" && <label className="os-rec-field"><span>Reporting month (EAT)</span><input type="month" className="form-control" required value={month} onChange={(e) => setMonth(e.target.value)} /></label>}
      {format === "KES" && <><div className="os-rec-form-grid"><label className="os-rec-field"><span>Tax year (EAT)</span><input type="number" min="2000" max="2100" required className="form-control" value={year} onChange={(e) => setYear(e.target.value)} /></label><label className="os-rec-field"><span>Illustrative USD/KES rate</span><input type="number" min="0.0001" step="any" required className="form-control" placeholder="Enter sample rate" value={rate} onChange={(e) => setRate(e.target.value)} /></label></div><div className="os-rec-inline"><CircleHelp size={15} /> Draft only, not for filing. Verified daily FX rates require the backend.</div></>}
      <div className="os-rec-inset"><strong>Notify when ready</strong><p>Preferences are saved locally. Delivery requires the backend.</p><div className="os-rec-actions">{[["Email", email, setEmail], ["SMS", sms, setSms]].map(([label, flag, set]) => <label key={String(label)}><input className="form-check-input" type="checkbox" checked={Boolean(flag)} onChange={(e) => (set as (flag: boolean) => void)(e.target.checked)} /> {String(label)}</label>)}</div></div>
      {error != null && <div className="os-rec-inline os-rec-rose" role="alert">{errorText(error)}</div>}
      <button className="btn os-rec-btn os-rec-primary" disabled={pending}><Download size={15} /> {pending ? "Queueing…" : "Queue export"}</button>
    </form>
  </RecordDialog>;
}

function NoteText({ content }: { content: string }) {
  return <p className="os-rec-note-text">{content.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`|_[^_\n]+_)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith("`") && part.endsWith("`") ? <code key={index}>{part.slice(1, -1)}</code> : part.startsWith("_") && part.endsWith("_") ? <em key={index}>{part.slice(1, -1)}</em> : part)}</p>;
}
export function TradeJournal({ notes, trades, digestEnabled, open, onTrade }: { notes: JournalNote[]; trades: TradeRecord[]; digestEnabled: boolean; open: () => void; onTrade: (trade: TradeRecord) => void }) {
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const qc = useQueryClient();
  const digest = useMutation({ mutationFn: setLessonDigest, onSuccess: () => void qc.invalidateQueries({ queryKey: ["trade-journal"] }) });
  const tags = [...new Set(notes.flatMap((note) => note.tags))].sort();
  const related = (note: JournalNote) => trades.find((r) => note.tradeId ? r.id === note.tradeId : !!note.positionId && r.positionId === note.positionId);
  const visible = notes.filter((n) => (!filter || n.tags.includes(filter)) && `${n.text} ${n.tags.join(" ")} ${related(n)?.symbol ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="os-rec-journal-grid">
    <div className="os-rec-card os-rec-flow-card"><div className="os-rec-card-head"><div><h3>Journal entries</h3><p>Review setups, mistakes and decisions alongside your trades.</p></div><button className="btn os-rec-btn os-rec-primary" onClick={open}><Plus size={16} /> New entry</button></div>
      <div className="os-rec-journal-filters"><input className="form-control form-control-sm" aria-label="Search journal" placeholder="Search journal…" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="form-select form-select-sm" aria-label="Journal tag" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</select></div>
      {!visible.length ? <div className="os-rec-empty">No journal entries match.</div> : visible.slice(0, showAll ? undefined : 3).map((note) => { const trade = related(note); return <article className="os-rec-journal-note" key={note.id}><div><strong>{trade ? <button className="os-rec-text-btn os-rec-source" onClick={() => onTrade(trade)}>{trade.symbol} · {trade.ref} <ArrowUpRight size={12} /></button> : note.positionId ? "Position note" : "Daily reflection"}</strong><small>{shortDate(note.date)}</small></div><NoteText content={note.text} /><div className="os-rec-actions">{note.tags.map((t) => <button type="button" className="os-rec-pill os-rec-orange" key={t} onClick={() => setFilter(filter === t ? "" : t)} aria-pressed={filter === t}>{t}</button>)}{note.screenshot && <a href={note.screenshot.url} download={note.screenshot.name} className="os-rec-source"><Image size={15} /> {note.screenshot.name}</a>}{trade && trade.source !== "Manual" && <SourceLink trade={trade} />}</div></article>; })}
      {visible.length > 3 && <button className="btn os-rec-btn" onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer entries" : `Show all ${visible.length} entries`}</button>}
    </div>
    <aside className="os-rec-card os-rec-digest"><span className="os-rec-icon os-rec-violet"><BookOpen size={20} /></span><h3>Lessons of the week</h3><p>Save a weekly digest preference for entries tagged <strong>mistake</strong>. Review the recurring patterns before the next session.</p><label className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={digest.data?.enabled ?? digestEnabled} disabled={digest.isPending} onChange={(e) => digest.mutate(e.target.checked)} /> Weekly lesson digest</label><small role="status">{digest.data?.message ?? "Email delivery is offline until the backend is connected."}</small></aside>
  </div>;
}

export function JournalEditor({ trade, trades, close }: { trade: TradeRecord | null; trades: TradeRecord[]; close: () => void }) {
  const [tradeId, setTradeId] = useState(trade?.id ?? "");
  const [date, setDate] = useState(trade ? eatDay(trade.closedAt) : eatDay(new Date()));
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [screenshot, setScreenshot] = useState<File>();
  const qc = useQueryClient();
  const selected = trades.find((r) => r.id === tradeId);
  const mut = useMutation({ mutationFn: addJournalNote, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["trade-journal"], exact: true }); void qc.invalidateQueries({ queryKey: ["position-detail-meta"] }); close(); } });
  const submit = (e: FormEvent) => { e.preventDefault(); mut.mutate({ tradeId: tradeId || undefined, positionId: selected?.positionId, text, tags: tags.split(","), date, screenshot }); };
  return <RecordDialog title="New journal entry" eyebrow="TRADE JOURNAL" close={close}><form className="os-rec-flow" onSubmit={submit}>
    <div className="os-rec-form-grid"><label className="os-rec-field"><span>Link to trade</span><select className="form-select" value={tradeId} onChange={(e) => setTradeId(e.target.value)}><option value="">Daily reflection</option>{trades.map((r) => <option key={r.id} value={r.id}>{r.symbol} · {r.ref}</option>)}</select></label><label className="os-rec-field"><span>Journal day (EAT)</span><input type="date" className="form-control" required value={date} onChange={(e) => setDate(e.target.value)} /></label></div>
    {selected && <div className="os-rec-inline">Trade source: <SourceLink trade={selected} /></div>}
    <label className="os-rec-field"><span>Notes</span><textarea rows={5} className="form-control" placeholder="What worked? What would you change?" value={text} onChange={(e) => setText(e.target.value)} required maxLength={4000} /><small>Markdown-lite: **bold**, _emphasis_ and `code`.</small></label>
    <label className="os-rec-field"><span>Tags (comma separated)</span><input className="form-control" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="setup, mistake, emotion" maxLength={180} /></label>
    <label className="os-rec-field"><span>Screenshot (optional, up to 2 MB)</span><input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setScreenshot(e.target.files?.[0])} /></label>
    {mut.isError && <div className="os-rec-inline os-rec-rose" role="alert">{errorText(mut.error)}</div>}
    <button className="btn os-rec-btn os-rec-primary" disabled={mut.isPending || !text.trim()}><Check size={16} /> {mut.isPending ? "Saving…" : "Save journal entry"}</button>
  </form></RecordDialog>;
}
export const useJournal = () => useQuery({ queryKey: ["trade-journal"], queryFn: getTradeJournal });
