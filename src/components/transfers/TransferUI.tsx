import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowLeftRight, Bitcoin, CircleAlert, FlaskConical, Landmark, LockKeyhole, Split, X } from "lucide-react";
import { transferRails, type TransferRail } from "@/services/transfers";
export { amountLabel, downloadBlob, eat, errorText, whole } from "@/components/deposits/DepositUI";
export const transferIcons = {paper:FlaskConical,deriv:Landmark,binance:Bitcoin,mt5:Split,manual:ArrowLeftRight};
export function Badge({ children, tone="neutral" }:{children:ReactNode;tone?:"neutral"|"green"|"orange"|"red"|"blue"|"violet"}) {return <span className={`os-tl-badge os-tl-tone-${tone}`}>{children}</span>;}
export function Busy({children}:{children:ReactNode}) {return <span className="os-tl-busy" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true"/>{children}</span>;}
export function Empty({children}:{children:ReactNode}) {return <div className="os-tl-empty">{children}</div>;}
export function Note({children,danger=false}:{children:ReactNode;danger?:boolean}) {return <div className={`os-tl-note${danger?" os-tl-note-danger":""}`} role={danger?"alert":"status"}>{danger?<CircleAlert size={15}/>:<LockKeyhole size={15}/>}<div>{children}</div></div>;}
export function RailTag({rail}:{rail:TransferRail}) {const Icon=transferIcons[rail];return <span className="os-tl-rail-tag"><Icon size={15}/>{transferRails[rail].title}</span>;}
export function Dialog({title,kicker,close,children,drawer=false,busy=false}:{title:string;kicker:string;close:()=>void;children:ReactNode;drawer?:boolean;busy?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null),id=useId();
  useEffect(()=>{const node=ref.current,focus=document.activeElement as HTMLElement|null; node?.showModal();return()=>{node?.close();if(focus?.isConnected)focus.focus({preventScroll:true});};},[]);
  return <dialog className={`os-tl-dialog${drawer?" os-tl-drawer":""}`} aria-labelledby={id} ref={ref} onCancel={e=>{e.preventDefault();if(!busy)close();}} onClick={e=>{if(!busy&&e.target===e.currentTarget)close();}}><div className="os-tl-dialog-inner"><header><div><span className="os-tl-kicker">{kicker}</span><h2 id={id}>{title}</h2></div><button className="btn os-tl-btn os-tl-square" aria-label="Close dialog" type="button" disabled={busy} onClick={close}><X size={18}/></button></header>{children}</div></dialog>;
}
export function CodeField({value,set,otp=false}:{value:string;set:(v:string)=>void;otp?:boolean}) {const demo=otp?"000000":"123456";return <label className="os-tl-field"><span>{otp?"Example destination OTP":"Example authenticator code (TOTP)"}</span><input className="form-control os-tl-mono" type="text" inputMode="numeric" autoComplete="off" required pattern="[0-9]{6}" maxLength={6} value={value} onChange={e=>set(e.target.value)} placeholder={demo}/><small>Use {demo}. No messages are sent; never enter a real code.</small></label>;}
export const invalidateLedger = ["transfer-ledger","transfer-summary","transfer-recon","finance-audit","finance-statement"];
