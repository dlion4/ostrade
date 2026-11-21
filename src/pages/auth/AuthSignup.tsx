import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  FlaskConical,
  Info,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  createAccount,
  getQuoteSnapshots,
  requestOtp,
  verifyOtp,
  type InertAuthResult,
} from "@/services/auth";
import css from "@/styles/pages/auth-signup.css?inline";

/* ───────────────── helpers ───────────────── */



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
          <Link to="/auth/onboard" className="os-btn os-btn-primary w-100 mt-3">Continue: set up your workspace <ArrowRight size={16} /></Link>
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
              <Link to="/auth/verify-otp" className="os-text-action">Prefer a full page? Open code verification <ArrowUpRight size={13} /></Link>
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
            <Link to="/auth/onboard" className="os-btn os-btn-ghost os-btn-lg w-100">Proceed to the onboarding wizard <ArrowRight size={17} aria-hidden /></Link>
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
    </main>
  );
}
