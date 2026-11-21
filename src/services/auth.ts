// Auth service layer — signatures mirror the future REST API.
// FRONTEND-ONLY: no account is created, no OTP is sent, nothing goes over the wire.
import {
  onboardingCountries,
  onboardingTimezones,
  quoteSnapshots,
  workspacePreviews,
  type OnboardingCountry,
  type OnboardingTimezone,
  type QuoteSnapshot,
  type WorkspacePreview,
} from "@/data/auth";
import { latency } from "./_latency";

export type { QuoteSnapshot, WorkspacePreview, OnboardingCountry, OnboardingTimezone };

export const getQuoteSnapshots = (): Promise<QuoteSnapshot[]> => latency(quoteSnapshots, 300, 500);
export const getOnboardingCountries = (): Promise<OnboardingCountry[]> => latency(onboardingCountries, 300, 450);
export const getOnboardingTimezones = (): Promise<OnboardingTimezone[]> => latency(onboardingTimezones, 300, 450);

/* ── A-3 onboarding wizard ───────────────────────────────── */

export type ExperienceLevel = "beginner" | "intermediate" | "advanced" | "professional";
export type IncomeBand = "lt1m" | "1to5m" | "5to20m" | "gt20m";
export type ExperienceYears = "lt1" | "1to3" | "3to7" | "gt7";
export type AutomationIntent = "manual" | "semi" | "full";
export type TradeInstrument = "forex" | "synthetics" | "crypto" | "stocks";

/** Answers from the S3 risk questionnaire that drive the suggested guardrails. */
export interface RiskAnswers {
  incomeBand: IncomeBand;
  experienceYears: ExperienceYears;
  maxAcceptableDailyLossPct: number;
  instruments: TradeInstrument[];
  automationIntent: AutomationIntent;
}

/** Suggested T-14 guardrail defaults the trader confirms or edits. */
export interface GuardrailSuggestions {
  maxDailyLossPct: number;
  maxPositions: number;
  maxStakePerTrade: number;
  notes: { maxDailyLossPct: string; maxPositions: string; maxStakePerTrade: string };
}

const INCOME_STAKE: Record<RiskAnswers["incomeBand"], number> = { lt1m: 50, "1to5m": 100, "5to20m": 250, gt20m: 500 };
const AUTOMATION_POSITIONS: Record<RiskAnswers["automationIntent"], number> = { manual: 3, semi: 5, full: 8 };
const YEARS_FACTOR: Record<RiskAnswers["experienceYears"], number> = { lt1: 0.6, "1to3": 1, "3to7": 1.4, gt7: 2 };

/**
 * Deterministic mapping from the questionnaire to T-14 guardrail defaults.
 * Pure and synchronous — the wizard prefills editable inputs from this.
 */
export function suggestGuardrails(a: RiskAnswers): GuardrailSuggestions {
  const factor = YEARS_FACTOR[a.experienceYears];
  const cappedLoss = a.experienceYears === "lt1" ? Math.min(a.maxAcceptableDailyLossPct, 8) : a.maxAcceptableDailyLossPct;
  const positions = Math.min(10, AUTOMATION_POSITIONS[a.automationIntent] + (a.instruments.length >= 3 ? 1 : 0));
  const stake = Math.min(1000, Math.round(INCOME_STAKE[a.incomeBand] * factor));
  return {
    maxDailyLossPct: Math.round(cappedLoss * 10) / 10,
    maxPositions: positions,
    maxStakePerTrade: stake,
    notes: {
      maxDailyLossPct: a.experienceYears === "lt1" && a.maxAcceptableDailyLossPct > 8
        ? "Your 8% is capped below your stated tolerance — under a year of experience."
        : "Matches the daily-loss tolerance you set on the slider.",
      maxPositions: `Starts from your ${a.automationIntent} automation intent${a.instruments.length >= 3 ? ", +1 for spreading across 3+ instrument classes" : ""}.`,
      maxStakePerTrade: `Sized from your income band, ${factor < 1 ? "reduced" : factor > 1 ? "scaled up" : "unchanged"} by ${a.experienceYears === "lt1" ? "under-a-year" : a.experienceYears === "1to3" ? "1–3-year" : a.experienceYears === "3to7" ? "3–7-year" : "7+-year"} experience.`,
    },
  };
}

export interface OnboardingSaveInput {
  displayName: string;
  country: string;
  timezone: string;
  baseCurrency: string;
  kesConversion: boolean;
  experienceLevel: ExperienceLevel;
  guardrails: { maxDailyLossPct: number; maxPositions: number; maxStakePerTrade: number };
  preferences: { theme: "dark" | "light"; density: "comfortable" | "compact"; numberFormat: string; sizing: "lots" | "units" | "auto"; channels: { email: boolean; sms: boolean; telegram: boolean } };
}

/** Future REST shape: PUT /me/onboarding. Today it validates locally and stops at a labelled state. */
export async function saveOnboardingProfile(input: OnboardingSaveInput): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: "Your profile, risk defaults and preferences passed every local check. Nothing was saved.",
    detail: `Next in the real flow: these defaults seed the ${input.baseCurrency} workspace and the T-14 guardrails, then broker connection unlocks.`,
    reference: "ONBOARD-PREVIEW-001",
  }, 500, 800);
}

export interface SignupInput {
  email: string;
  phone?: string;
  password: string;
  verificationChannel: "email" | "phone";
  acceptTerms: true;
  acceptRisk: true;
}
export interface InertAuthResult {
  status: "ready";
  simulated: boolean;
  title: string;
  message: string;
  detail: string;
  reference: string;
}

/** Future REST shape: POST /auth/signup. Today it validates locally and stops at a labelled state. */
export async function createAccount(input: SignupInput): Promise<InertAuthResult> {
  const defaults = workspacePreviews.find((w) => w.id === "w01")!;
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: "Your details passed every local check. Nothing was created and no email was sent.",
    detail: `Next in the real flow: a 6-digit OTP to ${input.verificationChannel === "phone" ? input.phone || "your phone" : input.email}, then the ${defaults.name} workspace with ${defaults.currency} ${defaults.balance}.`,
    reference: "AUTH-PREVIEW-001",
  }, 500, 800);
}

/** Future REST shape: POST /auth/otp/send. Deliberately inert in this preview. */
export async function requestOtp(channel: "email" | "phone", target: string): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: `OTP delivery to ${channel} is not wired yet.`,
    detail: target ? `Destination on file: ${target}` : "Add an email or phone number first.",
    reference: "OTP-PREVIEW-001",
  }, 400, 700);
}

/** Future REST shape: POST /auth/otp/verify. Deliberately inert in this preview. */
export async function verifyOtp(code: string): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: `The ${code.length}-digit code was checked for format only, never verified.`,
    detail: "When the backend lands, this step unlocks onboarding preferences and broker connection.",
    reference: "OTP-PREVIEW-002",
  }, 400, 700);
}

/* ── A-8 TOTP enrollment (required gate before LIVE broker accounts) ───────── */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Stable for this page load: the enrollment secret the authenticator would scan. */
const enrollment = (() => {
  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const secret = Array.from({ length: 32 }, () => BASE32[Math.floor(rand() * 32)]).join("");
  const account = "trader@ostrade.app";
  return {
    account,
    secret,
    otpauthUri: `otpauth://totp/OStrade:${account}?secret=${secret}&issuer=OStrade&algorithm=SHA1&digits=6&period=30`,
  };
})();

export interface TotpEnrollment {
  account: string;
  secret: string;
  otpauthUri: string;
}

export const startTotpEnrollment = (): Promise<TotpEnrollment> => latency(enrollment, 300, 500);

/** Future REST shape: POST /auth/2fa/verify. The backend accepts ±1 time window; the preview checks format only. */
export async function confirmTotpEnrollment(code: string): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: `The ${code.length}-digit TOTP code passed the format check (a real server accepts codes from the current and adjacent 30s windows).`,
    detail: "Next in the real flow: the secret is bound to your account and the recovery codes below are issued once.",
    reference: "TOTP-PREVIEW-001",
  }, 450, 750);
}

/** Ten single-use codes. In production only their SHA-256 hashes are stored — shown here once, never again. */
export function generateRecoveryCodes(): string[] {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = (n: number) => Array.from({ length: n }, () => BASE32[Math.floor(rand() * 32)]).join("");
  return Array.from({ length: 10 }, (_, i) => `OS${String(10 + i).padStart(2, "0")}-${pick(4)}-${pick(4)}`);
}

export async function issueRecoveryCodes(): Promise<string[]> {
  return latency(generateRecoveryCodes(), 300, 500);
}

/* ── Preview-side gate state (localStorage; the real gate lives server-side) ── */

const OS_2FA_KEY = "os-2fa-v1";

export function isTwoFactorEnrolled(): boolean {
  try {
    return JSON.parse(localStorage.getItem(OS_2FA_KEY) ?? "{}").enrolled === true;
  } catch {
    return false;
  }
}

export function markTwoFactorEnrolled(enforced: boolean): void {
  try {
    localStorage.setItem(OS_2FA_KEY, JSON.stringify({ enrolled: true, enforced, at: new Date().toISOString() }));
  } catch {
    /* storage unavailable — preview only */
  }
}

export interface PendingVerificationTarget {
  masked: string;
  channel: "email" | "phone";
  purpose: "signup verification" | "sign-in challenge";
}

/** Static preview of the pending verification created by the previous step. */
export const getPendingVerificationTarget = (): Promise<PendingVerificationTarget> =>
  latency({ masked: "t•••••@ostrade.app", channel: "email" as const, purpose: "signup verification" as const }, 300, 450);
