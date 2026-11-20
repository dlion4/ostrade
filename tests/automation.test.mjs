import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: `export * from './src/services/automation'; export {defaultRuleDraft,sampleSignals} from './src/data/automation'; export {getAccounts,getSignalRules} from './src/services/dashboard';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const accounts = await api.getAccounts();
const base = () => api.defaultRuleDraft(accounts);

test('default draft maps a mapped Paper account and an approved Telegram trigger', () => {
  const draft = base();
  assert.equal(draft.sources[0], 'telegram');
  assert.equal(draft.accountIds[0], 'acc-paper-main');
  assert.deepEqual(draft.symbols, ['XAUUSD']);
  assert.equal(draft.status, 'draft');
});

test('preview executes mapped signals and reports concrete skip reasons', () => {
  const rows = api.previewDraft(base(), api.sampleSignals.slice(0,20), accounts, 0, false);
  const executed = rows.filter(r => r.decision === 'EXECUTE');
  assert.ok(executed.length > 0, 'default preview should have at least one executable signal');
  assert.ok(executed[0].orders.length > 0);
  assert.ok(executed[0].orders[0].mode === 'SIMULATED');
  const skipped = rows.filter(r => r.decision === 'SKIP');
  assert.ok(skipped.length > 0);
  assert.ok(skipped.every(r => r.reason.length > 8));
});

test('condition filters, side, session, confidence and spread all affect preview', () => {
  const baseDraft = base();
  const sideRows = api.previewDraft({ ...baseDraft, side: 'SELL' }, api.sampleSignals, accounts, 0, false);
  assert.ok(sideRows.some(r => /direction|side/i.test(r.reason)));
  const confidenceRows = api.previewDraft({ ...baseDraft, side: 'ANY', minConfidence: 99 }, api.sampleSignals, accounts, 0, false);
  assert.ok(confidenceRows.some(r => /confidence/i.test(r.reason)));
  const session = api.previewDraft({ ...baseDraft, session: 'london' }, api.sampleSignals, accounts, 0, false);
  assert.ok(session.some(r => /session|window/i.test(r.reason)));
});

test('a missing stop is blocked even when the rest of the rule passes', () => {
  const draft = base();
  const missingStop = [{ ...api.sampleSignals[0], id: 'ASIG-TEST-NO-SL', sl: 0, source: 'telegram', symbol: 'XAUUSD' }];
  const rows = api.previewDraft({ ...draft, requireSl: true }, missingStop, accounts, 0, false);
  assert.equal(rows[0].decision, 'SKIP');
  assert.match(rows[0].reason, /stop-loss|SL/i);
});

test('kill switch halts every decision; risk-normalized sizing uses the converted stop', () => {
  const halted = api.previewDraft(base(), api.sampleSignals, accounts, 0, true);
  assert.ok(halted.every(r => r.decision === 'SKIP'));
  assert.ok(halted.every(r => /kill switch/i.test(r.reason)));
  const rows = api.previewDraft({ ...base(), sizeMode: 'risk', sizeValue: 0.5 }, api.sampleSignals, accounts, 0, false);
  const exec = rows.find(r => r.decision === 'EXECUTE');
  assert.ok(exec);
  assert.ok(exec.orders.every(o => o.riskUsd <= 200));
});

test('saving, activating, and deleting a rule audit the operator actions', async () => {
  const draft = { ...base(), name: 'T-5 unit test rule', description: 'Regression fixture' };
  const saved = await api.saveAutomationRule(draft, false);
  assert.equal(saved.enabled, false);
  assert.equal(saved.automation?.status, 'draft');
  const audit = await api.getAutomationAudit();
  assert.ok(audit.some(e => e.ruleName === 'T-5 unit test rule' && e.decision === 'OPERATOR'));
  const activated = await api.saveAutomationRule({ ...draft, id: saved.id }, true);
  assert.equal(activated.enabled, true);
  assert.equal(activated.automation?.status, 'active');
  await api.deleteAutomationRule(activated);
  assert.ok(!(await api.getSignalRules()).some(r => r.id === activated.id));
});

test('dry runs are local, report-only, and can be saved to the rule', async () => {
  const draft = { ...base(), name: 'Dry-run fixture' };
  const saved = await api.saveAutomationRule(draft, true);
  const report = await api.runDryRun({ ...draft, id: saved.id }, 7, true);
  assert.equal(report.days, 7);
  assert.ok(report.evaluated > 0);
  assert.ok(report.executed >= 0);
  assert.deepEqual(report.rows.length <= 12, true);
  assert.ok(report.runAt);
  const audit = await api.getAutomationAudit();
  assert.ok(audit.some(e => e.decision === 'DRY RUN' && e.ruleId === saved.id));
  const refreshed = (await api.getSignalRules()).find(r => r.id === saved.id);
  assert.ok(refreshed?.automation?.lastDryRunAt);
});

test('invalid thresholds and missing mappings fail loudly, not silently', async () => {
  await assert.rejects(api.saveAutomationRule({ ...base(), name: 'Bad', dailyLossPct: 0 }, false), /daily-loss/i);
  await assert.rejects(api.saveAutomationRule({ ...base(), name: 'Bad', maxTradesHour: 0 }, false), /Trades per hour|whole number/i);
  const unmapped = api.previewDraft({ ...base(), symbols: ['R_10'], accountIds: ['acc-exness-trial'] }, api.sampleSignals, accounts, 0, false);
  assert.ok(unmapped.every(r => r.decision === 'SKIP'));
});

test('CSV export contains audit fields and escaped reasons', () => {
  const fake = [{ id:'A',timestamp:1,timestampLabel:'14 Mar',ruleId:'r1',ruleName:'Quoted "rule"',signalRef:'SIG-1',symbol:'XAUUSD',decision:'EXECUTED',reason:'Passed, with "reason"',orders:['OST-2025-00123'],latencyMs:120,accountLabels:['Paper Main'] }];
  const csv = api.auditToCsv(fake);
  assert.match(csv.split('\n')[0], /"timestamp","rule","signal","decision","reason","orders"/);
  assert.match(csv, /"Quoted ""rule"""/);
  assert.match(csv, /OST-2025-00123/);
});

test('a rule draft can be derived from an existing shared rule', () => {
  const rule = { id:'r1',name:'Rolling rule',source:'Telegram',channel:'Gold Desk VIP',conditionSummary:'IF XAUUSD w/ SL',accountId:'acc-paper-main',accountLabel:'Paper Main',firedToday:2,lastDecision:'FILLED',lastReason:'Ok',enabled:true, automation:{...base(),status:'active'} };
  const d = api.ruleToDraft(rule, accounts);
  assert.equal(d.id,'r1');assert.equal(d.status,'active');assert.ok(d.accountIds.includes('acc-paper-main'));
});
