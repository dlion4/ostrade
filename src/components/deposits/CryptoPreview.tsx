import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import qrcode from "qrcode-generator";
import { Copy, FlaskConical, ShieldCheck } from "lucide-react";
import { getCryptoPreferences, getDemoAddress, networkProfiles, updateCryptoTolerance, verifyDemoNetwork, type CryptoNetwork } from "@/services/deposits";
import { amountLabel, Badge, Busy, copyText, Empty, errorText, Note } from "./DepositUI";

function DemoQR({ value }: { value: string }) {
  const { size, path } = useMemo(() => {
    const code = qrcode(0, "M"); code.addData(value); code.make();
    const n = code.getModuleCount();
    let path = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (code.isDark(y,x)) path += `M${x+4} ${y+4}h1v1h-1z`;
    return { size: n+8, path };
  }, [value]);
  return <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Non-payable demo QR code" shapeRendering="crispEdges"><rect width={size} height={size} fill="#fff" /><path d={path} fill="#182438" /></svg>;
}
export function CryptoPreview({ network, setNetwork, amount, broker = "binance", compact = false, copyAcknowledged = false }: { network: CryptoNetwork; setNetwork: (network: CryptoNetwork) => void; amount: number; broker?: "binance" | "deriv"; compact?: boolean; copyAcknowledged?: boolean }) {
  const qc = useQueryClient();
  const [model, setModel] = useState(broker);
  const [expired, setExpired] = useState(false);
  const [verify, setVerify] = useState(false);
  const [code, setCode] = useState("");
  const [copyAck, setCopyAck] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<{ underpaid: string; overpaid: string }>();
  const prefs = useQuery({ queryKey: ["deposit-crypto-settings"], queryFn: getCryptoPreferences });
  const q = useQuery({ queryKey: ["deposit-crypto-address", model, network, expired], queryFn: () => getDemoAddress({ broker: model, network, expired }) });
  const verification = useMutation({ mutationFn: verifyDemoNetwork, onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ["deposit-crypto-settings"] }); setVerify(false); setCode(""); setMessage(r.message); } });
  const tolerances = useMutation({ mutationFn: updateCryptoTolerance, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["deposit-crypto-settings"] }); setDraft(undefined); setMessage("Tolerances saved in the local preview. No automatic credit is enabled."); } });
  const verified = prefs.data?.verifiedNetworks.includes(network);
  const preview = q.data;
  const choose = (n: CryptoNetwork) => { setNetwork(n); setCopyAck(false); setVerify(false); setCode(""); setMessage(""); verification.reset(); };
  async function copyAmount() {
    try { await copyText(amount.toFixed(2)); setMessage("Copied the example amount. Do not use it to send funds."); } catch { setMessage(`Clipboard unavailable. Example amount: ${amount.toFixed(2)} USDT.`); }
  }
  return <div className="os-dep-flow">
    <div className="os-dep-actions">{!compact && <select className="form-select form-select-sm" aria-label="Address deposit model" value={model} onChange={(e) => { setModel(e.target.value as typeof model); setCopyAck(false); setMessage(""); }}><option value="binance">Binance · reusable model</option><option value="deriv">Deriv · per-request model</option></select>}
    <div className="os-dep-segments" role="group" aria-label="Crypto network">{networkProfiles.map((n) => <button type="button" key={n.id} aria-pressed={network === n.id} onClick={() => choose(n.id)}>{n.id}</button>)}</div></div>
    <Note danger><strong>Demo only — do not send funds.</strong> The QR encodes a plain-text fixture, not a wallet address. The confirmation counter is a snapshot.</Note>
    {q.isPending ? <Empty><Busy>Preparing local address sample…</Busy></Empty> : q.isError ? <Empty><button className="btn os-dep-btn" type="button" onClick={() => void q.refetch()}>Retry address preview</button></Empty> : preview && <div className="os-dep-crypto-ticket">
      <div className="os-dep-qr">{preview.expired ? <FlaskConical size={34} /> : <DemoQR value={preview.address} />}<span>NOT PAYABLE</span></div>
      <div className="os-dep-flow os-dep-crypto-info"><div className="os-dep-actions"><Badge tone={preview.expired ? "red" : "violet"}>{preview.state}</Badge><Badge>{preview.mode}</Badge><Badge>{verified ? "Demo whitelist verified" : "Not whitelisted"}</Badge></div><code>{preview.expired ? "Expired sample · QR disabled" : preview.address}</code><small>{preview.expires} · {networkProfiles.find((n) => n.id === network)?.feeNote}</small>
      <div className="os-dep-progress-label"><span>Example confirmations</span><strong>{preview.confirmed} / {preview.required}</strong></div><div className="progress" role="progressbar" aria-label="Example confirmations" aria-valuemax={preview.required} aria-valuenow={preview.confirmed}><div className="progress-bar" style={{ width: `${100 * preview.confirmed / preview.required}%` }} /></div></div>
    </div>}
    <div className="os-dep-actions">{!compact && <button type="button" className="btn os-dep-btn" onClick={() => { setExpired(!expired); setCopyAck(false); }}>{expired ? "Restore demo preview" : "Preview expiry warning"}</button>}{(!verified || !compact) && <button type="button" className="btn os-dep-btn" onClick={() => { setVerify(!verify); verification.reset(); }}><ShieldCheck size={15} /> {verified ? "Review demo verification" : "Verify demo whitelist"}</button>}</div>
    {verify && <div className="os-dep-inset os-dep-flow"><p>Future verification uses email and OTP. No email is collected or sent here. Use the example code <strong>000000</strong>.</p><div className="os-dep-actions"><input type="text" className="form-control form-control-sm" aria-label="Demo verification code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /><button type="button" className="btn os-dep-btn" disabled={verification.isPending || prefs.isPending} onClick={() => verification.mutate({ network, code })}>{verification.isPending ? <Busy>Reviewing…</Busy> : "Verify example code"}</button></div>{verification.isError && <Note danger>{errorText(verification.error)}</Note>}</div>}
    {!compact && <label className="os-dep-check"><input type="checkbox" className="form-check-input" checked={copyAck} onChange={(e) => setCopyAck(e.target.checked)} /> I understand this example cannot receive funds.</label>}
    <div className="os-dep-actions"><button className="btn os-dep-btn" type="button" disabled={!preview || expired || !verified || !Number.isFinite(amount) || amount <= 0 || !(copyAck || copyAcknowledged)} onClick={() => void copyAmount()}><Copy size={14} /> Copy example amount · {amountLabel(Number.isFinite(amount) ? amount : 0, "USDT")}</button></div>
    {!compact && <details className="os-dep-inset"><summary>Underpayment / overpayment tolerances</summary><p>Configure the future matching threshold for this preview only.</p><form className="os-dep-flow" onSubmit={(e) => { e.preventDefault(); if (draft && draft.underpaid !== "" && draft.overpaid !== "") tolerances.mutate({ underpaid: Number(draft.underpaid), overpaid: Number(draft.overpaid) }); }}><div className="os-dep-form-grid">{([['underpaid','Underpaid (%)'],['overpaid','Overpaid (%)']] as const).map(([key,label]) => <label className="os-dep-field" key={key}><span>{label}</span><input className="form-control" type="number" required min="0" max="5" step="0.1" value={draft?.[key] ?? prefs.data?.[key] ?? ""} onChange={(e) => setDraft({ underpaid: String(prefs.data?.underpaid ?? ""), overpaid: String(prefs.data?.overpaid ?? ""), ...draft, [key]: e.target.value })} /></label>)}</div><button type="submit" className="btn os-dep-btn" disabled={!draft || tolerances.isPending}>Save demo tolerances</button>{tolerances.isError && <Note danger>{errorText(tolerances.error)}</Note>}</form></details>}
    {message && <Note>{message}</Note>}
  </div>;
}
