import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownToLine, ArrowLeftRight, ArrowUpRight, KeyRound, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { getAccountDetail, getHubAdapters, type TradingAccount } from "@/services/accounts";
import { BrokerMark, Busy, CapabilityTags, Chip, Dialog, Empty, StateNote, accountTag, dollars, eatDate, names } from "./AccountUI";
import { AuditTable, MappingTable, detailTabs, type ActionInput, type DetailTab } from "./HubTools";

export function AccountDetail({ account, initial, close, action, activate }: { account: TradingAccount; initial: DetailTab; close: () => void; action: (input: ActionInput) => void; activate: (account: TradingAccount) => void }) {
  const [tab, setTab] = useState<DetailTab>(initial);
  const info = useQuery({ queryKey: ["account-detail", account.id], queryFn: () => getAccountDetail(account.id) });
  const adapters = useQuery({ queryKey: ["hub-adapters"], queryFn: getHubAdapters, enabled: tab === "Health" });
  const adapter = adapters.data?.find((a) => a.broker === account.broker);
  const data = info.data;
  const a = data?.account ?? account;
  const call = (value: ActionInput["action"]) => action({ accountId: a.id, broker: a.broker, action: value });
  return <Dialog title={a.label} kicker="ACCOUNT PROFILE" close={close} drawer>
    <div className="os-hub-flow"><div className="os-hub-wizard-provider"><BrokerMark broker={a.broker} /><div><strong>{names[a.broker]}</strong><small>{a.accountNumber} · {a.currency}</small></div><Chip tone={a.broker === "paper" ? "green" : a.environment === "live-ready" ? "orange" : "neutral"}>{accountTag(a)}</Chip></div>
    <div className="os-hub-segments os-hub-detail-tabs" role="group" aria-label="Account detail tabs">{detailTabs.map((item) => <button key={item} onClick={() => setTab(item)} aria-pressed={tab === item}>{item}</button>)}</div>
    {info.isPending ? <Empty><Busy>Loading account profile…</Busy></Empty> : info.isError || !data ? <Empty><button className="btn os-hub-btn" onClick={() => void info.refetch()}>Retry account profile</button></Empty> : <>
      {tab === "Overview" && <>
        <dl className="os-hub-dl"><div><dt>Account reference</dt><dd className="os-hub-num">{a.accountNumber}</dd></div><div><dt>Server / endpoint fixture</dt><dd>{a.serverOrEndpoint}</dd></div><div><dt>Leverage</dt><dd>{a.leverage}</dd></div><div><dt>Balance / equity</dt><dd>{dollars(a.balance, a.currency)} / {dollars(a.equity, a.currency)}</dd></div><div><dt>Actual access</dt><dd>{a.broker === "paper" ? "Local engine only" : "No authenticated broker session"}</dd></div></dl>
        <div className="os-hub-inset"><strong>Adapter capabilities</strong><p>Capabilities describe the adapter, not permission grants from your broker.</p><CapabilityTags broker={a.broker} details /></div>
        <div className="os-hub-actions">{a.connected && <button className="btn os-hub-btn os-hub-primary" onClick={() => activate(a)}>Set active account</button>}<button className="btn os-hub-btn" onClick={() => call("Review permissions")}><ShieldCheck size={15} /> Review permissions</button>{a.broker !== "paper" && <><button className="btn os-hub-btn" onClick={() => call("Rotate credentials")}><KeyRound size={15} /> Rotate credentials</button><button className="btn os-hub-btn" onClick={() => call("Disconnect")}><Unplug size={15} /> Review disconnect</button></>}</div>
      </>}
      {tab === "Symbols" && <MappingTable accounts={[a]} preferred={a.id} inline />}
      {tab === "Health" && <><StateNote>{a.broker === "paper" ? "Local simulator; quotes are static." : "Broker access is offline. The values below are labeled fixtures, not a health check."}</StateNote>{adapter && <dl className="os-hub-dl"><div><dt>Session</dt><dd>{adapter.ws}</dd></div><div><dt>p50 / p95 latency (sample)</dt><dd>{adapter.p50} / {adapter.p95} ms</dd></div><div><dt>Clock skew</dt><dd>Not measured</dd></div><div><dt>Last incident</dt><dd>{adapter.error || "None in the sample"}</dd></div></dl>}<div className="os-hub-actions"><button className="btn os-hub-btn os-hub-primary" onClick={() => call("Run diagnostics")}><Activity size={15} /> Run diagnostics</button><button className="btn os-hub-btn" onClick={() => call("Reconnect")}><RefreshCw size={15} /> Reconnect</button></div></>}
      {tab === "Finance" && <div className="os-hub-flow"><StateNote>Financial capability previews only. This hub never initiates a payment or transfer.</StateNote><CapabilityTags broker={a.broker} details /><div className="os-hub-actions"><Link className="btn os-hub-btn" to="/dashboard/deposits"><ArrowDownToLine size={15} /> Deposits</Link><Link className="btn os-hub-btn" to="/dashboard/withdrawals"><ArrowUpRight size={15} /> Withdrawals</Link><Link className="btn os-hub-btn" to="/dashboard/transfers"><ArrowLeftRight size={15} /> Transfers</Link></div><div className="os-hub-list">{!data.finance.length ? <Empty>No sample funding activity for this account.</Empty> : data.finance.map((f) => <div className="os-hub-list-item" key={f.id}><span><strong>{f.kind} · {f.rail}</strong><small>{eatDate(f.at)} EAT · {f.id}</small></span><strong>{dollars(f.amount, f.currency)}</strong><Chip tone="neutral">{f.status}</Chip></div>)}</div></div>}
      {tab === "History sync" && <><dl className="os-hub-dl"><div><dt>Coverage window</dt><dd>{data.history.from ? `${data.history.from} to ${data.history.to}` : "No history snapshot"}</dd></div><div><dt>Last review / sample backfill</dt><dd>{data.history.last ? `${eatDate(data.history.last)} EAT` : "Not run"}</dd></div></dl><StateNote>{a.broker === "paper" ? "Re-sync checks closed trades in this local session." : "Broker backfill and first sync run only when the backend is connected."}</StateNote><div className="os-hub-actions"><button className="btn os-hub-btn os-hub-primary" onClick={() => call("Re-sync history")}><RefreshCw size={15} /> Re-sync history</button><Link className="btn os-hub-btn" to="/dashboard/records">Trade records <ArrowUpRight size={14} /></Link></div></>}
      {tab === "Audit" && <AuditTable accounts={[a]} data={data.audit} />}
    </>}
    </div>
  </Dialog>;
}
