import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `export * from './src/services/notifications'; export { publishNotice, isQuietAt, eatDate, dailyRouteUsage, reviewFallback } from './src/services/notificationStore'; export { placeDashboardOrder, getPositions, getLocalKillSwitch, acknowledgeAlert, getAlerts, applyKillSwitch } from './src/services/dashboard'; export { getRiskAudit } from './src/services/risk'; export { getPriceAlerts } from './src/services/markets'; export { getRecordExports } from './src/services/records'; export { requestDeposit } from './src/services/deposits';`,
    resolveDir: process.cwd(),
  },
  platform: "node",
  format: "esm",
  bundle: true,
  write: false,
});
const bundle = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`;
const isolate = (id) => import(`${bundle}#${id}`);
const order = {
  accountId: "acc-paper-main",
  symbol: "EURUSD",
  side: "BUY",
  size: 0.1,
  entry: 1.08432,
  sl: 1.08032,
  tp: 1.09132,
  origin: "Manual",
};

test("notification inbox filters and read state share the existing cockpit alerts; deleting never erases proof", async () => {
  const api = await isolate("inbox");
  const notices = await api.getNotifications();
  assert.ok(notices.length >= 20);
  const a = notices.find((n) => n.id === "alt-01");
  assert.ok(a && !a.readAt);
  assert.ok(
    (
      await api.getNotifications({
        channel: "Push",
        state: "Unread",
        event: "broker.disconnected",
        search: "MetaApi",
      })
    ).some((n) => n.id === a.id),
  );
  assert.deepEqual(await api.getNotifications({ to: "2000-01-01" }), []);
  await api.acknowledgeAlert(a.id);
  assert.ok(
    (await api.getNotifications({ state: "Read" })).some((n) => n.id === a.id),
  );
  await api.updateNotifications({ action: "unread", ids: [a.id] });
  assert.equal(
    (await api.getAlerts()).find((n) => n.id === a.id).acknowledged,
    false,
  );
  await api.updateNotifications({ action: "read-all" });
  assert.equal((await api.getNotificationOverview()).unread, 0);
  await api.updateNotifications({ action: "clear-read" });
  assert.deepEqual(await api.getNotifications(), []);
  assert.ok(
    (await api.getDeliveryLog()).some((row) => row.notificationId === a.id),
  );
});

test("matrix keeps critical visibility locked, supports mute/restore, and changes only future routing choices", async () => {
  const api = await isolate("matrix");
  const matrix = await api.getNotificationMatrix();
  assert.ok(matrix.length >= 18);
  assert.deepEqual(
    matrix.find((c) => c.id === "killswitch.engaged").channels,
    api.channels,
  );
  await assert.rejects(
    api.updateNotificationRoute({
      event: "killswitch.engaged",
      channel: "Email",
      enabled: false,
    }),
    /locked/,
  );
  await assert.rejects(
    api.updateMutedClass({ event: "margin.call", muted: true }),
    /cannot be muted/,
  );
  await api.updateMutedClass({ event: "order.filled", muted: true });
  assert.equal(
    api.publishNotice({
      event: "order.filled",
      title: "Muted sample",
      body: "Local only",
    }),
    undefined,
  );
  await api.updateMutedClass({ event: "order.filled", muted: false });
  await api.updateNotificationRoute({
    event: "order.filled",
    channel: "SMS",
    enabled: true,
  });
  const n = api.publishNotice({
    id: "one-order",
    event: "order.filled",
    title: "Latest order",
    body: "Local only",
  });
  assert.equal(
    n.deliveries.find((p) => p.channel === "SMS").status,
    "Offline preview",
  );
  assert.equal(
    api.publishNotice({
      id: "one-order",
      event: "order.filled",
      title: "Retry",
      body: "Local only",
    }).id,
    n.id,
  );
  assert.equal(
    (await api.getNotifications({ event: "order.filled" })).filter(
      (r) => r.source === "Local",
    ).length,
    1,
  );
});

test("overnight EAT quiet hours suppress regular external routes but never hide critical inbox notices", async () => {
  const api = await isolate("quiet");
  const policy = { enabled: true, start: "22:00", end: "07:00" };
  assert.equal(api.isQuietAt(Date.parse("2031-05-02T20:00:00Z"), policy), true);
  assert.equal(api.isQuietAt(Date.parse("2031-05-03T03:59:00Z"), policy), true);
  assert.equal(
    api.isQuietAt(Date.parse("2031-05-03T04:00:00Z"), policy),
    false,
  );
  await assert.rejects(
    api.saveQuietHours({ enabled: true, start: "09:00", end: "09:00" }),
    /different/,
  );
  await api.saveQuietHours(policy);
  const at = Date.parse("2031-05-02T20:00:00Z");
  const regular = api.publishNotice(
    { event: "order.filled", title: "Quiet fill", body: "Local only" },
    at,
  );
  assert.equal(
    regular.deliveries.find((d) => d.channel === "Push").status,
    "Quiet hours",
  );
  const critical = api.publishNotice(
    { event: "killswitch.engaged", title: "Emergency", body: "Local only" },
    at,
  );
  assert.equal(
    critical.deliveries.find((d) => d.channel === "In-app").status,
    "In inbox",
  );
  assert.equal(
    critical.deliveries.find((d) => d.channel === "Push").status,
    "Offline preview",
  );
});

test("SMS dedupes native events, enforces illustrative day budgets, and fallback rehearses once", async () => {
  const api = await isolate("sms");
  const settings = await api.getDeliveryPreferences();
  await api.saveDeliveryPolicy({
    ...settings.delivery,
    smsBudget: 1.5,
    limits: { ...settings.delivery.limits, SMS: 3 },
  });
  assert.equal(
    (await api.testNotificationChannel({ channel: "SMS", nativeSms: true }))
      .status,
    "Duplicate SMS",
  );
  // Use a synthetic instant to make the fallback threshold independent of test runtime.
  const at = Date.parse("2031-06-25T12:00:00Z");
  const first = api.publishNotice(
    {
      event: "broker.disconnected",
      title: "Fallback candidate",
      body: "Local only",
    },
    at - 11 * 60_000,
  );
  const tooNew = api.publishNotice(
    { event: "broker.disconnected", title: "Too new", body: "Local only" },
    at - 9 * 60_000,
  );
  const res = api.reviewFallback(at);
  assert.ok(res.previews >= 1);
  assert.equal(api.dailyRouteUsage(at).smsSpend, 1.5);
  const log = await api.getDeliveryLog();
  assert.ok(
    log.some((r) => r.notificationId === first.id && r.mode === "Fallback"),
  );
  assert.ok(
    !log.some((r) => r.notificationId === tooNew.id && r.mode === "Fallback"),
  );
  api.reviewFallback(at);
  assert.equal(
    (await api.getDeliveryLog()).filter(
      (r) => r.notificationId === first.id && r.mode === "Fallback",
    ).length,
    1,
  );
  const future = api.publishNotice(
    { event: "margin.call", title: "Cap scenario", body: "Local only" },
    at,
  );
  assert.equal(
    future.deliveries.find((d) => d.channel === "SMS").status,
    "Rate capped",
  );
  const file = await api.exportDeliveryProof([future.deliveries[0].id]);
  assert.equal(JSON.parse(file.text).length, 1);
});

test("shared price alert rules fire from deterministic snapshots and completed or snoozed rules do not repeat", async () => {
  const api = await isolate("rules");
  const initial = await api.getAlertRules();
  assert.ok(initial.length >= 10);
  const base = {
    kind: "PRICE",
    target: "EURUSD",
    direction: "above",
    threshold: 1.08,
    repeat: false,
    channels: ["SMS"],
  };
  await assert.rejects(
    api.createAlertRule({ ...base, threshold: -1 }),
    /positive/,
  );
  const r = await api.createAlertRule(base);
  assert.ok((await api.getPriceAlerts()).some((p) => p.id === r.id));
  const snoozed = await api.createAlertRule({
    ...base,
    kind: "PNL",
    target: "acc-paper-main",
    threshold: 20,
    repeat: true,
  });
  await api.changeAlertRule({ id: snoozed.id, action: "snooze", minutes: 60 });
  const first = await api.checkAlertRules();
  assert.equal(first.output.find((n) => n.id === r.id).outcome, "Triggered");
  assert.ok(!first.output.some((n) => n.id === snoozed.id));
  assert.equal(
    (await api.getPriceAlerts()).find((p) => p.id === r.id).status,
    "triggered",
  );
  assert.equal(
    (await api.getAlertRules()).find((p) => p.id === r.id).firedCount,
    1,
  );
  assert.equal(
    (await api.checkAlertRules()).output.some((n) => n.id === r.id),
    false,
  );
  const inbox = await api.getNotifications({ search: r.id });
  assert.equal(inbox.length, 1);
  assert.ok(inbox[0].deliveries.some((p) => p.channel === "SMS"));
});

test("Telegram rehearsal uses one-use demo pairing, per-chat scope, and protected canonical Risk actions", async () => {
  const api = await isolate("telegram");
  const pair = await api.startTelegramPairing();
  await assert.rejects(
    api.confirmTelegramPairing({
      code: "000000",
      label: "Operations",
      scope: "Critical only",
    }),
    /current demo/,
  );
  const chat = await api.confirmTelegramPairing({
    code: pair.code,
    label: "Operations",
    scope: "Critical only",
  });
  await assert.rejects(
    api.confirmTelegramPairing({
      code: pair.code,
      label: "Retry",
      scope: "All",
    }),
    /current demo/,
  );
  await api.updateNotificationRoute({
    event: "order.filled",
    channel: "Telegram",
    enabled: true,
  });
  assert.ok(
    !api
      .publishNotice({
        event: "order.filled",
        title: "Ordinary",
        body: "Local only",
      })
      .deliveries.some((d) => d.target === chat.masked),
  );
  const review = await api.previewTelegramCommand("/pause");
  assert.equal(api.getLocalKillSwitch(), "armed");
  const action = {
    key: review.review.key,
    confirm: true,
    reason: "Rehearsing a safe automation pause.",
  };
  await assert.rejects(
    api.confirmTelegramCommand({ ...action, code: "000000" }),
    /123456/,
  );
  await api.confirmTelegramCommand({ ...action, code: "123456" });
  assert.equal(api.getLocalKillSwitch(), "paused");
  await assert.rejects(
    api.confirmTelegramCommand({ ...action, code: "123456" }),
    /current command/,
  );
  assert.ok(
    (await api.getRiskAudit()).some((r) =>
      r.subject.includes("Telegram rehearsal"),
    ),
  );
  const notice = (
    await api.getNotifications({ event: "killswitch.engaged" })
  ).find((n) => n.source === "Local");
  assert.ok(
    notice.deliveries.some(
      (d) =>
        d.channel === "Telegram" &&
        d.target === chat.masked &&
        d.status === "Offline preview",
    ),
  );
  const alert = await api.previewTelegramCommand("/alert EURUSD 1.1");
  const result = await api.confirmTelegramCommand({
    key: alert.review.key,
    confirm: true,
  });
  assert.ok((await api.getPriceAlerts()).some((p) => p.id === result.ref));
});

test("digest composes selected live local sections and queues the existing Records PDF without external delivery", async () => {
  const api = await isolate("digest");
  await assert.rejects(api.queueDigestReport(), /Enable the weekly/);
  await api.saveDigestSettings({
    daily: true,
    time: "08:15",
    contents: ["P&L", "Open positions"],
    weekly: true,
    attachPdf: true,
    monthly: true,
  });
  const preview = await api.getDigestPreview();
  assert.equal(preview.time, "08:15");
  assert.deepEqual(
    preview.sections.map((s) => s.label),
    ["P&L", "Open positions"],
  );
  const queued = await api.queueDigestReport();
  const job = (await api.getRecordExports()).find((j) => j.id === queued.jobId);
  assert.equal(job.format, "PDF");
  assert.equal(job.email, false);
  assert.equal(job.sms, false);
  assert.equal(
    (await api.getNotifications()).some((n) => n.source === "Local"),
    false,
  );
});

test("canonical Paper fills and emergency controls publish local notices; broker previews do not fabricate fills", async () => {
  const api = await isolate("events");
  const result = await api.placeDashboardOrder(order);
  assert.equal(result.mode, "simulated");
  assert.ok(
    (await api.getNotifications({ event: "order.filled" })).some(
      (n) => n.ref === result.ref && n.source === "Local",
    ),
  );
  const before = await api.getPositions();
  const ext = await api.placeDashboardOrder({
    ...order,
    accountId: "acc-exness-trial",
  });
  assert.equal(ext.mode, "ready");
  assert.deepEqual(await api.getPositions(), before);
  assert.equal(
    (await api.getNotifications({ event: "order.filled" })).filter(
      (n) => n.source === "Local",
    ).length,
    1,
  );
  const emergency = await api.applyKillSwitch("paused");
  assert.ok(
    (await api.getNotifications({ event: "killswitch.engaged" })).some(
      (n) => n.ref === emergency.ref,
    ),
  );
  const dep = await api.requestDeposit({
    accountId: "acc-paper-main",
    rail: "paper",
    amount: 30,
    idempotencyKey: "nt-dep-1",
  });
  assert.ok(
    (await api.getNotifications({ event: "deposit.confirmed" })).some(
      (n) => n.ref === dep.ref && n.source === "Local",
    ),
  );
});
