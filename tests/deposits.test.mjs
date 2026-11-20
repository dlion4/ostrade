import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundled = await build({ stdin: { contents: `export * from './src/services/deposits'; export { getAccounts } from './src/services/dashboard'; export { getAccountFinance } from './src/services/accounts';`, resolveDir: process.cwd() }, platform: 'node', format: 'esm', bundle: true, write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const input = (accountId, rail, amount = 125) => ({ accountId, rail, amount, idempotencyKey: crypto.randomUUID() });

test('canonical finance fixtures use available accounts and rails and back every sample posting', async () => {
  const [accounts, rows, ledger, kpis, agents] = await Promise.all([api.getFundingAccounts(), api.getDepositHistory(), api.getDepositLedger(), api.getDepositSummary(), api.getKenyaAgents()]);
  assert.ok(accounts.length >= 10 && rows.length >= 10 && ledger.length >= 10 && agents.length >= 10);
  for (const row of rows) assert.ok(accounts.find(a => a.id === row.accountId)?.rails.some(r => r.id === row.rail));
  for (const entry of ledger) {
    const source = rows.find(r => r.ref === entry.sourceRef);
    assert.equal(source.ledgerRef, entry.id);
    assert.equal(source.amountUSD, entry.amountUSD);
    assert.equal(source.accountId, entry.creditAccountId);
    assert.notEqual(entry.debitAccountId, entry.creditAccountId);
  }
  assert.equal(kpis.timing.length, 8);
});

test('hosted cashier and other external funding stay inert, including masked agent details', async () => {
  const [before, ledger, agents] = await Promise.all([api.getAccounts(), api.getDepositLedger(), api.getKenyaAgents()]);
  const draft = { ...input('acc-deriv-demo', 'cashier'), cashierWindow: 30 };
  const [handoff, row, agent] = await Promise.all([api.previewCashier(), api.requestDeposit(draft), api.requestDeposit({ ...input('acc-deriv-demo', 'mpesa-agent', 2500), agentId: agents[0].id, phone: '+254700000012', phoneConfirmed: true })]);
  assert.equal(handoff.url, null);
  assert.match(handoff.message, /backend is connected/);
  assert.equal(row.details.matchingWindowMinutes, 30);
  assert.equal(row.status, 'INITIATED');
  assert.equal(row.origin, 'Preview');
  assert.equal(row.ledgerRef, undefined);
  assert.equal(row.settledAt, undefined);
  assert.equal(agent.details.maskedPhone, '+254 ••• ••012');
  assert.equal(agent.amountUSD, 19.31);
  assert.equal(JSON.stringify(agent).includes('700000012'), false);
  assert.deepEqual(await api.getAccounts(), before);
  assert.deepEqual(await api.getDepositLedger(), ledger);
  await assert.rejects(api.requestDeposit(input('acc-deriv-demo', 'paper')), /not available/);
});

test('concurrent Paper retry credits balance and equity once with a matched ledger item and no P&L change', async () => {
  const base = input('acc-paper-main', 'paper', 220.75);
  const getPaper = async () => (await api.getAccounts()).find(a => a.id === base.accountId);
  const before = await getPaper();
  const [first, second] = await Promise.all([api.requestDeposit(base), api.requestDeposit(base)]);
  assert.equal(first.ref, second.ref);
  assert.equal(first.origin, 'Simulated');
  assert.equal(first.status, 'CONFIRMED');
  assert.ok(first.settledAt);
  const [after, ledger, history, finance] = await Promise.all([getPaper(), api.getDepositLedger(), api.getDepositHistory(), api.getAccountFinance()]);
  assert.equal(after.balance, before.balance + base.amount);
  assert.equal(after.equity, before.equity + base.amount);
  assert.deepEqual(after, { ...before, balance: after.balance, equity: after.equity });
  assert.equal(history.filter(r => r.ref === first.ref).length, 1);
  const [entry, ...duplicates] = ledger.filter(r => r.sourceRef === first.ref);
  assert.equal(duplicates.length, 0);
  assert.equal(entry.id, first.ledgerRef);
  assert.equal(entry.amountNative, base.amount);
  assert.equal(entry.creditAccountId, base.accountId);
  assert.equal(entry.balanceAfterCredit, after.balance);
  assert.ok(finance.some(r => r.id === first.ref && r.status === 'Simulated'));
  await assert.rejects(api.requestDeposit({ ...base, amount: 300 }), /different deposit/);
});

test('manual proof checks type and size, requires acknowledgement and keeps sample files local', async () => {
  const draft = { ...input('acc-exness-trial', 'manual'), brokerReference: 'DEMO-REF-123', expectedCredit: 120, manualRail: 'M-Pesa processor', reviewedProof: true };
  const valid = new File(['%PDF-1.7\nsample'], 'fixture.pdf', { type: 'application/pdf' });
  await Promise.all([
    assert.rejects(api.previewDeposit(draft), /Attach a sample/),
    assert.rejects(api.previewDeposit({ ...draft, proof: new File(['sample'], 'fixture.svg', { type: 'image/svg+xml' }) }), /Attach a sample/),
    assert.rejects(api.previewDeposit({ ...draft, proof: new File([new Uint8Array(10_000_001)], 'large.png', { type: 'image/png' }) }), /10 MB/),
    assert.rejects(api.previewDeposit({ ...draft, proof: valid, expectedCredit: -5 }), /expected credit/),
    assert.rejects(api.previewDeposit({ ...draft, proof: valid, reviewedProof: false }), /acknowledge/),
  ]);
  const row = await api.requestDeposit({ ...draft, proof: valid });
  assert.equal(row.status, 'INITIATED');
  assert.equal(row.details.expectedCredit, 120);
  assert.equal(row.ledgerRef, undefined);
  assert.equal(await (await api.getDepositProof(row.proof.id)).blob.text(), await valid.text());
  const csv = await api.exportDeposits([row.id]);
  assert.match(csv.text, /DEMO-REF-123/);
  assert.ok(!csv.text.includes('fixture.pdf'));
});

test('crypto requires a local example whitelist and never gives a payable address', async () => {
  const draft = { ...input('acc-binance-testnet', 'crypto'), network: 'TRC20', cryptoAcknowledged: true };
  await assert.rejects(api.previewDeposit(draft), /example verification/);
  await assert.rejects(api.verifyDemoNetwork({ network: 'TRC20', code: '123456' }), /000000/);
  await api.verifyDemoNetwork({ network: 'TRC20', code: '000000' });
  const [row, reusable, expired] = await Promise.all([api.requestDeposit(draft), api.getDemoAddress({ network: draft.network, broker: 'binance' }), api.getDemoAddress({ network: draft.network, broker: 'deriv', expired: true })]);
  assert.equal(row.status, 'INITIATED');
  assert.equal(row.confirmations, 0);
  assert.match(reusable.address, /^DEMO-NOT-PAYABLE-/);
  assert.equal(expired.expired, true);
  assert.equal(expired.confirmed, 0);
  assert.match(expired.mode, /Per-request/);
});

test('recovery logs reviews without retrying, reconciling, or altering a historical record', async () => {
  const { items } = await api.getDepositRecovery();
  const item = items.find(r => r.failure === 'Wrong network');
  await assert.rejects(api.recordRecoveryAction({ ref: item.ref, action: 'Retry reviewed' }), /does not apply/);
  await assert.rejects(api.recordRecoveryAction({ ref: item.ref, action: 'Manual match staged', txHash: 'invalid' }), /hexadecimal/);
  const txHash = 'a'.repeat(64);
  await api.recordRecoveryAction({ ref: item.ref, action: 'Manual match staged', txHash });
  const after = await api.getDepositRecovery();
  assert.deepEqual(after.items, items);
  assert.ok(after.events.some(r => r.depositRef === item.ref));
  assert.ok(!JSON.stringify(after.events).includes(txHash));
});
