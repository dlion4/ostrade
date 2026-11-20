import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Columns3, Download, Filter, Search, X } from "lucide-react";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState } from "@tanstack/react-table";
import { BrokerBadge } from "@/components/DashboardShell";
import { eatDay, netPnl, type ExportFormat, type JournalNote, type TradeRecord } from "@/services/records";
import { brokerName, duration, eatTime, price, ratio, shortDate, tone, usd } from "./recordsView";

export const noteMatches = (note: JournalNote, trade: TradeRecord) => note.tradeId === trade.id || (!!trade.positionId && note.positionId === trade.positionId);
export function SourceLink({ trade }: { trade: Pick<TradeRecord, "source" | "sourceName" | "sourceRef"> }) {
  const icon = <ArrowUpRight size={12} />;
  const props = { className: "os-rec-source" };
  if (trade.source === "Schedule") return <Link to="/dashboard/scheduler" search={{ recordSource: trade.sourceRef }} {...props}>{trade.sourceName}{icon}</Link>;
  if (trade.source === "Signal") return <Link to="/dashboard/signals" search={{ recordSource: trade.sourceRef }} {...props}>{trade.sourceName}{icon}</Link>;
  if (trade.source === "Automation") return <Link to="/dashboard/automation" search={{ recordSource: trade.sourceRef }} {...props}>{trade.sourceName}{icon}</Link>;
  if (trade.source === "AI") return <span>{trade.sourceName}</span>;
  return <Link to="/dashboard/trade" {...props}>{trade.sourceName}{icon}</Link>;
}

export const defaultFilters = { search: "", broker: "", account: "", symbol: "", source: "", outcome: "", min: "", max: "", from: "", to: "" };
export type RecordFilters = typeof defaultFilters;
export function filterHistory(trades: TradeRecord[], f: RecordFilters) {
  const q = f.search.toLowerCase().trim();
  return trades.filter((r) => {
    const net = netPnl(r), date = eatDay(r.closedAt);
    return (!q || [r.ref, r.symbol, r.accountLabel, r.sourceName].some((v) => v.toLowerCase().includes(q))) &&
      (!f.broker || r.broker === f.broker) && (!f.account || r.accountId === f.account) && (!f.symbol || r.symbol === f.symbol) && (!f.source || r.source === f.source) &&
      (!f.outcome || (f.outcome === "win" ? net > 0 : f.outcome === "loss" ? net < 0 : net === 0)) &&
      (!f.min || net >= Number(f.min)) && (!f.max || net <= Number(f.max)) && (!f.from || date >= f.from) && (!f.to || date <= f.to);
  });
}

const moneyCell = (amount: number) => <strong className={`os-rec-num ${tone(amount)}`}>{usd(amount, true)}</strong>;
const priceCell = (first: number, second: number) => <span className="os-rec-num os-rec-price">{price(first)} <ArrowRight size={12} /> {price(second)}</span>;

export function TradeHistory({ rows, universe, filters, setFilters, notes, open, onExport }: {
  rows: TradeRecord[]; universe: TradeRecord[]; filters: RecordFilters; setFilters: (filters: RecordFilters) => void;
  notes: JournalNote[]; open: (trade: TradeRecord) => void; onExport: (format: ExportFormat, ids: string[]) => void;
}) {
  const [more, setMore] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "closedAt", desc: true }]);
  const [visibility, setVisibility] = useState<VisibilityState>({ size: false, stops: false, gross: false, charges: false, duration: false, source: false });
  const exportDetails = useRef<HTMLDetailsElement>(null);
  const columnDefs = useMemo<ColumnDef<TradeRecord>[]>(() => [
    { accessorKey: "closedAt", header: "Closed at · EAT", cell: ({ row }) => <span className="os-rec-date"><strong>{shortDate(row.original.closedAt)}</strong><small>{eatTime(row.original.closedAt)}</small></span> },
    { accessorKey: "symbol", header: "Instrument", cell: ({ row }) => <button type="button" className="os-rec-text-btn os-rec-instrument" aria-label={`Open trade ${row.original.symbol} ${row.original.ref}`} onClick={(e) => { e.stopPropagation(); open(row.original); }}>{row.original.symbol}<small>{row.original.ref}</small></button> },
    { accessorKey: "broker", header: "Broker", cell: ({ row }) => <BrokerBadge broker={row.original.broker} label={brokerName[row.original.broker] ?? row.original.broker} /> },
    { accessorKey: "accountLabel", header: "Account" },
    { accessorKey: "side", header: "Side", cell: ({ row }) => <span className={`os-rec-pill ${row.original.side === "BUY" ? "os-rec-green" : "os-rec-rose"}`}>{row.original.side}</span> },
    { accessorKey: "size", header: "Size", cell: ({ row }) => `${row.original.size} ${row.original.sizeUnit}` },
    { accessorKey: "entry", header: "Entry → exit", cell: ({ row }) => priceCell(row.original.entry, row.original.exit) },
    { id: "stops", header: "SL → TP", enableSorting: false, cell: ({ row }) => priceCell(row.original.sl, row.original.tp) },
    { accessorKey: "gross", header: "Gross P&L", cell: ({ row }) => moneyCell(row.original.gross) },
    { id: "charges", header: "Comm. / swap", enableSorting: false, cell: ({ row }) => `${usd(row.original.commission)} / ${usd(row.original.swap)}` },
    { id: "net", accessorFn: netPnl, header: "Net P&L", cell: ({ row }) => moneyCell(netPnl(row.original)) },
    { id: "r", accessorFn: (r) => ratio(r) ?? undefined, header: "R multiple", cell: ({ row }) => { const r = ratio(row.original); return <span className={r === null ? "os-rec-muted" : tone(r)}>{r === null ? "—" : `${r > 0 ? "+" : ""}${r.toFixed(2)}R`}</span>; } },
    { id: "duration", accessorFn: (r) => duration(r) ?? undefined, header: "Duration", cell: ({ row }) => duration(row.original) === null ? "—" : `${duration(row.original)} min` },
    { id: "source", accessorFn: (r) => r.sourceName, header: "Attribution", cell: ({ row }) => <SourceLink trade={row.original} /> },
    { id: "note", header: "Journal", enableSorting: false, cell: ({ row }) => { const count = notes.filter((n) => noteMatches(n, row.original)).length; return count ? <span className="os-rec-note-indicator" title={`${count} journal ${count === 1 ? "note" : "notes"}`} aria-label={`${count} journal notes`}><BookOpen size={14} /></span> : "—"; } },
  ], [notes, open]);
  const table = useReactTable({ data: rows, columns: columnDefs, state: { sorting, columnVisibility: visibility }, initialState: { pagination: { pageSize: 6 } }, onSortingChange: setSorting, onColumnVisibilityChange: setVisibility, getRowId: (row) => row.id, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel() });
  const page = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const set = (key: keyof RecordFilters, value: string) => { table.setPageIndex(0); setFilters({ ...filters, ...(key === "broker" ? { account: "" } : {}), [key]: value }); };
  const choices = (key: keyof RecordFilters, label: string, options: [string, string][]) => <label className="os-rec-field"><span>{label}</span><select className="form-select form-select-sm" value={filters[key]} onChange={(e) => set(key, e.target.value)}><option value="">All {label.toLowerCase()}</option>{options.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label>;
  const active = Object.entries(filters).filter(([key, v]) => key !== "search" && !!v).length;
  return <div className="os-rec-card os-rec-ledger">
    <div className="os-rec-toolbar">
      <label className="os-rec-search"><Search size={16} /><input className="form-control form-control-sm" aria-label="Search trades" placeholder="Search symbol, account or reference…" value={filters.search} onChange={(e) => set("search", e.target.value)} />{filters.search && <button className="os-rec-text-btn" aria-label="Clear search" onClick={() => set("search", "")}><X size={14} /></button>}</label>
      <div className="os-rec-actions">
        <button className="btn os-rec-btn" type="button" aria-expanded={more} onClick={() => setMore(!more)}><Filter size={15} /> Filters {active ? <span className="os-rec-pill os-rec-orange">{active}</span> : null}</button>
        <details className="os-rec-dropdown"><summary className="btn os-rec-btn"><Columns3 size={15} /> Columns</summary><div className="os-rec-menu" aria-label="Table columns">{table.getAllLeafColumns().map((c) => <label key={c.id}><input type="checkbox" className="form-check-input" checked={c.getIsVisible()} disabled={c.getIsVisible() && table.getVisibleLeafColumns().length === 1} onChange={c.getToggleVisibilityHandler()} /> {String(c.columnDef.header)}</label>)}</div></details>
        <details className="os-rec-dropdown" ref={exportDetails}><summary className="btn os-rec-btn"><Download size={15} /> Export view</summary><div className="os-rec-menu">{(["CSV", "XLSX"] as const).map((format) => <button className="os-rec-text-btn" key={format} onClick={() => { exportDetails.current?.removeAttribute("open"); onExport(format, table.getSortedRowModel().rows.map((row) => row.original.id)); }}>{format} · {rows.length} trades</button>)}</div></details>
      </div>
    </div>
    {more && <div className="os-rec-filters">
      {choices("broker", "Brokers", [...new Set(universe.map((r) => r.broker))].map((b) => [b, brokerName[b] ?? b]))}
      {choices("account", "Accounts", [...new Map(universe.filter((r) => !filters.broker || r.broker === filters.broker).map((r) => [r.accountId, r.accountLabel]))])}
      {choices("symbol", "Symbols", [...new Set(universe.map((r) => r.symbol))].sort().map((s) => [s, s]))}
      {choices("source", "Sources", [...new Set(universe.map((r) => r.source))].sort().map((s) => [s, s]))}
      {choices("outcome", "Outcomes", [["win", "Win"], ["loss", "Loss"], ["flat", "Flat"]])}
      {([['from', 'From date (EAT)', 'date'], ['to', 'To date (EAT)', 'date'], ['min', 'Min net P&L (USD)', 'number'], ['max', 'Max net P&L (USD)', 'number']] as const).map(([key, label, type]) => <label className="os-rec-field" key={key}><span>{label}</span><input className="form-control form-control-sm" value={filters[key]} type={type} step={type === "number" ? "0.01" : undefined} onChange={(e) => set(key, e.target.value)} /></label>)}
      <button className="btn os-rec-btn align-self-end" onClick={() => { table.setPageIndex(0); setFilters(defaultFilters); }}>Reset filters</button>
    </div>}
    <div className="os-rec-scroll os-rec-history-scroll" role="region" aria-label="Trade history table" tabIndex={0}>
      <table className="table os-rec-table os-rec-history-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((h) => <th key={h.id} aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}>{h.column.getCanSort() ? <button className="os-rec-text-btn" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header, h.getContext())}{h.column.getIsSorted() === "asc" ? <ArrowUp size={12} /> : h.column.getIsSorted() === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={11} className="os-rec-sort" />}</button> : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
      <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) open(row.original); }}>{row.getVisibleCells().map((c) => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>)}
      {!rows.length && <tr><td colSpan={table.getVisibleLeafColumns().length}><div className="os-rec-empty">No trades match this view. Try another date range or clear the filters.</div></td></tr>}</tbody></table>
    </div>
    <div className="os-rec-table-foot"><span>{rows.length ? `Showing ${page * 6 + 1}–${Math.min((page + 1) * 6, rows.length)} of ${rows.length} trades` : "0 trades"}</span><div className="os-rec-actions"><button className="btn os-rec-btn os-rec-square" disabled={!table.getCanPreviousPage()} aria-label="Previous page" onClick={() => table.previousPage()}><ChevronLeft size={16} /></button><span>{pageCount ? page + 1 : 0} / {pageCount}</span><button className="btn os-rec-btn os-rec-square" disabled={!table.getCanNextPage()} aria-label="Next page" onClick={() => table.nextPage()}><ChevronRight size={16} /></button></div></div>
  </div>;
}

export function TradeDetails({ trade, notes, onJournal }: { trade: TradeRecord; notes: JournalNote[]; onJournal: () => void }) {
  const [tab, setTab] = useState("Lifecycle");
  const items: [string, ReactNode][] = [["Account", trade.accountLabel], ["Direction · size", `${trade.side} · ${trade.size} ${trade.sizeUnit}`], ["Initial stop / target", priceCell(trade.sl, trade.tp)], ["Attribution", <SourceLink trade={trade} />], ["Realized R", ratio(trade)?.toFixed(2) ?? "Not recorded"], ["Duration", duration(trade) === null ? "Not recorded" : `${duration(trade)} min`]];
  return <div className="os-rec-detail">
    <div className="os-rec-detail-summary"><BrokerBadge broker={trade.broker} label={brokerName[trade.broker] ?? trade.broker} /><span className="os-rec-pill os-rec-orange">{trade.environment === "paper" ? "SIMULATED" : "MOCK RECORD"}</span><strong className={tone(netPnl(trade))}>{usd(netPnl(trade), true)}</strong></div>
    <div className="os-rec-segments" role="group" aria-label="Trade detail view">{["Lifecycle", "Fills", "Ledger", "Journal"].map((s) => <button key={s} aria-pressed={s === tab} onClick={() => setTab(s)}>{s}</button>)}</div>
    {tab === "Lifecycle" && <><div className="os-rec-timeline"><div><strong>Position opened</strong><small>{trade.openedAt ? `${shortDate(trade.openedAt)} · ${eatTime(trade.openedAt)} EAT` : "Opening timestamp not recorded"}</small></div><div><strong>Position closed</strong><small>{shortDate(trade.closedAt)} · {eatTime(trade.closedAt)} EAT</small></div></div><dl>{items.map(([name, content]) => <div key={name}><dt>{name}</dt><dd>{content}</dd></div>)}</dl></>}
    {tab === "Fills" && <dl><div><dt>Entry fill price</dt><dd>{price(trade.entry)}</dd></div><div><dt>Exit fill price</dt><dd>{price(trade.exit)}</dd></div><div><dt>Closed quantity</dt><dd>{trade.size} {trade.sizeUnit}</dd></div></dl>}
    {tab === "Ledger" && <dl>{([["Gross realized P&L", trade.gross], ["Commission", trade.commission], ["Swap / financing", trade.swap], ["Net realized USD", netPnl(trade)]] as const).map(([name, n]) => <div key={name}><dt>{name}</dt><dd>{moneyCell(n)}</dd></div>)}</dl>}
    {tab === "Journal" && <div className="os-rec-flow">{notes.length ? notes.map((note) => <div className="os-rec-inset" key={note.id}><small>{shortDate(note.date)} · {note.tags.join(", ")}</small><p>{note.text}</p></div>) : <p className="os-rec-muted">No notes are attached to this trade.</p>}<button className="btn os-rec-btn os-rec-primary" onClick={onJournal}><BookOpen size={15} /> Write a trade note</button></div>}
  </div>;
}
