import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const bundled=await build({stdin:{contents:`export * from './src/services/copilot'; export { getPositions, getSignalRules, getRecentRecords, applyKillSwitch } from './src/services/dashboard'; export { getSchedulerSchedules, runScheduleNow, updateScheduleStatus } from './src/services/scheduler'; export { getAccountSymbolOverrides } from './src/services/symbolMappings';`,resolveDir:process.cwd()},platform:'node',format:'esm',bundle:true,write:false});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const paper='acc-paper-main';
async function submit(text,accountId=paper){const thread=await api.newCopilotThread();return api.sendCopilotMessage({threadId:thread.id,accountId,text});}
const approve=(id,code='123456')=>api.decideCopilotDraft({id,decision:'approve',code});
const order='Buy 0.10 lots EURUSD at 1.0850 SL 1.0800 TP 1.0950';

test('canonically sourced proposals, examples and traces have useful snapshots; text with credentials is stripped',async()=>{
 const [drafts,templates,anomalies,audit]=await Promise.all([api.getCopilotDrafts(),api.getCopilotTemplates(),api.getCopilotAnomalies(),api.getCopilotActivity()]);
 assert.ok([drafts,templates,anomalies,audit].every(r=>r.length>=10));
 const secret='DO_NOT_STORE_ME'; const result=await submit(`api key: ${secret} at https://example.test/private`);
 assert.equal(result.proposal,undefined);assert.ok(!JSON.stringify(result.thread).includes(secret));
 const summary=await submit('Summarize my trading week and rank my signal sources');assert.equal(summary.proposal,undefined); assert.deepEqual(summary.thread.messages[1].tools.map(t=>t.name),['records.query','signal.rank']);
});

test('an approved Paper order fills once in the canonical positions and journal, never before approval',async()=>{
 const before=await api.getPositions({accountId:paper});
 const {proposal}=await submit(order); assert.equal(proposal.status,'Pending');assert.deepEqual(await api.getPositions({accountId:paper}),before);
 await assert.rejects(approve(proposal.id,'000000'),/example TOTP/);
 const results=await Promise.all([approve(proposal.id),approve(proposal.id)]);
 const row=results.find(x=>x.status==='Simulated');assert.ok(row);const ref=row.receipt[0].ref;assert.match(ref,/^OST-2025-\d{5}$/);
 const after=await api.getPositions({accountId:paper});assert.equal(after.length,before.length+1);
 assert.equal(after.find(p=>p.ref===ref).sourceRef,row.id);
 assert.ok((await api.getRecentRecords(paper)).some(r=>r.ref===ref&&r.origin==='Co-Pilot'));
});

test('external orders and finance approvals are inert; ambiguous scope never silently executes Paper',async()=>{
 const before=await api.getPositions();
 const external=await submit(`${order} on Exness Raw`);assert.equal(external.proposal.accountId,'acc-exness-raw');
 const done=await approve(external.proposal.id);assert.equal(done.status,'Offline preview');assert.match(done.outcome,/backend is connected/);
 assert.equal((await submit(`${order} on some other broker`)).proposal,undefined);
 assert.equal((await submit(`do not close EURUSD positions losing more than $1 on Paper`)).proposal,undefined);
 assert.equal((await submit('Close every EURUSD position losing more than $50 on Exness')).proposal,undefined);
 assert.equal((await submit('Close US30 positions losing more than $50 on Exness and on Paper Main')).proposal,undefined);
 assert.equal((await submit('Close US30 positions on Exness losing more than $50')).proposal,undefined);
 const close=await submit('Close US30 positions losing more than $50 on Exness MT5 Trial 1');
 assert.equal(close.proposal.accountId,'acc-exness-trial');assert.equal((await approve(close.proposal.id)).status,'Offline preview');
 const rejected=(await submit(order)).proposal;
 assert.equal((await api.decideCopilotDraft({id:rejected.id,decision:'reject'})).status,'Rejected');
 assert.equal((await approve(rejected.id)).status,'Rejected');
 await assert.rejects(api.setCopilotPolicy({action:'finance.*',mode:'Standing',inline2FA:false,code:'123456'}),/locked/);
 const f=(await submit('Withdraw $100')).proposal; await assert.rejects(approve(f.id,''),/example TOTP/);assert.equal((await approve(f.id)).status,'Offline preview');
 assert.deepEqual(await api.getPositions(),before);
});

test('template installs exact objects, preserves attribution, and AI drafts never arm or dispatch',async()=>{
 const p=await api.prepareCopilotTemplate({templateId:'london',accountId:paper});assert.equal(p.payload.objects.length,3);
 const result=await approve(p.id,'');assert.equal(result.status,'Drafts saved');assert.equal(result.receipt.length,3);
 const schedule=(await api.getSchedulerSchedules()).find(s=>s.ref===result.receipt[0].ref);assert.equal(schedule.status,'paused');assert.equal(schedule.copilot.templateId,'london');
 assert.equal((await api.runScheduleNow(schedule.id)).ok,false);assert.equal((await api.updateScheduleStatus(schedule.id,'armed')).ok,false);
 assert.equal((await api.prepareCopilotTemplate({templateId:'london',accountId:paper})).id,p.id);
 const bundle=await api.prepareCopilotTemplate({templateId:'telegram',accountId:paper});const saved=await approve(bundle.id);assert.deepEqual(saved.receipt.map(r=>r.kind),['rule','guard']);
 const rule=(await api.getSignalRules()).find(r=>r.id===saved.receipt[0].ref);assert.equal(rule.enabled,false);assert.equal(rule.copilot.templateId,'telegram');
 const {proposal}=await submit(api.promptExamples[0].text);assert.equal(proposal.payload.objects.length,20);assert.equal(proposal.payload.objects[19].maxOpen,3);
});

test('mapping preserves uncertainty and saves only explicitly confirmed account-specific routes',async()=>{
 const a='acc-exness-trial';const rows=await api.mapCopilotSymbols({accountId:a,text:'gold on exness\nQA_NDX = NAS100\nunknown instrument'});
 assert.equal(rows[0].canonical,'XAUUSD');assert.equal(rows[1].confidence,'Needs confirmation');assert.equal(rows[2].canonical,'');
 await assert.rejects(api.acceptCopilotMappings({accountId:a,rows,confirmed:true}),/Choose a canonical/);
 await assert.rejects(api.acceptCopilotMappings({accountId:a,rows:rows.slice(0,2),confirmed:false}),/confirm the batch/);
 await api.acceptCopilotMappings({accountId:a,rows:rows.slice(0,2),confirmed:true});
 assert.ok((await api.getAccountSymbolOverrides()).some(x=>x.accountId===a&&x.canonical==='NAS100'&&x.brokerSymbol==='QA_NDX'&&x.source==='AI accepted'));
});

test('standing permission needs demo 2FA, blocks disallowed proposals, and auto-mitigation only pauses one scoped rule',async()=>{
 await assert.rejects(api.setCopilotPolicy({action:'guard.set',mode:'Standing',inline2FA:true,code:'111111'}),/example TOTP/);
 const before=await api.getSignalRules();await api.scanCopilotAnomalies();assert.deepEqual(await api.getSignalRules(),before);
 await api.setCopilotPolicy({action:'guard.set',mode:'Standing',inline2FA:true,code:'123456'});
 await api.setAutoMitigation({enabled:true,code:'123456'});const scan=await api.scanCopilotAnomalies();assert.match(scan.message,/1 Paper rule/);
 assert.deepEqual((await api.getSignalRules()).filter(r=>before.find(x=>x.id===r.id)?.enabled!==r.enabled).map(r=>r.id),['rul-01']);
 const {proposal}=await submit('Set a guard: pause all automation if daily loss exceeds 4%');assert.equal((await approve(proposal.id,'')).status,'Drafts saved');
 await api.setCopilotPolicy({action:'order.place',mode:'Never',inline2FA:true,code:'123456'});
 const orderDraft=(await submit(order)).proposal;assert.equal((await approve(orderDraft.id)).status,'Blocked');
 const audit=await api.getCopilotActivity();assert.ok(audit.some(r=>r.approval==='Auto'&&r.refs[0]?.ref==='rul-01'));assert.ok(audit.some(r=>r.approval==='Standing'));assert.ok(audit.some(r=>r.approval==='Blocked'));
 const csv=await api.exportCopilotActivity(audit.filter(r=>r.approval==='Auto').map(r=>r.id));assert.match(csv.text,/rul-01/);assert.ok(!csv.text.includes('123456'));
});

test('briefing is composed locally with preferences but no delivery job',async()=>{
 const briefing=await api.getDailyBriefing();assert.ok(briefing.accounts.length>=10);assert.match(briefing.text,/open positions/);
 const original=await api.getBriefingSettings(); await api.setBriefingSettings({...original,tone:'Analyst',channels:['In-app','Telegram preview']});
 const revised=await api.regenerateDailyBriefing();assert.match(revised.text,/Compare risk/);assert.equal(revised.settings.tone,'Analyst');
 assert.ok((await api.getCopilotActivity()).some(a=>a.tool==='briefing.settings'&&a.outcome.includes('Nothing scheduled')));
});
