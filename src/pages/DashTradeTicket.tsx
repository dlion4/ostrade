import { getBrokerDefaults } from "@/services/dashboard";
import { mappedBrokerSymbol } from "@/services/markets";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  Compass,
  Info,
  Loader2,
  LockKeyhole,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { TargetAccountPicker } from "@/components/TargetAccountPicker";
import { CountUp } from "@/components/CountUp";
import { BrokerBadge, EnvPill } from "@/components/DashboardShell";
import { QueryError } from "@/components/QueryError";
import { useToast } from "@/components/Toast";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  createSchedule,
  getAccounts,
  type TradingAccount,
} from "@/services/dashboard";
import {
  getMarketUniverse,
  matchesSymbolQuery,
  type MarketSymbol,
} from "@/services/markets";
import {
  consumeStagedTicketDraft,
  DERIV_CONTRACT_TYPES,
  fetchDerivProposal,
  getRecentTickets,
  getTicketCapabilities,
  submitFanoutTicket,
  type AllocationMode,
  type DerivContractType,
  type DerivDurationUnit,
  type FanoutLegInput,
  type FanoutTicketResult,
  type OrderType,
  type RecentTicket,
  type StopMode,
  type TimeInForce,
} from "@/services/tradeTicket";
import { carryOptions, previewRiskTickets, type RiskTicket } from "@/services/risk";
import css from "@/styles/pages/dash-trade-ticket.css?inline";

/* ── Helpers ─────────────────────────────────────────────── */

const FAT_FINGER_USD = 500;

function Skel({ h = 18, w = "100%" }: { h?: number; w?: number | string }) {
  return <span className="os-skel" style={{ height: h, width: w }} aria-hidden />;
}

function fmtPrice(v: number, digits: number): string {
  if (!Number.isFinite(v) || v <= 0) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtUsd(v: number): string {
  return `$${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function SectionHead({
  id,
  eyebrow,
  title,
  sub,
  right,
}: {
  id: string;
  eyebrow: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="os-tt-head">
      <div>
        <span className="os-tt-eyebrow">{eyebrow}</span>
        <h2 id={id} className="os-tt-h2">
          {title}
        </h2>
        {sub && <p className="os-tt-sub">{sub}</p>}
      </div>
      {right && <div className="os-tt-head-right">{right}</div>}
    </div>
  );
}

function estimateNotionalUsd(sym: MarketSymbol | undefined, size: number): number {
  if (!sym || !Number.isFinite(size) || size <= 0) return 0;
  if (sym.volumeUnit === "stake") return size;
  if (sym.volumeUnit === "shares") return size * sym.bid;
  if (sym.assetClass === "Forex") return size * 100000;
  if (sym.canonical === "XAUUSD") return size * 100 * sym.bid;
  if (sym.assetClass === "Crypto") return size * sym.bid;
  return size * sym.bid * 2;
}

function estimateRequiredMargin(
  sym: MarketSymbol | undefined,
  acc: TradingAccount,
  size: number
): number {
  if (!sym || !Number.isFinite(size) || size <= 0) return 0;
  if (acc.broker === "deriv") return size;
  const notional = estimateNotionalUsd(sym, size);
  const levMatch = acc.leverage.match(/1\s*:\s*(\d+)/);
  const lev = levMatch ? Number(levMatch[1]) : 100;
  return Math.round((notional / Math.max(1, lev)) * 100) / 100;
}

function computeSlTpFromMode(
  mode: StopMode,
  side: "BUY" | "SELL",
  entry: number,
  sym: MarketSymbol | undefined,
  slInput: number,
  tpInput: number
): { sl: number; tp: number } {
  if (!sym || mode === "none" || !Number.isFinite(entry) || entry <= 0) {
    return { sl: 0, tp: 0 };
  }
  const dir = side === "BUY" ? 1 : -1;
  const digits = sym.digits;
  const round = (n: number) => Number(Math.max(0, n).toFixed(digits));

  if (mode === "price") {
    return {
      sl: Number.isFinite(slInput) ? round(slInput) : 0,
      tp: Number.isFinite(tpInput) ? round(tpInput) : 0,
    };
  }
  if (mode === "pips") {
    const slDist = (Number.isFinite(slInput) ? slInput : 0) * sym.pip;
    const tpDist = (Number.isFinite(tpInput) ? tpInput : 0) * sym.pip;
    return {
      sl: slDist > 0 ? round(entry - dir * slDist) : 0,
      tp: tpDist > 0 ? round(entry + dir * tpDist) : 0,
    };
  }
  if (mode === "percent") {
    const slDist = entry * ((Number.isFinite(slInput) ? slInput : 0) / 100);
    const tpDist = entry * ((Number.isFinite(tpInput) ? tpInput : 0) / 100);
    return {
      sl: slDist > 0 ? round(entry - dir * slDist) : 0,
      tp: tpDist > 0 ? round(entry + dir * tpDist) : 0,
    };
  }
  // money mode: rough pip value $10/pip per standard lot equivalent
  const slDist = (Number.isFinite(slInput) ? slInput : 0) * sym.pip * 0.5;
  const tpDist = (Number.isFinite(tpInput) ? tpInput : 0) * sym.pip * 0.5;
  return {
    sl: slDist > 0 ? round(entry - dir * slDist) : 0,
    tp: tpDist > 0 ? round(entry + dir * tpDist) : 0,
  };
}

function calcRr(entry: number, sl: number, tp: number): string {
  if (!entry || !sl || !tp) return "—";
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk <= 0) return "—";
  return `1 : ${(reward / risk).toFixed(2)}`;
}

/* ── Confirm & Execute Modal (S6) ────────────────────────── */

function ConfirmTicketModal({
  sym,
  orderType,
  side,
  timeInForce,
  comment,
  legs,
  accountsById,
  totalRequiredMargin,
  needsFatFingerConfirm,
  softWarning,
  submitting,
  onConfirm,
  onCancel,
}: {
  sym: MarketSymbol;
  orderType: OrderType;
  side: "BUY" | "SELL";
  timeInForce: TimeInForce;
  comment: string;
  legs: FanoutLegInput[];
  accountsById: Map<string, TradingAccount>;
  totalRequiredMargin: number;
  needsFatFingerConfirm: boolean;
  submitting: boolean;
  softWarning: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (needsFatFingerConfirm) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [needsFatFingerConfirm, submitting, onCancel]);

  const canProceed =
    !submitting && (!overrideReason.trim() || overrideReason.trim().length >= 12) &&
    (!needsFatFingerConfirm || typed.trim().toUpperCase() === "EXECUTE");

  return (
    <div
      className="os-tt-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div
        className="os-tt-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="os-confirm-ticket-title"
      >
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <span className={`os-side-badge ${side === "BUY" ? "is-buy" : "is-sell"}`}>
              {side}
            </span>
            <h2 id="os-confirm-ticket-title" className="h5 mb-0 os-mono">
              Confirm Fan-Out · {sym.canonical}
            </h2>
          </div>
          <button
            type="button"
            className="os-icon-btn"
            disabled={submitting}
            onClick={onCancel}
            aria-label="Cancel confirmation"
          >
            <X size={18} />
          </button>
        </div>

        <p className="small text-secondary mb-3">
          {orderType} · TIF {timeInForce} · {legs.length} target account
          {legs.length === 1 ? "" : "s"} · Est. total stake/margin{" "}
          <strong className="os-mono">{fmtUsd(totalRequiredMargin)}</strong>
          {comment ? ` · Comment "${comment}"` : ""}
        </p>

        <div className="os-confirm-legs mb-3">
          {legs.map((leg) => {
            const acc = accountsById.get(leg.accountId);
            if (!acc) return null;
            const bSym = mappedBrokerSymbol(sym, acc);
            return (
              <div key={leg.accountId} className="os-confirm-leg">
                <div>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <BrokerBadge broker={acc.broker} label={acc.brokerName} />
                    <strong>{acc.label}</strong>
                    <EnvPill env={acc.environment} />
                  </div>
                  <small className="os-mono text-secondary d-block mt-1">
                    {bSym ? `${sym.canonical} → ${bSym}` : "UNMAPPED SYMBOL (WILL BLOCK)"} ·{" "}
                    {leg.size} {sym.volumeUnit} @ {fmtPrice(leg.entry, sym.digits)}
                  </small>
                </div>
                <div className="text-end os-mono small">
                  <div className="os-down">SL {leg.sl ? fmtPrice(leg.sl, sym.digits) : "—"}</div>
                  <div className="os-up">TP {leg.tp ? fmtPrice(leg.tp, sym.digits) : "—"}</div>
                </div>
              </div>
            );
          })}
        </div>

        {needsFatFingerConfirm && (
          <div className="os-fat-finger mb-3">
            <label htmlFor="os-execute-phrase" className="d-block small fw-bold mb-1">
              <AlertTriangle size={14} className="me-1" aria-hidden />
              Total stake/margin exceeds ${FAT_FINGER_USD} — type{" "}
              <code className="os-mono">EXECUTE</code> to confirm
            </label>
            <input
              ref={inputRef}
              id="os-execute-phrase"
              className="form-control os-mono"
              placeholder="EXECUTE"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}

        {softWarning && <label className="d-block small mb-3">Optional soft shield override reason
          <input className="form-control mt-1" value={overrideReason} maxLength={240} onChange={e=>setOverrideReason(e.target.value)} placeholder="At least 12 characters; no credentials" />
          <span className="text-secondary">This cannot bypass any hard block. Reasons are recorded in the risk audit.</span>
        </label>}
        <div className="os-tt-note is-info mb-3">
          <Info size={15} aria-hidden />
          <span>
            Paper accounts execute locally into Positions &amp; Records. Non-paper
            broker legs resolve cleanly to{" "}
            <strong>Ready — executes when the backend is connected</strong>.
          </span>
        </div>

        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="os-btn os-btn-ghost os-btn-sm"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancel (Esc)
          </button>
          <button
            type="button"
            className="os-btn os-btn-primary os-btn-sm"
            disabled={!canProceed}
            onClick={() => onConfirm(overrideReason.trim() || undefined)}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="os-spin" aria-hidden /> Dispatching fan-out…
              </>
            ) : (
              <>
                <Zap size={15} aria-hidden /> Submit {legs.length} Leg
                {legs.length === 1 ? "" : "s"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Recent Tickets Table (S7 - TanStack Table) ──────────── */

const ticketColHelper = createColumnHelper<RecentTicket>();

function RecentTicketsSection({
  tickets,
  onRepeat,
  onReverse,
  onSchedule,
  scheduling,
}: {
  tickets: RecentTicket[];
  onRepeat: (t: RecentTicket) => void;
  onReverse: (t: RecentTicket) => void;
  onSchedule: (t: RecentTicket) => void;
  scheduling: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(
    () => [
      ticketColHelper.accessor("timestampEat", {
        header: "Time",
        cell: (info) => (
          <div>
            <span className="os-mono fw-semibold d-block">{info.getValue()}</span>
            <small className="os-mono text-secondary">{info.row.original.ref}</small>
          </div>
        ),
      }),
      ticketColHelper.accessor("canonical", {
        header: "Symbol",
        cell: (info) => (
          <div>
            <strong className="os-mono">{info.getValue()}</strong>
            <small className="d-block text-secondary">{info.row.original.orderType}</small>
          </div>
        ),
      }),
      ticketColHelper.accessor("side", {
        header: "Side",
        cell: (info) => {
          const s = info.getValue();
          return (
            <span className={`os-side-badge ${s === "BUY" ? "is-buy" : "is-sell"}`}>
              {s} {s === "BUY" ? "▲" : "▼"}
            </span>
          );
        },
      }),
      ticketColHelper.accessor("baseSize", {
        header: "Size",
        cell: (info) => (
          <span className="os-mono">
            {info.getValue()} {info.row.original.sizeUnit}
          </span>
        ),
      }),
      ticketColHelper.display({
        id: "accounts",
        header: "Target Accounts",
        cell: (info) => (
          <div className="d-flex flex-wrap gap-1">
            {info.row.original.accounts.map((a) => (
              <BrokerBadge key={a.accountId + a.label} broker={a.broker} label={a.label} />
            ))}
          </div>
        ),
      }),
      ticketColHelper.accessor("summary", {
        header: "Result Summary",
        cell: (info) => {
          const r = info.row.original;
          return (
            <div>
              <span className="small fw-semibold d-block">{info.getValue()}</span>
              {r.comment && (
                <small className="text-secondary os-mono">“{r.comment}”</small>
              )}
            </div>
          );
        },
      }),
      ticketColHelper.display({
        id: "actions",
        header: "Quick Actions",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="d-flex flex-wrap gap-1">
              <button
                type="button"
                className="os-tkt-action"
                onClick={() => onRepeat(row)}
                title="Load this exact ticket back into the builder"
              >
                <RotateCcw size={12} aria-hidden /> Repeat
              </button>
              <button
                type="button"
                className="os-tkt-action"
                onClick={() => onReverse(row)}
                title="Load with BUY/SELL flipped"
              >
                <ArrowLeftRight size={12} aria-hidden /> Reverse
              </button>
              <button
                type="button"
                className="os-tkt-action"
                disabled={scheduling}
                onClick={() => onSchedule(row)}
                title="Queue this trade in T-6 Scheduler"
              >
                <CalendarClock size={12} aria-hidden /> Schedule
              </button>
            </div>
          );
        },
      }),
    ],
    [onRepeat, onReverse, onSchedule, scheduling]
  );

  const table = useReactTable({
    data: tickets.slice(0, 12),
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="os-tt-table-wrap">
      <table className="os-tt-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} scope="col">
                  {h.column.getCanSort() ? (
                    <button
                      type="button"
                      className="os-th-sort"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      <ArrowUpDown size={12} aria-hidden />
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
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td
                  key={c.id}
                  data-label={typeof c.column.columnDef.header === "string" ? c.column.columnDef.header : ""}
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Page Component ─────────────────────────────────── */

export function DashTradeTicketPage() {
  usePageStyle("dash-trade-ticket", css);
  const toast = useToast();
  const qc = useQueryClient();
  const { activeAccountId, fanoutAccountIds, globalMode, killSwitch } = useDashboardContext();

  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const defaultsQ = useQuery({queryKey:["broker-defaults"],queryFn:getBrokerDefaults});
  const universeQ = useQuery({ queryKey: ["market-universe"], queryFn: getMarketUniverse });
  const ticketsQ = useQuery({ queryKey: ["recent-tickets"], queryFn: getRecentTickets });
  const capsQ = useQuery({ queryKey: ["ticket-capabilities"], queryFn: getTicketCapabilities });

  const allAccounts = accountsQ.data ?? [];
  const selectableAccounts = useMemo(
    () => allAccounts.filter((a) => a.connected || a.environment === "live-ready"),
    [allAccounts]
  );
  const accountsById = useMemo(
    () => new Map(allAccounts.map((a) => [a.id, a])),
    [allAccounts]
  );

  // S1 Account Multi-Select & Allocation state
  const [selectedAccIds, setSelectedAccIds] = useState<string[]>([
    "acc-paper-main",
    "acc-exness-trial",
  ]);
  const [allocMode, setAllocMode] = useState<AllocationMode>("same");
  const [customSizes, setCustomSizes] = useState<Record<string, number>>({});

  // S2 Instrument state
  const [symbolSearch, setSymbolSearch] = useState("");
  const [canonical, setCanonical] = useState("XAUUSD");
  const [stagedSourceNote, setStagedSourceNote] = useState<string | null>(null);

  // S3 Order Builder state
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [baseSize, setBaseSize] = useState<string>("0.15");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [stopTriggerPrice, setStopTriggerPrice] = useState<string>("");
  const [stopMode, setStopMode] = useState<StopMode>("pips");
  const [slInput, setSlInput] = useState<string>("75");
  const [tpInput, setTpInput] = useState<string>("160");
  const [timeInForce, setTimeInForce] = useState<TimeInForce>("GTC");
  const [carry, setCarry] = useState<NonNullable<RiskTicket["carry"]>>("Intraday");
  const [comment, setComment] = useState<string>("OStrade fan-out");

  // S5 Deriv Contract Builder state
  const [showDerivPreview, setShowDerivPreview] = useState(false);
  const [derivContract, setDerivContract] = useState<DerivContractType>("Multiplier");
  const [derivDuration, setDerivDuration] = useState<string>("5");
  const [derivDurationUnit, setDerivDurationUnit] = useState<DerivDurationUnit>("minutes");
  const [derivStake, setDerivStake] = useState<string>("25");
  const [derivMultiplier, setDerivMultiplier] = useState<number>(200);
  const [derivCancel, setDerivCancel] = useState<boolean>(true);
  const [derivGrowth, setDerivGrowth] = useState<number>(2);

  // S6 Confirm & Receipts state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastReceipts, setLastReceipts] = useState<FanoutTicketResult | null>(null);

  useEffect(() => {
    const prev = document.title;
    document.title = "Trade Ticket (T-3) · OStrade";
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    if (!defaultsQ.data) return;
    setTimeInForce(tif => tif === 'GTC' ? defaultsQ.data.tif : tif);
    if (!fanoutAccountIds.length && activeAccountId === 'all' && defaultsQ.data.manual) {
      setSelectedAccIds(ids => ids.length === 2 && ids[0] === 'acc-paper-main' && ids[1] === 'acc-exness-trial' ? [defaultsQ.data.manual] : ids);
    }
  }, [defaultsQ.data, activeAccountId, fanoutAccountIds]);

  // Hydrate draft handed off from T-2 Markets (if any) or sync with single active account
  useEffect(() => {
    const draft = consumeStagedTicketDraft();
    if (draft) {
      setCanonical(draft.canonical);
      setSide(draft.side);
      if (draft.accountId) setSelectedAccIds([draft.accountId]);
      setStagedSourceNote(
        `Prefilled from ${draft.source}: ${draft.side} ${draft.canonical} @ ${draft.price}`
      );
      toast(`Ticket prefilled from ${draft.source}: ${draft.canonical}`);
    } else if (fanoutAccountIds.length) {
      setSelectedAccIds(fanoutAccountIds);
    } else if (activeAccountId !== "all") {
      setSelectedAccIds([activeAccountId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const universe = universeQ.data ?? [];
  const activeSym = useMemo(
    () => universe.find((s) => s.canonical === canonical) ?? universe[0],
    [universe, canonical]
  );

  // When symbol changes, keep default order entry synced when not Market
  useEffect(() => {
    if (!activeSym) return;
    setLimitPrice((side === "BUY" ? activeSym.ask : activeSym.bid).toFixed(activeSym.digits));
    setStopTriggerPrice((side === "BUY" ? activeSym.ask : activeSym.bid).toFixed(activeSym.digits));
  }, [activeSym?.canonical, side]);

  const selectedAccounts = useMemo(
    () =>
      selectedAccIds
        .map((id) => accountsById.get(id))
        .filter((a): a is TradingAccount => !!a),
    [selectedAccIds, accountsById]
  );

  const hasLiveSelected = selectedAccounts.some(
    (a) => a.environment === "live-ready"
  );
  const hasDerivSelected = selectedAccounts.some((a) => a.broker === "deriv");

  // S5 Deriv Proposal query (refreshes cleanly on parameter change or manual click — zero interval)
  const numericDerivStake = Math.max(1, parseFloat(derivStake) || 25);
  const derivProposalQ = useQuery({
    queryKey: [
      "deriv-proposal",
      canonical,
      derivContract,
      side,
      numericDerivStake,
      derivDuration,
      derivDurationUnit,
      derivMultiplier,
      derivCancel,
      derivGrowth,
    ],
    queryFn: () =>
      fetchDerivProposal({
        canonical,
        contractType: derivContract,
        side,
        stake: numericDerivStake,
        duration: Math.max(1, parseInt(derivDuration, 10) || 5),
        durationUnit: derivDurationUnit,
        multiplier: derivMultiplier,
        dealCancellation: derivCancel,
        growthRatePct: derivGrowth,
      }),
    enabled: hasDerivSelected || showDerivPreview,
  });

  // Compute per-account allocations & bracket levels
  const parsedBaseSize = Math.max(0.001, parseFloat(baseSize) || 0.1);
  const baseEquity =
    selectedAccounts[0]?.equity && selectedAccounts[0].equity > 0
      ? selectedAccounts[0].equity
      : 10000;

  const entryPrice = useMemo(() => {
    if (!activeSym) return 0;
    if (orderType === "Market") return side === "BUY" ? activeSym.ask : activeSym.bid;
    const p = parseFloat(limitPrice);
    return Number.isFinite(p) && p > 0 ? p : activeSym.ask;
  }, [activeSym, orderType, side, limitPrice]);

  const { sl: computedSl, tp: computedTp } = useMemo(
    () =>
      computeSlTpFromMode(
        stopMode,
        side,
        entryPrice,
        activeSym,
        parseFloat(slInput),
        parseFloat(tpInput)
      ),
    [stopMode, side, entryPrice, activeSym, slInput, tpInput]
  );

  const legs: FanoutLegInput[] = useMemo(() => {
    return selectedAccounts.map((acc) => {
      let size = parsedBaseSize;
      if (acc.broker === "deriv" && activeSym?.assetClass !== "Synthetics") {
        // Deriv contract stake or scaled FX stake
        size = Math.max(1, Math.round(parsedBaseSize * 100));
      }
      if (allocMode === "equity") {
        const scaled = parsedBaseSize * (acc.equity / baseEquity);
        size = Math.max(
          activeSym?.minVolume ?? 0.01,
          Number(scaled.toFixed(activeSym?.volumeUnit === "stake" ? 0 : 2))
        );
      } else if (allocMode === "custom" && customSizes[acc.id] !== undefined) {
        size = customSizes[acc.id];
      }
      return {
        accountId: acc.id,
        size,
        entry: entryPrice,
        sl: computedSl,
        tp: computedTp,
      };
    });
  }, [
    selectedAccounts,
    parsedBaseSize,
    allocMode,
    baseEquity,
    customSizes,
    activeSym,
    entryPrice,
    computedSl,
    computedTp,
  ]);

  // S4 Risk Preview calculations
  const riskRows = useMemo(() => {
    return legs.map((leg) => {
      const acc = accountsById.get(leg.accountId)!;
      const bSym = mappedBrokerSymbol(activeSym, acc);
      const reqMargin = estimateRequiredMargin(activeSym, acc, leg.size);
      const marginPctDelta =
        acc.equity > 0 ? (reqMargin / acc.equity) * 100 : 0;
      const resultingMarginPct = Math.min(
        100,
        Math.round((acc.marginUsedPct + marginPctDelta) * 10) / 10
      );
      const stakePct = acc.equity > 0 ? (reqMargin / acc.equity) * 100 : 0;
      const spreadVal = activeSym?.spreads[acc.broker] ?? 1.2;
      const spreadCost =
        Math.round(spreadVal * Math.max(0.01, leg.size) * 1.4 * 100) / 100;
      return {
        acc,
        leg,
        mapped: !!bSym,
        brokerSymbol: bSym ?? "Not listed",
        reqMargin,
        resultingMarginPct,
        stakePct,
        spreadCost,
        swapEstimate: activeSym?.swapLong ?? "—",
      };
    });
  }, [legs, accountsById, activeSym]);

  const totalRequiredMargin = riskRows.reduce((s, r) => s + r.reqMargin, 0);
  const needsFatFingerConfirm = totalRequiredMargin > FAT_FINGER_USD;

  // Read-only checklist; actual admission always refreshes the policy and records the decision.
  const ticketsForRisk: RiskTicket[] = activeSym ? legs.map(leg=>({...leg,symbol:activeSym.canonical,side,channel:"Manual",carry})) : [];
  const preflight = useQuery({queryKey:["risk","ticket-preview",killSwitch,ticketsForRisk],queryFn:()=>previewRiskTickets(ticketsForRisk),enabled:ticketsForRisk.length>0});
  const guardrailChecks = (preflight.data??[]).flatMap(row=>row.checks.map(c=>({
    id:`${row.accountId}:${c.id}`, label:c.label, pass:c.decision==="PASS", note:`${row.scope} · ${c.detail}${c.decision==="BLOCK"&&c.overridable?" Manual review permitted.":""}`,
  })));
  const softWarning = preflight.data?.some(row=>row.checks.some(c=>c.decision==="BLOCK"&&c.overridable)&&!row.checks.some(c=>c.decision==="BLOCK"&&!c.overridable))??false;

  // Mutations
  const fanoutMut = useMutation({
    mutationFn: submitFanoutTicket,
    onSuccess: (res) => {
      setLastReceipts(res);
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      qc.invalidateQueries({ queryKey: ["recent-tickets"] });
      qc.invalidateQueries({ queryKey: ["risk"] });
      toast(
        `${res.filledCount} filled · ${res.readyCount} backend preview · ${res.blockedCount} blocked`
      );
    },
  });

  const scheduleMut = useMutation({
    mutationFn: (t: RecentTicket) =>
      createSchedule({
        symbol: t.canonical,
        side: t.side,
        lots: String(t.baseSize),
        accountId: t.accounts[0]?.accountId ?? "acc-paper-main",
        timeEat: "18:00 EAT",
        countdown: "in 1h 20m",
        trigger: "Time Window",
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["records"] });
      toast(res.title);
    },
  });

  const handleOpenConfirm = () => {
    if (legs.length === 0) {
      toast("Select at least one target account in S1");
      return;
    }
    setConfirmOpen(true);
  };

  // Keyboard shortcut: Ctrl+Enter opens confirm modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !confirmOpen) {
        e.preventDefault();
        handleOpenConfirm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const filteredSymbols = useMemo(() => {
    if (!symbolSearch.trim()) return universe.slice(0, 12);
    return universe.filter((s) => matchesSymbolQuery(s, symbolSearch)).slice(0, 12);
  }, [universe, symbolSearch]);

  const toggleAccountSelection = (id: string) => {
    setSelectedAccIds((cur) => {
      if (cur.includes(id)) {
        if (cur.length === 1) {
          toast("Keep at least one target account selected");
          return cur;
        }
        return cur.filter((x) => x !== id);
      }
      return [...cur, id];
    });
  };

  const applyTicketPreset = (t: RecentTicket, flipSide: boolean) => {
    setCanonical(t.canonical);
    setOrderType(t.orderType);
    setSide(flipSide ? (t.side === "BUY" ? "SELL" : "BUY") : t.side);
    setBaseSize(String(t.baseSize));
    if (t.sl > 0 && t.tp > 0) {
      setStopMode("price");
      setSlInput(String(flipSide ? t.tp : t.sl));
      setTpInput(String(flipSide ? t.sl : t.tp));
    }
    const validIds = t.accounts
      .map((a) => a.accountId)
      .filter((id) => accountsById.has(id));
    if (validIds.length > 0) setSelectedAccIds(validIds);
    setComment(t.comment);
    setLastReceipts(null);
    toast(
      flipSide
        ? `Reversed ${t.canonical} to ${t.side === "BUY" ? "SELL" : "BUY"}`
        : `Loaded ${t.canonical} ticket into builder`
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (accountsQ.isError || universeQ.isError) {
    return (
      <main className="page-dash-trade-ticket">
        <QueryError
          title="Could not load Trade Ticket data"
          onRetry={() => {
            accountsQ.refetch();
            universeQ.refetch();
          }}
        />
      </main>
    );
  }

  const loading = accountsQ.isPending || universeQ.isPending;

  return (
    <main className="page-dash-trade-ticket" aria-labelledby="os-tt-title">
      {/* Header */}
      <header className="os-tt-section os-tt-intro">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="os-tt-eyebrow">T-3 · MULTI-ACCOUNT FAN-OUT</span>
            <span className="os-tt-static">
              STATIC SNAPSHOT · NO LIVE TICKING · CTRL+ENTER TO SUBMIT
            </span>
          </div>
          <h1 id="os-tt-title" className="os-tt-h1">
            Trade Ticket
          </h1>
          <p className="os-tt-lead">
            Build an order once — fire it to Paper, Deriv, Exness/MT5, or Alpaca
            simultaneously with live risk sizing, Deriv contract proposals, and
            execution receipts.
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/dashboard/markets" className="os-btn os-btn-ghost os-btn-sm">
            <Compass size={15} aria-hidden /> Markets (T-2)
          </Link>
          <Link to="/dashboard/signals" className="os-btn os-btn-ghost os-btn-sm">
            Signal Desk (T-4)
          </Link>
          <button
            type="button"
            className="os-btn os-btn-primary os-btn-sm"
            disabled={loading || !activeSym}
            onClick={handleOpenConfirm}
          >
            <Zap size={15} aria-hidden /> Review &amp; Submit ({legs.length})
          </button>
        </div>
      </header>

      {stagedSourceNote && (
        <div className="os-tt-section os-tt-note is-info" role="status">
          <Sparkles size={16} aria-hidden />
          <span className="flex-grow-1">{stagedSourceNote}</span>
          <button
            type="button"
            className="os-icon-btn"
            onClick={() => setStagedSourceNote(null)}
            aria-label="Dismiss prefill notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {loading || !activeSym ? (
        <div className="d-grid gap-3" aria-busy="true">
          <Skel h={170} />
          <Skel h={220} />
          <Skel h={320} />
        </div>
      ) : (
        <>
          {/* S1 · Account Multi-Select */}
          <section className="os-tt-section" aria-labelledby="os-s1-title">
            <div className="os-tt-card">
              <SectionHead
                id="os-s1-title"
                eyebrow="S1 · ACCOUNT MULTI-SELECT"
                title={`Target Accounts (${selectedAccounts.length} selected)`}
                sub="Choose one account or fan out across multiple brokers. Allocation mode scales sizes automatically."
                right={
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="os-tt-chip-btn"
                      onClick={() =>
                        setSelectedAccIds(
                          selectableAccounts
                            .filter((a) => a.connected)
                            .map((a) => a.id)
                        )
                      }
                    >
                      Select all connected
                    </button>
                    <button
                      type="button"
                      className="os-tt-chip-btn"
                      onClick={() =>
                        setSelectedAccIds(
                          selectableAccounts
                            .filter((a) => a.environment === "demo" || a.environment === "paper")
                            .map((a) => a.id)
                        )
                      }
                    >
                      Select demo/paper
                    </button>
                    <button
                      type="button"
                      className="os-tt-chip-btn"
                      onClick={() =>
                        setSelectedAccIds(
                          selectableAccounts
                            .filter((a) => a.environment === "live-ready")
                            .map((a) => a.id)
                        )
                      }
                    >
                      Select live-ready
                    </button>
                  </div>
                }
              />

              <TargetAccountPicker accounts={selectableAccounts} selected={selectedAccIds} onToggle={toggleAccountSelection} />

              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pt-2 border-top">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="os-tt-label mb-0">Allocation Mode:</span>
                  <div
                    className="os-tt-seg"
                    role="group"
                    aria-label="Allocation mode"
                  >
                    {(
                      [
                        ["same", "Same size on each"],
                        ["equity", "Scale by equity %"],
                        ["custom", "Custom per account"],
                      ] as const
                    ).map(([id, lbl]) => (
                      <button
                        key={id}
                        type="button"
                        className={allocMode === id ? "is-on" : ""}
                        onClick={() => setAllocMode(id)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="small text-secondary">
                  Global mode:{" "}
                  <strong className="os-mono">{globalMode.toUpperCase()}</strong>
                </span>
              </div>

              {hasLiveSelected && globalMode === "paper" && (
                <div className="os-tt-note is-warn mt-3" role="alert">
                  <ShieldAlert size={16} aria-hidden />
                  <span>
                    <strong>Live-Mode Guardrail:</strong> A live-ready account is
                    selected while Global Mode is <strong>PAPER</strong>. In
                    this frontend preview, live legs safely resolve to{" "}
                    <em>Ready — executes when the backend is connected</em>.
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* S2 · Instrument Selector & Cross-Account Mapping */}
          <section className="os-tt-section" aria-labelledby="os-s2-title">
            <div className="os-tt-card">
              <SectionHead
                id="os-s2-title"
                eyebrow="S2 · INSTRUMENT & SYMBOL MAPPING"
                title={`${activeSym.canonical} · ${activeSym.name}`}
                sub="Canonical symbols translate visibly per broker before submission — never silent magic."
                right={
                  <div className="os-tt-search">
                    <Search size={15} aria-hidden />
                    <label htmlFor="tt-sym-search" className="visually-hidden">
                      Search canonical or broker symbol
                    </label>
                    <input
                      id="tt-sym-search"
                      value={symbolSearch}
                      onChange={(e) => setSymbolSearch(e.target.value)}
                      placeholder="Search XAUUSD, eurusdm, R_75…"
                    />
                  </div>
                }
              />

              <div className="os-sym-strip mb-3" role="tablist" aria-label="Quick instrument selector">
                {filteredSymbols.map((s) => (
                  <button
                    key={s.canonical}
                    type="button"
                    role="tab"
                    aria-selected={s.canonical === canonical}
                    className={`os-sym-pill ${s.canonical === canonical ? "is-active" : ""}`}
                    onClick={() => {
                      setCanonical(s.canonical);
                      setLastReceipts(null);
                    }}
                  >
                    <span className="os-mono fw-bold">{s.canonical}</span>
                    <small className={s.changePct >= 0 ? "os-up" : "os-down"}>
                      {s.changePct >= 0 ? "+" : ""}
                      {s.changePct.toFixed(2)}%
                    </small>
                  </button>
                ))}
              </div>

              <div className="row g-3 align-items-stretch">
                <div className="col-12 col-lg-5">
                  <div className="os-quote-snapshot h-100">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="os-tt-label mb-0">
                        Composite Snapshot ({activeSym.assetClass})
                      </span>
                      <span
                        className={`os-sess-chip ${activeSym.tradeableNow ? "is-open" : ""}`}
                      >
                        {activeSym.is247
                          ? "24/7 OPEN"
                          : activeSym.tradeableNow
                            ? "SESSION OPEN"
                            : "SESSION CLOSED"}
                      </span>
                    </div>
                    <div className="os-quote-boxes">
                      <div>
                        <span>Bid</span>
                        <strong className="os-mono">
                          {fmtPrice(activeSym.bid, activeSym.digits)}
                        </strong>
                      </div>
                      <div>
                        <span>Ask</span>
                        <strong className="os-mono">
                          {fmtPrice(activeSym.ask, activeSym.digits)}
                        </strong>
                      </div>
                      <div>
                        <span>Spread</span>
                        <strong className="os-mono">
                          {activeSym.spreads.paper ?? 1.2} {activeSym.spreadUnit}
                        </strong>
                      </div>
                    </div>
                    <p className="small text-secondary mt-2 mb-0">
                      Sessions: {activeSym.sessionsEat}
                    </p>
                  </div>
                </div>

                <div className="col-12 col-lg-7">
                  <div className="os-map-box h-100">
                    <span className="os-tt-label mb-2">
                      Per-Account Broker Symbol Resolution
                    </span>
                    <div className="os-map-rows">
                      {selectedAccounts.map((acc) => {
                        const bSym = mappedBrokerSymbol(activeSym, acc);
                        return (
                          <div
                            key={acc.id}
                            className={`os-map-row ${!bSym ? "is-missing" : ""}`}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <BrokerBadge
                                broker={acc.broker}
                                label={acc.brokerName}
                              />
                              <span className="small fw-semibold">
                                {acc.label}
                              </span>
                            </div>
                            <div className="os-mono small">
                              {bSym ? (
                                <span>
                                  {activeSym.canonical} →{" "}
                                  <strong className="os-up">{bSym}</strong> ·
                                  Spread {activeSym.spreads[acc.broker] ?? "—"}{" "}
                                  {activeSym.spreadUnit}
                                </span>
                              ) : (
                                <span className="os-down fw-bold">
                                  Symbol not available on {acc.brokerName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* S3 + S4 · Order Builder & Live Risk Preview */}
          <section className="os-tt-section" aria-labelledby="os-s3-title">
            <div className="row g-4">
              {/* S3 Order Builder */}
              <div className="col-12 col-xl-7">
                <div className="os-tt-card h-100">
                  <SectionHead
                    id="os-s3-title"
                    eyebrow="S3 · ORDER BUILDER"
                    title="Order Parameters & Bracket Preview"
                    sub="Manual adjustments always take priority. Supports Market, Limit, Stop, and Stop-Limit."
                  />

                  {/* Side & Order Type */}
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-5">
                      <span className="os-tt-label">Direction</span>
                      <div className="os-side-grid" role="group" aria-label="Order side">
                        <button
                          type="button"
                          className={`os-side-btn is-buy ${side === "BUY" ? "is-active" : ""}`}
                          onClick={() => setSide("BUY")}
                        >
                          BUY ▲
                        </button>
                        <button
                          type="button"
                          className={`os-side-btn is-sell ${side === "SELL" ? "is-active" : ""}`}
                          onClick={() => setSide("SELL")}
                        >
                          SELL ▼
                        </button>
                      </div>
                    </div>

                    <div className="col-12 col-md-7">
                      <span className="os-tt-label">Order Type</span>
                      <div className="os-tt-seg w-100" role="group" aria-label="Order type">
                        {(["Market", "Limit", "Stop", "Stop-Limit"] as OrderType[]).map(
                          (ot) => (
                            <button
                              key={ot}
                              type="button"
                              className={`flex-grow-1 ${orderType === ot ? "is-on" : ""}`}
                              onClick={() => setOrderType(ot)}
                            >
                              {ot}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Size, Entry, TIF, Comment */}
                  <div className="row g-3 mb-3">
                    <div className="col-6 col-sm-4">
                      <label htmlFor="tt-size" className="os-tt-label">
                        Base Size ({activeSym.volumeUnit})
                      </label>
                      <div className="os-stepper-wrap">
                        <button
                          type="button"
                          aria-label="Decrease size"
                          onClick={() => {
                            const next = Math.max(
                              activeSym.minVolume,
                              Number(
                                (parsedBaseSize - activeSym.volumeStep * 5).toFixed(2)
                              )
                            );
                            setBaseSize(String(next));
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          id="tt-size"
                          className="form-control os-mono text-center"
                          value={baseSize}
                          onChange={(e) => setBaseSize(e.target.value)}
                        />
                        <button
                          type="button"
                          aria-label="Increase size"
                          onClick={() => {
                            const next = Math.min(
                              activeSym.maxVolume,
                              Number(
                                (parsedBaseSize + activeSym.volumeStep * 5).toFixed(2)
                              )
                            );
                            setBaseSize(String(next));
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {orderType !== "Market" && (
                      <div className="col-6 col-sm-4">
                        <label htmlFor="tt-entry" className="os-tt-label">
                          {orderType} Price
                        </label>
                        <input
                          id="tt-entry"
                          className="form-control os-mono"
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(e.target.value)}
                        />
                      </div>
                    )}

                    {orderType === "Stop-Limit" && (
                      <div className="col-6 col-sm-4">
                        <label htmlFor="tt-stop-trig" className="os-tt-label">
                          Trigger Price
                        </label>
                        <input
                          id="tt-stop-trig"
                          className="form-control os-mono"
                          value={stopTriggerPrice}
                          onChange={(e) => setStopTriggerPrice(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="col-6 col-sm-4">
                      <label htmlFor="tt-tif" className="os-tt-label">
                        Time-in-Force
                      </label>
                      <select
                        id="tt-tif"
                        className="form-select os-mono"
                        value={timeInForce}
                        onChange={(e) =>
                          setTimeInForce(e.target.value as TimeInForce)
                        }
                      >
                        <option value="GTC">GTC (Good Til Cancel)</option>
                        <option value="DAY" disabled={hasDerivSelected}>
                          DAY {hasDerivSelected ? "(MT5/Alpaca only)" : ""}
                        </option>
                        <option value="IOC" disabled={hasDerivSelected}>
                          IOC {hasDerivSelected ? "(MT5/Alpaca only)" : ""}
                        </option>
                      </select>
                    </div>

                    <div className="col-12 col-sm-4">
                      <label htmlFor="tt-comment" className="os-tt-label">
                        MT5 Comment ({comment.length}/32)
                      </label>
                      <input
                        id="tt-comment"
                        maxLength={32}
                        className="form-control os-mono"
                        value={comment}
                        onChange={(e) => setComment(e.target.value.slice(0, 32))}
                      />
                    </div>
                  </div>

                  {/* SL/TP Mode */}
                  <div className="os-sltp-box mb-3">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                      <span className="os-tt-label mb-0">
                        Stop Loss / Take Profit Mode
                      </span>
                      <div className="os-tt-seg" role="group" aria-label="SL/TP mode">
                        {(
                          [
                            ["none", "None"],
                            ["price", "Price"],
                            ["pips", "Pips"],
                            ["percent", "% Entry"],
                            ["money", "$ Money"],
                          ] as [StopMode, string][]
                        ).map(([m, lbl]) => (
                          <button
                            key={m}
                            type="button"
                            className={stopMode === m ? "is-on" : ""}
                            onClick={() => {
                              setStopMode(m);
                              if (m === "price" && activeSym) {
                                const dir = side === "BUY" ? 1 : -1;
                                setSlInput(
                                  (entryPrice - dir * activeSym.pip * 50).toFixed(
                                    activeSym.digits
                                  )
                                );
                                setTpInput(
                                  (entryPrice + dir * activeSym.pip * 110).toFixed(
                                    activeSym.digits
                                  )
                                );
                              } else if (m === "pips") {
                                setSlInput("75");
                                setTpInput("160");
                              } else if (m === "percent") {
                                setSlInput("0.5");
                                setTpInput("1.1");
                              } else if (m === "money") {
                                setSlInput("50");
                                setTpInput("110");
                              }
                            }}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {stopMode !== "none" && (
                      <div className="row g-2">
                        <div className="col-6">
                          <label htmlFor="tt-sl-val" className="os-tt-label">
                            Stop Loss ({stopMode})
                          </label>
                          <input
                            id="tt-sl-val"
                            className="form-control os-mono"
                            value={slInput}
                            onChange={(e) => setSlInput(e.target.value)}
                          />
                        </div>
                        <div className="col-6">
                          <label htmlFor="tt-tp-val" className="os-tt-label">
                            Take Profit ({stopMode})
                          </label>
                          <input
                            id="tt-tp-val"
                            className="form-control os-mono"
                            value={tpInput}
                            onChange={(e) => setTpInput(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bracket Preview Table */}
                  <span className="os-tt-label">
                    Per-Account Allocation &amp; Bracket Preview
                  </span>
                  <div className="os-tt-table-wrap">
                    <table className="os-tt-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Size</th>
                          <th>Entry</th>
                          <th>Stop Loss</th>
                          <th>Take Profit</th>
                          <th>R : R</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legs.map((leg) => {
                          const acc = accountsById.get(leg.accountId)!;
                          return (
                            <tr key={leg.accountId}>
                              <td data-label="Account">
                                <BrokerBadge
                                  broker={acc.broker}
                                  label={acc.label}
                                />
                              </td>
                              <td data-label="Size" className="os-mono">
                                {allocMode === "custom" ? (
                                  <input
                                    aria-label={`Custom size for ${acc.label}`}
                                    className="form-control form-control-sm os-mono"
                                    style={{ width: 90 }}
                                    value={customSizes[acc.id] ?? leg.size}
                                    onChange={(e) =>
                                      setCustomSizes((cur) => ({
                                        ...cur,
                                        [acc.id]: Math.max(
                                          0.01,
                                          parseFloat(e.target.value) || 0.01
                                        ),
                                      }))
                                    }
                                  />
                                ) : (
                                  `${leg.size} ${activeSym.volumeUnit}`
                                )}
                              </td>
                              <td data-label="Entry" className="os-mono">
                                {fmtPrice(leg.entry, activeSym.digits)}
                              </td>
                              <td data-label="SL" className="os-mono os-down">
                                {fmtPrice(leg.sl, activeSym.digits)}
                              </td>
                              <td data-label="TP" className="os-mono os-up">
                                {fmtPrice(leg.tp, activeSym.digits)}
                              </td>
                              <td data-label="R:R" className="os-mono fw-bold">
                                {calcRr(leg.entry, leg.sl, leg.tp)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* S4 Risk Preview & Guardrail Strip */}
              <div className="col-12 col-xl-5">
                <div className="os-tt-card h-100 d-flex flex-column">
                  <SectionHead
                    id="os-s4-title"
                    eyebrow="S4 · RISK PREVIEW & GUARDRAILS"
                    title="Pre-Trade Margin & Rule Checks"
                    sub="Updates immediately from your ticket size and active account equity."
                  />

                  <div className="os-risk-summary mb-3">
                    <div>
                      <span>Total Est. Margin / Stake</span>
                      <strong className="os-mono">
                        $<CountUp value={Math.round(totalRequiredMargin)} />
                      </strong>
                    </div>
                    <div>
                      <span>Legs Ready</span>
                      <strong className="os-mono">
                        {preflight.data?.filter(row=>row.checks.every(c=>c.decision==="PASS")).length ?? "—"} / {riskRows.length}
                      </strong>
                    </div>
                    <div>
                      <span>Asset Class Exposure</span>
                      <strong>{activeSym.assetClass}</strong>
                    </div>
                  </div>

                  <div className="os-risk-accounts mb-3">
                    {riskRows.map((r) => (
                      <div key={r.acc.id} className="os-risk-acc-row">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <strong>{r.acc.label}</strong>
                          <span className="os-mono small">
                            Margin {r.acc.marginUsedPct}% →{" "}
                            <b
                              className={
                                r.resultingMarginPct > 80
                                  ? "os-down"
                                  : r.resultingMarginPct > 60
                                    ? "os-warn"
                                    : "os-up"
                              }
                            >
                              {r.resultingMarginPct}%
                            </b>
                          </span>
                        </div>
                        <div className="d-flex justify-content-between small text-secondary os-mono">
                          <span>Req {fmtUsd(r.reqMargin)} ({r.stakePct.toFixed(1)}% eq)</span>
                          <span>Spread ~{fmtUsd(r.spreadCost)} · Swap {r.swapEstimate}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="d-block mb-3">
                    <span className="os-tt-label">Intended hold</span>
                    <select className="form-select" value={carry} onChange={e=>setCarry(e.target.value as NonNullable<RiskTicket["carry"]>)}>{carryOptions.map(c=><option key={c}>{c}</option>)}</select>
                  </label>
                  <span className="os-tt-label">T-14 Pre-Trade Guardrail Strip</span>
                  {ticketsForRisk.length>0&&preflight.isPending&&<p role="status" className="small text-secondary">Evaluating fixed snapshot and active policy…</p>}
                  {preflight.isError&&<p role="alert">Pre-trade preview could not load. <button type="button" onClick={()=>void preflight.refetch()}>Retry</button></p>}
                  <ul className="os-guard-strip mb-3">
                    {guardrailChecks.map((g) => (
                      <li key={g.id} className={g.pass ? "is-pass" : "is-fail"}>
                        <span className="os-guard-dot" aria-hidden>
                          {g.pass ? <Check size={13} /> : <X size={13} />}
                        </span>
                        <div>
                          <strong>{g.label}</strong>
                          <small>{g.note}</small>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-3 border-top d-grid gap-2">
                    <button
                      type="button"
                      className="os-btn os-btn-primary os-btn-lg"
                      onClick={handleOpenConfirm}
                    >
                      <Zap size={17} aria-hidden /> Review &amp; Execute{" "}
                      {legs.length} Leg{legs.length === 1 ? "" : "s"} (Ctrl+Enter)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* S5 · Deriv Contract Builder */}
          <section className="os-tt-section" aria-labelledby="os-s5-title">
            <div className="os-tt-card">
              <SectionHead
                id="os-s5-title"
                eyebrow="S5 · DERIV CONTRACT BUILDER"
                title="Synthetics & Deriv Contract Proposals"
                sub={
                  hasDerivSelected
                    ? "Deriv account detected in your ticket. Configure contract parameters and inspect the proposal payout."
                    : "No Deriv account is currently selected in S1 — toggle preview mode to inspect Deriv contract parameters."
                }
                right={
                  !hasDerivSelected && (
                    <button
                      type="button"
                      className="os-btn os-btn-ghost os-btn-sm"
                      onClick={() => setShowDerivPreview((v) => !v)}
                    >
                      {showDerivPreview ? "Hide Deriv Builder" : "Preview Deriv Contract Mode"}
                    </button>
                  )
                }
              />

              {(hasDerivSelected || showDerivPreview) && (
                <div className="row g-4">
                  <div className="col-12 col-lg-7">
                    <span className="os-tt-label">Contract Type (8 Modes)</span>
                    <div className="os-deriv-types mb-3" role="tablist" aria-label="Deriv contract type">
                      {DERIV_CONTRACT_TYPES.map((ct) => (
                        <button
                          key={ct.id}
                          type="button"
                          role="tab"
                          aria-selected={derivContract === ct.id}
                          className={`os-deriv-type ${derivContract === ct.id ? "is-active" : ""}`}
                          onClick={() => setDerivContract(ct.id)}
                        >
                          <strong>{ct.label}</strong>
                          <small>{ct.payoutHint}</small>
                        </button>
                      ))}
                    </div>

                    <div className="row g-3">
                      <div className="col-6 col-sm-4">
                        <label htmlFor="drv-stake" className="os-tt-label">
                          Stake (USD)
                        </label>
                        <input
                          id="drv-stake"
                          className="form-control os-mono"
                          value={derivStake}
                          onChange={(e) => setDerivStake(e.target.value)}
                        />
                      </div>
                      <div className="col-6 col-sm-4">
                        <label htmlFor="drv-dur" className="os-tt-label">
                          Duration
                        </label>
                        <input
                          id="drv-dur"
                          className="form-control os-mono"
                          value={derivDuration}
                          onChange={(e) => setDerivDuration(e.target.value)}
                        />
                      </div>
                      <div className="col-12 col-sm-4">
                        <label htmlFor="drv-unit" className="os-tt-label">
                          Unit
                        </label>
                        <select
                          id="drv-unit"
                          className="form-select"
                          value={derivDurationUnit}
                          onChange={(e) =>
                            setDerivDurationUnit(e.target.value as DerivDurationUnit)
                          }
                        >
                          <option value="ticks">Ticks (1–10)</option>
                          <option value="seconds">Seconds</option>
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>

                      {derivContract === "Multiplier" && (
                        <>
                          <div className="col-12 col-sm-6">
                            <label htmlFor="drv-mult" className="os-tt-label">
                              Multiplier Leverage: <span className="os-mono">×{derivMultiplier}</span>
                            </label>
                            <input
                              id="drv-mult"
                              type="range"
                              min={100}
                              max={1000}
                              step={100}
                              className="form-range"
                              value={derivMultiplier}
                              onChange={(e) =>
                                setDerivMultiplier(Number(e.target.value))
                              }
                            />
                          </div>
                          <div className="col-12 col-sm-6 d-flex align-items-end">
                            <label className="os-cancel-toggle w-100">
                              <input
                                type="checkbox"
                                checked={derivCancel}
                                onChange={(e) => setDerivCancel(e.target.checked)}
                              />
                              <span>Deal Cancellation (60m protection)</span>
                            </label>
                          </div>
                        </>
                      )}

                      {derivContract === "Accumulator" && (
                        <div className="col-12">
                          <label htmlFor="drv-growth" className="os-tt-label">
                            Accumulator Growth Rate: <span className="os-mono">{derivGrowth}% / tick</span>
                          </label>
                          <input
                            id="drv-growth"
                            type="range"
                            min={1}
                            max={5}
                            step={1}
                            className="form-range"
                            value={derivGrowth}
                            onChange={(e) => setDerivGrowth(Number(e.target.value))}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proposal Snapshot Card */}
                  <div className="col-12 col-lg-5">
                    <div className="os-proposal-card h-100">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <span className="os-tt-label mb-0">
                          Contract Proposal Snapshot
                        </span>
                        <button
                          type="button"
                          className="os-tt-chip-btn"
                          onClick={() => derivProposalQ.refetch()}
                        >
                          <RefreshCw
                            size={13}
                            className={derivProposalQ.isFetching ? "os-spin" : ""}
                            aria-hidden
                          />{" "}
                          Refresh Quote
                        </button>
                      </div>

                      {derivProposalQ.isError ? (
                        <QueryError onRetry={() => derivProposalQ.refetch()} />
                      ) : derivProposalQ.isPending ? (
                        <Skel h={180} />
                      ) : (
                        <>
                          <div className="os-prop-grid mb-3">
                            <div>
                              <span>Potential Payout</span>
                              <strong className="os-mono os-up">
                                {fmtUsd(derivProposalQ.data.payout)}
                              </strong>
                            </div>
                            <div>
                              <span>Net Profit</span>
                              <strong className="os-mono">
                                +{fmtUsd(derivProposalQ.data.netProfit)} (
                                {derivProposalQ.data.returnPct}%)
                              </strong>
                            </div>
                            <div>
                              <span>Barrier / Mode</span>
                              <strong className="os-mono">
                                {derivProposalQ.data.barrier}
                              </strong>
                            </div>
                            <div>
                              <span>Cancel Fee</span>
                              <strong className="os-mono">
                                {fmtUsd(derivProposalQ.data.commission)}
                              </strong>
                            </div>
                          </div>
                          <div className="os-tt-note is-info">
                            <LockKeyhole size={14} aria-hidden />
                            <span>{derivProposalQ.data.note}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* S6 · Execution Receipts Panel */}
          <section className="os-tt-section" aria-labelledby="os-s6-title">
            <div className="os-tt-card">
              <SectionHead
                id="os-s6-title"
                eyebrow="S6 · EXECUTION RECEIPTS"
                title="Per-Account Fan-Out Receipts"
                sub="Every submission returns one receipt row per account. Paper legs simulate immediately; non-paper legs stop honestly at backend-required."
                right={
                  lastReceipts &&
                  (lastReceipts.readyCount > 0 || lastReceipts.blockedCount > 0) && (
                    <button
                      type="button"
                      className="os-btn os-btn-ghost os-btn-sm"
                      onClick={() => {
                        const failedIds = lastReceipts.receipts
                          .filter((r) => r.status !== "filled")
                          .map((r) => r.accountId);
                        if (failedIds.length > 0) {
                          setSelectedAccIds(failedIds);
                          toast(`Isolated ${failedIds.length} non-filled leg(s) for retry`);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      <RotateCcw size={14} aria-hidden /> Retry Non-Filled Legs
                    </button>
                  )
                }
              />

              {!lastReceipts ? (
                <div className="os-tt-empty">
                  <Send size={22} aria-hidden />
                  <strong>No ticket dispatched yet in this session</strong>
                  <p className="small text-secondary mb-2">
                    Press <strong>Review &amp; Execute</strong> above (or{" "}
                    <kbd>Ctrl</kbd>+<kbd>Enter</kbd>) to submit across{" "}
                    {legs.length} selected account(s).
                  </p>
                  <button
                    type="button"
                    className="os-btn os-btn-primary os-btn-sm"
                    onClick={handleOpenConfirm}
                  >
                    Open Confirmation Modal
                  </button>
                </div>
              ) : (
                <>
                  <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                    <span className="os-mono fw-bold">
                      Batch {lastReceipts.ticketRef} · {lastReceipts.timestampEat}
                    </span>
                    <span className="os-rec-pill is-filled">
                      {lastReceipts.filledCount} Filled (SIM)
                    </span>
                    <span className="os-rec-pill is-ready">
                      {lastReceipts.readyCount} Backend Preview
                    </span>
                    <span className="os-rec-pill is-blocked">
                      {lastReceipts.blockedCount} Blocked
                    </span>
                  </div>
                  <div className="os-receipt-list">
                    {lastReceipts.receipts.map((r) => (
                      <div
                        key={r.accountId}
                        className={`os-receipt-row is-${r.status}`}
                      >
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          {r.status === "filled" ? (
                            <CheckCircle2 size={17} className="os-up" aria-hidden />
                          ) : r.status === "ready" ? (
                            <Info size={17} className="os-warn" aria-hidden />
                          ) : (
                            <XCircle size={17} className="os-down" aria-hidden />
                          )}
                          <BrokerBadge broker={r.broker} label={r.brokerName} />
                          <strong>{r.accountLabel}</strong>
                          <span className="os-mono small text-secondary">
                            {r.brokerSymbol} · {r.size}
                          </span>
                        </div>
                        <div className="os-mono small fw-bold">
                          {r.ticketId} · Fill {r.fillPrice}
                        </div>
                        <div className="small text-secondary w-100">
                          {r.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* S7 · Recent Tickets + Quick-Repeat (TanStack Table) */}
          <section className="os-tt-section" aria-labelledby="os-s7-title">
            <div className="os-tt-card">
              <SectionHead
                id="os-s7-title"
                eyebrow="S7 · RECENT TICKETS & QUICK-REPEAT"
                title="Last Tickets"
                sub="Repeat an order back into S1–S3, Reverse the direction, or queue it into the T-6 Scheduler."
                right={
                  <Link to="/dashboard/records" className="os-tt-link">
                    Full Journal (T-8) <ArrowRight size={14} aria-hidden />
                  </Link>
                }
              />
              {ticketsQ.isError ? (
                <QueryError onRetry={() => ticketsQ.refetch()} />
              ) : ticketsQ.isPending ? (
                <Skel h={300} />
              ) : (
                <RecentTicketsSection
                  tickets={ticketsQ.data}
                  onRepeat={(t) => applyTicketPreset(t, false)}
                  onReverse={(t) => applyTicketPreset(t, true)}
                  onSchedule={(t) => scheduleMut.mutate(t)}
                  scheduling={scheduleMut.isPending}
                />
              )}
            </div>
          </section>

          {/* S8 · Broker Ticket Capability Reference */}
          <section className="os-tt-section" aria-labelledby="os-s8-title">
            <div className="os-tt-card">
              <SectionHead
                id="os-s8-title"
                eyebrow="S8 · ADAPTER CAPABILITY CONTRACT"
                title="How T-3 Adapts Per Broker API"
                sub="Capabilities dictate which order types, TIF flags, and sizing models are enabled per destination."
                right={
                  <Link to="/brokers" className="os-tt-link">
                    Full Matrix <ArrowRight size={14} aria-hidden />
                  </Link>
                }
              />
              {capsQ.isError ? (
                <QueryError onRetry={() => capsQ.refetch()} />
              ) : capsQ.isPending ? (
                <Skel h={180} />
              ) : (
                <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-xl-4">
                  {capsQ.data.map((c) => (
                    <div className="col" key={c.broker}>
                      <div className="os-cap-card h-100">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <BrokerBadge broker={c.broker} label={c.venue} />
                          <span className="os-mono small text-secondary">
                            {c.tifSupport.join("/")}
                          </span>
                        </div>
                        <strong className="d-block small mb-1">{c.orderTypes}</strong>
                        <span className="d-block small text-secondary mb-2">
                          Sizing: {c.sizingModel}
                        </span>
                        <p className="small text-secondary mb-0">{c.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {confirmOpen && activeSym && (
        <ConfirmTicketModal
          sym={activeSym}
          orderType={orderType}
          side={side}
          timeInForce={timeInForce}
          comment={comment}
          legs={legs}
          accountsById={accountsById}
          totalRequiredMargin={totalRequiredMargin}
          needsFatFingerConfirm={needsFatFingerConfirm}
          softWarning={softWarning}
          submitting={fanoutMut.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={(overrideReason) =>
            fanoutMut.mutate({
              canonical: activeSym.canonical,
              orderType,
              side,
              timeInForce,
              comment,
              carry,
              overrideReason,
              legs,
            })
          }
        />
      )}
    </main>
  );
}
