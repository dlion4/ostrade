import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, CircleCheck, FlaskConical, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { addPaperWorkspace, stageBrokerSetup, testBrokerSetup, type BrokerKey, type BrokerSetup, type HubProvider, type TradingAccount } from "@/services/accounts";
import { BrokerMark, Busy, CapabilityTags, Chip, Dialog, StateNote, errorText } from "./AccountUI";

const labels = ["Broker", "Configure", "Review", "Result"];
const permissions = ["Read account", "Place orders", "Read history"];
const brokerServers = Array.from({ length: 12 }, (_, i) => i + 1);
const defaultServer = (broker: BrokerKey, live = false) => broker === "exness" ? `Exness-MT5${live ? "Real" : "Trial"}1` : broker === "icmarkets" ? (live ? "ICMarketsSC-Live01" : "ICMarketsSC-Demo04") : broker === "pepperstone" ? `Pepperstone-MT5-${live ? "Live" : "Demo"}` : `XMGlobal-MT5-${live ? "Live" : "Demo"}`;
export function ConnectWizard({ providers, initial, close, onPaper }: { providers: HubProvider[]; initial?: BrokerKey; close: () => void; onPaper: (account: TradingAccount) => void }) {
  const [broker, setBroker] = useState<BrokerKey>(initial ?? "paper");
  const [step, setStep] = useState(initial ? 1 : 0);
  const [live, setLive] = useState(false);
  const provider = providers.find((p) => p.id === broker)!;
  const paper = broker === "paper", oauth = provider.connect === "OAuth", mt5 = provider.connect === "MT5 login + server";
  const [label, setLabel] = useState(initial ? `${provider.name} ${paper ? "Sandbox" : "Preview"}` : "");
  const [balance, setBalance] = useState("10000");
  const [login, setLogin] = useState("");
  const [server, setServer] = useState(initial ? defaultServer(initial) : "");
  const [customServer, setCustomServer] = useState("");
  const [region, setRegion] = useState("london");
  const [managed, setManaged] = useState(true);
  const [readOnly, setReadOnly] = useState(false);
  const [endpoint, setEndpoint] = useState("sandbox");
  const [oauthPreview, setOAuthPreview] = useState(false);
  const [scopes, setScopes] = useState(permissions);
  const [oneTimeCode, setOneTimeCode] = useState("");
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const test = useMutation({ mutationFn: testBrokerSetup });
  const stage = useMutation({ mutationFn: stageBrokerSetup });
  const create = useMutation({ mutationFn: addPaperWorkspace });
  const pending = test.isPending || stage.isPending || create.isPending;
  const data = (): BrokerSetup => ({ broker, label, environment: live ? "live" : "demo", accountId: login || undefined, server: server === "custom" ? customServer : server, region, endpoint, permissions: scopes, mockTwoFactor: oneTimeCode === "000000" });
  const setEnvironment = (isLive: boolean) => {
    setOneTimeCode(""); setLive(isLive); setEndpoint(isLive ? "live" : "sandbox"); setOAuthPreview(false); setLogin(""); setServer(defaultServer(broker, isLive));
  };
  const pick = (p: HubProvider) => {
    setError(""); setBroker(p.id); setLive(false); setLabel(`${p.name} ${p.id === "paper" ? "Sandbox" : "Preview"}`); setLogin(""); setServer(defaultServer(p.id)); setOAuthPreview(false); setEndpoint("sandbox"); setScopes(permissions); setReadOnly(false); setManaged(true); setCustomServer(""); setRegion("london"); setOneTimeCode(""); setStep(1);
  };
  const configure = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError("");
    if (mt5 && readOnly && scopes.includes("Place orders")) { setError("Investor logins are read-only. Choose Trader, or remove the order permission."); return; }
    if (!paper && oauth && !oauthPreview) { setError("Preview the OAuth handoff and choose a sample account first."); return; }
    try { if (!paper) await test.mutateAsync(data()); setStep(2); } catch (e) { setError(errorText(e)); }
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError("");
    try {
      if (paper) { await create.mutateAsync({ label, startingBalance: Number(balance) }); await qc.invalidateQueries({ queryKey: ["accounts"] }); }
      else await stage.mutateAsync(data());
      void qc.invalidateQueries({ queryKey: ["account-audit"] }); setStep(3);
    } catch (e) { setError(errorText(e)); }
  };
  return <Dialog title="Connect an account" kicker="BROKER CONNECTION WIZARD" close={close}>
    <ol className="os-hub-steps" aria-label="Setup progress">{labels.map((name, i) => <li key={name} aria-current={i === step ? "step" : undefined} className={i < step ? "os-hub-step-done" : ""}><span>{i < step ? <Check size={12} /> : i + 1}</span>{name}</li>)}</ol>
    {step === 0 && <div className="os-hub-flow"><p>Start with the simulator or review an adapter’s native setup. No external broker is contacted here.</p><div className="os-hub-provider-grid">{providers.map((p) => <button className="os-hub-provider" type="button" key={p.id} onClick={() => pick(p)}><BrokerMark broker={p.id} compact /><span><strong>{p.name}</strong><small>{p.connect}</small></span><ArrowRight size={15} /></button>)}</div></div>}
    {step === 1 && <form className="os-hub-flow" key={broker} onSubmit={(e) => void configure(e)}>
      <div className="os-hub-wizard-provider"><BrokerMark broker={broker} /><div><strong>{provider.name}</strong><small>{provider.route} · {provider.connect}</small></div><Chip tone={paper ? "green" : "orange"}>{paper ? "SIMULATED" : "OFFLINE PREVIEW"}</Chip></div>
      {!paper && <StateNote>Use sample values only. Broker credentials, OAuth codes and real 2FA codes are not needed, transmitted, or saved.</StateNote>}
      <div className="os-hub-form-grid"><label className="os-hub-field"><span>Account label</span><input className="form-control" value={label} onChange={(e) => setLabel(e.target.value)} minLength={2} maxLength={40} required /></label>
      {paper ? <label className="os-hub-field"><span>Starting balance (USD)</span><input className="form-control" type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} min="100" max="1000000" required /></label> : <label className="os-hub-field"><span>Environment</span><select className="form-select" value={live ? "live" : "demo"} onChange={(e) => setEnvironment(e.target.value === "live")}><option value="demo">{broker === "binance" ? "Testnet" : broker === "oanda" ? "Practice" : broker === "alpaca" ? "Paper" : "Demo / Trial"}</option><option value="live">Live preview</option></select></label>}</div>
      {paper && <div className="os-hub-inset"><strong>USD simulator</strong><p>Static quotes, local fills, and an OStrade ledger. No payment is required.</p></div>}
      {oauth && <div className="os-hub-inset os-hub-flow"><strong>{provider.name} OAuth handoff</strong><ol className="os-hub-oauth-list"><li>Configure a broker-registered app and redirect URI.</li><li>Redirect to {broker === "deriv" ? "Deriv OAuth" : "cTrader Open API OAuth"} with a session state.</li><li>The broker shows the requested permissions.</li><li>Validate callback code, state, and account reference.</li><li>Authorize and list demo or real accounts.</li></ol><label className="os-hub-field"><span>Planned callback path · backend required</span><input className="form-control os-hub-num" value={`/auth/callback/${broker}`} readOnly /></label>
        {!oauthPreview ? <button className="btn os-hub-btn" type="button" onClick={() => setOAuthPreview(true)}><KeyRound size={15} /> Preview OAuth handoff</button> : <><StateNote>Preview only. No redirect, callback, or authorization occurred.</StateNote><label className="os-hub-field"><span>Example account from callback</span><select className="form-select" value={login} onChange={(e) => setLogin(e.target.value)} required><option value="">Select a sample account</option><option value={live ? "SAMPLE-LIVE-01" : "SAMPLE-DEMO-01"}>{live ? "Sample live account" : "Sample demo account"}</option></select></label></>}
      </div>}
      {mt5 && <div className="os-hub-form-grid">
        <label className="os-hub-field"><span>MT5 login number</span><input className="form-control" value={login} onChange={(e) => setLogin(e.target.value)} required inputMode="numeric" pattern="[0-9]{5,15}" placeholder="145092881" /></label>
        <label className="os-hub-field"><span>Sample MT5 password</span><input className="form-control" type="password" placeholder="Sample only" autoComplete="off" required minLength={4} /></label>
        <label className="os-hub-field"><span>Exact MT5 server</span><select className="form-select" value={server} onChange={(e) => setServer(e.target.value)}>{broker === "exness" ? brokerServers.map((n) => <option key={n}>{`Exness-MT5${live ? "Real" : "Trial"}${n}`}</option>) : <option>{defaultServer(broker, live)}</option>}<option value="custom">Custom server</option></select></label>
        <label className="os-hub-field"><span>MetaApi region</span><select className="form-select" value={region} onChange={(e) => setRegion(e.target.value)}><option value="london">London</option><option value="new-york">New York</option><option value="singapore">Singapore</option></select></label>
        {server === "custom" && <label className="os-hub-field"><span>Custom server name</span><input className="form-control" value={customServer} onChange={(e) => setCustomServer(e.target.value)} required maxLength={64} /></label>}
        <label className="os-hub-field"><span>Login permission</span><select className="form-select" value={readOnly ? "investor" : "trader"} onChange={(e) => setReadOnly(e.target.value === "investor")}><option value="trader">Trader</option><option value="investor">Investor (read-only)</option></select></label>
        <label className="os-hub-field"><span>MetaApi token mode</span><select className="form-select" value={managed ? "managed" : "own"} onChange={(e) => setManaged(e.target.value === "managed")}><option value="managed">OStrade-managed (planned)</option><option value="own">Sample token</option></select></label>
        {!managed && <label className="os-hub-field"><span>Sample MetaApi token</span><input className="form-control" type="password" required minLength={4} autoComplete="off" /></label>}
      </div>}
      {!paper && !mt5 && !oauth && <div className="os-hub-form-grid">
        <label className="os-hub-field"><span>{broker === "oanda" ? "Sample API token" : "Sample key ID"}</span><input className="form-control" type="password" required minLength={4} autoComplete="off" /></label>
        {broker === "oanda" ? <label className="os-hub-field"><span>Practice / live account ID</span><input className="form-control" placeholder="101-004-2891102-001" required value={login} onChange={(e) => setLogin(e.target.value)} /></label> : <label className="os-hub-field"><span>Sample API secret</span><input className="form-control" type="password" required minLength={4} autoComplete="off" /></label>}
        <div className="os-hub-inset"><strong>Selected endpoint</strong><p>{broker === "binance" ? live ? "Binance Spot" : "Binance Spot Testnet" : broker === "alpaca" ? live ? "Alpaca live REST" : "Alpaca paper REST" : live ? "OANDA v20 live" : "OANDA v20 practice"}</p>{broker === "binance" && <small>Future keys should be IP-restricted and withdrawal-disabled.</small>}</div>
      </div>}
      {!paper && <fieldset className="os-hub-inset"><legend>Requested permissions</legend><div className="os-hub-actions">{permissions.map((permission) => <label key={permission}><input className="form-check-input" type="checkbox" checked={scopes.includes(permission)} disabled={permission === "Read account" || pending} onChange={(e) => setScopes(e.target.checked ? [...scopes, permission] : scopes.filter((v) => v !== permission))} /> {permission}</label>)}</div></fieldset>}
      <CapabilityTags broker={broker} />{error && <StateNote error>{error}</StateNote>}
      <div className="os-hub-dialog-actions"><button className="btn os-hub-btn" type="button" disabled={pending} onClick={() => setStep(0)}><ArrowLeft size={15} /> Back</button><button className="btn os-hub-btn os-hub-primary" disabled={pending}>{test.isPending ? <Busy>Validating…</Busy> : paper ? "Review paper setup" : "Test configuration locally"}<ArrowRight size={15} /></button></div>
    </form>}
    {step === 2 && <form className="os-hub-flow" onSubmit={(e) => void submit(e)}>
      <div className="os-hub-wizard-provider"><BrokerMark broker={broker} /><div><strong>{label}</strong><small>{provider.name} · {paper ? "Local simulation" : live ? "Live preview" : "Demo preview"}</small></div></div>
      {paper ? <StateNote>Starting balance: ${Number(balance).toLocaleString("en-US")} simulated USD. Creating this workspace won’t move funds.</StateNote> : <><div className="os-hub-inset"><strong>Local preflight checklist</strong><ul>{test.data?.checks.map((check) => <li key={check}><Check size={14} /> {check}</li>)}</ul><p>{test.data?.message}</p><small>Account balance proof: unavailable · Vault: not connected</small></div>{mt5 && <div className="os-hub-inset"><strong>{server === "custom" ? customServer : server}</strong><p>MetaApi region: {region} · Leverage not verified</p></div>}
      {live && <label className="os-hub-field"><span>Demo 2FA gate</span><input className="form-control" inputMode="numeric" pattern="000000" value={oneTimeCode} required onChange={(e) => setOneTimeCode(e.target.value)} placeholder="000000" /><small>Enter the example code 000000. Do not enter a real code.</small></label>}</>}
      {error && <StateNote error>{error}</StateNote>}
      <div className="os-hub-dialog-actions"><button type="button" className="btn os-hub-btn" disabled={pending} onClick={() => setStep(1)}><ArrowLeft size={15} /> Edit setup</button><button className="btn os-hub-btn os-hub-primary" disabled={pending}>{pending ? <Busy>Preparing…</Busy> : paper ? "Create paper account" : "Stage connection preview"}<ArrowRight size={15} /></button></div>
    </form>}
    {step === 3 && <div className="os-hub-flow"><div className="os-hub-success"><span>{paper ? <CircleCheck size={27} /> : <ShieldCheck size={27} />}</span><h3>{paper ? "Paper account created" : "Connection preview staged"}</h3><p>{paper ? `${create.data?.label} is available in the local simulator.` : stage.data?.message}</p></div>
      {!paper && <div className="os-hub-flow"><div className="os-hub-result-steps">{stage.data?.steps.map((item) => <div key={item}><LockKeyhole size={14} />{item}<Chip>Backend required</Chip></div>)}</div><StateNote>No credentials were stored, no balance was verified, and no broker account was connected.</StateNote></div>}
      <div className="os-hub-dialog-actions"><button className="btn os-hub-btn" onClick={close}>Done</button>{create.data && <button className="btn os-hub-btn os-hub-primary" onClick={() => onPaper(create.data)}><FlaskConical size={15} /> Use this account</button>}</div>
    </div>}
  </Dialog>;
}
