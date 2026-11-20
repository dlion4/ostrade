import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  Laptop,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  MonitorSmartphone,
  Phone,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRoundCheck,
  Zap,
} from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  getPostSignInPanels,
  getRecentSessions,
  getRecoveryOptions,
  getRedirectNodes,
  getRoleRedirects,
  getSecurityPractices,
  getSessionPolicies,
  getSignInFaqs,
  getSignInMethods,
  revokeAllSessions,
  signInWithOtp,
  signInWithPassword,
  verifySecondFactor,
  type InertAuthResult,
  type RecoveryOption,
  type RecentSession,
} from "@/services/auth-signin";
import css from "@/styles/pages/auth-signin.css?inline";

/* ───────────────── helpers ───────────────── */

function SectionHead({ eyebrow, title, lead, center = true }: { eyebrow: string; title: ReactNode; lead?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={`os-section-head ${center ? "text-center mx-auto" : ""}`}>
      <span className="os-eyebrow">{eyebrow}</span>
      <h2 className="os-h2">{title}</h2>
      {lead && <p className="os-lead">{lead}</p>}
    </Reveal>
  );
}

function Skel({ h = 16, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <span className={`os-skel ${className}`} style={{ height: h, width: w }} aria-hidden />;
}

function ReadyCard({ result, onReset, label = "Edit details" }: { result: InertAuthResult; onReset: () => void; label?: string }) {
  return (
    <div className="os-ready" role="status">
      <span className="os-ready-icon"><Info size={20} aria-hidden /></span>
      <div className="os-ready-body">
        <span className="os-ready-badge">READY · BACKEND REQUIRED</span>
        <h3>{result.title}</h3>
        <p>{result.message}</p>
        <p className="os-ready-detail">{result.detail}</p>
        <div className="os-ready-meta">
          <span className="os-mono">ref {result.reference}</span>
          <span className="os-mono os-ready-landing">→ {result.landing}</span>
        </div>
      </div>
      <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={onReset}>{label}</button>
    </div>
  );
}

/** Six focused digits that auto-advance, accept a paste and step back with Backspace. */
function OtpInputs({
  value, onChange, label, invalid = false, disabled = false,
}: { value: string; onChange: (v: string) => void; label: string; invalid?: boolean; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  const setDigit = (i: number, d: string) => {
    const next = [...digits];
    next[i] = d;
    onChange(next.join("").slice(0, 6));
  };

  return (
    <div className={`os-otp ${invalid ? "is-invalid" : ""}`} role="group" aria-label={label}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="os-mono"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`${label} digit ${i + 1} of 6`}
          disabled={disabled}
          value={d}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw.length > 1) {
              onChange(raw.slice(0, 6));
              refs.current[Math.min(5, raw.length - 1)]?.focus();
              return;
            }
            setDigit(i, raw);
            if (raw && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              if (digits[i]) setDigit(i, "");
              else if (i > 0) {
                e.preventDefault();
                setDigit(i - 1, "");
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const clipboard = e.clipboardData;
            if (!clipboard) return;
            const text = clipboard.getData("text").replace(/\D/g, "").slice(0, 6);
            if (text) {
              e.preventDefault();
              onChange(text);
              refs.current[Math.min(5, text.length - 1)]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

function RecoveryLink({ option }: { option: RecoveryOption }) {
  const cls = "os-recovery-link";
  switch (option.route) {
    case "/auth/signup": return <Link to="/auth/signup" className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    case "/auth/forgot-password": return <Link to="/auth/forgot-password" className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    case "/auth/reset-password": return <Link to="/auth/reset-password" className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    case "/auth/verify-otp": return <Link to="/auth/verify-otp" className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    case "/auth/2fa": return <Link to="/auth/2fa" className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    case "/auth/broker-connect": return <Link to="/auth/broker-connect" className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    case "/status": return <Link to="/status" className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    case "/legal/$doc": return <Link to="/legal/$doc" params={{ doc: "risk" }} className={cls}>{option.label}<ArrowUpRight size={14} /></Link>;
    default: return null;
  }
}

/* ───────────────── S1 · sign-in card ───────────────── */

const signinSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email or phone")
    .refine((v) => /^\S+@\S+\.\S+$/.test(v) || /^\+254[17]\d{8}$/.test(v), {
      message: "Use an email, or a +2547XXXXXXXX / +2541XXXXXXXX number",
    }),
  password: z.string(),
  remember: z.boolean(),
  mode: z.enum(["password", "otp"]),
}).superRefine((v, ctx) => {
  if (v.mode === "password" && (!v.password || v.password.length < 10)) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Enter your password (at least 10 characters)" });
  }
});

type SigninValues = z.infer<typeof signinSchema>;
type Stage = "credentials" | "challenge" | "result";

function SigninCard({ mode, setMode }: { mode: "password" | "otp"; setMode: (m: "password" | "otp") => void }) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("credentials");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<InertAuthResult | null>(null);

  const { register, handleSubmit, watch, setValue, reset, setFocus, formState: { errors, touchedFields, isSubmitting } } = useForm<SigninValues>({
    resolver: zodResolver(signinSchema),
    mode: "onBlur",
    defaultValues: { identifier: "", password: "", remember: true, mode: "password" },
  });

  const identifier = watch("identifier");
  const remember = watch("remember");

  const credential = useMutation({ mutationFn: (v: SigninValues) => v.mode === "password"
      ? signInWithPassword({ identifier: v.identifier.toLowerCase(), password: v.password, remember: v.remember })
      : signInWithOtp({ identifier: v.identifier.toLowerCase(), remember: v.remember }),
  });
  const secondFactor = useMutation({ mutationFn: (c: string) => verifySecondFactor(c, mode === "password" ? "totp" : "otp") });

  const switchMode = (m: "password" | "otp") => {
    if (m === mode) return;
    setMode(m);
    setValue("mode", m, { shouldValidate: true });
    setValue("password", "");
    setStage("credentials");
    setResult(null);
    toast(m === "otp" ? "Passwordless sign-in selected" : "Password sign-in selected");
    setFocus("identifier");
  };

  const useKenyanFormat = () => {
    const raw = identifier.trim();
    let next = raw;
    if (raw === "") next = "+2547";
    else if (/^0[17]\d{8}$/.test(raw)) next = `+254${raw.slice(1)}`;
    else if (/^254[17]\d{8}$/.test(raw)) next = `+${raw}`;
    setValue("identifier", next, { shouldValidate: true });
    toast(next === raw ? "Already in +254 international format" : `Formatted as ${next}`);
  };

  const onSubmit = (v: SigninValues) => {
    credential.mutate(v, {
      onSuccess: () => {
        setCode("");
        setStage("challenge");
        toast(v.mode === "otp" ? "One-time code ready for review" : "Password format accepted — second factor next");
      },
    });
  };

  const verify = () => {
    if (code.length !== 6) {
      setCodeError("Enter all six digits, or paste the full code into any box.");
      toast("Six digits required");
      return;
    }
    setCodeError(null);
    secondFactor.mutate(code, {
      onSuccess: (r) => {
        setResult(r);
        setStage("result");
        toast("Format checked — ready for the backend");
      },
    });
  };

  const resetAll = () => {
    setStage("credentials");
    setResult(null);
    setCode("");
    reset({ identifier: "", password: "", remember: true, mode });
  };

  const fieldClass = (name: keyof SigninValues) => `os-input ${errors[name] ? "is-invalid" : touchedFields[name] ? "is-valid" : ""}`;

  return (
    <div className="os-signin-card" id="signin-card">
      <div className="os-signin-head">
        <div className="os-signin-head-top">
          <span className="os-step-chip os-mono">A-2 · SIGN IN</span>
          <span className="os-live-chip"><span className="os-pulse" /> TRADER → /dashboard</span>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to your command center. Role-aware routing sends traders to the dashboard.</p>
      </div>

      <div className="os-seg2" role="tablist" aria-label="Sign-in method">
        <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "is-active" : ""} onClick={() => switchMode("password")}>
          <LockKeyhole size={15} aria-hidden /> Password
        </button>
        <button type="button" role="tab" aria-selected={mode === "otp"} className={mode === "otp" ? "is-active" : ""} onClick={() => switchMode("otp")}>
          <Smartphone size={15} aria-hidden /> Sign in with OTP instead
        </button>
      </div>

      {stage === "result" && result ? (
        <div className="os-signin-body">
          <ReadyCard result={result} onReset={resetAll} label="Sign in again" />
          <p className="os-inline-note"><ShieldCheck size={13} aria-hidden /> No session was issued and no credential was checked in this preview.</p>
        </div>
      ) : stage === "challenge" ? (
        <form className="os-signin-body" onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate>
          <div className="os-challenge-head">
            <span className="os-challenge-icon">{mode === "password" ? <ShieldCheck size={19} /> : <Smartphone size={19} />}</span>
            <div>
              <strong>{mode === "password" ? "Two-factor challenge" : "Your one-time code"}</strong>
              <span>{mode === "password" ? "TOTP is enabled on this account" : `Sent to ${identifier || "your identifier"}`}</span>
            </div>
            <span className="os-totp-badge">{mode === "password" ? "TOTP · 6" : "OTP · 10 MIN"}</span>
          </div>
          <OtpInputs value={code} onChange={(v) => { setCode(v); setCodeError(null); }} label={mode === "password" ? "Two-factor code" : "One-time code"} invalid={!!codeError} disabled={secondFactor.isPending} />
          {codeError && <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{codeError}</span>}
          <div className="os-challenge-actions">
            <button type="submit" className="os-btn os-btn-primary os-btn-lg w-100" disabled={secondFactor.isPending}>
              {secondFactor.isPending ? <><Loader2 size={18} className="os-spin" aria-hidden /> Checking format…</> : <>Verify and continue <ArrowRight size={17} aria-hidden /></>}
            </button>
            <button type="button" className="os-btn os-btn-text os-btn-sm w-100" onClick={() => { setStage("credentials"); setCode(""); }}>
              <RotateCcw size={14} aria-hidden /> Use a different sign-in method
            </button>
          </div>
          <p className="os-inline-note"><Info size={13} aria-hidden /> Format check only. Codes are never verified against a server here.</p>
        </form>
      ) : (
        <form className="os-signin-body" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="os-field">
            <label htmlFor="si-identifier">Email or phone <span className="os-req">required</span></label>
            <div className="os-input-wrap">
              {identifier?.trim().startsWith("+") || /^0[17]/.test(identifier ?? "") ? <Phone size={17} aria-hidden /> : <Mail size={17} aria-hidden />}
              <input id="si-identifier" type="text" autoComplete="username" placeholder="trader@example.com" className={fieldClass("identifier")} aria-invalid={!!errors.identifier} {...register("identifier")} />
              <button type="button" className="os-inline-action" onClick={useKenyanFormat}>Use +254</button>
            </div>
            <FieldError message={errors.identifier?.message} />
          </div>

          {mode === "password" && (
            <div className="os-field">
              <label htmlFor="si-password">Password <span className="os-req">required</span></label>
              <div className="os-input-wrap">
                <LockKeyhole size={17} aria-hidden />
                <input id="si-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="At least 10 characters" className={fieldClass("password")} aria-invalid={!!errors.password} {...register("password")} />
                <button type="button" className="os-input-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <FieldError message={errors.password?.message} />
              <button type="button" className="os-text-action" onClick={() => toast("Opening the password reset flow")}><KeyRound size={13} aria-hidden /> <Link to="/auth/forgot-password">Forgot your password?</Link></button>
            </div>
          )}

          {mode === "otp" && (
            <div className="os-otp-explain">
              <Sparkles size={17} aria-hidden />
              <div><strong>Passwordless sign-in</strong><p>A 6-digit code goes to the identifier above. It expires in 10 minutes and is single-use.</p></div>
            </div>
          )}

          <label className={`os-remember ${errors.remember ? "is-invalid" : ""}`}>
            <input type="checkbox" {...register("remember")} />
            <span><strong>Remember me for 30 days</strong><small>Bound to this device only. Leave it off on shared computers.</small></span>
            <span className={`os-remember-state ${remember ? "is-on" : ""}`}>{remember ? "30 DAYS" : "SESSION ONLY"}</span>
          </label>

          <button type="submit" className="os-btn os-btn-primary os-btn-lg w-100" disabled={credential.isPending || isSubmitting}>
            {credential.isPending
              ? <><Loader2 size={18} className="os-spin" aria-hidden /> Validating locally…</>
              : <>{mode === "password" ? <>Sign in <LogIn size={17} aria-hidden /></> : <>Send one-time code <ArrowRight size={17} aria-hidden /></>}</>}
          </button>
          <p className="os-inline-note"><LockKeyhole size={13} aria-hidden /> Frontend-only preview. Nothing is sent, checked or stored.</p>
        </form>
      )}

      <div className="os-signin-foot">
        <span>New to OStrade? <Link to="/auth/signup">Create an account</Link></span>
        <span className="os-signin-foot-links">
          <Link to="/auth/forgot-password">Forgot password</Link>
          <Link to="/status">Status page</Link>
          <Link to="/legal/$doc" params={{ doc: "risk" }}>Risk disclosure</Link>
        </span>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</span>;
}

/* ───────────────── S1 · redirect map rail ───────────────── */

function RedirectMap() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["redirect-nodes"], queryFn: getRedirectNodes });
  return (
    <div className="os-map">
      <div className="os-map-head">
        <span className="os-map-icon"><UserRoundCheck size={19} aria-hidden /></span>
        <div><strong>After you sign in</strong><span>Role-aware redirect · single-operator model</span></div>
      </div>
      {isError ? <QueryError title="Could not load the redirect map" onRetry={() => refetch()} /> : isPending ? (
        <div className="d-grid gap-3">{Array.from({ length: 4 }, (_, i) => <Skel key={i} h={54} />)}</div>
      ) : (
        <ol className="os-map-list">
          {data.map((n, i) => (
            <Reveal as="li" delay={i * 120} key={n.id}>
              <span className="os-map-node os-mono">{n.step}</span>
              <div><strong>{n.title}</strong><p>{n.detail}</p><span className="os-mono os-map-mono">{n.mono}</span></div>
            </Reveal>
          ))}
        </ol>
      )}
      <div className="os-map-destination">
        <span className="os-map-dest-label">Landing page</span>
        <code className="os-mono">/dashboard · T-1 Command Center</code>
        <span className="os-map-dest-note">Missing setup routes to the fix instead — never to an empty screen.</span>
      </div>
    </div>
  );
}

function SigninHero({ mode, setMode }: { mode: "password" | "otp"; setMode: (m: "password" | "otp") => void }) {
  return (
    <section className="os-auth-hero" aria-labelledby="os-signin-title">
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
            <Link to="/auth/signup" className="os-btn os-btn-ghost os-btn-sm">Create account</Link>
          </div>
        </header>
        <span id="os-signin-title" className="visually-hidden">Sign in to OStrade</span>
        <div className="os-auth-grid">
          <Reveal className="os-card-col"><SigninCard mode={mode} setMode={setMode} /></Reveal>
          <Reveal delay={120} className="os-map-col"><RedirectMap /></Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S2 · two ways in ───────────────── */

function Methods({ onChoose }: { onChoose: (m: "password" | "otp") => void }) {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["signin-methods"], queryFn: getSignInMethods });
  return (
    <section className="os-section os-band" aria-labelledby="os-methods-title">
      <div className="container">
        <SectionHead eyebrow="Sign-in methods" title={<span id="os-methods-title">Two ways in. Same destination.</span>} lead="Pick the password path on hardware you control, or the passwordless path when you cannot reach your passphrase — both end at the same role-aware redirect." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? (
          <div className="row g-4 row-cols-1 row-cols-lg-2">{Array.from({ length: 2 }, (_, i) => <div className="col" key={i}><Skel h={300} className="rounded-4" /></div>)}</div>
        ) : (
          <div className="row g-4 row-cols-1 row-cols-lg-2">
            {data.map((m, i) => {
              const Icon = m.id === "password" ? LockKeyhole : Smartphone;
              return (
                <div className="col" key={m.id}>
                  <Reveal delay={i * 100} className="h-100">
                    <article className={`os-method-card is-${m.id}`}>
                      <div className="os-method-card-head">
                        <span className="os-method-card-icon"><Icon size={21} aria-hidden /></span>
                        <div><h3>{m.name}</h3><span>{m.tagline}</span></div>
                      </div>
                      <p className="os-method-when">{m.whenToUse}</p>
                      <ul className="os-method-needs">{m.needs.map((n) => <li key={n}><Check size={15} aria-hidden />{n}</li>)}</ul>
                      <div className="os-method-fallback"><KeyRound size={15} aria-hidden />{m.fallback}</div>
                      <button type="button" className="os-btn os-btn-primary w-100" onClick={() => onChoose(m.id)}>
                        Use this method <ArrowRight size={16} aria-hidden />
                      </button>
                    </article>
                  </Reveal>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S3 · second factor + practices ───────────────── */

function SecondFactor() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["security-practices"], queryFn: getSecurityPractices });
  const [demo, setDemo] = useState("");
  const [demoNote, setDemoNote] = useState<string | null>(null);
  const toast = useToast();

  const checkDemo = () => {
    if (demo.length !== 6) {
      setDemoNote("Enter all six digits to test the auto-advance inputs.");
      toast("Six digits required");
      return;
    }
    setDemoNote(`Format accepted (${demo.length} digits). Real verification opens with the backend.`);
    toast("Format checked");
  };

  return (
    <section className="os-section" aria-labelledby="os-2fa-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-5">
            <SectionHead center={false} eyebrow="Second factor" title={<span id="os-2fa-title">Inline 2FA, not a second page</span>} lead="The six-digit challenge appears on the same card you already filled in, so there is nothing extra to trust. Digits auto-advance, and a full code can be pasted into any box." />
            <Reveal delay={80} className="os-totp-demo">
              <div className="os-totp-demo-head">
                <span className="os-totp-badge">TOTP · 6</span>
                <span className="os-demo-label">Try the inputs</span>
              </div>
              <OtpInputs value={demo} onChange={(v) => { setDemo(v); setDemoNote(null); }} label="Demo two-factor code" />
              <div className="os-totp-demo-actions">
                <button type="button" className="os-btn os-btn-dark os-btn-sm" onClick={checkDemo}><ShieldCheck size={15} aria-hidden /> Check format</button>
                <button type="button" className="os-btn os-btn-text os-btn-sm" onClick={() => { setDemo(""); setDemoNote("Cleared. Type or paste any six digits to try again."); toast("Demo code cleared"); }}>
                  <RotateCcw size={14} aria-hidden /> Clear
                </button>
              </div>
              {demoNote && <p className="os-totp-note" role="status">{demoNote}</p>}
              <p className="os-totp-foot"><Info size={13} aria-hidden /> A recovery code is always available as a fallback if the authenticator is lost.</p>
            </Reveal>
          </div>
          <div className="col-lg-7">
            {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-1 row-cols-sm-2">{Array.from({ length: 10 }, (_, i) => <div className="col" key={i}><Skel h={112} className="rounded-3" /></div>)}</div> : (
              <div className="row g-3 row-cols-1 row-cols-sm-2">
                {data.map((p, i) => (
                  <div className="col" key={p.id}>
                    <Reveal delay={(i % 4) * 60} className="h-100">
                      <div className="os-practice">
                        <span className="os-practice-n os-mono">{String(i + 1).padStart(2, "0")}</span>
                        <strong>{p.title}</strong>
                        <p>{p.text}</p>
                      </div>
                    </Reveal>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S4 · role-aware redirect ───────────────── */

function Roles() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["role-redirects"], queryFn: getRoleRedirects });
  return (
    <section className="os-section os-band" aria-labelledby="os-roles-title">
      <div className="container">
        <SectionHead eyebrow="Role-aware redirect" title={<span id="os-roles-title">Where you land depends on what you are</span>} lead="One role by default — trader. The first account on an instance is also the master admin. Everything else is a state, and each state has a deliberate landing page." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <Skel h={420} className="rounded-4" /> : (
          <Reveal className="os-roles-wrap">
            <div className="os-roles-scroll" tabIndex={0} role="region" aria-label="Role redirect table">
              <table className="os-roles-table">
                <thead><tr><th>Role / state</th><th>Scope</th><th>Lands on</th><th>What you see</th></tr></thead>
                <tbody>{data.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Role"><strong>{r.role}</strong></td>
                    <td data-label="Scope"><span className="os-scope-chip">{r.scope}</span></td>
                    <td data-label="Lands on"><code className="os-mono">{r.landsOn}</code></td>
                    <td data-label="What you see">{r.note}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="os-roles-foot"><Info size={15} aria-hidden /> Routes shown are destinations inside the product. The dashboard pages arrive in a later build step.</div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S5 · session policies ───────────────── */

function Policies() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["session-policies"], queryFn: getSessionPolicies });
  return (
    <section className="os-section" aria-labelledby="os-policy-title">
      <div className="container">
        <SectionHead eyebrow="Session policy" title={<span id="os-policy-title">“Remember me” is a promise with a shape</span>} lead="Thirty days, this device, opt-in only. Here is the full session contract — the numbers the sign-in card actually uses." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-5">{Array.from({ length: 10 }, (_, i) => <div className="col" key={i}><Skel h={128} className="rounded-3" /></div>)}</div> : (
          <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-5">
            {data.map((p, i) => (
              <div className="col" key={p.id}>
                <Reveal delay={(i % 5) * 55} className="h-100">
                  <div className="os-policy-card">
                    <span className="os-policy-value os-mono">{p.value}</span>
                    <strong>{p.title}</strong>
                    <p>{p.detail}</p>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S6 · recent sessions ───────────────── */

function Sessions({ revokeResult, setRevokeResult }: { revokeResult: InertAuthResult | null; setRevokeResult: (v: InertAuthResult | null) => void }) {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["recent-sessions"], queryFn: getRecentSessions });
  const [revoked, setRevoked] = useState<string[]>([]);
  const [revokeAll, setRevokeAll] = useState(false);
  const toast = useToast();
  const revokeMutation = useMutation({ mutationFn: revokeAllSessions });

  const effective = (s: RecentSession) => (revoked.includes(s.id) || revokeAll ? "Revoked" : s.status) as RecentSession["status"];
  const activeCount = (data ?? []).filter((s) => ["Current", "Active"].includes(effective(s))).length;

  return (
    <section className="os-section os-band" aria-labelledby="os-sessions-title">
      <div className="container">
        <div className="row g-4 g-lg-5 align-items-end mb-4">
          <div className="col-lg-8">
            <SectionHead center={false} eyebrow="Devices & sessions" title={<span id="os-sessions-title">Every remembered device, in one list</span>} lead="Sample session data — twelve entries with device, location, method and status. Revoke a single device, or end them all at once." />
          </div>
          <div className="col-lg-4">
            <Reveal delay={80} className="os-session-actions">
              <span className="os-session-count os-mono">{activeCount} active</span>
              <button type="button" className="os-btn os-btn-dark" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(undefined, { onSuccess: (r) => { setRevokeAll(true); setRevoked((data ?? []).map((s) => s.id)); toast("Every device signed out (preview)"); setRevokeResult(r); } })}>
                {revokeMutation.isPending ? <Loader2 size={16} className="os-spin" /> : <MonitorSmartphone size={16} aria-hidden />} Sign out everywhere
              </button>
            </Reveal>
          </div>
        </div>
        {revokeAll && revokeResult && <Reveal className="mb-3"><ReadyCard result={revokeResult} onReset={() => { setRevokeAll(false); setRevoked([]); revokeMutation.reset(); setRevokeResult(null); }} label="Restore sample list" /></Reveal>}
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <Skel h={380} className="rounded-4" /> : (
          <Reveal className="os-sessions-wrap">
            <div className="os-sessions-scroll" tabIndex={0} role="region" aria-label="Recent sign-in sessions">
              <table className="os-sessions-table">
                <thead><tr><th>Device</th><th>Location</th><th>IP</th><th>Method</th><th>Last active</th><th>Status</th><th><span className="visually-hidden">Action</span></th></tr></thead>
                <tbody>{data.map((s) => {
                  const status = effective(s);
                  return (
                    <tr key={s.id}>
                      <td data-label="Device"><span className="os-device">{s.device.includes("Phone") || s.device.includes("iPhone") || s.device.includes("Pixel") || s.device.includes("Galaxy") || s.device.includes("Redmi") || s.device.includes("iPad") ? <Smartphone size={15} /> : <Laptop size={15} />} <span><strong>{s.device}</strong><small>{s.browser}</small></span></span></td>
                      <td data-label="Location">{s.location}</td>
                      <td data-label="IP" className="os-mono">{s.ip}</td>
                      <td data-label="Method">{s.method}</td>
                      <td data-label="Last active" className="os-mono">{s.lastActive}</td>
                      <td data-label="Status"><span className={`os-status-chip is-${status.toLowerCase()}`}>{status}</span></td>
                      <td>{status === "Revoked" ? <span className="os-row-note">—</span> : <button type="button" className="os-revoke" onClick={() => { setRevoked((r) => [...r, s.id]); toast(`${s.device} signed out (preview)`); }}>Revoke</button>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <div className="os-sessions-foot"><ShieldCheck size={15} aria-hidden /> Local sample data only. Revoking here changes nothing outside this browser.</div>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S7 · recovery ───────────────── */

function Recovery() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["recovery-options"], queryFn: getRecoveryOptions });
  return (
    <section className="os-section" aria-labelledby="os-recovery-title">
      <div className="container">
        <SectionHead eyebrow="Account recovery" title={<span id="os-recovery-title">Locked out is a route, not a dead end</span>} lead="Ten documented paths back in — password reset, one-time codes, 2FA recovery and the status page when something else is wrong." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-5">{Array.from({ length: 10 }, (_, i) => <div className="col" key={i}><Skel h={170} className="rounded-3" /></div>)}</div> : (
          <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-5">
            {data.map((r, i) => (
              <div className="col" key={r.id}>
                <Reveal delay={(i % 5) * 55} className="h-100">
                  <article className="os-recovery">
                    <span className="os-recovery-n os-mono">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{r.title}</h3>
                    <p>{r.text}</p>
                    <RecoveryLink option={r} />
                  </article>
                </Reveal>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S8 · post sign-in panels ───────────────── */

function PostSignIn() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["post-signin-panels"], queryFn: getPostSignInPanels });
  return (
    <section className="os-section os-band" aria-labelledby="os-post-title">
      <div className="container">
        <SectionHead eyebrow="After the redirect" title={<span id="os-post-title">Ten panels waiting at /dashboard</span>} lead="OStrade is a signal hub, not a broker dashboard clone. These are the surfaces a trader opens on day one." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-5">{Array.from({ length: 10 }, (_, i) => <div className="col" key={i}><Skel h={140} className="rounded-3" /></div>)}</div> : (
          <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-5">
            {data.map((p, i) => (
              <div className="col" key={p.id}>
                <Reveal delay={(i % 5) * 55} className="h-100">
                  <article className={`os-panel-card ${p.highlight ? "is-highlight" : ""}`}>
                    <span className="os-panel-code os-mono">{p.code}</span>
                    <strong>{p.name}</strong>
                    <p>{p.blurb}</p>
                  </article>
                </Reveal>
              </div>
            ))}
          </div>
        )}
        <div className="text-center mt-5">
          <Link to="/how-it-works" className="os-btn os-btn-ghost">See how a signal reaches these panels <ArrowRight size={16} aria-hidden /></Link>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S9 · FAQ ───────────────── */

function SigninFaq() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["signin-faqs"], queryFn: getSignInFaqs });
  const [open, setOpen] = useState<string | null>("q01");
  return (
    <section className="os-section" aria-labelledby="os-faq-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4">
            <SectionHead center={false} eyebrow="FAQ" title={<span id="os-faq-title">Questions about getting back in</span>} lead="Phone sign-in, the 30-day session, 2FA, recovery codes, where you land and what this preview actually checks." />
            <Reveal delay={80} className="d-flex flex-wrap gap-2">
              <Link to="/auth/signup" className="os-btn os-btn-ghost os-btn-sm">Create an account</Link>
              <Link to="/status" className="os-btn os-btn-text os-btn-sm">System status</Link>
            </Reveal>
          </div>
          <div className="col-lg-8">
            {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="d-grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skel key={i} h={62} className="rounded-4" />)}</div> : (
              <div className="os-faq">
                {data.map((f) => {
                  const isOpen = open === f.id;
                  return (
                    <div className={`os-faq-item ${isOpen ? "is-open" : ""}`} key={f.id}>
                      <h3><button type="button" aria-expanded={isOpen} aria-controls={`si-panel-${f.id}`} id={`si-btn-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}><span>{f.q}</span><ChevronDown size={20} aria-hidden /></button></h3>
                      <div className="os-faq-panel" id={`si-panel-${f.id}`} role="region" aria-labelledby={`si-btn-${f.id}`}><div><p>{f.a}</p></div></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S10 · legal ───────────────── */

function LegalPanel() {
  return (
    <section className="os-section os-band os-legal-section" aria-labelledby="os-legal-title">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-7">
            <Reveal className="os-risk-card">
              <span className="os-risk-icon"><ShieldAlert size={22} aria-hidden /></span>
              <div>
                <h2 id="os-legal-title">Risk disclosure — required reading</h2>
                <p>Trading forex, CFDs, synthetic indices and crypto involves a high risk of loss and is not suitable for everyone. You can lose more than you deposit. OStrade is execution and organisation software, not investment advice, and never holds your funds. Past performance does not guarantee future results. Practise on a paper account first.</p>
              </div>
            </Reveal>
          </div>
          <div className="col-lg-5">
            <Reveal delay={80} className="os-legal-links">
              <h3>Documents & status</h3>
              <Link to="/legal/$doc" params={{ doc: "privacy" }}><FileText size={17} aria-hidden /> Privacy policy <ArrowUpRight size={15} /></Link>
              <Link to="/legal/$doc" params={{ doc: "terms" }}><Scale size={17} aria-hidden /> Terms of service <ArrowUpRight size={15} /></Link>
              <Link to="/legal/$doc" params={{ doc: "risk" }}><ShieldAlert size={17} aria-hidden /> Risk disclosure <ArrowUpRight size={15} /></Link>
              <Link to="/status"><Activity size={17} aria-hidden /> System status <ArrowUpRight size={15} /></Link>
              <Link to="/auth/forgot-password"><KeyRound size={17} aria-hidden /> Forgot password <ArrowUpRight size={15} /></Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S11 · final band ───────────────── */

function FinalBand() {
  return (
    <section className="os-section os-final-section" aria-labelledby="os-final-title">
      <div className="container">
        <Reveal className="os-final-band">
          <span className="os-final-icon"><Zap size={24} aria-hidden /></span>
          <div><h2 id="os-final-title">No workspace yet?</h2><p>Start on a simulated $10,000 paper account, or read the full signal-to-fill walkthrough first. Trading involves risk.</p></div>
          <div className="os-final-actions">
            <Link to="/auth/signup" className="os-btn os-btn-primary">Create account <ArrowRight size={16} aria-hidden /></Link>
            <Link to="/how-it-works" className="os-btn os-btn-ghost">How it works</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────── page ───────────────── */

export function SigninPage() {
  usePageStyle("auth-signin", css);
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [revokeResult, setRevokeResult] = useState<InertAuthResult | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = "Sign in · OStrade";
    return () => { document.title = previous; };
  }, []);

  const chooseMethod = (m: "password" | "otp") => {
    setMode(m);
    document.getElementById("signin-card")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  };

  return (
    <main className="page-auth-signin">
      <SigninHero mode={mode} setMode={setMode} />
      <Methods onChoose={chooseMethod} />
      <SecondFactor />
      <Roles />
      <Policies />
      <Sessions revokeResult={revokeResult} setRevokeResult={setRevokeResult} />
      <Recovery />
      <PostSignIn />
      <SigninFaq />
      <LegalPanel />
      <FinalBand />
    </main>
  );
}
