import { useMemo, useState } from "react";
import {
  createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table";
import { ArrowDownUp, ChevronLeft, ChevronRight, ClipboardCheck, Copy, Pencil, Plus, Search, Trash2, Zap } from "lucide-react";
import type { SignalRule, TradingAccount } from "@/services/automation";
import { ruleToDraft, summarizeAction, summarizeCondition } from "@/services/automation";
import { DecisionBadge, SourceBadge } from "./AutomationUI";

const col = createColumnHelper<SignalRule>();

export function RulesTable({
  rules, accounts, busyId, onEdit, onDuplicate, onDryRun, onDelete, onToggle, onCreate,
}: {
  rules: SignalRule[];
  accounts: TradingAccount[];
  busyId: string | null;
  onEdit: (rule: SignalRule) => void;
  onDuplicate: (rule: SignalRule) => void;
  onDryRun: (rule: SignalRule) => void;
  onDelete: (rule: SignalRule) => void;
  onToggle: (rule: SignalRule) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [page, setPage] = useState({ pageIndex: 0, pageSize: 6 });
  const visible = useMemo(() => rules.filter((rule) => {
    const draft = ruleToDraft(rule, accounts);
    const text = `${rule.name} ${rule.channel} ${rule.conditionSummary} ${draft.symbols.join(" ")}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (status === "all" || (status === "active" ? rule.enabled : status === "paused" ? !rule.enabled && draft.status !== "draft" : !rule.enabled))
      && (source === "all" || draft.sources.includes(source as never));
  }), [rules, accounts, query, status, source]);

  const columns = useMemo(() => [
    col.display({
      id: "name", header: "Rule", enableSorting: true,
      cell: ({ row }) => {
        const rule = row.original;
        return <button type="button" className="os-auto-rule-name" onClick={() => onEdit(rule)}>
          <span className={`os-auto-listen ${rule.enabled ? "is-on" : ""}`} aria-hidden />
          <span><b>{rule.name}</b><small>{ruleToDraft(rule, accounts).description}</small></span>
        </button>;
      },
    }),
    col.display({
      id: "trigger", header: "Trigger",
      cell: ({ row }) => {
        const draft = ruleToDraft(row.original, accounts);
        return <div className="os-auto-cell-stack">{draft.sources.map((item) => <SourceBadge key={item} source={item} channel={draft.channels[0]} />)}<small>{draft.channels[0] ?? "Any channel"}</small></div>;
      },
    }),
    col.display({
      id: "condition", header: "IF · Conditions",
      cell: ({ row }) => <button type="button" className="os-auto-summary-button" title="Open rule to edit conditions" onClick={() => onEdit(row.original)}>{summarizeCondition(ruleToDraft(row.original, accounts))}</button>,
    }),
    col.display({
      id: "action", header: "THEN · Action",
      cell: ({ row }) => <span className="os-auto-action-summary">{summarizeAction(ruleToDraft(row.original, accounts), accounts)}</span>,
    }),
    col.accessor("firedToday", { header: "Fired", cell: ({ getValue }) => <span className="os-auto-number">{getValue()}</span> }),
    col.accessor("lastDecision", { header: "Last decision", cell: ({ getValue }) => <DecisionBadge decision={getValue()} /> }),
    col.display({
      id: "state", header: "State",
      cell: ({ row }) => <button type="button" className={`os-auto-toggle ${row.original.enabled ? "is-on" : ""}`} role="switch" aria-checked={row.original.enabled} aria-label={`${row.original.enabled ? "Pause" : "Activate"} ${row.original.name}`} disabled={busyId === row.original.id} onClick={() => onToggle(row.original)}><span /></button>,
    }),
    col.display({
      id: "actions", header: "Actions",
      cell: ({ row }) => <div className="os-auto-row-actions">
        <button type="button" aria-label={`Edit ${row.original.name}`} title="Edit" disabled={!!busyId} onClick={() => onEdit(row.original)}><Pencil size={14}/></button>
        <button type="button" aria-label={`Duplicate ${row.original.name}`} title="Duplicate" disabled={!!busyId} onClick={() => onDuplicate(row.original)}><Copy size={14}/></button>
        <button type="button" aria-label={`Dry run ${row.original.name}`} title="Dry run" disabled={!!busyId} onClick={() => onDryRun(row.original)}><ClipboardCheck size={14}/></button>
        <button type="button" aria-label={`Delete ${row.original.name}`} title="Delete" className="is-danger" disabled={!!busyId} onClick={() => onDelete(row.original)}><Trash2 size={14}/></button>
      </div>,
    }),
  ], [accounts, busyId, onDelete, onDryRun, onDuplicate, onEdit, onToggle]);

  const table = useReactTable({
    data: visible, columns, state: { sorting, pagination: page }, onSortingChange: setSorting,
    onPaginationChange: setPage, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
  });

  const reset = () => { setQuery(""); setStatus("all"); setSource("all"); setPage((p) => ({ ...p, pageIndex: 0 })); };
  const hasFilters = query || status !== "all" || source !== "all";

  return <section className="os-auto-panel os-auto-rules" id="rules" aria-labelledby="auto-rules-heading">
    <header className="os-auto-panel-head">
      <div>
        <span className="os-auto-eyebrow">02 · RULE REGISTRY</span>
        <h2 id="auto-rules-heading">Automation rules <span className="os-auto-count">{rules.length} / 30</span></h2>
        <p>Every rule is evaluated in order. Changes are local until a broker backend is connected.</p>
      </div>
      <button type="button" className="os-auto-primary" onClick={onCreate}><Plus size={15}/> New rule</button>
    </header>
    <div className="os-auto-rule-toolbar">
      <label className="os-auto-search"><Search size={14}/><input aria-label="Search rules" placeholder="Search rules, channels or symbols…" value={query} onChange={(event) => { setQuery(event.target.value); table.setPageIndex(0); }}/></label>
      <div className="os-auto-seg" role="group" aria-label="Filter rules by state">
        {[["all", "All"], ["active", "Active"], ["paused", "Paused"], ["draft", "Drafts"]].map(([key, label]) => <button type="button" key={key} className={status === key ? "is-on" : ""} onClick={() => { setStatus(key); table.setPageIndex(0); }}>{label}</button>)}
      </div>
      <label className="os-auto-select">Source <select aria-label="Filter rules by source" value={source} onChange={(event) => { setSource(event.target.value); table.setPageIndex(0); }}>
        <option value="all">All sources</option><option value="telegram">Telegram</option><option value="webhook">TradingView</option><option value="copyfactory">CopyFactory</option><option value="email">Email</option>
      </select></label>
      {hasFilters && <button type="button" className="os-auto-text-button" onClick={reset}>Clear filters</button>}
    </div>
    {visible.length === 0 ? <div className="os-auto-empty"><Search size={24}/><b>No rules match these filters</b><p>Clear the filters or create a new local rule.</p><button type="button" className="os-auto-secondary" onClick={reset}>Reset filters</button></div> :
      <div className="os-auto-table-wrap"><table className="os-auto-table"><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} scope="col">{header.column.getCanSort() ? <button type="button" onClick={header.column.getToggleSortingHandler()}>{flexRender(header.column.columnDef.header, header.getContext())}<ArrowDownUp size={10}/></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
        <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className={busyId === row.original.id ? "is-busy" : ""}>{row.getVisibleCells().map((cell) => <td key={cell.id} data-label={typeof cell.column.columnDef.header === "string" ? cell.column.columnDef.header : ""}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody>
      </table></div>}
    <footer className="os-auto-panel-foot"><span>{visible.length ? `${page.pageIndex * page.pageSize + 1}–${Math.min(visible.length, (page.pageIndex + 1) * page.pageSize)}` : "0"} of {visible.length} rules</span><span className="os-auto-limit"><Zap size={12}/>{30 - rules.length} rule slots free</span><div className="os-auto-pager"><button type="button" aria-label="Previous rules page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft size={14}/></button><span>Page {page.pageIndex + 1} / {Math.max(1, table.getPageCount())}</span><button type="button" aria-label="Next rules page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight size={14}/></button></div></footer>
  </section>;
}
