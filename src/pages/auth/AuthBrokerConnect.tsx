import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  Minus,
  PlugZap,
  Server,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { CountUp } from "@/components/CountUp";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  getBrokerConnectOptions,
  getDerivOAuthSession,
  saveBrokerConnection,
  testKeyConnection,
  testMt5Connection,
  type BrokerConnectOption,
  type ConnectChip,
  type InertConnectionResult,
  type KeyProof,
  type Mt5Proof,
} from "@/services/brokers";
import { isTwoFactorEnrolled } from "@/services/auth";
import css from "@/styles/pages/auth-broker-connect.css?inline";

/* ───────────────── helpers ───────────────── */

function Skel({ h = 16, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <span className={`os-skel ${className}`} style={{ height: h, width: w }} aria-hidden />;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</span>;
}

const CHIP_ICON = { yes: Check, partial: Minus, no: X } as const;
const CHIP_LABEL = { yes: "supported", partial: "restricted", no: "not via API" } as const;

function Chip({ chip }: { chip: ConnectChip }) {
  const Icon = CHIP_ICON[chip.v];
  return (
    <span className={`os-chip is-${chip.v}`} title={`${chip.label}: ${CHIP_LABEL[chip.v]}${chip.note ? ` (${chip.note})` : ""}`}>
      <Icon size={12} aria-hidden /> {chip.label}
    </span>
  );
}

/** Simulates a broker-side hop: os-pulse for ~700ms, then continues. Always inert. */
function usePulse() {
  const [pulsing, setPulsing] = useState<string | null>(null);
  const run = async (key: string, ms = 700) => {
    setPulsing(key);
    await new Promise((r) => setTimeout(r, ms));
    setPulsing(null);
  };
  return { pulsing, run };
}

type AccountType = "LIVE" | "DEMO" | "PAPER";
interface ConnectedAccount {
  broker: string;
  accountId: string;
  type: AccountType;
  currency: string;
  balance: string;
}

/* ───────────────── S1 · broker picker ───────────────── */

function BrokerCard({ option, selected, onSelect }: { option: BrokerConnectOption; selected: boolean; onSelect: () => void }) {
  return (
    <Reveal delay={60}>
      <button type="button" className={`os-broker-card os-fade-up ${selected ? "is-selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
        <div className="os-broker-top">
          <span className={`os-broker-badge tone-${option.tone}`} aria-hidden>{option.initials}</span>
          <span>
            <span className="os-broker-name">{option.name}</span>
            <span className="os-broker-sub">{option.accountTypes.join(" · ")}</span>
          </span>
          {option.recommended && <span className="os-broker-reco">RECOMMENDED · NO CREDENTIALS</span>}
        </div>
        <div className="os-broker-meta">
          <span className="os-broker-method">{option.method}</span>
          <span className="os-broker-min"><Clock size={13} aria-hidden /> Connects in ~<CountUp value={option.minutes} format={(n) => String(n)} /> min</span>
        </div>
        <div className="os-chip-row" aria-label={`${option.name} capabilities`}>
          {option.chips.map((chip) => <Chip key={chip.id} chip={chip} />)}
        </div>
      </button>
    </Reveal>
  );
}

/* ───────────────── S2 · Deriv OAuth flow ───────────────── */

function DerivFlow({ onConnect, onBack }: { onConnect: (a: ConnectedAccount) => void; onBack: () => void }) {
  const toast = useToast();
  const { pulsing, run } = usePulse();
  const session = useQuery({ queryKey: ["deriv-oauth-session"], queryFn: getDerivOAuthSession });
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string | null>(null);
  const next = (key: string) => run(key).then(() => { setStep((s) => Math.min(5, s + 1)); });

  const copyUri = () => {
    if (!session.data) return;
    navigator.clipboard?.writeText(session.data.redirectUri).then(
      () => toast("Redirect URI copied — register it on api.deriv.com"),
      () => toast("Copy blocked by the browser — select the text manually"),
    );
  };

  const data = session.data;
  const steps = [
    "Register the app · redirect URI",
    "Redirect to oauth.deriv.com",
    "You authorise the scopes",
    "Callback validation (code + acct1)",
    "WS authorise → pick the default account",
  ];

  return (
    <div className="os-flow-card os-fade-up" aria-label="Deriv OAuth connection">
      <div className="os-flow-head">
        <span className="os-broker-badge tone-orange" aria-hidden>DR</span>
        <h2>Deriv — OAuth connection</h2>
        <p>Five steps, no password sharing. Every broker-side hop below is simulated: nothing leaves this browser and no session is opened.</p>
        <button type="button" className="os-back-link" onClick={onBack}><ArrowLeft size={13} aria-hidden /> Back to the broker list</button>
      </div>
      <div className="os-flow-body">
        {!data ? (
          <div className="os-staged" aria-live="polite">{[0, 1, 2].map((i) => <Skel key={i} h={44} />)}</div>
        ) : (
          <div className="os-oauth-steps">
            {steps.map((title, i) => {
              const n = i + 1;
              const cls = step === n ? "is-active" : step > n ? "is-done" : "";
              return (
                <div key={title} className={`os-oauth-step os-fade-up ${cls}`} aria-current={step === n ? "step" : undefined}>
                  <div className="os-oauth-step-top">
                    <span className="os-oauth-n os-mono">{step > n ? <Check size={13} aria-hidden /> : n}</span>
                    <span className="os-oauth-title">{title}</span>
                    {pulsing === `s${n}` && <span className="os-connecting ms-auto"><span className="os-pulse-dot" aria-hidden /> connecting…</span>}
                  </div>
                  {n === 1 && step >= 1 && (
                    <div>
                      <p>Register an app at <strong>api.deriv.com</strong> and paste OStrade's redirect URI below. In this preview the app id <span className="os-mono">{data.appId}</span> is already registered.</p>
                      <div className="os-uri-box">
                        <ExternalLink size={14} aria-hidden />
                        <span className="os-mono">{data.redirectUri}</span>
                        <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={copyUri}><Copy size={13} aria-hidden /> Copy URI</button>
                      </div>
                      <button type="button" className="os-btn os-btn-primary os-btn-sm mt-2" onClick={() => setStep(2)} disabled={step !== 1}>Continue <ArrowRight size={14} aria-hidden /></button>
                    </div>
                  )}
                  {n === 2 && step >= 2 && (
                    <div>
                      <p>OStrade hands off to <span className="os-mono">oauth.deriv.com</span> with a CSRF state parameter. In this preview the hand-off is inert — the browser never leaves the page.</p>
                      <div className="os-uri-box"><span className="os-mono">state=<strong>{data.state}</strong></span></div>
                      {step === 2 && (
                        <button type="button" className="os-btn os-btn-primary os-btn-sm mt-2" onClick={() => next("s2")} disabled={pulsing === "s2"}>
                          {pulsing === "s2" ? <><span className="os-pulse-dot" aria-hidden /> Opening broker page…</> : <>Open oauth.deriv.com <ArrowUpRight size={14} aria-hidden /></>}
                        </button>
                      )}
                    </div>
                  )}
                  {n === 3 && step >= 3 && (
                    <div>
                      <p>You would now review and approve exactly these scopes on the broker's page:</p>
                      <ul className="os-scope-list">
                        {data.scopes.map((s) => <li key={s}><Check size={14} aria-hidden /> {s}</li>)}
                      </ul>
                      {step === 3 && (
                        <button type="button" className="os-btn os-btn-primary os-btn-sm mt-2" onClick={() => next("s3")} disabled={pulsing === "s3"}>
                          {pulsing === "s3" ? <><span className="os-pulse-dot" aria-hidden /> Waiting for authorisation…</> : <>Authorise (simulated) <ShieldCheck size={14} aria-hidden /></>}
                        </button>
                      )}
                    </div>
                  )}
                  {n === 4 && step >= 4 && (
                    <div>
                      <p>The broker redirects back with a one-time code and the account list id. OStrade validates the state and records the code — shown here as the static preview payload:</p>
                      <div className="os-callback-payload os-mono" role="figure" aria-label="Callback payload">
                        callback ✓ state={data.state} (matches)<br />
                        code=oa_demo_9f2c7e1a · acct1=crd_preview<br />
                        tokens issued: none (preview stops here)
                      </div>
                      {step === 4 && (
                        <button type="button" className="os-btn os-btn-primary os-btn-sm mt-2" onClick={() => next("s4")} disabled={pulsing === "s4"}>
                          {pulsing === "s4" ? <><span className="os-pulse-dot" aria-hidden /> Validating callback…</> : <>Validate callback <Check size={14} aria-hidden /></>}
                        </button>
                      )}
                    </div>
                  )}
                  {n === 5 && step >= 5 && (
                    <div>
                      <p>The WebSocket <span className="os-mono">authorize</span> returns your account list. Pick the default account OStrade may use:</p>
                      <div className="os-acct-pick" role="radiogroup" aria-label="Default Deriv account">
                        {data.accounts.map((a) => (
                          <label key={a.id} className={`os-acct-row ${picked === a.id ? "is-active" : ""}`}>
                            <input type="radio" name="deriv-acct" checked={picked === a.id} onChange={() => setPicked(a.id)} />
                            <span className="os-mono">{a.id}</span>
                            <span className="os-mono">{a.currency} {a.balance}</span>
                            <span className={`os-acct-badge ${a.kind === "Demo" ? "is-demo" : "is-live"}`}>{a.kind.toUpperCase()}</span>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="os-btn os-btn-primary os-btn-sm mt-2"
                        disabled={!picked || pulsing === "s5"}
                        onClick={() => {
                          const a = data.accounts.find((x) => x.id === picked)!;
                          onConnect({ broker: "Deriv", accountId: a.id, type: a.kind === "Demo" ? "DEMO" : "LIVE", currency: a.currency, balance: a.balance === "••••••" ? "—" : a.balance });
                        }}
                      >
                        {pulsing === "s5" ? <><span className="os-pulse-dot" aria-hidden /> Authorising on WS…</> : <>Use this account <ArrowRight size={14} aria-hidden /></>}
                      </button>
                      <p className="os-inert-note mt-2"><Info size={13} aria-hidden /> In the live flow this step opens a real WebSocket session and reads balances. The preview account list is static.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────── S3 · Exness / MT5 via MetaApi ───────────────── */

const mt5Schema = z.object({
  login: z.string().trim().regex(/^\d{5,12}$/, "MT login is the numeric account number (5–12 digits)"),
  passwordKind: z.enum(["trader", "investor"]),
  password: z.string().min(6, "Enter the account password").refine((v) => !/^investor/i.test(v), { message: "That looks like an investor password label — investor passwords are read-only" }),
  server: z.string().min(1, "Choose the exact MT5 server name"),
  serverCustom: z.string().optional(),
  region: z.enum(["new-york", "london", "singapore"]),
  tokenMode: z.enum(["managed", "own"]),
  token: z.string().optional(),
  label: z.string().trim().min(2, "Give the account a label").max(40, "Keep the label under 40 characters"),
  accountType: z.enum(["LIVE", "DEMO"]),
}).refine((v) => v.passwordKind === "trader", { path: ["passwordKind"], message: "Investor passwords are read-only — OStrade needs the trader password to execute" })
  .refine((v) => v.tokenMode === "managed" || (v.token ?? "").length >= 8, { path: ["token"], message: "Enter your MetaApi token, or choose the OStrade managed token" })
  .refine((v) => v.server !== "custom" || (v.serverCustom ?? "").trim().length >= 3, { path: ["serverCustom"], message: "Type the exact server name, e.g. Exness-MT5Real14" });

type Mt5Values = z.infer<typeof mt5Schema>;

function Mt5Flow({ onConnect, onBack }: { onConnect: (a: ConnectedAccount) => void; onBack: () => void }) {
  const toast = useToast();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Mt5Values>({
    resolver: zodResolver(mt5Schema),
    defaultValues: { login: "", passwordKind: "trader", password: "", server: "Exness-MT5Trial7", serverCustom: "", region: "london", tokenMode: "managed", token: "", label: "Exness Live 1", accountType: "DEMO" },
    mode: "onBlur",
  });
  const [proof, setProof] = useState<Mt5Proof | null>(null);
  const [stage, setStage] = useState(3);
  const [testing, setTesting] = useState(false);
  const server = watch("server");
  const kind = watch("passwordKind");
  const tokenMode = watch("tokenMode");

  const runTest = handleSubmit(async () => {
    setTesting(true);
    setStage(0);
    const t1 = setTimeout(() => setStage(1), 380);
    const t2 = setTimeout(() => setStage(2), 780);
    const p = await testMt5Connection();
    clearTimeout(t1); clearTimeout(t2);
    setProof(p);
    setStage(3);
    setTesting(false);
    toast("Account information returned — this proof is a static preview");
  });

  const stageLines = ["Provisioning MetaApi account…", "Deploying the MT5 bridge…", "Calling getAccountInformation…"];

  return (
    <div className="os-flow-card os-fade-up" aria-label="Exness MT5 connection">
      <div className="os-flow-head">
        <span className="os-broker-badge tone-amber" aria-hidden>EX</span>
        <h2>Exness / MT5 — via MetaApi</h2>
        <p>MT5 login, trading password and the exact server name. OStrade bridges through MetaApi; credentials go to the encrypted vault, never to a signal or note.</p>
        <button type="button" className="os-back-link" onClick={onBack}><ArrowLeft size={13} aria-hidden /> Back to the broker list</button>
      </div>
      <div className="os-flow-body">
        <form onSubmit={runTest} noValidate>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="os-field">
                <label htmlFor="mt-login">MT login <span className="os-req">required</span></label>
                <div className="os-input-wrap"><KeyRound size={17} aria-hidden /><input id="mt-login" inputMode="numeric" placeholder="e.g. 12345678" className={`os-input ${errors.login ? "is-invalid" : ""}`} {...register("login")} /></div>
                <FieldError message={errors.login?.message} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="os-field">
                <label htmlFor="mt-label">Account label <span className="os-req">required</span></label>
                <div className="os-input-wrap"><Wallet size={17} aria-hidden /><input id="mt-label" placeholder="Exness Live 1" className={`os-input ${errors.label ? "is-invalid" : ""}`} {...register("label")} /></div>
                <FieldError message={errors.label?.message} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="os-field">
                <span className="os-field-label">Password kind <span className="os-req">required</span></span>
                <div className="os-radio-row" role="radiogroup" aria-label="Password kind">
                  <label className={`os-radio ${kind === "trader" ? "is-active" : ""}`}><input type="radio" value="trader" {...register("passwordKind")} /><span>Trader password<small>Can place trades — required</small></span></label>
                  <label className={`os-radio ${kind === "investor" ? "is-active" : ""}`}><input type="radio" value="investor" {...register("passwordKind")} /><span>Investor password<small>Read-only — blocked</small></span></label>
                </div>
                {kind === "investor"
                  ? <span className="os-field-hint" role="alert"><AlertTriangle size={12} aria-hidden /> Investor passwords can view an account but cannot trade. OStrade executes orders, so the trader password is required.</span>
                  : <FieldError message={errors.passwordKind?.message} />}
              </div>
            </div>
            <div className="col-md-6">
              <div className="os-field">
                <label htmlFor="mt-password">MT password <span className="os-req">required</span></label>
                <div className="os-input-wrap"><LockKeyhole size={17} aria-hidden /><input id="mt-password" type="password" autoComplete="off" placeholder="Trading password" className={`os-input ${errors.password ? "is-invalid" : ""}`} {...register("password")} /></div>
                <FieldError message={errors.password?.message} />
                <span className="os-field-hint">Trader password only. Investor (read-only) passwords are rejected before anything is stored.</span>
              </div>
            </div>
            <div className="col-md-6">
              <div className="os-field">
                <label htmlFor="mt-server">Server <span className="os-req">required</span></label>
                <div className="os-input-wrap"><Server size={17} aria-hidden />
                  <select id="mt-server" className={`os-input ${errors.server ? "is-invalid" : ""}`} {...register("server")}>
                    {Array.from({ length: 12 }, (_, i) => <option key={`r${i + 1}`} value={`Exness-MT5Real${i + 1}`}>Exness-MT5Real{i + 1}</option>)}
                    {Array.from({ length: 12 }, (_, i) => <option key={`t${i + 1}`} value={`Exness-MT5Trial${i + 1}`}>Exness-MT5Trial{i + 1}</option>)}
                    <option value="custom">Custom server name…</option>
                  </select>
                </div>
                <FieldError message={errors.server?.message} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="os-field">
                <label htmlFor="mt-region">MetaApi region <span className="os-req">required</span></label>
                <div className="os-input-wrap"><Server size={17} aria-hidden />
                  <select id="mt-region" className="os-input" {...register("region")}>
                    <option value="new-york">new-york</option>
                    <option value="london">london</option>
                    <option value="singapore">singapore</option>
                  </select>
                </div>
                <span className="os-field-hint">Pick the region closest to your broker's server for lower order latency.</span>
              </div>
            </div>
            {server === "custom" && (
              <div className="col-md-6">
                <div className="os-field">
                  <label htmlFor="mt-server-custom">Custom server name <span className="os-req">required</span></label>
                  <div className="os-input-wrap"><Server size={17} aria-hidden /><input id="mt-server-custom" placeholder="Exness-MT5Real14" className={`os-input ${errors.serverCustom ? "is-invalid" : ""}`} {...register("serverCustom")} /></div>
                  <FieldError message={errors.serverCustom?.message} />
                  <span className="os-field-hint">Copy it exactly from your MT5 terminal's server list.</span>
                </div>
              </div>
            )}
            <div className="col-md-6">
              <div className="os-field">
                <span className="os-field-label">MetaApi token</span>
                <div className="os-radio-row" role="radiogroup" aria-label="MetaApi token mode">
                  <label className={`os-radio ${tokenMode === "managed" ? "is-active" : ""}`}><input type="radio" value="managed" {...register("tokenMode")} /><span>OStrade managed<small>Recommended — provisioned for you</small></span></label>
                  <label className={`os-radio ${tokenMode === "own" ? "is-active" : ""}`}><input type="radio" value="own" {...register("tokenMode")} /><span>My own token<small>Paste your MetaApi token</small></span></label>
                </div>
              </div>
            </div>
            {tokenMode === "own" && (
              <div className="col-md-6">
                <div className="os-field">
                  <label htmlFor="mt-token">Token <span className="os-req">required</span></label>
                  <div className="os-input-wrap"><KeyRound size={17} aria-hidden /><input id="mt-token" type="password" autoComplete="off" placeholder="eyJhbGciOi…" className={`os-input ${errors.token ? "is-invalid" : ""}`} {...register("token")} /></div>
                  <FieldError message={errors.token?.message} />
                </div>
              </div>
            )}
            <div className="col-md-6">
              <div className="os-field">
                <span className="os-field-label">Account type</span>
                <div className="os-radio-row" role="radiogroup" aria-label="Account type">
                  <label className={`os-radio ${watch("accountType") === "DEMO" ? "is-active" : ""}`}><input type="radio" value="DEMO" {...register("accountType")} /><span>DEMO<small>MT5 trial account</small></span></label>
                  <label className={`os-radio ${watch("accountType") === "LIVE" ? "is-active" : ""}`}><input type="radio" value="LIVE" {...register("accountType")} /><span>LIVE<small>Real funds at Exness</small></span></label>
                </div>
              </div>
            </div>
          </div>

          <div className="os-form-actions mt-4">
            <button type="submit" className="os-btn os-btn-primary" disabled={testing}>
              {testing ? <><Loader2 size={16} className="os-spin" aria-hidden /> Testing connection…</> : <><PlugZap size={16} aria-hidden /> Test connection</>}
            </button>
            <span className="os-field-hint">Test = provision → deploy → getAccountInformation. Nothing is saved until you connect the tested account.</span>
          </div>
          {testing && (
            <div className="os-staged mt-3" aria-live="polite">
              {stageLines.map((line, i) => (
                <span key={line} className={`os-stage-line ${i < stage ? "is-done" : i === stage ? "is-active" : ""}`}>
                  {i < stage ? <Check size={14} aria-hidden /> : i === stage ? <span className="os-pulse-dot" aria-hidden /> : <Loader2 size={14} className="os-spin" aria-hidden />} {line}
                </span>
              ))}
            </div>
          )}
        </form>

        {proof && !testing && (
          <div className="os-proof mt-3 os-fade-up" role="status">
            <div className="os-proof-head"><ShieldCheck size={16} aria-hidden /> Connection proof — account information returned</div>
            <div className="os-proof-grid">
              <div className="os-proof-cell"><small>Account</small><span className="os-mono">{proof.accountId}</span></div>
              <div className="os-proof-cell"><small>Server</small><span className="os-mono">{proof.server}</span></div>
              <div className="os-proof-cell"><small>Leverage</small><span className="os-mono">{proof.leverage}</span></div>
              <div className="os-proof-cell"><small>Balance</small><span className="os-mono">{proof.currency} {proof.balance}</span></div>
            </div>
            <div className="os-form-actions">
              <button type="button" className="os-btn os-btn-primary" onClick={() => onConnect({ broker: "Exness / MT5", accountId: proof.accountId, type: watch("accountType"), currency: proof.currency, balance: `${proof.currency} ${proof.balance}` })}>
                Connect this account <ArrowRight size={15} aria-hidden />
              </button>
              <span className="os-field-hint"><Info size={12} aria-hidden /> Static preview proof — in production these values come from the deployed bridge.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────── S4 · key-based brokers ───────────────── */

const alpacaSchema = z.object({
  keyId: z.string().trim().min(10, "Paste your Alpaca key id (e.g. PK…)"),
  secret: z.string().min(16, "Paste the secret key — it never leaves the browser in this preview"),
  endpoint: z.enum(["paper", "live"]),
});
const binanceSchema = z.object({
  apiKey: z.string().trim().min(16, "Paste your Binance API key"),
  secret: z.string().min(16, "Paste your Binance API secret"),
  testnet: z.boolean(),
});
const oandaSchema = z.object({
  token: z.string().trim().min(16, "Paste your OANDA v20 token"),
  environment: z.enum(["practice", "live"]),
  accountId: z.string().trim().min(6, "Enter the OANDA account id"),
});

function KeyTestButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button type="submit" className="os-btn os-btn-ghost os-btn-sm" disabled={pending}>
      {pending ? <><span className="os-pulse-dot" aria-hidden /> Fetching account info…</> : <><PlugZap size={13} aria-hidden /> {label}</>}
    </button>
  );
}

function KeyProofRow({ proof }: { proof: KeyProof }) {
  return (
    <div className="os-key-proof os-fade-up" role="status">
      <ShieldCheck size={14} aria-hidden style={{ color: "var(--os-up)" }} />
      <span className="os-mono">{proof.accountId}</span>
      <span>{proof.currency} {proof.balance}</span>
      {proof.extra && <span className="os-field-hint">{proof.extra}</span>}
    </div>
  );
}

function AlpacaCard({ onConnect }: { onConnect: (a: ConnectedAccount) => void }) {
  const { register, watch, handleSubmit, formState: { errors } } = useForm<z.infer<typeof alpacaSchema>>({
    resolver: zodResolver(alpacaSchema),
    defaultValues: { keyId: "", secret: "", endpoint: "paper" },
  });
  const [proof, setProof] = useState<KeyProof | null>(null);
  const [pending, setPending] = useState(false);
  const endpoint = watch("endpoint");
  const test = handleSubmit(async () => { setPending(true); setProof(await testKeyConnection("alpaca")); setPending(false); });
  return (
    <div className="os-key-card os-fade-up">
      <div className="os-key-head"><span className="os-broker-badge tone-green" aria-hidden>AL</span><div><strong>Alpaca</strong><small>Key id + secret · REST</small></div></div>
      <form onSubmit={test} noValidate className="os-field">
        <label htmlFor="alpaca-key">Key id <span className="os-req">required</span></label>
        <div className="os-input-wrap"><KeyRound size={16} aria-hidden /><input id="alpaca-key" placeholder="PK… or AK…" className={`os-input ${errors.keyId ? "is-invalid" : ""}`} {...register("keyId")} /></div>
        <FieldError message={errors.keyId?.message} />
        <label htmlFor="alpaca-secret">Secret <span className="os-req">required</span></label>
        <div className="os-input-wrap"><LockKeyhole size={16} aria-hidden /><input id="alpaca-secret" type="password" autoComplete="off" className={`os-input ${errors.secret ? "is-invalid" : ""}`} {...register("secret")} /></div>
        <FieldError message={errors.secret?.message} />
        <span className="os-field-label">Endpoint</span>
        <div className="os-radio-row" role="radiogroup" aria-label="Alpaca endpoint">
          <label className={`os-radio ${endpoint === "paper" ? "is-active" : ""}`}><input type="radio" value="paper" {...register("endpoint")} />Paper (default)</label>
          <label className={`os-radio ${endpoint === "live" ? "is-active" : ""}`}><input type="radio" value="live" {...register("endpoint")} />Live</label>
        </div>
        <KeyTestButton pending={pending} label="Test account info" />
        {proof && <KeyProofRow proof={proof} />}
        {proof && !pending && (
          <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={() => onConnect({ broker: "Alpaca", accountId: proof.accountId, type: endpoint === "paper" ? "PAPER" : "LIVE", currency: proof.currency, balance: `${proof.currency} ${proof.balance}` })}>
            Connect this account <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </form>
    </div>
  );
}

function BinanceCard({ onConnect }: { onConnect: (a: ConnectedAccount) => void }) {
  const toast = useToast();
  const { register, watch, handleSubmit, formState: { errors } } = useForm<z.infer<typeof binanceSchema>>({
    resolver: zodResolver(binanceSchema),
    defaultValues: { apiKey: "", secret: "", testnet: true },
  });
  const [proof, setProof] = useState<KeyProof | null>(null);
  const [pending, setPending] = useState(false);
  const testnet = watch("testnet");
  const test = handleSubmit(async () => { setPending(true); setProof(await testKeyConnection("binance")); setPending(false); });
  return (
    <div className="os-key-card os-fade-up">
      <div className="os-key-head"><span className="os-broker-badge tone-amber" aria-hidden>BN</span><div><strong>Binance</strong><small>API key + secret · REST + WS</small></div></div>
      <form onSubmit={test} noValidate className="os-field">
        <label htmlFor="binance-key">API key <span className="os-req">required</span></label>
        <div className="os-input-wrap"><KeyRound size={16} aria-hidden /><input id="binance-key" className={`os-input ${errors.apiKey ? "is-invalid" : ""}`} {...register("apiKey")} /></div>
        <FieldError message={errors.apiKey?.message} />
        <label htmlFor="binance-secret">API secret <span className="os-req">required</span></label>
        <div className="os-input-wrap"><LockKeyhole size={16} aria-hidden /><input id="binance-secret" type="password" autoComplete="off" className={`os-input ${errors.secret ? "is-invalid" : ""}`} {...register("secret")} /></div>
        <FieldError message={errors.secret?.message} />
        <label className="os-radio" style={{ width: "100%" }}>
          <input type="checkbox" {...register("testnet")} />
          <span>Use testnet<small>testnet.binance.vision — recommended first</small></span>
        </label>
        <button type="button" className="os-text-action" onClick={() => toast("Create the key with trade permission only, then allow-list this machine's IP")}>
          <Info size={13} aria-hidden /> IP-whitelist reminder
        </button>
        <KeyTestButton pending={pending} label="Test account info" />
        {proof && <KeyProofRow proof={proof} />}
        {proof && !pending && (
          <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={() => onConnect({ broker: "Binance", accountId: proof.accountId, type: testnet ? "DEMO" : "LIVE", currency: proof.currency, balance: `${proof.currency} ${proof.balance}` })}>
            Connect this account <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </form>
    </div>
  );
}

function OandaCard({ onConnect }: { onConnect: (a: ConnectedAccount) => void }) {
  const { register, watch, handleSubmit, formState: { errors } } = useForm<z.infer<typeof oandaSchema>>({
    resolver: zodResolver(oandaSchema),
    defaultValues: { token: "", environment: "practice", accountId: "" },
  });
  const [proof, setProof] = useState<KeyProof | null>(null);
  const [pending, setPending] = useState(false);
  const environment = watch("environment");
  const test = handleSubmit(async () => { setPending(true); setProof(await testKeyConnection("oanda")); setPending(false); });
  return (
    <div className="os-key-card os-fade-up">
      <div className="os-key-head"><span className="os-broker-badge tone-violet" aria-hidden>OA</span><div><strong>OANDA</strong><small>v20 token · REST</small></div></div>
      <form onSubmit={test} noValidate className="os-field">
        <label htmlFor="oanda-token">Token <span className="os-req">required</span></label>
        <div className="os-input-wrap"><KeyRound size={16} aria-hidden /><input id="oanda-token" type="password" autoComplete="off" className={`os-input ${errors.token ? "is-invalid" : ""}`} {...register("token")} /></div>
        <FieldError message={errors.token?.message} />
        <span className="os-field-label">Environment</span>
        <div className="os-radio-row" role="radiogroup" aria-label="OANDA environment">
          <label className={`os-radio ${environment === "practice" ? "is-active" : ""}`}><input type="radio" value="practice" {...register("environment")} />Practice (default)</label>
          <label className={`os-radio ${environment === "live" ? "is-active" : ""}`}><input type="radio" value="live" {...register("environment")} />Live</label>
        </div>
        <label htmlFor="oanda-account">Account id <span className="os-req">required</span></label>
        <div className="os-input-wrap"><Wallet size={16} aria-hidden /><input id="oanda-account" placeholder="101-004-8822719-001" className={`os-input ${errors.accountId ? "is-invalid" : ""}`} {...register("accountId")} /></div>
        <FieldError message={errors.accountId?.message} />
        <KeyTestButton pending={pending} label="Test account info" />
        {proof && <KeyProofRow proof={proof} />}
        {proof && !pending && (
          <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={() => onConnect({ broker: "OANDA", accountId: proof.accountId, type: environment === "practice" ? "DEMO" : "LIVE", currency: proof.currency, balance: `${proof.currency} ${proof.balance}` })}>
            Connect this account <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </form>
    </div>
  );
}

function CTraderCard({ onConnect }: { onConnect: (a: ConnectedAccount) => void }) {
  const toast = useToast();
  const { pulsing, run } = usePulse();
  const [proof, setProof] = useState<KeyProof | null>(null);
  const connect = async () => {
    await run("ctrader", 850);
    setProof(await testKeyConnection("ctrader"));
  };
  return (
    <div className="os-key-card os-fade-up">
      <div className="os-key-head"><span className="os-broker-badge tone-cyan" aria-hidden>cT</span><div><strong>cTrader</strong><small>Open API · OAuth</small></div></div>
      <p className="os-fieldset-note">cTrader uses the same OAuth pattern as Deriv: you approve scopes on the broker's own page and OStrade never sees your password.</p>
      <button type="button" className="os-btn os-btn-primary" onClick={connect} disabled={pulsing === "ctrader"}>
        {pulsing === "ctrader" ? <><span className="os-pulse-dot" aria-hidden /> Opening OAuth consent…</> : <>Connect with OAuth <ArrowUpRight size={15} aria-hidden /></>}
      </button>
      <p className="os-inert-note"><Info size={12} aria-hidden /> Inert in this preview — the consent page never loads and no token is issued.</p>
      {proof && <KeyProofRow proof={proof} />}
      {proof && (
        <button type="button" className="os-btn os-btn-primary os-btn-sm" onClick={() => { onConnect({ broker: "cTrader", accountId: proof.accountId, type: "DEMO", currency: proof.currency, balance: `${proof.currency} ${proof.balance}` }); toast("Demo account selected from the simulated OAuth result"); }}>
          Connect this account <ArrowRight size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}

function KeyFlows({ onConnect, onBack }: { onConnect: (a: ConnectedAccount) => void; onBack: () => void }) {
  return (
    <div className="os-flow-card os-fade-up" aria-label="Key-based brokers">
      <div className="os-flow-head">
        <span className="os-broker-badge tone-slate" aria-hidden>K</span>
        <h2>Key-based brokers</h2>
        <p>Four compact connections. Each inline Test fetches account information before anything is saved; live endpoints stay inert until the backend ships.</p>
        <button type="button" className="os-back-link" onClick={onBack}><ArrowLeft size={13} aria-hidden /> Back to the broker list</button>
      </div>
      <div className="os-flow-body">
        <div className="os-key-grid">
          <AlpacaCard onConnect={onConnect} />
          <BinanceCard onConnect={onConnect} />
          <OandaCard onConnect={onConnect} />
          <CTraderCard onConnect={onConnect} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────── S5 · first-account confirmation ───────────────── */

function ConfirmBand({ account, save, onDismissSave }: {
  account: ConnectedAccount;
  save: { data: InertConnectionResult | null; isPending: boolean; mutate: () => void; reset: () => void };
  onDismissSave: () => void;
}) {
  return (
    <div id="os-confirm" className="os-confirm-band os-fade-up" aria-label="First account connected">
      <div className="os-confirm-top">
        <ShieldCheck size={18} aria-hidden style={{ color: "#4ade80" }} />
        <strong>First account ready</strong>
        <span className={`os-type-badge is-${account.type.toLowerCase()}`}>{account.type}</span>
      </div>
      <div className="os-confirm-grid">
        <div className="os-confirm-cell"><small>Broker</small><span className="os-mono">{account.broker}</span></div>
        <div className="os-confirm-cell"><small>Account id</small><span className="os-mono">{account.accountId}</span></div>
        <div className="os-confirm-cell"><small>Currency</small><span className="os-mono">{account.currency}</span></div>
        <div className="os-confirm-cell"><small>Balance</small><span className="os-mono">{account.balance}</span></div>
      </div>
      <p className="os-security-note"><LockKeyhole size={14} aria-hidden /> Broker credentials are encrypted with AES-256-GCM and stored in the credential vault. They are never logged, never attached to journal entries, and can be rotated or revoked at any time from the Broker Hub.</p>
      <div className="os-confirm-actions">
        <Link to="/dashboard" className="os-btn os-btn-primary">Enter dashboard <ArrowRight size={16} aria-hidden /></Link>
        <Link to="/dashboard/accounts" className="os-btn os-btn-ghost">Manage in Broker Hub</Link>
        <button type="button" className="os-text-action" onClick={save.isPending ? undefined : save.data ? save.reset : save.mutate} disabled={save.isPending}>
          {save.isPending ? <><Loader2 size={13} className="os-spin" aria-hidden /> Saving…</> : save.data ? "Review the save result" : "Save connection (preview)"}
        </button>
      </div>
      {save.data && <div className="mt-3"><span className="os-ready os-fade-up" role="status"><span className="os-ready-icon"><Info size={20} aria-hidden /></span><span className="os-ready-body"><span className="os-ready-badge">READY · BACKEND REQUIRED</span><h3>{save.data.title}</h3><p>{save.data.message}</p><p className="os-ready-detail">{save.data.detail}</p><span className="os-mono os-ready-ref">ref {save.data.reference}</span></span><button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={onDismissSave}>Dismiss</button></span></div>}
    </div>
  );
}

/* ───────────────── page ───────────────── */

function ConnectHero() {
  const navigate = useNavigate();
  const options = useQuery({ queryKey: ["broker-connect-options"], queryFn: getBrokerConnectOptions });
  const [selected, setSelected] = useState<string | null>(null);
  const [connected, setConnected] = useState<ConnectedAccount | null>(null);
  const [save, setSave] = useState<{ data: InertConnectionResult | null; isPending: boolean }>({ data: null, isPending: false });

  const toast = useToast();
  const data = options.data;

  const onConnect = (a: ConnectedAccount) => {
    // Enforcement gate: a LIVE account requires 2FA (A-8) before it can attach.
    if (a.type === "LIVE" && !isTwoFactorEnrolled()) {
      toast("Two-factor authentication is required before a LIVE connection");
      void navigate({ to: "/auth/2fa" });
      return;
    }
    setConnected(a);
    setSave({ data: null, isPending: true });
    saveBrokerConnection({ broker: a.broker, accountId: a.accountId, accountType: a.type, currency: a.currency, balance: a.balance })
      .then((r) => { setSave({ data: r, isPending: false }); toast("Connection checked locally — nothing was sent"); });
    setTimeout(() => document.getElementById("os-confirm")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }), 120);
  };

  const pick = (id: string) => {
    setSelected(id);
    if (id === "paper" && data) {
      onConnect({ broker: "OStrade Paper", accountId: "OSP-10001", type: "PAPER", currency: "USD", balance: "USD 10,420.50" });
    }
  };

  const flow = useMemo(() => {
    if (selected === "deriv") return <DerivFlow onConnect={onConnect} onBack={() => setSelected(null)} />;
    if (selected === "exness") return <Mt5Flow onConnect={onConnect} onBack={() => setSelected(null)} />;
    if (["ctrader", "alpaca", "binance", "oanda"].includes(selected ?? "")) return <KeyFlows onConnect={onConnect} onBack={() => setSelected(null)} />;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <section className="os-auth-hero" aria-labelledby="os-connect-title">
      <div className="os-hero-grain" aria-hidden />
      <div className="container">
        <header className="os-brand-band">
          <Link to="/" className="os-brand-mark">
            <span className="os-mark-icon">
              <svg viewBox="0 0 24 24" className="os-draw-mark" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                <path d="M13.2 2.4 5.6 13.1h4.6l-1.1 8.5 8-11.2h-4.9z" pathLength={1} />
              </svg>
            </span>
            <span className="os-mark-word">OStrade</span>
          </Link>
          <p className="os-band-tagline">Your signal-trading command center</p>
          <div className="os-band-actions">
            <span className="os-band-step-chip os-mono">A-4 · BROKER CONNECT</span>
            <Link to="/auth/signin" className="os-btn os-btn-ghost os-btn-sm">Sign in instead</Link>
          </div>
        </header>
        <span id="os-connect-title" className="visually-hidden">Connect your first account</span>

        <div className="os-auth-grid">
          {/* S1 — picker rail */}
          <div className="os-picker-col">
            <div className="os-picker-head">
              <span className="os-wizard-badge" style={{ background: "var(--os-brand-soft)", color: "var(--os-brand-ink)", padding: "0.22rem 0.6rem", borderRadius: 6, fontSize: "0.66rem", fontWeight: 800, letterSpacing: "0.08em", display: "inline-block" }}>CHOOSE YOUR FIRST ACCOUNT</span>
              <h1>Connect your first account</h1>
              <p>Paper in one click, or link Deriv, Exness/MT5, cTrader, Alpaca, Binance or OANDA. Capability chips come straight from the matrix — OStrade never shows an action your broker can't do.</p>
            </div>
            <div className="os-broker-list">
              {options.isPending && [0, 1, 2].map((i) => <Skel key={i} h={112} className="rounded-3" />)}
              {options.isError && (
                <button type="button" className="os-btn os-btn-ghost w-100" onClick={() => options.refetch()}>Could not load the broker list · Retry</button>
              )}
              {data?.map((option) => (
                <BrokerCard key={option.id} option={option} selected={selected === option.id} onSelect={() => pick(option.id)} />
              ))}
            </div>
          </div>

          {/* Flow panel — S2/S3/S4 + S5 */}
          <div className="os-flow-col">
            {flow}
            {!flow && (
              <div className="os-flow-card os-fade-up">
                <div className="os-flow-body">
                  <div className="os-flow-empty">
                    <PlugZap size={26} aria-hidden />
                    <strong>Pick a broker to open its connection flow</strong>
                    <span>Deriv runs an inline OAuth stepper; Exness/MT5 connects through MetaApi; Alpaca, Binance, OANDA and cTrader use compact key forms. Or start risk-free with OStrade Paper.</span>
                    <span className="os-broker-min"><Clock size={13} aria-hidden /> Most connections take ~<CountUp value={2} format={(n) => String(n)} /> minutes</span>
                  </div>
                </div>
              </div>
            )}
            {connected && (
              <div className="mt-4">
                <ConfirmBand
                  account={connected}
                  save={{ data: save.data, isPending: save.isPending, mutate: () => onConnect(connected), reset: () => setSave({ data: null, isPending: false }) }}
                  onDismissSave={() => setSave({ data: null, isPending: false })}
                />
              </div>
            )}
          </div>
        </div>

        <div className="os-foot mt-4">
          <span>New here? <Link to="/auth/signup">Create an account</Link> · finished onboarding? <Link to="/auth/onboard">Review your setup</Link></span>
          <span className="os-foot-links">
            <Link to="/how-it-works">How it works</Link>
            <Link to="/brokers">Compare brokers</Link>
            <Link to="/auth/2fa">2FA for live accounts</Link>
            <Link to="/status">Status page</Link>
            <Link to="/legal/$doc" params={{ doc: "risk" }}>Risk disclosure</Link>
          </span>
        </div>
      </div>
    </section>
  );
}

export function BrokerConnectPage() {
  usePageStyle("auth-broker-connect", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Connect a broker · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-auth-broker-connect">
      <ConnectHero />
    </main>
  );
}
