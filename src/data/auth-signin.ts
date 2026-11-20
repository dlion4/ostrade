// A-2 Sign In mock data. Local only — no credentials are checked, no session is issued.
// Static snapshots only: nothing on this page ticks or random-walks.

export interface SignInMethod {
  id: "password" | "otp";
  name: string;
  tagline: string;
  whenToUse: string;
  needs: string[];
  fallback: string;
}
export const signInMethods: SignInMethod[] = [
  {
    id: "password",
    name: "Password + 2FA",
    tagline: "The default path for a trusted device.",
    whenToUse: "Use this on hardware you control, where a stored session makes sense.",
    needs: ["Email address or +254 phone", "Your password (10+ characters)", "A 6-digit TOTP code"],
    fallback: "Forgot it? Reset by email, or switch to a one-time code.",
  },
  {
    id: "otp",
    name: "One-time code",
    tagline: "Passwordless sign-in when you cannot reach your passphrase.",
    whenToUse: "Use this from a shared or temporary device, or after a password reset.",
    needs: ["Email address or +254 phone", "A 6-digit code delivered to that address", "Nothing else"],
    fallback: "Codes expire quickly and can be requested again.",
  },
];

export interface RoleRedirect {
  id: string;
  role: string;
  scope: string;
  landsOn: string;
  note: string;
}
export const roleRedirects: RoleRedirect[] = [
  { id: "r01", role: "Trader", scope: "Default role", landsOn: "/dashboard", note: "Every trading surface: Signal Desk, positions, records." },
  { id: "r02", role: "Master admin", scope: "First account on the instance", landsOn: "/dashboard", note: "Same landing page, plus accounts, roles and instance settings." },
  { id: "r03", role: "Trader · paper only", scope: "Workspace preference", landsOn: "/dashboard", note: "Live order routing stays hidden until a live account is connected." },
  { id: "r04", role: "Trader · automation on", scope: "Rules & schedules enabled", landsOn: "/dashboard", note: "Command Center surfaces the schedule meter and kill-switch first." },
  { id: "r05", role: "Trader · automation paused", scope: "Kill-switch engaged", landsOn: "/dashboard", note: "Landing shows the paused banner with a one-click resume." },
  { id: "r06", role: "Trader · 2FA pending", scope: "Not yet enrolled", landsOn: "/dashboard", note: "A dismissible prompt offers 2FA enrollment before any live keys." },
  { id: "r07", role: "Trader · degraded broker", scope: "Adapter offline", landsOn: "/dashboard", note: "The affected account is flagged; automation targeting it is paused." },
  { id: "r08", role: "Trader · onboarding incomplete", scope: "Wizard not finished", landsOn: "/auth/onboard", note: "Profile and risk defaults are needed before guardrails can apply." },
  { id: "r09", role: "Trader · broker not connected", scope: "No account linked", landsOn: "/auth/broker-connect", note: "The dashboard would otherwise load with no account context." },
  { id: "r10", role: "Session expired", scope: "Signed out by timeout", landsOn: "/auth/signin", note: "You return here with your identifier pre-filled, never your password." },
];

export interface SessionPolicy {
  id: string;
  title: string;
  value: string;
  detail: string;
}
export const sessionPolicies: SessionPolicy[] = [
  { id: "p01", title: "Remember me", value: "30 days", detail: "Opt-in only. Without it, the session ends when the browser closes." },
  { id: "p02", title: "Idle timeout", value: "30 minutes", detail: "Inactivity ends the session; the account switcher and kill-switch stay visible." },
  { id: "p03", title: "Absolute session cap", value: "12 hours", detail: "A session cannot live longer than this even while you keep working." },
  { id: "p04", title: "Password length", value: "10+ characters", detail: "Plus at least one number and one symbol, checked before the submit is allowed." },
  { id: "p05", title: "TOTP challenge", value: "6 digits", detail: "Presented inline after a correct password when 2FA is enabled." },
  { id: "p06", title: "OTP code lifetime", value: "10 minutes", detail: "One-time codes expire quickly and are single-use." },
  { id: "p07", title: "Identifier masking", value: "Always", detail: "Recovery messages never reveal the full email or phone on file." },
  { id: "p08", title: "Password autofill", value: "Blocked", detail: "The identifier is never pre-filled, and passwords are never persisted by OStrade." },
  { id: "p09", title: "Device trust", value: "Per device", detail: "Remember-me is bound to this device, so a stolen cookie is less useful." },
  { id: "p10", title: "Sign out everywhere", value: "1 click", detail: "Revokes every remembered device at once from the session list." },
];

export interface RecentSession {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  method: string;
  lastActive: string;
  status: "Current" | "Active" | "Expired" | "Revoked";
}
export const recentSessions: RecentSession[] = [
  { id: "s01", device: "MacBook Pro 14\"", browser: "Chrome 131", location: "Nairobi, KE", ip: "197.232.61.44", method: "Password + 2FA", lastActive: "now", status: "Current" },
  { id: "s02", device: "iPhone 15 Pro", browser: "Safari Mobile", location: "Nairobi, KE", ip: "197.232.61.44", method: "One-time code", lastActive: "2 hours ago", status: "Active" },
  { id: "s03", device: "Pixel 8", browser: "Chrome Mobile", location: "Mombasa, KE", ip: "41.90.12.180", method: "Password + 2FA", lastActive: "Yesterday", status: "Active" },
  { id: "s04", device: "ThinkPad X1", browser: "Firefox 133", location: "Kampala, UG", ip: "154.16.88.21", method: "Password + 2FA", lastActive: "3 days ago", status: "Active" },
  { id: "s05", device: "iPad Air", browser: "Safari Mobile", location: "Nairobi, KE", ip: "197.232.61.44", method: "One-time code", lastActive: "5 days ago", status: "Expired" },
  { id: "s06", device: "Windows Desktop", browser: "Edge 130", location: "Dar es Salaam, TZ", ip: "41.86.102.7", method: "Password + 2FA", lastActive: "6 days ago", status: "Expired" },
  { id: "s07", device: "Galaxy S23", browser: "Samsung Internet", location: "Nairobi, KE", ip: "197.232.61.44", method: "Password + 2FA", lastActive: "1 week ago", status: "Active" },
  { id: "s08", device: "MacBook Air", browser: "Safari 18", location: "Kisumu, KE", ip: "102.217.44.9", method: "One-time code", lastActive: "2 weeks ago", status: "Expired" },
  { id: "s09", device: "Linux Workstation", browser: "Chrome 129", location: "Nairobi, KE", ip: "197.232.61.44", method: "Password + 2FA", lastActive: "3 weeks ago", status: "Revoked" },
  { id: "s10", device: "iPhone 13", browser: "Safari Mobile", location: "Nakuru, KE", ip: "102.217.44.9", method: "Password + 2FA", lastActive: "1 month ago", status: "Revoked" },
  { id: "s11", device: "Surface Pro 9", browser: "Edge 128", location: "Nairobi, KE", ip: "154.16.88.21", method: "One-time code", lastActive: "1 month ago", status: "Expired" },
  { id: "s12", device: "Redmi Note 12", browser: "Chrome Mobile", location: "Eldoret, KE", ip: "41.90.12.180", method: "Password + 2FA", lastActive: "2 months ago", status: "Revoked" },
];

export interface PostSignInPanel {
  id: string;
  code: string;
  name: string;
  blurb: string;
  highlight: boolean;
}
export const postSignInPanels: PostSignInPanel[] = [
  { id: "n01", code: "T-1", name: "Command Center", blurb: "Balances, open positions, schedule meter and the kill-switch in one view.", highlight: true },
  { id: "n02", code: "T-2", name: "Markets", blurb: "Static and broker-fed quotes by instrument, venue and session.", highlight: false },
  { id: "n03", code: "T-3", name: "Trade Ticket", blurb: "Manual order entry with the same risk readout as a parsed signal.", highlight: false },
  { id: "n04", code: "T-4", name: "Signal Desk", blurb: "Paste a message, edit the parsed card, confirm the trade.", highlight: true },
  { id: "n05", code: "T-5", name: "Automation Engine", blurb: "Channel rules with per-rule pause and sizing overrides.", highlight: false },
  { id: "n06", code: "T-6", name: "Trade Scheduler", blurb: "Up to 50 queued trades, 20 per bulk paste, with the slot meter.", highlight: false },
  { id: "n07", code: "T-7", name: "Positions & Orders", blurb: "Open positions, pending orders and their references.", highlight: false },
  { id: "n08", code: "T-8", name: "Records & Analytics", blurb: "Every action with timestamp, account, status and P&L.", highlight: true },
  { id: "n09", code: "T-9", name: "Accounts & Broker Hub", blurb: "Connect, switch and compare accounts and their capabilities.", highlight: false },
  { id: "n10", code: "T-14", name: "Risk & Guardrails", blurb: "Loss caps, lot caps, allow-lists and trading hours.", highlight: false },
];

export interface RecoveryOption {
  id: string;
  title: string;
  text: string;
  route: "/auth/signup" | "/auth/forgot-password" | "/auth/reset-password" | "/auth/verify-otp" | "/auth/2fa" | "/auth/broker-connect" | "/status" | "/legal/$doc";
  label: string;
}
export const recoveryOptions: RecoveryOption[] = [
  { id: "v01", title: "Forgot password", text: "Request a reset link to the address or number on file. The message never reveals what is on file.", route: "/auth/forgot-password", label: "Start reset" },
  { id: "v02", title: "Reset password", text: "Choose a new passphrase that meets the 10-character policy, then sign in again.", route: "/auth/reset-password", label: "Open reset" },
  { id: "v03", title: "Verify with OTP", text: "Confirm a 6-digit code sent to your email or phone when the password path is unavailable.", route: "/auth/verify-otp", label: "Verify code" },
  { id: "v04", title: "2FA recovery", text: "Lost your authenticator? Use a recovery code, or re-enroll after re-verifying your identity.", route: "/auth/2fa", label: "Open 2FA" },
  { id: "v05", title: "Create a new account", text: "No workspace yet? Sign up and start on a simulated $10,000 paper account.", route: "/auth/signup", label: "Sign up" },
  { id: "v06", title: "Broker connect help", text: "Signed in but stuck at the connection step? The broker guide lists every supported flow.", route: "/auth/broker-connect", label: "Connect help" },
  { id: "v07", title: "System status", text: "Check whether sign-in, broker adapters or the scheduler are degraded before you retry.", route: "/status", label: "View status" },
  { id: "v08", title: "Privacy policy", text: "How identifiers, sessions and encrypted broker credentials are handled.", route: "/legal/$doc", label: "Read privacy" },
  { id: "v09", title: "Terms of service", text: "The rules of the platform, including the single-operator instance model.", route: "/legal/$doc", label: "Read terms" },
  { id: "v10", title: "Risk disclosure", text: "Trading involves a high risk of loss. OStrade is software, not investment advice.", route: "/legal/$doc", label: "Read risk" },
];

export interface SecurityPractice {
  id: string;
  title: string;
  text: string;
}
export const securityPractices: SecurityPractice[] = [
  { id: "sp01", title: "No credential storage", text: "This frontend preview never stores, transmits or verifies a password." },
  { id: "sp02", title: "Identifier first", text: "We ask for an email or +254 number, never a username you could guess." },
  { id: "sp03", title: "Inline 2FA", text: "The TOTP challenge appears on the same card, so there is no second page to phish." },
  { id: "sp04", title: "Auto-advance digits", text: "Six focused inputs move you forward as you type and accept a pasted code." },
  { id: "sp05", title: "Show/hide by choice", text: "Password visibility is off by default and never toggled for you." },
  { id: "sp06", title: "Remember me is opt-in", text: "Thirty-day sessions exist only when you tick the box on this device." },
  { id: "sp07", title: "Rate-limited attempts", text: "Failed sign-ins back off exponentially; the button disables while a check runs." },
  { id: "sp08", title: "No error oracle", text: "Recovery messages avoid confirming whether a specific address exists." },
  { id: "sp09", title: "Session visibility", text: "Every remembered device is listed, with a one-click sign-out-everywhere." },
  { id: "sp10", title: "Encrypted broker vault", text: "After sign-in, broker credentials belong in AES-256 storage, never in a session." },
];

export interface SignInFaq { id: string; q: string; a: string; }
export const signInFaqs: SignInFaq[] = [
  { id: "q01", q: "Can I sign in with my phone number?", a: "Yes. Use the Kenyan international format +2547XXXXXXXX or +2541XXXXXXXX in the same field where you would type an email. The format helper converts a leading 0 for you." },
  { id: "q02", q: "What is the 'remember me' option?", a: "It keeps you signed in for 30 days on this device only. Without it, the session ends when the browser closes. You can revoke remembered devices from the session list." },
  { id: "q03", q: "Why does a 2FA code appear after my password?", a: "When a time-based one-time password is enrolled, the second factor is required on the same card. The six digits auto-advance as you type and accept a pasted code." },
  { id: "q04", q: "What if I cannot reach my authenticator app?", a: "Use a saved recovery code, or switch to a one-time code delivered to your email or phone. If both are unavailable, the reset flow re-verifies your identity first." },
  { id: "q05", q: "Where will I land after signing in?", a: "Traders go to /dashboard, the Command Center. If onboarding or a broker connection is still missing, you land on the page that fixes it instead — never on an empty screen." },
  { id: "q06", q: "Is my password checked on this page?", a: "No. This is a frontend-only preview. Every field is validated locally, and the submit resolves to a clearly labelled 'Ready — executes when the backend is connected' state." },
  { id: "q07", q: "Can I sign in from a shared computer?", a: "Use the one-time code path and leave 'remember me' unticked. When you are finished, use sign-out-everywhere to clear every device." },
  { id: "q08", q: "What happens if I enter the wrong code?", a: "In this preview only the format is checked. In the real flow, attempts are rate-limited and the remaining tries are shown before the code is locked." },
  { id: "q09", q: "Do I need a broker account to sign in?", a: "No. A workspace can stay on paper indefinitely. Broker credentials are added later, in an encrypted vault, and only where the broker API supports the connection." },
  { id: "q10", q: "Is signing in financial advice?", a: "No. OStrade is execution and organisation software, not advice. Trading leveraged products carries a high risk of loss; practise on a paper account first." },
];

export interface RedirectNode {
  id: string;
  step: number;
  title: string;
  detail: string;
  mono: string;
}
export const redirectNodes: RedirectNode[] = [
  { id: "d1", step: 1, title: "Identify", detail: "Email or +254 number, matched against the instance's single-operator model.", mono: "identifier" },
  { id: "d2", step: 2, title: "Authenticate", detail: "Password, or a one-time code if you chose the passwordless path.", mono: "credential" },
  { id: "d3", step: 3, title: "Second factor", detail: "Six-digit TOTP inline, auto-advancing between digits.", mono: "totp · 6" },
  { id: "d4", step: 4, title: "Route by role", detail: "Trader lands on the Command Center; incomplete setup routes to the fix.", mono: "role: trader" },
];
