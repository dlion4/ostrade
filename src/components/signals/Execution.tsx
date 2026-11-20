import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  Clock3,
  FileText,
  Info,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Trash2,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { TargetAccountPicker } from "@/components/TargetAccountPicker";
import { getSchedulesSummary, type TradingAccount } from "@/services/dashboard";
import type { MarketSymbol } from "@/services/markets";
import {
  buildRoutes,
  scheduleDeskSignal,
  replayPaperTrigger,
  discardSignal,
  eatTime,
  executeSignals,
  saveJournalNote,
  type DeskSignal,
  type Receipt,
  type RouteOptions,
} from "@/services/signalDesk";
import {
  Dialog,
  formatPnl,
  InstrumentMark,
  sourceNames,
  Status,
} from "./DeskUI";

export function RoutingControls({
  accounts,
  options,
  setOptions,
}: {
  accounts: TradingAccount[];
  options: RouteOptions;
  setOptions: (v: RouteOptions) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  return (
    <div className="os-routing-controls">
      <TargetAccountPicker
        accounts={accounts}
        selected={options.accounts}
        onToggle={(id) =>
          setOptions({
            ...options,
            accounts: options.accounts.includes(id)
              ? options.accounts.filter((a) => a !== id)
              : [...options.accounts, id],
          })
        }
      />
      <button
        type="button"
        aria-expanded={advanced}
        className="os-text-button"
        onClick={() => setAdvanced((v) => !v)}
      >
        <SlidersHorizontal size={13} /> {advanced ? "Hide" : "Show"} execution
        settings <ChevronDown size={12} />
      </button>
      {advanced && (
        <div className="os-advanced-grid">
          <label className="os-field">
            Position sizing
            <select
              value={options.sizing}
              onChange={(e) =>
                setOptions({
                  ...options,
                  sizing: e.target.value as RouteOptions["sizing"],
                  amount: e.target.value === "fixed" ? 0.1 : 1,
                })
              }
            >
              <option value="signal">As signaled</option>
              <option value="fixed">Fixed size</option>
              <option value="equity">% of equity</option>
              <option value="risk">Scale to risk</option>
            </select>
          </label>
          {options.sizing !== "signal" && (
            <label className="os-field">
              {options.sizing === "fixed" ? "Order size" : "Equity percentage"}
              <input
                type="number"
                min="0.001"
                step="any"
                value={options.amount || ""}
                onChange={(e) =>
                  setOptions({ ...options, amount: +e.target.value })
                }
              />
            </label>
          )}
          <label className="os-field">
            SL / TP override
            <select
              value={options.protection}
              onChange={(e) =>
                setOptions({
                  ...options,
                  protection: e.target.value as RouteOptions["protection"],
                })
              }
            >
              <option value="signal">As signaled</option>
              <option value="scaled">Scale distances</option>
              <option value="none">No attached stops</option>
            </select>
          </label>
          {options.protection === "scaled" && (
            <label className="os-field">
              Distance multiplier
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={options.scale || ""}
                onChange={(e) =>
                  setOptions({ ...options, scale: +e.target.value })
                }
              />
            </label>
          )}
          <label className="os-field">
            Max spread (instrument points)
            <input
              type="number"
              min="0"
              step="any"
              value={options.spreadCap}
              onChange={(e) =>
                setOptions({ ...options, spreadCap: +e.target.value })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function ReviewDialog({
  rows,
  accounts,
  markets,
  options,
  setOptions,
  halted,
  onClose,
  refresh,
}: {
  rows: DeskSignal[];
  accounts: TradingAccount[];
  markets: MarketSymbol[];
  options: RouteOptions;
  setOptions: (o: RouteOptions) => void;
  halted: boolean;
  onClose: () => void;
  refresh: () => void;
}) {
  const toast = useToast(),
    key = useRef(crypto.randomUUID());
  const legs = useMemo(
    () => buildRoutes(rows, accounts, markets, options, halted),
    [rows, accounts, markets, options, halted],
  );
  const [results, setResults] = useState<Receipt[] | null>(null);
  const submit = useMutation({
    mutationFn: () =>
      executeSignals(
        rows.map((s) => s.id),
        options,
        key.current,
        halted,
      ),
    onSuccess: (r) => {
      setResults(r);
      refresh();
      const filled = r.filter((x) => x.status === "Filled").length;
      toast(
        filled
          ? `${filled} simulated fill${filled === 1 ? "" : "s"} recorded in the journal`
          : `${r.length} execution receipt${r.length === 1 ? "" : "s"} ready`,
      );
    },
    onError: (e) => toast(e.message),
  });
  const eligible = legs.filter((l) => !l.error).length;
  return (
    <Dialog
      title={results ? "Execution receipts" : "Review execution"}
      overline={results ? "LOCAL EXECUTION REPORT" : "CONFIRM YOUR ORDER"}
      description={
        results
          ? "Every destination has its own receipt. Nothing was sent to a live broker."
          : "Verify the order and destination before placing a trade."
      }
      onClose={onClose}
      locked={submit.isPending}
      wide
    >
      <div className="os-dialog-body">
        {results ? (
          <div className="os-result-list">
            {results.map((r) => (
              <div key={r.id} className="os-result">
                <div>
                  <Status value={r.status} />
                  <b>
                    {r.symbol} &middot; {r.side}
                  </b>
                  {(r.status === "Filled" || r.status === "Pending") && <span className="os-env-pill is-paper">SIMULATED</span>}
                </div>
                <p>{r.message}</p>
                <small>
                  {r.account} &middot; {r.ref}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="os-review-overview">
              <span className="os-feature-icon os-icon-orange">
                <Layers3 size={20} />
              </span>
              <div>
                <strong>
                  {rows.length === 1
                    ? `${rows[0].order.side} ${rows[0].order.symbol}`
                    : `${rows.length} signals selected`}
                </strong>
                <small>{rows.map((s) => s.id).join(", ")}</small>
              </div>
              <span className="os-demo-label">LOCAL PREVIEW</span>
            </div>
            <h3 className="os-dialog-subhead">Destination accounts</h3>
            <fieldset disabled={submit.isPending}>
              <RoutingControls
                accounts={accounts}
                options={options}
                setOptions={setOptions}
              />
            </fieldset>
            <h3 className="os-dialog-subhead">
              Order breakdown <span>{eligible} eligible</span>
            </h3>
            <div className="os-route-legs">
              {legs.length ? (
                legs.map((l) => (
                  <div
                    key={`${l.signalId}-${l.account.id}-${l.targetIndex}`}
                    className={l.error ? "os-leg-error" : ""}
                  >
                    <div>
                      <b>
                        {l.account.label}{" "}
                        <small>
                          {l.order.side} {l.mapped || l.symbol}
                        </small>
                      </b>
                      <span>
                        {l.error ? (
                          <>
                            <TriangleAlert size={12} /> Blocked
                          </>
                        ) : l.account.environment === "paper" ? (
                          "SIMULATED"
                        ) : (
                          "PREVIEW ONLY"
                        )}
                      </span>
                    </div>
                    <p>
                      {l.error ||
                        `${l.size} ${l.unit} at ${l.order.entry} | SL ${l.sl || "none"} | TP${l.targetIndex} ${l.tp || "none"} | Spread ${l.spread}`}
                    </p>
                  </div>
                ))
              ) : (
                <p className="os-form-error">Select a destination account.</p>
              )}
            </div>
            <div className="os-info-line">
              <ShieldCheck size={16} />
              <span>
                Paper fills update your positions and journal. Broker routes
                stop at a backend-required preview. Blocked legs will not
                execute.
              </span>
            </div>
          </>
        )}
      </div>
      <footer className="os-dialog-foot">
        <button
          className="os-soft-button"
          type="button"
          disabled={submit.isPending}
          onClick={onClose}
        >
          {results ? "Close" : "Cancel"}
        </button>
        {results ? (
          <button
            className="os-action-primary"
            onClick={() => {
              onClose();
              document
                .getElementById("os-receipts")
                ?.scrollIntoView({ block: "start" });
            }}
          >
            View receipts <ArrowRight size={15} />
          </button>
        ) : (
          <button
            type="button"
            className="os-action-primary"
            disabled={submit.isPending || !eligible}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? (
              <LoaderCircle size={15} className="os-spin" />
            ) : (
              <Check size={15} />
            )}{" "}
            {submit.isPending
              ? "Submitting locally..."
              : legs.every((l) => l.account.environment !== "paper")
                ? "Confirm broker preview"
                : "Confirm & place trade"}
          </button>
        )}
      </footer>
    </Dialog>
  );
}

export function SignalDetail({
  row,
  accounts,
  onClose,
  onLoad,
  refresh,
  snapshot,
}: {
  row: DeskSignal;
  accounts: TradingAccount[];
  onClose: () => void;
  onLoad: (r: DeskSignal) => void;
  refresh: () => void;
  snapshot: number;
}) {
  const [tab, setTab] = useState<"detail" | "schedule" | "note">("detail"),
    [note, setNote] = useState(""),
    [acc, setAcc] = useState(accounts[0]?.id || "acc-paper-main"),
    [at, setAt] = useState("2025-03-14T18:00"),
    [outcome, setOutcome] = useState("");
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => saveJournalNote(row.id, note),
    onSuccess: (r) => {
      refresh();
      setNote("");
      setOutcome(`Journal note saved with reference ${r}.`);
      toast("Note saved to Records");
    },
    onError: (e) => setOutcome(e.message),
  });
  const slots = useQuery({
    queryKey: ["schedules"],
    queryFn: getSchedulesSummary,
    enabled: tab === "schedule",
  });
  const schedule = useMutation({
    mutationFn: () => scheduleDeskSignal(row.id, acc, at),
    onSuccess: (r) => {
      refresh();
      setOutcome(r.detail);
      toast(r.title);
      setTab("detail");
    },
    onError: (e) => setOutcome(e.message),
  });
  const discard = useMutation({
    mutationFn: () => discardSignal(row.id),
    onSuccess: () => {
      refresh();
      toast("Signal discarded; its audit trail was retained");
      onClose();
    },
    onError: (e) => setOutcome(e.message),
  });
  const locked = ["Quarantined", "Discarded"].includes(row.status),
    finished = ["Filled", "Preview", "Pending"].includes(row.status);
  return (
    <Dialog title="Signal details" overline={row.id} onClose={onClose}>
      <div className="os-dialog-body">
        <div className="os-detail-instrument">
          <InstrumentMark symbol={row.order.symbol} />
          <div>
            <h3>{row.order.symbol || "Unknown instrument"}</h3>
            <p>
              {row.feed} &middot; {sourceNames[row.order.source]}
            </p>
          </div>
          <Status value={row.status} />
        </div>
        <pre className="os-raw-excerpt">{row.raw}</pre>
        <dl className="os-detail-facts">
          {[
            ["Received", `${eatTime(row.time)} EAT`],
            ["Direction", row.order.side || "Not set"],
            ["Entry price", row.order.entry],
            ["Stop loss", row.order.sl || "Not set"],
            ["Take profit", row.order.targets.join(" / ") || "Not set"],
            ["Size", row.order.size],
            [
              "Accounts",
              row.accounts
                .map((id) => accounts.find((a) => a.id === id)?.label ?? id)
                .join(", ") || "Unassigned",
            ],
            [
              "Attributed P&L",
              row.pnl !== null ? formatPnl(row.pnl) : "Not realized",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {!!row.refs.length && (
          <div className="os-inline-readout">
            <FileText size={13} />
            {row.refs.join(", ")}
          </div>
        )}
        <div className="os-dialog-actions">
          <button
            type="button"
            className="os-soft-button"
            onClick={() => {
              onLoad(row);
              onClose();
            }}
          >
            <Pencil size={13} />
            {finished ? "Re-execute draft" : "Load in composer"}
          </button>
          <button
            type="button"
            className="os-soft-button"
            disabled={locked}
            onClick={() => {
              setTab("schedule");
              setOutcome("");
            }}
          >
            <Clock3 size={13} /> Schedule
          </button>
          <button
            type="button"
            className="os-soft-button"
            onClick={() => {
              setTab("note");
              setOutcome("");
            }}
          >
            <MessageSquareText size={13} /> Journal note
          </button>
        </div>
        {tab === "note" && (
          <form
            className="os-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <label className="os-field">
              Journal note
              <textarea
                required
                minLength={2}
                maxLength={600}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="os-action-dark"
              disabled={save.isPending}
            >
              Save note
            </button>
          </form>
        )}
        {tab === "schedule" && (
          <form
            className="os-inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              schedule.mutate();
            }}
          >
            <span className="os-inline-readout">
              Scheduler slots{" "}
              <b>
                {slots.data
                  ? `${slots.data.usedSlots} / ${slots.data.maxSlots}`
                  : "Loading..."}
              </b>
            </span>
            <label className="os-field">
              Target account
              <select value={acc} onChange={(e) => setAcc(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="os-field">
              Execution time (EAT)
              <input
                required
                type="datetime-local"
                min={new Date(snapshot + 10860000).toISOString().slice(0, 16)}
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="os-action-dark"
              disabled={schedule.isPending}
            >
              Queue schedule
            </button>
          </form>
        )}
        {!!row.notes.length && (
          <div className="os-signal-notes">
            <h3>Journal notes</h3>
            {row.notes.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        )}
        {outcome && (
          <p className="os-info-line" role="status">
            <Info size={15} />
            {outcome}
          </p>
        )}
      </div>
      <footer className="os-dialog-foot">
        <button
          type="button"
          className="os-text-button os-danger"
          disabled={finished || row.status === "Discarded" || discard.isPending}
          onClick={() => discard.mutate()}
        >
          <Trash2 size={13} /> Discard signal
        </button>
        <button type="button" className="os-soft-button" onClick={onClose}>
          Done
        </button>
      </footer>
    </Dialog>
  );
}

export function RoutingSection({
  accounts,
  options,
  setOptions,
  selected,
  onReview,
}: {
  accounts: TradingAccount[];
  options: RouteOptions;
  setOptions: (o: RouteOptions) => void;
  selected: DeskSignal[];
  onReview: (r: DeskSignal[]) => void;
}) {
  return (
    <section className="os-desk-panel os-lower-panel" id="os-routing">
      <div className="os-panel-title">
        <div className="os-title-main">
          <Wallet size={18} />
          <h2>Execution routing</h2>
        </div>
        <span className="os-title-action os-mini-label">
          {options.accounts.length} TARGET
          {options.accounts.length !== 1 ? "S" : ""}
        </span>
      </div>
      <p className="os-panel-desc">
        Choose the accounts and sizing rules for your next order.
      </p>
      <RoutingControls
        accounts={accounts}
        options={options}
        setOptions={setOptions}
      />
      {selected.length > 0 && (
        <button className="os-action-dark" onClick={() => onReview(selected)}>
          Review {selected.length} selected <ArrowRight size={14} />
        </button>
      )}
    </section>
  );
}
export function ReceiptsSection({
  receipts,
  onStart,
  refresh,
  halted,
}: {
  receipts: Receipt[];
  onStart: () => void;
  refresh: () => void;
  halted: boolean;
}) {
  const toast = useToast();
  const [replay, setReplay] = useState<Receipt | null>(null);
  const trigger = useMutation({
    mutationFn: () => replayPaperTrigger(replay!.id, halted),
    onSuccess: (r) => {
      refresh();
      setReplay(null);
      toast(`Simulated fill: ${r.ref}`);
    },
    onError: (e) => toast(e.message),
  });
  const [all, setAll] = useState(false);
  return (
    <section className="os-desk-panel os-lower-panel" id="os-receipts">
      <div className="os-panel-title">
        <div className="os-title-main">
          <ClipboardList size={18} />
          <h2>Execution receipts</h2>
        </div>
        <span className="os-count">{receipts.length}</span>
      </div>
      {receipts.length ? (
        <div className="os-receipt-stream">
          {receipts.slice(0, all ? receipts.length : 4).map((r) => (
            <div key={r.id}>
              <CheckCheck size={16} />
              <span>
                <b>
                  {r.symbol} <small>{r.account}</small>
                </b>
                <em>{r.ref}</em>
              </span>
              <Status value={r.status} />
              {r.status === "Pending" && (
                <button
                  type="button"
                  className="os-soft-button os-tiny-button"
                  onClick={() => setReplay(r)}
                >
                  Simulate trigger
                </button>
              )}
            </div>
          ))}
          {receipts.length > 4 && (
            <button className="os-text-button" onClick={() => setAll(!all)}>
              {all ? "Show latest" : "Show all receipts"}
            </button>
          )}
        </div>
      ) : (
        <div className="os-empty-receipts">
          <CircleCheck size={26} />
          <strong>No orders placed this session</strong>
          <p>Your confirmed orders and broker previews will appear here.</p>
          <button className="os-text-button" onClick={onStart}>
            Back to composer <ArrowRight size={13} />
          </button>
        </div>
      )}
      <Link to="/dashboard" className="os-bottom-link">
        View positions & journal <SquareArrowOutUpRight size={13} />
      </Link>
      {replay && (
        <Dialog
          title="Simulate a paper trigger?"
          overline={replay.ref}
          description="Replay the entry condition locally. No market quote is changed and no broker order is sent."
          onClose={() => setReplay(null)}
          locked={trigger.isPending}
        >
          <div className="os-dialog-body">
            <strong>
              {replay.side} {replay.size} {replay.symbol} @ {replay.price}
            </strong>
            <p className="os-muted-copy">{replay.account} · SIMULATED</p>
          </div>
          <footer className="os-dialog-foot">
            <button
              className="os-soft-button"
              disabled={trigger.isPending}
              onClick={() => setReplay(null)}
            >
              Cancel
            </button>
            <button
              className="os-action-primary"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate()}
            >
              {trigger.isPending ? "Filling locally..." : "Confirm paper fill"}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  );
}
