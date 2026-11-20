// A-1 Sign Up mock data. Local only — no network, no accounts are created.
// Static snapshots: quotes here intentionally never tick or random-walk.

export interface QuoteSnapshot {
  symbol: string;
  venue: string;
  bid: string;
  ask: string;
  change: string;
  direction: "up" | "down";
  assetClass: string;
}
export const quoteSnapshots: QuoteSnapshot[] = [
  { symbol: "EURUSD", venue: "Exness MT5", bid: "1.08420", ask: "1.08432", change: "+0.12%", direction: "up", assetClass: "Forex" },
  { symbol: "GBPUSD", venue: "cTrader", bid: "1.27118", ask: "1.27130", change: "−0.08%", direction: "down", assetClass: "Forex" },
  { symbol: "XAUUSD", venue: "Exness MT5", bid: "2385.50", ask: "2385.72", change: "+0.41%", direction: "up", assetClass: "Metals" },
  { symbol: "BTCUSDT", venue: "Binance", bid: "64120.00", ask: "64124.50", change: "−0.62%", direction: "down", assetClass: "Crypto" },
  { symbol: "R_10", venue: "Deriv", bid: "4532.11", ask: "4532.86", change: "+0.27%", direction: "up", assetClass: "Synthetics" },
  { symbol: "US30", venue: "Exness MT5", bid: "39120.0", ask: "39122.4", change: "−0.19%", direction: "down", assetClass: "Indices" },
  { symbol: "USDJPY", venue: "OANDA", bid: "156.102", ask: "156.116", change: "+0.09%", direction: "up", assetClass: "Forex" },
  { symbol: "NAS100", venue: "cTrader", bid: "19842.5", ask: "19843.8", change: "+0.33%", direction: "up", assetClass: "Indices" },
  { symbol: "ETHUSDT", venue: "Binance", bid: "3120.00", ask: "3120.80", change: "−0.24%", direction: "down", assetClass: "Crypto" },
  { symbol: "AUDUSD", venue: "Deriv", bid: "0.66401", ask: "0.66412", change: "+0.06%", direction: "up", assetClass: "Forex" },
];

export interface SignupTrustPoint { icon: "lock" | "flask" | "key" | "shield" | "wallet" | "check"; title: string; text: string; }
export const signupTrustPoints: SignupTrustPoint[] = [
  { icon: "flask", title: "Paper first", text: "A simulated $10,000 workspace is ready the moment you sign up." },
  { icon: "lock", title: "AES-256 vault", text: "Broker credentials are designed for encrypted storage, never plain text." },
  { icon: "key", title: "Trade-only keys", text: "Withdrawal permission is never needed to execute a signal." },
  { icon: "wallet", title: "We never hold funds", text: "Your money stays at your broker, always." },
  { icon: "shield", title: "Mandatory consent", text: "Terms and the Risk Disclosure must both be accepted before continuing." },
  { icon: "check", title: "Explicit confirmations", text: "A pasted signal never becomes an order without your review." },
  { icon: "shield", title: "Kill-switch", text: "One control pauses every rule, schedule and co-pilot action." },
  { icon: "lock", title: "2FA enrollment", text: "Add a second factor before enabling any live connection." },
  { icon: "check", title: "Records journal", text: "Manual, signal, scheduled and finance actions all leave a trace." },
  { icon: "flask", title: "Revoke anytime", text: "Disconnect OStrade from the broker's own dashboard whenever you want." },
];

export interface SignupBenefit { id: string; title: string; text: string; }
export const signupBenefits: SignupBenefit[] = [
  { id: "b01", title: "Signal Desk", text: "Paste Telegram, TradingView or copy-provider signals into an editable order card." },
  { id: "b02", title: "Paper fills", text: "Simulated orders resolve with references like OST-2025-00123, locally." },
  { id: "b03", title: "Account switcher", text: "Switch between Paper, Deriv and Exness/MT5 from one top bar." },
  { id: "b04", title: "Signal rules", text: "Attach sizing and symbol filters to the channels you actually trust." },
  { id: "b05", title: "Schedules", text: "Queue up to 50 timed trades, 20 at a time with bulk paste." },
  { id: "b06", title: "AI co-pilot", text: "Reads your journal and drafts suggestions that you approve." },
  { id: "b07", title: "Risk guards", text: "Loss caps, lot caps, mandatory stops and duplicate shields run first." },
  { id: "b08", title: "Records & analytics", text: "One journal with account, timestamp, reference and status." },
  { id: "b09", title: "Finance rails", text: "API, deep-link and manual-rail flows stay reconciled in the ledger." },
  { id: "b10", title: "Notifications", text: "Know when an order fills, a guard blocks, or an account degrades." },
];

export interface SecurityCheck { id: string; label: string; detail: string; scope: "Form" | "Account" | "Platform"; }
export const securityChecks: SecurityCheck[] = [
  { id: "c01", label: "Valid email address", detail: "Required, normalised to lowercase before submission.", scope: "Form" },
  { id: "c02", label: "Kenyan phone format", detail: "Optional; when provided it must match ^\\+254[17]\\d{8}$.", scope: "Form" },
  { id: "c03", label: "10+ character password", detail: "Longer passphrases resist guessing far better than short ones.", scope: "Form" },
  { id: "c04", label: "At least one number", detail: "One digit 0–9 somewhere in the password.", scope: "Form" },
  { id: "c05", label: "At least one symbol", detail: "One non-alphanumeric character such as !, # or $.", scope: "Form" },
  { id: "c06", label: "Passwords match", detail: "Confirmation must match exactly, including case.", scope: "Form" },
  { id: "c07", label: "Terms accepted", detail: "A separate, explicit checkbox — never pre-ticked.", scope: "Form" },
  { id: "c08", label: "Risk Disclosure accepted", detail: "Mandatory for any trading product, never bundled with Terms.", scope: "Form" },
  { id: "c09", label: "6-digit OTP", detail: "Phone or email verification precedes broker connections.", scope: "Account" },
  { id: "c10", label: "2FA before live", detail: "A second factor is recommended before real credentials are added.", scope: "Platform" },
];

export interface OnboardingStep { id: string; code: string; title: string; text: string; route: "/auth/signup" | "/auth/signin" | "/auth/verify-otp" | "/auth/onboard" | "/auth/broker-connect" | "/auth/2fa" | "/how-it-works" | "/brokers" | "/"; }
export const onboardingSteps: OnboardingStep[] = [
  { id: "o01", code: "A-1", title: "Create your account", text: "Email, optional +254 phone, strong password and both mandatory consents.", route: "/auth/signup" },
  { id: "o02", code: "A-7", title: "Verify with a 6-digit OTP", text: "Confirm your email or phone before anything sensitive can be added.", route: "/auth/verify-otp" },
  { id: "o03", code: "A-3", title: "Set your preferences", text: "Base currency, trading hours, default account and risk limits.", route: "/auth/onboard" },
  { id: "o04", code: "A-4", title: "Connect a broker", text: "OAuth, API keys or MT5 login + server — or stay on paper.", route: "/auth/broker-connect" },
  { id: "o05", code: "A-8", title: "Enroll in 2FA", text: "Add a second factor before enabling live trading permissions.", route: "/auth/2fa" },
  { id: "o06", code: "T-3", title: "Rehearse a paper trade", text: "Paste a signal, edit the card, confirm and watch a simulated fill.", route: "/how-it-works" },
  { id: "o07", code: "T-14", title: "Tune your guardrails", text: "Daily loss cap, max lots, allowed symbols and mandatory stops.", route: "/how-it-works" },
  { id: "o08", code: "T-4", title: "Send your first signal", text: "Telegram, TradingView or a copy-provider message into the Signal Desk.", route: "/how-it-works" },
  { id: "o09", code: "T-5", title: "Enable automation", text: "Rules, schedules and co-pilot drafts — always under the kill-switch.", route: "/how-it-works" },
  { id: "o10", code: "T-9", title: "Go live when ready", text: "Compare capabilities, then deliberately switch from paper to a live account.", route: "/brokers" },
];

export interface SignupFaq { id: string; q: string; a: string; }
export const signupFaqs: SignupFaq[] = [
  { id: "sf01", q: "Do I need a broker account to sign up?", a: "No. Every workspace opens with a simulated paper account. You can connect Deriv, Exness/MT5 or another broker later, or never at all." },
  { id: "sf02", q: "Do I need to add payment details?", a: "No card, bank account or deposit is required to create a workspace in this frontend preview. Deposits belong to the broker, not OStrade." },
  { id: "sf03", q: "Why is my phone number optional?", a: "Email alone is enough to get started. If you add a phone for OTP or alerts, OStrade expects the Kenyan international format +2547XXXXXXXX or +2541XXXXXXXX." },
  { id: "sf04", q: "Why is the password policy so strict?", a: "Ten characters plus a number and a symbol is the minimum for an account that can later hold encrypted broker credentials. A passphrase is easiest to remember." },
  { id: "sf05", q: "Why are there two separate consent checkboxes?", a: "Terms of service and the Risk Disclosure are different documents. For a trading product, accepting the risk disclosure must be a deliberate, separate action." },
  { id: "sf06", q: "What happens after I press Create account?", a: "In this frontend-only preview, validation runs locally and the submit resolves to a designed 'Ready — executes when the backend is connected' state. No account is created and no email is sent." },
  { id: "sf07", q: "Is this the master admin account?", a: "OStrade uses a single-operator model: the first account on an instance is the master admin. Later pages cover roles, 2FA and recovery for that account." },
  { id: "sf08", q: "Can I use a demo or paper broker instead?", a: "Yes. Paper runs entirely inside OStrade, while Deriv demo, MT5 trial, Alpaca paper, Binance testnet and OANDA practice let you rehearse against a broker sandbox." },
  { id: "sf09", q: "Where are my broker credentials stored?", a: "Nowhere yet — no credentials are collected in this frontend preview. The designed model uses AES-256 encrypted storage, with trade-only keys and revocation from either side." },
  { id: "sf10", q: "Is signing up financial advice?", a: "No. OStrade is execution and organisation software, not advice. Trading leveraged products carries a high risk of loss; paper-trade your strategy first." },
];

export interface WorkspacePreview {
  id: string;
  name: string;
  balance: string;
  currency: string;
  leverage: string;
  mode: string;
  note: string;
}
export const workspacePreviews: WorkspacePreview[] = [
  { id: "w01", name: "OStrade Paper", balance: "10,000.00", currency: "USD", leverage: "1 : 100", mode: "Simulated", note: "Default workspace — no credentials, no real money." },
  { id: "w02", name: "Deriv Demo", balance: "10,000.00", currency: "USD", leverage: "Contract", mode: "Broker demo", note: "Synthetics and forex on the Deriv sandbox." },
  { id: "w03", name: "Exness MT5 Trial", balance: "5,000.00", currency: "USD", leverage: "1 : 200", mode: "Broker demo", note: "MetaApi bridge, conventional MT5 lots." },
  { id: "w04", name: "Alpaca Paper", balance: "100,000.00", currency: "USD", leverage: "Cash", mode: "Broker demo", note: "US stocks and crypto with paper API keys." },
  { id: "w05", name: "Binance Testnet", balance: "10,000.00", currency: "USDT", leverage: "Spot", mode: "Broker demo", note: "Crypto-only sandbox with separate API keys." },
  { id: "w06", name: "OANDA Practice", balance: "100,000.00", currency: "USD", leverage: "1 : 50", mode: "Broker demo", note: "Practice token, v20 instrument naming." },
  { id: "w07", name: "cTrader Demo", balance: "10,000.00", currency: "EUR", leverage: "1 : 100", mode: "Broker demo", note: "Open API OAuth on a cTrader demo account." },
  { id: "w08", name: "IC Markets Demo", balance: "10,000.00", currency: "USD", leverage: "1 : 500", mode: "Broker demo", note: "MT5 trial with exact server name required." },
  { id: "w09", name: "Pepperstone Demo", balance: "50,000.00", currency: "AUD", leverage: "1 : 200", mode: "Broker demo", note: "MT5 trial for forex and index rehearsal." },
  { id: "w10", name: "XM Demo", balance: "10,000.00", currency: "USD", leverage: "1 : 100", mode: "Broker demo", note: "MT5 trial with account-specific symbol suffixes." },
];
