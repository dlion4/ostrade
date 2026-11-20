import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `export * from './src/services/settings';export {getAccounts,getBrokerDefaults,placeDashboardOrder} from './src/services/dashboard';export {getTelegramPanel,startTelegramPairing,confirmTelegramPairing} from './src/services/notifications';export {getAccountSymbolOverrides} from './src/services/symbolMappings';export {getDeskSetup} from './src/services/signalDesk';`,
    resolveDir: process.cwd(),
  },
  platform: "node",
  format: "esm",
  bundle: true,
  write: false,
});
const bundle = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`;
const isolate = (id) => import(`${bundle}#${id}`);

test("profile contact changes require a one-use demo OTP; passwords remain separate from sign-in", async () => {
  const api = await isolate("profile");
  const before = await api.getSettingsSecurity();
  const r = await api.saveSettingsProfile({
    ...before.profile,
    email: "trader@example.invalid",
  });
  assert.ok(r.challenge);
  await assert.rejects(
    api.confirmSettingsContact({ key: r.challenge, code: "111111" }),
    /demo OTP/,
  );
  assert.equal(
    (await api.getSettingsSecurity()).profile.email,
    before.profile.email,
  );
  await api.confirmSettingsContact({ key: r.challenge, code: api.demoOtp });
  await assert.rejects(
    api.confirmSettingsContact({ key: r.challenge, code: api.demoOtp }),
    /challenge/,
  );
  assert.equal(
    (await api.getSettingsSecurity()).profile.email,
    "trader@example.invalid",
  );
  const next = "long-demo-password";
  await assert.rejects(
    api.changeSettingsPassword({ current: "bad", next, confirm: next }),
    /did not match/,
  );
  assert.match(
    (
      await api.changeSettingsPassword({
        current: api.demoPassword,
        next,
        confirm: next,
      })
    ).message,
    /sign-in credentials were not changed/,
  );
  assert.ok(!JSON.stringify(await api.getSettingsSecurity()).includes(next));
});

test("2FA enrollment and recovery require demo authorization; revoke-all always keeps the current browser", async () => {
  const api = await isolate("auth");
  await assert.rejects(api.startSettingsEnrollment("000000"), /123456/);
  const enrollment = await api.startSettingsEnrollment(api.demoTotp);
  await api.confirmSettingsEnrollment({
    key: enrollment.key,
    code: api.demoTotp,
  });
  await assert.rejects(
    api.confirmSettingsEnrollment({ key: enrollment.key, code: api.demoTotp }),
    /new demo/,
  );
  const { codes } = await api.regenerateSettingsRecovery(api.demoTotp);
  assert.equal(new Set(codes).size, 10);
  await api.revokeSettingsSessions({ id: "all", code: api.demoTotp });
  const security = await api.getSettingsSecurity();
  assert.equal(security.sessions.length, 10);
  assert.deepEqual(
    security.sessions.filter((s) => s.state === "Active").map((s) => s.current),
    [true],
  );
  assert.ok(!JSON.stringify(security).includes(codes[0]));
});

test("inbound rotation is gated and the Signal Desk sees only a masked link; outbound generates genuine local HMAC proof", async () => {
  const api = await isolate("webhook");
  const source = "TradingView";
  const before = await api.getSettingsWebhooks(),
    masked = before.inbound.find((x) => x.source === source);
  assert.ok(!("secret" in masked));
  assert.ok(
    (await api.getDeskSetup()).sources.some((s) => s.value === masked.url),
  );
  await assert.rejects(
    api.manageInbound({ source, action: "reveal", code: "000000" }),
    /123456/,
  );
  const first = await api.manageInbound({
      source,
      action: "reveal",
      code: api.demoTotp,
    }),
    second = await api.manageInbound({
      source,
      action: "rotate",
      code: api.demoTotp,
    });
  assert.notEqual(first.secret, second.secret);
  assert.ok(
    !JSON.stringify(await api.getSettingsWebhooks()).includes(second.secret),
  );
  const event = "order.filled",
    secret = "demo_webhook_secret_sample";
  await assert.rejects(
    api.saveOutbound({
      url: "http://example.invalid",
      secret,
      events: [event],
    }),
    /HTTPS/,
  );
  await api.saveOutbound({
    url: "https://example.invalid/callback",
    secret,
    events: [event],
  });
  await assert.rejects(api.testOutbound("guard.blocked"), /enable this event/);
  const r = await api.testOutbound(event);
  assert.equal(
    r.signature,
    `sha256=${createHmac("sha256", secret).update(r.payload).digest("hex")}`,
  );
  assert.match(r.proof.status, /not sent/);
  assert.equal(r.proof.latencyMs, null);
  assert.ok(!JSON.stringify(await api.getSettingsWebhooks()).includes(secret));
});

test("scoped tokens are one-time demo values and refresh or revoke without returning existing secret material", async () => {
  const api = await isolate("tokens"),
    code = api.demoTotp;
  await assert.rejects(
    api.manageSettingsToken({
      action: "create",
      code,
      label: "Reporting",
      scopes: ["bad"],
    }),
    /scope/,
  );
  const r = await api.manageSettingsToken({
    action: "create",
    code,
    label: "Reporting",
    scopes: ["orders:read", "orders:read"],
  });
  const [token] = await api.getSettingsTokens();
  assert.deepEqual(token.scopes, ["orders:read"]);
  assert.ok(!JSON.stringify(token).includes(r.secret));
  const rotated = await api.manageSettingsToken({
    action: "rotate",
    code,
    id: token.id,
  });
  assert.notEqual(rotated.secret, r.secret);
  await api.manageSettingsToken({ action: "revoke", code, id: token.id });
  await assert.rejects(
    api.manageSettingsToken({ action: "rotate", code, id: token.id }),
    /active demo token/,
  );
});

test("broker defaults and suffixes use shared state and a hidden adapter cannot take orders", async () => {
  const api = await isolate("brokers");
  const before = await api.getSettingsBrokers();
  assert.ok(before.accounts.length >= 10);
  const exness = before.accounts.find((a) => a.id === "acc-exness-trial");
  await api.saveBrokerDefaults({
    ...before.preferences,
    manual: exness.id,
    tif: "DAY",
  });
  assert.equal((await api.getBrokerDefaults()).tif, "DAY");
  await api.saveSettingsMapping({
    accountId: exness.id,
    canonical: "EURUSD",
    suffix: ".raw",
  });
  assert.ok(
    (await api.getAccountSymbolOverrides()).some(
      (r) => r.accountId === exness.id && r.suffix === ".raw",
    ),
  );
  await api.setBrokerVisibility({ broker: "exness", enabled: false });
  assert.ok(!(await api.getAccounts()).some((a) => a.broker === "exness"));
  assert.equal((await api.getBrokerDefaults()).manual, "");
  const blocked = await api.placeDashboardOrder({
    accountId: exness.id,
    symbol: "EURUSD",
    side: "BUY",
    size: 0.1,
    entry: 1.08432,
    sl: 1.08032,
    tp: 1.09132,
    origin: "Manual",
  });
  assert.equal(blocked.mode, "blocked");
  await assert.rejects(
    api.setBrokerVisibility({ broker: "paper", enabled: false }),
    /remain available/,
  );
  await api.setBrokerVisibility({ broker: "exness", enabled: true });
  assert.ok((await api.getAccounts()).some((a) => a.id === exness.id));
});

test("ZIP reads canonical demo datasets; consent hashes are present; deletion never removes local data", async () => {
  const api = await isolate("privacy");
  const a = await api.getSettingsPrivacy();
  assert.equal(a.consent.length, 10);
  assert.ok(a.consent.every((r) => /^[0-9a-f]{64}$/.test(r.hash)));
  await assert.rejects(
    api.saveRetention({ ...a.retention, ledger: 6 }),
    /7–20/,
  );
  const job = await api.queueSettingsExport();
  let ready;
  for (let i = 0; i < 4 && !ready; i++)
    ready = (await api.getSettingsPrivacy()).jobs.find(
      (r) => r.id === job.id && r.status === "Ready",
    );
  assert.ok(ready);
  const file = await api.downloadSettingsExport(job.id);
  const bytes = Buffer.from(await file.file.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x04034b50);
  assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
  assert.equal(bytes.readUInt16LE(bytes.length - 12), 8);
  for (const name of [
    "profile.json",
    "orders.json",
    "positions.json",
    "signals.json",
    "ledger.json",
    "audit.json",
  ])
    assert.ok(bytes.includes(name));
  assert.ok(!bytes.includes(api.demoPassword));
  await assert.rejects(
    api.rehearseSettingsDeletion({ phrase: "DELETE", code: api.demoTotp }),
    /exactly/,
  );
  await api.rehearseSettingsDeletion({
    phrase: "DELETE WORKSPACE",
    code: api.demoTotp,
  });
  const after = await api.getSettingsPrivacy();
  assert.equal(after.deletion.state, "Rehearsed");
  assert.deepEqual(after.consent, a.consent);
  assert.equal(after.jobs[0].status, "Ready");
});

test("preview profiles stay environment-scoped, credentials are never returned, and Telegram reset shares the Notifications store", async () => {
  const api = await isolate("features");
  const before = await api.getSettingsFeatures();
  await api.saveSettingsFlags({
    env: "Live",
    flags: { ...before.flags.Live, enable_auto_mitigate: true },
    limits: { ...before.limits.Live, MAX_SCHEDULES: 25 },
  });
  await assert.rejects(
    api.configureSettingsIntegration({
      name: "Resend",
      values: ["real_sender", "real_key"],
    }),
    /demo_/,
  );
  await api.configureSettingsIntegration({
    name: "Resend",
    values: ["demo_sender_test", "demo_key_test"],
  });
  const after = await api.getSettingsFeatures();
  assert.equal(after.flags.Live.enable_auto_mitigate, true);
  assert.equal(after.flags.Paper.enable_auto_mitigate, false);
  assert.ok(!JSON.stringify(after).includes("demo_key_test"));
  assert.match(
    (await api.testSettingsIntegration("Resend")).message,
    /No external request/,
  );
  const pairing = await api.startTelegramPairing();
  await api.confirmTelegramPairing({
    code: pairing.code,
    label: "Demo test chat",
    scope: "All",
  });
  const pending = await api.startTelegramPairing();
  await api.resetSettingsTelegram(api.demoTotp);
  assert.equal((await api.getTelegramPanel()).chats.length, 0);
  await assert.rejects(
    api.confirmTelegramPairing({
      code: pending.code,
      label: "Demo after reset",
      scope: "All",
    }),
    /current demo/,
  );
});
