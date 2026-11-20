import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export * from './src/services/risk'; export { applyKillSwitch, getAccounts, getPositions, getSignalRules, placeDashboardOrder, reversePosition } from './src/services/dashboard'; export { getSchedulerSchedules, runScheduleNow } from './src/services/scheduler'; export { dayLocked, evaluateTicket, lockDay } from './src/services/riskEngine'; export { getTradeRecords } from './src/services/records';`,
    resolveDir: process.cwd(),
  },
  platform: "node",
  format: "esm",
  bundle: true,
  write: false,
});
const url = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`;
const scenario = (name) => import(`${url}#${name}`);
const paper = "acc-paper-main",
  exness = "acc-exness-trial",
  code = "123456",
  reason = "A confirmed simulation exercise for review.";
const ticket = {
  accountId: paper,
  symbol: "EURUSD",
  side: "BUY",
  size: 0.1,
  entry: 1.08432,
  sl: 1.08032,
  tp: 1.09132,
};
const policy = (id, value, scope = "all", unit = "USD") => ({
  id,
  value,
  scope,
  unit,
  enabled: true,
});
const request = (kind, target) => ({ kind, target, reason, code });

test("guardrail rules start with ten defaults; protected edits create stricter account scope", async () => {
  const api = await scenario("policy");
  const q = await api.getRiskConfig();
  assert.equal(q.policies.length, 10);
  await assert.rejects(
    api.saveRiskRule({ rule: policy("stake", 20, paper), code: "111111" }),
    /authenticator/,
  );
  await assert.rejects(
    api.saveRiskRule({ rule: policy("hourly", 20, paper, "fills"), code }),
    /global only/,
  );
  await assert.rejects(
    api.saveRiskRule({
      rule: { ...policy("dailyLoss", 4, "all", "% equity"), enabled: false },
      code,
    }),
    /cannot be disabled/,
  );
  await api.saveRiskRule({ rule: policy("stake", 20, paper), code });
  const blocked = await api.placeDashboardOrder({
    ...ticket,
    origin: "Manual",
  });
  assert.equal(blocked.mode, "blocked");
  assert.match(blocked.detail, /\$20\.00 cap/);
  assert.equal(
    (
      await api.placeDashboardOrder({
        ...ticket,
        accountId: exness,
        origin: "Manual",
      })
    ).mode,
    "ready",
  );
  assert.ok(
    (await api.getRiskAudit()).some(
      (r) => r.category === "Policy" && r.scope === "Paper Main",
    ),
  );
});

test("the risk lab is report-only; only price and stake outliers allow a documented manual override", async () => {
  const api = await scenario("override");
  const before = await api.getPositions();
  const offMarket = {
    ...ticket,
    channel: "Manual",
    entry: 1.12,
    sl: 1.116,
    tp: 1.128,
  };
  const block = await api.runRiskLab({ ticket: offMarket });
  assert.equal(block.decision, "BLOCK");
  assert.deepEqual(
    block.checks.filter((c) => c.decision === "BLOCK").map((c) => c.id),
    ["price"],
  );
  await assert.rejects(
    api.runRiskLab({
      ticket: { ...offMarket, size: 10 },
      overrideReason: reason,
    }),
    /hard blocks/,
  );
  assert.equal(
    (await api.runRiskLab({ ticket: offMarket, overrideReason: reason }))
      .decision,
    "OVERRIDE",
  );
  assert.deepEqual(await api.getPositions(), before);
  assert.equal(
    (
      await api.placeDashboardOrder({
        ...offMarket,
        origin: "Co-Pilot",
        overrideReason: reason,
      })
    ).mode,
    "blocked",
  );
  const filled = await api.placeDashboardOrder({
    ...offMarket,
    origin: "Manual",
    overrideReason: reason,
  });
  assert.equal(filled.mode, "simulated");
  assert.ok(
    (await api.getRiskAudit()).some(
      (r) =>
        r.category === "Shield" &&
        r.decision === "OVERRIDE" &&
        r.ref === filled.ref &&
        r.reason === reason,
    ),
  );
});

test("scoped hold and pause gate Signal, Scheduler and AI but not manual; re-arm is protected after lockdown", async () => {
  const api = await scenario("controls");
  const scheduler = (await api.getSchedulerSchedules()).find(
    (s) => s.status === "armed" && s.accountId === paper,
  );
  const liveBefore = (await api.getSignalRules())
    .filter((r) => r.enabled)
    .map((r) => r.id);
  await api.runRiskControl(request("account-pause", paper));
  assert.match(
    (await api.placeDashboardOrder({ ...ticket, origin: "Signal" })).detail,
    /Account automation paused/,
  );
  assert.equal((await api.runScheduleNow(scheduler.id)).ok, false);
  await api.runRiskControl(request("account-resume", paper));
  await api.runRiskControl(request("rule-pause", liveBefore[0]));
  assert.equal(
    (await api.getSignalRules()).find((r) => r.id === liveBefore[0]).enabled,
    false,
  );
  await api.runRiskControl(request("rule-resume", liveBefore[0]));
  await api.runRiskControl(request("pause"));
  assert.match(
    (await api.placeDashboardOrder({ ...ticket, origin: "Co-Pilot" })).detail,
    /Workspace automation paused/,
  );
  assert.equal(
    (await api.placeDashboardOrder({ ...ticket, origin: "Manual" })).mode,
    "simulated",
  );
  await api.runRiskControl(request("lockdown"));
  assert.equal((await api.getRiskOverview()).state, "lockdown");
  assert.match(
    (await api.placeDashboardOrder({ ...ticket, size: 0.11, origin: "Manual" }))
      .detail,
    /Workspace lockdown/,
  );
  assert.equal((await api.applyKillSwitch("armed")).mode, "blocked");
  await assert.rejects(
    api.runRiskControl({ ...request("rearm"), code: "123450" }),
    /authenticator/,
  );
  await api.runRiskControl(request("rearm"));
  assert.equal((await api.getRiskOverview()).state, "armed");
  assert.deepEqual(
    (await api.getSignalRules()).filter((r) => r.enabled).map((r) => r.id),
    liveBefore,
  );
});

test("close-all matches canonical Paper journal refs; retries never close broker positions or new trades", async () => {
  const api = await scenario("flatten");
  const [before, journal] = await Promise.all([
    api.getPositions(),
    api.getTradeRecords(),
  ]);
  const external = before.filter((p) => p.broker !== "paper");
  const paperRefs = before
    .filter((p) => p.broker === "paper")
    .map((p) => p.ref);
  const impact = await api.runRiskControl(request("flatten"));
  assert.match(
    impact.message,
    new RegExp(`${paperRefs.length} Paper closures booked`),
  );
  assert.deepEqual(await api.getPositions(), external);
  const newJournal = (await api.getTradeRecords()).filter(
    (r) => !journal.some((o) => o.id === r.id),
  );
  assert.deepEqual(newJournal.map((r) => r.ref).sort(), paperRefs.sort());
  const receipts = await api.getRiskReceipts();
  assert.equal(
    receipts.reduce((n, r) => n + r.closed, 0),
    paperRefs.length,
  );
  const offline = receipts.find(
    (r) => r.status === "Offline" && r.attempted > 0,
  );
  assert.match(
    (await api.retryRiskReceipt({ id: offline.id, code, reason })).message,
    /stays offline/,
  );
  assert.deepEqual(await api.getPositions(), external);
});

test("session stop is scoped by EAT day and strict policy applies to declared carry only", async () => {
  const api = await scenario("session");
  const dayEnd = Date.parse("2031-05-01T20:59:59Z");
  api.lockDay(paper, dayEnd);
  assert.equal(api.dayLocked(paper, dayEnd), true);
  assert.equal(api.dayLocked(paper, dayEnd + 1000), false);
  await api.saveRiskRule({ rule: policy("hold", 2, "all", "policy"), code });
  assert.equal(
    (
      await api.runRiskLab({
        ticket: { ...ticket, channel: "Manual", carry: "Weekend" },
      })
    ).decision,
    "BLOCK",
  );
  assert.equal(
    (
      await api.runRiskLab({
        ticket: { ...ticket, channel: "Manual", carry: "Intraday" },
      })
    ).decision,
    "PASS",
  );
  await api.stopRiskSession({ scope: paper, code, reason });
  assert.match(
    (await api.placeDashboardOrder({ ...ticket, origin: "Manual" })).detail,
    /session stopped/,
  );
  assert.equal(
    (
      await api.placeDashboardOrder({
        ...ticket,
        accountId: exness,
        origin: "Manual",
      })
    ).mode,
    "ready",
  );
});

test("duplicate and hourly ceilings are hard; a breached daily loss cannot be overridden", async () => {
  const api = await scenario("hard");
  const fill = await api.placeDashboardOrder({ ...ticket, origin: "Manual" });
  assert.equal(fill.mode, "simulated");
  assert.match(
    (
      await api.placeDashboardOrder({
        ...ticket,
        origin: "Manual",
        overrideReason: reason,
      })
    ).detail,
    /Matching fill/,
  );
  await api.saveRiskRule({ rule: policy("hourly", 1, "all", "fills"), code });
  assert.match(
    (await api.placeDashboardOrder({ ...ticket, size: 0.12, origin: "Manual" }))
      .detail,
    /last hour/,
  );
  const accounts = (await api.getAccounts()).map((a) => ({
    ...a,
    realizedToday: -a.equity * 0.1,
  }));
  const checks = api.evaluateTicket(
    { ...ticket, channel: "Manual" },
    { accounts, positions: [], records: [], state: "armed" },
  );
  assert.ok(checks.breaker);
  assert.ok(
    checks.checks.some(
      (c) => c.id === "circuit" && c.decision === "BLOCK" && !c.overridable,
    ),
  );
});

test("shield evidence feeds Co-Pilot; export filters, redacts and returns immutable snapshots", async () => {
  const api = await scenario("audit");
  const cfg = await api.getRiskConfig();
  await api.saveRiskShields({
    settings: { ...cfg.shields, perMinute: 60, signalPerMinute: 1 },
    code,
  });
  await api.placeDashboardOrder({ ...ticket, origin: "Signal" });
  const storm = await api.placeDashboardOrder({
    ...ticket,
    size: 0.12,
    origin: "Signal",
  });
  assert.match(storm.detail, /prior signal submissions/);
  assert.ok(
    (await api.getRiskAnomalyEvidence()).some(
      (r) => r.rule === "Signal storm quarantine",
    ),
  );
  const saved = (await api.getRiskAudit()).find(
    (r) => r.rule === "Signal storm quarantine" && r.decision === "BLOCK",
  );
  const result = JSON.parse(
    (await api.exportRiskAudit({ format: "JSON", ids: [saved.id] })).text,
  );
  assert.deepEqual(result, [
    Object.fromEntries(
      Object.entries(saved).filter(([, v]) => v !== undefined),
    ),
  ]);
  const proof = await api.runRiskControl({
    kind: "pause",
    code,
    reason: "Testing review; password=sample-secret 123456",
  });
  const csv = (await api.exportRiskAudit({ format: "CSV" })).text;
  assert.ok(csv.includes(proof.ref));
  assert.ok(!csv.includes("123456") && !csv.includes("sample-secret"));
  saved.decision = "PASS";
  assert.equal(
    (await api.getRiskAudit()).find((r) => r.id === saved.id).decision,
    "BLOCK",
  );
});

test("Scheduler Run Now records a real guarded Paper fill and never dispatches an external order", async () => {
  const api = await scenario("scheduler");
  const initial = await api.getPositions();
  const schedules = await api.getSchedulerSchedules();
  const local = schedules.find(
    (s) => s.accountId === paper && s.symbol === "R_10" && s.status === "armed",
  );
  const result = await api.runScheduleNow(local.id);
  assert.equal(result.ok, true);
  assert.match(result.message, /filled on Paper Main and logged/);
  const current = await api.getPositions();
  assert.equal(current.length, initial.length + 1);
  assert.ok(
    current.some((p) => p.sourceRef === local.ref && p.source === "Scheduled"),
  );
  const broker = schedules.find(
    (s) =>
      s.accountId === exness && s.symbol === "EURUSD" && s.status === "armed",
  );
  const preview = await api.runScheduleNow(broker.id);
  assert.equal(preview.ok, true);
  assert.match(preview.message, /dispatch is inert/);
  assert.deepEqual(await api.getPositions(), current);
  const audit = await api.getRiskAudit();
  assert.ok(
    audit.some(
      (row) => row.subject.includes(local.ref) && row.decision === "PASS",
    ),
  );
});
