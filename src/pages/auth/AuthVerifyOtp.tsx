import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CircleHelp,
  Clock,
  Info,
  LifeBuoy,
  Loader2,
  Mail,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { OtpInputs } from "@/components/OtpInputs";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  getPendingVerificationTarget,
  requestOtp,
  verifyOtp,
  type InertAuthResult,
} from "@/services/auth";
import css from "@/styles/pages/auth-verify-otp.css?inline";

/* ───────────────── helpers ───────────────── */

const COOLDOWN_MS = 60_000;

function fmt(ms: number) {
  const total = Math.ceil(ms / 1000);
  return `0:${String(total % 60).padStart(2, "0")}`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</span>;
}

function ReadyCard({ result, onReset }: { result: InertAuthResult; onReset: () => void }) {
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
        </div>
      </div>
      <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={onReset}>Dismiss</button>
    </div>
  );
}

function TargetSkel() {
  return (
    <div className="os-target" aria-hidden>
      <Mail size={18} />
      <div>
        <Skel h={14} w={180} />
        <span className="mt-1 d-block"><Skel h={11} w={230} /></span>
      </div>
    </div>
  );
}

function Skel({ h, w }: { h: number; w?: number | string }) {
  return <span className="os-skel" style={{ height: h, width: w ?? "100%" }} />;
}

/* ───────────────── page ───────────────── */

function VerifyHero() {
  const toast = useToast();
  const target = useQuery({ queryKey: ["pending-verification-target"], queryFn: getPendingVerificationTarget });
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<InertAuthResult | null>(null);
  const [resendResult, setResendResult] = useState<InertAuthResult | null>(null);
  const [lastSend, setLastSend] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cooldownLeft = lastSend ? Math.max(0, COOLDOWN_MS - (now - lastSend)) : 0;
  const cooling = cooldownLeft > 0;
  const masked = target.data?.masked;
  const channel = target.data?.channel ?? "email";

  const verify = useMutation({
    mutationFn: verifyOtp,
    onSuccess: (r) => { setVerifyResult(r); toast("Format checked — verification opens with the backend"); },
  });
  const resend = useMutation({
    mutationFn: () => requestOtp(channel, masked ?? ""),
    onSuccess: (r) => { setResendResult(r); setLastSend(Date.now()); toast("Resend checked locally — nothing was sent"); },
  });

  const submit = () => {
    if (code.length !== 6) {
      setCodeError("Enter all six digits, or paste the full code into any box.");
      return;
    }
    setCodeError(null);
    verify.mutate(code);
  };

  return (
    <section className="os-auth-hero" aria-labelledby="os-verify-title">
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
            <Link to="/auth/signin" className="os-btn os-btn-ghost os-btn-sm">Sign in instead</Link>
          </div>
        </header>
        <span id="os-verify-title" className="visually-hidden">Verify your one-time code</span>

        <div className="os-auth-grid">
          <Reveal className="os-card-col">
            <div className="os-card">
              <div className="os-card-head">
                <div className="os-card-head-top">
                  <span className="os-step-chip os-mono">A-7 · VERIFY OTP</span>
                  <span className="os-live-chip"><span className="os-pulse" /> 6-DIGIT · 10 MIN</span>
                </div>
                {/* S1 — masked identifier line */}
                <h1>Enter your verification code</h1>
                {target.isPending ? (
                  <TargetSkel />
                ) : (
                  <p>
                    Enter the 6-digit code sent to <span className="os-mono">{masked}</span> · {channel}. It expires in 10 minutes and is single-use.
                  </p>
                )}
              </div>

              <div className="os-body">
                {verifyResult && <ReadyCard result={verifyResult} onReset={() => setVerifyResult(null)} />}
                {resendResult && <ReadyCard result={resendResult} onReset={() => setResendResult(null)} />}

                {/* S2 — split input, auto-advance, paste-friendly */}
                <div className="os-field">
                  <span className="os-field-label">One-time code <span className="os-req">required</span></span>
                  <OtpInputs value={code} onChange={(v) => { setCode(v); setCodeError(null); }} label="Verification code" invalid={!!codeError} idPrefix="vo-code" />
                  {codeError && <FieldError message={codeError} />}
                  <span className="os-field-hint">Auto-advances as you type; paste the whole code into any box.</span>
                </div>

                <button type="button" className="os-btn os-btn-primary os-btn-lg w-100" onClick={submit} disabled={verify.isPending}>
                  {verify.isPending
                    ? <><Loader2 size={18} className="os-spin" aria-hidden /> Checking format…</>
                    : <>Verify code <ShieldCheck size={17} aria-hidden /></>}
                </button>

                {verifyResult && (
                  <div className="os-next-steps">
                    <Link to="/auth/onboard" className="os-btn os-btn-primary">Continue: set up your workspace <ArrowRight size={16} aria-hidden /></Link>
                    <Link to="/auth/signin" className="os-btn os-btn-ghost">Go to sign-in</Link>
                  </div>
                )}

                {/* S3 — resend with 60s countdown */}
                <div className="os-resend-row">
                  <button
                    type="button"
                    className="os-text-action"
                    disabled={cooling || resend.isPending}
                    onClick={() => resend.mutate()}
                  >
                    {resend.isPending ? <><Loader2 size={13} className="os-spin" aria-hidden /> Requesting…</> : <><RotateCcw size={13} aria-hidden /> Resend the code</>}
                  </button>
                  {cooling
                    ? <span className="os-cooldown-chip"><span className="os-pulse-dot" aria-hidden /> resend available in {fmt(cooldownLeft)}</span>
                    : <span className="os-field-hint"><Clock size={12} aria-hidden /> One resend per minute.</span>}
                </div>

                {/* S4 — trouble block */}
                <div className="os-trouble">
                  <span className="os-trouble-head"><CircleHelp size={16} aria-hidden /> I'm having trouble</span>
                  <ul className="os-trouble-list">
                    <li><Clock size={13} aria-hidden /> Wait for the 60-second timer and request a fresh code — old codes stay valid until they expire.</li>
                    <li><Mail size={13} aria-hidden /> Check the spam or promotions folder when the channel is email.</li>
                    <li><LifeBuoy size={13} aria-hidden /> Delivery incidents appear on <Link to="/status">the status page</Link>; this preview never sends anything, so support is not reachable yet.</li>
                    <li><AlertTriangle size={13} aria-hidden /> Wrong address? Restart sign-up with the right identifier — <Link to="/auth/signup">back to sign-up</Link>.</li>
                  </ul>
                </div>
              </div>

              {/* S5 — footer */}
              <div className="os-foot">
                <span>Already verified? <Link to="/auth/signin">Sign in</Link></span>
                <span className="os-foot-links">
                  <Link to="/auth/signup">Create an account</Link>
                  <Link to="/legal/$doc" params={{ doc: "privacy" }}>Privacy</Link>
                  <Link to="/legal/$doc" params={{ doc: "risk" }}>Risk Disclosure</Link>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function VerifyOtpPage() {
  usePageStyle("auth-verify-otp", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Verify your code · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-auth-verify-otp">
      <VerifyHero />
    </main>
  );
}
