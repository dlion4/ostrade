import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Bell,
  BellPlus,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Filter,
  FilterX,
  Flame,
  GitCompareArrows,
  Info,
  LineChart,
  Loader2,
  Minus,
  MousePointer2,
  Plus,
  Radar,
  Search,
  SearchX,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import { BrokerBadge, EnvPill } from "@/components/DashboardShell";
import { CandleChart, type DrawMode, type Drawing } from "@/components/markets/CandleChart";
import { QueryError } from "@/components/QueryError";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  createEventGuardSchedule,
  createSchedule,
  getAccounts,
  getEconomicEvents,
  type BrokerKey,
  type DashboardMutationOutcome,
  type TradingAccount,
} from "@/services/dashboard";
import {
  ASSET_CLASSES,
  TIMEFRAMES,
  confirmSymbolMapping,
  createPriceAlert,
  getCandles,
  getMarketSymbol,
  getMarketUniverse,
  getPriceAlerts,
  getRecentTicks,
  getSymbolMappings,
  getWatchlist,
  matchesSymbolQuery,
  removePriceAlert,
  resolveSymbol,
  resolvedCanonical,
  saveWatchlist,
  stageTicketDraft,
  type AlertCondition,
  type AssetClass,
  type MarketSymbol,
  type ResolutionResult,
  type Timeframe,
} from "@/services/markets";
import css from "@/styles/pages/dash-markets.css?inline";

/* ── Helpers ─────────────────────────────────────────────── */

function Skel({ h = 18, w = "100%" }: { h?: number; w?: number | string }) {
  return <span className="os-skel" style={{ height: h, width: w }} aria-hidden />;
}

function fmtPrice(v: number, digits: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function brokerAsk(s: MarketSymbol, broker: BrokerKey): number | null {
  const spread = s.spreads[broker];
  if (spread === undefined || !s.brokerSymbols[broker]) return null;
  return Number((s.bid + spread * s.pip).toFixed(s.digits));
}

function Spark({ values, up, w = 110, h = 30 }: { values: number[]; up: boolean; w?: number; h?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="os-mk-spark" aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? "var(--os-up)" : "var(--os-down)"} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SectionTitle({ id, eyebrow, title, sub, right }: { id: string; eyebrow: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="os-mk-head">
      <div>
        <span className="os-mk-eyebrow">{eyebrow}</span>
        <h2 id={id} className="os-mk-h2">{title}</h2>
        {sub && <p className="os-mk-sub">{sub}</p>}
      </div>
      {right && <div className="os-mk-head-right">{right}</div>}
    </div>
  );
}

function OutcomeBanner({ outcome, onClose }: { outcome: DashboardMutationOutcome; onClose: () => void }) {
  return (
    <div className={`os-mk-outcome is-${outcome.mode}`} role="status">
      {outcome.mode === "simulated" ? <Check size={17} aria-hidden /> : outcome.mode === "blocked" ? <AlertTriangle size={17} aria-hidden /> : <Info size={17} aria-hidden />}
      <div className="flex-grow-1"><strong className="d-block">{outcome.title}</strong><span className="small">{outcome.detail}</span></div>
      <span className="os-mk-outcome-badge os-mono">{outcome.mode === "simulated" ? "SIMULATED" : outcome.mode === "blocked" ? "BLOCKED" : "BACKEND REQUIRED"}</span>
      <button type="button" className="os-icon-btn" onClick={onClose} aria-label="Dismiss notice"><X size={15} /></button>
    </div>
  );
}

/* ── Shared page model ───────────────────────────────────── */

interface MarketsModel {
  universe: MarketSymbol[];
  resolved: MarketSymbol[];
  contextAccounts: TradingAccount[];
  resolvedBrokers: BrokerKey[];
  watchlist: string[];
  setWatchlist: (next: string[], message?: string) => void;
  focus: (canonical: string, scroll?: boolean) => void;
  openDrawer: (canonical: string) => void;
  trade: (canonical: string, side?: "BUY" | "SELL") => void;
  eventSymbols: Set<string>;
  focused: string;
}

function MarketsHeader() {
  return (
    <header className="os-mk-section">
    <div className="os-mk-intro">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="os-mk-eyebrow">T-2 · MULTI-BROKER EXPLORER</span>
            <span className="os-mk-static">STATIC SNAPSHOT · 16:40 EAT · NO LIVE TICKING</span>
          </div>
          <h1 id="os-mk-title" className="os-mk-h1">Markets</h1>
          <p className="os-mk-lead">Every tradable symbol from every connected account, one quote view, one chart, and broker-specific specs side by side.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/dashboard/trade" className="os-btn os-btn-primary os-btn-sm"><Send size={15} aria-hidden /> Trade Ticket (T-3)</Link>
          <Link to="/dashboard/signals" className="os-btn os-btn-ghost os-btn-sm">Signal Desk (T-4)</Link>
        </div>
      </div>

    </header>
  );
}

/* ── S1 · Account Context Bar ────────────────────────────── */

type EnvFilter = "all" | "paper" | "demo" | "live";

function ContextBar({
  accounts, selectedIds, setSelectedIds, envFilter, setEnvFilter, brokerFilter, setBrokerFilter, resolvedCount, contextAccounts, allBrokers,
}: {
  accounts: TradingAccount[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  envFilter: EnvFilter;
  setEnvFilter: (e: EnvFilter) => void;
  brokerFilter: BrokerKey[];
  setBrokerFilter: (b: BrokerKey[]) => void;
  resolvedCount: number;
  contextAccounts: TradingAccount[];
  allBrokers: { key: BrokerKey; name: string }[];
}) {
  const toast = useToast();
  const connected = accounts.filter((a) => a.connected);
  const standby = accounts.filter((a) => !a.connected);
  const allSelected = selectedIds.length === connected.length;

  const toggleAccount = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    if (next.length === 0) {
      toast("At least one account must stay in context");
      return;
    }
    setSelectedIds(next);
  };

  return (
    <section className="os-mk-section" aria-label="Account context">
      <div className="os-ctx-bar">
        <div className="os-ctx-row">
          <span className="os-ctx-label">Active context</span>
          <div className="os-ctx-chips" role="group" aria-label="Accounts in context">
            <button type="button" className={`os-ctx-chip ${allSelected ? "is-on" : ""}`} onClick={() => { setSelectedIds(connected.map((a) => a.id)); toast("Context: all connected accounts"); }}>
              ALL ({connected.length})
            </button>
            {connected.map((a) => (
              <button key={a.id} type="button" aria-pressed={selectedIds.includes(a.id)} className={`os-ctx-chip ${selectedIds.includes(a.id) ? "is-on" : ""}`} onClick={() => toggleAccount(a.id)}>
                <BrokerBadge broker={a.broker} label={a.brokerName} /> {a.label}
              </button>
            ))}
            {standby.length > 0 && (
              <Link to="/dashboard/accounts" className="os-ctx-chip is-standby">+{standby.length} standby · link in T-9</Link>
            )}
          </div>
        </div>
        <div className="os-ctx-row">
          <span className="os-ctx-label">Environment</span>
          <div className="os-mk-seg" role="group" aria-label="Environment filter">
            {(["all", "paper", "demo", "live"] as EnvFilter[]).map((e) => (
              <button key={e} type="button" className={envFilter === e ? "is-on" : ""} onClick={() => setEnvFilter(e)}>
                {e === "all" ? "All" : e === "paper" ? "Paper" : e === "demo" ? "Demo" : "Live"}
              </button>
            ))}
          </div>
          <span className="os-ctx-label ms-lg-3">Brokers</span>
          <div className="os-ctx-chips" role="group" aria-label="Broker filter">
            {allBrokers.map((b) => {
              const on = brokerFilter.length === 0 || brokerFilter.includes(b.key);
              return (
                <button key={b.key} type="button" aria-pressed={on} className={`os-ctx-chip is-sm ${on ? "is-on" : ""}`} onClick={() => {
                  const base = brokerFilter.length === 0 ? allBrokers.map((x) => x.key) : brokerFilter;
                  const next = base.includes(b.key) ? base.filter((k) => k !== b.key) : [...base, b.key];
                  if (next.length === 0) { toast("Keep at least one broker selected"); return; }
                  setBrokerFilter(next.length === allBrokers.length ? [] : next);
                }}>
                  {on ? <Check size={12} aria-hidden /> : <Minus size={12} aria-hidden />} {b.name}
                </button>
              );
            })}
          </div>
          <div className="os-ctx-resolved" aria-live="polite">
            <Radar size={15} aria-hidden />
            <strong className="os-mono">{resolvedCount}</strong> symbols across <strong className="os-mono">{contextAccounts.length}</strong> account{contextAccounts.length === 1 ? "" : "s"}
          </div>
        </div>
        {envFilter === "live" && contextAccounts.length === 0 && (
          <div className="os-mk-note is-warn">
            <AlertTriangle size={16} aria-hidden />
            <span>No live account is connected in this frontend preview. Deriv Real CR and Exness Raw Spread are configured as live-ready slots — link them in <Link to="/dashboard/accounts">T-9 Accounts</Link>.</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── S2 · Watchlist Grid ─────────────────────────────────── */

function WatchlistSection({ model }: { model: MarketsModel }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [overTarget, setOverTarget] = useState<string | null>(null);
  const bySym = useMemo(() => new Map(model.universe.map((s) => [s.canonical, s])), [model.universe]);
  const items = model.watchlist.map((c) => bySym.get(c)).filter((x): x is MarketSymbol => !!x);
  const primaryBroker = (s: MarketSymbol): BrokerKey | null => model.resolvedBrokers.find((b) => s.brokerSymbols[b]) ?? null;

  const move = (canonical: string, delta: number) => {
    const i = model.watchlist.indexOf(canonical);
    const j = i + delta;
    if (j < 0 || j >= model.watchlist.length) return;
    const next = [...model.watchlist];
    [next[i], next[j]] = [next[j], next[i]];
    model.setWatchlist(next, `${canonical} moved ${delta < 0 ? "left" : "right"}`);
  };

  const drop = (target: string) => {
    if (!dragging || dragging === target) return;
    const next = model.watchlist.filter((c) => c !== dragging);
    next.splice(next.indexOf(target), 0, dragging);
    model.setWatchlist(next, `Watchlist reordered — ${dragging} placed before ${target}`);
  };

  return (
    <section className="os-mk-section" aria-labelledby="os-wl-title">
      <div className="os-mk-card">
        <SectionTitle
          id="os-wl-title"
          eyebrow="S2 · WATCHLIST"
          title={`Watchlist (${items.length})`}
          sub="Drag cards (or use the arrows) to reorder. Click a card to focus the chart. Amber dot = high-impact event today or tomorrow."
          right={<button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => { document.getElementById("mk-explorer-search")?.focus(); document.getElementById("mk-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><Plus size={15} aria-hidden /> Add symbol</button>}
        />
        {items.length === 0 ? (
          <div className="os-mk-empty">
            <Star size={22} aria-hidden />
            <strong>Your watchlist is empty</strong>
            <p className="small text-secondary mb-2">Add symbols from the explorer, the asset tabs or the symbol drawer.</p>
            <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={() => model.setWatchlist(["EURUSD", "XAUUSD", "R_10", "BTCUSDT"], "Starter watchlist restored")}>Restore starter watchlist</button>
          </div>
        ) : (
          <div className="os-wl-grid">
            {items.map((s, idx) => {
              const pb = primaryBroker(s);
              const ask = pb ? brokerAsk(s, pb) : s.ask;
              const up = s.changePct >= 0;
              return (
                <article
                  key={s.canonical}
                  className={`os-wl-card ${model.focused === s.canonical ? "is-focused" : ""} ${dragging === s.canonical ? "is-dragging" : ""} ${overTarget === s.canonical ? "is-over" : ""} ${!pb ? "is-unresolved" : ""}`}
                  draggable
                  onDragStart={(e) => { setDragging(s.canonical); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(e) => { e.preventDefault(); setOverTarget(s.canonical); }}
                  onDragLeave={() => setOverTarget(null)}
                  onDrop={(e) => { e.preventDefault(); drop(s.canonical); setDragging(null); setOverTarget(null); }}
                  onDragEnd={() => { setDragging(null); setOverTarget(null); }}
                >
                  <button type="button" className="os-wl-main" onClick={() => model.focus(s.canonical, true)} aria-label={`Focus chart on ${s.canonical}`}>
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <strong className="os-mono os-wl-sym">{s.canonical}</strong>
                        {model.eventSymbols.has(s.canonical) && <span className="os-event-dot" title="High-impact event today or tomorrow" />}
                        {s.is247 && <span className="os-247">24/7</span>}
                      </div>
                      <span className={`os-mono os-chg ${up ? "os-up" : "os-down"}`}>{up ? "+" : ""}{s.changePct.toFixed(2)}%</span>
                    </div>
                    <span className="os-wl-caption">{pb ? `${s.brokerSymbols[pb]} · ${pb === "paper" ? "Paper sim" : pb}` : "Not offered on selected accounts"}</span>
                    <div className="os-wl-quote">
                      <div><span>Bid</span><b className="os-mono">{fmtPrice(s.bid, s.digits)}</b></div>
                      <div><span>Ask</span><b className="os-mono">{ask !== null ? fmtPrice(ask, s.digits) : "—"}</b></div>
                      <div><span>Spread</span><b className="os-mono">{pb && s.spreads[pb] !== undefined ? `${s.spreads[pb]} ${s.spreadUnit}` : "—"}</b></div>
                    </div>
                    <Spark values={s.sparkline} up={up} w={200} h={34} />
                  </button>
                  <div className="os-wl-actions">
                    <button type="button" aria-label={`Move ${s.canonical} left`} disabled={idx === 0} onClick={() => move(s.canonical, -1)}><ArrowLeft size={13} /></button>
                    <button type="button" aria-label={`Move ${s.canonical} right`} disabled={idx === items.length - 1} onClick={() => move(s.canonical, 1)}><ArrowRight size={13} /></button>
                    <button type="button" onClick={() => model.openDrawer(s.canonical)}><Info size={13} aria-hidden /> Specs</button>
                    <button type="button" onClick={() => model.trade(s.canonical)}><Send size={13} aria-hidden /> Trade</button>
                    <button type="button" className="is-remove" aria-label={`Remove ${s.canonical} from watchlist`} onClick={() => model.setWatchlist(model.watchlist.filter((c) => c !== s.canonical), `${s.canonical} removed from watchlist`)}><X size={13} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── S3 · Market Explorer (TanStack Table) ───────────────── */

const colHelper = createColumnHelper<MarketSymbol>();

function ExplorerSection({ model }: { model: MarketsModel }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [classes, setClasses] = useState<AssetClass[]>([]);
  const [brokers, setBrokers] = useState<BrokerKey[]>([]);
  const [openOnly, setOpenOnly] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "volumeRank", desc: false }]);

  const resolvedHint = resolvedCanonical(query);
  const rows = useMemo(() => model.resolved.filter((s) =>
    matchesSymbolQuery(s, query) &&
    (classes.length === 0 || classes.includes(s.assetClass)) &&
    (brokers.length === 0 || brokers.some((b) => s.brokerSymbols[b])) &&
    (!openOnly || s.tradeableNow)
  ), [model.resolved, query, classes, brokers, openOnly]);

  const columns = useMemo(() => [
    colHelper.accessor("canonical", {
      header: "Symbol",
      cell: (info) => (
        <button type="button" className="os-sym-cell" onClick={() => model.openDrawer(info.getValue())}>
          <strong className="os-mono">{info.getValue()}</strong>
          <small>{info.row.original.name}</small>
        </button>
      ),
    }),
    colHelper.display({
      id: "brokerSymbols",
      header: "Broker symbol(s)",
      cell: (info) => (
        <div className="os-bsym-list">
          {model.resolvedBrokers.filter((b) => info.row.original.brokerSymbols[b]).map((b) => (
            <span key={b} className="os-bsym os-mono" title={b}>{info.row.original.brokerSymbols[b]}</span>
          ))}
        </div>
      ),
    }),
    colHelper.accessor("assetClass", { header: "Class", cell: (info) => <span className="os-class-chip">{info.getValue()}</span> }),
    colHelper.display({
      id: "offering",
      header: "Offered by",
      cell: (info) => (
        <div className="d-flex flex-wrap gap-1">
          {model.contextAccounts.filter((a) => info.row.original.brokerSymbols[a.broker]).map((a) => <BrokerBadge key={a.id} broker={a.broker} label={a.brokerName} />)}
        </div>
      ),
    }),
    colHelper.accessor("minVolume", { header: "Min lot", cell: (info) => <span className="os-mono">{info.getValue()} {info.row.original.volumeUnit}</span> }),
    colHelper.accessor("leverage", { header: "Leverage", cell: (info) => <span className="small">{info.getValue()}</span> }),
    colHelper.accessor("sessionsEat", {
      header: "Sessions (EAT)",
      cell: (info) => (
        <span className="small">
          <span className={`os-sess-dot ${info.row.original.tradeableNow ? "is-open" : ""}`} /> {info.getValue()}
        </span>
      ),
    }),
    colHelper.accessor("volumeRank", { header: "Rank", cell: (info) => <span className="os-mono">#{info.getValue()}</span> }),
    colHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const c = info.row.original.canonical;
        const watched = model.watchlist.includes(c);
        return (
          <div className="os-row-actions">
            <button type="button" className={watched ? "is-on" : ""} onClick={() => model.setWatchlist(watched ? model.watchlist.filter((x) => x !== c) : [...model.watchlist, c], watched ? `${c} removed from watchlist` : `${c} added to watchlist`)} aria-label={watched ? `Unwatch ${c}` : `Watch ${c}`}>
              {watched ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            <button type="button" onClick={() => model.trade(c)} aria-label={`Trade ${c}`}><Send size={13} /></button>
            <button type="button" onClick={() => model.focus(c, true)} aria-label={`Chart ${c}`}><LineChart size={13} /></button>
          </div>
        );
      },
    }),
  ], [model]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const clear = () => { setQuery(""); setClasses([]); setBrokers([]); setOpenOnly(false); toast("Explorer filters cleared"); };
  const hasFilters = !!query || classes.length > 0 || brokers.length > 0 || openOnly;
  const pg = table.getState().pagination;

  return (
    <section className="os-mk-section" id="mk-explorer" aria-labelledby="os-ex-title">
      <div className="os-mk-card">
        <SectionTitle id="os-ex-title" eyebrow="S3 · MARKET EXPLORER" title="Symbol universe" sub="Fuzzy search on canonical or broker symbols — “eurusdm”, “frxGBPUSD”, “BTC/USD” or “gold” all resolve." />
        <div className="os-ex-filters">
          <div className="os-mk-search">
            <Search size={16} aria-hidden />
            <label htmlFor="mk-explorer-search" className="visually-hidden">Search symbols</label>
            <input id="mk-explorer-search" value={query} onChange={(e) => { setQuery(e.target.value); table.setPageIndex(0); }} placeholder="Search EURUSD, eurusdm, gold, V75…" />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}
          </div>
          <button type="button" role="switch" aria-checked={openOnly} className={`os-mk-toggle ${openOnly ? "is-on" : ""}`} onClick={() => { setOpenOnly((v) => !v); table.setPageIndex(0); }}>
            <span className="os-mk-toggle-track"><span /></span> Tradeable now
          </button>
          {hasFilters && <button type="button" className="os-btn os-btn-text os-btn-sm" onClick={clear}><FilterX size={15} aria-hidden /> Clear</button>}
        </div>
        {query && (
          <p className="os-resolve-hint" aria-live="polite">
            {resolvedHint ? <><Wand2 size={14} aria-hidden /> “{query}” resolves to <strong className="os-mono">{resolvedHint}</strong></> : <><Search size={14} aria-hidden /> Fuzzy-matching “{query}” across names and broker symbols</>}
          </p>
        )}
        <div className="os-chip-rows">
          <div className="os-ctx-chips" role="group" aria-label="Asset class filter">
            <Filter size={14} className="text-secondary" aria-hidden />
            {ASSET_CLASSES.map((c) => (
              <button key={c} type="button" aria-pressed={classes.includes(c)} className={`os-ctx-chip is-sm ${classes.includes(c) ? "is-on" : ""}`} onClick={() => { setClasses((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]); table.setPageIndex(0); }}>{c}</button>
            ))}
          </div>
          <div className="os-ctx-chips" role="group" aria-label="Broker offering filter">
            {model.contextAccounts.map((a) => (
              <button key={a.id} type="button" aria-pressed={brokers.includes(a.broker)} className={`os-ctx-chip is-sm ${brokers.includes(a.broker) ? "is-on" : ""}`} onClick={() => { setBrokers((cur) => cur.includes(a.broker) ? cur.filter((x) => x !== a.broker) : [...cur, a.broker]); table.setPageIndex(0); }}>{a.brokerName}</button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="os-mk-empty">
            <SearchX size={24} aria-hidden />
            <strong>No symbols match these filters</strong>
            <p className="small text-secondary mb-2">Try another spelling, widen the asset classes, or include closed sessions.</p>
            <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={clear}>Reset explorer</button>
          </div>
        ) : (
          <>
            <div className="os-mk-table-wrap">
              <table className="os-mk-table">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((h) => (
                        <th key={h.id} scope="col">
                          {h.column.getCanSort() ? (
                            <button type="button" className="os-th-sort" onClick={h.column.getToggleSortingHandler()}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {h.column.getIsSorted() === "asc" ? <ArrowUp size={12} /> : h.column.getIsSorted() === "desc" ? <ArrowDown size={12} /> : <ArrowUpDown size={12} />}
                            </button>
                          ) : flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((r) => (
                    <tr key={r.id} className={model.focused === r.original.canonical ? "is-focused" : ""}>
                      {r.getVisibleCells().map((c) => (
                        <td key={c.id} data-label={typeof c.column.columnDef.header === "string" ? c.column.columnDef.header : ""}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="os-mk-pager">
              <span className="small text-secondary">Showing {pg.pageIndex * pg.pageSize + 1}–{Math.min(rows.length, (pg.pageIndex + 1) * pg.pageSize)} of {rows.length} symbols</span>
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="os-icon-btn" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} aria-label="Previous page"><ChevronLeft size={16} /></button>
                <span className="os-mono small">{pg.pageIndex + 1} / {table.getPageCount()}</span>
                <button type="button" className="os-icon-btn" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} aria-label="Next page"><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* ── S4 · Chart Panel ────────────────────────────────────── */

function ChartSection({ model }: { model: MarketsModel }) {
  const { activeAccountId } = useDashboardContext();
  const toast = useToast();
  const [tf, setTf] = useState<Timeframe>("1H");
  const [ind, setInd] = useState({ ema20: true, ema50: false, bb: false, rsi: true });
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const sym = model.universe.find((s) => s.canonical === model.focused);
  const candlesQ = useQuery({ queryKey: ["candles", model.focused, tf], queryFn: () => getCandles(model.focused, tf) });

  useEffect(() => { setDrawings([]); setDrawMode("none"); }, [model.focused]);

  const activeAcc = model.contextAccounts.find((a) => a.id === activeAccountId);
  const overlay = (() => {
    if (!sym) return null;
    if (activeAcc && activeAcc.broker !== "paper") {
      const bs = sym.brokerSymbols[activeAcc.broker];
      return bs
        ? { tone: "info", text: `Chart data source is the OStrade composite snapshot. ${activeAcc.label} quotes this as ${bs} with a ${sym.spreads[activeAcc.broker]} ${sym.spreadUnit} spread — fills follow the broker's feed.` }
        : { tone: "warn", text: `${activeAcc.label} (${activeAcc.brokerName}) does not list ${sym.canonical}. The chart is informational; a ticket would be blocked for this account.` };
    }
    return { tone: "info", text: "Data source: OStrade composite snapshot (Paper feed). Select a single broker account to see its symbol and spread overlay." };
  })();

  return (
    <section className="os-mk-section" id="mk-chart" aria-labelledby="os-chart-title">
      <div className="os-mk-card">
        <SectionTitle
          id="os-chart-title"
          eyebrow="S4 · CHART PANEL"
          title={sym ? `${sym.canonical} · ${sym.name}` : "Chart"}
          sub={sym ? `${sym.assetClass} · Bid ${fmtPrice(sym.bid, sym.digits)} · ${sym.changePct >= 0 ? "+" : ""}${sym.changePct.toFixed(2)}% · static ${tf} snapshot` : undefined}
          right={sym && (
            <div className="d-flex gap-2 flex-wrap">
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => model.openDrawer(sym.canonical)}><Info size={15} aria-hidden /> Specs</button>
              <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={() => model.trade(sym.canonical)}><Send size={15} aria-hidden /> Trade this from the ticket →</button>
            </div>
          )}
        />
        <div className="os-chart-toolbar">
          <div className="os-mk-seg" role="tablist" aria-label="Timeframe">
            {TIMEFRAMES.map((t) => <button key={t} type="button" role="tab" aria-selected={tf === t} className={tf === t ? "is-on" : ""} onClick={() => setTf(t)}>{t}</button>)}
          </div>
          <div className="os-ind-group" role="group" aria-label="Indicators">
            {([["ema20", "EMA20"], ["ema50", "EMA50"], ["bb", "Bollinger"], ["rsi", "RSI14"]] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={ind[k]} className={`os-ind-btn is-${k} ${ind[k] ? "is-on" : ""}`} onClick={() => setInd((cur) => ({ ...cur, [k]: !cur[k] }))}>{label}</button>
            ))}
          </div>
          <div className="os-ind-group" role="group" aria-label="Drawing tools">
            <button type="button" aria-pressed={drawMode === "trend"} className={`os-ind-btn ${drawMode === "trend" ? "is-on" : ""}`} onClick={() => setDrawMode((m) => (m === "trend" ? "none" : "trend"))}><TrendingUp size={13} aria-hidden /> Trend</button>
            <button type="button" aria-pressed={drawMode === "hline"} className={`os-ind-btn ${drawMode === "hline" ? "is-on" : ""}`} onClick={() => setDrawMode((m) => (m === "hline" ? "none" : "hline"))}><Minus size={13} aria-hidden /> H-line</button>
            <button type="button" className="os-ind-btn" onClick={() => { setDrawMode("none"); toast("Drawing mode off"); }}><MousePointer2 size={13} aria-hidden /> Pointer</button>
            <button type="button" className="os-ind-btn" disabled={drawings.length === 0} onClick={() => { setDrawings([]); toast("Drawings cleared"); }}><Trash2 size={13} aria-hidden /> Clear ({drawings.length})</button>
          </div>
        </div>

        {candlesQ.isError ? <QueryError title="Could not load candles" onRetry={() => candlesQ.refetch()} /> : candlesQ.isPending || !sym ? <Skel h={430} /> : (
          <CandleChart
            candles={candlesQ.data}
            digits={sym.digits}
            showEma20={ind.ema20}
            showEma50={ind.ema50}
            showBollinger={ind.bb}
            showRsi={ind.rsi}
            drawMode={drawMode}
            drawings={drawings}
            onAddDrawing={(d) => { setDrawings((cur) => [...cur, d]); toast(d.kind === "hline" ? `H-line at ${d.price}` : "Trend line added"); if (d.kind === "hline") setDrawMode("none"); }}
          />
        )}
        {overlay && <div className={`os-mk-note is-${overlay.tone} mt-3`}><Info size={16} aria-hidden /><span>{overlay.text}</span></div>}
      </div>
    </section>
  );
}

/* ── S5 · Asset Class Tabs + Hot Movers ──────────────────── */

function AssetTabsSection({ model }: { model: MarketsModel }) {
  const [tab, setTab] = useState<AssetClass>("Forex");
  const [sortBy, setSortBy] = useState<"volume" | "change">("volume");
  const movers = useMemo(() => [...model.resolved].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 10), [model.resolved]);
  const cells = model.resolved.filter((s) => s.assetClass === tab).sort((a, b) => sortBy === "volume" ? a.volumeRank - b.volumeRank : Math.abs(b.changePct) - Math.abs(a.changePct));
  const countFor = (c: AssetClass) => model.resolved.filter((s) => s.assetClass === c).length;

  return (
    <section className="os-mk-section" aria-labelledby="os-tabs-title">
      <div className="os-mk-card">
        <SectionTitle id="os-tabs-title" eyebrow="S5 · ASSET CLASSES" title="Curated quote grid" sub="Biggest movers today, then a quote grid per asset class. Synthetics and crypto carry a 24/7 badge." />
        <div className="os-movers" role="list" aria-label="Biggest movers today">
          <span className="os-movers-label"><Flame size={14} aria-hidden /> Hot movers</span>
          {movers.map((s) => (
            <button key={s.canonical} type="button" role="listitem" className="os-mover" onClick={() => model.focus(s.canonical, true)}>
              <strong className="os-mono">{s.canonical}</strong>
              <span className="os-mono">{fmtPrice(s.bid, s.digits)}</span>
              <span className={`os-mono ${s.changePct >= 0 ? "os-up" : "os-down"}`}>{s.changePct >= 0 ? "▲" : "▼"} {Math.abs(s.changePct).toFixed(2)}%</span>
            </button>
          ))}
        </div>
        <div className="os-tabs-bar">
          <div className="os-asset-tabs" role="tablist" aria-label="Asset class">
            {ASSET_CLASSES.map((c) => (
              <button key={c} type="button" role="tab" aria-selected={tab === c} className={tab === c ? "is-on" : ""} onClick={() => setTab(c)}>
                {c} <span className="os-mono">{countFor(c)}</span>
              </button>
            ))}
          </div>
          <div className="os-mk-seg" role="group" aria-label="Sort grid">
            <button type="button" className={sortBy === "volume" ? "is-on" : ""} onClick={() => setSortBy("volume")}>Top volume</button>
            <button type="button" className={sortBy === "change" ? "is-on" : ""} onClick={() => setSortBy("change")}>% change</button>
          </div>
        </div>
        {cells.length === 0 ? (
          <div className="os-mk-empty">
            <Compass size={22} aria-hidden />
            <strong>No {tab.toLowerCase()} on the selected accounts</strong>
            <p className="small text-secondary mb-0">Add OStrade Paper to the context to see the full simulated universe.</p>
          </div>
        ) : (
          <div className="os-quote-grid" role="tabpanel">
            {cells.map((s) => {
              const up = s.changePct >= 0;
              return (
                <button key={s.canonical} type="button" className={`os-quote-cell ${model.focused === s.canonical ? "is-focused" : ""}`} onClick={() => model.focus(s.canonical, true)}>
                  <div className="d-flex justify-content-between align-items-center gap-1">
                    <strong className="os-mono">{s.canonical}</strong>
                    {s.is247 ? <span className="os-247">24/7</span> : <span className={`os-sess-dot ${s.tradeableNow ? "is-open" : ""}`} title={s.tradeableNow ? "Session open" : "Session closed"} />}
                  </div>
                  <small className="text-secondary text-truncate d-block">{s.name}</small>
                  <span className="os-mono os-quote-bid">{fmtPrice(s.bid, s.digits)}</span>
                  <span className={`os-mono small fw-bold ${up ? "os-up" : "os-down"}`}>{up ? "+" : ""}{s.changePct.toFixed(2)}%</span>
                  <Spark values={s.sparkline} up={up} w={120} h={24} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── S6 · Symbol Detail Drawer ───────────────────────────── */

const SCHEDULE_SLOTS = [
  { timeEat: "Today 18:00 EAT", countdown: "in 1h 20m" },
  { timeEat: "Today 19:00 EAT", countdown: "in 2h 20m" },
  { timeEat: "Today 21:00 EAT", countdown: "in 4h 20m" },
  { timeEat: "Tomorrow 10:00 EAT", countdown: "Tomorrow" },
];

function SymbolDrawer({ canonical, model, onClose }: { canonical: string; model: MarketsModel; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);
  const symQ = useQuery({ queryKey: ["market-symbol", canonical], queryFn: () => getMarketSymbol(canonical) });
  const offering = (symQ.data ? model.contextAccounts.filter((a) => symQ.data.brokerSymbols[a.broker]) : []);
  const [tickBroker, setTickBroker] = useState<BrokerKey>("paper");
  const ticksQ = useQuery({ queryKey: ["ticks", canonical, tickBroker], queryFn: () => getRecentTicks(canonical, tickBroker), enabled: !!symQ.data });
  const [showSchedule, setShowSchedule] = useState(false);
  const [sched, setSched] = useState({ slot: 0, side: "BUY" as "BUY" | "SELL", lots: "", accountId: "" });
  const [outcome, setOutcome] = useState<DashboardMutationOutcome | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  useEffect(() => {
    if (symQ.data) {
      const first = model.contextAccounts.find((a) => symQ.data.brokerSymbols[a.broker]);
      if (first) {
        setTickBroker(first.broker);
        setSched((s) => ({ ...s, accountId: first.id, lots: String(symQ.data.minVolume * (symQ.data.volumeUnit === "lots" ? 10 : 1)) }));
      }
    }
  }, [symQ.data, model.contextAccounts]);

  const schedMut = useMutation({
    mutationFn: () => {
      const slot = SCHEDULE_SLOTS[sched.slot];
      return createSchedule({ symbol: canonical, side: sched.side, lots: sched.lots, accountId: sched.accountId, timeEat: slot.timeEat, countdown: slot.countdown });
    },
    onSuccess: (res) => {
      setOutcome(res);
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
      if (res.mode === "simulated") setShowSchedule(false);
    },
  });

  const s = symQ.data;
  const watched = model.watchlist.includes(canonical);
  const bestSpread = s ? Math.min(...offering.map((a) => s.spreads[a.broker] ?? Infinity)) : Infinity;
  const standbyBrokers = s ? (Object.keys(s.brokerSymbols) as BrokerKey[]).filter((b) => !model.contextAccounts.some((a) => a.broker === b)) : [];

  const submitSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const lots = parseFloat(sched.lots);
    if (!s || isNaN(lots) || lots < s.minVolume || lots > s.maxVolume) {
      toast(s ? `Size must be between ${s.minVolume} and ${s.maxVolume} ${s.volumeUnit}` : "Symbol still loading");
      return;
    }
    schedMut.mutate();
  };

  return (
    <div className="os-mk-drawer-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="os-mk-drawer" role="dialog" aria-modal="true" aria-labelledby="os-sym-drawer-title">
        <div className="os-mk-drawer-head">
          <span className="os-mk-tag">SYMBOL DETAIL · S6</span>
          <button ref={closeRef} type="button" className="os-icon-btn" onClick={onClose} aria-label="Close symbol drawer"><X size={18} /></button>
        </div>
        {symQ.isError ? <div className="p-4"><QueryError title="Could not load symbol" onRetry={() => symQ.refetch()} /></div> : !s ? (
          <div className="p-4 d-grid gap-3"><Skel h={56} /><Skel h={160} /><Skel h={260} /></div>
        ) : (
          <div className="os-mk-drawer-body">
            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
              <span className="os-class-chip">{s.assetClass}</span>
              {s.is247 && <span className="os-247">24/7</span>}
              <span className={`os-sess-pill ${s.tradeableNow ? "is-open" : ""}`}>{s.tradeableNow ? "SESSION OPEN" : "SESSION CLOSED"}</span>
            </div>
            <h2 id="os-sym-drawer-title" className="os-mono h3 mb-0">{s.canonical}</h2>
            <p className="text-secondary small mb-3">{s.name}</p>
            <div className="os-drawer-quote">
              <div><span>Bid</span><b className="os-mono">{fmtPrice(s.bid, s.digits)}</b></div>
              <div><span>Ask</span><b className="os-mono">{fmtPrice(s.ask, s.digits)}</b></div>
              <div><span>24h range</span><b className="os-mono">{fmtPrice(s.low24, s.digits)} – {fmtPrice(s.high24, s.digits)}</b></div>
              <div><span>Day</span><b className={`os-mono ${s.changePct >= 0 ? "os-up" : "os-down"}`}>{s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%</b></div>
            </div>

            <div className="os-drawer-actions">
              <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={() => model.trade(s.canonical)}><Send size={14} aria-hidden /> Trade</button>
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => setShowSchedule((v) => !v)}><CalendarClock size={14} aria-hidden /> Schedule</button>
              <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => model.setWatchlist(watched ? model.watchlist.filter((c) => c !== s.canonical) : [...model.watchlist, s.canonical], watched ? `${s.canonical} removed from watchlist` : `${s.canonical} added to watchlist`)}>
                {watched ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />} {watched ? "Unwatch" : "Watch"}
              </button>
            </div>

            {showSchedule && (
              <form className="os-sched-form" onSubmit={submitSchedule} noValidate>
                <strong className="d-block mb-2">Schedule a timed {s.canonical} order</strong>
                {offering.length === 0 ? (
                  <p className="small text-secondary mb-0">No account in the current context lists {s.canonical}. Widen the context in S1.</p>
                ) : (
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="os-mk-label" htmlFor="sch-slot">Fire at</label>
                      <select id="sch-slot" className="form-select form-select-sm" value={sched.slot} onChange={(e) => setSched({ ...sched, slot: Number(e.target.value) })}>
                        {SCHEDULE_SLOTS.map((sl, i) => <option key={sl.timeEat} value={i}>{sl.timeEat}</option>)}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="os-mk-label" htmlFor="sch-acc">Account</label>
                      <select id="sch-acc" className="form-select form-select-sm" value={sched.accountId} onChange={(e) => setSched({ ...sched, accountId: e.target.value })}>
                        {offering.map((a) => <option key={a.id} value={a.id}>{a.label}{a.environment === "paper" ? " (SIM)" : " (preview)"}</option>)}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="os-mk-label" htmlFor="sch-side">Side</label>
                      <select id="sch-side" className="form-select form-select-sm" value={sched.side} onChange={(e) => setSched({ ...sched, side: e.target.value as "BUY" | "SELL" })}>
                        <option value="BUY">BUY ▲</option><option value="SELL">SELL ▼</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="os-mk-label" htmlFor="sch-lots">Size ({s.volumeUnit})</label>
                      <input id="sch-lots" className="form-control form-control-sm os-mono" value={sched.lots} onChange={(e) => setSched({ ...sched, lots: e.target.value })} />
                    </div>
                    <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                      <button type="button" className="os-btn os-btn-text os-btn-sm" onClick={() => setShowSchedule(false)}>Cancel</button>
                      <button type="submit" className="os-btn os-btn-dark os-btn-sm" disabled={schedMut.isPending}>{schedMut.isPending ? <><Loader2 size={14} className="os-spin" /> Queuing…</> : "Add to scheduler"}</button>
                    </div>
                  </div>
                )}
              </form>
            )}
            {outcome && <div className="mb-3"><OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} /></div>}

            <h3 className="os-drawer-sub">Contract specification</h3>
            <dl className="os-spec-grid">
              <div><dt>Contract size</dt><dd>{s.contractSize}</dd></div>
              <div><dt>Pip / tick size</dt><dd className="os-mono">{s.pipSizeLabel}</dd></div>
              <div><dt>Min volume</dt><dd className="os-mono">{s.minVolume} {s.volumeUnit}</dd></div>
              <div><dt>Max volume</dt><dd className="os-mono">{s.maxVolume} {s.volumeUnit}</dd></div>
              <div><dt>Volume step</dt><dd className="os-mono">{s.volumeStep}</dd></div>
              <div><dt>Margin rate</dt><dd className="os-mono">{s.marginRatePct}%</dd></div>
              <div><dt>Leverage</dt><dd>{s.leverage}</dd></div>
              <div><dt>Swap long / short</dt><dd className="os-mono">{s.swapLong} / {s.swapShort}</dd></div>
            </dl>

            <h3 className="os-drawer-sub">Sessions (EAT)</h3>
            <ul className="os-sess-list">
              {s.sessions.map((w) => <li key={w.label}><span>{w.label}</span><b className="os-mono">{w.hoursEat}</b></li>)}
            </ul>

            <h3 className="os-drawer-sub">Broker symbol &amp; suffix note</h3>
            <div className="os-bsym-list mb-2">
              {(Object.entries(s.brokerSymbols) as [BrokerKey, string][]).map(([b, bs]) => <span key={b} className="os-bsym os-mono" title={b}>{b}: {bs}</span>)}
            </div>
            <p className="os-mk-note is-info small"><Info size={15} aria-hidden /><span>{s.suffixNote}</span></p>

            <h3 className="os-drawer-sub">Where can I trade this?</h3>
            {offering.length === 0 ? (
              <p className="small text-secondary">No account in the current context lists {s.canonical}.</p>
            ) : (
              <ul className="os-where-list">
                {offering.map((a) => (
                  <li key={a.id} className={s.spreads[a.broker] === bestSpread ? "is-best" : ""}>
                    <div><BrokerBadge broker={a.broker} label={a.brokerName} /> <strong>{a.label}</strong> <EnvPill env={a.environment} /></div>
                    <div className="text-end">
                      <span className="os-mono d-block">{s.brokerSymbols[a.broker]}</span>
                      <small className="os-mono">{s.spreads[a.broker]} {s.spreadUnit}{s.spreads[a.broker] === bestSpread ? " · tightest" : ""}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {standbyBrokers.length > 0 && <p className="small text-secondary">Also listed after linking in T-9: {standbyBrokers.join(", ")}.</p>}

            <div className="d-flex align-items-center justify-content-between mt-3 mb-2 gap-2">
              <h3 className="os-drawer-sub mb-0">Last 20 ticks</h3>
              {offering.length > 1 && (
                <select aria-label="Tick source broker" className="form-select form-select-sm w-auto" value={tickBroker} onChange={(e) => setTickBroker(e.target.value as BrokerKey)}>
                  {offering.map((a) => <option key={a.id} value={a.broker}>{a.brokerName}</option>)}
                </select>
              )}
            </div>
            {ticksQ.isError ? <QueryError onRetry={() => ticksQ.refetch()} /> : ticksQ.isPending ? <Skel h={220} /> : (
              <div className="os-ticks-wrap">
                <table className="os-ticks-table os-mono">
                  <thead><tr><th>Time (EAT)</th><th>Bid</th><th>Ask</th><th aria-label="Direction" /></tr></thead>
                  <tbody>{ticksQ.data.map((t, i) => (
                    <tr key={`${t.time}-${i}`}>
                      <td>{t.time}</td>
                      <td>{fmtPrice(t.bid, s.digits)}</td>
                      <td>{fmtPrice(t.ask, s.digits)}</td>
                      <td className={t.dir === "up" ? "os-up" : t.dir === "down" ? "os-down" : "text-secondary"}>{t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "•"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <p className="small text-secondary mt-2 mb-0">Static recorded snapshot — the tick stream activates with the broker WebSocket bridge.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

/* ── S7 · Economic Calendar Panel + Price Alerts ─────────── */

function CalendarSection({ model }: { model: MarketsModel }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [day, setDay] = useState<"today" | "tomorrow" | "week">("today");
  const [highOnly, setHighOnly] = useState(false);
  const [alertFor, setAlertFor] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState({ canonical: "", condition: "above" as AlertCondition, price: "", note: "" });
  const [outcome, setOutcome] = useState<DashboardMutationOutcome | null>(null);
  const eventsQ = useQuery({ queryKey: ["economic-events"], queryFn: getEconomicEvents });
  const alertsQ = useQuery({ queryKey: ["price-alerts"], queryFn: getPriceAlerts });
  const bySym = useMemo(() => new Map(model.universe.map((s) => [s.canonical, s])), [model.universe]);

  const guardMut = useMutation({
    mutationFn: (eventId: string) => createEventGuardSchedule(eventId, 30),
    onSuccess: (res) => {
      setOutcome(res);
      qc.invalidateQueries({ queryKey: ["economic-events"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
    },
  });
  const alertMut = useMutation({
    mutationFn: () => createPriceAlert({ canonical: alertForm.canonical, condition: alertForm.condition, price: Number(alertForm.price), note: alertForm.note }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["price-alerts"] });
      setAlertFor(null);
      toast(`Alert armed locally: ${a.canonical} ${a.condition} ${a.price}`);
    },
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => removePriceAlert(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-alerts"] }); toast("Price alert removed"); },
  });

  const events = (eventsQ.data ?? []).filter((e) => {
    const isToday = e.timeEat.startsWith("Today");
    const isTomorrow = e.timeEat.startsWith("Tomorrow");
    if (day === "today" && !isToday) return false;
    if (day === "tomorrow" && !isTomorrow) return false;
    return !highOnly || e.impact === 3;
  });

  const openAlert = (eventId: string, symbols: string[]) => {
    const first = symbols.find((x) => bySym.has(x)) ?? model.focused;
    const s = bySym.get(first);
    setAlertFor(eventId);
    setAlertForm({ canonical: first, condition: "above", price: s ? s.bid.toFixed(s.digits) : "", note: "Around macro release" });
  };

  const submitAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(alertForm.price);
    if (!alertForm.canonical || !Number.isFinite(p) || p <= 0) { toast("Enter a valid alert price"); return; }
    alertMut.mutate();
  };

  return (
    <section className="os-mk-section" aria-labelledby="os-cal-title">
      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="os-mk-card h-100">
            <SectionTitle
              id="os-cal-title"
              eyebrow="S7 · ECONOMIC CALENDAR"
              title="Macro events (EAT)"
              sub="Affected symbols on your watchlist get an amber dot. Pause automation around a release or arm a price alert."
              right={
                <div className="d-flex gap-2 flex-wrap">
                  <div className="os-mk-seg" role="tablist" aria-label="Calendar range">
                    {(["today", "tomorrow", "week"] as const).map((d) => <button key={d} type="button" role="tab" aria-selected={day === d} className={day === d ? "is-on" : ""} onClick={() => setDay(d)}>{d === "week" ? "This week" : d[0].toUpperCase() + d.slice(1)}</button>)}
                  </div>
                  <button type="button" aria-pressed={highOnly} className={`os-ind-btn ${highOnly ? "is-on" : ""}`} onClick={() => setHighOnly((v) => !v)}>High impact only</button>
                </div>
              }
            />
            {outcome && <div className="mb-3"><OutcomeBanner outcome={outcome} onClose={() => setOutcome(null)} /></div>}
            {eventsQ.isError ? <QueryError onRetry={() => eventsQ.refetch()} /> : eventsQ.isPending ? <Skel h={260} /> : events.length === 0 ? (
              <div className="os-mk-empty"><CalendarClock size={22} aria-hidden /><strong>No events in this window</strong><button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => { setDay("week"); setHighOnly(false); }}>Show this week</button></div>
            ) : (
              <ul className="os-cal-list">
                {events.map((ev) => (
                  <li key={ev.id} className="os-cal-item">
                    <div className="os-cal-main">
                      <span className="os-ccy os-mono">{ev.currency}</span>
                      <div className="min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <strong>{ev.title}</strong>
                          <span className="os-stars" aria-label={`${ev.impact === 3 ? "High" : "Medium"} impact`}>{Array.from({ length: ev.impact }, (_, i) => <Star key={i} size={11} fill="currentColor" aria-hidden />)}</span>
                          {ev.guardScheduled && <span className="os-guard-pill">GUARDED</span>}
                        </div>
                        <small className="os-mono text-secondary">{ev.timeEat} · {ev.countdown} · Fcst {ev.forecast} / Prev {ev.previous}</small>
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {ev.affectedSymbols.map((x) => (
                            <button key={x} type="button" className={`os-aff-chip os-mono ${model.watchlist.includes(x) ? "is-watched" : ""}`} disabled={!bySym.has(x)} onClick={() => model.focus(x, true)}>{x}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="os-cal-actions">
                      <button type="button" className="os-btn os-btn-dark os-btn-sm" disabled={guardMut.isPending || ev.guardScheduled} onClick={() => guardMut.mutate(ev.id)}>
                        <ShieldAlert size={14} aria-hidden /> {ev.guardScheduled ? "Guard queued" : "Pause automation ±30m"}
                      </button>
                      <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => alertFor === ev.id ? setAlertFor(null) : openAlert(ev.id, ev.affectedSymbols)}>
                        <BellPlus size={14} aria-hidden /> Set price alert
                      </button>
                    </div>
                    {alertFor === ev.id && (
                      <form className="os-alert-form" onSubmit={submitAlert} noValidate>
                        <select aria-label="Alert symbol" className="form-select form-select-sm" value={alertForm.canonical} onChange={(e) => { const s = bySym.get(e.target.value); setAlertForm({ ...alertForm, canonical: e.target.value, price: s ? s.bid.toFixed(s.digits) : alertForm.price }); }}>
                          {ev.affectedSymbols.filter((x) => bySym.has(x)).map((x) => <option key={x} value={x}>{x}</option>)}
                        </select>
                        <select aria-label="Alert condition" className="form-select form-select-sm" value={alertForm.condition} onChange={(e) => setAlertForm({ ...alertForm, condition: e.target.value as AlertCondition })}>
                          <option value="above">Crosses above</option><option value="below">Crosses below</option>
                        </select>
                        <input aria-label="Alert price" className="form-control form-control-sm os-mono" value={alertForm.price} onChange={(e) => setAlertForm({ ...alertForm, price: e.target.value })} />
                        <button type="submit" className="os-btn os-btn-primary os-btn-sm" disabled={alertMut.isPending}>{alertMut.isPending ? "Arming…" : "Arm alert"}</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="col-12 col-xl-4">
          <div className="os-mk-card h-100 d-flex flex-column">
            <SectionTitle id="os-alerts-title" eyebrow="PRICE ALERTS" title={`Armed alerts (${(alertsQ.data ?? []).filter((a) => a.status === "armed").length})`} sub="Armed locally. Delivery via in-app, Telegram and email activates with the backend." />
            {alertsQ.isError ? <QueryError onRetry={() => alertsQ.refetch()} /> : alertsQ.isPending ? <Skel h={260} /> : (alertsQ.data.length === 0 ? (
              <div className="os-mk-empty"><Bell size={22} aria-hidden /><strong>No price alerts</strong></div>
            ) : (
              <ul className="os-alert-list">
                {alertsQ.data.map((a) => (
                  <li key={a.id} className={`is-${a.status}`}>
                    <div className="min-w-0">
                      <div className="d-flex align-items-center gap-2"><strong className="os-mono">{a.canonical}</strong><span className={`os-alert-status is-${a.status}`}>{a.status.toUpperCase()}</span></div>
                      <small className="text-secondary d-block text-truncate">{a.condition === "above" ? "≥" : "≤"} <span className="os-mono">{a.price}</span> · {a.note}</small>
                      <small className="text-secondary">{a.channel} · {a.createdEat}</small>
                    </div>
                    <button type="button" className="os-icon-btn" aria-label={`Remove alert on ${a.canonical}`} onClick={() => removeMut.mutate(a.id)}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            ))}
            <div className="mt-auto pt-3 border-top text-end">
              <Link to="/dashboard/notifications" className="os-mk-link">Delivery rules in T-15 <ArrowRight size={14} aria-hidden /></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── S8 · Symbol Mapping Resolver (§3.4) ─────────────────── */

function ResolverSection({ model }: { model: MarketsModel }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [input, setInput] = useState("GOLD");
  const [accountId, setAccountId] = useState("acc-exness-trial");
  const [result, setResult] = useState<ResolutionResult | null>(null);
  const [brokerFilter, setBrokerFilter] = useState<"all" | BrokerKey>("all");
  const mappingsQ = useQuery({ queryKey: ["symbol-mappings"], queryFn: getSymbolMappings });
  const resolveMut = useMutation({ mutationFn: () => resolveSymbol(input, accountId), onSuccess: (r) => { setResult(r); toast(r.canonical && r.brokerSymbol ? `Resolved to ${r.canonical} (${r.brokerSymbol})` : "No safe mapping — order would be blocked"); } });
  const confirmMut = useMutation({
    mutationFn: (r: ResolutionResult) => confirmSymbolMapping(r),
    onSuccess: (m) => { qc.invalidateQueries({ queryKey: ["symbol-mappings"] }); setResult((r) => (r ? { ...r, needsConfirmation: false } : r)); toast(`Mapping saved: ${m.input} → ${m.canonical} for ${m.accountLabel}`); },
  });
  const accounts = model.contextAccounts.length ? model.contextAccounts : [];
  useEffect(() => { if (accounts.length && !accounts.some((a) => a.id === accountId)) setAccountId(accounts[0].id); }, [accounts, accountId]);
  const mappings = (mappingsQ.data ?? []).filter((m) => brokerFilter === "all" || m.broker === brokerFilter);

  return (
    <section className="os-mk-section" aria-labelledby="os-res-title">
      <div className="os-mk-card">
        <SectionTitle id="os-res-title" eyebrow="S8 · SYMBOL MAPPING" title="Canonical symbol resolver" sub="Resolution order per order: 1) exact match · 2) account-type suffix (m / c / z) · 3) AI mapper fallback. Below 90% confidence you confirm once, then it is saved for that account." />
        <form className="os-res-form" onSubmit={(e) => { e.preventDefault(); if (!input.trim()) { toast("Type a symbol to resolve"); return; } resolveMut.mutate(); }}>
          <div className="os-mk-search flex-grow-1">
            <Wand2 size={16} aria-hidden />
            <label htmlFor="res-input" className="visually-hidden">Symbol to resolve</label>
            <input id="res-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Try GOLD, EURUSDc, V75, DE40, Volatility 10 Index…" />
          </div>
          <select aria-label="Account" className="form-select os-res-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.label} ({a.brokerName})</option>)}
          </select>
          <button type="submit" className="os-btn os-btn-primary" disabled={resolveMut.isPending}>{resolveMut.isPending ? <><Loader2 size={15} className="os-spin" /> Resolving…</> : <><Sparkles size={15} aria-hidden /> Resolve</>}</button>
        </form>
        <div className="os-res-presets" aria-label="Example inputs">
          {["GOLD", "EURUSDc", "frxGBPUSD", "V75", "DE40", "BTC/USD", "Volatility 10 Index", "XYZ123"].map((p) => (
            <button key={p} type="button" className="os-ctx-chip is-sm" onClick={() => { setInput(p); setResult(null); }}>{p}</button>
          ))}
        </div>

        {result && (
          <div className="os-res-result">
            <ol className="os-res-steps">
              {result.steps.map((st) => (
                <li key={st.step} className={`is-${st.status}`}>
                  <span className="os-res-node os-mono">{st.status === "matched" ? <Check size={13} /> : st.status === "miss" ? <X size={13} /> : st.step}</span>
                  <div><strong>{st.step}. {st.label}</strong><p>{st.detail}</p></div>
                </li>
              ))}
            </ol>
            <div className={`os-res-verdict ${result.canonical && result.brokerSymbol ? (result.needsConfirmation ? "is-confirm" : "is-ok") : "is-blocked"}`}>
              <div>
                <span className="os-mk-label">Verdict for {result.accountLabel}</span>
                {result.canonical && result.brokerSymbol ? (
                  <strong className="os-mono d-block">{result.input} → {result.canonical} → {result.brokerSymbol}</strong>
                ) : (
                  <strong className="d-block">Blocked — never substituted</strong>
                )}
                <div className="os-conf-bar" aria-label={`Confidence ${Math.round(result.confidence * 100)}%`}><span style={{ width: `${Math.round(result.confidence * 100)}%` }} /></div>
                <small className="os-mono">{Math.round(result.confidence * 100)}% confidence · method {result.method}</small>
              </div>
              {result.needsConfirmation && result.canonical && (
                <button type="button" className="os-btn os-btn-dark os-btn-sm" disabled={confirmMut.isPending} onClick={() => confirmMut.mutate(result)}>{confirmMut.isPending ? "Saving…" : "Confirm & save mapping"}</button>
              )}
            </div>
          </div>
        )}

        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-4 mb-2">
          <strong>Saved mappings ({mappings.length})</strong>
          <select aria-label="Filter mappings by broker" className="form-select form-select-sm w-auto" value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value as "all" | BrokerKey)}>
            <option value="all">All brokers</option>
            {Array.from(new Set((mappingsQ.data ?? []).map((m) => m.broker))).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        {mappingsQ.isError ? <QueryError onRetry={() => mappingsQ.refetch()} /> : mappingsQ.isPending ? <Skel h={220} /> : (
          <div className="os-mk-table-wrap">
            <table className="os-mk-table">
              <thead><tr><th>Input</th><th>Account</th><th>Canonical</th><th>Broker symbol</th><th>Method</th><th>Confidence</th><th>Saved</th></tr></thead>
              <tbody>{mappings.map((m) => (
                <tr key={m.id}>
                  <td data-label="Input" className="os-mono">{m.input}</td>
                  <td data-label="Account">{m.accountLabel}</td>
                  <td data-label="Canonical" className="os-mono fw-bold">{m.canonical}</td>
                  <td data-label="Broker symbol" className="os-mono">{m.brokerSymbol}</td>
                  <td data-label="Method"><span className={`os-method-chip is-${m.method}`}>{m.method}</span></td>
                  <td data-label="Confidence" className="os-mono">{Math.round(m.confidence * 100)}%</td>
                  <td data-label="Saved" className="os-mono text-secondary">{m.confirmedEat}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── S9 · Cross-Broker Spread Matrix ─────────────────────── */

function SpreadMatrixSection({ model }: { model: MarketsModel }) {
  const [cls, setCls] = useState<AssetClass | "all">("all");
  const rows = model.resolved.filter((s) => cls === "all" || s.assetClass === cls).sort((a, b) => a.volumeRank - b.volumeRank).slice(0, 14);
  const accts = model.contextAccounts;

  return (
    <section className="os-mk-section" aria-labelledby="os-spread-title">
      <div className="os-mk-card">
        <SectionTitle
          id="os-spread-title"
          eyebrow="S9 · SPREAD MATRIX"
          title="Where is it cheapest to trade?"
          sub="Snapshot spreads per connected account. The tightest venue for each symbol is highlighted; “—” means the broker does not list it."
          right={<div className="os-ctx-chips">{(["all", ...ASSET_CLASSES] as const).map((c) => <button key={c} type="button" className={`os-ctx-chip is-sm ${cls === c ? "is-on" : ""}`} onClick={() => setCls(c)}>{c === "all" ? "All" : c}</button>)}</div>}
        />
        {accts.length === 0 || rows.length === 0 ? (
          <div className="os-mk-empty"><GitCompareArrows size={22} aria-hidden /><strong>Nothing to compare in this context</strong></div>
        ) : (
          <div className="os-mk-table-wrap">
            <table className="os-mk-table os-matrix">
              <thead>
                <tr>
                  <th scope="col">Symbol</th>
                  <th scope="col">Session</th>
                  {accts.map((a) => <th key={a.id} scope="col">{a.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const vals = accts.map((a) => (s.brokerSymbols[a.broker] ? s.spreads[a.broker] : undefined));
                  const best = Math.min(...vals.filter((v): v is number => v !== undefined));
                  return (
                    <tr key={s.canonical}>
                      <td data-label="Symbol"><button type="button" className="os-sym-cell" onClick={() => model.openDrawer(s.canonical)}><strong className="os-mono">{s.canonical}</strong><small>{s.assetClass}</small></button></td>
                      <td data-label="Session"><span className={`os-sess-pill ${s.tradeableNow ? "is-open" : ""}`}>{s.is247 ? "24/7" : s.tradeableNow ? "OPEN" : "CLOSED"}</span></td>
                      {accts.map((a, i) => (
                        <td key={a.id} data-label={a.label} className="os-mono">
                          {vals[i] === undefined ? <span className="text-secondary">—</span> : <span className={vals[i] === best ? "os-best-spread" : ""}>{vals[i]} <small>{s.spreadUnit}</small></span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="os-mk-note is-info mt-3">
          <BarChart3 size={16} aria-hidden />
          <span>Spreads are recorded snapshot values, not a live feed. Real spreads widen around news and session opens — see the calendar above.</span>
        </div>
      </div>
    </section>
  );
}

/* ── Page root ───────────────────────────────────────────── */

export function DashMarketsPage() {
  usePageStyle("dash-markets", css);
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { activeAccountId, setActiveAccountId } = useDashboardContext();

  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const universeQ = useQuery({ queryKey: ["market-universe"], queryFn: getMarketUniverse });
  const watchQ = useQuery({ queryKey: ["watchlist"], queryFn: getWatchlist });
  const eventsQ = useQuery({ queryKey: ["economic-events"], queryFn: getEconomicEvents });

  const accounts = accountsQ.data ?? [];
  const connected = useMemo(() => accounts.filter((a) => a.connected), [accounts]);
  const [selectedIds, setSelectedIdsState] = useState<string[]>([]);
  const [envFilter, setEnvFilter] = useState<EnvFilter>("all");
  const [brokerFilter, setBrokerFilter] = useState<BrokerKey[]>([]);
  const [focused, setFocused] = useState("XAUUSD");
  const [drawer, setDrawer] = useState<string | null>(null);
  const [watchlist, setWatchlistState] = useState<string[]>([]);

  useEffect(() => {
    const prev = document.title;
    document.title = "Markets (T-2) · OStrade";
    return () => { document.title = prev; };
  }, []);

  // Sync page context with the global account context (T-1/T-3/T-4 share it)
  useEffect(() => {
    if (!connected.length) return;
    if (activeAccountId === "all" || !connected.some((a) => a.id === activeAccountId)) setSelectedIdsState(connected.map((a) => a.id));
    else setSelectedIdsState([activeAccountId]);
  }, [activeAccountId, connected]);

  useEffect(() => { if (watchQ.data) setWatchlistState(watchQ.data); }, [watchQ.data]);

  const setSelectedIds = (ids: string[]) => {
    setSelectedIdsState(ids);
    setActiveAccountId(ids.length === 1 ? ids[0] : "all");
  };

  const saveMut = useMutation({ mutationFn: (list: string[]) => saveWatchlist(list), onSuccess: (list) => qc.setQueryData(["watchlist"], list) });
  const setWatchlist = (next: string[], message?: string) => {
    setWatchlistState(next);
    saveMut.mutate(next);
    if (message) toast(message);
  };

  const contextAccounts = connected.filter((a) => selectedIds.includes(a.id) && (envFilter === "all" || (envFilter === "paper" ? a.environment === "paper" : envFilter === "demo" ? a.environment === "demo" : a.environment === "live-ready")));
  const allBrokers = Array.from(new Map(contextAccounts.map((a) => [a.broker, { key: a.broker, name: a.brokerName }])).values());
  const resolvedBrokers = allBrokers.map((b) => b.key).filter((k) => brokerFilter.length === 0 || brokerFilter.includes(k));
  const universe = universeQ.data ?? [];
  const resolved = universe.filter((s) => resolvedBrokers.some((b) => s.brokerSymbols[b]));
  const eventSymbols = new Set((eventsQ.data ?? []).filter((e) => (e.timeEat.startsWith("Today") || e.timeEat.startsWith("Tomorrow")) && e.impact === 3).flatMap((e) => e.affectedSymbols));

  const focus = (canonical: string, scroll = false) => {
    setFocused(canonical);
    if (scroll) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("mk-chart")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  };

  const tradeMut = useMutation({
    mutationFn: stageTicketDraft,
    onSuccess: (d) => {
      toast(`Ticket prefilled: ${d.side} ${d.canonical} — opening T-3`);
      setDrawer(null);
      navigate({ to: "/dashboard/trade" });
    },
  });
  const trade = (canonical: string, side: "BUY" | "SELL" = "BUY") => {
    const s = universe.find((x) => x.canonical === canonical);
    const acc = contextAccounts.find((a) => s?.brokerSymbols[a.broker]) ?? contextAccounts[0];
    if (!s || !acc) { toast("No account in context lists this symbol"); return; }
    tradeMut.mutate({ canonical, side, accountId: acc.id, price: s.ask, source: "T-2 Markets" });
  };

  const model: MarketsModel = { universe, resolved, contextAccounts, resolvedBrokers, watchlist, setWatchlist, focus, openDrawer: setDrawer, trade, eventSymbols, focused };

  if (accountsQ.isError || universeQ.isError) {
    return (
      <main className="page-dash-markets">
        <MarketsHeader />
        <QueryError title="Could not load the market universe" onRetry={() => { accountsQ.refetch(); universeQ.refetch(); }} />
      </main>
    );
  }

  const loading = accountsQ.isPending || universeQ.isPending || watchQ.isPending;

  return (
    <main className="page-dash-markets" aria-labelledby="os-mk-title">
      <MarketsHeader />
      {loading ? (
        <div className="d-grid gap-3" aria-busy="true">
          <Skel h={170} /><Skel h={260} /><Skel h={420} />
        </div>
      ) : (
        <>
          <ContextBar accounts={accounts} selectedIds={selectedIds} setSelectedIds={setSelectedIds} envFilter={envFilter} setEnvFilter={setEnvFilter} brokerFilter={brokerFilter} setBrokerFilter={setBrokerFilter} resolvedCount={resolved.length} contextAccounts={contextAccounts} allBrokers={allBrokers} />
          <Reveal><WatchlistSection model={model} /></Reveal>
          <ChartSection model={model} />
          <Reveal><AssetTabsSection model={model} /></Reveal>
          <ExplorerSection model={model} />
          <CalendarSection model={model} />
          <Reveal><SpreadMatrixSection model={model} /></Reveal>
          <ResolverSection model={model} />
          <p className="os-mk-risk"><ShieldAlert size={14} aria-hidden /> Quotes, candles and spreads on this page are static snapshots for a frontend-only preview. Trading leveraged products carries a high risk of loss.</p>
        </>
      )}
      {drawer && <SymbolDrawer canonical={drawer} model={model} onClose={() => setDrawer(null)} />}
    </main>
  );
}
