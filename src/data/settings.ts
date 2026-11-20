import type { BrokerKey } from "./dashboard";

export const profileFixture = {
  name: "Alex Kamau",
  email: "alex@example.invalid",
  phone: "+254700000000",
  loginAlerts: true,
};
export const demoPassword = "OStrade-demo-only";
export const demoOtp = "000000";
export const demoTotp = "123456";
export const sessionFixtures = [
  "Chrome · macOS",
  "Safari · iOS",
  "Edge · Windows",
  "Firefox · Linux",
  "Chrome · Android",
  "Safari · macOS",
  "Chromium · Linux",
  "Firefox · Windows",
  "Chrome · Windows",
  "Edge · macOS",
].map((device, i) => ({
  id: `SES-${101 + i}`,
  device,
  ip: `192.0.2.${21 + i}`,
  location: i % 3 ? "Nairobi, KE" : "Kiambu, KE",
  age: i,
  current: i === 0,
  state: i < 3 ? ("Active" as const) : ("Expired" as const),
}));
export const inboundSources = [
  "TradingView",
  "Generic",
  "CopyFactory",
] as const;
export type InboundSource = (typeof inboundSources)[number];
export const inboundSlugs: Record<InboundSource, string> = {
  TradingView: "tradingview",
  Generic: "generic",
  CopyFactory: "copyfactory",
};
export const demoWebhookUrl = (source: InboundSource, secret = "••••") =>
  `https://hooks.example.invalid/webhooks/${inboundSlugs[source]}/${secret}`;
export const outboundEvents = [
  "order.filled",
  "order.failed",
  "position.closed",
  "schedule.fired",
  "rule.fired",
  "guard.blocked",
  "deposit.confirmed",
  "withdraw.settled",
  "copilot.proposal",
  "killswitch.engaged",
] as const;
export type OutboundEvent = (typeof outboundEvents)[number];
export const tokenScopes = [
  "orders:read",
  "orders:write",
  "positions:read",
  "signals:read",
  "signals:write",
  "schedules:read",
  "schedules:write",
  "ledger:read",
  "webhooks:read",
  "audit:read",
] as const;
export type TokenScope = (typeof tokenScopes)[number];
export const integrations = [
  "Telegram bot",
  "TradingView webhooks",
  "CopyFactory",
  "Google Sheets",
  "Africa’s Talking",
  "Resend",
] as const;
export type Integration = (typeof integrations)[number];
export const integrationFields: Record<Integration, readonly string[]> = {
  "Telegram bot": ["Bot token"],
  "TradingView webhooks": ["Signing secret"],
  CopyFactory: ["Project identifier", "API token"],
  "Google Sheets": ["Spreadsheet identifier", "Service credential"],
  "Africa’s Talking": ["Username", "API key"],
  Resend: ["Sender address", "API key"],
};
export const flagCatalog = [
  ["enable_signal_automation", "Signal automation", true],
  ["enable_scheduler_bulk_paste", "Scheduler bulk paste", true],
  ["enable_copilot_tool_calls", "Co-Pilot tool calls", true],
  ["enable_telegram_control", "Telegram control", false],
  ["enable_crypto_deposits", "Crypto deposits", false],
  ["enable_kes_display", "KES display", true],
  ["enable_copyfactory_import", "CopyFactory import", false],
  ["enable_auto_mitigate", "AI auto-mitigation", false],
] as const;
export type Flag = (typeof flagCatalog)[number][0];
export const environments = ["Paper", "Demo", "Live"] as const;
export type SettingsEnvironment = (typeof environments)[number];
export const limitDefaults = {
  MAX_SCHEDULES: 50,
  MAX_SIGNAL_RULES: 30,
  MAX_CONNECTED_ACCOUNTS: 12,
};
export const timezones = [
  "Africa/Nairobi",
  "UTC",
  "Africa/Lagos",
  "Europe/London",
  "America/New_York",
  "Asia/Tokyo",
] as const;
export const appearanceDefaults = {
  theme: "light" as "light" | "dark" | "system",
  density: "comfortable" as "comfortable" | "compact",
  chart: "dark" as "light" | "dark",
  numbers: "en-KE" as "en-KE" | "en-US" | "de-DE",
  mono: true,
  motion: "system" as "system" | "reduce",
};
export const localeDefaults = {
  currency: "USD" as "USD" | "KES",
  timezone: "Africa/Nairobi" as (typeof timezones)[number],
  size: "Lots" as "Lots" | "Units",
  pnl: "Amount" as "Amount" | "Percent",
  week: "Monday" as "Monday" | "Sunday",
  date: "Day first" as "Day first" | "ISO",
};
export const tif = ["GTC", "DAY", "IOC"] as const;
export const adapterDefaults = {
  manual: "",
  signals: "",
  schedules: "",
  slippage: 2,
  tif: "GTC" as (typeof tif)[number],
  appId: "",
  brand: "",
  region: "london" as "london" | "new-york" | "singapore",
  backfill: 90,
};
export const retentionDefaults = { ledger: 7, audit: 7, ticks: 90 };
export const consentFixtures = [
  "Privacy notice acknowledged",
  "Terms accepted",
  "Paper simulation consent",
  "Risk disclosure acknowledged",
  "Email preference recorded",
  "Analytics declined",
  "Data export notice reviewed",
  "Broker disclaimer acknowledged",
  "Retention notice reviewed",
  "Workspace notice acknowledged",
].map((event, i) => ({
  id: `CONS-${410 + i}`,
  event,
  at: new Date(Date.UTC(2025, 10, 20 - i, 8, 30)).toISOString(),
  revision: i < 4 ? "2019-11 / v2" : "2019-11 / v1",
}));
export type BrokerDefaults = typeof adapterDefaults;
export type BrokerVisibility = Partial<Record<BrokerKey, boolean>>;
