import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundled = await build({ stdin: { contents: `export * from './src/services/withdrawals'; export { getAccounts, applyKillSwitch } from './src/services/dashboard'; export { getFinanceLedger } from './src/services/financeLedger'; export { getAccountFinance } from './src/services/accounts';`, resolveDir: process.cwd() }, platform: 'node', format: 'esm', bundle: true, write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const input = (accountId, rail, amount = 125, extra = {}) => ({ accountId, rail, amount, idempotencyKey: crypto.randomUUID(), totp: '123456', otp: '000000', channel: 'email', acknowledgeCooling: true, ...extra });
const paper = (amount, extra) => input('acc-paper-main','paper',amount,{ destinationId:'paper-sink', ...extra });
const getPaper = async () => (await api.getAccounts()).find(a => a.broker === 'paper');

test('shared finance fixtures cover the rail matrix, offline receipts, timeline, and ledger', async () => {
  const [profiles, rows, ledger, addresses, audit] = await Promise.all([api.getWithdrawalAccounts(),api.getWithdrawalHistory(),api.getWithdrawalLedger(),api.getWithdrawalDestinations(),api.getWithdrawalAudit()]);
  assert.ok(profiles.length >= 10 && rows.length >= 10 && ledger.length >= 10 && addresses.length >= 10 && audit.length >= 10);
  for (const row of rows) assert.ok(profiles.find(p => p.id === row.accountId)?.rails.some(r => r.id === row.rail));
  for (const post of ledger) { const source = rows.find(r => r.ref === post.sourceRef); assert.equal(source.ledgerRef, post.id); assert.equal(source.accountId,post.debitAccountId); assert.notEqual(post.debitAccountId,post.creditAccountId); }
  const settled = rows.find(r => r.status === 'SETTLED');
  const { bytes, filename } = await api.downloadWithdrawalReceipt(settled.id);
  assert.equal(Buffer.from(bytes).subarray(0,4).toString(),'%PDF');
  assert.match(filename,/withdrawal\.pdf$/);
  await assert.rejects(api.downloadWithdrawalReceipt(rows.find(r => r.status === 'REQUESTED').id),/only for settled/);
});

test('Deriv preflight and replay are redacted and cannot start a broker or hosted session', async () => {
  const before = await api.getAccounts();
  const rails = (await api.getWithdrawalAccounts()).find(a => a.id === 'acc-deriv-demo').rails;
  assert.equal(rails.find(r => r.id === 'mpesa').eligible,false);
  assert.ok(rails.some(r => r.id === 'manual' && r.eligible));
  const [cashier, mpesa, replay] = await Promise.all([api.previewDerivWithdrawal({accountId:'acc-deriv-demo',rail:'cashier',amount:150}),api.previewDerivWithdrawal({accountId:'acc-deriv-demo',rail:'mpesa',amount:5000}),api.previewDerivStatus('OS-FIN-007200')]);
  assert.equal(cashier.url,null); assert.match(cashier.message,/backend is connected/);
  assert.equal(mpesa.canDraft,false); assert.match(replay.message,/no broker polling/);
  assert.deepEqual(await api.getAccounts(),before);
});

test('safety ladder gates Paper execution and concurrent replays debit once', async () => {
  const before = await getPaper(), draft = paper(250.5);
  await assert.rejects(api.requestWithdrawal({...draft,otp:'999999'}),/security checks/);
  await assert.rejects(api.requestWithdrawal({...draft,acknowledgeCooling:false}),/Acknowledge/);
  const [row, dup] = await Promise.all([api.requestWithdrawal(draft),api.requestWithdrawal(draft)]);
  assert.equal(row.ref,dup.ref); assert.equal(row.origin,'Simulated'); assert.equal(row.status,'SETTLED');
  const [after, ledger, finance] = await Promise.all([getPaper(),api.getFinanceLedger(),api.getAccountFinance()]);
  assert.equal(after.balance,before.balance-draft.amount); assert.equal(after.equity,Math.round((before.equity-draft.amount)*100)/100);
  assert.equal(after.realizedToday,before.realizedToday); assert.equal(after.floatingPnl,before.floatingPnl);
  const postings = ledger.filter(p => p.sourceRef === row.ref);
  assert.equal(postings.length,1); assert.equal(postings[0].balanceAfterDebit,after.balance); assert.equal(postings[0].id,row.ledgerRef);
  assert.ok(finance.some(r => r.id === row.ref && r.kind === 'Withdrawal' && r.status === 'Simulated'));
  await assert.rejects(api.requestWithdrawal({...draft,amount:125}),/different withdrawal/);
});

test('held Paper does not debit; broker previews never settle or post; amount and margin validation are enforced', async () => {
  const [before,posts] = await Promise.all([api.getAccounts(),api.getWithdrawalLedger()]);
  const expiring = paper(750);
  const [hold, offline] = await Promise.all([api.requestWithdrawal(expiring),api.requestWithdrawal(input('acc-binance-testnet','crypto',125,{network:'TRC20',destinationId:'wallet-1'}))]);
  assert.equal(hold.status,'COOLING'); assert.equal(Date.parse(hold.coolingUntil)-Date.parse(hold.initiatedAt),24*3600_000);
  assert.equal(offline.status,'READY'); assert.equal(offline.receiveNative,124);
  assert.equal(offline.settlementRef,undefined); assert.equal(hold.ledgerRef,undefined);
  await assert.rejects(api.previewWithdrawal(input('acc-exness-trial','manual',400,{destinationId:'portal',manualPath:'checklist',proofAcknowledged:true})),/margin guard/);
  await assert.rejects(api.previewWithdrawal(paper(2600)),/per-request limit/);
  assert.deepEqual(await api.getAccounts(),before); assert.deepEqual(await api.getWithdrawalLedger(),posts);
  const csv = await api.exportWithdrawals([offline.id]);
  assert.match(csv.text,/Initiated \(EAT\)/); assert.match(csv.text,/\+03:00/); assert.match(csv.text,/DEMO TRC20 •••• 018A/); assert.ok(!csv.text.includes(hold.ref));
});

test('new crypto destinations require demo OTP, correct network and an enforced 24-hour hold', async () => {
  await assert.rejects(api.addWithdrawalDestination({ label:'Test Vault',network:'TRC20',otp:'919191' }),/example code/);
  const d = await api.addWithdrawalDestination({ label:'Test Vault',network:'TRC20',otp:'000000' });
  assert.equal(d.state,'Cooling'); assert.match(d.masked,/DEMO TRC20/);
  const request = input('acc-binance-testnet','crypto',150,{network:'TRC20',destinationId:d.id});
  await assert.rejects(api.previewWithdrawal(request),/24-hour hold/);
  await assert.rejects(api.previewWithdrawal({...request,network:'ERC20'}),/approved sample/);
  await assert.rejects(api.previewWithdrawal({...request,destinationId:'unsaved-demo',warningAccepted:true}),/approved sample/);
  const settings = await api.getWithdrawalPolicy();
  await api.updateWithdrawalPolicy({ policy:{...settings,enforcement:'warn'},code:'123456' });
  await assert.rejects(api.previewWithdrawal({...request,destinationId:'unsaved-demo',warningAccepted:false}),/approved sample/);
  assert.match((await api.previewWithdrawal({...request,destinationId:'unsaved-demo',warningAccepted:true})).masked,/Unlisted DEMO/);
  await assert.rejects(api.previewWithdrawal(request),/24-hour hold/);
  await api.updateWithdrawalPolicy({ policy:settings,code:'123456' });
});

test('manual proof stays local and no reconciliation is implied', async () => {
  const draft = input('acc-oanda-practice','manual',180,{destinationId:'portal',manualPath:'proof',brokerReference:'DEMO-WD-101',proofAcknowledged:true});
  await assert.rejects(api.previewWithdrawal(draft),/Attach a sample/);
  const file = new File(['%PDF-1.7 SAMPLE'],'private-filename.pdf',{type:'application/pdf'});
  const row = await api.requestWithdrawal({...draft,proof:file});
  assert.equal(row.status,'READY'); assert.equal(row.ledgerRef,undefined);
  assert.equal(await (await api.getWithdrawalProof(row.proof.id)).blob.text(),await file.text());
  const audit = JSON.stringify(await api.getWithdrawalAudit());
  assert.ok(!audit.includes('private-filename.pdf') && !audit.includes('123456') && !audit.includes('000000'));
});

test('TOTP policy changes are audited, and rolling cap and kill switch block additional debits', async () => {
  const old = await api.getWithdrawalPolicy();
  const policy = {...old, dailyCap: 1050, txCap: 500};
  await assert.rejects(api.updateWithdrawalPolicy({policy,code:'000000'}),/example authenticator/);
  await api.updateWithdrawalPolicy({policy,code:'123456'});
  await assert.rejects(api.previewWithdrawal(paper(100)),/rolling 24-hour/);
  await api.applyKillSwitch('paused');
  await assert.rejects(api.previewWithdrawal(paper(10)),/kill switch/);
  await api.applyKillSwitch('armed');
  const audit = await api.getWithdrawalAudit();
  assert.ok(audit.some(e => e.action === 'Safety policy updated' && e.result.includes('$1050') && !e.result.includes('123456')));
});
