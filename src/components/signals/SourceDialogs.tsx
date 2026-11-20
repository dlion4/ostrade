import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  FileUp,
  FolderOpen,
  Info,
  KeyRound,
  Link2,
  LoaderCircle,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  eatTime,
  configureSource,
  getDeskSetup,
  importSignals,
  type DeskSignal,
  type SourceKey,
} from "@/services/signalDesk";
import { readTabularText } from "@/utils/signalParser";
import { useToast } from "@/components/Toast";
import { CopyButton, Dialog, SourceMark } from "./DeskUI";

type Setup = Awaited<ReturnType<typeof getDeskSetup>>;
export function SourceDialog({
  setup,
  initial,
  rows,
  onClose,
  onImport,
}: {
  setup: Setup;
  initial: SourceKey;
  rows: DeskSignal[];
  onClose: () => void;
  onImport: () => void;
}) {
  const [key, setKey] = useState(initial),
    [value, setValue] = useState(
      setup.sources.find((s) => s.id === initial)!.value,
    ),
    [result, setResult] = useState(""),
    [error, setError] = useState("");
  const src = setup.sources.find((s) => s.id === key)!;
  const toast = useToast();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () => configureSource(key, value),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["desk-setup"] });
      toast("Configuration checked locally");
    },
    onError: (e) => setError(e.message),
  });
  return (
    <Dialog
      title="Source channels"
      overline="INGESTION SETTINGS"
      description="Manage local inputs and prepare your external integrations."
      onClose={onClose}
      wide
    >
      <div className="os-source-dialog-grid">
        <nav aria-label="Source settings">
          {setup.sources.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === key ? "os-active" : ""}
              onClick={() => {
                setKey(s.id);
                setValue(s.value);
                setResult("");
                setError("");
              }}
            >
              <SourceMark source={s.id} small />
              {s.name}
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <div className="os-source-config">
          <SourceMark source={key} />
          <h3>{src.name}</h3>
          <p>{src.hint}</p>
          <div className="os-inline-readout">
            <span>
              Inbox signals{" "}
              <b>{rows.filter((r) => r.order.source === key).length}</b>
            </span>
            <span>
              Last received{" "}
              <b>
                {rows.find((r) => r.order.source === key)
                  ? `${eatTime(rows.find((r) => r.order.source === key)!.time)} EAT`
                  : "None yet"}
              </b>
            </span>
            <span>
              Mode{" "}
              <b>{src.status === "Available" ? "Local" : "Offline preview"}</b>
            </span>
          </div>
          <label className="os-field">
            {src.field}
            <input
              value={value}
              readOnly={key !== "telegram" && key !== "copyfactory"}
              onChange={(e) => {
                setValue(e.target.value);
                setResult("");
                setError("");
              }}
            />
          </label>
          {key === "webhook" && (
            <div className="os-secret">
              <small className="os-muted-copy">Demo secrets are masked here. Use Workspace Settings to reveal, copy, or rotate them.</small>
              <div className="os-dialog-actions">
                <Link className="os-soft-button" to="/dashboard/settings" hash="st-webhooks">Manage webhook secrets</Link>
              </div>
            </div>
          )}
          {key === "email" && <CopyButton text={value} label="Copy address" />}
          {key === "telegram" && (
            <small className="os-muted-copy">
              0 live chats linked. This handle is a sample configuration.
            </small>
          )}
          {key === "csv" ? (
            <button className="os-action-primary" onClick={onImport}>
              <FileUp size={14} /> Open importer
            </button>
          ) : key === "paste" ? (
            <button
              className="os-action-primary"
              onClick={() => {
                onClose();
                requestAnimationFrame(() =>
                  document.getElementById("os-raw-signal")?.focus(),
                );
              }}
            >
              Open composer <ChevronRight size={14} />
            </button>
          ) : (
            <button
              className="os-action-primary"
              disabled={save.isPending}
              onClick={() => {
                setError("");
                save.mutate();
              }}
            >
              <ShieldCheck size={14} />{" "}
              {save.isPending ? "Checking..." : "Validate configuration"}
            </button>
          )}
          {error && (
            <p role="alert" className="os-form-error">
              {error}
            </p>
          )}
          {result && (
            <div role="status" className="os-info-line">
              <Info size={16} />
              {result}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

const mappingKeys = [
  "ticket",
  "symbol",
  "side",
  "entry",
  "sl",
  "tp",
  "size",
] as const;
type MapKey = (typeof mappingKeys)[number];
const columnAliases: Record<MapKey, string[]> = {
  ticket: ["ticket", "id", "order", "order id"],
  symbol: ["symbol", "instrument", "ticker"],
  side: ["side", "type", "direction", "action"],
  entry: ["entry", "price", "open price"],
  sl: ["sl", "s/l", "stop loss"],
  tp: ["tp", "t/p", "take profit"],
  size: ["size", "volume", "lots", "qty"],
};
export function ImportDialog({
  setup,
  onClose,
  refresh,
  initial = "rows",
}: {
  setup: Setup;
  onClose: () => void;
  refresh: () => void;
  initial?: "rows" | "file" | "provider";
}) {
  const [mode, setMode] = useState(initial),
    [text, setText] = useState(""),
    [filename, setFilename] = useState(""),
    [mapping, map] = useState<Partial<Record<MapKey, number>>>({}),
    [provider, setProvider] = useState(""),
    [providerName, setProviderName] = useState(""),
    [error, setError] = useState("");
  const parsed = useMemo(() => readTabularText(text), [text]);
  const headers = parsed[0] ?? [];
  const rows = parsed.slice(1);
  const mappingFor = (k: MapKey) =>
    mapping[k] ??
    headers.findIndex((h) => columnAliases[k].includes(h.toLowerCase()));
  const valid =
    mappingFor("symbol") >= 0 &&
    mappingFor("side") >= 0 &&
    rows.length > 0 &&
    rows.length <= 500;
  const toast = useToast();
  const qc = useQueryClient();
  const importing = useMutation({
    mutationFn: () =>
      importSignals(
        rows.map((row) => {
          const v = (k: MapKey) => row[mappingFor(k)] ?? "";
          return {
            ticket: v("ticket"),
            raw: `${v("side")} ${v("symbol")} ${v("entry") ? `@ ${v("entry")}` : ""}\n${v("sl") ? `SL ${v("sl")}` : ""}\n${v("tp") ? `TP ${v("tp")}` : ""}\n${v("size") ? `SIZE ${v("size")}` : ""}`,
          };
        }),
        "csv",
      ),
    onSuccess: (r) => {
      refresh();
      toast(
        `Imported ${r.added} signals; ${r.skipped} duplicate tickets skipped`,
      );
    },
    onError: (e) => setError(e.message),
  });
  const configure = useMutation({
    mutationFn: () => configureSource("copyfactory", provider.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["desk-setup"] });
      toast("Provider configuration validated locally");
    },
    onError: (e) => setError(e.message),
  });
  const load = async (file?: File) => {
    if (!file) return;
    if (file.size > 1048576 || !/\.(csv|tsv|html?)$/i.test(file.name)) {
      setError("Choose a .csv, .tsv, or .html statement smaller than 1 MB.");
      return;
    }
    setText((await file.text()).replace(/^\uFEFF/, ""));
    setFilename(file.name);
    map({});
    setError("");
  };
  return (
    <Dialog
      title="Import signals"
      overline="SIGNAL INTAKE"
      description="Bring provider trades into your inbox without placing orders."
      onClose={onClose}
      locked={importing.isPending}
      wide
    >
      {importing.data ? (
        <div className="os-import-success">
          <CheckCircle2 size={36} />
          <h3>{importing.data.added} {importing.data.added === 1 ? "signal" : "signals"} imported</h3>
          <p>
            {importing.data.skipped} duplicate tickets skipped.{" "}
            {importing.data.held} held by guardrails.
          </p>
          <button
            className="os-action-primary"
            onClick={() => {
              onClose();
              document
                .getElementById("os-signal-inbox")
                ?.scrollIntoView({ block: "start" });
            }}
          >
            View signal inbox <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="os-dialog-tabs">
            {(
              [
                ["rows", "Paste rows"],
                ["file", "Statement file"],
                ["provider", "CopyFactory"],
              ] as const
            ).map(([k, n]) => (
              <button
                key={k}
                type="button"
                className={mode === k ? "os-current" : ""}
                onClick={() => {
                  setMode(k);
                  setError("");
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="os-dialog-body">
            {mode === "provider" ? (
              <>
                <div className="os-info-line">
                  <Link2 size={16} />
                  <span>
                    Provider streams are offline. Prepare a configuration or
                    import the provider's exported trades locally.
                  </span>
                </div>
                <div className="os-form-grid">
                  <label className="os-field">
                    Provider name
                    <input
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      placeholder="e.g. Trend Rider"
                    />
                  </label>
                  <label className="os-field">
                    Strategy ID
                    <input
                      value={provider}
                      onChange={(e) => {
                        setProvider(e.target.value);
                        configure.reset();
                      }}
                      placeholder="strategy-2231"
                    />
                  </label>
                </div>
                {configure.data && (
                  <div className="os-info-line" role="status">
                    <ShieldCheck size={16} />
                    {configure.data}
                  </div>
                )}
              </>
            ) : (
              <>
                {mode === "file" ? (
                  <label
                    className="os-upload-zone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      void load(e.dataTransfer.files[0]);
                    }}
                  >
                    <FolderOpen size={28} />
                    <b>{filename || "Choose a statement or drop it here"}</b>
                    <span>MQL5 HTML, CSV or TSV. Up to 500 rows, 1 MB.</span>
                    <input
                      type="file"
                      accept=".csv,.tsv,.htm,.html"
                      onChange={(e) => void load(e.target.files?.[0])}
                    />
                  </label>
                ) : (
                  <label className="os-field">
                    Provider export
                    <textarea
                      className="os-monospace"
                      rows={5}
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value.slice(0, 200000));
                        map({});
                      }}
                      placeholder={
                        "ticket,symbol,side,entry,sl,tp,size\n4401,XAUUSD,BUY,2385.50,2378.00,2402.00,0.10"
                      }
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="os-text-button"
                  onClick={() => {
                    setText(setup.csvExample);
                    map({});
                    setFilename("sample-provider.csv");
                    setError("");
                  }}
                >
                  <FileSpreadsheet size={14} /> Load a sample export
                </button>
                {headers.length > 0 && (
                  <>
                    <h3 className="os-dialog-subhead">
                      Match your columns <span>{rows.length} rows</span>
                    </h3>
                    <div className="os-column-map">
                      {mappingKeys.map((k) => (
                        <label className="os-field" key={k}>
                          {k === "sl"
                            ? "Stop loss"
                            : k === "tp"
                              ? "Take profit"
                              : k}
                          <select
                            value={mappingFor(k)}
                            onChange={(e) =>
                              map({ ...mapping, [k]: +e.target.value })
                            }
                          >
                            <option value={-1}>Not mapped</option>
                            {headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    {!valid && (
                      <p className="os-form-error">
                        Map an instrument and direction, with 1-500 data rows.
                      </p>
                    )}
                    {valid && (
                      <div className="os-import-preview">
                        <span>ROW PREVIEW</span>
                        {rows.slice(0, 3).map((r, i) => (
                          <p key={i}>
                            <Check size={13} />
                            {r[mappingFor("symbol")]} &middot;{" "}
                            {r[mappingFor("side")]} &middot;{" "}
                            {r[mappingFor("entry")] || "Market entry"}
                          </p>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {error && (
              <p className="os-form-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="os-dialog-foot">
            <span>
              <ShieldCheck size={14} /> Local processing only
            </span>
            {mode === "provider" ? (
              <button
                type="button"
                className="os-action-primary"
                disabled={configure.isPending}
                onClick={() => {
                  setError("");
                  if (!providerName.trim()) {
                    setError("Enter a provider name.");
                    return;
                  }
                  configure.mutate();
                }}
              >
                <KeyRound size={14} /> Validate provider
              </button>
            ) : (
              <button
                type="button"
                className="os-action-primary"
                disabled={!valid || importing.isPending}
                onClick={() => importing.mutate()}
              >
                {importing.isPending ? (
                  <LoaderCircle size={14} className="os-spin" />
                ) : (
                  <Upload size={14} />
                )}{" "}
                Import {rows.length || ""} {rows.length === 1 ? "signal" : "signals"}
              </button>
            )}
          </footer>
        </>
      )}
    </Dialog>
  );
}
