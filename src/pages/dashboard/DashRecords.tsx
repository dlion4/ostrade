import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowDownToLine, ArrowUpRight, BarChart3, BookOpen, CalendarDays, ChartNoAxesCombined, CircleCheck, ClipboardList, FlaskConical, Layers3, Network, ShieldCheck } from "lucide-react";
import { usePageStyle } from "@/hooks/usePageStyle";
import { useDashboardContext } from "@/context/DashboardContext";
import { useToast } from "@/components/Toast";
import { Distribution, Performance, RecordMetrics } from "@/components/records/Analytics";
import { Attribution } from "@/components/records/Attribution";
import { defaultFilters, filterHistory, noteMatches, TradeDetails, TradeHistory } from "@/components/records/History";
import { ExportCenter, ExportForm, JournalEditor, Reconciliation, RecordDialog, TradeJournal, useJournal, type ExportRequest } from "@/components/records/RecordTools";
import { shortDate } from "@/components/records/recordsView";
import { eatDay, getTradeRecords, queueRecordExport, type ExportFormat, type TradeRecord } from "@/services/records";
import css from "@/styles/pages/dash-records.css?inline";

const sections = [
  ["overview", "Overview", Layers3], ["performance", "Performance", ChartNoAxesCombined], ["history", "Trade history", ClipboardList], ["distribution", "Distribution", BarChart3],
  ["attribution", "Attribution", Network], ["reconciliation", "Reconciliation", ShieldCheck], ["exports", "Exports", ArrowDownToLine], ["journal", "Journal", BookOpen],
] as const;
type SectionId = (typeof sections)[number][0];
const ranges = [["1W", 7], ["1M", 30], ["3M", 90], ["YTD", 0], ["ALL", 0]] as const;
type Range = (typeof ranges)[number][0];
const empty: TradeRecord[] = [];

function Section({ id, description, action, children }: { id: SectionId; description: string; action?: ReactNode; children: ReactNode }) {
  const index = sections.findIndex((s) => s[0] === id);
  const [, title, Icon] = sections[index];
  return <section id={`records-${id}`} aria-labelledby={`records-heading-${id}`} className="os-rec-section">
    <div className="os-rec-section-head"><div className="os-rec-section-label"><span className="os-rec-section-icon"><Icon size={17} /></span><div><h2 id={`records-heading-${id}`}>{title}</h2><p>{description}</p></div></div>{action}</div>{children}
  </section>;
}
function HeroArtwork() {
  return <svg className="os-rec-hero-art" viewBox="0 0 540 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><pattern id="os-record-grid" width="29" height="29" patternUnits="userSpaceOnUse"><path d="M0 29V0H29" fill="none" stroke="currentColor" strokeOpacity=".18" /></pattern><linearGradient id="os-record-hero-fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="currentColor" stopOpacity=".19" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    <rect width="540" height="240" fill="url(#os-record-grid)" />
    <path d="M0 212 49 195 73 203 109 177 140 180 175 153 203 166 232 132 267 140 297 108 328 115 364 74 394 83 420 48 450 56 476 29 504 34 540 0V240H0Z" fill="url(#os-record-hero-fill)" />
    <path d="M0 212 49 195 73 203 109 177 140 180 175 153 203 166 232 132 267 140 297 108 328 115 364 74 394 83 420 48 450 56 476 29 504 34 540 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeOpacity=".74" />
    <path d="M0 232 55 218 82 226 119 202 147 210 184 186 219 191 253 164 288 174 318 151 353 155 389 125 423 129 449 102 482 107 510 85 540 92" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 6" strokeOpacity=".58" />
    {[ [175,153],[297,108],[364,74],[420,48],[476,29] ].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4.4" fill="var(--sd-white)" stroke="currentColor" strokeWidth="1.5" />)}
  </svg>;
}

export function DashRecordsPage() {
  usePageStyle("dash-records", css);
  const qc = useQueryClient();
  const toast = useToast();
  const { activeAccountId } = useDashboardContext();
  const records = useQuery({ queryKey: ["records", "closed"], queryFn: getTradeRecords, refetchOnMount: "always" });
  const journal = useJournal();
  const [range, setRange] = useState<Range>("1M");
  const [filters, setFilters] = useState(defaultFilters);
  const [section, setSection] = useState<SectionId>("overview");
  const [detail, setDetail] = useState<TradeRecord | null>(null);
  const [editor, setEditor] = useState<{ trade: TradeRecord | null }>();
  const [exportFormat, setExportFormat] = useState<ExportFormat>();
  const all = records.data ?? empty;
  const current = all.find((trade) => trade.accountId === activeAccountId);
  const today = eatDay(new Date());
  const days = ranges.find(([id]) => id === range)?.[1] ?? 0;
  const start = range === "ALL" ? "" : range === "YTD" ? `${today.slice(0, 4)}-01-01` : eatDay(Date.parse(`${today}T12:00:00Z`) - (days - 1) * 864e5);
  const rangeRows = useMemo(() => all.filter((r) => eatDay(r.closedAt) >= start && eatDay(r.closedAt) <= today && (activeAccountId === "all" || activeAccountId === r.accountId)), [all, start, today, activeAccountId]);
  const history = useMemo(() => filterHistory(rangeRows, filters), [rangeRows, filters]);
  const journalNotes = journal.data?.notes ?? [];
  useEffect(() => { const old = document.title; document.title = "Trade Records & Analytics | OStrade"; return () => { document.title = old; }; }, []);
  const hasRecords = Boolean(records.data);
  useEffect(() => {
    if (!hasRecords) return;
    let frame = 0;
    const targets = sections.map(([id]) => [id, document.getElementById(`records-${id}`)] as const);
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = targets.filter(([, node]) => node && node.getBoundingClientRect().top <= 145).slice(-1)[0];
        const nearEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12;
        setSection(nearEnd ? "journal" : active?.[0] ?? "overview");
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => { window.removeEventListener("scroll", update); cancelAnimationFrame(frame); };
  }, [hasRecords]);
  const navigateSection = (id: SectionId) => {
    setSection(id);
    document.getElementById(`records-${id}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  };
  const exportJob = useMutation({ mutationFn: queueRecordExport, onSuccess: () => {
    setExportFormat(undefined);
    void qc.invalidateQueries({ queryKey: ["record-exports"] });
    toast("Export queued. Download it from the local export queue when ready.");
    navigateSection("exports");
  }, onError: (err) => { if (!exportFormat) toast(err.message); } });
  const openExport = (format: ExportFormat) => { exportJob.reset(); setExportFormat(format); };
  const openTrade = useCallback((trade: TradeRecord) => setDetail(trade), []);
  const tableExport = (format: ExportFormat, ids: string[]) => exportJob.mutate({ format, tradeIds: ids, email: false, sms: false });

  return <main className="page-dash-records" aria-labelledby="records-title">
    <header className="os-rec-hero">
      <HeroArtwork />
      <div className="os-rec-hero-content"><div className="os-rec-kicker"><span><ChartNoAxesCombined size={14} /></span> PERFORMANCE WORKSPACE</div><h1 id="records-title">Trade Records <span>&amp;</span> Analytics</h1><p>Review closed trades across brokers, see what drove your results, and keep an auditable trading journal.</p>
      <div className="os-rec-hero-meta"><span className="os-rec-pill os-rec-orange"><FlaskConical size={13} /> LOCAL SIMULATION</span><span><CalendarDays size={14} /> EAT (UTC+3)</span><span><CircleCheck size={14} /> Closed trades only</span></div></div>
      <div className="os-rec-hero-actions"><button className="btn os-rec-btn" onClick={() => setEditor({ trade: null })}><BookOpen size={16} /> Add note</button><button className="btn os-rec-btn os-rec-primary" onClick={() => openExport("CSV")}><ArrowDownToLine size={16} /> Export records</button></div>
    </header>
    <nav className="os-rec-nav" aria-label="Records sections">{sections.map(([id, label, Icon]) => <button type="button" aria-current={section === id ? "location" : undefined} key={id} onClick={() => navigateSection(id)}><Icon size={15} /> {label}</button>)}</nav>
    <Section id="overview" description="Key outcomes for the selected accounts and period." action={<div className="os-rec-range"><span><CalendarDays size={14} /> {start ? `${shortDate(start)} – ${shortDate(today)}` : "All history"}</span><div className="os-rec-segments" role="group" aria-label="Reporting period">{ranges.map(([r]) => <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>)}</div></div>}>
      {activeAccountId !== "all" && <div className="os-rec-inline">Showing {current?.accountLabel ?? "the selected account"}. Change the workspace account above to see the combined book.</div>}
      {records.isPending ? <div className="os-rec-metrics" role="status" aria-label="Loading records">{Array.from({ length: 6 }, (_, i) => <div key={i} className="os-rec-card os-rec-metric os-rec-skeleton"><i /><i /><i /></div>)}</div> : records.isError ? <div className="os-rec-empty os-rec-card" role="alert">Unable to load local trade records. <button className="btn os-rec-btn" onClick={() => void records.refetch()}>Try again</button></div> : <RecordMetrics trades={rangeRows} />}
    </Section>
    {!records.isPending && !records.isError && <>
      <Section id="performance" description="Track realized results over time, after commission and swap." action={<span className="os-rec-chip"><Activity size={14} /> USD · Realized only</span>}><Performance trades={rangeRows} /></Section>
      <Section id="history" description="One ledger for every closed trade across your accounts." action={<span className="os-rec-chip"><Layers3 size={14} /> {history.length} records</span>}><TradeHistory rows={history} universe={rangeRows} filters={filters} setFilters={setFilters} notes={journalNotes} open={openTrade} onExport={tableExport} /></Section>
      <Section id="distribution" description="See the shape of returns and where each instrument contributed."><Distribution trades={rangeRows} /></Section>
      <Section id="attribution" description="See which signals, rules, schedules and manual decisions are driving your returns."><Attribution trades={rangeRows} /></Section>
      <Section id="reconciliation" description="Check broker statements for gaps, duplicates or value differences."><Reconciliation /></Section>
      <Section id="exports" description="Build downloadable records and reports entirely in this browser."><ExportCenter open={openExport} /></Section>
      <Section id="journal" description="Keep trade-level notes and daily reflections beside the numbers.">{journal.isError ? <div className="os-rec-empty os-rec-card">Unable to load the journal. <button className="btn os-rec-btn" onClick={() => void journal.refetch()}>Retry</button></div> : journal.isPending ? <div className="os-rec-empty os-rec-card" role="status">Loading journal…</div> : <TradeJournal notes={journalNotes} trades={all} digestEnabled={journal.data?.digestEnabled ?? false} open={() => setEditor({ trade: null })} onTrade={openTrade} />}</Section>
      <footer className="os-rec-footer"><span><FlaskConical size={14} /> OStrade local workspace · No live broker feed</span><button className="os-rec-text-btn" onClick={() => document.getElementById("dash-main")?.scrollIntoView({ behavior: "smooth" })}>Back to top <ArrowUpRight size={14} /></button></footer>
    </>}
    {detail && <RecordDialog title={`${detail.symbol} trade`} eyebrow={detail.ref} drawer close={() => setDetail(null)}><TradeDetails trade={detail} notes={journalNotes.filter((note) => noteMatches(note, detail))} onJournal={() => { setEditor({ trade: detail }); setDetail(null); }} /></RecordDialog>}
    {editor && <JournalEditor trade={editor.trade} trades={all} close={() => setEditor(undefined)} />}
    {exportFormat && <ExportForm initial={exportFormat} allCount={all.length} filtered={history.map((r) => r.id)} pending={exportJob.isPending} error={exportJob.error} close={() => setExportFormat(undefined)} submit={(request: ExportRequest) => exportJob.mutate(request)} />}
    <span className="visually-hidden">Historical snapshots do not update with market prices.</span>
  </main>;
}
