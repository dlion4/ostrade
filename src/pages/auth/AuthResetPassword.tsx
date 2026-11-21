import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import zxcvbn from "zxcvbn";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { OtpInputs } from "@/components/OtpInputs";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import { resetPassword, type InertAuthResult, type ResetSecuritySummary } from "@/services/auth-signin";
import css from "@/styles/pages/auth-reset-password.css?inline";

/* ───────────────── schema ───────────────── */

const resetSchema = z
  .object({
    password: z.string()
      .min(10, "Use at least 10 characters")
      .regex(/\d/, "Add at least one number")
      .regex(/[^A-Za-z0-9]/, "Add at least one symbol (!, #, $…)"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

type ResetValues = z.infer<typeof resetSchema>;

/* ───────────────── helpers ───────────────── */

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</span>;
}

const SCORE_LABEL = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];

function StrengthMeter({ password }: { password: string }) {
  const analysis = useMemo(() => (password ? zxcvbn(password) : null), [password]);
  if (!analysis) return null;
  const score = analysis.score;
  const feedback = analysis.feedback;
  return (
    <div aria-live="polite">
      <div className="os-strength">
        <div className="os-strength-bars">
          {[0, 1, 2, 3].map((i) => <span key={i} className={score > i || (score === 0 && i === 0) ? `is-on is-${score}` : ""} />)}
        </div>
        <span className="os-strength-label">{SCORE_LABEL[score]}</span>
      </div>
      {feedback.warning && (
        <span className="os-strength-warn mt-1"><AlertTriangle size={13} aria-hidden /> {feedback.warning}</span>
      )}
      {feedback.suggestions.length > 0 && (
        <ul className="os-policy mt-2">
          {feedback.suggestions.slice(0, 3).map((s) => <li key={s}><Info size={13} aria-hidden /> {s}</li>)}
        </ul>
      )}
    </div>
  );
}

/* ───────────────── page ───────────────── */

function ResetHero() {
  const toast = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [result, setResult] = useState<(InertAuthResult & { security: ResetSecuritySummary }) | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [autoRedirect, setAutoRedirect] = useState(true);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });
  const password = watch("password");

  const checks = [
    { label: "10+ characters", ok: password.length >= 10 },
    { label: "One number", ok: /\d/.test(password) },
    { label: "One symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];

  const reset = useMutation({
    mutationFn: resetPassword,
    onSuccess: (r) => {
      setResult(r);
      setCountdown(3);
      setAutoRedirect(true);
      toast("Reset checked locally — nothing was changed");
    },
  });

  const onSubmit = handleSubmit(() => {
    if (code.length !== 6) {
      setCodeError("Enter all six digits, or paste the full code into any box.");
      return;
    }
    setCodeError(null);
    reset.mutate({ code, password: "•".repeat(password.length) });
  });

  /* S4 — auto-redirect to /auth/signin after 3s */
  useEffect(() => {
    if (!result || !autoRedirect) return;
    const id = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(id);
          void navigate({ to: "/auth/signin" });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [result, autoRedirect, navigate]);

  return (
    <section className="os-auth-hero" aria-labelledby="os-reset-title">
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
            <Link to="/auth/signin" className="os-btn os-btn-ghost os-btn-sm"><ArrowLeft size={14} aria-hidden /> Back to sign-in</Link>
          </div>
        </header>
        <span id="os-reset-title" className="visually-hidden">Set a new password</span>

        <div className="os-auth-grid">
          <Reveal className="os-card-col">
            <div className="os-card">
              <div className="os-card-head">
                <div className="os-card-head-top">
                  <span className="os-step-chip os-mono">A-6 · NEW PASSWORD</span>
                  <span className="os-live-chip"><span className="os-pulse" /> RESET SESSION</span>
                </div>
                <h1>Set a new password</h1>
                <p>Enter the 6-digit code from your reset request, then choose a new password. <span className="os-mono">10+ characters, one number, one symbol.</span></p>
              </div>

              <div className="os-body">
                {result ? (
                  <>
                    {/* S5 — security note: all active sessions revoked */}
                    <div className="os-revoke-band" role="status">
                      <div className="os-revoke-head"><ShieldCheck size={17} aria-hidden /> Security sweep on reset</div>
                      <div className="os-revoke-grid">
                        <span className="os-revoke-pill"><LogOut size={13} aria-hidden /> {result.security.sessionsInvalidated} active sessions invalidated</span>
                        {result.security.wsTokensRevoked.map((t) => <span key={t} className="os-revoke-pill"><X size={13} aria-hidden /> {t} token revoked</span>)}
                      </div>
                      <p className="os-revoke-note">{result.security.note}</p>
                      <p className="os-revoke-note"><strong>All active sessions are revoked the moment a reset succeeds</strong> — anyone using a remembered device is signed out.</p>
                    </div>

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
                    </div>

                    {/* S4 — auto-redirect after 3s */}
                    <div className="os-countdown">
                      {autoRedirect
                        ? <>Returning to sign-in in <span className="os-mono">{countdown}</span>s…</>
                        : <>Auto-redirect paused — use the buttons below when ready.</>}
                      {autoRedirect && <button type="button" className="os-btn os-btn-primary" onClick={() => void navigate({ to: "/auth/signin" })}>Go now <ArrowRight size={15} aria-hidden /></button>}
                      {autoRedirect && <button type="button" className="os-btn os-btn-ghost" onClick={() => setAutoRedirect(false)}>Stay on this page</button>}
                    </div>
                  </>
                ) : (
                  <form className="os-fp-form" onSubmit={onSubmit} noValidate>
                    {/* S1 — OTP 6-digit input (auto-advance) */}
                    <div className="os-field">
                      <span className="os-field-label">Reset code <span className="os-req">required</span></span>
                      <OtpInputs value={code} onChange={(v) => { setCode(v); setCodeError(null); }} label="Reset code" invalid={!!codeError} idPrefix="rp-code" />
                      <FieldError message={codeError} />
                      <span className="os-field-hint">Pasting the full code fills every box. Codes expire 10 minutes after the request.</span>
                    </div>

                    {/* S2 — new password + confirm (zxcvbn strength meter) */}
                    <div className="os-field">
                      <label htmlFor="rp-password">New password <span className="os-req">required</span></label>
                      <div className="os-input-wrap">
                        <LockKeyhole size={17} aria-hidden />
                        <input id="rp-password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="At least 10 characters" className={`os-input ${errors.password ? "is-invalid" : ""}`} aria-invalid={!!errors.password} {...register("password")} />
                        <button type="button" className="os-input-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      <FieldError message={errors.password?.message} />
                      <StrengthMeter password={password} />
                      <ul className="os-policy">
                        {checks.map((c) => <li key={c.label} className={c.ok ? "is-ok" : ""}>{c.ok ? <Check size={14} aria-hidden /> : <X size={14} aria-hidden />}{c.label}</li>)}
                      </ul>
                    </div>

                    <div className="os-field">
                      <label htmlFor="rp-confirm">Confirm new password <span className="os-req">required</span></label>
                      <div className="os-input-wrap">
                        <KeyRound size={17} aria-hidden />
                        <input id="rp-confirm" type={showConfirm ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your new password" className={`os-input ${errors.confirmPassword ? "is-invalid" : ""}`} aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} />
                        <button type="button" className="os-input-toggle" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}>
                          {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      <FieldError message={errors.confirmPassword?.message} />
                    </div>

                    {/* S3 — reset button (invalidates sessions + revokes WS tokens) */}
                    <button type="submit" className="os-btn os-btn-primary os-btn-lg w-100" disabled={reset.isPending || isSubmitting}>
                      {reset.isPending || isSubmitting
                        ? <><Loader2 size={18} className="os-spin" aria-hidden /> Checking locally…</>
                        : <><ShieldCheck size={17} aria-hidden /> Reset password & sign out everywhere</>}
                    </button>
                    <p className="os-field-hint"><LogOut size={12} aria-hidden /> A successful reset invalidates every active session and revokes broker WebSocket tokens in memory — adapters reconnect with the stored credentials on your next sign-in.</p>
                  </form>
                )}
              </div>

              <div className="os-foot">
                <span>Didn't get a code? <Link to="/auth/forgot-password">Request a new one</Link></span>
                <span className="os-foot-links">
                  <Link to="/auth/signin">Sign in</Link>
                  <Link to="/status">Status page</Link>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function ResetPasswordPage() {
  usePageStyle("auth-reset-password", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Set a new password · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-auth-reset-password">
      <ResetHero />
    </main>
  );
}
