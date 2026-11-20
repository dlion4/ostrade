// A-2 service layer. Signatures mirror the future auth REST API.
// FRONTEND-ONLY: no session is issued, no code is sent or verified over the wire.
import {
  postSignInPanels,
  recentSessions,
  recoveryOptions,
  redirectNodes,
  roleRedirects,
  securityPractices,
  sessionPolicies,
  signInFaqs,
  signInMethods,
  type PostSignInPanel,
  type RecentSession,
  type RecoveryOption,
  type RedirectNode,
  type RoleRedirect,
  type SecurityPractice,
  type SessionPolicy,
  type SignInFaq,
  type SignInMethod,
} from "@/data/auth-signin";
import { latency } from "./_latency";

export type { PostSignInPanel, RecentSession, RecoveryOption, RedirectNode, RoleRedirect, SecurityPractice, SessionPolicy, SignInFaq, SignInMethod };

export const getSignInMethods = (): Promise<SignInMethod[]> => latency(signInMethods, 300, 500);
export const getRoleRedirects = (): Promise<RoleRedirect[]> => latency(roleRedirects, 300, 600);
export const getSessionPolicies = (): Promise<SessionPolicy[]> => latency(sessionPolicies, 300, 500);
export const getRecentSessions = (): Promise<RecentSession[]> => latency(recentSessions, 300, 600);
export const getPostSignInPanels = (): Promise<PostSignInPanel[]> => latency(postSignInPanels, 300, 500);
export const getRecoveryOptions = (): Promise<RecoveryOption[]> => latency(recoveryOptions, 300, 500);
export const getSecurityPractices = (): Promise<SecurityPractice[]> => latency(securityPractices, 300, 500);
export const getSignInFaqs = (): Promise<SignInFaq[]> => latency(signInFaqs, 300, 500);
export const getRedirectNodes = (): Promise<RedirectNode[]> => latency(redirectNodes, 300, 400);

export interface CredentialsInput {
  identifier: string;
  password?: string;
  remember: boolean;
}
export interface OtpCredentialsInput {
  identifier: string;
  remember: boolean;
}
export interface InertAuthResult {
  status: "ready";
  simulated: boolean;
  title: string;
  message: string;
  detail: string;
  reference: string;
  landing: string;
}

const landing = "/dashboard · T-1 Command Center";

/** Future REST shape: POST /auth/session (password grant). Stops at a labelled state today. */
export async function signInWithPassword(input: CredentialsInput): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: "Your identifier and password format passed every local check. No session was issued.",
    detail: `Next in the real flow: a 6-digit TOTP challenge, then a ${input.remember ? "30-day" : "browser-lifetime"} session.`,
    reference: "SESSION-PREVIEW-001",
    landing,
  }, 500, 800);
}

/** Future REST shape: POST /auth/session (passwordless). Stops at a labelled state today. */
export async function signInWithOtp(input: OtpCredentialsInput): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: "A one-time code would be issued to the identifier you entered. Nothing was sent.",
    detail: `Delivery is not wired yet. The code would expire in 10 minutes and sign you in for ${input.remember ? "30 days" : "this browser session"}.`,
    reference: "OTP-PREVIEW-010",
    landing,
  }, 500, 800);
}

/** Future REST shape: POST /auth/session/verify. Checks format only, never a real code. */
export async function verifySecondFactor(code: string, kind: "totp" | "otp"): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: `The ${code.length}-digit ${kind === "totp" ? "TOTP" : "one-time"} code was checked for format only.`,
    detail: `You would now land on ${landing}.`,
    reference: "VERIFY-PREVIEW-001",
    landing,
  }, 450, 750);
}

/** Future REST shape: POST /auth/session/revoke-all. Deliberately inert in this preview. */
export async function revokeAllSessions(): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: "Every remembered device would be signed out at once.",
    detail: "The session list below is local sample data, so nothing was actually revoked.",
    reference: "REVOKE-PREVIEW-001",
    landing,
  }, 400, 700);
}
