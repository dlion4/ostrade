import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  LayoutDashboard,
  LogIn,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  signInWithOtp,
  signInWithPassword,
  verifySecondFactor,
  type InertAuthResult,
} from "@/services/auth-signin";
import css from "@/styles/pages/auth-signin.css?inline";

/* ───────────────── helpers ───────────────── */



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
          <Link to="/dashboard" className="os-btn os-btn-primary os-btn-lg w-100"><LayoutDashboard size={18} aria-hidden /> Proceed to Command Center <ArrowRight size={17} aria-hidden /></Link>
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
          <Link to="/dashboard" className="os-btn os-btn-ghost os-btn-lg w-100"><LayoutDashboard size={18} aria-hidden /> Proceed to Command Center</Link>
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
        <div className="os-auth-grid os-auth-center">
          <Reveal className="os-card-col"><SigninCard mode={mode} setMode={setMode} /></Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── page ───────────────── */

export function SigninPage() {
  usePageStyle("auth-signin", css);
  const [mode, setMode] = useState<"password" | "otp">("password");

  useEffect(() => {
    const previous = document.title;
    document.title = "Sign in · OStrade";
    return () => { document.title = previous; };
  }, []);

  return (
    <main className="page-auth-signin">
      <SigninHero mode={mode} setMode={setMode} />
    </main>
  );
}
