import { publishNotice } from "./notificationStore";
import {
  carryOptions,
  channelOptions,
  defaultSession,
  holdModes,
  riskCases,
  riskPolicies,
  shieldFields,
  type RiskAudit,
  type RiskControlKind,
  type RiskReceipt,
  type RiskRule,
  type RiskShields,
  type RiskState,
  type RiskTicket,
  type SessionPolicy,
} from "@/data/risk";
import { marketSymbols } from "@/data/markets";
import { eatDay } from "@/data/records";
import {
  applyKillSwitch,
  closePosition,
  evaluateWorkspaceOrder,
  getAccounts,
  getLocalKillSwitch,
  getPositions,
  getSignalRules,
  readOpenRiskPositions,
} from "./dashboard";
import {
  accountPauses,
  addRiskAudit,
  dayLocked,
  getProfileSession,
  lastEngagement,
  lockdown,
  lockDay,
  markEngagement,
  policies,
  policyLabel,
  readRiskAudit,
  riskSnapshot,
  rulePauses,
  safeRiskText,
  sessionPolicies,
  setLockdown,
  shields,
  updateShields,
} from "./riskEngine";
import { readTradeRiskHistory } from "./records";
import { latency } from "./_latency";

export type {
  RiskAudit,
  RiskControlKind,
  RiskReceipt,
  RiskRule,
  RiskShields,
  RiskState,
  RiskTicket,
  SessionPolicy,
} from "@/data/risk";
export {
  carryOptions,
  channelOptions,
  holdModes,
  riskCases,
  riskPolicies,
  shieldFields,
};
const money = (n: number) => `$${n.toFixed(2)}`;
const codeRequired = (code?: string) => {
  if (code !== "123456")
    throw new Error(
      "Use the demo authenticator code 123456. Do not enter a real code.",
    );
};
const validReason = (raw: string) => {
  const reason = safeRiskText(raw);
  if (reason.length < 12 || reason === "[redacted]")
    throw new Error(
      "Enter an operator reason of at least 12 characters without sensitive data.",
    );
  return reason;
};
const state = (): RiskState => (lockdown ? "lockdown" : getLocalKillSwitch());
const receipts: RiskReceipt[] = [];
let receiptCounter = 0,
  controlBusy = false;
const configs = () => ({ policies, shields });
export const getRiskAudit = () => latency(readRiskAudit());
export const getRiskConfig = () => latency(configs());
export async function getRiskOverview() {
  const [accounts, positions, rules] = await Promise.all([
    getAccounts(),
    getPositions(),
    getSignalRules(),
  ]);
  const view = riskSnapshot(accounts, positions),
    day = eatDay(Date.now());
  const blocks = readRiskAudit().filter(
    (row) =>
      row.rule === "Pre-trade admission" &&
      row.decision === "BLOCK" &&
      eatDay(row.at) === day,
  ).length;
  return {
    ...view,
    blocks,
    state: state(),
    day,
    engagement: lastEngagement,
    accounts: accounts.map((a) => ({
      id: a.id,
      label: a.label,
      broker: a.broker,
    })),
    rules: rules.map((row) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      accountId: row.accountId,
    })),
    pausedAccounts: [...accountPauses],
    pausedRules: [...rulePauses],
    controlBusy,
  };
}
export async function getRiskCatalog() {
  const accounts = await getAccounts();
  return latency({
    accounts: accounts.map((a) => ({ id: a.id, label: a.label })),
    markets: marketSymbols.map((s) => ({
      symbol: s.canonical,
      entry: s.ask,
      pip: s.pip,
      size: s.minVolume,
      unit: s.volumeUnit,
    })),
  });
}
export async function saveRiskRule(input: { rule: RiskRule; code?: string }) {
  codeRequired(input.code);
  const r = input.rule,
    spec = riskPolicies.find((p) => p.id === r.id);
  if (
    !spec ||
    typeof r.enabled !== "boolean" ||
    !Number.isFinite(r.value) ||
    r.value < spec.min ||
    r.value > spec.max ||
    (["openCount", "leverage", "hourly", "minutes", "hold"].includes(r.id) &&
      !Number.isInteger(r.value))
  )
    throw new Error("Enter a value within the policy’s bounds.");
  if (r.id === "dailyLoss" && r.scope === "all" && !r.enabled)
    throw new Error("The global loss circuit breaker cannot be disabled.");
  if (r.id === "hourly" && r.scope !== "all")
    throw new Error("The rolling trades/hour cap is global only.");
  if (
    r.unit !== spec.unit &&
    !(r.id === "stake" && r.unit === "% equity" && r.value <= 100) &&
    !(r.id === "openCount" && r.scope === "all" && r.unit === "positions total")
  )
    throw new Error(
      "Select a valid threshold unit for this scope. A percentage stake cannot exceed 100.",
    );
  const accounts = await getAccounts(),
    account = accounts.find((a) => a.id === r.scope);
  if (r.scope !== "all" && !account)
    throw new Error("Choose a valid account scope.");
  const at = policies.findIndex((p) => p.id === r.id && p.scope === r.scope);
  if (at === -1) policies.push({ ...r });
  else policies[at] = { ...r };
  const detail = r.enabled
    ? r.id === "hold"
      ? holdModes[r.value]
      : `${r.value} ${r.unit}`
    : "Disabled";
  const row = addRiskAudit({
    category: "Policy",
    mode: "Live local",
    rule: policyLabel(r),
    subject: "Guardrail settings",
    scope: account?.label ?? "Workspace",
    decision: "PASS",
    detail: `${detail} · demo 2FA verified.`,
  });
  if (r.id === "dailyLoss" && r.enabled && state() === "armed") {
    const selected = account
      ? accounts.filter((a) => a.id === r.scope)
      : accounts;
    const pnl = selected.reduce((n, a) => n + a.realizedToday, 0),
      cap = (selected.reduce((n, a) => n + a.equity, 0) * r.value) / 100;
    if (cap <= 0 || -pnl >= cap)
      await applyKillSwitch(
        "paused",
        `Daily loss circuit breaker triggered after a policy change (${money(-pnl)} / ${money(cap)}).`,
      );
  }
  return latency({
    message: "Policy saved locally. Change appended to audit.",
    ref: row.id,
    state: state(),
  });
}
export async function saveRiskShields(input: {
  settings: RiskShields;
  code?: string;
}) {
  codeRequired(input.code);
  for (const f of shieldFields) {
    const n = input.settings[f.key];
    if (
      !Number.isFinite(n) ||
      n < f.min ||
      n > f.max ||
      (["duplicateSeconds", "perMinute", "signalPerMinute"].includes(f.key) &&
        !Number.isInteger(n))
    )
      throw new Error(`${f.label}: use a value from ${f.min} to ${f.max}.`);
  }
  const settings = Object.fromEntries(
    shieldFields.map((f) => [f.key, input.settings[f.key]]),
  ) as RiskShields;
  updateShields(settings);
  addRiskAudit({
    category: "Policy",
    mode: "Live local",
    rule: "Shield thresholds",
    subject: "Guard configuration",
    scope: "Workspace",
    decision: "PASS",
    detail: shieldFields
      .map((f) => `${f.label}: ${settings[f.key]} ${f.unit}`)
      .join(" · "),
  });
  return latency({ message: "Shield thresholds saved and audited." });
}
export const getRiskSessions = async () => {
  const accounts = await getAccounts();
  return latency({
    day: eatDay(Date.now()),
    workspaceStopped: dayLocked("all"),
    rows: accounts.map((a, i) =>
      getProfileSession(a, i, readTradeRiskHistory()),
    ),
  });
};
export async function saveRiskSession(input: {
  accountId: string;
  settings: SessionPolicy;
  code?: string;
}) {
  codeRequired(input.code);
  const { reminder, lossStreak } = input.settings;
  if (
    !Number.isInteger(reminder) ||
    reminder < 15 ||
    reminder > 240 ||
    !Number.isInteger(lossStreak) ||
    lossStreak < 1 ||
    lossStreak > 20
  )
    throw new Error(
      "Use a reminder of 15–240 minutes and 1–20 consecutive losses.",
    );
  const account = (await getAccounts()).find((a) => a.id === input.accountId);
  if (!account) throw new Error("Choose an existing account.");
  sessionPolicies.set(account.id, { reminder, lossStreak });
  addRiskAudit({
    category: "Session",
    mode: "Live local",
    rule: "Reality check preferences",
    subject: "Session setup",
    scope: account.label,
    decision: "PASS",
    detail: `Reminder ${reminder} minutes · stop after ${lossStreak} losses. No broker setting sent.`,
  });
  return latency({ message: "Session preferences saved locally." });
}
export async function stopRiskSession(input: {
  scope: string;
  reason: string;
  code?: string;
}) {
  codeRequired(input.code);
  const reason = validReason(input.reason);
  const account = (await getAccounts()).find((a) => a.id === input.scope);
  if (input.scope !== "all" && !account)
    throw new Error("Choose a valid account.");
  lockDay(input.scope);
  addRiskAudit({
    category: "Session",
    mode: "Live local",
    rule: "Stop trading for today",
    subject: "Session boundary",
    scope: account?.label ?? "Workspace",
    decision: "PASS",
    reason,
    detail:
      "New orders are blocked through 23:59:59 EAT. Closing positions remains available.",
  });
  return latency({
    message: "New entries locked until midnight EAT. No positions were closed.",
  });
}
export const getRiskReceipts = () => latency(receipts);
export async function runRiskControl(input: {
  kind: RiskControlKind;
  target?: string;
  reason: string;
  code?: string;
  source?: "Telegram rehearsal";
}) {
  codeRequired(input.code);
  const reason = validReason(input.reason);
  if (controlBusy)
    throw new Error("Wait for the current workspace control to finish.");
  controlBusy = true;
  try {
    const { kind, target } = input;
    const accounts = await getAccounts();
    const record = (message: string, scope: string, ref?: string) => {
      const row = addRiskAudit({
        category: "Control",
        mode: "Live local",
        rule: kind,
        subject: input.source ? "Emergency control · Telegram rehearsal" : "Emergency control",
        scope,
        decision: "PASS",
        reason,
        detail: message,
        ref,
      });
      markEngagement({ at: row.at, command: kind, reason, ref: ref ?? row.id });
      if (["pause","lockdown","flatten","rule-pause","account-pause"].includes(kind)) publishNotice({event:"killswitch.engaged",id:`switch:${ref??row.id}`,title:kind==='lockdown'?'Full workspace lockdown':kind==='flatten'?'Close-all completed':kind==='pause'?'Automation paused':'Scoped automation paused',body:message,accountLabel:scope,ref:ref??row.id});
      return latency({ message, state: state(), ref: row.ref ?? row.id });
    };
    if (
      kind === "account-pause" ||
      kind === "account-resume" ||
      kind === "rule-pause" ||
      kind === "rule-resume"
    ) {
      const isAccount = kind.startsWith("account");
      const a = accounts.find((x) => x.id === target),
        r = (await getSignalRules()).find((x) => x.id === target);
      if (!target || (isAccount ? !a : !r))
        throw new Error("Choose an existing profile or rule.");
      const set = isAccount ? accountPauses : rulePauses;
      if (kind.endsWith("-pause")) set.add(target);
      else set.delete(target);
      return record(
        kind.endsWith("-pause")
          ? "Scoped automation paused. Manual tickets still use all guardrails."
          : "Scoped hold removed. Existing disabled rules and any workspace halt remain in force.",
        isAccount ? a!.label : r!.name,
      );
    }
    if (kind === "rearm") {
      const active = policies
        .filter((r) => r.id === "dailyLoss" && r.enabled)
        .find((r) => {
          const scope = accounts.filter(
            (a) => r.scope === "all" || a.id === r.scope,
          );
          return (
            scope.length > 0 &&
            -scope.reduce((n, a) => n + a.realizedToday, 0) >=
              (scope.reduce((n, a) => n + a.equity, 0) * r.value) / 100
          );
        });
      if (active) {
        addRiskAudit({
          category: "Control",
          mode: "Live local",
          rule: "Re-arm refused",
          subject: "Circuit breaker",
          scope: active.scope,
          decision: "BLOCK",
          reason,
          detail: "Daily loss limit is still breached.",
        });
        throw new Error(
          "Cannot re-arm: a daily loss circuit breaker is still breached.",
        );
      }
      const outcome = await applyKillSwitch("armed", reason, {
        quiet: true,
        code: input.code,
      });
      if (outcome.mode === "blocked") throw new Error(outcome.detail);
      setLockdown(false);
      return record(outcome.detail, "Workspace", outcome.ref);
    }
    if (kind === "pause") {
      if (state() === "flattened" || state() === "lockdown")
        throw new Error(
          "This would weaken an active emergency state. Use protected re-arm first.",
        );
      const outcome = await applyKillSwitch("paused", reason, { quiet: true });
      return record(outcome.detail, "Workspace", outcome.ref);
    }
    if (kind === "lockdown") {
      setLockdown(true);
      const outcome = await applyKillSwitch(
        getLocalKillSwitch() === "flattened" ? "flattened" : "paused",
        reason,
        { quiet: true, flatten: false },
      );
      return record(
        "Full lockdown blocks new local entries. Session revocation and channel broadcasts are previews only; no tokens or messages were sent.",
        "Workspace",
        outcome.ref,
      );
    }
    if (kind !== "flatten") throw new Error("Select a valid emergency action.");
    const marking = applyKillSwitch("flattened", reason, {
      quiet: true,
      flatten: false,
    });
    const before = readOpenRiskPositions();
    const rows = await Promise.all(
      accounts.map(async (a) => {
        const positions = before.filter((p) => p.accountId === a.id);
        const result = await Promise.all(
          positions.map((p) => closePosition(p.id)),
        );
        const paper = a.broker === "paper" && a.environment === "paper",
          closed = result.filter((r) => r.mode === "simulated");
        return {
          id: `FLAT-${String(++receiptCounter).padStart(4, "0")}`,
          accountId: a.id,
          accountLabel: a.label,
          attempted: positions.length,
          closed: closed.length,
          status: (paper
            ? closed.length === positions.length
              ? "Simulated"
              : "Needs review"
            : "Offline") as RiskReceipt["status"],
          refs: positions.map((p) => p.ref),
          detail: !positions.length
            ? "No open positions in this snapshot."
            : !paper
              ? "Broker closure is a preview. Open positions were not changed."
              : `${closed.length} Paper position(s) closed and journaled.`,
        };
      }),
    );
    receipts.unshift(...rows);
    const outcome = await marking;
    const closed = rows.reduce((n, r) => n + r.closed, 0),
      untouched = rows
        .filter((r) => r.status === "Offline")
        .reduce((n, r) => n + r.attempted, 0);
    return record(
      `${closed} Paper closures booked; ${untouched} broker positions untouched. Inspect the completion report.`,
      "Workspace",
      outcome.ref,
    );
  } finally {
    controlBusy = false;
  }
}
export async function retryRiskReceipt(input: {
  id: string;
  code?: string;
  reason: string;
}) {
  codeRequired(input.code);
  const reason = validReason(input.reason);
  const receipt = receipts.find((r) => r.id === input.id);
  if (!receipt) throw new Error("Receipt unavailable.");
  const open = (await getPositions({ accountId: receipt.accountId })).filter(
    (p) => receipt.refs.includes(p.ref),
  );
  const paper =
    (receipt.status === "Needs review" || receipt.status === "Simulated") &&
    (state() === "flattened" || state() === "lockdown");
  const res = paper
    ? await Promise.all(
        open
          .filter((p) => p.broker === "paper")
          .map((p) => closePosition(p.id)),
      )
    : [];
  const count = res.filter((r) => r.mode === "simulated").length;
  const message =
    receipt.status === "Offline"
      ? "Retry validated locally. Broker execution stays offline and positions remain untouched."
      : paper
        ? `${count} outstanding Paper positions closed. Already closed positions are never replayed.`
        : "Re-engage the emergency switch before retrying an outstanding Paper receipt.";
  receipts.unshift({
    ...receipt,
    id: `FLAT-${String(++receiptCounter).padStart(4, "0")}`,
    attempted: open.length,
    closed: count,
    status:
      receipt.status === "Offline"
        ? "Offline"
        : count === open.length
          ? "Simulated"
          : "Needs review",
    detail: message,
  });
  addRiskAudit({
    category: "Control",
    mode: "Live local",
    rule: "Close-all retry",
    subject: receipt.id,
    scope: receipt.accountLabel,
    decision:
      receipt.status === "Offline" || count === open.length ? "PASS" : "BLOCK",
    reason,
    detail: message,
    ref: receipt.id,
  });
  return latency({ message });
}
export async function previewRiskTickets(tickets: RiskTicket[]) {
  return latency(
    tickets.map((ticket) => ({
      accountId: ticket.accountId,
      ...evaluateWorkspaceOrder(ticket),
    })),
  );
}
export const getRiskAnomalyEvidence = () =>
  latency(
    readRiskAudit()
      .filter(
        (r) =>
          r.mode === "Live local" &&
          r.decision === "BLOCK" &&
          (r.category === "Shield" || r.rule === "Daily loss circuit breaker"),
      )
      .slice(0, 6),
  );
export async function runRiskLab(input: {
  ticket: RiskTicket;
  overrideReason?: string;
}) {
  const t = {
    ...input.ticket,
    symbol: input.ticket.symbol.trim().toUpperCase(),
  };
  if (
    !channelOptions.includes(t.channel) ||
    !["BUY", "SELL"].includes(t.side) ||
    (t.carry && !carryOptions.includes(t.carry)) ||
    !t.symbol ||
    t.symbol.length > 24 ||
    ![t.size, t.entry, t.sl, t.tp].every(Number.isFinite)
  )
    throw new Error(
      "Enter a valid symbol, side, source, and numeric order fields.",
    );
  const result = evaluateWorkspaceOrder(t),
    reason = input.overrideReason
      ? validReason(input.overrideReason)
      : undefined;
  if (
    reason &&
    (!result.checks.some((c) => c.decision === "BLOCK" && c.overridable) ||
      result.checks.some((c) => c.decision === "BLOCK" && !c.overridable))
  )
    throw new Error(
      "Only soft shield checks can be overridden. Refresh the evaluation and resolve all hard blocks first.",
    );
  const checks = result.checks.map((c) =>
    reason && c.decision === "BLOCK" && c.overridable
      ? { ...c, decision: "OVERRIDE" as const }
      : c,
  );
  const decision = checks.some((c) => c.decision === "BLOCK")
    ? "BLOCK"
    : reason
      ? "OVERRIDE"
      : "PASS";
  const row = addRiskAudit({
    category: "Lab",
    mode: "Lab",
    rule: "Ticket replay",
    subject: result.subject,
    scope: result.scope,
    decision,
    reason,
    detail: `${checks.filter((c) => c.decision === "BLOCK").length} blocking checks. Report only; no order submitted.`,
  });
  checks.forEach((c) =>
    addRiskAudit({
      category: c.shield ? "Shield" : "Lab",
      mode: "Lab",
      rule: c.label,
      subject: result.subject,
      scope: result.scope,
      decision: c.decision,
      reason: c.decision === "OVERRIDE" ? reason : undefined,
      detail: c.detail,
      ref: row.id,
    }),
  );
  return latency({
    checks,
    decision,
    risk: result.risk,
    ref: row.id,
    scope: result.scope,
  });
}
export function exportRiskAudit(input: {
  format: "CSV" | "JSON";
  ids?: string[];
}) {
  if (input.format !== "JSON" && input.format !== "CSV")
    throw new Error("Export as CSV or JSON.");
  const set = input.ids ? new Set(input.ids) : undefined,
    rows = readRiskAudit().filter((r) => !set || set.has(r.id));
  const fields: (keyof RiskAudit)[] = [
    "id",
    "at",
    "category",
    "mode",
    "rule",
    "subject",
    "scope",
    "decision",
    "detail",
    "reason",
    "ref",
  ];
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s) || /^[\r\n\t]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const json = input.format === "JSON";
  return latency({
    filename: `ostrade-risk-audit-${eatDay(Date.now())}.${json ? "json" : "csv"}`,
    type: json ? "application/json" : "text/csv",
    text: json
      ? JSON.stringify(rows, null, 2)
      : [
          fields.join(","),
          ...rows.map((r) => fields.map((k) => cell(r[k])).join(",")),
        ].join("\r\n"),
    count: rows.length,
  });
}
export const sessionDefaults = { ...defaultSession };
