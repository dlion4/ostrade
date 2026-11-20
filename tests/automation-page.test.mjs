import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: `export * from './src/services/automation'; export {getAccounts,getSchedulesSummary} from './src/services/dashboard';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const accounts = await api.getAccounts();
const paper = accounts.find((a) => a.environment === 'paper');

test('a saved signal can be created, fully edited, then scheduled for later', async () => {
  const saved = await api.createSavedSignal({ symbol: 'EURUSD', side: 'BUY', entry: 1.085, sl: 1.08, tp: 1.095, size: 0.5 });
  assert.ok(saved.id.startsWith('SIG-'));
  assert.equal(saved.order.size, 0.5);
  const edited = await api.editSavedSignal(saved.id, { symbol: 'EURUSD', side: 'SELL', entry: 1.086, sl: 1.091, tp: 1.078, size: 0.4 });
  assert.equal(edited.order.side, 'SELL');
  assert.equal(edited.order.size, 0.4);
  assert.equal(edited.order.targets[0], 1.078);
  assert.ok(edited.notes.some((n) => /Automation \(T-5\)/.test(n)));
  const outcome = await api.scheduleSavedSignal(saved.id, paper.id, api.deskScheduleSlot(45));
  assert.equal(outcome.mode, 'simulated');
  assert.match(outcome.ref, /OST-2025-\d{5}/);
  const summary = await api.getSchedulesSummary();
  assert.ok(summary.items.some((s) => s.symbol === 'EURUSD' && s.active));
});

test('invalid figures and unknown instruments are rejected', async () => {
  await assert.rejects(
    () => api.createSavedSignal({ symbol: 'NOPE', side: 'BUY', entry: 1, sl: 1, tp: 1, size: 1 }),
    /market universe/i,
  );
  await assert.rejects(
    () => api.createSavedSignal({ symbol: 'EURUSD', side: 'BUY', entry: -1, sl: 1, tp: 1, size: 1 }),
    /Entry price/,
  );
  await assert.rejects(
    () => api.editSavedSignal('SIG-9999', { symbol: 'EURUSD', side: 'BUY', entry: 1, sl: 1, tp: 1, size: 1 }),
    /not found/i,
  );
});

test('global trading rules validate, persist and gate scheduling', async () => {
  await assert.rejects(
    () => api.saveTradingRules({ maxLotsPerTrade: 0, maxAmountPerTrade: 500, maxAutomatedPerDay: 8, autoPauseDailyLossPct: 5 }),
    /Max lots per trade/,
  );
  await api.saveTradingRules({ maxLotsPerTrade: 0.05, maxAmountPerTrade: 500, maxAutomatedPerDay: 8, autoPauseDailyLossPct: 5 });
  const rules = await api.getTradingRules();
  assert.equal(rules.maxLotsPerTrade, 0.05);
  const big = await api.createSavedSignal({ symbol: 'EURUSD', side: 'BUY', entry: 1.085, sl: 1.08, tp: 1.095, size: 0.8 });
  await assert.rejects(
    () => api.scheduleSavedSignal(big.id, paper.id, api.deskScheduleSlot(50)),
    /caps automated trades at 0\.05 lots/,
  );
  await api.saveTradingRules({ maxLotsPerTrade: 2, maxAmountPerTrade: 10, maxAutomatedPerDay: 8, autoPauseDailyLossPct: 5 });
  await assert.rejects(
    () => api.scheduleSavedSignal(big.id, paper.id, api.deskScheduleSlot(50)),
    /per-trade amount rule/,
  );
  await api.saveTradingRules({ maxLotsPerTrade: 2, maxAmountPerTrade: 500, maxAutomatedPerDay: 1, autoPauseDailyLossPct: 5 });
  const third = await api.createSavedSignal({ symbol: 'XAUUSD', side: 'BUY', entry: 2166.8, sl: 2158, tp: 2185, size: 0.05 });
  await assert.rejects(
    () => api.scheduleSavedSignal(third.id, paper.id, api.deskScheduleSlot(50)),
    /daily automation cap/,
  );
  await api.saveTradingRules({ maxLotsPerTrade: 2, maxAmountPerTrade: 500, maxAutomatedPerDay: 8, autoPauseDailyLossPct: 5 });
});

test('master control pauses scheduled slots and stop-all flattens Paper', async () => {
  const before = (await api.getAutomationActivity()).length;
  const paused = await api.setAutomationControl('paused');
  assert.equal(paused.mode, 'simulated');
  assert.match(paused.title, /paused/i);
  const pausedSummary = await api.getSchedulesSummary();
  assert.ok(pausedSummary.items.every((s) => !s.active));
  const armed = await api.setAutomationControl('armed');
  assert.equal(armed.mode, 'simulated');
  const flat = await api.setAutomationControl('flattened');
  assert.equal(flat.mode, 'simulated');
  assert.match(flat.title, /Flattened/);
  const after = await api.getAutomationActivity();
  assert.ok(after.length > before);
  assert.ok(after.some((e) => e.kind === 'control' && /paused/i.test(e.title)));
});
