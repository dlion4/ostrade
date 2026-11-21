import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  CircleCheck,
  CalendarDays,
  AlertOctagon,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Percent,
  RefreshCw,
  Scale,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { BrokerBadge, EnvPill } from "@/components/DashboardShell";
import { useToast } from "@/components/Toast";
import { useDashboardContext } from "@/context/DashboardContext";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  getAccounts,
  applyKillSwitch,
} from "@/services/dashboard";
import {
  getConsolidatedPositions,
  getPendingOrders,
  getPositionDetailMeta,
  getMarginExposureData,
  closePosition,
  updatePositionStops,
  partialClosePosition,
  reversePosition,
  bulkClosePositions,
  bulkMoveBreakevenPositions,
  bulkScaleOutPositions,
  cancelPendingOrder,
  modifyPendingOrder,
  executePendingOrderNow,
  addPositionJournalNote,
  type ConsolidatedPosition,
  type PendingOrder,
} from "@/services/positions";
import { PageHero } from "@/components/PageHero";
import css from "@/styles/pages/dash-positions.css?inline";

function fmtUsd(v: number, signed = false): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!signed) return `$${abs}`;
  return v >= 0 ? `+$${abs}` : `−$${abs}`;
}

function fmtPrice(v: number, decimals = 4): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Skel({ h = 20, w = "100%" }: { h?: number; w?: number | string }) {
  return <span className="os-skel" style={{ height: h, width: w }} aria-hidden />;
}

const positionTabs = [
  { id: "positions", label: "Positions", icon: Layers },
  { id: "protections", label: "Protections", icon: ShieldCheck },
  { id: "margin", label: "Margin & Limits", icon: Shield },
] as const;
type PositionTab = (typeof positionTabs)[number]["id"];

function PosTabPanel({ tab, activeTab, children }: { tab: PositionTab; activeTab: PositionTab; children: ReactNode }) {
  return (
    <div className="os-pos-tabpanel" id={`pos-panel-${tab}`} role="tabpanel" aria-labelledby={`pos-tab-${tab}`} hidden={tab !== activeTab}>
      {children}
    </div>
  );
}

export function DashPositionsPage() {
  usePageStyle("dash-positions", css);
  const toast = useToast();
  const qc = useQueryClient();
  const { activeAccountId } = useDashboardContext();

  // Route title
  useEffect(() => {
    const prev = document.title;
    document.title = "Positions & Orders (T-7) · OStrade";
    return () => {
      document.title = prev;
    };
  }, []);

  // Filter state for Positions
  const [posSearch, setPosSearch] = useState("");
  const [posAccountFilter, setPosAccountFilter] = useState("all");
  const [posBrokerFilter, setPosBrokerFilter] = useState("all");
  const [posAssetFilter, setPosAssetFilter] = useState("all");
  const [posSideFilter, setPosSideFilter] = useState("all");
  const [posEnvFilter, setPosEnvFilter] = useState("all");
  const [posSorting, setPosSorting] = useState<SortingState>([]);
  const [selectedPosIds, setSelectedPosIds] = useState<string[]>([]);

  // Filter state for Pending Orders
  const [ordSearch, setOrdSearch] = useState("");
  const [ordAccountFilter, setOrdAccountFilter] = useState("all");
  const [ordStatusFilter, setOrdStatusFilter] = useState("all");

  // Detail Drawer state
  const [drawerPos, setDrawerPos] = useState<ConsolidatedPosition | null>(null);
  const [drawerTab, setDrawerTab] = useState<"overview" | "chart" | "modify" | "attribution" | "journal">("overview");
  const [editSl, setEditSl] = useState("");
  const [editTp, setEditTp] = useState("");
  const [partialVol, setPartialVol] = useState("");
  const [newNote, setNewNote] = useState("");

  // Pending Order Modify Modal
  const [modifyOrd, setModifyOrd] = useState<PendingOrder | null>(null);
  const [newOrdPrice, setNewOrdPrice] = useState("");
  const [newOrdSl, setNewOrdSl] = useState("");
  const [newOrdTp, setNewOrdTp] = useState("");

  // Bulk Action Confirmation Modal
  const [bulkModalAction, setBulkModalAction] = useState<"close" | "breakeven" | "scale50" | null>(null);

  // Panic Flatten Confirmation Modal
  const [panicModalOpen, setPanicModalOpen] = useState(false);

  // Queries
  const [activeTab, setActiveTab] = useState<PositionTab>("positions");
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const positionsQ = useQuery({
    queryKey: [
      "consolidated-positions",
      {
        accountId: posAccountFilter !== "all" ? posAccountFilter : activeAccountId,
        broker: posBrokerFilter,
        assetClass: posAssetFilter,
        side: posSideFilter,
        search: posSearch,
        environment: posEnvFilter,
      },
    ],
    queryFn: () =>
      getConsolidatedPositions({
        accountId: posAccountFilter !== "all" ? posAccountFilter : activeAccountId,
        broker: posBrokerFilter,
        assetClass: posAssetFilter,
        side: posSideFilter,
        search: posSearch,
        environment: posEnvFilter,
      }),
  });

  const pendingQ = useQuery({
    queryKey: [
      "pending-orders",
      { accountId: ordAccountFilter !== "all" ? ordAccountFilter : activeAccountId, status: ordStatusFilter, search: ordSearch },
    ],
    queryFn: () =>
      getPendingOrders({
        accountId: ordAccountFilter !== "all" ? ordAccountFilter : activeAccountId,
        status: ordStatusFilter,
        search: ordSearch,
      }),
  });

  const marginHealthQ = useQuery({
    queryKey: ["margin-exposure-data"],
    queryFn: getMarginExposureData,
  });

  const drawerMetaQ = useQuery({
    queryKey: ["position-detail-meta", drawerPos?.id],
    queryFn: () => (drawerPos ? getPositionDetailMeta(drawerPos.id, drawerPos) : null),
    enabled: !!drawerPos,
  });

  // Invalidation helper
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["consolidated-positions"] });
    qc.invalidateQueries({ queryKey: ["positions"] });
    qc.invalidateQueries({ queryKey: ["records"] });
    qc.invalidateQueries({ queryKey: ["pending-orders"] });
    qc.invalidateQueries({ queryKey: ["margin-exposure-data"] });
    qc.invalidateQueries({ queryKey: ["records"] });
    qc.invalidateQueries({ queryKey: ["accounts"] });
  };

  // Close position mutation
  const closeMut = useMutation({
    mutationFn: (id: string) => closePosition(id),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
      if (drawerPos?.id === res.ref || res.mode === "simulated") {
        setDrawerPos(null);
      }
    },
  });

  // Partial close mutation
  const partialCloseMut = useMutation({
    mutationFn: ({ id, vol }: { id: string; vol: number }) => partialClosePosition(id, vol),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
    },
  });

  // Reverse position mutation
  const reverseMut = useMutation({
    mutationFn: (id: string) => reversePosition(id),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
      setDrawerPos(null);
    },
  });

  // Update stops mutation
  const updateStopsMut = useMutation({
    mutationFn: ({ id, sl, tp }: { id: string; sl: number; tp: number }) =>
      updatePositionStops(id, sl, tp),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
    },
  });

  // Add journal note mutation
  const addNoteMut = useMutation({
    mutationFn: ({ id, note, tags }: { id: string; note: string; tags: string[] }) =>
      addPositionJournalNote(id, note, tags),
    onSuccess: (res) => {
      toast(res.message);
      qc.invalidateQueries({ queryKey: ["position-detail-meta", drawerPos?.id] });
      qc.invalidateQueries({ queryKey: ["trade-journal"] });
      setNewNote("");
    },
  });

  // Cancel pending order mutation
  const cancelOrderMut = useMutation({
    mutationFn: (id: string) => cancelPendingOrder(id),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
    },
  });

  // Modify pending order mutation
  const modifyOrderMut = useMutation({
    mutationFn: ({ id, price, sl, tp }: { id: string; price: number; sl: number; tp: number }) =>
      modifyPendingOrder(id, price, sl, tp),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
      setModifyOrd(null);
    },
  });

  // Execute pending order now mutation (simulated paper fill)
  const execPendingMut = useMutation({
    mutationFn: (id: string) => executePendingOrderNow(id),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
    },
  });

  // Bulk operations
  const bulkCloseMut = useMutation({
    mutationFn: (ids: string[]) => bulkClosePositions(ids),
    onSuccess: (res) => {
      toast(`Closed ${res.closedCount} paper position(s) · ${res.readyCount} broker preview(s)`);
      refreshAll();
      setSelectedPosIds([]);
      setBulkModalAction(null);
    },
  });

  const bulkBeMut = useMutation({
    mutationFn: (ids: string[]) => bulkMoveBreakevenPositions(ids, 2.0),
    onSuccess: (res) => {
      toast(res.message);
      refreshAll();
      setSelectedPosIds([]);
      setBulkModalAction(null);
    },
  });

  const bulkScaleMut = useMutation({
    mutationFn: (ids: string[]) => bulkScaleOutPositions(ids, 50),
    onSuccess: (res) => {
      toast(res.message);
      refreshAll();
      setSelectedPosIds([]);
      setBulkModalAction(null);
    },
  });

  // Emergency panic flatten
  const panicMut = useMutation({
    mutationFn: () => applyKillSwitch("flattened"),
    onSuccess: (res) => {
      toast(res.title);
      refreshAll();
      setPanicModalOpen(false);
    },
  });

  // S1 KPI Computations
  const positionsList = positionsQ.data ?? [];
  const totalOpenCount = positionsList.length;
  const netFloatingPnl = positionsList.reduce((acc, p) => acc + p.pnl, 0);
  const connectedAccounts = (accountsQ.data ?? []).filter((a) => a.connected);
  const todayRealizedPnl = connectedAccounts.reduce((acc, a) => acc + a.realizedToday, 0);
  const marginHealthList = marginHealthQ.data?.accountsHealth ?? [];
  const worstMarginAcc = marginHealthList.reduce((prev, curr) =>
    curr.marginLevelPct < prev.marginLevelPct ? curr : prev,
    marginHealthList[0] || { marginLevelPct: 500, status: "Healthy", accountLabel: "Paper Main" }
  );
  const assetExposures = marginHealthQ.data?.assetExposures ?? [];

  // Drawer handlers
  const openDrawer = (pos: ConsolidatedPosition) => {
    setDrawerPos(pos);
    setEditSl(String(pos.sl));
    setEditTp(String(pos.tp));
    setPartialVol(String(Math.max(0.01, Math.round((pos.size / 2) * 100) / 100)));
    setDrawerTab("overview");
  };

  // Row selection toggle
  const toggleSelectRow = (id: string) => {
    setSelectedPosIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllRows = () => {
    if (selectedPosIds.length === positionsList.length) {
      setSelectedPosIds([]);
    } else {
      setSelectedPosIds(positionsList.map((p) => p.id));
    }
  };

  // TanStack Table columns for Consolidated Positions
  const posColHelper = createColumnHelper<ConsolidatedPosition>();
  const posColumns = useMemo(
    () => [
      posColHelper.display({
        id: "select",
        header: () => (
          <input
            type="checkbox"
            checked={positionsList.length > 0 && selectedPosIds.length === positionsList.length}
            onChange={selectAllRows}
            aria-label="Select all positions"
          />
        ),
        cell: (info) => (
          <input
            type="checkbox"
            checked={selectedPosIds.includes(info.row.original.id)}
            onChange={() => toggleSelectRow(info.row.original.id)}
            aria-label={`Select position ${info.row.original.symbol}`}
          />
        ),
      }),
      posColHelper.accessor("accountLabel", {
        header: "Broker & Account",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <div className="d-flex align-items-center gap-1 flex-wrap">
                <BrokerBadge broker={row.broker} label={row.brokerName} />
                <EnvPill env={row.environment} />
              </div>
              <strong className="d-block mt-1" style={{ fontSize: "0.82rem" }}>
                {row.accountLabel}
              </strong>
            </div>
          );
        },
      }),
      posColHelper.accessor("symbol", {
        header: "Instrument",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <strong className="os-mono" style={{ fontSize: "0.95rem" }}>
                {row.symbol}
              </strong>
              <small className="d-block text-secondary os-mono" style={{ fontSize: "0.72rem" }}>
                {row.brokerSymbol !== row.symbol ? `${row.brokerSymbol} · ` : ""}
                {row.ref}
              </small>
            </div>
          );
        },
      }),
      posColHelper.accessor("side", {
        header: "Side",
        cell: (info) => (
          <span className={`os-side-tag ${info.getValue() === "BUY" ? "is-buy" : "is-sell"}`}>
            {info.getValue()} {info.getValue() === "BUY" ? "▲" : "▼"}
          </span>
        ),
      }),
      posColHelper.accessor("size", {
        header: "Size",
        cell: (info) => (
          <span className="os-mono fw-bold">
            {info.getValue()} {info.row.original.sizeUnit}
          </span>
        ),
      }),
      posColHelper.accessor("entry", {
        header: "Entry",
        cell: (info) => <span className="os-mono">{fmtPrice(info.getValue(), 4)}</span>,
      }),
      posColHelper.accessor("current", {
        header: "Current",
        cell: (info) => <span className="os-mono fw-semibold">{fmtPrice(info.getValue(), 4)}</span>,
      }),
      posColHelper.display({
        id: "stops",
        header: "SL / TP",
        cell: (info) => (
          <div className="os-mono small" style={{ fontSize: "0.75rem" }}>
            <span className="os-down d-block">SL: {info.row.original.sl ? fmtPrice(info.row.original.sl, 2) : "None"}</span>
            <span className="os-up d-block">TP: {info.row.original.tp ? fmtPrice(info.row.original.tp, 2) : "None"}</span>
          </div>
        ),
      }),
      posColHelper.accessor("swap", {
        header: "Swap",
        cell: (info) => (
          <span className={`os-mono small ${info.getValue() < 0 ? "os-down" : "text-secondary"}`}>
            {fmtUsd(info.getValue(), true)}
          </span>
        ),
      }),
      posColHelper.accessor("pnl", {
        header: "Net Floating P&L",
        cell: (info) => {
          const v = info.getValue();
          const pct = info.row.original.pnlPct;
          return (
            <div>
              <strong className={`os-mono d-block ${v >= 0 ? "os-up" : "os-down"}`}>
                {fmtUsd(v, true)}
              </strong>
              <small className={`os-mono ${v >= 0 ? "os-up" : "os-down"}`} style={{ fontSize: "0.72rem" }}>
                {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
              </small>
            </div>
          );
        },
      }),
      posColHelper.accessor("age", {
        header: "Age",
        cell: (info) => <span className="os-mono small text-secondary">{info.getValue()}</span>,
      }),
      posColHelper.accessor("source", {
        header: "Source",
        cell: (info) => <span className="os-source-badge">{info.getValue()}</span>,
      }),
      posColHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="d-flex align-items-center gap-1 flex-wrap">
              <button
                type="button"
                className="os-btn-row-action"
                onClick={() => openDrawer(row)}
                title="Open position drawer"
              >
                Manage →
              </button>
              <button
                type="button"
                className="os-btn-row-action is-close"
                onClick={() => closeMut.mutate(row.id)}
                title="Close position"
              >
                ✕ Close
              </button>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [positionsList, selectedPosIds]
  );

  const posTable = useReactTable({
    data: positionsList,
    columns: posColumns,
    state: { sorting: posSorting },
    onSortingChange: setPosSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Pending Orders TanStack Table
  const pendingOrdersList = pendingQ.data ?? [];
  const ordColHelper = createColumnHelper<PendingOrder>();
  const ordColumns = useMemo(
    () => [
      ordColHelper.accessor("ref", {
        header: "Ref / Placed",
        cell: (info) => (
          <div>
            <span className="os-mono fw-bold d-block" style={{ fontSize: "0.82rem" }}>
              {info.getValue()}
            </span>
            <small className="text-secondary os-mono" style={{ fontSize: "0.72rem" }}>
              {info.row.original.placedAt}
            </small>
          </div>
        ),
      }),
      ordColHelper.accessor("accountLabel", {
        header: "Account",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div>
              <BrokerBadge broker={row.broker} label={row.brokerName} />
              <small className="d-block text-secondary mt-1">{row.accountLabel}</small>
            </div>
          );
        },
      }),
      ordColHelper.accessor("symbol", {
        header: "Symbol",
        cell: (info) => (
          <div>
            <strong className="os-mono">{info.getValue()}</strong>
            <small className="d-block text-secondary os-mono">
              {info.row.original.orderType}
            </small>
          </div>
        ),
      }),
      ordColHelper.accessor("side", {
        header: "Side",
        cell: (info) => (
          <span className={`os-side-tag ${info.getValue() === "BUY" ? "is-buy" : "is-sell"}`}>
            {info.getValue()}
          </span>
        ),
      }),
      ordColHelper.accessor("size", {
        header: "Size",
        cell: (info) => (
          <span className="os-mono">
            {info.getValue()} {info.row.original.sizeUnit}
          </span>
        ),
      }),
      ordColHelper.accessor("triggerPrice", {
        header: "Trigger Price",
        cell: (info) => (
          <span className="os-mono fw-bold">{fmtPrice(info.getValue(), 4)}</span>
        ),
      }),
      ordColHelper.accessor("distancePips", {
        header: "Current & Distance",
        cell: (info) => (
          <div>
            <span className="os-mono small d-block">
              Cur: {fmtPrice(info.row.original.currentPrice, 4)}
            </span>
            <small className="os-mono os-warn">
              {info.getValue().toFixed(1)} pips away
            </small>
          </div>
        ),
      }),
      ordColHelper.display({
        id: "stops",
        header: "SL / TP",
        cell: (info) => (
          <div className="os-mono small" style={{ fontSize: "0.75rem" }}>
            <span className="os-down d-block">SL: {info.row.original.sl || "None"}</span>
            <span className="os-up d-block">TP: {info.row.original.tp || "None"}</span>
          </div>
        ),
      }),
      ordColHelper.accessor("expiry", {
        header: "Expiry & TIF",
        cell: (info) => (
          <div className="small">
            <span className="d-block">{info.getValue()}</span>
            <small className="os-mono text-secondary">TIF: {info.row.original.timeInForce}</small>
          </div>
        ),
      }),
      ordColHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const row = info.row.original;
          return (
            <div className="d-flex align-items-center gap-1 flex-wrap">
              <button
                type="button"
                className="os-btn-row-action"
                onClick={() => {
                  setModifyOrd(row);
                  setNewOrdPrice(String(row.triggerPrice));
                  setNewOrdSl(String(row.sl));
                  setNewOrdTp(String(row.tp));
                }}
              >
                Modify
              </button>
              {row.environment === "paper" && (
                <button
                  type="button"
                  className="os-btn-row-action"
                  onClick={() => execPendingMut.mutate(row.id)}
                  title="Simulate immediate fill"
                >
                  ⚡ Trigger Fill
                </button>
              )}
              <button
                type="button"
                className="os-btn-row-action is-close"
                onClick={() => cancelOrderMut.mutate(row.id)}
                title="Cancel order"
              >
                Cancel
              </button>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const ordTable = useReactTable({
    data: pendingOrdersList,
    columns: ordColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <main className="page-dash-positions">
      {/* Page Header */}
      <PageHero
        icon={Layers}
        art="positions"
        kicker="T-7 · CONSOLIDATED ORDER BOOK"
        titleId="os-pos-title"
        title={<>Positions <span className="os-hero-accent">&amp;</span> Orders</>}
        lead="One multi-broker portfolio book: view live positions, manage brackets, scale out, reverse, cancel pending orders, or trigger panic flatten."
        meta={
          <>
            <span className="os-hero-pill"><ShieldCheck size={13} aria-hidden /> 100% LOCAL SIMULATION ON PAPER</span>
            <span><CalendarDays size={13} aria-hidden /> EAT (UTC+3)</span>
            <span><CircleCheck size={13} aria-hidden /> Static snapshot</span>
          </>
        }
        actions={
          <>
            <button
              type="button"
              className="btn os-hero-btn"
              onClick={refreshAll}
              title="Refresh positions book"
            >
              <RefreshCw size={15} aria-hidden /> Refresh Book
            </button>
            <Link to="/dashboard/trade" className="btn os-hero-btn">
              <Send size={15} aria-hidden /> Trade Ticket (T-3)
            </Link>
            <button
              type="button"
              className="btn os-hero-btn os-hero-danger"
              onClick={() => setPanicModalOpen(true)}
            >
              <AlertOctagon size={15} aria-hidden /> Emergency Flatten
            </button>
          </>
        }
      />

      <div className="os-pos-tabs" role="tablist" aria-label="Positions & Orders sections">
        {positionTabs.map(({ id, label, icon: Icon }, index) => (
          <button
            key={id}
            id={`pos-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`pos-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={(event) => {
              const last = positionTabs.length - 1;
              const nextIndex = event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
                : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
                : event.key === "Home" ? 0 : event.key === "End" ? last : null;
              if (nextIndex === null) return;
              event.preventDefault();
              const next = positionTabs[nextIndex].id;
              setActiveTab(next);
              document.getElementById(`pos-tab-${next}`)?.focus();
            }}
          >
            <Icon size={16} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <PosTabPanel tab="positions" activeTab={activeTab}>
      {/* S1: Portfolio KPI Row (5 Cards) */}
      <section className="os-pos-section" aria-label="Portfolio health KPIs">
        <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-5">
          {/* Card 1: Open Positions */}
          <div className="col">
            <div className="os-pos-kpi">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="os-pos-kpi-label">Open Positions</span>
                <span className="os-pos-kpi-icon">
                  <Layers size={16} aria-hidden />
                </span>
              </div>
              <div className="os-pos-kpi-val os-mono">
                <CountUp value={totalOpenCount} />
              </div>
              <div className="os-pos-kpi-sub">
                Across {connectedAccounts.length} connected accounts
              </div>
            </div>
          </div>

          {/* Card 2: Floating P&L */}
          <div className="col">
            <div className={`os-pos-kpi ${netFloatingPnl >= 0 ? "is-up" : "is-down"}`}>
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="os-pos-kpi-label">Net Floating P&amp;L</span>
                <span className="os-pos-kpi-icon">
                  {netFloatingPnl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </span>
              </div>
              <div className="os-pos-kpi-val os-mono">
                {fmtUsd(netFloatingPnl, true)}
              </div>
              <div className="os-pos-kpi-sub">
                Mark-to-market portfolio snapshot
              </div>
            </div>
          </div>

          {/* Card 3: Today Realized P&L */}
          <div className="col">
            <div className={`os-pos-kpi ${todayRealizedPnl >= 0 ? "is-up" : "is-down"}`}>
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="os-pos-kpi-label">Today's Realized</span>
                <span className="os-pos-kpi-icon">
                  <Wallet size={16} aria-hidden />
                </span>
              </div>
              <div className="os-pos-kpi-val os-mono">
                {fmtUsd(todayRealizedPnl, true)}
              </div>
              <div className="os-pos-kpi-sub">
                Logged to Records &amp; double-entry ledger
              </div>
            </div>
          </div>

          {/* Card 4: Worst Account Margin Level */}
          <div className="col">
            <div className="os-pos-kpi is-warn">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="os-pos-kpi-label">Margin Level (Worst)</span>
                <span className="os-pos-kpi-icon">
                  <ShieldAlert size={16} aria-hidden />
                </span>
              </div>
              <div className="os-pos-kpi-val os-mono">
                {worstMarginAcc.marginLevelPct.toFixed(1)}%
              </div>
              <div className="os-pos-kpi-sub d-flex align-items-center justify-content-between">
                <span>{worstMarginAcc.accountLabel}</span>
                <span className={`os-health-pill is-${worstMarginAcc.status.toLowerCase()}`}>
                  {worstMarginAcc.status}
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: Asset Class Exposure breakdown */}
          <div className="col">
            <div className="os-pos-kpi">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <span className="os-pos-kpi-label">Asset Class Exposure</span>
                <span className="os-pos-kpi-icon">
                  <PieChartIcon size={16} />
                </span>
              </div>
              <div className="os-mini-stacked-bar" aria-label="Asset class exposure distribution">
                {assetExposures.map((ae) => (
                  <span
                    key={ae.assetClass}
                    style={{ width: `${ae.pctOfTotal}%`, background: ae.color }}
                    title={`${ae.assetClass}: ${ae.pctOfTotal}% (${fmtUsd(ae.notionalUsd)})`}
                  />
                ))}
              </div>
              <div className="os-stacked-legend">
                {assetExposures.slice(0, 4).map((ae) => (
                  <span key={ae.assetClass}>
                    <i style={{ background: ae.color }} /> {ae.assetClass} {ae.pctOfTotal}%
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* S5: Bulk Actions Bar (Appears when rows selected) */}
      {selectedPosIds.length > 0 && (
        <section className="os-pos-section">
          <div className="os-bulk-bar">
            <div className="os-bulk-info">
              <CheckCircle2 size={18} aria-hidden />
              <span>{selectedPosIds.length} position(s) selected across accounts</span>
            </div>
            <div className="os-bulk-btn-group">
              <button
                type="button"
                className="os-btn os-btn-primary os-btn-sm"
                onClick={() => setBulkModalAction("close")}
              >
                Close Selected ({selectedPosIds.length})
              </button>
              <button
                type="button"
                className="os-btn os-btn-ghost os-btn-sm"
                onClick={() => setBulkModalAction("breakeven")}
              >
                Move SL to Breakeven (+2p)
              </button>
              <button
                type="button"
                className="os-btn os-btn-ghost os-btn-sm"
                onClick={() => setBulkModalAction("scale50")}
              >
                Scale-Out 50%
              </button>
              <button
                type="button"
                className="os-btn os-btn-text os-btn-sm"
                onClick={() => setSelectedPosIds([])}
              >
                Clear Selection
              </button>
            </div>
          </div>
        </section>
      )}

      {/* S2: Consolidated Positions Table */}
      <section className="os-pos-section" aria-labelledby="os-pos-heading">
        <div className="os-pos-card">
          <div className="os-pos-card-head">
            <div>
              <h2 id="os-pos-heading" className="os-pos-h2">
                <Layers size={18} aria-hidden /> Consolidated Positions ({positionsList.length})
              </h2>
              <p className="os-pos-card-sub">
                Unified book across Paper, Deriv, Exness MT5, and Alpaca. Multi-select for bulk close or stop shifts.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="os-filter-bar">
              <div className="os-search-input">
                <Search size={14} aria-hidden />
                <label htmlFor="pos-filter-search" className="visually-hidden">
                  Search positions
                </label>
                <input
                  id="pos-filter-search"
                  placeholder="Filter symbol, ref, account…"
                  value={posSearch}
                  onChange={(e) => setPosSearch(e.target.value)}
                />
              </div>

              <select
                aria-label="Filter by account"
                className="os-select-sm"
                value={posAccountFilter}
                onChange={(e) => setPosAccountFilter(e.target.value)}
              >
                <option value="all">All Accounts</option>
                {connectedAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by broker"
                className="os-select-sm"
                value={posBrokerFilter}
                onChange={(e) => setPosBrokerFilter(e.target.value)}
              >
                <option value="all">All Brokers</option>
                <option value="paper">OStrade Paper</option>
                <option value="deriv">Deriv</option>
                <option value="exness">Exness MT5</option>
                <option value="alpaca">Alpaca</option>
              </select>

              <select
                aria-label="Filter by asset class"
                className="os-select-sm"
                value={posAssetFilter}
                onChange={(e) => setPosAssetFilter(e.target.value)}
              >
                <option value="all">All Asset Classes</option>
                <option value="Forex">Forex</option>
                <option value="Metals">Metals</option>
                <option value="Indices">Indices</option>
                <option value="Synthetics">Synthetics</option>
                <option value="Crypto">Crypto</option>
                <option value="Stocks">Stocks</option>
              </select>

              <div className="os-tabs-seg" role="group" aria-label="Filter side">
                {(["all", "BUY", "SELL"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={posSideFilter === s ? "is-active" : ""}
                    onClick={() => setPosSideFilter(s)}
                  >
                    {s === "all" ? "ALL" : s}
                  </button>
                ))}
              </div>

              <div className="os-tabs-seg" role="group" aria-label="Filter environment">
                {(["all", "paper", "demo"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={posEnvFilter === e ? "is-active" : ""}
                    onClick={() => setPosEnvFilter(e)}
                  >
                    {e === "all" ? "All Modes" : e === "paper" ? "Paper" : "Demo/Live"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {positionsQ.isPending ? (
            <div className="d-grid gap-2 p-3">
              <Skel h={45} />
              <Skel h={45} />
              <Skel h={45} />
              <Skel h={45} />
            </div>
          ) : positionsList.length === 0 ? (
            <div className="text-center py-5">
              <ShieldCheck size={36} className="text-secondary mb-2" />
              <h5>No open positions match this filter</h5>
              <p className="small text-secondary mb-3">
                Place a simulated trade on Paper in Trade Ticket (T-3) or Signal Desk (T-4).
              </p>
              <Link to="/dashboard/trade" className="os-btn os-btn-primary os-btn-sm">
                Open Trade Ticket
              </Link>
            </div>
          ) : (
            <div className="os-table-wrap">
              <table className="os-data-table">
                <thead>
                  {posTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => {
                        const canSort = header.column.getCanSort();
                        return (
                          <th key={header.id} scope="col">
                            {canSort ? (
                              <button
                                type="button"
                                className="os-th-sort"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                <ArrowUpDown size={11} aria-hidden />
                              </button>
                            ) : (
                              flexRender(header.column.columnDef.header, header.getContext())
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {posTable.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={selectedPosIds.includes(row.original.id) ? "is-selected" : ""}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          data-label={String(cell.column.columnDef.header ?? "")}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="os-pos-card-foot">
            <span className="small text-secondary">
              Showing {positionsList.length} position(s) · {selectedPosIds.length} selected
            </span>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="os-btn os-btn-ghost os-btn-sm"
                onClick={() => bulkMoveBreakevenPositions(positionsList.map((p) => p.id), 2.0).then((res) => { toast(res.message); refreshAll(); })}
              >
                Auto-Breakeven (+2p)
              </button>
              <Link to="/dashboard/records" className="os-pos-link">
                Records Journal (T-8) <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* S3: Pending Orders Table */}
      <section className="os-pos-section" aria-labelledby="os-pending-heading">
        <div className="os-pos-card">
          <div className="os-pos-card-head">
            <div>
              <h2 id="os-pending-heading" className="os-pos-h2">
                <Clock size={18} aria-hidden /> Pending Orders ({pendingOrdersList.length})
              </h2>
              <p className="os-pos-card-sub">
                Limit, Stop, and Stop-Limit orders waiting at the venue. Paper orders can be immediately triggered to simulate a fill.
              </p>
            </div>

            <div className="os-filter-bar">
              <div className="os-search-input">
                <Search size={14} aria-hidden />
                <label htmlFor="ord-filter-search" className="visually-hidden">
                  Search orders
                </label>
                <input
                  id="ord-filter-search"
                  placeholder="Filter order ref, symbol…"
                  value={ordSearch}
                  onChange={(e) => setOrdSearch(e.target.value)}
                />
              </div>

              <select
                aria-label="Filter orders by account"
                className="os-select-sm"
                value={ordAccountFilter}
                onChange={(e) => setOrdAccountFilter(e.target.value)}
              >
                <option value="all">All Accounts</option>
                {connectedAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter orders by status"
                className="os-select-sm"
                value={ordStatusFilter}
                onChange={(e) => setOrdStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
          </div>

          {pendingQ.isPending ? (
            <div className="d-grid gap-2 p-3">
              <Skel h={45} />
              <Skel h={45} />
            </div>
          ) : pendingOrdersList.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-secondary small mb-2">No pending orders in this view</p>
              <Link to="/dashboard/trade" className="os-btn os-btn-ghost os-btn-sm">
                Place Limit / Stop Order in T-3
              </Link>
            </div>
          ) : (
            <div className="os-table-wrap">
              <table className="os-data-table">
                <thead>
                  {ordTable.getHeaderGroups().map((hg) => (
                    <tr key={hg.id}>
                      {hg.headers.map((header) => (
                        <th key={header.id} scope="col">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {ordTable.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          data-label={String(cell.column.columnDef.header ?? "")}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>


      </PosTabPanel>

      <PosTabPanel tab="protections" activeTab={activeTab}>
      {/* S8: Quick Protection Actions & Safety Presets */}
      <section className="os-pos-section" aria-labelledby="os-safety-heading">
        <div className="os-pos-card">
          <div className="os-pos-card-head">
            <div>
              <h2 id="os-safety-heading" className="os-pos-h2">
                <ShieldCheck size={18} aria-hidden /> Quick Position Protections
              </h2>
              <p className="os-pos-card-sub">
                Pre-trade and active position risk rules. Instant execution across eligible paper books.
              </p>
            </div>
          </div>

          <div className="row g-3 row-cols-1 row-cols-md-3">
            <div className="col">
              <div className="p-3 rounded border h-100 d-flex flex-column" style={{ background: "var(--os-bg)" }}>
                <strong>Breakeven Assistant</strong>
                <p className="small text-secondary mb-3 mt-1">
                  Locks in profits by shifting stop-loss to entry price + 2 pips buffer on all positions currently in profit &gt; 25 pips.
                </p>
                <button
                  type="button"
                  className="os-btn os-btn-ghost os-btn-sm mt-auto"
                  onClick={() => bulkMoveBreakevenPositions(positionsList.map((p) => p.id), 2.0).then((res) => { toast(res.message); refreshAll(); })}
                >
                  <Check size={14} aria-hidden /> Apply Breakeven (+2p)
                </button>
              </div>
            </div>

            <div className="col">
              <div className="p-3 rounded border h-100 d-flex flex-column" style={{ background: "var(--os-bg)" }}>
                <strong>50% Scale-Out Harvest</strong>
                <p className="small text-secondary mb-3 mt-1">
                  Partially closes half of each position currently running in profit, freeing margin while allowing runners to continue.
                </p>
                <button
                  type="button"
                  className="os-btn os-btn-ghost os-btn-sm mt-auto"
                  onClick={() => bulkScaleOutPositions(positionsList.map((p) => p.id), 50).then((res) => { toast(res.message); refreshAll(); })}
                >
                  <Percent size={14} aria-hidden /> Scale-Out 50%
                </button>
              </div>
            </div>

            <div className="col">
              <div className="p-3 rounded border h-100 d-flex flex-column" style={{ background: "var(--os-bg)" }}>
                <strong>Emergency Flatten Mode</strong>
                <p className="small text-secondary mb-3 mt-1">
                  Immediate kill-switch action: flattens all simulated paper positions locally and dispatches cancel requests.
                </p>
                <button
                  type="button"
                  className="os-btn os-btn-sm mt-auto"
                  style={{
                    background: "var(--os-down-soft)",
                    color: "var(--os-down)",
                    border: "1px solid var(--os-down)",
                  }}
                  onClick={() => setPanicModalOpen(true)}
                >
                  <AlertOctagon size={14} aria-hidden /> Review Emergency Flatten
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      </PosTabPanel>

      <PosTabPanel tab="margin" activeTab={activeTab}>
      {/* S7: Margin & Exposure Monitor */}
      <section className="os-pos-section" aria-labelledby="os-margin-heading">
        <div className="row g-4">
          <div className="col-12 col-xl-7">
            <div className="os-pos-card h-100">
              <div className="os-pos-card-head">
                <div>
                  <h2 id="os-margin-heading" className="os-pos-h2">
                    <Shield size={18} aria-hidden /> Account Margin Health &amp; Limits
                  </h2>
                  <p className="os-pos-card-sub">
                    Margin call and stop-out threshold markers. Warnings feed into T-14 Risk &amp; Guardrails.
                  </p>
                </div>
              </div>

              <div className="d-grid gap-3">
                {marginHealthList.map((mh) => (
                  <div
                    key={mh.accountId}
                    className="p-3 rounded border"
                    style={{ background: "var(--os-bg)" }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <div className="d-flex align-items-center gap-2">
                        <BrokerBadge broker={mh.broker} label={mh.brokerName} />
                        <strong>{mh.accountLabel}</strong>
                        <EnvPill env={mh.environment} />
                      </div>
                      <span className={`os-health-pill is-${mh.status.toLowerCase()}`}>
                        {mh.status}
                      </span>
                    </div>

                    <div className="d-flex justify-content-between small text-secondary os-mono mt-1 mb-1">
                      <span>Equity: {fmtUsd(mh.equity)} · Balance: {fmtUsd(mh.balance)}</span>
                      <span>Level: <b className="text-body">{mh.marginLevelPct.toFixed(1)}%</b></span>
                    </div>

                    <div className="os-margin-bar">
                      <span
                        style={{
                          width: `${Math.min(100, (mh.marginLevelPct / 600) * 100)}%`,
                          background:
                            mh.status === "Critical"
                              ? "var(--os-down)"
                              : mh.status === "Warning"
                              ? "var(--os-warn)"
                              : "var(--os-up)",
                        }}
                      />
                    </div>

                    <div className="d-flex justify-content-between small text-secondary">
                      <span>Free: {fmtUsd(mh.freeMargin)} · Used: {fmtUsd(mh.usedMargin)}</span>
                      <span>Call: {mh.marginCallThresholdPct}% · Stopout: {mh.stopOutLevelPct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-5">
            <details className="os-pos-muted-block">
              <summary>
                <Scale size={16} aria-hidden /> Concentration Exposure by Instrument
                <span className="os-pos-muted-tag">Muted</span>
              </summary>
              <p className="os-pos-muted-sub">Top position exposures as a percentage of aggregate equity.</p>

              <div className="os-table-wrap">
                <table className="os-data-table os-matrix">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Account</th>
                      <th>Notional</th>
                      <th>% Equity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginHealthList.map((mh) => (
                      <tr key={mh.accountId}>
                        <td>
                          <strong className="os-mono">{mh.topExposureSymbol}</strong>
                        </td>
                        <td>{mh.accountLabel}</td>
                        <td className="os-mono">{fmtUsd(mh.topExposureNotional)}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="os-mono fw-bold">{mh.topExposurePct.toFixed(1)}%</span>
                            <div
                              style={{
                                width: 45,
                                height: 5,
                                borderRadius: 4,
                                background: "var(--os-surface-3)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${Math.min(100, mh.topExposurePct * 1.5)}%`,
                                  height: "100%",
                                  background:
                                    mh.topExposurePct > 50
                                      ? "var(--os-down)"
                                      : mh.topExposurePct > 30
                                      ? "var(--os-warn)"
                                      : "var(--os-brand)",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </div>
      </section>

      </PosTabPanel>

      {/* S4: Position Detail Drawer */}
      {drawerPos && (
        <div
          className="os-pos-drawer-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDrawerPos(null);
          }}
        >
          <aside
            className="os-pos-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="os-drawer-pos-title"
          >
            <div className="os-pos-drawer-head">
              <div className="d-flex align-items-center gap-2">
                <span className="os-pos-static-pill os-mono">{drawerPos.ref}</span>
                <span className={`os-side-tag ${drawerPos.side === "BUY" ? "is-buy" : "is-sell"}`}>
                  {drawerPos.side}
                </span>
              </div>
              <button
                type="button"
                className="os-icon-btn"
                onClick={() => setDrawerPos(null)}
                aria-label="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="os-pos-drawer-body">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <BrokerBadge broker={drawerPos.broker} label={drawerPos.brokerName} />
                  <EnvPill env={drawerPos.environment} />
                </div>
                <h2 id="os-drawer-pos-title" className="h4 os-mono mb-1">
                  {drawerPos.symbol}{" "}
                  <small className="text-secondary fw-normal">({drawerPos.brokerSymbol})</small>
                </h2>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="text-secondary small">{drawerPos.accountLabel} · {drawerPos.age}</span>
                  <strong className={`os-mono h5 mb-0 ${drawerPos.pnl >= 0 ? "os-up" : "os-down"}`}>
                    {fmtUsd(drawerPos.pnl, true)} ({drawerPos.pnlPct.toFixed(2)}%)
                  </strong>
                </div>
              </div>

              {/* Drawer Tabs */}
              <div className="os-tabs-seg" role="tablist" aria-label="Drawer tabs">
                {(
                  [
                    ["overview", "Overview"],
                    ["chart", "Chart"],
                    ["modify", "Modify & Scale"],
                    ["attribution", "Attribution"],
                    ["journal", "Journal"],
                  ] as const
                ).map(([t, lbl]) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === t}
                    className={drawerTab === t ? "is-active" : ""}
                    onClick={() => setDrawerTab(t)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {/* Tab 1: Overview */}
              {drawerTab === "overview" && (
                <div className="d-grid gap-3">
                  <div className="p-3 rounded border" style={{ background: "var(--os-bg)" }}>
                    <div className="row g-2 small os-mono">
                      <div className="col-6">
                        <span className="text-secondary d-block">Size</span>
                        <strong>{drawerPos.size} {drawerPos.sizeUnit}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-secondary d-block">Entry Price</span>
                        <strong>{fmtPrice(drawerPos.entry, 4)}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-secondary d-block">Current Mark</span>
                        <strong>{fmtPrice(drawerPos.current, 4)}</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-secondary d-block">Est. Swap</span>
                        <span>{fmtUsd(drawerPos.swap, true)}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h6 className="small text-uppercase fw-bold text-secondary mb-2">
                      Order Lifecycle &amp; Broker Audit
                    </h6>
                    <div className="os-lifecycle-timeline">
                      {(drawerMetaQ.data?.lifecycle ?? []).map((step, idx) => (
                        <div key={idx} className="os-lifecycle-node">
                          <div className="d-flex justify-content-between small">
                            <strong>{step.step}</strong>
                            <span className="text-secondary os-mono">{step.timeEat}</span>
                          </div>
                          <p className="small text-secondary mb-0 mt-1">{step.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-light border small text-secondary os-mono">
                    <div>Idempotency Token: {drawerMetaQ.data?.idempotencyKey}</div>
                    <div>Broker Ticket: {drawerMetaQ.data?.brokerTicketId}</div>
                    <div>Submission Latency: {drawerMetaQ.data?.latencyMs}ms</div>
                  </div>
                </div>
              )}

              {/* Tab 2: Chart Preview */}
              {drawerTab === "chart" && (
                <div className="d-grid gap-3">
                  <div className="p-3 rounded border text-center" style={{ background: "var(--os-bg)" }}>
                    <h6 className="os-mono mb-2">{drawerPos.symbol} Price Line Preview</h6>
                    <div className="py-4 my-2 border rounded bg-white position-relative">
                      <div className="small text-secondary mb-2">Entry @ {fmtPrice(drawerPos.entry, 2)}</div>
                      <div className="text-primary fw-bold os-mono h4 mb-2">
                        {fmtPrice(drawerPos.current, 2)}
                      </div>
                      <div className="small os-down">SL: {drawerPos.sl || "None"}</div>
                      <div className="small os-up">TP: {drawerPos.tp || "None"}</div>
                    </div>
                    <small className="text-secondary">
                      Full candlestick chart available in <Link to="/dashboard/markets">T-2 Markets</Link>
                    </small>
                  </div>
                </div>
              )}

              {/* Tab 3: Modify & Scale */}
              {drawerTab === "modify" && (
                <div className="d-grid gap-3">
                  {drawerPos.broker === "deriv" ? (
                    <div className="p-3 rounded border text-warning bg-warning-subtle small">
                      <AlertTriangle size={16} className="me-1" aria-hidden />
                      Deriv contracts do not permit MT-style in-place SL/TP patching. To adjust risk,
                      sell the current contract and re-open at your desired barrier.
                    </div>
                  ) : (
                    <div className="p-3 rounded border" style={{ background: "var(--os-bg)" }}>
                      <h6 className="small fw-bold text-uppercase text-secondary mb-2">
                        Modify SL / TP Stops
                      </h6>
                      <div className="row g-2 mb-3">
                        <div className="col-6">
                          <label htmlFor="drawer-sl-input" className="small fw-semibold d-block mb-1">
                            Stop Loss
                          </label>
                          <input
                            id="drawer-sl-input"
                            className="form-control form-control-sm os-mono"
                            value={editSl}
                            onChange={(e) => setEditSl(e.target.value)}
                          />
                        </div>
                        <div className="col-6">
                          <label htmlFor="drawer-tp-input" className="small fw-semibold d-block mb-1">
                            Take Profit
                          </label>
                          <input
                            id="drawer-tp-input"
                            className="form-control form-control-sm os-mono"
                            value={editTp}
                            onChange={(e) => setEditTp(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="os-btn os-btn-primary os-btn-sm w-100"
                        onClick={() =>
                          updateStopsMut.mutate({
                            id: drawerPos.id,
                            sl: parseFloat(editSl) || 0,
                            tp: parseFloat(editTp) || 0,
                          })
                        }
                      >
                        Save SL / TP Brackets
                      </button>
                    </div>
                  )}

                  {/* Partial Close Volume */}
                  <div className="p-3 rounded border" style={{ background: "var(--os-bg)" }}>
                    <h6 className="small fw-bold text-uppercase text-secondary mb-2">
                      Partial Close Volume
                    </h6>
                    <div className="mb-2">
                      <label htmlFor="drawer-partial-input" className="small fw-semibold d-block mb-1">
                        Volume to Close ({drawerPos.sizeUnit}) · Max {drawerPos.size}
                      </label>
                      <input
                        id="drawer-partial-input"
                        className="form-control form-control-sm os-mono"
                        value={partialVol}
                        onChange={(e) => setPartialVol(e.target.value)}
                      />
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="os-btn os-btn-ghost os-btn-sm flex-grow-1"
                        onClick={() => setPartialVol(String(Math.round((drawerPos.size / 2) * 100) / 100))}
                      >
                        50% ({Math.round((drawerPos.size / 2) * 100) / 100})
                      </button>
                      <button
                        type="button"
                        className="os-btn os-btn-primary os-btn-sm flex-grow-1"
                        onClick={() => {
                          const v = parseFloat(partialVol);
                          if (!v || v <= 0) return toast("Enter valid volume");
                          partialCloseMut.mutate({ id: drawerPos.id, vol: v });
                        }}
                      >
                        Execute Partial Close
                      </button>
                    </div>
                  </div>

                  {/* Reverse Position */}
                  <div className="p-3 rounded border" style={{ background: "var(--os-bg)" }}>
                    <h6 className="small fw-bold text-uppercase text-secondary mb-1">
                      Reverse Position
                    </h6>
                    <p className="small text-secondary mb-2">
                      Immediately closes current {drawerPos.side} position and opens opposite{" "}
                      {drawerPos.side === "BUY" ? "SELL" : "BUY"} of {drawerPos.size} {drawerPos.sizeUnit} at {drawerPos.current}.
                    </p>
                    <button
                      type="button"
                      className="os-btn os-btn-ghost os-btn-sm w-100"
                      onClick={() => reverseMut.mutate(drawerPos.id)}
                    >
                      <ArrowLeftRight size={14} className="me-1" aria-hidden /> Reverse to{" "}
                      {drawerPos.side === "BUY" ? "SELL" : "BUY"}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 4: Attribution */}
              {drawerTab === "attribution" && (
                <div className="d-grid gap-3">
                  <div className="p-3 rounded border" style={{ background: "var(--os-bg)" }}>
                    <h6 className="small fw-bold text-uppercase text-secondary mb-2">
                      Origin &amp; Attribution
                    </h6>
                    <div className="small">
                      <div className="mb-2">
                        <span className="text-secondary d-block">Source Provider:</span>
                        <strong>{drawerMetaQ.data?.attribution.originDetail}</strong>
                      </div>
                      <div className="mb-2">
                        <span className="text-secondary d-block">Signal Reference:</span>
                        <code className="os-mono">{drawerMetaQ.data?.attribution.ref}</code>
                      </div>
                    </div>
                    {drawerMetaQ.data?.attribution.linkUrl && (
                      <Link
                        to={drawerMetaQ.data.attribution.linkUrl as any}
                        className="os-pos-link mt-2"
                      >
                        Open Ingestion Source <ExternalLink size={13} aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Journal */}
              {drawerTab === "journal" && (
                <div className="d-grid gap-3">
                  <div className="p-3 rounded border" style={{ background: "var(--os-bg)" }}>
                    <h6 className="small fw-bold text-uppercase text-secondary mb-2">
                      Trader Journal Notes
                    </h6>
                    <div className="d-grid gap-2 mb-3">
                      {(drawerMetaQ.data?.notes ?? []).length === 0 ? (
                        <p className="small text-secondary mb-0">No notes attached yet.</p>
                      ) : (
                        (drawerMetaQ.data?.notes ?? []).map((n, i) => (
                          <div key={i} className="p-2 rounded bg-light small">
                            {n}
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mb-2">
                      <label htmlFor="drawer-note-input" className="small fw-semibold d-block mb-1">
                        Add Note
                      </label>
                      <textarea
                        id="drawer-note-input"
                        className="form-control form-control-sm mb-2"
                        rows={2}
                        placeholder="e.g. Taking runner off 2380 support into London close"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                      />
                      <button
                        type="button"
                        className="os-btn os-btn-primary os-btn-sm"
                        disabled={!newNote.trim()}
                        onClick={() =>
                          addNoteMut.mutate({
                            id: drawerPos.id,
                            note: newNote,
                            tags: drawerMetaQ.data?.tags ?? [],
                          })
                        }
                      >
                        Append to Journal (T-8)
                      </button>
                    </div>

                    <div className="mt-3 pt-2 border-top">
                      <span className="small text-secondary d-block mb-1">Tags</span>
                      <div className="d-flex flex-wrap gap-1">
                        {(drawerMetaQ.data?.tags ?? []).map((t) => (
                          <span key={t} className="badge bg-secondary">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Quick Close */}
              <div className="mt-auto pt-3 border-top d-flex gap-2">
                <button
                  type="button"
                  className="os-btn os-btn-ghost flex-grow-1"
                  onClick={() => setDrawerPos(null)}
                >
                  Done
                </button>
                <button
                  type="button"
                  className="os-btn os-btn-primary flex-grow-1"
                  style={{
                    background: "var(--os-down)",
                    borderColor: "var(--os-down)",
                    color: "#fff",
                  }}
                  onClick={() => closeMut.mutate(drawerPos.id)}
                >
                  Close Position ({fmtUsd(drawerPos.pnl, true)})
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* S5: Bulk Actions Confirmation Modal */}
      {bulkModalAction && (
        <div
          className="os-pos-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setBulkModalAction(null);
          }}
        >
          <div className="os-pos-modal" role="dialog" aria-modal="true">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h3 className="h5 mb-0">Confirm Bulk Operation</h3>
              <button
                type="button"
                className="os-icon-btn"
                onClick={() => setBulkModalAction(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="small text-secondary mb-3">
              {bulkModalAction === "close" &&
                `You are about to close ${selectedPosIds.length} position(s). Paper positions will close locally; live/demo broker positions will resolve to ready states.`}
              {bulkModalAction === "breakeven" &&
                `You are about to move Stop Loss to breakeven (+2 pips buffer) across ${selectedPosIds.length} position(s).`}
              {bulkModalAction === "scale50" &&
                `You are about to partially close 50% volume across ${selectedPosIds.length} position(s).`}
            </p>

            <div className="p-2 border rounded mb-3 bg-light small os-mono" style={{ maxHeight: 150, overflowY: "auto" }}>
              {selectedPosIds.map((id) => {
                const p = positionsList.find((x) => x.id === id);
                return p ? (
                  <div key={id} className="d-flex justify-content-between py-1 border-bottom">
                    <span>{p.symbol} {p.side} {p.size} {p.sizeUnit} ({p.accountLabel})</span>
                    <strong className={p.pnl >= 0 ? "os-up" : "os-down"}>{fmtUsd(p.pnl, true)}</strong>
                  </div>
                ) : null;
              })}
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="os-btn os-btn-ghost os-btn-sm"
                onClick={() => setBulkModalAction(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="os-btn os-btn-primary os-btn-sm"
                onClick={() => {
                  if (bulkModalAction === "close") bulkCloseMut.mutate(selectedPosIds);
                  if (bulkModalAction === "breakeven") bulkBeMut.mutate(selectedPosIds);
                  if (bulkModalAction === "scale50") bulkScaleMut.mutate(selectedPosIds);
                }}
              >
                Confirm Bulk Action
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modify Pending Order Modal */}
      {modifyOrd && (
        <div
          className="os-pos-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModifyOrd(null);
          }}
        >
          <div className="os-pos-modal" role="dialog" aria-modal="true">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h3 className="h5 mb-0">Modify Pending Order · {modifyOrd.ref}</h3>
              <button
                type="button"
                className="os-icon-btn"
                onClick={() => setModifyOrd(null)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="small text-secondary mb-3">
              {modifyOrd.orderType} {modifyOrd.side} {modifyOrd.size} {modifyOrd.sizeUnit} {modifyOrd.symbol} on {modifyOrd.accountLabel}
            </p>

            <div className="d-grid gap-2 mb-3">
              <div>
                <label htmlFor="mod-price" className="small fw-semibold d-block mb-1">
                  Trigger Price
                </label>
                <input
                  id="mod-price"
                  className="form-control form-control-sm os-mono"
                  value={newOrdPrice}
                  onChange={(e) => setNewOrdPrice(e.target.value)}
                />
              </div>
              <div className="row g-2">
                <div className="col-6">
                  <label htmlFor="mod-sl" className="small fw-semibold d-block mb-1">
                    Stop Loss
                  </label>
                  <input
                    id="mod-sl"
                    className="form-control form-control-sm os-mono"
                    value={newOrdSl}
                    onChange={(e) => setNewOrdSl(e.target.value)}
                  />
                </div>
                <div className="col-6">
                  <label htmlFor="mod-tp" className="small fw-semibold d-block mb-1">
                    Take Profit
                  </label>
                  <input
                    id="mod-tp"
                    className="form-control form-control-sm os-mono"
                    value={newOrdTp}
                    onChange={(e) => setNewOrdTp(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="os-btn os-btn-ghost os-btn-sm"
                onClick={() => setModifyOrd(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="os-btn os-btn-primary os-btn-sm"
                onClick={() => {
                  modifyOrderMut.mutate({
                    id: modifyOrd.id,
                    price: parseFloat(newOrdPrice) || modifyOrd.triggerPrice,
                    sl: parseFloat(newOrdSl) || 0,
                    tp: parseFloat(newOrdTp) || 0,
                  });
                }}
              >
                Save Order Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panic Flatten Modal */}
      {panicModalOpen && (
        <div
          className="os-pos-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPanicModalOpen(false);
          }}
        >
          <div className="os-pos-modal" role="dialog" aria-modal="true">
            <div className="d-flex align-items-center gap-2 text-danger mb-3">
              <AlertOctagon size={24} aria-hidden />
              <h3 className="h5 mb-0">Confirm Emergency Flatten</h3>
            </div>

            <p className="small text-secondary mb-3">
              This will trigger the global kill-switch <strong>FLATTEN</strong> action:
              all simulated paper positions will be closed immediately, pending orders cancelled, and automation disarmed.
              Broker demo/live accounts will stage safe preview receipts.
            </p>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="os-btn os-btn-ghost os-btn-sm"
                onClick={() => setPanicModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="os-btn os-btn-sm"
                style={{ background: "var(--os-down)", color: "#fff" }}
                disabled={panicMut.isPending}
                onClick={() => panicMut.mutate()}
              >
                {panicMut.isPending ? "Flattening…" : "Execute Flatten"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PieChartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}
