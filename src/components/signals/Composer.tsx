import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Code2,
  CornerDownLeft,
  FileCode2,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Save,
  ScanLine,
  Shuffle,
  SquareTerminal,
  TriangleAlert,
  X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import type { MarketSymbol } from "@/services/markets";
import {
  getDeskSetup,
  parseSignal,
  saveSignal,
  type DeskSignal,
  type SignalOrder,
  type SourceKey,
} from "@/services/signalDesk";
import { Dialog, InstrumentMark, sourceNames, SourceMark } from "./DeskUI";

type Setup = Awaited<ReturnType<typeof getDeskSetup>>;
export interface ComposerLoad {
  key: number;
  raw: string;
  source: SourceKey;
  feed: string;
  order?: SignalOrder;
  id?: string;
}
function ColorText({ line }: { line: string }) {
  if (line.trim().startsWith("#"))
    return <span className="os-code-comment">{line}</span>;
  return (
    <>
      {line
        .split(
          /(\b(?:BUY|LONG|RISE|CALL|SELL|SHORT|FALL|PUT|SL|TP\d?|SIZE|LOTS?|STAKE|ENTRY)\b|\b\d+(?:\.\d+)?\b|@)/gi,
        )
        .map((s, i) => (
          <span
            key={i}
            className={
              /^(BUY|LONG|RISE|CALL|TP\d?)$/i.test(s)
                ? "os-code-buy"
                : /^(SELL|SHORT|FALL|PUT|SL)$/i.test(s)
                  ? "os-code-sell"
                  : /^\d/.test(s)
                    ? "os-code-num"
                    : /^(SIZE|LOTS?|STAKE|ENTRY)$/i.test(s)
                      ? "os-code-size"
                      : s === "@"
                        ? "os-code-comment"
                        : ""
            }
          >
            {s}
          </span>
        ))}
    </>
  );
}
function AssetSpark({ values }: { values: number[] }) {
  const lo = Math.min(...values),
    hi = Math.max(...values),
    coords = values.map(
      (v, i) =>
        `${2 + (i / (values.length - 1)) * 105},${34 - ((v - lo) / (hi - lo || 1)) * 26}`,
    );
  return (
    <svg
      className="os-asset-spark"
      viewBox="0 0 110 42"
      width="100"
      height="40"
      role="img"
      aria-label="Static daily trend"
    >
      <path
        d={`M${coords.join(" L")} L107,41 L2,41Z`}
        fill="currentColor"
        opacity="0.055"
      />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function EditOrder({
  order,
  markets,
  onSave,
  onClose,
}: {
  order: SignalOrder;
  markets: MarketSymbol[];
  onSave: (o: SignalOrder) => void;
  onClose: () => void;
}) {
  const [f, set] = useState({
    symbol: order.symbol,
    side: order.side || "BUY",
    kind: order.kind,
    entry: String(order.entry || ""),
    sl: String(order.sl || ""),
    targets: order.targets.join(", "),
    size: String(order.size || ""),
    duration: order.duration,
  });
  const [error, setError] = useState("");
  return (
    <Dialog
      title="Edit parsed order"
      overline="MANUAL OVERRIDE"
      description="Your changes take priority over the original signal."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const targets = f.targets
            .split(/[,;\s]+/)
            .filter(Boolean)
            .map(Number);
          if (
            !f.symbol ||
            !f.entry ||
            Number(f.entry) <= 0 ||
            Number(f.size) <= 0 ||
            !Number.isFinite(Number(f.entry)) ||
            !Number.isFinite(Number(f.size)) ||
            !Number.isFinite(Number(f.sl)) ||
            targets.some((t) => !Number.isFinite(t) || t <= 0) ||
            targets.length > 3
          ) {
            setError(
              "Choose an instrument and valid positive prices and size. Use up to three targets.",
            );
            return;
          }
          onSave({
            ...order,
            symbol: f.symbol,
            side: f.side as "BUY" | "SELL",
            kind: f.kind,
            entry: +f.entry,
            sl: +f.sl,
            targets,
            size: +f.size,
            duration: f.duration,
            warnings: [],
          });
          onClose();
        }}
      >
        <div className="os-dialog-body os-form-grid">
          <label className="os-field">
            Instrument
            <select
              value={f.symbol}
              required
              onChange={(e) => set({ ...f, symbol: e.target.value })}
            >
              <option value="">Choose instrument</option>
              {markets.map((s) => (
                <option key={s.canonical}>{s.canonical}</option>
              ))}
            </select>
          </label>
          <label className="os-field">
            Direction
            <select
              value={f.side}
              onChange={(e) =>
                set({ ...f, side: e.target.value as "BUY" | "SELL" })
              }
            >
              <option>BUY</option>
              <option>SELL</option>
            </select>
          </label>
          <label className="os-field">
            Order type
            <select
              value={f.kind}
              onChange={(e) =>
                set({ ...f, kind: e.target.value as SignalOrder["kind"] })
              }
            >
              {["Market", "Limit", "Stop", "Contract"].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="os-field">
            Position size
            <input
              type="number"
              step="any"
              min="0.001"
              required
              value={f.size}
              onChange={(e) => set({ ...f, size: e.target.value })}
            />
          </label>
          <label className="os-field">
            Entry price
            <input
              type="number"
              step="any"
              min="0.00001"
              required
              value={f.entry}
              onChange={(e) => set({ ...f, entry: e.target.value })}
            />
          </label>
          <label className="os-field">
            Stop loss
            <input
              type="number"
              step="any"
              min="0"
              value={f.sl}
              onChange={(e) => set({ ...f, sl: e.target.value })}
            />
          </label>
          <label className="os-field os-full-width">
            Take-profit targets
            <input
              value={f.targets}
              placeholder="2402.00, 2410.00"
              onChange={(e) => set({ ...f, targets: e.target.value })}
            />
            <small>Separate up to three scale-out targets with commas.</small>
          </label>
          {f.kind === "Contract" && (
            <label className="os-field">
              Contract duration
              <input
                value={f.duration}
                onChange={(e) => set({ ...f, duration: e.target.value })}
              />
            </label>
          )}
          {error && <p className="os-form-error">{error}</p>}
        </div>
        <footer className="os-dialog-foot">
          <button type="button" className="os-soft-button" onClick={onClose}>
            Cancel
          </button>
          <button className="os-action-primary" type="submit">
            <Check size={14} /> Save changes
          </button>
        </footer>
      </form>
    </Dialog>
  );
}

export function Composer({
  setup,
  markets,
  load,
  onReview,
  refresh,
  onStage,
  rows,
}: {
  rows: DeskSignal[];
  setup: Setup;
  markets: MarketSymbol[];
  load: ComposerLoad | null;
  onReview: (s: DeskSignal[]) => void;
  refresh: () => void;
  onStage: (id: string) => void;
}) {
  const toast = useToast();
  const [raw, setRaw] = useState(load?.raw ?? setup.first),
    [source, setSource] = useState<SourceKey | "auto">(load?.source ?? "auto"),
    [feed, setFeed] = useState(load?.feed ?? setup.examples[0].feed),
    [rowId, setRowId] = useState(load?.id),
    [edited, setEdited] = useState<SignalOrder | null>(load?.order ?? null),
    [samples, setSamples] = useState(false),
    [edit, setEdit] = useState(false),
    [editText, setEditText] = useState(raw);
  const textRef = useRef<HTMLTextAreaElement>(null),
    highlight = useRef<HTMLPreElement>(null),
    numbers = useRef<HTMLDivElement>(null),
    sampleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setEditText(raw), 170);
    return () => clearTimeout(t);
  }, [raw]);
  useEffect(() => {
    if (!samples) return;
    const close = (e: MouseEvent) => {
      if (!sampleRef.current?.contains(e.target as Node)) setSamples(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSamples(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [samples]);
  const parsed = useQuery({
    queryKey: ["signal-parse", editText, source],
    queryFn: () => parseSignal(editText, source),
    initialData:
      editText === setup.first && (source === "telegram" || source === "auto")
        ? setup.parsed
        : undefined,
    staleTime: Infinity,
    enabled: !!editText.trim(),
  });
  const order = edited ?? parsed.data;
  const symbol = markets.find((s) => s.canonical === order?.symbol);
  const save = useMutation({
    mutationFn: ({
      o,
      stage,
    }: {
      o: SignalOrder;
      stage: boolean;
      review: boolean;
    }) =>
      saveSignal(
        { id: rowId, raw, order: o, feed: feed || sourceNames[o.source] },
        stage ? "Staged" : "Parsed",
      ),
    onSuccess: (row, { stage, review }) => {
      setRowId(row.id);
      refresh();
      if (row.status === "Quarantined") {
        toast(`${row.id} held for review. See Guard activity for the reason.`);
        return;
      }
      if (stage) onStage(row.id);
      if (review) onReview([row]);
      else
        toast(
          stage
            ? `${row.id} staged for later`
            : `${row.id} parsed and added to your inbox`,
        );
    },
    onError: (e) => toast(e.message),
  });
  const busy = save.isPending || raw !== editText || parsed.isFetching;
  const submit = (stage = false, review = false) => {
    if (!raw.trim()) {
      textRef.current?.focus();
      toast("Paste a signal first.");
      return;
    }
    if (order && !busy) save.mutate({ o: order, stage, review });
  };
  const change = (value: string) => {
    setRaw(value.slice(0, 8000));
    setFeed(value.match(/^#\s*(.+)/)?.[1] || "");
    setRowId(undefined);
    setEdited(null);
  };
  const lines = useMemo(() => raw.split("\n"), [raw]);
  const saved = rows.find((r) => r.id === rowId);
  const finished =
    saved && ["Filled", "Pending", "Preview"].includes(saved.status);
  const valid = !!order?.symbol && !!order.side;
  const num = (n?: number) =>
    n
      ? n.toLocaleString("en-US", {
          minimumFractionDigits: symbol?.digits === 5 ? 4 : 2,
          maximumFractionDigits: symbol?.digits ?? 2,
        })
      : "Not set";
  const rr =
    order && order.sl && order.targets[0] && order.entry !== order.sl
      ? (
          Math.abs(order.targets[0] - order.entry) /
          Math.abs(order.entry - order.sl)
        ).toFixed(2)
      : null;
  const appliedSource = source === "auto" ? (order?.source ?? "paste") : source;
  return (
    <div className="os-build-pair">
      <section
        className="os-desk-panel os-composer"
        aria-labelledby="os-composer-heading"
      >
        <div className="os-composer-head">
          <div className="os-title-main">
            <span className="os-feature-icon os-icon-orange">
              <SquareTerminal size={18} />
            </span>
            <h2 id="os-composer-heading">Signal composer</h2>
          </div>
          <span className="os-step-label">01 / INPUT</span>
        </div>
        <div className="os-composer-copy">
          Paste a signal from any source to get started.
        </div>
        <div
          className="os-editor"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) {
              if (file.size > 32000 || !/\.(txt|json)$/i.test(file.name)) {
                toast("Drop a .txt or .json file under 32 KB.");
                return;
              }
              change(await file.text());
              setSource("auto");
            } else {
              const text = e.dataTransfer.getData("text/plain");
              if (text) change(text);
            }
          }}
        >
          <div className="os-editor-bar">
            <span className="os-terminal-lights" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span>signal.input</span>
            <Code2 size={13} />
          </div>
          <div className="os-editor-input">
            <div ref={numbers} className="os-line-numbers" aria-hidden>
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <div className="os-code-layer">
              <pre ref={highlight} aria-hidden>
                {lines.map((l, i) => (
                  <span key={i}>
                    <ColorText line={l} />
                    {"\n"}
                  </span>
                ))}
              </pre>
              <textarea
                spellCheck={false}
                ref={textRef}
                id="os-raw-signal"
                aria-label="Raw trading signal"
                placeholder="BUY XAUUSD @ 2385.50..."
                value={raw}
                maxLength={8000}
                onChange={(e) => change(e.target.value)}
                onScroll={(e) => {
                  if (highlight.current) {
                    highlight.current.scrollTop = e.currentTarget.scrollTop;
                    highlight.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                  if (numbers.current)
                    numbers.current.scrollTop = e.currentTarget.scrollTop;
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </div>
          </div>
          <div className="os-editor-footer">
            <span>
              <i /> {raw.trim() ? "Local parser ready" : "Waiting for input"}
            </span>
            <span>{raw.length} chars</span>
          </div>
        </div>
        <div className="os-composer-foot">
          <div className="os-sample-wrap" ref={sampleRef}>
            <button
              type="button"
              className="os-sample-trigger"
              onClick={() => setSamples(!samples)}
              aria-expanded={samples}
            >
              <Shuffle size={14} /> Load sample <ChevronDown size={12} />
            </button>
            {samples && (
              <div className="os-sample-menu">
                <b>Sample library</b>
                {setup.examples.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => {
                      change(s.raw);
                      setSource(s.source);
                      setFeed(s.feed);
                      setSamples(false);
                      toast(`${s.label} sample loaded`);
                    }}
                  >
                    <SourceMark source={s.source} small />
                    <span>
                      {s.label}
                      <small>{s.feed}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="os-action-primary"
            disabled={busy || !raw.trim()}
            onClick={() => {
              if (finished) {
                change("");
                textRef.current?.focus();
              } else submit();
            }}
          >
            {busy ? (
              <LoaderCircle size={15} className="os-spin" />
            ) : (
              <ScanLine size={15} />
            )}{" "}
            {finished ? "New signal" : "Parse signal"}{" "}
            <CornerDownLeft size={13} />
          </button>
        </div>
      </section>
      <section
        className="os-desk-panel os-preview"
        aria-labelledby="os-preview-heading"
      >
        <div className="os-composer-head">
          <div className="os-title-main">
            <span className="os-feature-icon os-icon-mint">
              <ClipboardList size={17} />
            </span>
            <h2 id="os-preview-heading">Order preview</h2>
          </div>
          <span className="os-step-label">02 / OUTPUT</span>
        </div>
        {!order || !raw.trim() ? (
          <div className="os-preview-empty">
            <Braces size={30} />
            <strong>
              {parsed.isFetching ? "Parsing your signal" : "Your order preview"}
            </strong>
            <p>
              {parsed.isFetching
                ? "Extracting the order parameters..."
                : "Paste a signal to see its parsed fields here."}
            </p>
          </div>
        ) : (
          <>
            <div className="os-order-asset">
              <InstrumentMark symbol={order.symbol} />
              <div>
                <div className="os-asset-name">
                  <h3>{order.symbol || "Unresolved"}</h3>
                  {order.side && (
                    <span
                      className={`os-side-tag os-${order.side.toLowerCase()}`}
                    >
                      <ArrowUpRight size={11} />
                      {order.side}
                    </span>
                  )}
                </div>
                <p>{symbol?.name || "Unknown instrument"}</p>
              </div>
              {symbol && <AssetSpark values={symbol.sparkline} />}
            </div>
            <dl className="os-levels">
              <div>
                <dt>Entry price</dt>
                <dd>{num(order.entry)}</dd>
              </div>
              <div>
                <dt>
                  <i className="os-red-dot" />
                  Stop loss
                </dt>
                <dd>{num(order.sl)}</dd>
              </div>
              <div>
                <dt>
                  <i className="os-green-dot" />
                  Take profit
                </dt>
                <dd>
                  {num(order.targets[0])}
                  {order.targets.length > 1 && (
                    <sup>+{order.targets.length - 1}</sup>
                  )}
                </dd>
              </div>
            </dl>
            <div className="os-order-facts">
              <span>
                Size{" "}
                <b>
                  {order.size.toFixed(2)} {symbol?.volumeUnit ?? "lots"}
                </b>
              </span>
              <i />
              <span>
                R:R <b>1 : {rr || "n/a"}</b>
              </span>
              <i />
              <span>{order.kind}</span>
            </div>
            <div className="os-confidence">
              <span>
                <CheckCheck size={14} />{" "}
                {edited ? "Manually reviewed" : "Parse confidence"}
              </span>
              <div
                className="os-confidence-meter"
                style={{ "--score": `${order.confidence}%` } as CSSProperties}
              >
                <i />
              </div>
              <b>{busy ? "..." : `${order.confidence}%`}</b>
            </div>
            {!!order.warnings.length && (
              <details className="os-parse-warnings">
                <summary>
                  <TriangleAlert size={13} />
                  {order.warnings.length} parser note
                  {order.warnings.length === 1 ? "" : "s"}
                </summary>
                {order.warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </details>
            )}
            <div className="os-preview-foot">
              <button
                type="button"
                className="os-soft-button"
                onClick={() => {
                  if (finished) setRowId(undefined);
                  setEdit(true);
                }}
              >
                <Pencil size={13} /> Edit order
              </button>
              <button
                type="button"
                className="os-square-btn os-stage-mini"
                title="Stage for later"
                aria-label="Stage for later"
                disabled={busy || !valid || !!finished}
                onClick={() => submit(true)}
              >
                <Save size={13} /> Stage
              </button>
              <button
                type="button"
                className="os-action-dark"
                disabled={busy || !valid}
                onClick={() => {
                  if (finished)
                    document
                      .getElementById("os-receipts")
                      ?.scrollIntoView({ block: "center" });
                  else if (saved?.status === "Quarantined")
                    document
                      .getElementById("os-guard-activity")
                      ?.scrollIntoView({ block: "center" });
                  else submit(true, true);
                }}
              >
                {finished
                  ? "View receipt"
                  : saved?.status === "Quarantined"
                    ? "Review guard"
                    : "Review order"}{" "}
                <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
      </section>
      {edit && order && (
        <EditOrder
          order={order}
          markets={markets}
          onClose={() => setEdit(false)}
          onSave={(o) => {
            setEdited(o);
            toast("Manual order changes saved");
          }}
        />
      )}
      <div className="os-composer-settings">
        <span>
          <SourceMark source={appliedSource} small />
          Source:{" "}
          <select
            aria-label="Signal input source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SourceKey | "auto");
              setRowId(undefined);
              setEdited(null);
            }}
          >
            <option value="auto">{sourceNames[appliedSource]} (auto)</option>
            {Object.keys(sourceNames).map((k) => (
              <option key={k} value={k}>
                {sourceNames[k as SourceKey]}
              </option>
            ))}
          </select>
        </span>
        <span>
          <FileCode2 size={12} />{" "}
          {edited ? "Manual overrides applied" : "Plain text & JSON supported"}
        </span>
        <button
          type="button"
          onClick={() => {
            change("");
            textRef.current?.focus();
            toast("Composer cleared");
          }}
        >
          <X size={12} /> Clear input
        </button>
        {edited && (
          <button type="button" onClick={() => setEdited(null)}>
            <RotateCcw size={12} /> Reset edits
          </button>
        )}
      </div>
    </div>
  );
}
