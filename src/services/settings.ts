import { sampleUsdKes } from "@/data/finance";
import {
  adapterDefaults,
  consentFixtures,
  demoOtp,
  demoPassword,
  demoTotp,
  demoWebhookUrl,
  environments,
  flagCatalog,
  inboundSlugs,
  inboundSources,
  integrationFields,
  integrations,
  limitDefaults,
  outboundEvents,
  profileFixture,
  sessionFixtures,
  tif,
  timezones,
  tokenScopes,
  type Flag,
  type InboundSource,
  type Integration,
  type OutboundEvent,
  type SettingsEnvironment,
  type TokenScope,
} from "@/data/settings";
import { adapterSnapshots, type BrokerKey } from "@/data/dashboard";
import { latency } from "./_latency";
import {
  brokerVisible,
  readPreferences,
  writePreference,
  type WorkspacePreferences,
} from "./workspacePreferences";
import { getAccounts, getPositions } from "./dashboard";
import { getTradeRecords, getTradeJournal } from "./records";
import { getFinanceLedger } from "./financeLedger";
import { getSignals } from "./signalDesk";
import { getRiskAudit } from "./risk";
import { resetTelegramPreview } from "./notifications";
import {
  getAccountSymbolOverrides,
  saveAccountSymbolOverride,
} from "./symbolMappings";
import { getMarketUniverse } from "./markets";
import { getRecentTickets } from "./tradeTicket";
import { settingsZip } from "./settingsZip";
export * from "@/data/settings";

const now = () => new Date().toISOString();
const copy = <T>(value: T) => latency(structuredClone(value));
const random = (n = 16) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
const id = (prefix: string) => `${prefix}-${random(5).toUpperCase()}`;
const requireCode = (code: string) => {
  if (code !== demoTotp)
    throw new Error("Use the demo authenticator code 123456.");
};
let profile = { ...profileFixture },
  password = demoPassword,
  recoveryVersion = 1;
let sessions = sessionFixtures.map((r) => ({
  ...r,
  state: r.state as "Active" | "Expired" | "Revoked",
}));
let contact:
  | { key: string; email: string; phone: string; exp: number }
  | undefined;
let enrollment: { key: string; exp: number } | undefined;
const audit: { id: string; event: string; at: string }[] = [];
const log = (event: string) => {
  audit.unshift({ id: id("SET"), event, at: now() });
};
const inbound = inboundSources.map((source, i) => ({
  source,
  secret: `demo_${inboundSlugs[source]}_sample_only`,
  hits: [124, 38, 12][i],
  lastHit: `2025-11-${20 - i}T08:30:00Z`,
  rotatedAt: null as string | null,
}));
let outbound = {
  url: "",
  secret: "",
  events: ["order.filled", "guard.blocked"] as OutboundEvent[],
};
const deliveries: {
  id: string;
  event: OutboundEvent;
  status: string;
  at: string;
  latencyMs: null;
  retries: number;
  origin: string;
}[] = outboundEvents.map((event, i) => ({
  id: `WH-${141 + i}`,
  event,
  status: "Fixture · not sent",
  at: `2025-11-${20 - i}T08:30:00Z`,
  latencyMs: null,
  retries: 0,
  origin: "Historical example",
}));
const tokens: {
  id: string;
  label: string;
  scopes: TokenScope[];
  last4: string;
  state: "Active" | "Revoked";
  updatedAt: string;
}[] = [];
const configured = new Set<Integration>();
const flags = Object.fromEntries(
  environments.map((env) => [
    env,
    Object.fromEntries(
      flagCatalog.map(([k, , enabled]) => [k, env !== "Live" && enabled]),
    ),
  ]),
) as Record<SettingsEnvironment, Record<Flag, boolean>>;
const limits = Object.fromEntries(
  environments.map((env) => [env, { ...limitDefaults }]),
) as Record<SettingsEnvironment, typeof limitDefaults>;
const exportJobs: {
  id: string;
  status: "Queued" | "Ready" | "Failed";
  at: string;
  name: string;
}[] = [];
const artifacts = new Map<string, Blob>();
let deletion:
  | { requestedAt: string; scheduledAt: string; state: "Rehearsed" }
  | undefined;

export const getSettingsSecurity = () =>
  copy({ profile, sessions, recoveryVersion, audit });
export async function saveSettingsProfile(input: typeof profileFixture) {
  const name = input.name.trim(),
    email = input.email.trim().toLowerCase(),
    phone = input.phone.trim();
  if (
    name.length < 2 ||
    name.length > 64 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 100 ||
    !/^\+[1-9]\d{7,14}$/.test(phone)
  )
    throw new Error(
      "Enter a name, a valid email, and a phone with its country code.",
    );
  if (email !== profile.email || phone !== profile.phone) {
    contact = { key: id("OTP"), email, phone, exp: Date.now() + 300000 };
    return copy({
      challenge: contact.key,
      message: "Contact change requires the demo OTP. No message was sent.",
    });
  }
  profile = { ...profile, name, loginAlerts: input.loginAlerts };
  log("Profile preferences saved");
  return copy({ challenge: undefined, message: "Demo profile saved." });
}
export async function confirmSettingsContact(input: {
  key: string;
  code: string;
}) {
  if (
    !contact ||
    contact.key !== input.key ||
    contact.exp <= Date.now() ||
    input.code !== demoOtp
  )
    throw new Error("Use the current contact challenge and demo OTP 000000.");
  profile = { ...profile, email: contact.email, phone: contact.phone };
  contact = undefined;
  log("Demo contact change verified");
  return copy({ message: "Demo contact saved. No message was sent." });
}
export async function changeSettingsPassword(input: {
  current: string;
  next: string;
  confirm: string;
}) {
  if (input.current !== password)
    throw new Error("The current preview password did not match.");
  if (
    input.next.length < 12 ||
    input.next.length > 100 ||
    input.next === password ||
    input.next !== input.confirm
  )
    throw new Error(
      "Use a new 12–100 character demo password and match the confirmation.",
    );
  password = input.next;
  log("Preview password reset");
  return copy({
    message:
      "Preview password changed for this session; sign-in credentials were not changed.",
  });
}
export async function startSettingsEnrollment(code: string) {
  requireCode(code);
  enrollment = { key: id("ENR"), exp: Date.now() + 300000 };
  return copy(enrollment);
}
export async function confirmSettingsEnrollment(input: {
  key: string;
  code: string;
}) {
  requireCode(input.code);
  if (
    !enrollment ||
    enrollment.key !== input.key ||
    enrollment.exp <= Date.now()
  )
    throw new Error("Start a new demo enrollment.");
  enrollment = undefined;
  log("Authenticator re-enrollment rehearsed");
  return copy({
    message: "Demo re-enrollment complete. No authenticator was enrolled.",
  });
}
export async function regenerateSettingsRecovery(code: string) {
  requireCode(code);
  recoveryVersion++;
  log("Preview recovery codes regenerated");
  return copy({
    codes: Array.from({ length: 10 }, () => `DEMO-${random(4).toUpperCase()}`),
  });
}
export async function revokeSettingsSessions(input: {
  id: string;
  code: string;
}) {
  requireCode(input.code);
  const selected = sessions.filter(
    (s) =>
      !s.current &&
      s.state === "Active" &&
      (input.id === "all" || s.id === input.id),
  );
  if (!selected.length) throw new Error("No matching active demo sessions.");
  selected.forEach((s) => (s.state = "Revoked"));
  log(`Revoked ${selected.length} demo sessions`);
  return copy({
    message: `${selected.length} demo session(s) revoked; this browser was kept.`,
  });
}
export const getSettingsWebhooks = () =>
  copy({
    inbound: inbound.map(({ secret, ...r }) => ({
      ...r,
      url: demoWebhookUrl(r.source),
      last4: secret.slice(-4),
    })),
    outbound: {
      url: outbound.url,
      events: outbound.events,
      secretSet: !!outbound.secret,
    },
    deliveries,
  });
export async function manageInbound(input: {
  source: InboundSource;
  action: "reveal" | "rotate";
  code: string;
}) {
  requireCode(input.code);
  const row = inbound.find((s) => s.source === input.source);
  if (!row || !["reveal", "rotate"].includes(input.action))
    throw new Error("Choose a valid inbound action.");
  if (input.action === "rotate") {
    row.secret = `demo_${random()}`;
    row.rotatedAt = now();
  }
  log(
    `${row.source} preview secret ${input.action === "rotate" ? "rotated" : "revealed"}`,
  );
  return copy({
    url: demoWebhookUrl(row.source, row.secret),
    secret: row.secret,
  });
}
export async function saveOutbound(input: {
  url: string;
  secret: string;
  events: OutboundEvent[];
}) {
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new Error("Enter an HTTPS endpoint URL.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.href.length > 250 ||
    !url.hostname.includes(".")
  )
    throw new Error(
      "Use an HTTPS endpoint without credentials, a query string, or a fragment.",
    );
  if (
    (!outbound.secret || input.secret) &&
    !/^demo_[A-Za-z0-9_-]{12,90}$/.test(input.secret)
  )
    throw new Error(
      "Use a non-production HMAC secret starting demo_ with at least 12 characters after it.",
    );
  if (
    !input.events.length ||
    input.events.some((e) => !outboundEvents.includes(e))
  )
    throw new Error("Select at least one supported event.");
  outbound = {
    url: url.href,
    secret: input.secret || outbound.secret,
    events: [...new Set(input.events)],
  };
  log("Outbound preview configured");
  return copy({
    message: "Preview endpoint saved. No webhook was registered.",
  });
}
export async function testOutbound(event: OutboundEvent) {
  if (!outbound.url || !outbound.events.includes(event))
    throw new Error("Save the endpoint and enable this event first.");
  const proof = {
    id: id("WH"),
    event,
    status: "Prepared · not sent",
    at: now(),
    latencyMs: null,
    retries: 0,
    origin: "Local rehearsal",
  };
  const enc = new TextEncoder(),
    payload = JSON.stringify({
      id: proof.id,
      event,
      createdAt: proof.at,
      mode: "demo",
    });
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(outbound.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Array.from(
    new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  deliveries.unshift(proof);
  return copy({ proof, payload, signature: `sha256=${signature}` });
}
export async function resetSettingsTelegram(code: string) {
  requireCode(code);
  const removed = await resetTelegramPreview();
  log("Telegram preview pairings cleared");
  return copy({
    message: `${removed} demo chat(s) removed. No Telegram API was contacted.`,
  });
}
export const getSettingsTokens = () => copy(tokens);
export async function manageSettingsToken(input: {
  action: "create" | "rotate" | "revoke";
  id?: string;
  label?: string;
  scopes?: TokenScope[];
  code: string;
}) {
  requireCode(input.code);
  const label = input.label?.trim() ?? "",
    scopes = [...new Set(input.scopes ?? [])];
  const row = tokens.find((t) => t.id === input.id && t.state === "Active");
  if (!["create", "rotate", "revoke"].includes(input.action))
    throw new Error("Choose a valid token action.");
  if (input.action !== "create" && !row)
    throw new Error("Choose an active demo token.");
  if (input.action === "revoke" && row) {
    row.state = "Revoked";
    row.updatedAt = now();
    log("Demo API token revoked");
    return copy({ secret: undefined, message: "Demo token revoked." });
  }
  if (
    input.action === "create" &&
    (label.length < 2 ||
      label.length > 40 ||
      !scopes.length ||
      scopes.some((s) => !tokenScopes.includes(s)) ||
      tokens.some(
        (t) =>
          t.state === "Active" && t.label.toLowerCase() === label.toLowerCase(),
      ))
  )
    throw new Error(
      "Choose a unique 2–40 character label and at least one scope.",
    );
  const secret = `os_demo_${random(24)}`;
  if (row) {
    row.last4 = secret.slice(-4);
    row.updatedAt = now();
  } else
    tokens.unshift({
      id: id("TOK"),
      label,
      scopes,
      last4: secret.slice(-4),
      updatedAt: now(),
      state: "Active",
    });
  log(
    input.action === "rotate"
      ? "Demo API token rotated"
      : "Demo API token prepared",
  );
  return copy({
    secret,
    message: "Copy this value now. It is a non-functional preview token.",
  });
}
export const getSettingsPreferences = () =>
  copy({ ...readPreferences(), sampleUsdKes });
export async function saveAppearance(v: WorkspacePreferences["appearance"]) {
  if (
    !["light", "dark", "system"].includes(v.theme) ||
    !["comfortable", "compact"].includes(v.density) ||
    !["dark", "light"].includes(v.chart) ||
    !["en-KE", "en-US", "de-DE"].includes(v.numbers) ||
    !["system", "reduce"].includes(v.motion) ||
    typeof v.mono !== "boolean"
  )
    throw new Error("Choose valid appearance preferences.");
  return copy(writePreference("appearance", v).appearance);
}
export async function saveLocale(v: WorkspacePreferences["locale"]) {
  if (
    !timezones.includes(v.timezone) ||
    !["USD", "KES"].includes(v.currency) ||
    !["Lots", "Units"].includes(v.size) ||
    !["Amount", "Percent"].includes(v.pnl) ||
    !["Monday", "Sunday"].includes(v.week) ||
    !["Day first", "ISO"].includes(v.date)
  )
    throw new Error("Choose valid locale preferences.");
  return copy(writePreference("locale", v).locale);
}
export async function getSettingsBrokers() {
  const [accounts, mappings, symbols] = await Promise.all([
    getAccounts(),
    getAccountSymbolOverrides(),
    getMarketUniverse(),
  ]);
  return {
    accounts,
    mappings,
    symbols,
    preferences: readPreferences().brokers,
    adapters: adapterSnapshots.map((a) => ({
      id: a.broker,
      label: a.name,
      enabled: brokerVisible(a.broker),
    })),
  };
}
export async function saveBrokerDefaults(v: typeof adapterDefaults) {
  const accounts = await getAccounts();
  if (
    [v.manual, v.signals, v.schedules].some(
      (a) => a && !accounts.some((r) => r.id === a),
    ) ||
    !Number.isFinite(v.slippage) ||
    v.slippage < 0 ||
    v.slippage > 100 ||
    !tif.includes(v.tif) ||
    !Number.isInteger(v.backfill) ||
    v.backfill < 1 ||
    v.backfill > 365 ||
    !/^\d{0,10}$/.test(v.appId) ||
    v.brand.length > 60 ||
    !["london", "new-york", "singapore"].includes(v.region)
  )
    throw new Error(
      "Check account selections, slippage (0–100), Deriv app ID, and backfill (1–365 days).",
    );
  log("Broker defaults saved");
  return copy(writePreference("brokers", v).brokers);
}
export async function setBrokerVisibility(input: {
  broker: BrokerKey;
  enabled: boolean;
}) {
  if (
    input.broker === "paper" ||
    !adapterSnapshots.some((a) => a.broker === input.broker)
  )
    throw new Error("Paper must remain available.");
  const prefs = readPreferences();
  writePreference("visible", {
    ...prefs.visible,
    [input.broker]: input.enabled,
  });
  if (!input.enabled) {
    const active = new Set((await getAccounts()).map((a) => a.id));
    const next = { ...prefs.brokers };
    for (const field of ["manual", "signals", "schedules"] as const)
      if (next[field] && !active.has(next[field])) next[field] = "";
    writePreference("brokers", next);
  }
  log(`Adapter ${input.broker} ${input.enabled ? "shown" : "hidden"}`);
  return copy({
    message: `Adapter ${input.enabled ? "shown" : "hidden"} in account selectors. Credentials and history were not changed.`,
  });
}
export async function saveSettingsMapping(input: {
  accountId: string;
  canonical: string;
  suffix: string;
}) {
  if (!/^[A-Za-z0-9._#-]{0,12}$/.test(input.suffix))
    throw new Error("Use a suffix up to 12 letters, numbers, or . _ # -.");
  const account = (await getAccounts()).find((a) => a.id === input.accountId),
    symbol = (await getMarketUniverse()).find(
      (s) => s.canonical === input.canonical,
    );
  const base = account && symbol?.brokerSymbols[account.broker];
  if (!base) throw new Error("Choose an instrument supported by this account.");
  return saveAccountSymbolOverride({
    ...input,
    brokerSymbol: `${base}${input.suffix}`,
    source: "Manual",
  });
}
export async function getSettingsPrivacy() {
  const enc = new TextEncoder();
  const consent = await Promise.all(
    consentFixtures.map(async (e) => ({
      ...e,
      hash: Array.from(
        new Uint8Array(
          await crypto.subtle.digest("SHA-256", enc.encode(JSON.stringify(e))),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join(""),
    })),
  );
  return copy({
    retention: readPreferences().retention,
    consent,
    jobs: exportJobs,
    deletion,
  });
}
export async function saveRetention(v: WorkspacePreferences["retention"]) {
  if (
    !Number.isInteger(v.ledger) ||
    v.ledger < 7 ||
    v.ledger > 20 ||
    !Number.isInteger(v.audit) ||
    v.audit < 7 ||
    v.audit > 20 ||
    !Number.isInteger(v.ticks) ||
    v.ticks < 1 ||
    v.ticks > 365
  )
    throw new Error(
      "Ledger and audit must be 7–20 years; ticks must be 1–365 days.",
    );
  log("Retention preference saved");
  return copy(writePreference("retention", v).retention);
}
export async function queueSettingsExport() {
  const job = {
    id: id("ZIP"),
    status: "Queued" as "Queued" | "Ready" | "Failed",
    name: `ostrade-workspace-${now().slice(0, 10)}.zip`,
    at: now(),
  };
  exportJobs.unshift(job);
  log("Local workspace export queued");
  void Promise.all([
    getTradeRecords(),
    getTradeJournal(),
    getSignals(),
    getFinanceLedger(),
    getRiskAudit(),
    getPositions(),
    getRecentTickets(),
  ])
    .then(([orders, journal, signals, ledger, risk, positions, tickets]) => {
      artifacts.set(
        job.id,
        settingsZip({
          "profile.json": profile,
          "orders.json": { tickets, closedTrades: orders },
          "positions.json": positions,
          "journal.json": journal,
          "signals.json": signals,
          "ledger.json": ledger,
          "audit.json": { settings: audit, risk },
          "preferences.json": readPreferences(),
        }),
      );
      job.status = "Ready";
    })
    .catch(() => {
      job.status = "Failed";
    });
  return copy({
    id: job.id,
    message: "Workspace ZIP queued locally. Secrets are excluded.",
  });
}
export async function downloadSettingsExport(key: string) {
  const file = artifacts.get(key),
    job = exportJobs.find((j) => j.id === key);
  if (!file || !job) throw new Error("The archive is not ready yet.");
  await latency(null);
  return { file, name: job.name };
}
export async function rehearseSettingsDeletion(input: {
  phrase: string;
  code: string;
}) {
  requireCode(input.code);
  if (input.phrase !== "DELETE WORKSPACE")
    throw new Error("Type DELETE WORKSPACE exactly.");
  deletion = {
    requestedAt: now(),
    scheduledAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    state: "Rehearsed",
  };
  log("Deletion workflow rehearsed only");
  return copy({
    message:
      "Deletion rehearsal recorded. No workspace data, credentials, or accounts were removed.",
  });
}
export const getSettingsFeatures = () =>
  copy({
    flags,
    limits,
    integrations: integrations.map((name) => ({
      name,
      fields: integrationFields[name],
      configured: configured.has(name),
      status: "Offline preview",
    })),
  });
export async function saveSettingsFlags(input: {
  env: SettingsEnvironment;
  flags: Record<Flag, boolean>;
  limits: typeof limitDefaults;
}) {
  if (
    !environments.includes(input.env) ||
    flagCatalog.some(([key]) => typeof input.flags[key] !== "boolean") ||
    Object.keys(limitDefaults).some((k) => {
      const n = input.limits[k as keyof typeof limitDefaults];
      return !Number.isInteger(n) || n < 1 || n > 500;
    })
  )
    throw new Error("Choose valid flags and whole limits between 1 and 500.");
  flags[input.env] = Object.fromEntries(
    flagCatalog.map(([k]) => [k, input.flags[k]]),
  ) as Record<Flag, boolean>;
  limits[input.env] = { ...input.limits };
  log(`${input.env} feature profile saved`);
  return copy({
    message:
      "Environment profile saved for preview; runtime features were not enabled.",
  });
}
export async function configureSettingsIntegration(input: {
  name: Integration;
  values: string[];
}) {
  if (
    !integrations.includes(input.name) ||
    input.values.length !== integrationFields[input.name].length ||
    input.values.some((v) => !/^demo_[A-Za-z0-9@._-]{4,150}$/.test(v))
  )
    throw new Error(
      "Use a demo_ placeholder for each field. Real credentials are not accepted.",
    );
  configured.add(input.name);
  log(`${input.name} credential form validated`);
  return copy({
    message:
      "Demo fields validated and discarded. A backend vault is required for real credentials.",
  });
}
export async function testSettingsIntegration(name: Integration) {
  if (!integrations.includes(name)) throw new Error("Choose an integration.");
  const proof = id("INT");
  log(`${name} offline test · ${proof}`);
  return copy({
    message: `${proof} · ${configured.has(name) ? "Demo configuration validated" : "No demo credentials staged"} · No external request made.`,
  });
}
