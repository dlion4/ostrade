// Auth service layer — signatures mirror the future REST API.
// FRONTEND-ONLY: no account is created, no OTP is sent, nothing goes over the wire.
import {
  onboardingSteps,
  quoteSnapshots,
  securityChecks,
  signupBenefits,
  signupFaqs,
  signupTrustPoints,
  workspacePreviews,
  type OnboardingStep,
  type QuoteSnapshot,
  type SecurityCheck,
  type SignupBenefit,
  type SignupFaq,
  type SignupTrustPoint,
  type WorkspacePreview,
} from "@/data/auth";
import { latency } from "./_latency";

export type { OnboardingStep, QuoteSnapshot, SecurityCheck, SignupBenefit, SignupFaq, SignupTrustPoint, WorkspacePreview };

export const getQuoteSnapshots = (): Promise<QuoteSnapshot[]> => latency(quoteSnapshots, 300, 500);
export const getSignupTrustPoints = (): Promise<SignupTrustPoint[]> => latency(signupTrustPoints, 300, 500);
export const getSignupBenefits = (): Promise<SignupBenefit[]> => latency(signupBenefits, 300, 500);
export const getSecurityChecks = (): Promise<SecurityCheck[]> => latency(securityChecks, 300, 500);
export const getOnboardingSteps = (): Promise<OnboardingStep[]> => latency(onboardingSteps, 300, 500);
export const getSignupFaqs = (): Promise<SignupFaq[]> => latency(signupFaqs, 300, 500);
export const getWorkspacePreviews = (): Promise<WorkspacePreview[]> => latency(workspacePreviews, 300, 600);

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
