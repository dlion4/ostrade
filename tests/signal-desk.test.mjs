import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

// Compile the actual service modules together so the tests share the real mock ledger.
const bundle = await build({
  stdin: {
    contents: `
    export * from './src/services/signalDesk';
    export {getAccounts, getPositions, getRecentRecords, getSchedulesSummary} from './src/services/dashboard';
    export {marketSymbols} from './src/data/markets';
    export {readTabularText} from './src/utils/signalParser';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const api = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const defaults = {
  accounts: ["acc-paper-main"],
  sizing: "signal",
  amount: 0.1,
  protection: "signal",
  scale: 1,
  spreadCap: 40,
};
async function stage(raw, feed) {
  const order = await api.parseSignal(raw, "auto");
  return api.saveSignal({ raw, order, feed }, "Staged");
}

test("parse canonical names, broker aliases, pips, percentages, and multiple targets", async () => {
  const o = await api.parseSignal(
    "SELL EURUSDm LIMIT 1.0850 SL 40p TP1 80p TP2 100p lot 0.20",
    "auto",
  );
  assert.deepEqual(
    [o.symbol, o.side, o.kind, o.sl, o.targets, o.size],
    ["EURUSD", "SELL", "Limit", 1.089, [1.077, 1.075], 0.2],
  );
  const g = await api.parseSignal(
    "LONG gold @ 2400 SL 0.5% TP 1% size 0.1",
    "auto",
  );
  assert.equal(g.symbol, "XAUUSD");
  assert.equal(g.sl, 2388);
  assert.equal(g.targets[0], 2424);
});
test("contract stakes are not mistaken for prices", async () => {
  const o = await api.parseSignal("R_10 RISE stake 5 USD ticks 5", "auto");
  assert.equal(
    o.entry,
    api.marketSymbols.find((s) => s.canonical === "R_10").ask,
  );
  assert.equal(o.kind, "Contract");
  assert.equal(o.size, 5);
  assert.equal(o.duration, "ticks 5");
});
test("JSON payloads detect TradingView; malformed input is not silently substituted", async () => {
  const o = await api.parseSignal(
    '{"ticker":"BTCUSDT","action":"LONG","price":64000,"sl":62500,"tp":68000,"qty":0.05}',
    "auto",
  );
  assert.equal(o.source, "webhook");
  assert.equal(o.symbol, "BTCUSDT");
  assert.equal(o.entry, 64000);
  const bad = await api.parseSignal("xyz unable to detect an order", "auto");
  assert.equal(bad.symbol, "");
  assert.equal(bad.side, "");
  assert.ok(bad.warnings.length);
});
test("confirmed paper fills and inert previews are idempotent and use the shared journal", async () => {
  const before = await api.getPositions();
  const s = await stage(
    "BUY XAUUSD @ 2385.50 SL 2378 TP 2402 size 0.10",
    "test:execute",
  );
  const options = {
    ...defaults,
    accounts: ["acc-paper-main", "acc-exness-trial"],
  };
  const [first, again] = await Promise.all([
    api.executeSignals([s.id], options, "test-key", false),
    api.executeSignals([s.id], options, "test-key", false),
  ]);
  assert.deepEqual(first, again);
  assert.deepEqual(
    first.map((r) => r.status),
    ["Filled", "Preview"],
  );
  assert.match(first[0].ref, /^OST-2025-\d{5}$/);
  assert.equal((await api.getPositions()).length, before.length + 1);
  assert.ok(
    (await api.getRecentRecords()).some(
      (r) => r.ref === first[0].ref && r.status === "Filled",
    ),
  );
});
test("scaled risk sizing respects the actual stop distance and blocks missing stops", async () => {
  const row = await stage(
    "BUY XAUUSD @ 2385.50 SL 2378.00 TP 2402 lot 0.10",
    "test:risk",
  );
  const accounts = await api.getAccounts();
  const options = {
    ...defaults,
    sizing: "risk",
    amount: 0.5,
    protection: "scaled",
    scale: 2,
  };
  const [leg] = api.buildRoutes(
    [row],
    accounts,
    api.marketSymbols,
    options,
    false,
  );
  assert.equal(leg.sl, 2370.5);
  assert.ok(
    (leg.order.entry - leg.sl) * leg.size * 100 <= leg.account.equity * 0.005,
  );
  assert.equal(leg.error, "");
  assert.match(
    api.buildRoutes(
      [row],
      accounts,
      api.marketSymbols,
      { ...options, protection: "none" },
      false,
    )[0].error,
    /protective stop/,
  );
  assert.match(
    api.buildRoutes(
      [row],
      accounts,
      api.marketSymbols,
      { ...defaults, spreadCap: 1 },
      false,
    )[0].error,
    /Spread/,
  );
});
test("quarantine overrides require a reason, get audited, and never place an order", async () => {
  const raw = "SELL EURUSD @ 1.0842 SL 1.0875 TP 1.0790 lot 0.20";
  await stage(raw, "test:duplicate");
  const dupe = await stage(raw, "test:duplicate");
  assert.equal(dupe.status, "Quarantined");
  const ev = (await api.getGuardLog()).events.find(
    (g) => g.signalId === dupe.id,
  );
  assert.equal(ev.type, "Duplicate");
  await assert.rejects(api.overrideGuard(ev.id, "no"), /8 characters/);
  const before = (await api.getPositions()).length;
  const r = await api.overrideGuard(
    ev.id,
    "Verified this is a distinct provider setup.",
  );
  assert.equal(r.status, "Staged");
  assert.equal((await api.getPositions()).length, before);
  assert.ok(
    (await api.getRecentRecords()).some((rec) =>
      rec.summary.includes("distinct provider setup"),
    ),
  );
});
test("local limit orders stay pending until their trigger is explicitly replayed", async () => {
  const row = await stage(
    "BUY EURUSD LIMIT 1.0800 SL 1.0780 TP 1.0840 lot 0.10",
    "test:pending",
  );
  const before = (await api.getPositions()).length;
  const [receipt] = await api.executeSignals(
    [row.id],
    defaults,
    "pending-key",
    false,
  );
  assert.equal(receipt.status, "Pending");
  assert.equal((await api.getPositions()).length, before);
  const fill = await api.replayPaperTrigger(receipt.id, false);
  assert.equal(fill.status, "Filled");
  assert.equal((await api.getPositions()).length, before + 1);
});
test("CSV quoting, HTML statements and ticket deduplication", async () => {
  assert.deepEqual(
    api.readTabularText('symbol,note\nXAUUSD,"gold, intraday"'),
    [
      ["symbol", "note"],
      ["XAUUSD", "gold, intraday"],
    ],
  );
  assert.deepEqual(
    api.readTabularText(
      "<table><tr><th>Symbol</th></tr><tr><td>EURUSD</td></tr></table>",
    ),
    [["Symbol"], ["EURUSD"]],
  );
  const batch = [
    {
      raw: "SELL GBPUSD @ 1.2712 SL 1.2760 TP 1.2650 size 0.10",
      ticket: "import-42",
    },
  ];
  assert.equal((await api.importSignals(batch, "csv")).added, 1);
  assert.deepEqual(await api.importSignals(batch, "csv"), {
    added: 0,
    skipped: 1,
    held: 0,
  });
});
test("source configuration validates locally, and scheduling writes a real local slot", async () => {
  await assert.rejects(api.configureSource("telegram", "no"), /channel handle/);
  assert.match(
    await api.configureSource("copyfactory", "strategy-2210"),
    /no external connection/,
  );
  const row = await stage(
    "BUY EURUSD @ 1.0842 SL 1.0810 TP 1.09 lot 0.10",
    "test:schedule",
  );
  const before = (await api.getSchedulesSummary()).usedSlots;
  const r = await api.scheduleDeskSignal(
    row.id,
    "acc-paper-main",
    "2025-03-15T10:00",
  );
  assert.equal(r.mode, "simulated");
  assert.equal((await api.getSchedulesSummary()).usedSlots, before + 1);
});
