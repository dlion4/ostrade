import { useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle, Calendar as CalendarIcon, Copy, Eye, Info, LayoutGrid, List, Pause, Pencil, Play, Search, Timer, Trash2, X, Zap, BarChart3, BookOpen, ShieldCheck, Upload, CheckCircle2, ArrowUpDown, Wand2
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import { BrokerBadge } from "@/components/DashboardShell";
import { getAccounts } from "@/services/dashboard";
import { getMarketUniverse } from "@/services/markets";
import {
  getAllExecutions, getCalendarDays, getSchedulerKpis, getSchedulerSchedules, getScheduleExecutions, getTimelineEvents,
  parseBulkPaste, createSingleSchedule, createBulkSchedules, updateScheduleStatus, runScheduleNow, deleteSchedule, duplicateSchedule,
  type SchedulerSchedule
} from "@/services/scheduler";
import css from "@/styles/pages/dash-scheduler.css?inline";

function Skel({ h=18, w="100%"}: {h?:number,w?:string|number}){ return <span className="os-skel" style={{height:h,width:w}} aria-hidden />}

function TriggerBadge({ t }: { t: SchedulerSchedule["trigger"] }) {
  const map: Record<string,string> = { one_time: "One-time", cron: "Cron", interval: "Interval", session: "Session", price: "Price", indicator: "Indicator" };
  return <span className={`os-trg is-${t}`}>{map[t] || t}</span>;
}
function StatusBadge({ s }: { s: SchedulerSchedule["status"] }) {
  const icons: Record<string,string> = { armed: "● Armed", paused: "◐ Paused", completed: "✓ Completed", failed: "✕ Failed", expired: "◌ Expired" };
  return <span className={`os-status is-${s}`}>{icons[s]}</span>;
}

export function DashSchedulerPage() {
  const { recordSource } = useSearch({ from: "/dashboard/scheduler" });
  usePageStyle("dash-scheduler", css);
  const toast = useToast();
  const qc = useQueryClient();

  const [calendarMode, setCalendarMode] = useState<"month"|"week">("month");
  const [tableView, setTableView] = useState<"table"|"cards">("table");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTrigger, setFilterTrigger] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const [search, setSearch] = useState(recordSource ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"nextFire"|"name">("nextFire");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SchedulerSchedule|null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [timelineHover, setTimelineHover] = useState<string|null>(null);
  const [logScheduleId, setLogScheduleId] = useState<string>(recordSource ?? "sch-001");

  // Builder form state
  const [form, setForm] = useState<any>({
    trigger: "one_time", name: "", symbol: "EURUSD", side: "BUY", size: "0.10 lots", accountId: "acc-paper-main", accountLabel: "Paper Main",
    fireAt: "2025-03-20 10:00", cron: "0 */2 * * *", intervalN: "15", intervalUnit: "minutes", windowStart: "10:00", windowEnd: "19:00",
    session: "london", priceSymbol: "XAUUSD", priceCond: "crosses_below", priceVal: "2380", indicatorSymbol: "EURUSD", indicatorCond: "rsi < 30", indicatorTf: "15m",
    expiry: "never", expiryDate: "2025-03-25", expirySkips: "3", maxFailures: "3", sl: "20 pips", tp: "40 pips", tags: ""
  });

  const kpiQ = useQuery({ queryKey: ["scheduler-kpis"], queryFn: getSchedulerKpis });
  const schedulesQ = useQuery({ queryKey: ["scheduler-list", filterStatus, filterTrigger, filterAccount, search], queryFn: () => getSchedulerSchedules({ status: filterStatus, trigger: filterTrigger, account: filterAccount, search }) });
  const calQ = useQuery({ queryKey: ["scheduler-calendar"], queryFn: getCalendarDays });
  const timelineQ = useQuery({ queryKey: ["scheduler-timeline"], queryFn: getTimelineEvents });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const marketsQ = useQuery({ queryKey: ["market-universe"], queryFn: getMarketUniverse });
  const logQ = useQuery({ queryKey: ["scheduler-log", logScheduleId], queryFn: () => getScheduleExecutions(logScheduleId) });
  const allExecQ = useQuery({ queryKey: ["scheduler-all-exec"], queryFn: getAllExecutions });

  useEffect(() => { if (recordSource) document.getElementById("sched-table")?.scrollIntoView(); }, [recordSource]);

  const schedules = schedulesQ.data ?? [];
  const sortedSchedules = useMemo(()=> {
    const arr=[...schedules];
    if(sortBy==="name") arr.sort((a,b)=>a.name.localeCompare(b.name));
    else arr.sort((a,b)=>a.nextFireSort - b.nextFireSort);
    return arr;
  }, [schedules, sortBy]);

  const toggleSelect = (id:string)=> setSelected(s=> s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);

  const bulkAction = async (action: "pause"|"resume"|"delete")=>{
    if(selected.length===0){ toast("Select at least one schedule."); return;}
    for(const id of selected){
      if(action==="pause") await updateScheduleStatus(id,"paused");
      if(action==="resume") await updateScheduleStatus(id,"armed");
      if(action==="delete") await deleteSchedule(id);
    }
    qc.invalidateQueries({queryKey:["scheduler-list"]}); qc.invalidateQueries({queryKey:["scheduler-kpis"]});
    toast(action==="delete"? `Deleted ${selected.length} schedules` : `${action} ${selected.length} schedules`);
    setSelected([]);
  };

  const handleStatusToggle = async (s: SchedulerSchedule)=>{
    const next = s.status==="armed" ? "paused" : "armed";
    const res = await updateScheduleStatus(s.id, next as any);
    qc.invalidateQueries({queryKey:["scheduler-list"]}); qc.invalidateQueries({queryKey:["scheduler-kpis"]});
    toast(res.message);
  };
  const handleRunNow = async (s:SchedulerSchedule)=>{
    const res = await runScheduleNow(s.id);
    toast(res.message);
    qc.invalidateQueries({queryKey:["scheduler-log"]}); qc.invalidateQueries({queryKey:["scheduler-all-exec"]});
  };
  const handleDelete = async (id:string)=>{
    const res = await deleteSchedule(id);
    qc.invalidateQueries({queryKey:["scheduler-list"]}); qc.invalidateQueries({queryKey:["scheduler-kpis"]});
    toast(res.message);
  };
  const handleDuplicate = async (id:string)=>{
    const res = await duplicateSchedule(id);
    qc.invalidateQueries({queryKey:["scheduler-list"]}); qc.invalidateQueries({queryKey:["scheduler-kpis"]});
    toast(res.message);
  };

  const openEdit = (s:SchedulerSchedule)=>{
    setEditing(s);
    setForm((f:any)=> ({...f, name:s.name, symbol:s.symbol, side:s.side, size:s.size, trigger:s.trigger, triggerDetail:s.triggerDetail, accountId:s.accountId, accountLabel:s.accountLabel, sl:s.sl, tp:s.tp }));
    setDrawerOpen(true);
  };
  const openCreate = ()=>{
    setEditing(null);
    setForm((f:any)=> ({...f, name:"", symbol:"EURUSD", side:"BUY", trigger:"one_time", triggerDetail:""}));
    setDrawerOpen(true);
  };

  const handleCreate = async ()=>{
    if(!form.symbol || !form.side) { toast("Symbol and side required."); return; }
    const brokerMap: Record<string, any> = { "acc-paper-main": {b:"paper", l:"OStrade Paper"}, "acc-exness-trial": {b:"exness", l:"Exness MT5"}, "acc-deriv-demo": {b:"deriv", l:"Deriv"} };
    const bm = brokerMap[form.accountId] || {b:"paper", l:form.accountLabel};
    const res = await createSingleSchedule({
      name: form.name, trigger: form.trigger, triggerDetail: form.triggerDetail || (form.trigger==="one_time"? form.fireAt : form.trigger==="cron"? form.cron : form.trigger==="interval"? `every ${form.intervalN}${form.intervalUnit} ${form.windowStart}-${form.windowEnd}` : form.trigger==="session"? form.session : form.trigger==="price"? `if ${form.priceCond} ${form.priceVal}` : `if ${form.indicatorCond}`),
      accountId: form.accountId, accountLabel: form.accountLabel, broker: bm.b, brokerLabel: bm.l,
      symbol: form.symbol, side: form.side, size: form.size, sl: form.sl, tp: form.tp, expiry: form.expiry, tags: form.tags? form.tags.split(",").map((t:string)=>t.trim()).filter(Boolean) : []
    });
    toast(res.message);
    if(res.ok){ qc.invalidateQueries({queryKey:["scheduler-list"]}); qc.invalidateQueries({queryKey:["scheduler-kpis"]}); setDrawerOpen(false);}
  };

  // Bulk paste state
  const [bulkText, setBulkText] = useState("R_10 RISE 5usd ticks 3 every 15min london\nEURUSD BUY 0.1 SL 20p TP 40p at NY-open\nXAUUSD SELL 0.2 if crosses_below 2380");
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const doParseBulk = async ()=>{
    const parsed = await parseBulkPaste(bulkText);
    setBulkPreview(parsed);
  };
  const doCreateBulk = async ()=>{
    const res = await createBulkSchedules(bulkPreview);
    toast(res.message);
    if(res.ok){ qc.invalidateQueries({queryKey:["scheduler-list"]}); qc.invalidateQueries({queryKey:["scheduler-kpis"]}); setBulkOpen(false); setBulkText(""); setBulkPreview([]);}
  };

  useEffect(()=>{ document.title = "Scheduler (T-6) · OStrade"; },[]);

  return (
    <main className="page-dash-scheduler">
      {/* HEADER */}
      <div className="os-page-head">
        <div>
          <div className="os-eyebrow">T-6 · TRADE SCHEDULER</div>
          <h1 className="os-h1">Trade Scheduler</h1>
          <p className="os-lead">Set-and-forget executions. Up to 50 concurrent schedules — one-time, session, price and indicator triggers. <span className="os-badge-cap">MAX 50 · 20 at a go</span></p>
        </div>
        <div className="os-head-actions">
          <button className="os-btn os-btn-ghost" onClick={()=>setBulkOpen(true)}><Upload size={16}/> Bulk Paste (20)</button>
          <button className="os-btn os-btn-primary" onClick={openCreate}><CalendarIcon size={16}/> New Schedule</button>
        </div>
      </div>

      {/* S1 KPI ROW */}
      <section className="os-section">
        <div className="os-kpi-grid">
          {kpiQ.isPending ? Array.from({length:5}).map((_,i)=><div key={i} className="os-kpi"><Skel h={60}/></div>) :
            <>
              <div className="os-kpi is-highlight" onClick={()=>document.getElementById("sched-table")?.scrollIntoView({behavior:"smooth"})}>
                <div className="os-kpi-icon"><Zap size={18}/></div>
                <div className="os-kpi-label">Active schedules</div>
                <div className="os-kpi-value">{kpiQ.data?.active} <span>/ {kpiQ.data?.total}</span></div>
                <div className="os-kpi-sub">20 at a go supported; cap 50</div>
                <div className="os-kpi-bar"><span style={{width: `${(kpiQ.data!.active/50)*100}%`}}/></div>
              </div>
              <div className="os-kpi">
                <div className="os-kpi-icon is-cyan"><Timer size={18}/></div>
                <div className="os-kpi-label">Next firing</div>
                <div className="os-kpi-value os-mono">{kpiQ.data?.nextFiring}</div>
                <div className="os-kpi-sub">XAUUSD London Scalp — 19:00 EAT</div>
              </div>
              <div className="os-kpi">
                <div className="os-kpi-icon is-green"><CheckCircle2 size={18}/></div>
                <div className="os-kpi-label">Fired today</div>
                <div className="os-kpi-value">{kpiQ.data?.firedToday}</div>
                <div className="os-kpi-sub">Across 4 accounts</div>
              </div>
              <div className="os-kpi">
                <div className="os-kpi-icon is-violet"><BarChart3 size={18}/></div>
                <div className="os-kpi-label">Success rate 7d</div>
                <div className="os-kpi-value">{kpiQ.data?.successRate}</div>
                <div className="os-kpi-sub">Fired 142 · 8 retries</div>
              </div>
              <div className="os-kpi is-warn">
                <div className="os-kpi-icon is-amber"><AlertTriangle size={18}/></div>
                <div className="os-kpi-label">Failed 7d</div>
                <div className="os-kpi-value">{kpiQ.data?.failed7d}</div>
                <div className="os-kpi-sub">{kpiQ.data?.retryDepth}</div>
              </div>
            </>
          }
        </div>
      </section>

      {/* S8 QUICK ACTIONS / TEMPLATES */}
      <section className="os-section">
        <div className="os-templates">
          <div className="os-template">
            <div className="os-tpl-icon"><CalendarIcon size={20}/></div>
            <div><strong>London Open Breakout</strong><span>Buy EURUSD at London open with tight SL</span></div>
            <button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>{setForm((f:any)=>({...f, trigger:"session", session:"london", symbol:"EURUSD", side:"BUY", size:"0.10 lots", name:"London Open Breakout"})); setDrawerOpen(true);}}>Use template</button>
          </div>
          <div className="os-template">
            <div className="os-tpl-icon is-amber"><ShieldCheck size={20}/></div>
            <div><strong>NY Volatility Guard</strong><span>Pause XAUUSD 15m around CPI</span></div>
            <button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>toast("Template: NY Volatility Guard — Ready — executes when the backend is connected")}>Use template</button>
          </div>
          <div className="os-template">
            <div className="os-tpl-icon is-cyan"><BarChart3 size={20}/></div>
            <div><strong>RSI Mean Reversion</strong><span>Buy EURUSD when RSI(14) &lt; 30</span></div>
            <button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>{setForm((f:any)=>({...f, trigger:"indicator", indicatorCond:"rsi < 30", symbol:"EURUSD"})); setDrawerOpen(true);}}>Use template</button>
          </div>
          <div className="os-template">
            <div className="os-tpl-icon is-violet"><Zap size={20}/></div>
            <div><strong>Synthetic Accumulator</strong><span>R_75 accumulator every evening</span></div>
            <button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>{setForm((f:any)=>({...f, trigger:"cron", cron:"30 18 * * 1-5", symbol:"R_75", size:"2 USD stake"})); setDrawerOpen(true);}}>Use template</button>
          </div>
        </div>
      </section>

      {/* S2 CALENDAR VIEW */}
      <section className="os-section">
        <div className="os-card">
          <div className="os-card-head">
            <h2><CalendarIcon size={18}/> Calendar · EAT</h2>
            <div className="os-card-actions">
              <div className="os-seg">
                <button className={calendarMode==="month"?"is-active":""} onClick={()=>setCalendarMode("month")}>Month</button>
                <button className={calendarMode==="week"?"is-active":""} onClick={()=>setCalendarMode("week")}>Week</button>
              </div>
              <span className="os-legend"><span className="os-dot is-interval"/> Interval <span className="os-dot is-session"/> Session <span className="os-dot is-price"/> Price</span>
            </div>
          </div>
          <div className="os-calendar">
            <div className="os-cal-header"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
            <div className="os-cal-grid">
              {calQ.isPending ? Array.from({length:14}).map((_,i)=><div key={i} className="os-cal-cell"><Skel h={80}/></div>) :
                calQ.data!.map(day=>(
                <div key={day.date} className={`os-cal-cell ${day.isToday?"is-today":""} ${day.isWeekend?"is-weekend":""} ${day.count===0?"is-empty":""}`} onClick={()=>toast(`Calendar: ${day.date} — ${day.count} schedules. Drag-to-reschedule is preview-only in frontend mode.`)}>
                  <div className="os-cal-date">{day.label}{day.isToday&&<span className="os-today-badge">Today</span>}</div>
                  <div className="os-cal-dots">
                    {day.dots.map((d,i)=><span key={i} className={`os-cal-dot is-${d.trigger}`} title={`${d.symbol} · ${d.trigger}`}><span className="os-cal-dot-sym">{d.symbol}</span></span>)}
                  </div>
                  {day.count>0 && <div className="os-cal-count">{day.count} {day.count===1?"schedule":"schedules"}</div>}
                  {day.isWeekend && day.count===0 && <div className="os-cal-shade">Weekend — synthetics only</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="os-session-bands"><span className="os-band is-london">London 10:00–19:00</span><span className="os-band is-ny">NY 16:00–01:00</span><span className="os-band is-overlap">Overlap 16:00–20:00</span></div>
        </div>
      </section>

      {/* S3 SCHEDULES TABLE */}
      <section className="os-section" id="sched-table">
        <div className="os-card">
          <div className="os-card-head">
            <h2><LayoutGrid size={18}/> Schedules <span className="os-count">{schedules.length} / 50</span></h2>
            <div className="os-card-actions">
              <div className="os-view-seg">
                <button className={tableView==="table"?"is-active":""} onClick={()=>setTableView("table")}><List size={16}/></button>
                <button className={tableView==="cards"?"is-active":""} onClick={()=>setTableView("cards")}><LayoutGrid size={16}/></button>
              </div>
              <div className="os-search">
                <Search size={14}/><input placeholder="Search name, symbol, account" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="all">All status</option><option value="armed">Armed</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="expired">Expired</option></select>
              <select value={filterTrigger} onChange={e=>setFilterTrigger(e.target.value)}><option value="all">All triggers</option><option value="one_time">One-time</option><option value="cron">Cron</option><option value="interval">Interval</option><option value="session">Session</option><option value="price">Price</option><option value="indicator">Indicator</option></select>
              <select value={filterAccount} onChange={e=>setFilterAccount(e.target.value)}><option value="all">All accounts</option>{accountsQ.data?.map(a=> <option key={a.id} value={a.id}>{a.label}</option>)}</select>
            </div>
          </div>

          {selected.length>0 && (
            <div className="os-bulk-bar">
              <span>{selected.length} selected</span>
              <button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>bulkAction("pause")}><Pause size={14}/> Pause</button>
              <button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>bulkAction("resume")}><Play size={14}/> Resume</button>
              <button className="os-btn os-btn-ghost os-btn-sm is-danger" onClick={()=>bulkAction("delete")}><Trash2 size={14}/> Delete</button>
              <button className="os-btn os-btn-text os-btn-sm" onClick={()=>setSelected([])}><X size={14}/> Clear</button>
            </div>
          )}

          {schedulesQ.isPending ? <div className="os-table-wrap"><Skel h={300}/></div> :
            schedules.length===0 ? <div className="os-empty"><CalendarIcon size={32}/><h3>No schedules match filters</h3><p>Try adjusting filters or create a new schedule.</p><button className="os-btn os-btn-primary os-btn-sm" onClick={()=>{setFilterStatus("all"); setFilterTrigger("all"); setFilterAccount("all"); setSearch("");}}>Reset filters</button></div> :
            tableView==="cards" ? (
              <div className="os-card-grid">
                {sortedSchedules.map(s=>(
                  <div key={s.id} className="os-sched-card">
                    <div className="os-sched-card-top"><TriggerBadge t={s.trigger}/><StatusBadge s={s.status}/><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleSelect(s.id)}/></div>
                    <h3>{s.name}</h3><div className="os-sched-meta"><span>{s.symbol} · {s.side} {s.size}</span><span>{s.accountLabel}</span></div>
                    <div className="os-sched-trig">{s.triggerDetail}</div>
                    <div className="os-sched-foot"><span className="os-mono">{s.nextFire}</span><span className={`os-last is-${s.lastResultTone}`}>{s.lastResult}</span></div>
                    <div className="os-sched-actions"><button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>handleStatusToggle(s)}>{s.status==="armed"?<Pause size={14}/>:<Play size={14}/>} {s.status==="armed"?"Pause":"Resume"}</button><button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>openEdit(s)}><Pencil size={14}/></button><button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>handleDelete(s.id)}><Trash2 size={14}/></button></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="os-table-wrap">
                <table className="os-table">
                  <thead><tr>
                    <th><input type="checkbox" checked={selected.length===schedules.length && schedules.length>0} onChange={e=> setSelected(e.target.checked? schedules.map(s=>s.id): [])}/></th>
                    <th>Name <button className="os-sort" onClick={()=>setSortBy(sortBy==="name"?"nextFire":"name")}><ArrowUpDown size={12}/></button></th>
                    <th>Trigger</th><th>Account</th><th>Instrument</th><th>Action+Size</th><th>SL/TP</th><th>Status</th><th>Next fire <button className="os-sort" onClick={()=>setSortBy(sortBy==="nextFire"?"name":"nextFire")}><ArrowUpDown size={12}/></button></th><th>Last result</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {sortedSchedules.map(s=>(
                      <tr key={s.id} className={selected.includes(s.id)?"is-selected":""}>
                        <td><input type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleSelect(s.id)}/></td>
                        <td><div className="os-name"><strong>{s.name}</strong><span className="os-ref">{s.ref}</span></div></td>
                        <td><TriggerBadge t={s.trigger}/><div className="os-trigger-detail">{s.triggerDetail}</div></td>
                        <td><BrokerBadge broker={s.broker} label={s.brokerLabel}/><div className="os-acc">{s.accountLabel}</div></td>
                        <td><span className="os-symbol">{s.symbol}</span></td>
                        <td><span className={`os-side is-${s.side.toLowerCase()}`}>{s.side}</span> {s.size}</td>
                        <td className="os-mono os-stp">{s.sl} / {s.tp}</td>
                        <td><StatusBadge s={s.status}/></td>
                        <td className="os-mono">{s.nextFire}</td>
                        <td><span className={`os-last is-${s.lastResultTone}`}>{s.lastResult}</span></td>
                        <td>
                          <div className="os-row-actions">
                            <button title={s.status==="armed"?"Pause":"Resume"} onClick={()=>handleStatusToggle(s)}>{s.status==="armed"?<Pause size={14}/>:<Play size={14}/>}</button>
                            <button title="Run now" onClick={()=>handleRunNow(s)}><Zap size={14}/></button>
                            <button title="Edit" onClick={()=>openEdit(s)}><Pencil size={14}/></button>
                            <button title="Duplicate" onClick={()=>handleDuplicate(s.id)}><Copy size={14}/></button>
                            <button title="Delete" className="is-danger" onClick={()=>handleDelete(s.id)}><Trash2 size={14}/></button>
                            <button title="View log" onClick={()=>setLogScheduleId(s.id)}><Eye size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          <div className="os-table-foot">
            <span>{schedules.length} schedules · {schedules.filter(s=>s.status==="armed").length} armed · {schedules.filter(s=>s.status==="paused").length} paused</span>
            <span className="os-cap">Cap 50 · {schedules.length}/50 used</span>
          </div>
        </div>
      </section>

      {/* S5 BULK PASTE BUILDER — the 20-at-a-go power tool */}
      <section className="os-section">
        <div className="os-card">
          <div className="os-card-head">
            <h2><Upload size={18}/> Bulk Paste Builder <span className="os-badge is-live">20 at a go · Cap 50</span></h2>
            <button className="os-btn os-btn-primary os-btn-sm" onClick={()=>setBulkOpen(true)}><Upload size={14}/> Open Bulk Builder</button>
          </div>
          <p className="os-lead" style={{marginBottom: '.8rem'}}>Paste 20 schedule lines at once — grammar is superset of signal parser + schedule clauses. Preview validates each line, highlights inline errors, then creates all with one toast.</p>
          <div className="os-bulk-preview-grid">
            <div className="os-bulk-col">
              <h4>Try these examples</h4>
              <div className="os-example-box is-inline">
                {["R_10 RISE 5usd ticks 3 every 15min london","EURUSD BUY 0.1 SL 20p TP 40p at NY-open","XAUUSD SELL 0.2 if crosses_below 2380","BTCUSDT BUY 0.05 if rsi14_15m < 30","US30 BUY 0.1 SL 30p TP 60p cron 0 9 * * 1-5"].map(ex=> <code key={ex} onClick={()=>setBulkText(prev=> prev? prev+"\n"+ex : ex)} title="Click to add to bulk paste">{ex} <span className="os-add">+ add</span></code>)}
              </div>
            </div>
            <div className="os-bulk-col">
              <h4>How it works</h4>
              <ul className="os-steps-list">
                <li><span>1</span> Paste up to 20 lines in the builder</li>
                <li><span>2</span> Click <strong>Parse Preview</strong> — errors highlight inline</li>
                <li><span>3</span> Fix or drop rows, then <strong>Create All</strong></li>
                <li><span>4</span> Single BullMQ batch → refs OS-SCH-XXXX each</li>
              </ul>
              <div className="os-cap-indicator"><span style={{width:`${(schedules.length/50)*100}%`}}/> <em>{schedules.length} / 50 slots used</em></div>
            </div>
          </div>
        </div>
      </section>

      {/* S6 NEXT 24H TIMELINE */}
      <section className="os-section">
        <div className="os-card">
          <div className="os-card-head">
            <h2><Timer size={18}/> Next 24 Hours · EAT</h2>
            <span className="os-legend">Hover for details · Click for drawer · Timeline is static snapshot</span>
          </div>
          <div className="os-timeline">
            <div className="os-tl-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>00:00</span></div>
            <div className="os-tl-track">
              {timelineQ.data?.map(ev=>(
                <div key={ev.id} className={`os-tl-dot is-${ev.status}`} style={{ left: `${(ev.hour/24)*100}%` }} onMouseEnter={()=>setTimelineHover(ev.id)} onMouseLeave={()=>setTimelineHover(null)} onClick={()=>toast(`Timeline: ${ev.detail} — ${ev.time}. Open schedule drawer via calendar or table.`)} title={`${ev.detail} · ${ev.time}`}>
                  <span className="os-tl-sym">{ev.symbol}</span><span className={`os-tl-side is-${ev.side.toLowerCase()}`}>{ev.side==="BUY"?"▲":"▼"}</span>
                  {timelineHover===ev.id && <div className="os-tooltip"><strong>{ev.detail}</strong><span>{ev.time} · {ev.status}</span><span className="os-mono">{ev.detail}</span></div>}
                </div>
              ))}
              <div className="os-tl-now" style={{left: "68.5%"}}><span>Now 16:42 EAT</span></div>
            </div>
            <div className="os-tl-lanes">
              <div className="os-lane"><span className="os-lane-label">Scheduled fires</span><span className="os-lane-dots">{timelineQ.data?.filter(e=>e.type==="scheduled").map(e=> <span key={e.id} className="os-lane-dot is-armed" title={e.detail}>{e.symbol}</span>)}</span></div>
              <div className="os-lane is-waiting"><span className="os-lane-label">Waiting for condition</span><span className="os-lane-dots">{timelineQ.data?.filter(e=>e.type==="waiting").map(e=> <span key={e.id} className="os-lane-dot is-waiting" title={e.detail}>{e.symbol} · {e.detail.split("→")[1]||e.detail}</span>)}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* S7 EXECUTION LOG */}
      <section className="os-section">
        <div className="os-card">
          <div className="os-card-head">
            <h2><BarChart3 size={18}/> Execution Log <span className="os-count">{logScheduleId}</span></h2>
            <div className="os-card-actions">
              <select value={logScheduleId} onChange={e=>setLogScheduleId(e.target.value)}>
                {schedules.map(s=> <option key={s.id} value={s.id}>{s.name} — {s.ref}</option>)}
              </select>
              <button className="os-btn os-btn-ghost os-btn-sm" onClick={()=>{
                const rows = allExecQ.data ?? [];
                const csv = ["firedAt,conditionSnapshot,orderRef,brokerResponse,retryCount,pnl", ...rows.map(r=> `${r.firedAt},"${r.conditionSnapshot}",${r.orderRef},"${r.brokerResponse}",${r.retryCount},${r.pnl}`)].join("\n");
                const blob = new Blob([csv], {type:"text/csv"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="scheduler-executions.csv"; a.click(); URL.revokeObjectURL(url); toast("CSV exported — frontend-only snapshot");
              }}><BarChart3 size={14}/> Export CSV</button>
            </div>
          </div>
          <div className="os-log-stats">
            <div className="os-log-stat"><span>Fired</span><strong>24</strong></div>
            <div className="os-log-stat"><span>Missed/Skipped</span><strong>3</strong></div>
            <div className="os-log-stat"><span>Avg latency</span><strong>420 ms</strong></div>
            <div className="os-log-stat is-warn"><span>Failure pattern</span><strong>Margin guard on XAUUSD 2×</strong></div>
          </div>
          <div className="os-table-wrap">
            <table className="os-table">
              <thead><tr><th>Fired at</th><th>Condition snapshot</th><th>Order ref</th><th>Broker response</th><th>Retry</th><th>P&L</th></tr></thead>
              <tbody>
                {logQ.isPending ? <tr><td colSpan={6}><Skel h={80}/></td></tr> :
                  logQ.data!.map(row=>(
                  <tr key={row.id}>
                    <td className="os-mono">{row.firedAt}</td>
                    <td>{row.conditionSnapshot}</td>
                    <td className="os-mono">{row.orderRef}</td>
                    <td><span className={`os-last is-${row.brokerTone}`}>{row.brokerResponse}</span></td>
                    <td>{row.retryCount}</td>
                    <td className={`os-mono is-${row.pnlTone}`}>{row.pnl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* EXTRA: HELP */}
      <section className="os-section">
        <div className="os-help-grid">
          <div className="os-help-card">
            <h3><BookOpen size={18}/> How scheduling works</h3>
            <ul>
              <li><strong>Up to 50 schedules</strong> — design floor guarantees 20-at-a-go bulk paste. UI always shows n/50 and blocks overflow.</li>
              <li>All times are <strong>EAT (UTC+3)</strong>. Calendar and timeline respect London/NY/Overlap sessions.</li>
              <li>Price/indicator triggers show <em>waiting for condition</em> until snapshot crosses. Hover to see distance.</li>
              <li>Every fire writes a receipt: filled/rejected/timeout with retry count and P&L when closed.</li>
            </ul>
          </div>
          <div className="os-help-card is-accent">
            <h3><ShieldCheck size={18}/> Frontend-only honesty</h3>
            <p>Broker execution is inert. Paper schedules simulate locally; live-broker schedules resolve to <em>Ready — executes when the backend is connected</em> with clear badges. No real orders sent.</p>
            <Link to="/how-it-works" className="os-btn os-btn-ghost os-btn-sm">How it works <Wand2 size={14}/></Link>
          </div>
        </div>
      </section>

      {/* DRAWER */}
      {drawerOpen && (
        <div className="os-drawer-backdrop" onClick={()=>setDrawerOpen(false)}>
          <div className="os-drawer" onClick={e=>e.stopPropagation()}>
            <div className="os-drawer-head">
              <h2>{editing ? "Edit Schedule" : "New Schedule"} <span className="os-ref">{editing?.ref || "OS-SCH-XXXX"}</span></h2>
              <button className="os-btn os-btn-text" onClick={()=>setDrawerOpen(false)}><X size={18}/></button>
            </div>
            <div className="os-drawer-body">
              <label>Name<input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g. London Open Breakout"/></label>

              <div className="os-field-row">
                <label>Trigger
                  <select value={form.trigger} onChange={e=>setForm({...form, trigger:e.target.value})}>
                    <option value="one_time">One-time (fire-at)</option>
                    <option value="cron">Cron (expression)</option>
                    <option value="interval">Interval (every N + window)</option>
                    <option value="session">Session (London/NY/Overlap/Asia)</option>
                    <option value="price">Price (crosses / % move / spread)</option>
                    <option value="indicator">Indicator (RSI/EMA/ATR)</option>
                  </select>
                </label>
                <label>Account
                  <select value={form.accountId} onChange={e=>{
                    const acc = accountsQ.data?.find(a=>a.id===e.target.value);
                    if(acc) setForm({...form, accountId:acc.id, accountLabel:acc.label});
                  }}>
                    {accountsQ.data?.map(a=> <option key={a.id} value={a.id}>{a.label} — {a.brokerName}</option>)}
                  </select>
                </label>
              </div>

              {/* per trigger fields */}
              {form.trigger==="one_time" && <label>Fire At (EAT)<input type="datetime-local" value={form.fireAt.replace(" ","T")} onChange={e=>setForm({...form, fireAt:e.target.value.replace("T"," ")})}/></label>}
              {form.trigger==="cron" && <><label>Cron Expression<input value={form.cron} onChange={e=>setForm({...form, cron:e.target.value})} placeholder="0 */2 * * *"/><small className="os-hint">Preview next 5: 18:00, 20:00, 22:00, 00:00, 02:00 EAT (static)</small></label></>}
              {form.trigger==="interval" && <div className="os-field-row"><label>Every<input value={form.intervalN} onChange={e=>setForm({...form, intervalN:e.target.value})}/></label><label>Unit<select value={form.intervalUnit} onChange={e=>setForm({...form, intervalUnit:e.target.value})}><option>minutes</option><option>hours</option></select></label><label>Start<input value={form.windowStart} onChange={e=>setForm({...form, windowStart:e.target.value})}/></label><label>Stop<input value={form.windowEnd} onChange={e=>setForm({...form, windowEnd:e.target.value})}/></label></div>}
              {form.trigger==="session" && <label>Session<select value={form.session} onChange={e=>setForm({...form, session:e.target.value})}><option value="london">London open</option><option value="ny">NY open</option><option value="overlap">London-NY overlap</option><option value="asia">Asia</option><option value="custom">Custom range</option></select></label>}
              {form.trigger==="price" && <div className="os-field-row"><label>Symbol<select value={form.priceSymbol} onChange={e=>setForm({...form, priceSymbol:e.target.value})}>{marketsQ.data?.slice(0,12).map(m=> <option key={m.canonical} value={m.canonical}>{m.canonical}</option>)}</select></label><label>Condition<select value={form.priceCond} onChange={e=>setForm({...form, priceCond:e.target.value})}><option>crosses_above</option><option>crosses_below</option><option>% move since open</option><option>spread &lt;</option></select></label><label>Value<input value={form.priceVal} onChange={e=>setForm({...form, priceVal:e.target.value})}/></label></div>}
              {form.trigger==="indicator" && <div className="os-field-row"><label>Symbol<select value={form.indicatorSymbol} onChange={e=>setForm({...form, indicatorSymbol:e.target.value})}>{marketsQ.data?.slice(0,12).map(m=> <option key={m.canonical} value={m.canonical}>{m.canonical}</option>)}</select></label><label>Condition<select value={form.indicatorCond} onChange={e=>setForm({...form, indicatorCond:e.target.value})}><option>RSI &lt; 30</option><option>RSI &gt; 70</option><option>EMA cross</option><option>ATR spike</option></select></label><label>Timeframe<select value={form.indicatorTf} onChange={e=>setForm({...form, indicatorTf:e.target.value})}><option>15m</option><option>1h</option><option>4h</option><option>1D</option></select></label></div>}

              <div className="os-field-row">
                <label>Instrument<input value={form.symbol} onChange={e=>setForm({...form, symbol:e.target.value.toUpperCase()})} placeholder="EURUSD"/></label>
                <label>Side<select value={form.side} onChange={e=>setForm({...form, side:e.target.value})}><option>BUY</option><option>SELL</option></select></label>
                <label>Size<input value={form.size} onChange={e=>setForm({...form, size:e.target.value})} placeholder="0.10 lots"/></label>
              </div>
              <div className="os-field-row">
                <label>SL<input value={form.sl} onChange={e=>setForm({...form, sl:e.target.value})} placeholder="20 pips"/></label>
                <label>TP<input value={form.tp} onChange={e=>setForm({...form, tp:e.target.value})} placeholder="40 pips"/></label>
                <label>Expiry<select value={form.expiry} onChange={e=>setForm({...form, expiry:e.target.value})}><option value="never">Never</option><option value="at-date">At date</option><option value="after-skips">After N skips</option></select></label>
              </div>
              {form.expiry==="at-date" && <label>Expiry Date<input type="date" value={form.expiryDate} onChange={e=>setForm({...form, expiryDate:e.target.value})}/></label>}
              {form.expiry==="after-skips" && <label>After N skips<input value={form.expirySkips} onChange={e=>setForm({...form, expirySkips:e.target.value})}/></label>}
              <div className="os-field-row">
                <label>Max consecutive failures<input value={form.maxFailures} onChange={e=>setForm({...form, maxFailures:e.target.value})}/><small className="os-hint">Auto-pause after N (default 3)</small></label>
                <label>Tags<input value={form.tags} onChange={e=>setForm({...form, tags:e.target.value})} placeholder="london, scalp"/></label>
              </div>
              <div className="os-drawer-foot">
                <button className="os-btn os-btn-ghost" onClick={()=>setDrawerOpen(false)}>Cancel</button>
                <button className="os-btn os-btn-primary" onClick={handleCreate}>{editing?"Save Changes":"Create Schedule"}</button>
              </div>
              <div className="os-drawer-note"><Info size={14}/> {editing ? "Editing is local preview — backend will reconcile." : "All schedules respect kill-switch. Frontend-only: Paper simulates, live is preview."}</div>
            </div>
          </div>
        </div>
      )}

      {/* BULK PASTE */}
      {bulkOpen && (
        <div className="os-drawer-backdrop" onClick={()=>setBulkOpen(false)}>
          <div className="os-drawer is-wide" onClick={e=>e.stopPropagation()}>
            <div className="os-drawer-head">
              <h2>Bulk Paste Builder <span className="os-badge">20 at a go · Cap 50</span></h2>
              <button className="os-btn os-btn-text" onClick={()=>setBulkOpen(false)}><X size={18}/></button>
            </div>
            <div className="os-drawer-body">
              <p className="os-lead">Paste up to 20 lines. Grammar is superset of signal parser + schedule clauses. Example lines auto-filled below.</p>
              <div className="os-example-box">
                {["R_10 RISE 5usd ticks 3 every 15min london","EURUSD BUY 0.1 SL 20p TP 40p at NY-open","XAUUSD SELL 0.2 if crosses_below 2380"].map(ex=> <code key={ex}>{ex}</code>)}
              </div>
              <textarea className="os-textarea" rows={8} value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder="Paste 20 lines..."/>
              <div className="os-bulk-actions">
                <button className="os-btn os-btn-ghost" onClick={doParseBulk}><Search size={14}/> Parse Preview</button>
                <span className="os-hint">{bulkText.split("\n").filter(Boolean).length} lines · {schedules.length}/50 used</span>
              </div>
              {bulkPreview.length>0 && (
                <>
                  <div className="os-table-wrap">
                    <table className="os-table">
                      <thead><tr><th>#</th><th>Raw</th><th>Parsed</th><th>Status</th></tr></thead>
                      <tbody>
                        {bulkPreview.map((r,i)=>(
                          <tr key={i} className={r.error?"is-error":""}>
                            <td>{i+1}</td>
                            <td className="os-mono small">{r.raw}</td>
                            <td>{r.error ? <span className="os-last is-error">{r.error}</span> : <span>{r.parsed.symbol} {r.parsed.side} {r.parsed.size} · {r.parsed.trigger}</span>}</td>
                            <td>{r.error ? <span className="os-status is-failed">Error</span> : <span className="os-status is-armed">Ready</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="os-bulk-foot">
                    <button className="os-btn os-btn-text" onClick={()=>{setBulkPreview([])}}>Clear</button>
                    <button className="os-btn os-btn-primary" onClick={doCreateBulk} disabled={bulkPreview.filter(r=>!r.error).length===0 || schedules.length + bulkPreview.filter(r=>!r.error).length > 50}>Create All ({bulkPreview.filter(r=>!r.error).length})</button>
                    {schedules.length + bulkPreview.filter(r=>!r.error).length > 50 && <span className="os-last is-error">Would exceed cap 50</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
