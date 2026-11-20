import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `export * from './src/services/tradeTicket'; export { getPositions, getRecentRecords } from './src/services/dashboard'; export { runRiskControl } from './src/services/risk';`,
    resolveDir: process.cwd(),
  },
  platform: "node",
  format: "esm",
  bundle: true,
  write: false,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`;
const isolate = (name) => import(`${moduleUrl}#${name}`);
const paperLeg = {
  accountId: "acc-paper-main",
  size: 0.1,
  entry: 1.08432,
  sl: 1.08032,
  tp: 1.09132,
};
const brokerLeg = { ...paperLeg, accountId: "acc-exness-trial" };
const order = {
  canonical: "EURUSD",
  orderType: "Market",
  side: "BUY",
  timeInForce: "GTC",
  comment: "",
  carry: "Intraday",
};

test("trade ticket settles Paper and broker legs separately and books only Paper", async () => {
  const api = await isolate("settle");
  const progress = [];
  const before = await api.getPositions();
  const pending = api.submitFanoutTicket(
    { ...order, legs: [paperLeg, brokerLeg] },
    (result) => progress.push(result),
  );
  assert.deepEqual(progress, []);
  const final = await pending;
  assert.equal(final.filledCount, 1);
  assert.equal(final.readyCount, 1);
  assert.equal(final.blockedCount, 0);
  assert.deepEqual(progress, final.receipts);
  const [fill, preview] = progress;
  assert.equal(fill.status, "filled");
  assert.match(fill.ticketId, /^OST-2025-\d{5}$/);
  assert.equal(preview.status, "ready");
  assert.equal(preview.ticketId, "PREVIEW-ONLY");
  const positions = await api.getPositions();
  assert.equal(positions.length, before.length + 1);
  assert.ok(
    positions.some(
      (row) =>
        row.ref === fill.ticketId && row.accountId === paperLeg.accountId,
    ),
  );
  const journal = await api.getRecentRecords(paperLeg.accountId);
  assert.ok(
    journal.some((row) => row.ref === fill.ticketId && row.status === "Filled"),
  );
  assert.equal((await api.getRecentTickets())[0].ref, fill.ticketId);
});

test("a hard guard surfaces a blocked status without opening a position", async () => {
  const api = await isolate("locked");
  const before = await api.getPositions();
  await api.runRiskControl({
    kind: "lockdown",
    reason: "Test the protected workspace lockdown",
    code: "123456",
  });
  const progress = [];
  const final = await api.submitFanoutTicket(
    { ...order, legs: [paperLeg] },
    (result) => progress.push(result),
  );
  assert.equal(final.blockedCount, 1);
  assert.equal(progress[0].status, "blocked");
  assert.equal(final.filledCount, 0);
  assert.deepEqual(await api.getPositions(), before);
});

test("empty, duplicate and unavailable account selections cannot accidentally submit a partial order", async () => {
  const api = await isolate("selection");
  const before = await api.getPositions();
  const noProgress = () =>
    assert.fail("No leg should run with an invalid selection");
  await assert.rejects(
    api.submitFanoutTicket({ ...order, legs: [] }, noProgress),
    /at least one/,
  );
  await assert.rejects(
    api.submitFanoutTicket(
      { ...order, legs: [paperLeg, paperLeg] },
      noProgress,
    ),
    /only once/,
  );
  await assert.rejects(
    api.submitFanoutTicket(
      { ...order, legs: [paperLeg, { ...brokerLeg, accountId: "missing" }] },
      noProgress,
    ),
    /no longer available/,
  );
  assert.deepEqual(await api.getPositions(), before);
});
