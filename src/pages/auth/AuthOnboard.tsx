import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Clock,
  Gauge,
  Globe2,
  Info,
  Loader2,
  Mail,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  Wallet,
} from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { useToast } from "@/components/Toast";
import { usePageStyle } from "@/hooks/usePageStyle";
import {
  getOnboardingCountries,
  getOnboardingTimezones,
  saveOnboardingProfile,
  suggestGuardrails,
  type AutomationIntent,
  type ExperienceLevel,
  type ExperienceYears,
  type InertAuthResult,
  type IncomeBand,
  type OnboardingSaveInput,
  type RiskAnswers,
  type TradeInstrument,
} from "@/services/auth";
import css from "@/styles/pages/auth-onboard.css?inline";

/* ───────────────── shared helpers ───────────────── */

function Skel({ h = 16, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <span className={`os-skel ${className}`} style={{ height: h, width: w }} aria-hidden />;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="os-field-error" role="alert"><AlertTriangle size={13} aria-hidden />{message}</span>;
}

function ReadyCard({ result, onReset, label = "Dismiss" }: { result: InertAuthResult; onReset: () => void; label?: string }) {
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

const EXPERIENCE_LABEL: Record<ExperienceLevel, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", professional: "Professional" };
const INCOME_LABEL: Record<IncomeBand, string> = { lt1m: "Under KSh 1M", "1to5m": "KSh 1M – 5M", "5to20m": "KSh 5M – 20M", gt20m: "Over KSh 20M" };
const YEARS_LABEL: Record<ExperienceYears, string> = { lt1: "Under 1 year", "1to3": "1–3 years", "3to7": "3–7 years", gt7: "7+ years" };
const AUTOMATION_LABEL: Record<AutomationIntent, string> = { manual: "Manual", semi: "Semi-automated", full: "Fully automated" };
const INSTRUMENT_LABEL: Record<TradeInstrument, string> = { forex: "Forex", synthetics: "Synthetics", crypto: "Crypto", stocks: "Stocks" };
const NUMBER_FORMAT_LABEL: Record<PrefValues["numberFormat"], string> = { "1,234.56": "1,234.56 · EN", "1.234,56": "1.234,56 · DE", "1 234,56": "1 234,56 · FR" };

/* ───────────────── schemas ───────────────── */

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Add at least 2 characters").max(40, "Keep it under 40 characters"),
  country: z.string().min(1, "Choose your country"),
  timezone: z.string().min(1, "Pick a timezone"),
  baseCurrency: z.enum(["USD", "KES", "EUR", "GBP"]),
  kesConversion: z.boolean(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced", "professional"]),
});

const riskSchema = z.object({
  incomeBand: z.enum(["lt1m", "1to5m", "5to20m", "gt20m"]),
  experienceYears: z.enum(["lt1", "1to3", "3to7", "gt7"]),
  maxAcceptableDailyLossPct: z.number().min(1, "At least 1%").max(20, "The preview slider stops at 20%"),
  instruments: z.array(z.enum(["forex", "synthetics", "crypto", "stocks"])).min(1, "Pick at least one instrument class"),
  automationIntent: z.enum(["manual", "semi", "full"]),
});

const prefsSchema = z.object({
  theme: z.enum(["dark", "light"]),
  density: z.enum(["comfortable", "compact"]),
  numberFormat: z.enum(["1,234.56", "1.234,56", "1 234,56"]),
  sizing: z.enum(["lots", "units", "auto"]),
  channels: z.object({ email: z.boolean(), sms: z.boolean(), telegram: z.boolean() }),
});

type ProfileValues = z.infer<typeof profileSchema>;
type RiskValues = z.infer<typeof riskSchema>;
type PrefValues = z.infer<typeof prefsSchema>;
interface GuardrailSet { maxDailyLossPct: number; maxPositions: number; maxStakePerTrade: number; }

/* ───────────────── S1 · stepper ───────────────── */

const STEP_NAMES = ["Profile", "Risk Profile", "Preferences"];

function Stepper({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  const width = [34, 67, 100, 100][step];
  return (
    <nav className="os-stepper" aria-label="Onboarding progress">
      <ol className="os-stepper-list">
        {STEP_NAMES.map((label, i) => {
          const done = step > i || step === 3;
          const clickable = step > i && step !== 3;
          return (
            <li key={label} className={`os-stepper-item ${step === i ? "is-active" : done ? "is-done" : ""}`}>
              <button
                type="button"
                className="os-stepper-btn"
                aria-current={step === i ? "step" : undefined}
                onClick={() => clickable && onJump(i)}
                tabIndex={clickable ? 0 : -1}
              >
                <span className="os-stepper-dot">{done ? <Check size={16} aria-hidden /> : i + 1}</span>
                <span className="os-stepper-label">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="stepper-h" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} aria-label="Wizard progress">
        <span className="stepper-h-fill" style={{ width: `${width}%` }} />
      </div>
      <p className="os-stepper-status">Step {Math.min(3, step + 1)} of 3{step === 3 ? " · review" : ""} — answers stay in this browser preview, nothing is saved.</p>
    </nav>
  );
}

/* ───────────────── S2 · step 1 profile ───────────────── */

function ProfileStep({ initial, onDone }: { initial: ProfileValues | null; onDone: (v: ProfileValues) => void }) {
  const toast = useToast();
  const countries = useQuery({ queryKey: ["onboarding-countries"], queryFn: getOnboardingCountries });
  const timezones = useQuery({ queryKey: ["onboarding-timezones"], queryFn: getOnboardingTimezones });
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial ?? {
      displayName: "", country: "KE", timezone: "Africa/Nairobi",
      baseCurrency: "USD", kesConversion: true, experienceLevel: "beginner",
    },
  });
  const baseCurrency = watch("baseCurrency");

  return (
    <form className="os-step" onSubmit={handleSubmit((v) => { onDone(v); toast("Profile saved locally — risk defaults next"); })} noValidate>
      <fieldset className="os-fieldset">
        <legend><span className="os-fieldset-n os-mono">01</span> Trader profile</legend>
        <div className="os-field">
          <label htmlFor="ob-name">Display name <span className="os-req">required</span></label>
          <div className="os-input-wrap"><UserRound size={17} aria-hidden />
            <input id="ob-name" type="text" autoComplete="name" placeholder="e.g. Amani Ochieng" className={`os-input ${errors.displayName ? "is-invalid" : ""}`} aria-invalid={!!errors.displayName} {...register("displayName")} />
          </div>
          <FieldError message={errors.displayName?.message} />
          <span className="os-field-hint">Shown on your local journal and paper records only.</span>
        </div>
        <div className="os-field">
          <label htmlFor="ob-country">Country <span className="os-req">required</span></label>
          <div className="os-input-wrap"><Globe2 size={17} aria-hidden />
            <select id="ob-country" className={`os-input ${errors.country ? "is-invalid" : ""}`} aria-invalid={!!errors.country} {...register("country")}>
              {countries.isPending && <option value="KE">Kenya (loading list…)</option>}
              {countries.isError && <option value="KE">Kenya (list unavailable — retry shortly)</option>}
              {countries.data?.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.dial})</option>)}
            </select>
          </div>
          <FieldError message={errors.country?.message} />
        </div>
        <div className="os-field">
          <label htmlFor="ob-tz">Timezone <span className="os-req">required</span></label>
          <div className="os-input-wrap"><Clock size={17} aria-hidden />
            <select id="ob-tz" className={`os-input ${errors.timezone ? "is-invalid" : ""}`} aria-invalid={!!errors.timezone} {...register("timezone")}>
              {timezones.isPending && <option value="Africa/Nairobi">Africa/Nairobi (loading list…)</option>}
              {timezones.isError && <option value="Africa/Nairobi">Africa/Nairobi (list unavailable — retry shortly)</option>}
              {timezones.data?.map((t) => <option key={t.id} value={t.id}>{t.id} · {t.city} ({t.offset})</option>)}
            </select>
          </div>
          <FieldError message={errors.timezone?.message} />
          <span className="os-field-hint">Drives the Trade Scheduler's daily window and session labels.</span>
        </div>
      </fieldset>

      <fieldset className="os-fieldset">
        <legend><span className="os-fieldset-n os-mono">02</span> Display currency & experience</legend>
        <div className="os-field">
          <label htmlFor="ob-currency">Base display currency <span className="os-req">required</span></label>
          <div className="os-input-wrap"><Wallet size={17} aria-hidden />
            <select id="ob-currency" className="os-input" {...register("baseCurrency")}>
              <option value="USD">USD — US dollar (default)</option>
              <option value="KES">KES — Kenyan shilling</option>
              <option value="EUR">EUR — euro</option>
              <option value="GBP">GBP — pound sterling</option>
            </select>
          </div>
          {baseCurrency !== "KES" && (
            <label className="os-switch-row">
              <Wallet size={17} aria-hidden />
              <div><strong>Optional KES display conversion</strong><small>Show shilling equivalents beside USD amounts. Rates come later from the backend — nothing converts in this preview.</small></div>
              <span className="os-switch">
                <input type="checkbox" {...register("kesConversion")} />
                <span className="os-switch-track" />
              </span>
            </label>
          )}
          {baseCurrency === "KES" && <span className="os-field-hint">Balances will display in KES; USD paper workspace figures convert at the backend rate.</span>}
        </div>
        <div className="os-field">
          <span className="os-field-label">Experience level <span className="os-req">required</span></span>
          <ExperienceRadios register={register} current={watch("experienceLevel")} />
          <FieldError message={errors.experienceLevel?.message} />
        </div>
      </fieldset>

      <div className="os-wizard-nav">
        <Link to="/auth/signin" className="os-btn os-btn-ghost"><ArrowLeft size={15} aria-hidden /> Cancel & sign in</Link>
        <span className="os-wizard-nav-meta">Next: risk profile →</span>
        <button type="submit" className="os-btn os-btn-primary">Continue to risk profile <ArrowRight size={16} aria-hidden /></button>
      </div>
    </form>
  );
}

function ExperienceRadios({ register, current }: { register: ReturnType<typeof useForm<ProfileValues>>["register"]; current: ExperienceLevel }) {
  const options: Array<{ v: ExperienceLevel; label: string; hint: string }> = [
    { v: "beginner", label: "Beginner", hint: "New to leveraged trading" },
    { v: "intermediate", label: "Intermediate", hint: "Understands lots & margin" },
    { v: "advanced", label: "Advanced", hint: "Runs systematic strategies" },
    { v: "professional", label: "Professional", hint: "Trades for a living or firm" },
  ];
  return (
    <div className="os-radio-row" role="radiogroup" aria-label="Experience level">
      {options.map((o) => (
        <label key={o.v} className={`os-radio ${current === o.v ? "is-active" : ""}`}>
          <input type="radio" value={o.v} {...register("experienceLevel")} />
          <span>{o.label}<small>{o.hint}</small></span>
        </label>
      ))}
    </div>
  );
}

/* ───────────────── S3 · step 2 risk questionnaire ───────────────── */

function RiskStep({ initial, initialGuardrails, onDone, onBack }: {
  initial: RiskValues | null;
  initialGuardrails: GuardrailSet | null;
  onDone: (v: RiskValues, g: GuardrailSet) => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RiskValues>({
    resolver: zodResolver(riskSchema),
    defaultValues: initial ?? {
      incomeBand: "1to5m", experienceYears: "1to3", maxAcceptableDailyLossPct: 5,
      instruments: ["forex"], automationIntent: "semi",
    },
  });
  const answers = watch();
  const suggestions = useMemo(() => suggestGuardrails(answers as RiskAnswers), [
    answers.incomeBand, answers.experienceYears, answers.maxAcceptableDailyLossPct, answers.instruments, answers.automationIntent,
  ]);
  const [overrides, setOverrides] = useState<{ daily?: number; positions?: number; stake?: number }>(
    initialGuardrails ? { daily: initialGuardrails.maxDailyLossPct, positions: initialGuardrails.maxPositions, stake: initialGuardrails.maxStakePerTrade } : {},
  );
  const daily = overrides.daily ?? suggestions.maxDailyLossPct;
  const positions = overrides.positions ?? suggestions.maxPositions;
  const stake = overrides.stake ?? suggestions.maxStakePerTrade;
  const edited = overrides.daily !== undefined || overrides.positions !== undefined || overrides.stake !== undefined;

  const instruments = watch("instruments");

  return (
    <form className="os-step" onSubmit={handleSubmit((v) => { onDone(v, { maxDailyLossPct: daily, maxPositions: positions, maxStakePerTrade: stake }); toast("Risk defaults locked in — preferences next"); })} noValidate>
      <fieldset className="os-fieldset">
        <legend><span className="os-fieldset-n os-mono">01</span> About you as a trader</legend>
        <div className="os-field">
          <span className="os-field-label">Annual income band <span className="os-req">required</span></span>
          <div className="os-radio-row" role="radiogroup" aria-label="Annual income band">
            {(Object.keys(INCOME_LABEL) as IncomeBand[]).map((b) => (
              <label key={b} className={`os-radio ${answers.incomeBand === b ? "is-active" : ""}`}>
                <input type="radio" value={b} {...register("incomeBand")} />
                <span>{INCOME_LABEL[b]}</span>
              </label>
            ))}
          </div>
          <span className="os-field-hint">Sizes the default stake cap. Figures stay in this browser.</span>
        </div>
        <div className="os-field">
          <span className="os-field-label">Years of trading experience <span className="os-req">required</span></span>
          <div className="os-radio-row" role="radiogroup" aria-label="Years of trading experience">
            {(Object.keys(YEARS_LABEL) as ExperienceYears[]).map((y) => (
              <label key={y} className={`os-radio ${answers.experienceYears === y ? "is-active" : ""}`}>
                <input type="radio" value={y} {...register("experienceYears")} />
                <span>{YEARS_LABEL[y]}</span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="os-fieldset">
        <legend><span className="os-fieldset-n os-mono">02</span> What you intend to trade</legend>
        <div className="os-field">
          <span className="os-field-label">Instrument classes <span className="os-req">pick at least one</span></span>
          <div className="os-check-grid" role="group" aria-label="Instrument classes">
            {(Object.keys(INSTRUMENT_LABEL) as TradeInstrument[]).map((ins) => (
              <label key={ins} className={`os-check-chip ${(instruments ?? []).includes(ins) ? "is-active" : ""}`}>
                <input type="checkbox" value={ins} {...register("instruments")} />
                <span>{INSTRUMENT_LABEL[ins]}</span>
              </label>
            ))}
          </div>
          <FieldError message={errors.instruments?.message as string | undefined} />
        </div>
        <div className="os-field">
          <span className="os-field-label">Automation intent <span className="os-req">required</span></span>
          <div className="os-radio-row" role="radiogroup" aria-label="Automation intent">
            {(Object.keys(AUTOMATION_LABEL) as AutomationIntent[]).map((a) => (
              <label key={a} className={`os-radio ${answers.automationIntent === a ? "is-active" : ""}`}>
                <input type="radio" value={a} {...register("automationIntent")} />
                <span>{AUTOMATION_LABEL[a]}<small>{a === "manual" ? "You click every confirm" : a === "semi" ? "Rules draft, you approve" : "Rules can fire unattended"}</small></span>
              </label>
            ))}
          </div>
        </div>
        <div className="os-field">
          <label htmlFor="ob-loss">Max acceptable daily loss <span className="os-req">required</span></label>
          <div className="os-slider-row">
            <input id="ob-loss" type="range" min={1} max={20} step={0.5} className="os-slider" aria-describedby="ob-loss-hint" {...register("maxAcceptableDailyLossPct", { valueAsNumber: true })} />
            <span className="os-slider-value os-mono">{answers.maxAcceptableDailyLossPct}%</span>
          </div>
          <span id="ob-loss-hint" className="os-field-hint">1% – 20% of workspace equity in a single trading day. Everything at stake in one session.</span>
          <FieldError message={errors.maxAcceptableDailyLossPct?.message} />
        </div>
      </fieldset>

      <div className="os-guardrails">
        <div className="os-guardrails-head"><Gauge size={17} aria-hidden /> Suggested T-14 guardrail defaults <span className="os-opt">edit any value</span></div>
        <div className="os-guardrails-grid">
          <div className="os-guardrail">
            <label htmlFor="ob-g-daily">Max daily loss</label>
            <input id="ob-g-daily" type="number" min={1} max={20} step={0.5} value={daily} onChange={(e) => setOverrides((o) => ({ ...o, daily: Number(e.target.value) }))} />
            <span className="os-guardrail-note">{suggestions.notes.maxDailyLossPct}</span>
          </div>
          <div className="os-guardrail">
            <label htmlFor="ob-g-pos">Max open positions</label>
            <input id="ob-g-pos" type="number" min={1} max={10} step={1} value={positions} onChange={(e) => setOverrides((o) => ({ ...o, positions: Number(e.target.value) }))} />
            <span className="os-guardrail-note">{suggestions.notes.maxPositions}</span>
          </div>
          <div className="os-guardrail">
            <label htmlFor="ob-g-stake">Max stake per trade (USD)</label>
            <input id="ob-g-stake" type="number" min={10} max={100000} step={10} value={stake} onChange={(e) => setOverrides((o) => ({ ...o, stake: Number(e.target.value) }))} />
            <span className="os-guardrail-note">{suggestions.notes.maxStakePerTrade}</span>
          </div>
        </div>
        <div className="os-guardrails-foot">
          <span><ShieldCheck size={13} aria-hidden /> Applied to the Paper workspace first; live accounts need a second confirmation later.</span>
          <button type="button" className="os-text-action" onClick={() => { setOverrides({}); toast("Guardrails reset to the suggested values"); }} disabled={!edited}>
            <RotateCcw size={13} aria-hidden /> Reset to suggestions
          </button>
        </div>
      </div>

      <div className="os-wizard-nav">
        <button type="button" className="os-btn os-btn-ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden /> Back to profile</button>
        <span className="os-wizard-nav-meta">Next: preferences →</span>
        <button type="submit" className="os-btn os-btn-primary">Continue to preferences <ArrowRight size={16} aria-hidden /></button>
      </div>
    </form>
  );
}

/* ───────────────── S4 · step 3 preferences ───────────────── */

function PrefsStep({ initial, onDone, onBack }: {
  initial: PrefValues | null;
  onDone: (v: PrefValues) => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<PrefValues>({
    resolver: zodResolver(prefsSchema),
    defaultValues: initial ?? {
      theme: "dark", density: "comfortable", numberFormat: "1,234.56", sizing: "lots",
      channels: { email: true, sms: false, telegram: false },
    },
  });
  const theme = watch("theme");
  const density = watch("density");
  const sizing = watch("sizing");
  const channels = watch("channels");

  return (
    <form className="os-step" onSubmit={handleSubmit((v) => { onDone(v); toast("Preferences saved locally — review next"); })} noValidate>
      <fieldset className="os-fieldset">
        <legend><span className="os-fieldset-n os-mono">01</span> Interface preferences</legend>
        <div className="os-field">
          <span className="os-field-label">Theme <span className="os-opt">dark default</span></span>
          <div className="os-radio-row" role="radiogroup" aria-label="Theme">
            <label className={`os-radio ${theme === "dark" ? "is-active" : ""}`}>
              <input type="radio" value="dark" {...register("theme")} />
              <span><span className="os-theme-dot" style={{ background: "#0f172a" }} /> Dark<small>Charcoal desks, bright accents</small></span>
            </label>
            <label className={`os-radio ${theme === "light" ? "is-active" : ""}`}>
              <input type="radio" value="light" {...register("theme")} />
              <span><span className="os-theme-dot" style={{ background: "#f8fafc", border: "1px solid var(--os-hairline-strong)" }} /> Light<small>Current OStrade preview look</small></span>
            </label>
          </div>
          <FieldError message={errors.theme?.message} />
        </div>
        <div className="os-field">
          <span className="os-field-label">Density</span>
          <div className="os-radio-row" role="radiogroup" aria-label="Density">
            <label className={`os-radio ${density === "comfortable" ? "is-active" : ""}`}><input type="radio" value="comfortable" {...register("density")} /><span>Comfortable<small>Roomier tables & cards</small></span></label>
            <label className={`os-radio ${density === "compact" ? "is-active" : ""}`}><input type="radio" value="compact" {...register("density")} /><span>Compact<small>More rows per screen</small></span></label>
          </div>
        </div>
        <div className="os-field">
          <label htmlFor="ob-numfmt">Number format</label>
          <div className="os-input-wrap"><SlidersHorizontal size={17} aria-hidden />
            <select id="ob-numfmt" className="os-input" {...register("numberFormat")}>
              <option value="1,234.56">1,234.56 — English</option>
              <option value="1.234,56">1.234,56 — German</option>
              <option value="1 234,56">1 234,56 — French</option>
            </select>
          </div>
        </div>
        <div className="os-field">
          <span className="os-field-label">Position sizing units</span>
          <div className="os-radio-row" role="radiogroup" aria-label="Position sizing units">
            <label className={`os-radio ${sizing === "lots" ? "is-active" : ""}`}><input type="radio" value="lots" {...register("sizing")} /><span>Lots<small>0.10 lots · MT5 & cTrader</small></span></label>
            <label className={`os-radio ${sizing === "units" ? "is-active" : ""}`}><input type="radio" value="units" {...register("sizing")} /><span>Units<small>Coin or share quantity</small></span></label>
            <label className={`os-radio ${sizing === "auto" ? "is-active" : ""}`}><input type="radio" value="auto" {...register("sizing")} /><span>Auto per venue<small>Follows each broker's convention</small></span></label>
          </div>
          <FieldError message={errors.sizing?.message} />
        </div>
      </fieldset>

      <fieldset className="os-fieldset">
        <legend><span className="os-fieldset-n os-mono">02</span> Notification channels</legend>
        <p className="os-fieldset-note">A preview of how fills, guardrail blocks and account alerts would reach you. Delivery wiring arrives with the backend.</p>
        <div className="os-switch-row">
          <Bell size={17} aria-hidden />
          <div><strong>In-app notifications</strong><small>Toast centre and bell feed — always available.</small></div>
          <span className="os-switch"><input type="checkbox" checked disabled readOnly aria-label="In-app notifications always on" /><span className="os-switch-track" /></span>
          <span className="os-switch-state is-on">ALWAYS</span>
        </div>
        <div className="os-switch-row">
          <Mail size={17} aria-hidden />
          <div><strong>Email</strong><small>Fills, daily summary, guardrail pauses.</small></div>
          <span className="os-switch"><input type="checkbox" {...register("channels.email")} aria-label="Email notifications" /><span className="os-switch-track" /></span>
          <span className={`os-switch-state ${channels.email ? "is-on" : ""}`}>{channels.email ? "ON" : "OFF"}</span>
        </div>
        <div className="os-switch-row">
          <Smartphone size={17} aria-hidden />
          <div><strong>SMS</strong><small>Critical alerts only — kill switch and daily loss lock.</small></div>
          <span className="os-switch"><input type="checkbox" {...register("channels.sms")} aria-label="SMS notifications" /><span className="os-switch-track" /></span>
          <span className={`os-switch-state ${channels.sms ? "is-on" : ""}`}>{channels.sms ? "ON" : "OFF"}</span>
        </div>
        <div className="os-switch-row">
          <Send size={17} aria-hidden />
          <div><strong>Telegram</strong><small>Signal delivery receipts and schedule runs.</small></div>
          <span className="os-switch"><input type="checkbox" {...register("channels.telegram")} aria-label="Telegram notifications" /><span className="os-switch-track" /></span>
          <span className={`os-switch-state ${channels.telegram ? "is-on" : ""}`}>{channels.telegram ? "ON" : "OFF"}</span>
        </div>
      </fieldset>

      <div className="os-wizard-nav">
        <button type="button" className="os-btn os-btn-ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden /> Back to risk profile</button>
        <span className="os-wizard-nav-meta">Next: review →</span>
        <button type="submit" className="os-btn os-btn-primary">Review my setup <ArrowRight size={16} aria-hidden /></button>
      </div>
    </form>
  );
}

/* ───────────────── S5 · review & continue ───────────────── */

function ReviewStep({ profile, risk, guardrails, prefs, onJump, onBack }: {
  profile: ProfileValues;
  risk: RiskValues;
  guardrails: GuardrailSet;
  prefs: PrefValues;
  onJump: (s: number) => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [saveResult, setSaveResult] = useState<InertAuthResult | null>(null);
  const save = useMutation({
    mutationFn: (input: OnboardingSaveInput) => saveOnboardingProfile(input),
    onSuccess: (r) => { setSaveResult(r); toast("Local checks passed — ready for the backend"); },
  });

  const onSave = () => {
    save.mutate({
      displayName: profile.displayName,
      country: profile.country,
      timezone: profile.timezone,
      baseCurrency: profile.baseCurrency,
      kesConversion: profile.kesConversion,
      experienceLevel: profile.experienceLevel,
      guardrails,
      preferences: {
        theme: prefs.theme, density: prefs.density, numberFormat: prefs.numberFormat, sizing: prefs.sizing,
        channels: prefs.channels,
      },
    });
  };

  return (
    <div className="os-step">
      <div className="os-review-grid">
        <div className="os-review-card">
          <div className="os-review-top"><span className="os-review-kicker">Profile</span><button type="button" className="os-review-edit" onClick={() => onJump(0)}><UserRound size={12} aria-hidden /> Edit</button></div>
          <h3>{profile.displayName || "Unnamed trader"}</h3>
          <ul className="os-review-list">
            <li><span>Country</span><span>{profile.country}</span></li>
            <li><span>Timezone</span><span>{profile.timezone}</span></li>
            <li><span>Display currency</span><span>{profile.baseCurrency}{profile.kesConversion && profile.baseCurrency !== "KES" ? " · +KES view" : ""}</span></li>
            <li><span>Experience</span><span>{EXPERIENCE_LABEL[profile.experienceLevel]}</span></li>
          </ul>
        </div>
        <div className="os-review-card">
          <div className="os-review-top"><span className="os-review-kicker">Risk profile</span><button type="button" className="os-review-edit" onClick={() => onJump(1)}><Gauge size={12} aria-hidden /> Edit</button></div>
          <h3>Guardrail defaults</h3>
          <div className="os-review-guard">
            <span className="os-review-pill">≤{guardrails.maxDailyLossPct}% daily loss</span>
            <span className="os-review-pill">{guardrails.maxPositions} open max</span>
            <span className="os-review-pill">${guardrails.maxStakePerTrade} stake cap</span>
          </div>
          <ul className="os-review-list">
            <li><span>Income band</span><span>{INCOME_LABEL[risk.incomeBand]}</span></li>
            <li><span>Experience</span><span>{YEARS_LABEL[risk.experienceYears]}</span></li>
            <li><span>Instruments</span><span>{risk.instruments.map((i) => INSTRUMENT_LABEL[i]).join(", ")}</span></li>
            <li><span>Automation</span><span>{AUTOMATION_LABEL[risk.automationIntent]}</span></li>
          </ul>
        </div>
        <div className="os-review-card">
          <div className="os-review-top"><span className="os-review-kicker">Preferences</span><button type="button" className="os-review-edit" onClick={() => onJump(2)}><SlidersHorizontal size={12} aria-hidden /> Edit</button></div>
          <h3>{prefs.theme === "dark" ? "Dark" : "Light"} · {prefs.density}</h3>
          <ul className="os-review-list">
            <li><span>Numbers</span><span>{NUMBER_FORMAT_LABEL[prefs.numberFormat]}</span></li>
            <li><span>Sizing</span><span>{prefs.sizing === "auto" ? "Auto per venue" : prefs.sizing === "lots" ? "Lots" : "Units"}</span></li>
            <li><span>Channels</span><span>{["In-app", prefs.channels.email && "Email", prefs.channels.sms && "SMS", prefs.channels.telegram && "Telegram"].filter(Boolean).join(", ")}</span></li>
          </ul>
        </div>
      </div>

      {save.isPending && <Skel h={64} />}
      {saveResult && <ReadyCard result={saveResult} onReset={() => setSaveResult(null)} label="Dismiss" />}

      <div className="os-wizard-nav">
        <button type="button" className="os-btn os-btn-ghost" onClick={onBack}><ArrowLeft size={15} aria-hidden /> Back to preferences</button>
        <button type="button" className="os-btn os-btn-primary" onClick={onSave} disabled={save.isPending}>
          {save.isPending ? <><Loader2 size={16} className="os-spin" aria-hidden /> Checking locally…</> : <><Check size={16} aria-hidden /> Save & finish</>}
        </button>
      </div>

      <div className="os-next-band">
        <div><strong>Setup looks good — next: connect your first broker →</strong><span>Onboarding defaults pre-configure the broker hub; Paper stays the default workspace.</span></div>
        <Link to="/auth/broker-connect" className="os-btn os-btn-primary">Connect your first broker <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </div>
  );
}

/* ───────────────── page ───────────────── */

function OnboardHero() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ProfileValues | null>(null);
  const [risk, setRisk] = useState<RiskValues | null>(null);
  const [guardrails, setGuardrails] = useState<GuardrailSet | null>(null);
  const [prefs, setPrefs] = useState<PrefValues | null>(null);

  const jumpTo = (s: number) => {
    setStep(s);
    document.getElementById("os-wizard-card")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <section className="os-auth-hero" aria-labelledby="os-onboard-title">
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
            <span className="os-band-step-chip os-mono">A-3 · ONBOARDING</span>
            <Link to="/auth/signin" className="os-btn os-btn-ghost os-btn-sm">Sign in instead</Link>
          </div>
        </header>
        <span id="os-onboard-title" className="visually-hidden">Onboard your OStrade workspace</span>
        <div className="os-auth-grid">
          <div className="os-card-col" id="os-wizard-card">
            <Reveal>
              <Stepper step={step} onJump={jumpTo} />
              <div className="os-wizard-card">
                <div className="os-wizard-head">
                  <span className="os-wizard-badge">3-STEP WIZARD</span>
                  <h1>Set up your workspace</h1>
                  <p>Profile, risk defaults and preferences — this pre-configures broker connection and the Paper account.</p>
                </div>
                <div className="os-wizard-body">
                  {step === 0 && (
                    <ProfileStep key="profile" initial={profile} onDone={(v) => { setProfile(v); setStep(1); }} />
                  )}
                  {step === 1 && (
                    <RiskStep key="risk" initial={risk} initialGuardrails={guardrails} onDone={(v, g) => { setRisk(v); setGuardrails(g); setStep(2); }} onBack={back} />
                  )}
                  {step === 2 && (
                    <PrefsStep key="prefs" initial={prefs} onDone={(v) => { setPrefs(v); setStep(3); }} onBack={back} />
                  )}
                  {step === 3 && profile && risk && guardrails && prefs && (
                    <ReviewStep key="review" profile={profile} risk={risk} guardrails={guardrails} prefs={prefs} onJump={jumpTo} onBack={back} />
                  )}
                </div>
              </div>
              <div className="os-wizard-foot">
                <span>New here? <Link to="/auth/signup">Create an account</Link> first</span>
                <span className="os-wizard-foot-links">
                  <Link to="/how-it-works">How it works</Link>
                  <Link to="/status">Status page</Link>
                  <Link to="/legal/$doc" params={{ doc: "risk" }}>Risk disclosure</Link>
                </span>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export function OnboardPage() {
  usePageStyle("auth-onboard", css);
  useEffect(() => {
    const previous = document.title;
    document.title = "Onboarding · OStrade";
    return () => { document.title = previous; };
  }, []);
  return (
    <main className="page-auth-onboard">
      <OnboardHero />
    </main>
  );
}
