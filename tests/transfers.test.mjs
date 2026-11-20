import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundled = await build({ stdin: { contents: `export * from './src/services/transfers'; export * from './src/services/fundingPolicy'; export { getAccounts, createPaperAccount, partialClosePosition, getPositions } from './src/services/dashboard'; export { getAccountFinance } from './src/services/accounts'; export { getFundingAccounts, requestDeposit } from './src/services/deposits'; export { getWithdrawalAccounts, requestWithdrawal } from './src/services/withdrawals'; export { postFinanceLedger } from './src/services/financeLedger';`, resolveDir: process.cwd() }, platform: 'node', format: 'esm', bundle: true, write: false });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const paperFrom='acc-paper-main',paperTo='acc-paper-reserve';
const draft=(fromId=paperFrom,toId=paperTo,rail='paper',amount=125)=>({fromId,toId,rail,amount,key:crypto.randomUUID(),totp:'123456'});

test('ledger joins funding, wallet and trade fixtures with all ten balanced entry types',async()=>{
  const {rows,integrity}=await api.getLedgerEntries();
  assert.equal(integrity.balanced,true); assert.equal(integrity.debits,integrity.credits);
  assert.ok(rows.length>100); assert.equal(new Set(rows.map(r=>r.txType)).size,10);
  assert.ok(rows.some(r=>r.debitLabel.includes('Binance') && r.debitLabel.includes('Spot') && r.creditLabel.includes('Funding')));
  assert.throws(()=>api.postFinanceLedger({...rows[0],id:'bad-ledger',creditAccountId:rows[0].debitAccountId}),/Invalid/);
  const recon=(await api.getLedgerReconciliation()).rows;
  assert.ok(recon.length>=10); assert.ok(recon.some(r=>r.status==='DRIFT')); assert.ok(recon.some(r=>r.status==='STALE'));
  assert.equal(recon.find(r=>r.accountId===paperFrom).status,'SYNCED');
});

test('Paper transfer is protected by example TOTP, idempotent, journaled and conserves funds',async()=>{
  const before=await api.getAccounts(), input=draft();
  await assert.rejects(api.requestTransfer({...input,totp:'000000'}),/example TOTP/);
  const [a,b]=await Promise.all([api.requestTransfer(input),api.requestTransfer(input)]);
  assert.equal(a.ref,b.ref); assert.equal(a.origin,'Simulated'); assert.equal(a.legs[0].status,'Posted');
  const [after,ledger,finance,recon]=await Promise.all([api.getAccounts(),api.getLedgerEntries(),api.getAccountFinance(),api.getLedgerReconciliation()]);
  for(const [id,delta] of [[paperFrom,-125],[paperTo,125]]){
    const old=before.find(x=>x.id===id),neo=after.find(x=>x.id===id);
    assert.equal(neo.balance,old.balance+delta); assert.equal(neo.equity,+(old.equity+delta).toFixed(2)); assert.equal(neo.realizedToday,old.realizedToday);
    assert.ok(finance.some(f=>f.id.startsWith(a.ref)&&f.accountId===id));
    assert.equal(recon.rows.find(f=>f.accountId===id).status,'SYNCED');
  }
  const postings=ledger.rows.filter(x=>x.sourceRef===a.ref);
  assert.equal(postings.length,1); assert.equal(postings[0].debitAccountId,paperFrom); assert.equal(postings[0].creditAccountId,paperTo);
  await assert.rejects(api.requestTransfer({...input,amount:150}),/different transfer/);
  await assert.rejects(api.previewTransfer(draft(paperFrom,paperTo,'paper',9000)),/available balance or breaches/);
});

test('broker native and two-leg drafts remain inert and Binance validates distinct wallets',async()=>{
  const before=await api.getAccounts(); const book=await api.getLedgerEntries();
  const cross=draft('acc-deriv-demo','acc-exness-trial','manual');
  await assert.rejects(api.requestTransfer(cross),/Review both manual legs/);
  const quote=await api.previewTransfer(cross); assert.equal(quote.legs.length,2); assert.equal(quote.received,121);
  const mt5=await api.previewTransfer(draft('acc-exness-raw','acc-exness-trial','mt5')); assert.equal(mt5.legs[1].status,'Waiting for leg 1');
  const native=draft('acc-deriv-demo','acc-deriv-live','deriv');
  const wallet={...draft('acc-binance-testnet','acc-binance-testnet','binance'),fromWallet:'Spot',toWallet:'Funding'};
  await assert.rejects(api.previewTransfer({...wallet,toWallet:'Spot'}),/different sample wallets/);
  const pending=await Promise.all([api.requestTransfer({...cross,reviewedLegs:true}),api.requestTransfer(native),api.requestTransfer(wallet)]);
  for(const r of pending){assert.equal(r.status,'Offline preview');assert.deepEqual(r.ledgerRefs,[]);assert.match(r.note,/backend is connected/);}
  assert.deepEqual(await api.getAccounts(),before); assert.deepEqual(await api.getLedgerEntries(),book);
  const csv=await api.exportTransferHistory(pending.slice(0,1).map(r=>r.id)); assert.match(csv.text,/Waiting for leg 1/); assert.ok(!csv.text.includes(pending[1].ref));
  assert.equal(Buffer.from(await (await api.exportTransferReceipt(pending[0].id)).blob.arrayBuffer()).subarray(0,4).toString(),'%PDF');
});

test('Paper deposits, withdrawals and real local closes share one reconciled book',async()=>{
  const target=await api.createPaperAccount({label:'Finance QA balance',startingBalance:9000});
  await api.requestDeposit({accountId:target.id,rail:'paper',amount:100,idempotencyKey:crypto.randomUUID()});
  await api.requestWithdrawal({accountId:target.id,rail:'paper',amount:50,idempotencyKey:crypto.randomUUID(),destinationId:'paper-sink',totp:'123456',otp:'000000',channel:'email',acknowledgeCooling:true});
  const positions=await api.getPositions({accountId:paperFrom});
  const open=positions.find(p=>p.size>.05&&p.pnl!==0);
  const result=await api.partialClosePosition(open.id,.025);
  const ledger=await api.getLedgerEntries();
  assert.ok(ledger.rows.some(r=>r.sourceRef===result.ref&&r.origin==='Simulated'&&r.txType==='TRADE_PNL'));
  const reconcile=(await api.getLedgerReconciliation()).rows;
  assert.equal(reconcile.find(a=>a.accountId===target.id).internal,9050);
  assert.equal(reconcile.find(a=>a.accountId===paperFrom).status,'SYNCED');
});

test('rail policy changes need example 2FA and affect the shared funding capabilities only',async()=>{
  await assert.rejects(api.updateFundingRail({id:'cashier',min:10,max:10000,fee:0,enabled:false,totp:'111111'}),/example TOTP/);
  await api.updateFundingRail({id:'cashier',min:10,max:10000,fee:0,enabled:false,totp:'123456'});
  const deposit=(await api.getFundingAccounts()).find(a=>a.id==='acc-deriv-demo');
  const withdrawal=(await api.getWithdrawalAccounts()).find(a=>a.id==='acc-deriv-demo');
  assert.ok(!deposit.rails.some(r=>r.id==='cashier'));assert.ok(!withdrawal.rails.find(r=>r.id==='cashier').eligible);
  const pref={accountId:'acc-deriv-live',rail:'mpesa',provider:api.railDestinations.mpesa[0],label:'Juja demo mobile',totp:'123456'};
  await assert.rejects(api.saveFundingPreference({...pref,otp:'111111'}),/example OTP/);
  const saved=await api.saveFundingPreference({...pref,otp:'000000'});assert.match(saved.masked,/•••• 024/);
  assert.equal((await api.getWithdrawalAccounts()).find(a=>a.id===pref.accountId).rails[0].id,'mpesa');
  assert.ok((await api.getFinanceAudit()).some(r=>r.action==='Default rail saved'&&r.verification==='Example TOTP + OTP'));
  await api.updateFundingRail({id:'cashier',min:10,max:10000,fee:0,enabled:true,totp:'123456'});
});

test('reconciliation posts one explained book-only adjustment and statements roll forward',async()=>{
  const before=await api.getAccounts();
  const selected=(await api.getLedgerReconciliation()).rows.find(r=>r.accountId==='acc-deriv-demo');
  const details={accountId:selected.accountId,expectedDifference:selected.difference,reason:'Pending funding',note:'Reviewed the historical sample statement.',totp:'123456'};
  await assert.rejects(api.postLedgerAdjustment({...details,note:'tiny'}),/12–240/);
  const race=await Promise.allSettled([api.postLedgerAdjustment(details),api.postLedgerAdjustment(details)]);
  const success=race.filter(r=>r.status==='fulfilled'); assert.equal(success.length,1);
  assert.deepEqual(await api.getAccounts(),before);
  const r=(await api.getLedgerReconciliation()).rows.find(r=>r.accountId===selected.accountId);
  assert.equal(r.difference,0);assert.equal(r.status,'SYNCED');assert.ok(r.resolution.note.includes('historical sample'));
  const info={accountId:r.accountId,month:api.currentStatementMonth()};
  const s=await api.getMonthlyStatement(info);
  assert.equal(s.closing,+(s.opening+s.deposits+s.withdrawals+s.transfers+s.tradingNet+s.adjustments).toFixed(2));
  assert.equal(s.closing,r.internal);assert.equal(s.verified,false);
  const x=await api.exportMonthlyStatement({...info,format:'XLSX'});
  assert.equal(Buffer.from(await x.blob.arrayBuffer()).subarray(0,2).toString(),'PK');
});

test('signed audit verifies intact exports and rejects tampering',async()=>{
  await api.setReconciliationSchedule(true);
  const exp=await api.exportSignedFinanceAudit(); const data=JSON.parse(exp.text);
  assert.equal(data.algorithm,'HMAC-SHA-256');assert.match(data.payload,/nothing|no worker/);
  const check=await api.verifySignedFinanceAudit(new File([exp.text],exp.filename)); assert.equal(check.valid,true);
  const altered=await api.verifySignedFinanceAudit(new File([JSON.stringify({...data,payload:data.payload+' '})],exp.filename));assert.equal(altered.valid,false);
});
