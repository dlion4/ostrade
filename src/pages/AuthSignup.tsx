import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { QueryError } from "@/components/QueryError";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  createAccount,
  getOnboardingSteps,
  getQuoteSnapshots,
  getSecurityChecks,
  getSignupBenefits,
  getSignupFaqs,
  getSignupTrustPoints,
  getWorkspacePreviews,
  requestOtp,
  verifyOtp,
  type InertAuthResult,
} from "@/services/auth";
import css from "@/styles/pages/auth-signup.css?inline";

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

function ReadyCard({ result, onReset, label = "Back to the form" }: { result: InertAuthResult; onReset: () => void; label?: string }) {
  return (
    <div className="os-ready" role="status">
      <span className="os-ready-icon"><Info size={20} aria-hidden /></span>
      <div className="os-ready-body">
        <span className="os-ready-badge">READY · BACKEND REQUIRED</span>
        <h3>{result.title}</h3>
        <p>{result.message}</p>
        <p className="os-ready-detail">{result.detail}</p>
        <span className="os-mono os-ready-ref">ref {result.reference}</span>
      </div>
      <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={onReset}>{label}</button>
    </div>
  );
}

const TRUST_ICONS: Record<string, LucideIcon> = {
  lock: LockKeyhole, flask: FlaskConical, key: KeyRound, shield: ShieldCheck, wallet: WalletCards, check: BadgeCheck,
};

const signupSchema = z
  .object({
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    phone: z.string().trim().refine((v) => v === "" || /^\+254[17]\d{8}$/.test(v), {
      message: "Use Kenyan format +2547XXXXXXXX or +2541XXXXXXXX",
    }),
    password: z.string()
      .min(10, "Use at least 10 characters")
      .regex(/\d/, "Add at least one number")
      .regex(/[^A-Za-z0-9]/, "Add at least one symbol (!, #, $…)"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptTerms: z.boolean().refine((v) => v, { message: "You must accept the Terms" }),
    acceptRisk: z.boolean().refine((v) => v, { message: "You must accept the Risk Disclosure" }),
    verificationChannel: z.enum(["email", "phone"]),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

type SignupValues = z.infer<typeof signupSchema>;

/* ───────────────── S1 · brand panel ───────────────── */

function BrandPanel() {
  const quotes = useQuery({ queryKey: ["quote-snapshots"], queryFn: getQuoteSnapshots });
  return (
    <aside className="os-brand-panel" aria-label="OStrade command center preview">
      <div className="os-brand-glow" aria-hidden />
      <div className="os-brand-top">
        <span className="os-brand-logo"><Zap size={18} aria-hidden /> OStrade</span>
        <span className="os-brand-badge">A-1 · SIGN UP</span>
      </div>
      <div className="os-brand-copy">
        <span className="os-brand-kicker">Your signal-trading command center</span>
        <h2>One desk.<br /><em>Every broker.</em></h2>
        <p>Paste a signal, review the order card, and route it to Paper, Deriv or Exness/MT5. Automate it, schedule it, journal it.</p>
      </div>
      <div className="os-terminal">
        <div className="os-terminal-head">
          <span className="os-terminal-dots" aria-hidden><i /><i /><i /></span>
          <span>command-center / sample</span>
          <span className="os-terminal-static">STATIC SNAPSHOT</span>
        </div>
        <div className="os-terminal-body">
          <div className="os-term-signal">
            <span>SIGNAL IN · Gold Desk VIP</span>
            <div className="os-mono">XAUUSD BUY 2385.50<br />SL 2378.00 · TP 2402.00</div>
          </div>
          <div className="os-term-arrow" aria-hidden><ArrowRight size={16} /></div>
          <div className="os-term-order">
            <div><span className="os-mono">XAUUSD</span><span className="os-term-side">BUY</span></div>
            <span className="os-mono">0.10 lots · R:R 1 : 2.2</span>
            <span className="os-term-account">OStrade Paper · simulated</span>
          </div>
        </div>
        <div className="os-term-quotes">
          {quotes.isPending
            ? Array.from({ length: 4 }, (_, i) => <Skel key={i} h={36} />)
            : quotes.isError
              ? <button type="button" className="os-term-retry" onClick={() => quotes.refetch()}>Could not load sample quotes · Retry</button>
              : quotes.data.slice(0, 4).map((q) => (
                  <div className="os-term-quote" key={q.symbol}>
                    <span className="os-mono">{q.symbol}</span>
                    <span className="os-mono">{q.bid}</span>
                    <span className={`os-mono ${q.direction === "up" ? "os-term-up" : "os-term-down"}`}>{q.change}</span>
                  </div>
                ))}
        </div>
      </div>
      <p className="os-brand-foot"><ShieldCheck size={15} aria-hidden /> Sample data only. Prices here never tick; OStrade does not hold your funds.</p>
    </aside>
  );
}

/* ───────────────── S1 · signup form ───────────────── */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</span>;
}

function SignupForm() {
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [signupResult, setSignupResult] = useState<InertAuthResult | null>(null);

  const {
    register, handleSubmit, watch, setValue, reset, formState: { errors, touchedFields, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    defaultValues: {
      email: "", phone: "", password: "", confirmPassword: "",
      acceptTerms: false, acceptRisk: false, verificationChannel: "email",
    },
  });

  const password = watch("password");
  const phone = watch("phone");
  const email = watch("email");
  const channel = watch("verificationChannel");
  const terms = watch("acceptTerms");
  const risk = watch("acceptRisk");

  const checks = [
    { label: "10+ characters", ok: password.length >= 10 },
    { label: "One number", ok: /\d/.test(password) },
    { label: "One symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const strength = checks.filter((c) => c.ok).length + (password.length >= 16 ? 1 : 0);
  const strengthLabel = ["Too short", "Weak", "Fair", "Good", "Strong"][Math.min(4, strength)];

  const signup = useMutation({
    mutationFn: createAccount,
    onSuccess: (r) => { setSignupResult(r); toast("Local checks passed — ready for the backend"); },
  });
  const otpSend = useMutation({ mutationFn: () => requestOtp(channel, channel === "phone" ? phone : email) });
  const otpVerify = useMutation({ mutationFn: (code: string) => verifyOtp(code) });

  const onSubmit = (v: SignupValues) => {
    signup.mutate({
      email: v.email.toLowerCase(),
      phone: v.phone || undefined,
      password: v.password,
      verificationChannel: v.verificationChannel,
      acceptTerms: true,
      acceptRisk: true,
    });
  };

  const normalisePhone = () => {
    const raw = phone.trim();
    let next = raw;
    if (raw === "") next = "+2547";
    else if (/^0[17]\d{8}$/.test(raw)) next = `+254${raw.slice(1)}`;
    else if (/^254[17]\d{8}$/.test(raw)) next = `+${raw}`;
    setValue("phone", next, { shouldValidate: true });
    toast(next === raw ? "Already in +254 international format" : `Formatted as ${next}`);
  };

  const fillExample = () => {
    setValue("password", "Signal#Desk2025", { shouldValidate: true });
    setValue("confirmPassword", "Signal#Desk2025", { shouldValidate: true });
    toast("Example passphrase filled — replace it before going live");
  };

  const previewOtp = () => {
    otpSend.mutate(undefined, { onSuccess: () => toast("OTP delivery is inert in this preview") });
  };
  const verifyPreview = () => {
    if (!/^\d{6}$/.test(otp)) {
      setOtpError("Enter exactly 6 digits, or leave the preview code blank and choose delivery first.");
      toast("Preview code must be 6 digits");
      return;
    }
    setOtpError(null);
    otpVerify.mutate(otp, { onSuccess: () => toast("Format checked — verification opens with the backend") });
  };

  const fieldClass = (name: keyof SignupValues) =>
    `os-input ${errors[name] ? "is-invalid" : touchedFields[name] ? "is-valid" : ""}`;

  return (
    <div className="os-form-card">
      <div className="os-form-head">
        <span className="os-form-badge">STEP 01 OF 10</span>
        <h1>Create your account</h1>
        <p>The first account becomes the master admin of this OStrade instance.</p>
      </div>

      {signupResult ? (
        <div className="os-form-body">
          <ReadyCard result={signupResult} onReset={() => { setSignupResult(null); reset(); }} label="Edit details" />
          <Link to="/auth/broker-connect" className="os-btn os-btn-primary w-100 mt-3">See the next step: broker connect <ArrowRight size={16} /></Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="os-form-body">
            {/* Account basics */}
            <fieldset className="os-fieldset">
              <legend><span className="os-fieldset-n os-mono">01</span> Account basics</legend>
              <div className="os-field">
                <label htmlFor="su-email">Email address <span className="os-req">required</span></label>
                <div className="os-input-wrap"><Mail size={17} aria-hidden /><input id="su-email" type="email" autoComplete="email" placeholder="trader@example.com" className={fieldClass("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? "su-email-err" : undefined} {...register("email")} /></div>
                <div id="su-email-err"><FieldError message={errors.email?.message} /></div>
              </div>
              <div className="os-field">
                <label htmlFor="su-phone">Phone number <span className="os-opt">optional · Kenya +254 aware</span></label>
                <div className="os-input-wrap"><Phone size={17} aria-hidden /><input id="su-phone" type="tel" autoComplete="tel" placeholder="+2547XXXXXXXX" className={fieldClass("phone")} aria-invalid={!!errors.phone} {...register("phone")} /><button type="button" className="os-inline-action" onClick={normalisePhone}>Use +254</button></div>
                <FieldError message={errors.phone?.message} />
                <span className="os-field-hint">Used only for OTP and account alerts. Format: ^\+254[17]\d&#123;8&#125;$</span>
              </div>
              <div className="os-field">
                <span className="os-field-label">Verify via</span>
                <div className="os-radio-row" role="radiogroup" aria-label="Verification channel">
                  <label className={`os-radio ${channel === "email" ? "is-active" : ""}`}><input type="radio" value="email" {...register("verificationChannel")} /><Mail size={15} aria-hidden /> Email</label>
                  <label className={`os-radio ${channel === "phone" ? "is-active" : ""}`}><input type="radio" value="phone" {...register("verificationChannel")} /><Phone size={15} aria-hidden /> Phone</label>
                </div>
                {channel === "phone" && !phone && <span className="os-field-hint">Add a phone number above if you choose phone verification.</span>}
              </div>
            </fieldset>

            {/* Security */}
            <fieldset className="os-fieldset">
              <legend><span className="os-fieldset-n os-mono">02</span> Password security</legend>
              <div className="os-field">
                <label htmlFor="su-password">Password <span className="os-req">required</span></label>
                <div className="os-input-wrap"><LockKeyhole size={17} aria-hidden /><input id="su-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 10 characters" className={fieldClass("password")} aria-invalid={!!errors.password} {...register("password")} /><button type="button" className="os-input-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                <FieldError message={errors.password?.message} />
              </div>
              <div className="os-strength" aria-live="polite">
                <div className="os-strength-bars">{[0, 1, 2, 3].map((i) => <span key={i} className={strength > i ? `is-on is-${Math.min(4, strength)}` : ""} />)}</div>
                <span className="os-strength-label">{password ? strengthLabel : "Not set"}</span>
              </div>
              <div className="os-field">
                <label htmlFor="su-confirm">Confirm password <span className="os-req">required</span></label>
                <div className="os-input-wrap"><LockKeyhole size={17} aria-hidden /><input id="su-confirm" type={showConfirm ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your password" className={fieldClass("confirmPassword")} aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} /><button type="button" className="os-input-toggle" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}>{showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                <FieldError message={errors.confirmPassword?.message} />
              </div>
              <ul className="os-policy">
                {checks.map((c) => <li key={c.label} className={c.ok ? "is-ok" : ""}>{c.ok ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}{c.label}</li>)}
              </ul>
              <button type="button" className="os-text-action" onClick={fillExample}><Sparkles size={14} aria-hidden /> Fill an example passphrase</button>
            </fieldset>

            {/* OTP preview */}
            <fieldset className="os-fieldset">
              <legend><span className="os-fieldset-n os-mono">03</span> Verification preview</legend>
              <p className="os-fieldset-note">We'll send a <strong>6-digit OTP</strong> to verify your {channel === "phone" ? "phone" : "email"} before any broker credentials can be added.</p>
              <div className="os-otp-row" aria-label="Six digit code placeholder">{Array.from({ length: 6 }, (_, i) => <span key={i} className="os-mono">—</span>)}</div>
              <div className="os-otp-input">
                <label htmlFor="su-otp">Preview code (format check only)</label>
                <input id="su-otp" className="os-input os-mono" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(null); }} />
                <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={verifyPreview} disabled={otpVerify.isPending}>{otpVerify.isPending ? <Loader2 size={14} className="os-spin" /> : <ShieldCheck size={14} />} Verify format</button>
              </div>
              {otpError && <FieldError message={otpError} />}
              <button type="button" className="os-text-action" onClick={previewOtp} disabled={otpSend.isPending}>
                {otpSend.isPending ? <Loader2 size={14} className="os-spin" /> : <Mail size={14} />} Preview OTP delivery <ArrowUpRight size={13} />
              </button>
              {otpSend.data && <ReadyCard result={otpSend.data} onReset={() => otpSend.reset()} label="Dismiss" />}
              {otpVerify.data && <ReadyCard result={otpVerify.data} onReset={() => otpVerify.reset()} label="Dismiss" />}
            </fieldset>

            {/* Paper-first pledge */}
            <div className="os-pledge-mini">
              <span className="os-pledge-mini-icon"><FlaskConical size={19} aria-hidden /></span>
              <div><strong>Paper-first pledge</strong><p>You'll start with a simulated $10,000 USD account. No live keys, no real money, no pressure.</p></div>
              <span className="os-sim-badge">SIMULATED</span>
            </div>

            {/* Mandatory consents */}
            <fieldset className="os-fieldset os-consents">
              <legend><span className="os-fieldset-n os-mono">04</span> Required consents</legend>
              <label className={`os-consent ${errors.acceptTerms ? "is-invalid" : ""}`}>
                <input type="checkbox" {...register("acceptTerms")} />
                <span>I accept the <Link to="/legal/$doc" params={{ doc: "terms" }}>Terms of Service</Link> and understand this is a single-operator instance.</span>
              </label>
              <FieldError message={errors.acceptTerms?.message} />
              <label className={`os-consent ${errors.acceptRisk ? "is-invalid" : ""}`}>
                <input type="checkbox" {...register("acceptRisk")} />
                <span>I have read and accept the <Link to="/legal/$doc" params={{ doc: "risk" }}>Risk Disclosure</Link>. Trading involves a high risk of loss.</span>
              </label>
              <FieldError message={errors.acceptRisk?.message} />
              <div className="os-consent-status" aria-live="polite">
                <span className={terms ? "is-done" : ""}>{terms ? <Check size={13} /> : <X size={13} />} Terms</span>
                <span className={risk ? "is-done" : ""}>{risk ? <Check size={13} /> : <X size={13} />} Risk Disclosure</span>
                <span>Both are mandatory</span>
              </div>
            </fieldset>

            <button type="submit" className="os-btn os-btn-primary os-btn-lg w-100" disabled={signup.isPending || isSubmitting}>
              {signup.isPending ? <><Loader2 size={18} className="os-spin" aria-hidden /> Validating locally…</> : <>Create account <ArrowRight size={18} aria-hidden /></>}
            </button>
            <p className="os-submit-note"><LockKeyhole size={13} aria-hidden /> Frontend-only preview. No account is created, no email is sent, and nothing leaves this browser.</p>
          </div>
        </form>
      )}

      <div className="os-form-foot">
        <span>Already registered? <Link to="/auth/signin">Sign in</Link></span>
        <span className="os-form-foot-links">
          <Link to="/auth/forgot-password">Forgot password</Link>
          <Link to="/legal/$doc" params={{ doc: "privacy" }}>Privacy</Link>
          <Link to="/legal/$doc" params={{ doc: "risk" }}>Risk Disclosure</Link>
        </span>
      </div>
    </div>
  );
}

function SplitHero() {
  return (
    <section className="os-auth-hero" aria-labelledby="os-signup-title">
      <div className="container">
        <div className="os-auth-grid">
          <Reveal className="os-brand-col"><BrandPanel /></Reveal>
          <Reveal delay={100} className="os-form-col" aria-labelledby="os-signup-title"><SignupForm /></Reveal>
        </div>
        <span id="os-signup-title" className="visually-hidden">Create your OStrade account</span>
      </div>
    </section>
  );
}

/* ───────────────── S2 · trust strip ───────────────── */

function TrustStrip() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["signup-trust-points"], queryFn: getSignupTrustPoints });
  return (
    <section className="os-section os-trust-section" aria-label="Account security promises">
      <div className="container">
        <p className="os-strip-label">Built for careful traders, not speed-at-all-costs</p>
        {isError ? <QueryError onRetry={() => refetch()} /> : (
          <ul className="os-trust-strip">
            {isPending ? Array.from({ length: 10 }, (_, i) => <li key={i}><Skel h={54} w={190} /></li>) : data.map((t) => {
              const Icon = TRUST_ICONS[t.icon] ?? ShieldCheck;
              return <li key={t.title} title={t.text}><Icon size={16} aria-hidden /><span><strong>{t.title}</strong><small>{t.text}</small></span></li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S3 · paper-first pledge + workspace preview ───────────────── */

function PaperPledge() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["workspace-previews"], queryFn: getWorkspacePreviews });
  const [mode, setMode] = useState<"all" | "simulated" | "demo">("all");
  const toast = useToast();
  const rows = (data ?? []).filter((w) => mode === "all" || (mode === "simulated" ? w.mode === "Simulated" : w.mode === "Broker demo"));
  return (
    <section className="os-section os-band" aria-labelledby="os-pledge-title">
      <div className="container">
        <div className="row g-5 align-items-start">
          <div className="col-lg-5">
            <SectionHead center={false} eyebrow="Paper-first pledge" title={<span id="os-pledge-title">Start simulated. Stay simulated as long as you like.</span>} lead="New workspaces begin on OStrade Paper with $10,000 of simulated balance. Connect live keys only when the workflow feels boringly familiar." />
            <Reveal delay={80} className="os-pledge-card">
              <span className="os-pledge-icon"><FlaskConical size={24} aria-hidden /></span>
              <h3>What paper mode gives you</h3>
              <ul>
                <li><Check size={16} aria-hidden /> Signal → parsed card → simulated fill with a real-looking ref</li>
                <li><Check size={16} aria-hidden /> Positions, Records and analytics entries that update locally</li>
                <li><Check size={16} aria-hidden /> Rules and schedules you can rehearse without exposure</li>
                <li><Check size={16} aria-hidden /> One switch to change the whole workspace to live later</li>
              </ul>
              <span className="os-sim-badge">SIMULATED · NO REAL FUNDS</span>
            </Reveal>
          </div>
          <div className="col-lg-7">
            <Reveal className="os-workspace">
              <div className="os-workspace-head">
                <div><strong>Workspace presets</strong><span>10 local sample environments</span></div>
                <div className="os-seg" role="tablist" aria-label="Filter workspace presets">
                  {(["all", "simulated", "demo"] as const).map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "is-active" : ""} onClick={() => { setMode(m); toast(`Showing ${m === "all" ? "all" : m} presets`); }}>
                      {m === "all" ? "All" : m === "simulated" ? "Paper" : "Broker demo"}
                    </button>
                  ))}
                </div>
              </div>
              {isError ? <QueryError title="Could not load workspace presets" onRetry={() => refetch()} /> : isPending ? <Skel h={380} className="rounded-4" /> : (
                <div className="os-workspace-scroll">
                  <table className="os-workspace-table">
                    <thead><tr><th>Workspace</th><th>Balance</th><th>Leverage</th><th>Mode</th><th>Note</th></tr></thead>
                    <tbody>{rows.map((w) => <tr key={w.id}><td data-label="Workspace"><strong className="os-mono">{w.name}</strong></td><td data-label="Balance" className="os-mono">{w.currency} {w.balance}</td><td data-label="Leverage" className="os-mono">{w.leverage}</td><td data-label="Mode"><span className={`os-mode-chip ${w.mode === "Simulated" ? "is-sim" : "is-demo"}`}>{w.mode}</span></td><td data-label="Note">{w.note}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              <div className="os-workspace-foot"><Info size={15} aria-hidden /> Presets are illustrations. No environment is provisioned in this frontend preview.</div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S4 · onboarding journey ───────────────── */

function Journey() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["onboarding-steps"], queryFn: getOnboardingSteps });
  return (
    <section className="os-section" aria-labelledby="os-journey-title">
      <div className="container">
        <SectionHead eyebrow="Onboarding journey" title={<span id="os-journey-title">Ten steps between here and your first fill</span>} lead="Each stage opens when its page is built. You can explore the public guides now, and the auth stubs later." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-1 row-cols-md-2 row-cols-xl-5">{Array.from({ length: 10 }, (_, i) => <div className="col" key={i}><Skel h={170} className="rounded-4" /></div>)}</div> : (
          <ol className="os-journey">
            {data.map((s, i) => (
              <Reveal as="li" delay={(i % 5) * 60} key={s.id} className={i === 0 ? "is-current" : ""}>
                <span className="os-journey-n os-mono">{String(i + 1).padStart(2, "0")}</span>
                <span className="os-journey-code">{s.code}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <Link to={s.route} className="os-journey-link">{i === 0 ? "You are here" : "Open step"} <ArrowUpRight size={14} aria-hidden /></Link>
              </Reveal>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ───────────────── S5 · security matrix ───────────────── */

function SecurityMatrix() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["security-checks"], queryFn: getSecurityChecks });
  const [scope, setScope] = useState<"all" | "Form" | "Account" | "Platform">("all");
  const rows = (data ?? []).filter((c) => scope === "all" || c.scope === scope);
  return (
    <section className="os-section os-band" aria-labelledby="os-security-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4">
            <SectionHead center={false} eyebrow="Validation & security" title={<span id="os-security-title">Every rule shown before you hit submit</span>} lead="The sign-up form checks ten things locally. The remaining platform controls appear before any live broker connection." />
            <Reveal delay={80} className="os-security-aside">
              <span className="os-security-aside-icon"><LockKeyhole size={22} aria-hidden /></span>
              <h3>Credential safety, by design</h3>
              <p>No broker secrets are collected here. When the backend exists, the model is AES-256 encrypted storage, trade-only key scopes, 2FA and revocation from either side.</p>
              <Link to="/brokers" className="os-link-arrow">Read the broker guide <ArrowRight size={15} /></Link>
            </Reveal>
          </div>
          <div className="col-lg-8">
            <Reveal className="os-security-panel">
              <div className="os-security-filters" role="tablist" aria-label="Filter security checks">
                {(["all", "Form", "Account", "Platform"] as const).map((s) => (
                  <button key={s} type="button" role="tab" aria-selected={scope === s} className={scope === s ? "is-active" : ""} onClick={() => setScope(s)}>{s === "all" ? "All checks" : s}</button>
                ))}
              </div>
              {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="d-grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skel key={i} h={58} className="rounded-3" />)}</div> : (
                <ul className="os-check-list">
                  {rows.map((c) => (
                    <li key={c.id}>
                      <span className="os-check-mark"><Check size={14} /></span>
                      <div><strong>{c.label}</strong><small>{c.detail}</small></div>
                      <span className="os-scope-chip">{c.scope}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S6 · workspace benefits ───────────────── */

function Benefits() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["signup-benefits"], queryFn: getSignupBenefits });
  return (
    <section className="os-section" aria-labelledby="os-benefits-title">
      <div className="container">
        <SectionHead eyebrow="Inside your workspace" title={<span id="os-benefits-title">Ten things waiting after sign-up</span>} lead="OStrade is a signal hub, not a broker dashboard clone. Everything here serves the path from a message to a journaled trade." />
        {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-5">{Array.from({ length: 10 }, (_, i) => <div className="col" key={i}><Skel h={160} className="rounded-4" /></div>)}</div> : (
          <div className="row g-3 row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-5">
            {data.map((b, i) => (
              <div className="col" key={b.id}>
                <Reveal delay={(i % 5) * 55} className="h-100">
                  <article className="os-benefit">
                    <span className="os-benefit-n os-mono">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{b.title}</h3>
                    <p>{b.text}</p>
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

/* ───────────────── S7 · static market coverage ───────────────── */

function StaticQuotes() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["quote-snapshots"], queryFn: getQuoteSnapshots });
  const [asset, setAsset] = useState("all");
  const classes = Array.from(new Set(data?.map((q) => q.assetClass) ?? [])).sort();
  const rows = (data ?? []).filter((q) => asset === "all" || q.assetClass === asset);
  return (
    <section className="os-section os-band" aria-labelledby="os-quotes-title">
      <div className="container">
        <SectionHead eyebrow="Market coverage" title={<span id="os-quotes-title">Static snapshots, never a live feed</span>} lead="These ten instruments show how symbols map across venues. Prices are fixed sample values — there is no tick simulator on this page." />
        <Reveal className="os-quotes-panel">
          <div className="os-quotes-head">
            <span className="os-static-badge"><ShieldCheck size={14} aria-hidden /> SAMPLE DATA · STATIC SNAPSHOT</span>
            <label htmlFor="quote-asset">Filter market</label>
            <select id="quote-asset" value={asset} onChange={(e) => setAsset(e.target.value)}>
              <option value="all">All markets</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {isError ? <QueryError title="Could not load market snapshots" onRetry={() => refetch()} /> : isPending ? <Skel h={400} className="rounded-4" /> : (
            <div className="os-quotes-scroll">
              <table className="os-quotes-table">
                <thead><tr><th>Symbol</th><th>Venue</th><th>Asset class</th><th>Bid</th><th>Ask</th><th>Session change</th></tr></thead>
                <tbody>{rows.map((q) => <tr key={q.symbol}><td data-label="Symbol" className="os-mono"><strong>{q.symbol}</strong></td><td data-label="Venue">{q.venue}</td><td data-label="Class"><span className="os-asset-chip">{q.assetClass}</span></td><td data-label="Bid" className="os-mono">{q.bid}</td><td data-label="Ask" className="os-mono">{q.ask}</td><td data-label="Change" className={`os-mono ${q.direction === "up" ? "os-up" : "os-down"}`}>{q.change} {q.direction === "up" ? "▲" : "▼"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="os-quotes-foot"><Info size={15} aria-hidden /> OStrade routes signals, it does not publish a price feed. Live quotes arrive only from a connected broker API.</div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────── S8 · FAQ ───────────────── */

function SignupFaq() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ["signup-faqs"], queryFn: getSignupFaqs });
  const [open, setOpen] = useState<string | null>("sf01");
  return (
    <section className="os-section" aria-labelledby="os-faq-title">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-4">
            <SectionHead center={false} eyebrow="Before you sign up" title={<span id="os-faq-title">Ten questions, answered plainly</span>} lead="No card, no broker keys, no real money — and no account actually created in this preview." />
            <Reveal delay={80} className="d-flex flex-wrap gap-2">
              <Link to="/how-it-works" className="os-btn os-btn-ghost os-btn-sm">How it works</Link>
              <a href="mailto:hello@ostrade.app" className="os-btn os-btn-text os-btn-sm">hello@ostrade.app</a>
            </Reveal>
          </div>
          <div className="col-lg-8">
            {isError ? <QueryError onRetry={() => refetch()} /> : isPending ? <div className="d-grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skel key={i} h={62} className="rounded-4" />)}</div> : (
              <div className="os-faq">
                {data.map((f) => {
                  const isOpen = open === f.id;
                  return (
                    <div className={`os-faq-item ${isOpen ? "is-open" : ""}`} key={f.id}>
                      <h3><button type="button" aria-expanded={isOpen} aria-controls={`su-panel-${f.id}`} id={`su-btn-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}><span>{f.q}</span><ChevronDown size={20} aria-hidden /></button></h3>
                      <div className="os-faq-panel" id={`su-panel-${f.id}`} role="region" aria-labelledby={`su-btn-${f.id}`}><div><p>{f.a}</p></div></div>
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

/* ───────────────── S9 · legal & risk panel ───────────────── */

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
              <h3>Documents & account help</h3>
              <Link to="/legal/$doc" params={{ doc: "privacy" }}><FileText size={17} aria-hidden /> Privacy policy <ArrowUpRight size={15} /></Link>
              <Link to="/legal/$doc" params={{ doc: "terms" }}><Scale size={17} aria-hidden /> Terms of service <ArrowUpRight size={15} /></Link>
              <Link to="/legal/$doc" params={{ doc: "risk" }}><ShieldAlert size={17} aria-hidden /> Risk disclosure <ArrowUpRight size={15} /></Link>
              <Link to="/auth/forgot-password"><KeyRound size={17} aria-hidden /> Forgot password <ArrowUpRight size={15} /></Link>
              <Link to="/auth/2fa"><LockKeyhole size={17} aria-hidden /> 2FA enrollment <ArrowUpRight size={15} /></Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── S10 · final band ───────────────── */

function FinalBand() {
  return (
    <section className="os-section os-final-section" aria-labelledby="os-final-title">
      <div className="container">
        <Reveal className="os-final-band">
          <span className="os-final-icon"><BookOpenCheck size={24} aria-hidden /></span>
          <div><h2 id="os-final-title">Already have an OStrade workspace?</h2><p>Sign in to your command center, or read the full signal-to-fill walkthrough before you create another.</p></div>
          <div className="os-final-actions">
            <Link to="/auth/signin" className="os-btn os-btn-primary">Sign in <ArrowRight size={16} aria-hidden /></Link>
            <Link to="/how-it-works" className="os-btn os-btn-ghost">How it works</Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────── page ───────────────── */

export function SignupPage() {
  usePageStyle("auth-signup", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Create your account · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-auth-signup">
      <SplitHero />
      <TrustStrip />
      <PaperPledge />
      <Journey />
      <SecurityMatrix />
      <Benefits />
      <StaticQuotes />
      <SignupFaq />
      <LegalPanel />
      <FinalBand />
    </main>
  );
}
