import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundled = await build({ stdin: { contents: `export * from './src/services/accounts'; export * from './src/services/dashboard'; export { resolveSymbol } from './src/services/markets';`, resolveDir: process.cwd() }, platform: 'node', format: 'esm', bundle: true, write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const setup = { broker: 'exness', label: 'Sample Exness', environment: 'live', accountId: '148228891', server: 'Exness-MT5Real2', region: 'london', permissions: ['Read account', 'Place orders'] };

test('external preflight never verifies a balance, requires demo 2FA for live, and does not create a broker account', async () => {
  const before = await api.getAccounts();
  await assert.rejects(api.testBrokerSetup({ ...setup, region: 'anywhere' }), /region/);
  await assert.rejects(api.testBrokerSetup({ ...setup, permissions: ['Read account', 'Withdraw funds'] }), /scopes/);
  const valid = await api.testBrokerSetup(setup);
  assert.equal(valid.balance, null);
  await assert.rejects(api.stageBrokerSetup(setup), /2FA/);
  const staged = await api.stageBrokerSetup({ ...setup, mockTwoFactor: true });
  assert.equal(staged.mode, 'ready');
  assert.match(staged.message, /backend is connected/);
  assert.deepEqual(await api.getAccounts(), before);
  assert.ok((await api.getAccountAudit()).some(e => e.broker === 'exness' && e.event === 'Setup preview' && e.outcome === 'Ready'));
});

test('new Paper account shares the dashboard store and can simulate independently', async () => {
  await assert.rejects(api.addPaperWorkspace({ label: 'Paper Main', startingBalance: 500 }), /unique/);
  await assert.rejects(api.addPaperWorkspace({ label: 'New Study', startingBalance: 50 }), /starting balance/i);
  const account = await api.addPaperWorkspace({ label: 'New Study', startingBalance: 5000.5 });
  assert.equal(account.broker, 'paper');
  assert.equal(account.balance, 5000.5);
  assert.ok((await api.getAccounts()).some(a => a.id === account.id));
  const common = { symbol: 'EURUSD', side: 'BUY', size: .2, entry: 1.08, sl: 1.07, tp: 1.09 };
  assert.equal((await api.placeDashboardOrder({ ...common, accountId: 'missing' })).mode, 'blocked');
  assert.equal((await api.placeDashboardOrder({ ...common, accountId: account.id })).mode, 'simulated');
  assert.equal((await api.getPositions({ accountId: account.id })).length, 1);
});

test('diagnostics run only against the Paper simulator; broker actions remain ready', async () => {
  const adapters = await api.getHubAdapters();
  assert.equal(adapters.length, 10);
  assert.match(adapters.find(a => a.broker === 'exness').ws, /Offline/);
  const local = await api.runAccountAction({ accountId: 'acc-paper-main', broker: 'paper', action: 'Run diagnostics' });
  assert.equal(local.mode, 'local');
  assert.equal(local.checks.find(c => c.name === 'Positions').status, 'Pass');
  const offline = await api.runAccountAction({ accountId: 'acc-deriv-demo', broker: 'deriv', action: 'Run diagnostics' });
  assert.equal(offline.mode, 'ready');
  assert.equal(offline.checks.some(c => c.status === 'Pass'), false);
});

test('account-scoped overrides affect market resolution without changing sibling profiles; filtered audit exports contain no credentials', async () => {
  const accountId = 'acc-exness-trial';
  const canonical = 'XAUUSD';
  await api.updateHubMapping({ accountId, canonical, brokerSymbol: 'XAUUSD.demo', suffix: '.demo', source: 'Manual' });
  assert.equal((await api.resolveSymbol(canonical, accountId)).brokerSymbol, 'XAUUSD.demo');
  assert.equal((await api.resolveSymbol(canonical, 'acc-exness-raw')).brokerSymbol, 'XAUUSDm');
  assert.equal((await api.getAccountMappings(accountId)).find(r => r.canonical === canonical).source, 'Manual');
  await assert.rejects(api.updateHubMapping({ accountId, canonical, brokerSymbol: 'EURUSDm', source: 'Manual' }), /already maps/);
  const [audit] = (await api.getAccountAudit()).filter(e => e.event === 'Mapping updated' && e.accountId === accountId);
  const csv = await api.exportAccountAudit([audit.id]);
  assert.ok(csv.text.includes('XAUUSD.demo'));
  assert.ok(!csv.text.includes(setup.accountId));
  await api.updateHubMapping({ accountId, canonical, brokerSymbol: '', source: 'Manual', reset: true });
  assert.equal((await api.resolveSymbol(canonical, accountId)).brokerSymbol, 'XAUUSDm');
});
