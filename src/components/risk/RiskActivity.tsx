import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, Download, Search } from "lucide-react";
import {
  exportRiskAudit,
  getRiskAudit,
  getRiskOverview,
  type RiskAudit,
} from "@/services/risk";
import {
  Btn,
  Busy,
  Dialog,
  eat,
  ErrorText,
  Note,
  RiskTable,
  Tag,
  usd,
} from "./RiskUI";

type ExposureRow = Awaited<
  ReturnType<typeof getRiskOverview>
>["exposure"][number];
export function Exposure({
  rows,
  pending,
  error,
}: {
  rows: ExposureRow[];
  pending: boolean;
  error: unknown;
}) {
  const [filter, setFilter] = useState("open");
  const filtered = rows
    .filter(
      (r) =>
        filter === "all" ||
        (filter === "open" ? r.open > 0 : r.unprotected > 0),
    )
    .sort((a, b) => b.risk - a.risk);
  const cols: ColumnDef<ExposureRow, unknown>[] = [
    {
      id: "name",
      header: "Account",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.label}</strong>
          <small>
            {r.broker === "paper"
              ? "Paper simulator"
              : "Offline broker snapshot"}
          </small>
        </>
      ),
    },
    { id: "open", header: "Open positions", accessorKey: "open" },
    {
      id: "risk",
      header: "Modeled stop risk",
      cell: ({ row: { original: r } }) => (
        <strong className="os-rk-mono">{usd(r.risk)}</strong>
      ),
    },
    {
      id: "no-stop",
      header: "Unbounded",
      cell: ({ row: { original: r } }) => (
        <Tag tone={r.unprotected ? "amber" : "neutral"}>
          {r.unprotected || "—"}
        </Tag>
      ),
    },
    {
      id: "margin",
      header: "Margin used",
      cell: ({ row: { original: r } }) => (
        <div className="os-rk-margin">
          <div className="os-rk-track">
            <span
              style={{ width: `${Math.min(100, Math.max(0, r.margin))}%` }}
            />
          </div>
          <span className="os-rk-mono">{r.margin.toFixed(1)}%</span>
        </div>
      ),
    },
    {
      id: "pnl",
      header: "Daily realized",
      cell: ({ row: { original: r } }) => (
        <span
          className={`os-rk-mono ${r.pnl < 0 ? "os-rk-text-red" : "os-rk-text-green"}`}
        >
          {usd(r.pnl)}
        </span>
      ),
    },
  ];
  return (
    <div className="os-rk-card">
      <div className="os-rk-toolbar">
        <div>
          <strong>Exposure by account</strong>
          <small>
            Unbounded positions are excluded from the stop-risk dollar total.
          </small>
        </div>
        <label className="os-rk-field">
          <span>Filter exposure</span>
          <select
            className="form-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="open">Open positions</option>
            <option value="all">All profiles</option>
            <option value="unbounded">Missing protection</option>
          </select>
        </label>
      </div>
      {pending ? (
        <Busy />
      ) : error ? (
        <ErrorText error={error} />
      ) : (
        <RiskTable
          rows={filtered}
          cols={cols}
          label="Account exposure snapshot"
        />
      )}
      <div className="os-rk-inline">
        <Link className="os-rk-link" to="/dashboard/positions">
          Review open positions <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
export function Audit() {
  const q = useQuery({ queryKey: ["risk", "audit"], queryFn: getRiskAudit });
  const [decision, setDecision] = useState("All"),
    [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [active, setActive] = useState<RiskAudit>(),
    [notice, setNotice] = useState("");
  const filtered = (q.data ?? []).filter(
    (a) =>
      (decision === "All" || a.decision === decision) &&
      (category === "All" || a.category === category) &&
      (!search.trim() ||
        [a.rule, a.subject, a.ref, a.scope, a.reason, a.mode, a.id]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase())),
  );
  const perPage = 8,
    pages = Math.max(1, Math.ceil(filtered.length / perPage)),
    at = Math.min(pages - 1, page);
  const mut = useMutation({
    mutationFn: (format: "CSV" | "JSON") =>
      exportRiskAudit({ format, ids: filtered.map((a) => a.id) }),
    onSuccess: (r) => {
      const url = URL.createObjectURL(new Blob([r.text], { type: r.type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`${r.count} audit rows exported.`);
    },
  });
  const cols: ColumnDef<RiskAudit, unknown>[] = [
    {
      id: "time",
      header: "Timestamp (EAT)",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{eat(r.at)}</strong>
          <small>{r.mode ?? r.category}</small>
        </>
      ),
    },
    {
      id: "rule",
      header: "Rule / subject",
      cell: ({ row: { original: r } }) => (
        <>
          <strong>{r.rule}</strong>
          <small>{r.subject}</small>
        </>
      ),
    },
    { id: "scope", header: "Scope", accessorKey: "scope" },
    {
      id: "decision",
      header: "Decision",
      cell: ({ row: { original: r } }) => (
        <Tag
          tone={
            r.decision === "PASS"
              ? "green"
              : r.decision === "BLOCK"
                ? "red"
                : "amber"
          }
        >
          {r.decision}
        </Tag>
      ),
    },
    {
      id: "ref",
      header: "Ref / reason",
      cell: ({ row: { original: r } }) => (
        <>
          <code>{r.ref || r.id}</code>
          {r.reason && <small>{r.reason}</small>}
        </>
      ),
    },
    {
      id: "view",
      header: "Evidence",
      cell: ({ row: { original: r } }) => (
        <Btn onClick={() => setActive(r)}>Inspect</Btn>
      ),
    },
  ];
  return (
    <div className="os-rk-card">
      <div className="os-rk-toolbar">
        <div>
          <strong>Decision ledger</strong>
          <small>
            Append-only for this local session. Export respects all filters.
          </small>
        </div>
        <div className="os-rk-actions">
          <Btn
            disabled={!filtered.length || mut.isPending}
            onClick={() => mut.mutate("CSV")}
          >
            <Download size={15} /> Export CSV
          </Btn>
          <Btn
            disabled={!filtered.length || mut.isPending}
            onClick={() => mut.mutate("JSON")}
          >
            Export JSON
          </Btn>
        </div>
      </div>
      <div className="os-rk-filters">
        <label className="os-rk-field">
          <span>Search audit</span>
          <div className="os-rk-search">
            <Search size={15} />
            <input
              className="form-control"
              placeholder="Rule, profile, reference…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </label>
        <label className="os-rk-field">
          <span>Audit decision</span>
          <select
            className="form-select"
            value={decision}
            onChange={(e) => {
              setDecision(e.target.value);
              setPage(0);
            }}
          >
            {["All", "PASS", "BLOCK", "OVERRIDE"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="os-rk-field">
          <span>Audit category</span>
          <select
            className="form-select"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            {[
              "All",
              "Evaluation",
              "Lab",
              "Shield",
              "Control",
              "Policy",
              "Session",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      {notice && (
        <div className="os-rk-inline">
          <Note>{notice}</Note>
        </div>
      )}
      {mut.isError && <ErrorText error={mut.error} />}{" "}
      {q.isPending ? (
        <Busy />
      ) : q.isError ? (
        <div className="os-rk-inline">
          <ErrorText error={q.error} />
          <Btn onClick={() => void q.refetch()}>Retry audit</Btn>
        </div>
      ) : (
        <>
          <RiskTable
            rows={filtered.slice(at * perPage, (at + 1) * perPage)}
            cols={cols}
            label="Risk evaluation audit"
          />
          <div className="os-rk-toolbar os-rk-pagination">
            <small>
              {filtered.length} matching entries · Page {at + 1} of {pages}
            </small>
            <div className="os-rk-actions">
              <Btn disabled={at === 0} onClick={() => setPage(at - 1)}>
                Previous
              </Btn>
              <Btn disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>
                Next
              </Btn>
            </div>
          </div>
        </>
      )}
      {active && (
        <Dialog
          title={active.rule}
          eyebrow={`${active.category.toUpperCase()} · ${active.mode?.toUpperCase() ?? "LOCAL"}`}
          close={() => setActive(undefined)}
        >
          <div className="os-rk-flow">
            <div className="os-rk-actions">
              <Tag
                tone={
                  active.decision === "PASS"
                    ? "green"
                    : active.decision === "BLOCK"
                      ? "red"
                      : "amber"
                }
              >
                {active.decision}
              </Tag>
              <code>{active.id}</code>
            </div>
            <p>{active.detail}</p>
            <div className="os-rk-facts">
              <div>
                <span>Time (EAT)</span>
                <strong>{eat(active.at)}</strong>
              </div>
              <div>
                <span>Subject</span>
                <strong>{active.subject}</strong>
              </div>
              <div>
                <span>Scope</span>
                <strong>{active.scope}</strong>
              </div>
              <div>
                <span>Linked reference</span>
                <code>{active.ref || "—"}</code>
              </div>
              {active.reason && (
                <div>
                  <span>Operator reason</span>
                  <strong>{active.reason}</strong>
                </div>
              )}
            </div>
            <div className="os-rk-actions">
              <Btn onClick={() => setActive(undefined)}>Done</Btn>
              {active.ref?.startsWith("OST-") && (
                <Link to="/dashboard/records" className="os-rk-link">
                  Records <ArrowUpRight size={14} />
                </Link>
              )}
              {active.ref?.startsWith("OS-SCH-") && (
                <Link
                  to="/dashboard/scheduler"
                  search={{ recordSource: active.ref }}
                  className="os-rk-link"
                >
                  Scheduler <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
