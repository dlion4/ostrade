import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: `export * from './src/services/records'; export { readStatement } from './src/services/recordsFiles'; export { placeDashboardOrder, getPositions, closePosition, partialClosePosition } from './src/services/dashboard';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('unified history uses typed closed positions and computes net USD from signed fees', async () => {
  const records = await api.getTradeRecords();
  assert.ok(records.length >= 100);
  assert.equal(new Set(records.map(r => r.ref)).size, records.length);
  assert.ok(records.every(r => Date.parse(r.closedAt) > Date.parse(r.openedAt)));
  assert.ok(new Set(records.map(r => r.broker)).size >= 3);
  assert.equal(api.netPnl({ gross: 100, commission: -4.32, swap: -1.51 }), 94.17);
  assert.equal(api.eatDay('2026-11-20T21:30:00Z'), '2026-11-21');
});

test('only closed paper lots enter history; partial and final closes retain order origin and journal', async () => {
  const before = await api.getTradeRecords();
  const order = await api.placeDashboardOrder({ accountId: 'acc-paper-main', symbol: 'EURUSD', side: 'BUY', size: 0.40, entry: 1.082, sl: 1.071, tp: 1.087, origin: 'Signal', sourceRef: 'SIG-TEST', sourceLabel: 'Test channel' });
  const open = (await api.getPositions()).find(p => p.ref === order.ref);
  assert.ok(open);
  assert.equal((await api.getTradeRecords()).length, before.length);
  await api.addJournalNote({ positionId: open.id, date: api.eatDay(new Date()), text: 'Test journal', tags: ['Mistake', 'mistake', ' setup '] });
  const partial = await api.partialClosePosition(open.id, 0.15);
  await api.closePosition(open.id);
  const records = await api.getTradeRecords();
  assert.equal(records.length, before.length + 2);
  const full = records.find(r => r.ref === order.ref);
  assert.equal(full.sourceRef, 'SIG-TEST');
  assert.equal(full.sourceName, 'Test channel');
  assert.equal(full.size, 0.25);
  assert.equal(records.find(r => r.ref === partial.ref).size, 0.15);
  assert.deepEqual((await api.getPositionJournal(open.id))[0].tags, ['mistake', 'setup']);
  const inert = await api.placeDashboardOrder({ accountId: 'acc-exness-trial', symbol: 'EURUSD', side: 'BUY', size: 0.4, entry: 1.082, sl: 1.071, tp: 1.087 });
  assert.equal(inert.mode, 'ready');
  assert.equal((await api.getTradeRecords()).length, records.length);
});

test('statement detection honors custom CSV mappings and audits mismatch, missing record and duplicate', async () => {
  const [trade] = (await api.getTradeRecords()).filter(r => r.broker === 'deriv');
  const columns = { ref: 'External code', net: 'Adjusted P&L', commission: 'Fee', swap: '' };
  const file = new File([`External code;Adjusted P&L;Fee\r\n"${trade.ref}";24.90;-2\r\n"${trade.ref}";24.90;-2\r\n"ABSENT-DEMO-REFER";16.00;0`], 'statement.csv');
  const rows = await api.readStatement(file, 'Deriv CSV', columns);
  assert.equal(rows[0].net, 24.90);
  assert.equal(rows[0].commission, -2);
  assert.deepEqual(await api.reconcileStatement({ accountId: trade.accountId, file, format: 'Deriv CSV', tolerance: 0.05, columns }), { reviewed: 3, found: 4 });
  const { exceptions } = await api.getReconciliation();
  const missing = exceptions.find(e => e.ref === 'ABSENT-DEMO-REFER');
  assert.equal(missing.kind, 'Missing trade');
  await api.resolveStatementException(missing.id, 'Flag for review');
  assert.equal((await api.getReconciliation()).exceptions.find(e => e.id === missing.id).resolution, 'Flag for review');
  await assert.rejects(api.readStatement(file, 'Deriv CSV', { ...columns, net: 'missing header' }), /could not map/i);
});

test('export queue generates downloadable files for only the requested rows', async () => {
  const [first, second] = await api.getTradeRecords();
  await assert.rejects(api.queueRecordExport({ format: 'CSV', tradeIds: [], email: false, sms: false }), /no closed trades/i);
  const { id } = await api.queueRecordExport({ format: 'CSV', tradeIds: [first.id], email: true, sms: false });
  let job;
  for (let i = 0; i < 4; i++) {
    job = (await api.getRecordExports()).find(job => job.id === id);
    if (job.status !== 'Queued') break;
  }
  assert.equal(job.status, 'Ready');
  assert.ok(job.email);
  const { file, name } = await api.downloadRecordExport(id);
  assert.equal(name, 'ostrade-filtered.csv');
  const csv = await file.text();
  assert.ok(csv.includes(first.ref));
  assert.ok(!csv.includes(second.ref));
});
