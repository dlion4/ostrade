// A-2 service layer. Signatures mirror the future auth REST API.
// FRONTEND-ONLY: no session is issued, no code is sent or verified over the wire.
import { latency } from "./_latency";

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

export interface PasswordResetRequest {
  identifier: string;
  channel: "email" | "phone";
}

/** Future REST shape: POST /auth/password/reset-request. Rate-limits (1/60s, 5/hour) are enforced by the backend; the preview mirrors them client-side. */
export async function requestPasswordResetOtp(input: PasswordResetRequest): Promise<InertAuthResult> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: `A 6-digit reset code would be sent by ${input.channel} to the identifier you entered. Nothing was sent.`,
    detail: "Next in the real flow: the code expires in 10 minutes and is single-use; it unlocks the reset-password page.",
    reference: "RESET-PREVIEW-001",
    landing: "/auth/reset-password · A-6",
  }, 450, 750);
}

export interface ResetPasswordInput {
  code: string;
  password: string;
}

/** What the real reset flow reports: sessions killed, WS tokens dropped in memory. */
export interface ResetSecuritySummary {
  sessionsInvalidated: number;
  wsTokensRevoked: string[];
  note: string;
}

/** Future REST shape: POST /auth/password/reset. Preview stops at a labelled state and reports the designed blast radius. */
export async function resetPassword(_input: ResetPasswordInput): Promise<InertAuthResult & { security: ResetSecuritySummary }> {
  return latency({
    status: "ready" as const,
    simulated: false,
    title: "Ready — executes when the backend is connected",
    message: "The code format and new password passed every local check. Nothing was reset and no session was touched.",
    detail: "Next in the real flow: the code is burned, the password hash is replaced, and every live session is killed at once.",
    reference: "RESET-PREVIEW-002",
    landing: "/auth/signin · auto-redirect",
    security: {
      sessionsInvalidated: 2,
      wsTokensRevoked: ["Deriv WebSocket session", "MetaApi MT5 bridge"],
      note: "Adapters reconnect automatically with the stored credentials on your next sign-in — re-authentication at the broker is never needed.",
    },
  }, 500, 800);
}
