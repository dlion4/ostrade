import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDownUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Inbox,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  eatTime,
  type DeskSignal,
  type SourceKey,
} from "@/services/signalDesk";
import {
  InstrumentMark,
  SourceMark,
  Status,
  formatPnl,
  sourceNames,
} from "./DeskUI";

const col = createColumnHelper<DeskSignal>();
export function SignalInbox({
  rows,
  selection,
  setSelection,
  onDetail,
  onReview,
  snapshot,
  accountNames,
}: {
  rows: DeskSignal[];
  selection: RowSelectionState;
  setSelection: (v: RowSelectionState) => void;
  onDetail: (r: DeskSignal) => void;
  onReview: (r: DeskSignal[]) => void;
  snapshot: number;
  accountNames: Record<string, string>;
}) {
  const [tab, setTab] = useState("All signals"),
    [search, setSearch] = useState(""),
    [filters, openFilters] = useState(false),
    [expandedColumns, setExpandedColumns] = useState(false),
    [source, setSource] = useState("All"),
    [day, setDay] = useState("Any date"),
    [status, setStatus] = useState("Any status"),
    [sorting, setSorting] = useState<SortingState>([]),
    [page, setPage] = useState({ pageIndex: 0, pageSize: 5 });
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === "All signals" || r.status === tab) &&
          (status === "Any status" || r.status === status) &&
          (source === "All" || r.order.source === source) &&
          (day === "Any date" ||
            (day === "Today"
              ? new Date(r.time + 10800000).toISOString().slice(0, 10) ===
                new Date(snapshot + 10800000).toISOString().slice(0, 10)
              : new Date(r.time + 10800000).toISOString().slice(0, 10) !==
                new Date(snapshot + 10800000).toISOString().slice(0, 10))) &&
          `${r.order.symbol} ${r.feed} ${r.id} ${r.raw}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [rows, tab, search, status, source, day, snapshot],
  );
  const columns = useMemo(
    () => [
      col.display({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select eligible signals on this page"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.id}`}
            disabled={!row.getCanSelect()}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      }),
      col.accessor((r) => r.order.symbol, {
        id: "instrument",
        header: "Instrument",
        cell: ({ row }) => (
          <button
            type="button"
            className="os-symbol-cell"
            onClick={() => onDetail(row.original)}
          >
            <InstrumentMark symbol={row.original.order.symbol} small />
            <span>
              <b>{row.original.order.symbol || "Unresolved"}</b>
              <small>{row.original.id}</small>
            </span>
          </button>
        ),
      }),
      col.accessor((r) => r.order.source, {
        id: "source",
        header: "Source",
        cell: (i) => (
          <span className="os-source-cell">
            <SourceMark source={i.getValue()} small />
            {sourceNames[i.getValue()]}
          </span>
        ),
      }),
      col.accessor((r) => r.order.side, {
        id: "side",
        header: "Side",
        cell: (i) => (
          <span className={`os-side-text os-${i.getValue().toLowerCase()}`}>
            {i.getValue() || "N/A"}
          </span>
        ),
      }),
      col.accessor((r) => r.order.entry, {
        id: "entry",
        header: "Entry price",
        cell: (i) => (
          <span className="os-number">
            {i.getValue().toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 5,
            })}
          </span>
        ),
      }),
      col.accessor("status", {
        header: "Status",
        cell: (i) => <Status value={i.getValue()} />,
      }),
      col.accessor("time", {
        header: "Received",
        cell: (i) => (
          <time className="os-table-time">{eatTime(i.getValue())}</time>
        ),
      }),
      col.accessor("raw", {
        header: "Raw excerpt",
        cell: (i) => (
          <button
            type="button"
            className="os-excerpt-toggle"
            title="Read the original signal"
            onClick={() => onDetail(i.row.original)}
          >
            {i.getValue()}
          </button>
        ),
      }),
      col.display({
        id: "exits",
        header: "SL / TP",
        cell: (i) => (
          <span className="os-number">
            {i.row.original.order.sl || "None"} /{" "}
            {i.row.original.order.targets.join(", ") || "None"}
          </span>
        ),
      }),
      col.display({
        id: "accounts",
        header: "Accounts",
        cell: (i) =>
          i.row.original.accounts.length
            ? i.row.original.accounts.map((id) => (
                <span key={id} className="os-count">
                  {accountNames[id] || id}
                </span>
              ))
            : "Unassigned",
      }),
      col.accessor("pnl", {
        header: "Attributed P&L",
        cell: (i) =>
          i.getValue() === null ? (
            "Not realized"
          ) : (
            <span
              className={`os-number ${(i.getValue() ?? 0) >= 0 ? "os-up" : "os-down"}`}
            >
              {formatPnl(i.getValue() ?? 0)}
            </span>
          ),
      }),
      col.display({
        id: "action",
        header: "",
        cell: (i) => (
          <button
            type="button"
            className="os-square-btn"
            aria-label={`Details and actions for ${i.row.original.id}`}
            onClick={() => onDetail(i.row.original)}
          >
            <Ellipsis size={18} />
          </button>
        ),
      }),
    ],
    [onDetail, accountNames],
  );
  const table = useReactTable({
    data: filtered,
    columns,
    getRowId: (r) => r.id,
    state: {
      rowSelection: selection,
      pagination: page,
      sorting,
      columnVisibility: {
        raw: expandedColumns,
        exits: expandedColumns,
        accounts: expandedColumns,
        pnl: expandedColumns,
      },
    },
    enableRowSelection: (r) => ["Parsed", "Staged"].includes(r.original.status),
    onRowSelectionChange: (up) =>
      setSelection(typeof up === "function" ? up(selection) : up),
    onSortingChange: setSorting,
    onPaginationChange: setPage,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const selected = rows.filter(
    (r) => selection[r.id] && ["Parsed", "Staged"].includes(r.status),
  );
  const reset = () => {
    setSearch("");
    setSource("All");
    setDay("Any date");
    setStatus("Any status");
    setTab("All signals");
    setPage((p) => ({ ...p, pageIndex: 0 }));
  };
  return (
    <section
      className="os-desk-panel os-inbox"
      id="os-signal-inbox"
      aria-labelledby="os-inbox-heading"
    >
      <div className="os-inbox-header">
        <div className="os-title-main">
          <Inbox size={19} />
          <h2 id="os-inbox-heading">Signal inbox</h2>
          <span className="os-count">{rows.length}</span>
        </div>
        <div className="os-inbox-tools">
          <label className="os-desk-search">
            <Search size={14} />
            <input
              aria-label="Search signals"
              placeholder="Search signals..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                table.setPageIndex(0);
              }}
            />
          </label>
          <button
            type="button"
            className={`os-soft-button${filters ? " os-selected" : ""}`}
            aria-expanded={filters}
            onClick={() => openFilters((v) => !v)}
          >
            <SlidersHorizontal size={14} /> Filters
            {(source !== "All" ||
              status !== "Any status" ||
              day !== "Any date") && <i className="os-filter-dot" />}
          </button>
        </div>
      </div>
      <div className="os-inbox-tabs" role="group" aria-label="Signal status">
        {["All signals", "Staged", "Filled", "Quarantined"].map((s) => (
          <button
            type="button"
            key={s}
            className={s === tab ? "os-current" : ""}
            aria-pressed={s === tab}
            onClick={() => {
              setTab(s);
              table.setPageIndex(0);
            }}
          >
            {s}
            <span>
              {s === "All signals"
                ? rows.length
                : rows.filter((r) => r.status === s).length}
            </span>
          </button>
        ))}
      </div>
      {filters && (
        <div className="os-filter-row">
          <label className="os-columns-toggle">
            <input
              type="checkbox"
              checked={expandedColumns}
              onChange={(e) => setExpandedColumns(e.target.checked)}
            />
            Detailed columns
          </label>
          <label>
            Channel
            <select
              aria-label="Channel"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                table.setPageIndex(0);
              }}
            >
              <option value="All">All sources</option>
              {Object.keys(sourceNames).map((s) => (
                <option key={s} value={s}>
                  {sourceNames[s as SourceKey]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Received
            <select
              aria-label="Received date filter"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                table.setPageIndex(0);
              }}
            >
              {["Any date", "Today", "Earlier"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              aria-label="History status filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setTab("All signals");
                table.setPageIndex(0);
              }}
            >
              {["Any status", ...new Set(rows.map((r) => r.status))].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <button type="button" className="os-text-button" onClick={reset}>
            Reset filters
          </button>
        </div>
      )}
      {!!selected.length && (
        <div className="os-selection-bar">
          <strong>{selected.length} selected</strong>
          <button type="button" onClick={() => setSelection({})}>
            Clear
          </button>
          <button
            type="button"
            className="os-selection-review"
            onClick={() => onReview(selected)}
          >
            Review batch <ArrowRight size={13} />
          </button>
        </div>
      )}
      {filtered.length ? (
        <div className="os-inbox-scroll">
          <table
            className={`os-desk-table${expandedColumns ? " os-expanded-table" : ""}`}
          >
            <thead>
              {table.getHeaderGroups().map((g) => (
                <tr key={g.id}>
                  {g.headers.map((h) => (
                    <th key={h.id} scope="col">
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          title={`Sort by ${h.column.columnDef.header}`}
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                          {h.id === "time" && <ArrowDownUp size={10} />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((r) => (
                <tr
                  key={r.id}
                  className={r.getIsSelected() ? "os-row-selected" : ""}
                >
                  {r.getVisibleCells().map((c) => (
                    <td key={c.id}>
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="os-empty-state">
          <Search size={24} />
          <strong>No matching signals</strong>
          <p>Try a different instrument, source, or status.</p>
          <button className="os-soft-button" onClick={reset}>
            Clear filters
          </button>
        </div>
      )}
      <footer className="os-inbox-footer">
        <span>
          {filtered.length
            ? `${page.pageIndex * page.pageSize + 1}-${Math.min(filtered.length, (page.pageIndex + 1) * page.pageSize)}`
            : "0"}{" "}
          of {filtered.length} signals
        </span>
        <div>
          <span>
            Page {page.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            aria-label="Previous signals page"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            aria-label="Next signals page"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </footer>
    </section>
  );
}
