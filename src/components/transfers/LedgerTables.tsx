import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, ChevronLeft, ChevronRight, Download, Filter, Search } from "lucide-react";
import { eatDate, exportLedgerEntries, exportTransferHistory, getLedgerEntries, ledgerTypes, transferRails, type FinanceEntryType, type LedgerRow, type TradingAccount, type TransferRecord } from "@/services/transfers";
import { amountLabel, Badge, Busy, Dialog, downloadBlob, eat, Empty, errorText, Note, RailTag } from "./TransferUI";

type Choice={key:string;label:string;options?:[string,string][]};
const dates:Choice[]=[{key:"from",label:"From date (EAT)"},{key:"to",label:"To date (EAT)"}];
const limit=6;
const saveCsv=({filename,text}:{filename:string;text:string})=>downloadBlob(new Blob(["\uFEFF",text],{type:"text/csv;charset=utf-8"}),filename);
const after=(v:number|undefined)=>v===undefined?"—":amountLabel(v);
function Grid<T extends {id:string}>({rows,columns,choices,filters,set,search,setSearch,defaultSort,label,extras,exporter}:{rows:T[];columns:ColumnDef<T>[];choices:Choice[];filters:Record<string,string>;set:(k:string,v:string)=>void;search:string;setSearch:(v:string)=>void;defaultSort:string;label:string;extras?:ReactNode;exporter:(ids:string[])=>Promise<{filename:string;text:string}>}) {
  const [open,setOpen]=useState(false),[sorting,setSorting]=useState<SortingState>([{id:defaultSort,desc:true}]);
  const job=useMutation({mutationFn:exporter,onSuccess:saveCsv});
  const t=useReactTable({data:rows,columns,state:{sorting},onSortingChange:setSorting,getRowId:r=>r.id,getCoreRowModel:getCoreRowModel(),getSortedRowModel:getSortedRowModel(),getPaginationRowModel:getPaginationRowModel(),initialState:{pagination:{pageSize:limit}}});
  const p=t.getState().pagination.pageIndex;
  return <div className="os-tl-card"><div className="os-tl-toolbar"><label className="os-tl-search"><Search size={15}/><input className="form-control" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search names or references…" value={search} onChange={e=>{setSearch(e.target.value);t.setPageIndex(0);}}/></label><div className="os-tl-actions">{extras}<button className="btn os-tl-btn" onClick={()=>setOpen(!open)} aria-expanded={open}><Filter size={15}/> Filters {Object.values(filters).filter(Boolean).length||""}</button><button className="btn os-tl-btn" onClick={()=>job.mutate(t.getSortedRowModel().rows.map(r=>r.original.id))} disabled={!rows.length||job.isPending}><Download size={15}/>{job.isPending?"Preparing…":"Export CSV"}</button></div></div>
    {open&&<div className="os-tl-filters">{choices.map(c=><label key={c.key} className="os-tl-field"><span>{c.label}</span>{c.options?<select className="form-select" value={filters[c.key]??""} onChange={e=>{set(c.key,e.target.value);t.setPageIndex(0);}}><option value="">All</option>{c.options.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>:<input className="form-control" type="date" value={filters[c.key]??""} onChange={e=>{set(c.key,e.target.value);t.setPageIndex(0);}}/>}</label>)}<button className="btn os-tl-btn" onClick={()=>{choices.forEach(c=>set(c.key,""));setSearch("");t.setPageIndex(0);}}>Reset filters</button></div>}
    {job.isError&&<Note danger>{errorText(job.error)}</Note>}
    <div className="os-tl-scroll os-tl-history-scroll" tabIndex={0} role="region" aria-label={label}><table className="table os-tl-table"><thead>{t.getHeaderGroups().map(g=><tr key={g.id}>{g.headers.map(h=><th key={h.id} aria-sort={h.column.getIsSorted()==="asc"?"ascending":h.column.getIsSorted()==="desc"?"descending":undefined}>{h.column.getCanSort()?<button className="os-tl-table-sort" onClick={h.column.getToggleSortingHandler()}>{flexRender(h.column.columnDef.header,h.getContext())}{h.column.getIsSorted()==="asc"?<ArrowUp size={11}/>:h.column.getIsSorted()==="desc"?<ArrowDown size={11}/>:<ArrowUpDown size={10}/>}</button>:flexRender(h.column.columnDef.header,h.getContext())}</th>)}</tr>)}</thead><tbody>{t.getRowModel().rows.map(r=><tr key={r.id}>{r.getVisibleCells().map(c=><td key={c.id}>{flexRender(c.column.columnDef.cell,c.getContext())}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={columns.length}><Empty>No records match these filters.</Empty></td></tr>}</tbody></table></div>
    <div className="os-tl-table-foot"><span>{rows.length?`Showing ${p*limit+1}–${Math.min((p+1)*limit,rows.length)} of ${rows.length} records`:"0 records"}</span><div className="os-tl-actions"><button className="btn os-tl-btn os-tl-square" aria-label="Previous page" disabled={!t.getCanPreviousPage()} onClick={()=>t.previousPage()}><ChevronLeft size={15}/></button><span>{rows.length?p+1:0} / {t.getPageCount()}</span><button className="btn os-tl-btn os-tl-square" aria-label="Next page" disabled={!t.getCanNextPage()} onClick={()=>t.nextPage()}><ChevronRight size={15}/></button></div></div>
  </div>;
}
function useFilters(scope:string) {const [f,setF]=useState<Record<string,string>>({account:scope}),[s,setS]=useState("");return {f,set:(k:string,v:string)=>setF(x=>({...x,[k]:v})),s,setS};}
function matchDate(at:string,f:Record<string,string>) {const d=eatDate(at);return (!f.from||d>=f.from)&&(!f.to||d<=f.to);}
const accountOptions=(a:TradingAccount[]):Choice=>({key:"account",label:"Account",options:a.map(x=>[x.id,x.label])});
export function TransferHistory({rows,accounts,view,scope}:{rows:TransferRecord[];accounts:TradingAccount[];view:(r:TransferRecord)=>void;scope:string}) {
  const {f,set,s,setS}=useFilters(scope);
  const filtered=useMemo(()=>rows.filter(r=>(!f.account||f.account===r.accountId||f.account===r.toAccountId)&&(!f.rail||f.rail===r.rail)&&(!f.status||f.status===r.status)&&matchDate(r.initiatedAt,f)&&`${r.ref} ${r.accountLabel} ${r.toAccountLabel} ${r.ledgerRefs.join(" ")}`.toLowerCase().includes(s.trim().toLowerCase())),[rows,f,s]);
  const columns=useMemo<ColumnDef<TransferRecord>[]>(()=>[
    {accessorKey:"initiatedAt",header:"Initiated · EAT",cell:({row})=><time dateTime={row.original.initiatedAt}>{eat(row.original.initiatedAt)}</time>},
    {accessorKey:"accountLabel",header:"From → To",cell:({row:r})=><><strong>{r.original.accountLabel} → {r.original.toAccountLabel}</strong>{r.original.fromWallet&&<small>{r.original.fromWallet} → {r.original.toWallet}</small>}</>},
    {accessorKey:"rail",header:"Method",cell:({row})=><RailTag rail={row.original.rail}/>},
    {accessorKey:"amountNative",header:"Amount",cell:({row:r})=><strong className="os-tl-mono">{amountLabel(r.original.amountNative,r.original.currencyNative)}</strong>},
    {accessorKey:"fee",header:"FX / fees",cell:({row:r})=><>× {r.original.fxRate.toFixed(4)}<small>{amountLabel(r.original.fee,r.original.currencyNative)} fee</small></>},
    {id:"legs",header:"Legs",cell:({row:r})=><>{r.original.legs.map((l,i)=><small key={l.title}>{i+1}. {l.status}</small>)}</>},
    {accessorKey:"status",header:"Status",cell:({row:r})=><><Badge tone={r.original.status==="Posted"?"green":r.original.origin==="Preview"?"blue":"orange"}>{r.original.status}</Badge><small>{r.original.origin}</small></>},
    {accessorKey:"ref",header:"Combined receipt",cell:({row:r})=><button className="os-tl-link os-tl-mono" onClick={()=>view(r.original)}>{r.original.ref}<ArrowUpRight size={12}/></button>},
  ],[view]);
  const choices=[accountOptions(accounts),{key:"rail",label:"Method",options:Object.entries(transferRails).map(([k,v]):[string,string]=>[k,v.title])},{key:"status",label:"Status",options:["Posted","Offline preview","Awaiting proof"].map((v):[string,string]=>[v,v])},...dates];
  return <Grid rows={filtered} columns={columns} choices={choices} filters={f} set={set} search={s} setSearch={setS} defaultSort="initiatedAt" label="Transfer history" exporter={exportTransferHistory}/>;
}
const accountSide=(side:string,account:string)=>!!account&&(side===account||side.startsWith(`${account}:`));
const entryType=(r:LedgerRow,account:string):FinanceEntryType=>r.txType==="TRANSFER_OUT"&&accountSide(r.creditAccountId,account)&&!accountSide(r.debitAccountId,account)?"TRANSFER_IN":r.txType;
export function LedgerTable({accounts,scope}:{accounts:TradingAccount[];scope:string}) {
  const q=useQuery({queryKey:["transfer-ledger"],queryFn:getLedgerEntries});
  const {f,set,s,setS}=useFilters(scope);
  const [chosen,setChosen]=useState<LedgerRow>();
  const filtered=useMemo(()=>q.data?.rows.filter(r=>(!f.account||accountSide(r.debitAccountId,f.account)||accountSide(r.creditAccountId,f.account))&&(!f.type||entryType(r,f.account)===f.type)&&matchDate(r.postedAt,f)&&`${r.id} ${r.sourceRef} ${r.debitLabel} ${r.creditLabel}`.toLowerCase().includes(s.trim().toLowerCase()))??[],[q.data,f,s]);
  const rowType=(r:LedgerRow)=>entryType(r,f.account);
  const columns:ColumnDef<LedgerRow>[]=[
    {accessorKey:"postedAt",header:"Posted · EAT",cell:({row:r})=><time dateTime={r.original.postedAt}>{eat(r.original.postedAt)}</time>},
    {accessorKey:"txType",header:"Entry type",cell:({row:r})=><Badge tone={r.original.txType==="ADJUSTMENT"?"orange":r.original.origin==="Simulated"?"green":"neutral"}>{ledgerTypes[rowType(r.original)]}</Badge>},
    {accessorKey:"debitLabel",header:"Debit account",cell:({row:r})=><>{r.original.debitLabel}<small>After {after(r.original.debitAfter)}</small></>},
    {accessorKey:"creditLabel",header:"Credit account",cell:({row:r})=><>{r.original.creditLabel}<small>After {after(r.original.creditAfter)}</small></>},
    {accessorKey:"amountUSD",header:"Amount / display",cell:({row:r})=><strong className="os-tl-mono">{amountLabel(r.original.amountNative,r.original.currencyNative??"USD")}<small>{amountLabel(r.original.amountUSD)} USD</small></strong>},
    {id:"balance",header:"Running balance",cell:({row:r})=><span className="os-tl-mono">{after(f.account===r.original.debitAccountId?r.original.debitAfter:f.account===r.original.creditAccountId?r.original.creditAfter:r.original.creditAfter??r.original.debitAfter)}</span>},
    {accessorKey:"sourceRef",header:"Source / entry",cell:({row:r})=><><button className="os-tl-link os-tl-mono" onClick={()=>setChosen(r.original)}>{r.original.sourceRef}<ArrowUpRight size={12}/></button><small>{r.original.id} · {r.original.origin}</small></>},
  ];
  if(q.isPending)return <div className="os-tl-card"><Empty><Busy>Reading ledger…</Busy></Empty></div>;
  if(q.isError)return <div className="os-tl-card"><Empty><button className="btn os-tl-btn" onClick={()=>void q.refetch()}>Retry ledger</button></Empty></div>;
  const i=q.data.integrity;
  return <div className="os-tl-flow"><div className={`os-tl-integrity${i.balanced?"":" os-tl-integrity-failed"}`} role={i.balanced?"status":"alert"}><Badge tone={i.balanced?"green":"red"}>{i.balanced?"Balanced":"Imbalance detected"}</Badge><span>{i.balanced?"Every posting has a debit and a matching credit.":`${i.invalid} posting(s) require review.`}</span><strong>Debits {amountLabel(i.debits)} · Credits {amountLabel(i.credits)}</strong></div>
    <Grid rows={filtered} columns={columns} choices={[accountOptions(accounts),{key:"type",label:"Entry type",options:Object.entries(ledgerTypes)},...dates]} filters={f} set={set} search={s} setSearch={setS} defaultSort="postedAt" label="Double-entry ledger" extras={<Badge>USD running balances</Badge>} exporter={exportLedgerEntries}/>
    {chosen&&<Dialog title={chosen.id} kicker="LEDGER POSTING" close={()=>setChosen(undefined)} drawer><div className="os-tl-flow"><div className="os-tl-actions"><Badge>{ledgerTypes[rowType(chosen)]}</Badge><Badge tone={chosen.origin==="Simulated"?"green":"neutral"}>{chosen.origin}</Badge></div><Note>{chosen.memo}</Note><dl className="os-tl-review">{[["Source reference",chosen.sourceRef],["Posted (EAT)",eat(chosen.postedAt)],["Debit account",chosen.debitLabel],["Debit balance after",after(chosen.debitAfter)],["Credit account",chosen.creditLabel],["Credit balance after",after(chosen.creditAfter)],["Native / USD",`${amountLabel(chosen.amountNative,chosen.currencyNative??"USD")} / ${amountLabel(chosen.amountUSD)}`]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div></Dialog>}
  </div>;
}
