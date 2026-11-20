import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import {
  ArrowUpRight,
  BookOpen,
  Cable,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { usePageStyle } from "@/hooks/usePageStyle";
import { useDashboardContext } from "@/context/DashboardContext";
import { QueryError } from "@/components/QueryError";
import { Composer, type ComposerLoad } from "@/components/signals/Composer";
import { GuideDialog, SourceMark } from "@/components/signals/DeskUI";
import { SignalInbox } from "@/components/signals/SignalInbox";
import { ImportDialog, SourceDialog } from "@/components/signals/SourceDialogs";
import {
  ReceiptsSection,
  ReviewDialog,
  RoutingSection,
  SignalDetail,
} from "@/components/signals/Execution";
import {
  GuardSection,
  ImportSection,
  PerformanceSection,
} from "@/components/signals/Oversight";
import { getAccounts } from "@/services/dashboard";
import { getMarketUniverse } from "@/services/markets";
import {
  eatTime,
  getDeskReceipts,
  getDeskSetup,
  getGuardLog,
  getSignals,
  getSourcePerformance,
  type DeskSignal,
  type RouteOptions,
  type SourceKey,
} from "@/services/signalDesk";
import css from "@/styles/pages/dash-signal-desk.css?inline";

export function DashSignalDeskPage() {
  usePageStyle("dash-signal-desk", css);
  const { activeAccountId, killSwitch, globalMode } = useDashboardContext(),
    qc = useQueryClient();
  const setup = useQuery({ queryKey: ["desk-setup"], queryFn: getDeskSetup });
  const inbox = useQuery({
    queryKey: ["signals"],
    queryFn: getSignals,
    refetchOnMount: "always",
  });
  const accts = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const universe = useQuery({
    queryKey: ["market-universe"],
    queryFn: getMarketUniverse,
  });
  const performance = useQuery({
    queryKey: ["desk-performance"],
    queryFn: getSourcePerformance,
    refetchOnMount: "always",
  });
  const guards = useQuery({
    queryKey: ["signal-guards"],
    queryFn: getGuardLog,
  });
  const receipts = useQuery({
    queryKey: ["signal-receipts"],
    queryFn: getDeskReceipts,
  });
  const [guide, setGuide] = useState(false),
    [source, setSource] = useState<SourceKey | null>(null),
    [importing, setImport] = useState<"rows" | "file" | "provider" | null>(
      null,
    ),
    [selection, setSelection] = useState<RowSelectionState>({}),
    [detail, setDetail] = useState<string | null>(null),
    [review, setReview] = useState<DeskSignal[] | null>(null),
    [load, setLoad] = useState<ComposerLoad | null>(null);
  const [options, setOptions] = useState<RouteOptions>({
    accounts: [activeAccountId === "all" ? "acc-paper-main" : activeAccountId],
    sizing: "signal",
    amount: 0.1,
    protection: "signal",
    scale: 1,
    spreadCap: 40,
  });
  useEffect(() => {
    const old = document.title;
    document.title = "Signal Desk | OStrade";
    return () => {
      document.title = old;
    };
  }, []);
  useEffect(() => {
    setOptions((prev) => ({
      ...prev,
      accounts: [
        activeAccountId === "all"
          ? globalMode === "paper"
            ? "acc-paper-main"
            : "acc-exness-trial"
          : activeAccountId,
      ],
    }));
  }, [activeAccountId, globalMode]);
  const refresh = useCallback(() => {
    for (const key of [
      "signals",
      "signal-guards",
      "signal-receipts",
      "desk-performance",
      "positions",
      "records",
      "accounts",
      "schedules",
    ])
      void qc.invalidateQueries({ queryKey: [key] });
  }, [qc]);
  const accounts = useMemo(
    () =>
      (accts.data ?? []).filter(
        (a) =>
          a.connected ||
          (globalMode === "live" && a.environment === "live-ready"),
      ),
    [accts.data, globalMode],
  );
  const rows = inbox.data ?? [],
    detailRow = rows.find((r) => r.id === detail),
    selected = rows.filter(
      (r) => selection[r.id] && ["Staged", "Parsed"].includes(r.status),
    );
  const onDetail = useCallback((r: DeskSignal) => setDetail(r.id), []);
  const scrollToComposer = () => {
    document.getElementById("os-workbench")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  };
  const onLoad = (r: DeskSignal) => {
    setLoad({
      key: Date.now(),
      raw: r.raw,
      source: r.order.source,
      feed: r.feed,
      order: structuredClone(r.order),
      id: ["Staged", "Parsed", "Quarantined"].includes(r.status)
        ? r.id
        : undefined,
    });
    scrollToComposer();
  };
  const retry = () => {
    setup.refetch();
    accts.refetch();
    inbox.refetch();
    universe.refetch();
  };
  return (
    <main
      className="page-dash-signal-desk os-desk-page"
      aria-labelledby="os-desk-title"
    >
      <header className="os-desk-masthead">
        <div>
          <div className="os-workspace-label">
            <i /> TRADING WORKSPACE
          </div>
          <h1 id="os-desk-title">
            Signal Desk
            <span className="os-title-period" aria-hidden="true">
              .
            </span>
          </h1>
          <p>Turn incoming signals into execution-ready orders.</p>
        </div>
        <div className="os-mast-actions">
          <button
            type="button"
            className="os-soft-button"
            onClick={() => setGuide(true)}
          >
            <BookOpen size={15} /> Desk guide
          </button>
          <button
            type="button"
            className="os-action-primary"
            onClick={() => setImport("rows")}
          >
            <Upload size={15} /> Import signals
          </button>
        </div>
      </header>
      {setup.isError || accts.isError || inbox.isError || universe.isError ? (
        <QueryError
          title="The local workspace could not be loaded"
          onRetry={retry}
        />
      ) : !setup.data || !accts.data || !inbox.data || !universe.data ? (
        <div
          className="os-desk-loading"
          aria-busy="true"
          aria-label="Loading Signal Desk"
        >
          <span className="os-skel" />
          <span className="os-skel" />
          <span className="os-skel" />
        </div>
      ) : (
        <>
          <section className="os-channels" aria-labelledby="os-channels-title">
            <div className="os-channel-heading">
              <h2 id="os-channels-title">
                <Cable size={15} /> Source channels
              </h2>
              <button
                type="button"
                className="os-text-button"
                onClick={() => setSource("paste")}
              >
                Manage sources <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="os-channel-grid">
              {setup.data.sources.map((s) => {
                const list = rows.filter((r) => r.order.source === s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    className="os-channel"
                    onClick={() => setSource(s.id)}
                    title={`${s.name}: ${list.filter((r) => r.time >= setup.data.snapshotAt - 16 * 3600000).length} signals today. Last received: ${list.length ? eatTime(list[0].time) + " EAT" : "none"}.`}
                  >
                    <SourceMark source={s.id} />
                    <span>
                      <strong>{s.name}</strong>
                      <small
                        className={
                          s.status === "Available" ? "os-channel-on" : ""
                        }
                      >
                        <i />
                        {s.status === "Available"
                          ? "Ready"
                          : s.id === "telegram"
                            ? "Demo feed"
                            : "Preview"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          <div id="os-workbench">
            <Composer
              rows={rows}
              key={load?.key ?? "initial"}
              load={load}
              setup={setup.data}
              markets={universe.data}
              onReview={setReview}
              onStage={(id) => setSelection((s) => ({ ...s, [id]: true }))}
              refresh={refresh}
            />
          </div>
          <SignalInbox
            rows={rows}
            accountNames={Object.fromEntries(
              accounts.map((a) => [a.id, a.label]),
            )}
            snapshot={setup.data.snapshotAt}
            selection={selection}
            setSelection={setSelection}
            onDetail={onDetail}
            onReview={setReview}
          />
          <div className="os-desk-section-rule">
            <span>OPERATIONS</span>
            <i />
          </div>
          <RoutingSection
            accounts={accounts}
            options={options}
            setOptions={setOptions}
            selected={selected}
            onReview={setReview}
          />
          <div className="os-support-pair">
            <ImportSection onImport={setImport} />
            <ReceiptsSection
              receipts={receipts.data ?? []}
              onStart={scrollToComposer}
              refresh={refresh}
              halted={killSwitch === "flattened"}
            />
          </div>
          {performance.isError ? (
            <QueryError
              title="Source performance could not be loaded"
              onRetry={() => performance.refetch()}
            />
          ) : (
            <PerformanceSection
              feeds={performance.data ?? []}
              refresh={refresh}
            />
          )}
          {guards.isError ? (
            <QueryError
              title="Guard log could not be loaded"
              onRetry={() => guards.refetch()}
            />
          ) : (
            guards.data && (
              <GuardSection
                events={guards.data.events}
                policy={guards.data.policy}
                refresh={refresh}
              />
            )
          )}
          <footer className="os-desk-footer">
            <span>
              <ShieldCheck size={14} /> Local simulation workspace
            </span>
            <span>No live orders or external connections.</span>
          </footer>
        </>
      )}
      {guide && (
        <GuideDialog
          onClose={() => setGuide(false)}
          onTry={() => {
            setGuide(false);
            if (setup.data)
              setLoad({
                key: Date.now(),
                raw: setup.data.first,
                source: "telegram",
                feed: setup.data.examples[0].feed,
              });
            scrollToComposer();
          }}
        />
      )}
      {source && setup.data && (
        <SourceDialog
          setup={setup.data}
          initial={source}
          rows={rows}
          onClose={() => setSource(null)}
          onImport={() => {
            setSource(null);
            setImport("file");
          }}
        />
      )}
      {importing && setup.data && (
        <ImportDialog
          setup={setup.data}
          initial={importing}
          onClose={() => setImport(null)}
          refresh={refresh}
        />
      )}
      {detailRow && setup.data && (
        <SignalDetail
          row={detailRow}
          accounts={accounts}
          onClose={() => setDetail(null)}
          onLoad={onLoad}
          refresh={refresh}
          snapshot={setup.data.snapshotAt}
        />
      )}
      {review && universe.data && (
        <ReviewDialog
          rows={review}
          accounts={accounts}
          markets={universe.data}
          options={options}
          setOptions={setOptions}
          halted={killSwitch === "flattened"}
          onClose={() => setReview(null)}
          refresh={() => {
            refresh();
            setSelection({});
          }}
        />
      )}
    </main>
  );
}
