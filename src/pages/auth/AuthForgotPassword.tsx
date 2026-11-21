import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  Clock,
  Info,
  LifeBuoy,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import { requestPasswordResetOtp, type InertAuthResult } from "@/services/auth-signin";
import css from "@/styles/pages/auth-forgot-password.css?inline";

/* ───────────────── rate limits (mirrors the future backend rules) ───────────────── */

const COOLDOWN_MS = 60_000; // 1 send per 60 seconds
const HOURLY_LIMIT = 5; // 5 sends per rolling hour

function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);
}

function fmt(ms: number) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* ───────────────── schema ───────────────── */

const forgotSchema = z.object({
  identifier: z.string().trim()
    .min(1, "Enter the email or phone on the account")
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^\+254[17]\d{8}$/.test(v), {
      message: "Enter a valid email address or Kenyan number (+2547XXXXXXXX / +2541XXXXXXXX)",
    }),
});

type ForgotValues = z.infer<typeof forgotSchema>;

/* ───────────────── helpers ───────────────── */

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</span>;
}

function ReadyCard({ result }: { result: InertAuthResult }) {
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
    </div>
  );
}

/* ───────────────── page ───────────────── */

function ForgotHero() {
  const toast = useToast();
  const [sends, setSends] = useState<number[]>([]); // timestamps of this hour's sends
  const [result, setResult] = useState<InertAuthResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useTicker(sends.length > 0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const recent = sends.filter((at) => now - at < 3_600_000);
  const hourCount = recent.length;
  const lastSend = sends.length ? sends[sends.length - 1] : null;
  const cooldownLeft = lastSend ? Math.max(0, COOLDOWN_MS - (now - lastSend)) : 0;
  const hourBlocked = hourCount >= HOURLY_LIMIT;
  const cooling = cooldownLeft > 0;

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { identifier: "" },
  });
  const identifier = watch("identifier");

  const send = useMutation({
    mutationFn: requestPasswordResetOtp,
    onSuccess: (r) => {
      setResult(r);
      toast("Reset request checked locally — no code was sent");
    },
  });

  const onSubmit = handleSubmit((v) => {
    const channel = /^\+254/.test(v.identifier) ? "phone" as const : "email" as const;
    send.mutate({ identifier: v.identifier.toLowerCase(), channel }, {
      onSuccess: () => setSends((s) => [...s, Date.now()]),
    });
  });

  const useKenyanFormat = () => {
    const raw = identifier.trim();
    let next = raw;
    if (raw === "") next = "+2547";
    else if (/^0[17]\d{8}$/.test(raw)) next = `+254${raw.slice(1)}`;
    else if (/^254[17]\d{8}$/.test(raw)) next = `+${raw}`;
    setValue("identifier", next, { shouldValidate: true });
    toast(next === raw ? "Already in +254 international format" : `Formatted as ${next}`);
  };

  const phoneLike = identifier.trim().startsWith("+") || /^0[17]/.test(identifier);
  const sendDisabled = send.isPending || isSubmitting || cooling || hourBlocked;

  const buttonLabel = send.isPending || isSubmitting
    ? <><Loader2 size={18} className="os-spin" aria-hidden /> Sending request…</>
    : hourBlocked
      ? <>Hourly limit reached ({HOURLY_LIMIT} of {HOURLY_LIMIT})</>
      : cooling
        ? <>Resend available in {fmt(cooldownLeft)}</>
        : result
          ? <>Resend reset code <ArrowRight size={17} aria-hidden /></>
          : <>Send reset code <ArrowRight size={17} aria-hidden /></>;

  return (
    <section className="os-auth-hero" aria-labelledby="os-forgot-title">
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
            <Link to="/auth/signin" className="os-btn os-btn-ghost os-btn-sm">Try signing in instead</Link>
          </div>
        </header>
        <span id="os-forgot-title" className="visually-hidden">Reset your password</span>

        <div className="os-auth-grid">
          <Reveal className="os-card-col">
            <div className="os-fp-card">
              {/* S1 header */}
              <div className="os-fp-head">
                <div className="os-fp-head-top">
                  <span className="os-step-chip os-mono">A-5 · PASSWORD RESET</span>
                  <span className="os-live-chip"><span className="os-pulse" /> TRADER SUPPORT FLOW</span>
                </div>
                <h1>Reset your password</h1>
                <p>Enter the email or phone number on the account and we'll send a 6-digit reset code. You'll set a new password on the next page.</p>
              </div>

              <div className="os-fp-body">
                {result && <ReadyCard result={result} />}

                {/* S2 identifier + S3 send button */}
                <form className="os-fp-form" onSubmit={onSubmit} noValidate>
                  <div className="os-field">
                    <label htmlFor="fp-identifier">Email or phone <span className="os-req">required</span></label>
                    <div className="os-input-wrap">
                      {phoneLike ? <Phone size={17} aria-hidden /> : <Mail size={17} aria-hidden />}
                      <input id="fp-identifier" type="text" autoComplete="username" placeholder="trader@example.com or +2547XXXXXXXX" className={`os-input ${errors.identifier ? "is-invalid" : ""}`} aria-invalid={!!errors.identifier} {...register("identifier")} />
                      <button type="button" className="os-inline-action" onClick={useKenyanFormat}>Use +254</button>
                    </div>
                    <FieldError message={errors.identifier?.message} />
                    <span className="os-field-hint">Use the identifier you signed up with — codes are never sent anywhere else.</span>
                  </div>

                  <div className="os-rate-meter" role="status" aria-label="Rate limits">
                    <span className="os-rate-chip"><Clock size={12} aria-hidden /> 1 per 60s</span>
                    <span className={`os-rate-chip ${hourBlocked ? "is-capped" : hourCount > 0 ? "is-live" : ""}`}>
                      <Timer size={12} aria-hidden /> {hourCount} of {HOURLY_LIMIT} this hour
                    </span>
                    {cooling && <span className="os-cooldown-chip"><span className="os-pulse-dot" aria-hidden /> next send in {fmt(cooldownLeft)}</span>}
                    <span className="os-rate-note">Limits are preview-only; the backend enforces the real ones per identifier.</span>
                  </div>

                  <button type="submit" className="os-btn os-btn-primary os-btn-lg w-100" disabled={sendDisabled}>
                    {buttonLabel}
                  </button>
                  {hourBlocked && (
                    <p className="os-field-hint" role="alert"><AlertTriangle size={12} aria-hidden /> You've used all {HOURLY_LIMIT} requests for this hour. Wait for the window to clear, or <Link to="/auth/signin">try signing in instead</Link> — the code may already be with you.</p>
                  )}
                </form>

                {/* next steps after a send */}
                {result && (
                  <div className="os-next-steps">
                    <Link to="/auth/reset-password" className="os-btn os-btn-primary">I already have a code — enter it on the reset page <ArrowRight size={16} aria-hidden /></Link>
                    <Link to="/auth/signin" className="os-btn os-btn-ghost">Try signing in instead</Link>
                  </div>
                )}

                {/* S5 help block */}
                <div className="os-help-block">
                  <span className="os-help-head"><CircleHelp size={16} aria-hidden /> Didn't receive the code?</span>
                  <ul className="os-help-list">
                    <li><Check size={13} aria-hidden /> Check the spam or promotions folder when the identifier is an email.</li>
                    <li><Check size={13} aria-hidden /> Phone numbers must be in Kenyan format <span className="os-mono">+2547XXXXXXXX</span> or <span className="os-mono">+2541XXXXXXXX</span> — the "Use +254" button formats for you.</li>
                    <li><Check size={13} aria-hidden /> Codes expire after 10 minutes and are single-use; request a fresh one when the timer clears.</li>
                    <li><Check size={13} aria-hidden /> Still stuck? Check <Link to="/status">the status page</Link> for delivery incidents, or review <Link to="/legal/$doc" params={{ doc: "risk" }}>the risk disclosure</Link> if you're locked out of a live account.</li>
                    <li><LifeBuoy size={13} aria-hidden /> This preview never sends anything — when support goes live, it will be reachable from this block.</li>
                  </ul>
                </div>

                <p className="os-field-hint"><LockKeyhole size={12} aria-hidden /> Frontend-only preview. No code is sent, no account is looked up, and nothing leaves this browser.</p>
              </div>

              {/* S4 sign-in link in the card footer */}
              <div className="os-fp-foot">
                <span>Remembered it after all? <Link to="/auth/signin">Try signing in instead</Link></span>
                <span className="os-fp-foot-links">
                  <Link to="/auth/signup">Create an account</Link>
                  <Link to="/status">Status page</Link>
                  <ShieldCheck size={14} aria-hidden style={{ color: "var(--os-up)" }} />
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function ForgotPasswordPage() {
  usePageStyle("auth-forgot-password", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Reset your password · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-auth-forgot-password">
      <ForgotHero />
    </main>
  );
}
