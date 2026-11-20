import { eatDay, initialJournalNotes, initialStatementExceptions, initialTradeRecords, netPnl, type JournalNote, type StatementException, type TradeRecord } from "@/data/records";
import { tradingAccounts, type OpenPosition } from "@/data/dashboard";
import { postFinanceLedger, tradeLedgerEntries } from "./financeLedger";
import { latency } from "./_latency";
import { exportRecords, readStatement, type ExportFormat, type StatementFormat } from "./recordsFiles";

export { eatDay, netPnl };
export type { JournalNote, StatementException, TradeRecord, ExportFormat, StatementFormat };
const records = structuredClone(initialTradeRecords);
const notes = structuredClone(initialJournalNotes);
let exceptions = structuredClone(initialStatementExceptions);
const lastCheck = new Map<string, string>();
let digestEnabled = false;
const id = () => globalThis.crypto.randomUUID();

export function bookPaperClosure(position: OpenPosition, options?: { ref: string; size: number; pnl: number }) {
  const closedAt = new Date().toISOString();
  const row: TradeRecord = {
    id: id(), positionId: position.id, ref: options?.ref ?? position.ref, accountId: position.accountId,
    accountLabel: position.accountLabel, broker: position.broker, environment: position.environment, symbol: position.symbol,
    side: position.side, size: options?.size ?? position.size, sizeUnit: position.sizeUnit, entry: position.entry, exit: position.current,
    sl: position.sl, tp: position.tp, gross: options?.pnl ?? position.pnl, commission: 0, swap: 0, risk: null,
    openedAt: position.openedTimestamp ?? null, closedAt,
    source: position.source === "Scheduled" ? "Schedule" : position.source === "Co-Pilot" ? "AI" : position.source,
    sourceRef: position.sourceRef,
    sourceName: position.sourceLabel ?? (position.source === "Manual" ? "Manual ticket" : position.source),
  };
  records.unshift(row);
  if (row.broker === "paper") tradeLedgerEntries(row,"Simulated").forEach(postFinanceLedger);
}

export const getTradeRecords = () => latency(records);
export const getTradeJournal = () => latency({ notes, digestEnabled });
export async function addJournalNote(input: Omit<JournalNote, "id" | "screenshot"> & { screenshot?: File }) {
  if (!input.text.trim()) throw new Error("Write a note before saving.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date))) throw new Error("Enter a valid journal date.");
  const { screenshot, ...fields } = input;
  if (screenshot && (!/^image\/(png|jpeg|webp)$/.test(screenshot.type) || screenshot.size > 2_000_000)) throw new Error("Choose a PNG, JPEG, or WebP image under 2 MB.");
  const url = screenshot ? await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the screenshot."));
    reader.readAsDataURL(screenshot);
  }) : undefined;
  const note: JournalNote = { ...fields, id: id(), text: fields.text.trim(), tags: [...new Set(fields.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))], screenshot: screenshot && url ? { name: screenshot.name, url } : undefined };
  notes.unshift(note);
  return latency(note);
}
export const getPositionJournal = async (positionId: string) => latency(notes.filter((n) => n.positionId === positionId));
export function setLessonDigest(enabled: boolean) {
  digestEnabled = enabled;
  return latency({ enabled, message: enabled ? "Preference saved locally. Weekly email requires a backend connection." : "Weekly lesson digest disabled." });
}

export function getReconciliation() {
  const accounts = tradingAccounts.filter((a) => records.some((r) => r.accountId === a.id)).map((a) => {
    const outstanding = exceptions.filter((e) => e.accountId === a.id && (!e.resolution || e.resolution === "Flag for review")).length;
    const checked = lastCheck.get(a.id) ?? (a.broker === "alpaca" ? new Date(Date.now() - 9 * 864e5).toISOString() : new Date().toISOString());
    return { id: a.id, label: a.label, broker: a.broker, status: outstanding ? `DRIFT ${outstanding}` : Date.now() - Date.parse(checked) > 7 * 864e5 ? "STALE" : "SYNCED", checked };
  });
  return latency({ accounts, exceptions });
}
export async function reconcileStatement(input: { accountId: string; file?: File; format: StatementFormat; tolerance: number; columns: { ref: string; net: string; commission: string; swap: string } }) {
  const book = records.filter((r) => r.accountId === input.accountId);
  if (!book.length) throw new Error("Select an account with recorded trades.");
  if (!Number.isFinite(input.tolerance) || input.tolerance < 0) throw new Error("Enter a non-negative USD tolerance.");
  const matched = new Map(book.map((r) => [r.ref.toUpperCase(), r]));
  const sample = book[0];
  const rows = input.file ? await readStatement(input.file, input.format, input.columns) : [
    { ref: sample.ref, net: netPnl(sample) + 3.75, commission: sample.commission - 3.75, swap: sample.swap },
    { ref: sample.ref, net: netPnl(sample) + 3.75 }, { ref: "BROKER-UNMATCHED-01", net: 42.5 },
  ];
  const seen = new Set<string>();
  const added: StatementException[] = [];
  const issue = (ref: string, kind: StatementException["kind"], internal?: number, broker?: number) => added.push({ id: id(), accountId: input.accountId, ref, kind, internal, broker });
  const differs = (a: number, b: number) => Math.round(Math.abs(a - b) * 100) / 100 > input.tolerance;
  for (const row of rows) {
    const key = row.ref.toUpperCase();
    const current = matched.get(key);
    if (seen.has(key)) { issue(row.ref, "Duplicate", current && netPnl(current), row.net); continue; }
    seen.add(key);
    if (!current) { issue(row.ref, "Missing trade", undefined, row.net); continue; }
    if (differs(netPnl(current), row.net)) issue(row.ref, "P&L mismatch", netPnl(current), row.net);
    if ((row.commission !== undefined && differs(current.commission, row.commission)) || (row.swap !== undefined && differs(current.swap, row.swap))) {
      issue(row.ref, "Fee difference", current.commission + current.swap, (row.commission ?? current.commission) + (row.swap ?? current.swap));
    }
  }
  // Keep the audit trail; don't re-open a matching exception on repeat import.
  for (const item of added) {
    if (!exceptions.some((e) => e.accountId === item.accountId && e.ref === item.ref && e.kind === item.kind && e.internal === item.internal && e.broker === item.broker)) exceptions.unshift(item);
  }
  lastCheck.set(input.accountId, new Date().toISOString());
  return latency({ reviewed: rows.length, found: added.length });
}
export function resolveStatementException(exceptionId: string, resolution: NonNullable<StatementException["resolution"]>) {
  exceptions = exceptions.map((item) => item.id === exceptionId ? { ...item, resolution } : item);
  return latency({ resolution, message: `${resolution} recorded in the local review log. The original trade ledger is unchanged.` });
}

export interface ExportJob {
  id: string; format: ExportFormat; scope: string; name: string; createdAt: string; status: "Queued" | "Ready" | "Failed"; size?: number; email: boolean; sms: boolean;
}
const jobs: ExportJob[] = [];
const files = new Map<string, Blob>();
export const getRecordExports = () => latency(jobs);
export async function queueRecordExport(input: { format: ExportFormat; tradeIds?: string[]; month?: string; year?: string; rate?: number; email: boolean; sms: boolean }) {
  let rows = input.tradeIds ? input.tradeIds.map((tradeId) => records.find((r) => r.id === tradeId)).filter((record): record is TradeRecord => !!record) : records.slice();
  if (input.format === "PDF") rows = rows.filter((r) => eatDay(r.closedAt).startsWith(input.month ?? ""));
  if (input.format === "KES") rows = rows.filter((r) => eatDay(r.closedAt).startsWith(input.year ?? ""));
  if (!rows.length) throw new Error("No closed trades match this export. Choose another scope or date.");
  if (input.format === "KES" && (!input.rate || !Number.isFinite(input.rate) || input.rate <= 0)) throw new Error("Enter a positive illustrative USD/KES rate.");
  const ext = input.format === "KES" ? "csv" : input.format.toLowerCase();
  const job: ExportJob = { id: id(), format: input.format, name: `ostrade-${input.format === "KES" ? `kes-${input.year}` : input.month && input.format === "PDF" ? input.month : input.tradeIds ? "filtered" : "history"}.${ext}`,
    scope: `${input.tradeIds ? "Filtered view" : "All accounts"} · ${rows.length} trades`, status: "Queued", createdAt: new Date().toISOString(), email: input.email, sms: input.sms };
  jobs.unshift(job);
  void latency(null).then(() => exportRecords(rows, input.format, input.rate)).then((file) => {
    files.set(job.id, file); job.size = file.size; job.status = "Ready";
  }).catch(() => { job.status = "Failed"; });
  return latency({ id: job.id }, 300, 320);
}
export async function downloadRecordExport(exportId: string) {
  const file = files.get(exportId);
  const job = jobs.find((entry) => entry.id === exportId);
  if (!file || !job) throw new Error("The export is not ready yet.");
  await latency(null);
  return { file, name: job.name };
}
