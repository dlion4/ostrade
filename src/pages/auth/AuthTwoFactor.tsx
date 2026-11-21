import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  Download,
  Info,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { OtpInputs } from "@/components/OtpInputs";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  confirmTotpEnrollment,
  isTwoFactorEnrolled,
  issueRecoveryCodes,
  markTwoFactorEnrolled,
  startTotpEnrollment,
  type InertAuthResult,
} from "@/services/auth";
import css from "@/styles/pages/auth-2fa.css?inline";

/* ───────────────── helpers ───────────────── */

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

function Skel({ h, w }: { h: number; w?: number | string }) {
  return <span className="os-skel" style={{ height: h, width: w ?? "100%" }} />;
}

/* ───────────────── page ───────────────── */

function TwoFactorHero() {
  const toast = useToast();
  const navigate = useNavigate();
  const [gateVisible] = useState(() => !isTwoFactorEnrolled());
  const enrollment = useQuery({ queryKey: ["totp-enrollment"], queryFn: startTotpEnrollment });

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [savedCodes, setSavedCodes] = useState(false);
  const [savedError, setSavedError] = useState(false);
  const [enforced, setEnforced] = useState(true);
  const [verifyResult, setVerifyResult] = useState<InertAuthResult | null>(null);

  const confirm = useMutation({
    mutationFn: confirmTotpEnrollment,
    onSuccess: (r) => { setVerified(true); setVerifyResult(r); toast("TOTP verified — recovery codes issued below"); },
  });
  const recovery = useQuery({ queryKey: ["recovery-codes"], queryFn: issueRecoveryCodes, enabled: verified, staleTime: Infinity });

  const groupedSecret = enrollment.data ? (enrollment.data.secret.match(/.{1,4}/g) ?? []).join(" ") : "";

  const copySecret = () => {
    if (!enrollment.data) return;
    navigator.clipboard?.writeText(enrollment.data.secret).then(
      () => toast("Secret copied — paste it into your authenticator"),
      () => toast("Copy blocked by the browser — select the text manually"),
    );
  };

  const downloadCodes = () => {
    if (!recovery.data) return;
    const body = [
      "OStrade recovery codes — single use, shown once.",
      "In production these are stored as SHA-256 hashes; keep this file safe.",
      "",
      ...recovery.data,
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ostrade-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast("Recovery codes downloaded — store them offline");
  };

  const submit = () => {
    if (code.length !== 6) {
      setCodeError("Enter all six digits from your authenticator.");
      return;
    }
    setCodeError(null);
    confirm.mutate(code);
  };

  const finish = () => {
    if (!savedCodes) {
      setSavedError(true);
      toast("Confirm you saved the recovery codes first");
      return;
    }
    markTwoFactorEnrolled(enforced);
    toast(enforced ? "2FA enabled — required on every login" : "2FA enabled");
    void navigate({ to: "/auth/broker-connect" });
  };

  return (
    <section className="os-auth-hero" aria-labelledby="os-2fa-title">
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
        <span id="os-2fa-title" className="visually-hidden">Two-factor authentication</span>

        <div className="os-auth-grid">
          <Reveal className="os-card-col">
            <div className="os-card">
              <div className="os-card-head">
                <div className="os-card-head-top">
                  <span className="os-step-chip os-mono">A-8 · 2FA ENROLLMENT</span>
                  <span className="os-live-chip"><span className="os-pulse" /> TOTP · 30S WINDOW</span>
                </div>
                <h1>Turn on two-factor authentication</h1>
                <p>Pair an authenticator app once — OStrade then asks for a 6-digit code at sign-in and <strong>before any LIVE broker account can connect</strong>.</p>
              </div>

              <div className="os-body">
                {/* Enforcement gate banner */}
                {gateVisible && (
                  <div className="os-gate-banner" role="note">
                    <AlertTriangle size={16} aria-hidden />
                    <span><strong>Required before live trading.</strong> The broker-connect flow redirects here when you try to attach a LIVE account with 2FA off. Paper and demo accounts are unaffected.</span>
                  </div>
                )}

                {verifyResult && <ReadyCard result={verifyResult} onReset={() => setVerifyResult(null)} />}

                {/* S1 — QR (otpauth://) + manual secret fallback */}
                <fieldset className="os-fieldset-like" style={{ margin: 0, padding: 0, border: 0 }}>
                  <span className="os-field-label"><QrCode size={14} aria-hidden style={{ display: "inline", verticalAlign: -2 }} /> Scan with your authenticator</span>
                  {!enrollment.data ? (
                    <div className="os-enroll-grid" aria-live="polite"><Skel h={180} /><Skel h={180} /></div>
                  ) : (
                    <div className="os-enroll-grid">
                      <div className="os-qr-box" role="figure" aria-label="TOTP QR code">
                        <QRCodeSVG value={enrollment.data.otpauthUri} size={168} level="M" bgColor="#ffffff" fgColor="#0f172a" />
                        <span className="os-qr-note">Google Authenticator, Authy, 1Password or any TOTP app</span>
                      </div>
                      <div className="os-secret-box">
                        <span className="os-secret-label"><Smartphone size={15} aria-hidden /> Can't scan? Enter this secret manually</span>
                        <span className="os-secret-code os-mono">{groupedSecret}</span>
                        <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={copySecret}><Copy size={13} aria-hidden /> Copy secret</button>
                        <div className="os-uri-box">
                          otpauth://totp/OStrade:<strong>{enrollment.data.account}</strong>?secret=<strong>{enrollment.data.secret.slice(0, 8)}…</strong>&issuer=OStrade&algorithm=SHA1&digits=6&period=30
                        </div>
                        <span className="os-auth-apps">The QR is an <span className="os-mono">otpauth://</span> URI. Regenerated per preview load — in production it is issued once and stored encrypted.</span>
                      </div>
                    </div>
                  )}
                </fieldset>

                {/* S2 — verify 6-digit TOTP (±1 window) */}
                <div className="os-field">
                  <span className="os-field-label">Authenticator code <span className="os-req">required</span></span>
                  <OtpInputs value={code} onChange={(v) => { setCode(v); setCodeError(null); }} label="Authenticator code" invalid={!!codeError} idPrefix="tf-code" />
                  {codeError && <FieldError message={codeError} />}
                  <span className="os-field-hint"><Info size={12} aria-hidden /> Servers accept codes from the current and adjacent 30-second windows (±1), so a boundary tick still verifies.</span>
                  <button type="button" className="os-btn os-btn-primary w-100 mt-1" onClick={submit} disabled={confirm.isPending || verified}>
                    {confirm.isPending
                      ? <><Loader2 size={16} className="os-spin" aria-hidden /> Verifying…</>
                      : verified
                        ? <><BadgeCheck size={16} aria-hidden /> Authenticator paired</>
                        : <><ShieldCheck size={16} aria-hidden /> Verify & enable 2FA</>}
                  </button>
                </div>

                {/* S3 — recovery codes (shown once, download, hash-stored) */}
                {verified && (
                  <div className="os-recovery" role="status">
                    <div className="os-recovery-head">
                      <LockKeyhole size={16} aria-hidden /> Recovery codes
                      <span className="os-opt">shown once · stored as hashes</span>
                    </div>
                    {recovery.isPending ? (
                      <Skel h={120} />
                    ) : recovery.isError ? (
                      <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={() => recovery.refetch()}>Could not issue codes · Retry</button>
                    ) : (
                      <>
                        <div className="os-recovery-grid">
                          {recovery.data.map((c) => <span className="os-mono" key={c}>{c}</span>)}
                        </div>
                        <div className="os-recovery-actions">
                          <button type="button" className="os-btn os-btn-ghost os-btn-sm" onClick={downloadCodes}><Download size={14} aria-hidden /> Download codes (.txt)</button>
                          <span className="os-recovery-once"><AlertTriangle size={13} aria-hidden /> Each code unlocks your account once if you lose the authenticator. They are never shown again — in production only SHA-256 hashes are kept.</span>
                        </div>
                        <label className={`os-consent ${savedError ? "is-invalid" : ""}`}>
                          <input type="checkbox" checked={savedCodes} onChange={(e) => { setSavedCodes(e.target.checked); setSavedError(false); }} />
                          <span>I've saved my recovery codes somewhere safe (offline, not on this device).</span>
                        </label>
                        {savedError && <FieldError message="Confirm you saved the codes before continuing." />}
                      </>
                    )}
                  </div>
                )}

                {/* S4 — enforce toggle (default ON) */}
                <div className="os-enforce-row">
                  <LayoutGrid size={17} aria-hidden />
                  <div>
                    <strong>Require 2FA on every login</strong>
                    <small>When on, every new session asks for an authenticator code — including the broker-connect LIVE gate.</small>
                  </div>
                  <span className="os-switch">
                    <input id="ob-enforce" type="checkbox" checked={enforced} onChange={(e) => setEnforced(e.target.checked)} aria-label="Require 2FA on every login" />
                    <span className="os-switch-track" />
                  </span>
                  <span className="os-switch-state">{enforced ? "ON" : "OFF"}</span>
                </div>

                {/* S5 — done → continue to broker connect */}
                <div className="os-done-band">
                  <div>
                    <strong>{verified ? "2FA is ready to arm" : "Pair the authenticator to finish"}</strong>
                    <span>{verified ? "Recovery codes saved, preference chosen — you're set." : "Scan, enter the 6-digit code, save the recovery codes."}</span>
                  </div>
                  <button type="button" className="os-btn os-btn-primary" onClick={finish} disabled={!verified || !savedCodes} title={!savedCodes ? "Confirm you saved the recovery codes first" : undefined}>
                    {verified ? <>Done — continue to broker connect <ArrowRight size={16} aria-hidden /></> : <><LockKeyhole size={15} aria-hidden /> Waiting for verification…</>}
                  </button>
                  <Link to="/dashboard" className="os-btn os-btn-ghost">Dashboard (paper only for now)</Link>
                </div>
                <p className="os-field-hint"><Check size={12} aria-hidden /> Frontend-only preview: pairing, codes and the enforcement flag live in this browser until the backend ships.</p>
              </div>

              <div className="os-foot">
                <span>Changed your mind? <Link to="/auth/signin">Sign in without 2FA</Link></span>
                <span className="os-foot-links">
                  <Link to="/auth/broker-connect">Broker connect</Link>
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

export function TwoFactorPage() {
  usePageStyle("auth-2fa", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Two-factor authentication · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-auth-2fa">
      <TwoFactorHero />
    </main>
  );
}
