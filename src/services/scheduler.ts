import {
  calendarDays,
  schedulerKpis,
  schedulerSchedules,
  scheduleExecutions,
  timelineEvents,
  type SchedulerSchedule,
  type SchedulerKpi,
  type CalendarDay,
  type TimelineEvent,
  type ScheduleExecution,
} from "@/data/scheduler";
import { latency } from "./_latency";

// Re-export types
export type { SchedulerSchedule, SchedulerKpi, CalendarDay, TimelineEvent, ScheduleExecution };

// In-memory mutable store for scheduler
let schedulesStore: SchedulerSchedule[] = [...schedulerSchedules];
let nextRefNum = 2116;

function genRef() {
  nextRefNum += 1;
  return `OS-SCH-${nextRefNum}`;
}

export async function getSchedulerKpis(): Promise<SchedulerKpi> {
  const active = schedulesStore.filter(s => s.status === "armed").length;
  return latency({ ...schedulerKpis, active, total: 50 }, 320, 520);
}

export async function getSchedulerSchedules(filters?: { status?: string; trigger?: string; account?: string; search?: string }): Promise<SchedulerSchedule[]> {
  let list = [...schedulesStore];
  if (filters?.status && filters.status !== "all") list = list.filter(s => s.status === filters.status);
  if (filters?.trigger && filters.trigger !== "all") list = list.filter(s => s.trigger === filters.trigger);
  if (filters?.account && filters.account !== "all") list = list.filter(s => s.accountId === filters.account);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(s => `${s.name} ${s.symbol} ${s.accountLabel}`.toLowerCase().includes(q));
  }
  return latency(list, 300, 520);
}

export async function getCalendarDays(): Promise<CalendarDay[]> {
  return latency(calendarDays, 280, 420);
}

export async function getTimelineEvents(): Promise<TimelineEvent[]> {
  return latency(timelineEvents, 320, 480);
}

export async function getScheduleExecutions(scheduleId: string): Promise<ScheduleExecution[]> {
  const list = scheduleExecutions.filter(e => e.scheduleId === scheduleId);
  // if no specific, return all for demo
  return latency(list.length ? list : scheduleExecutions, 300, 520);
}

export async function getAllExecutions(): Promise<ScheduleExecution[]> {
  return latency(scheduleExecutions, 300, 520);
}

// Parser for bulk paste lines (very lenient, frontend-only)
export interface BulkParsedRow {
  raw: string;
  parsed: Partial<SchedulerSchedule>;
  error?: string;
}

export async function parseBulkPaste(text: string): Promise<BulkParsedRow[]> {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const rows: BulkParsedRow[] = lines.map(raw => {
    
    // naive parse
    const symbolMatch = raw.match(/(R_10|R_75|EURUSD|GBPJPY|XAUUSD|BTCUSDT|ETHUSDT|US30|NAS100|USDJPY|GBPUSD|AUDUSD|CRASH1000|BOOM1000)/i);
    const sideMatch = raw.match(/\b(BUY|SELL|RISE|FALL)\b/i);
    const amountMatch = raw.match(/(\d+\.?\d*)\s*(usd|lots?|stake)/i);
    if (!symbolMatch || !sideMatch) {
      return { raw, parsed: {}, error: "Could not parse symbol or side. Example: 'EURUSD BUY 0.1 ...'" };
    }
    const symbol = symbolMatch[1].toUpperCase();
    const side = sideMatch[1].toUpperCase().includes("BUY") || sideMatch[1].toUpperCase() === "RISE" ? "BUY" as const : "SELL" as const;
    const triggerDetail = raw.match(/every.*|at .*|if .*/i)?.[0] || "one_time";
    let trigger: SchedulerSchedule["trigger"] = "one_time";
    if (/every/i.test(raw)) trigger = "interval";
    else if (/at\s+(NY-open|london|NY-open)/i.test(raw)) trigger = "session";
    else if (/if crosses/i.test(raw)) trigger = "price";
    else if (/if rsi/i.test(raw)) trigger = "indicator";
    else if (/cron/i.test(raw)) trigger = "cron";

    return {
      raw,
      parsed: {
        symbol,
        side,
        size: amountMatch ? `${amountMatch[1]} ${amountMatch[2]}` : "0.10 lots",
        trigger,
        triggerDetail,
        accountLabel: "Paper Main",
        name: `${symbol} ${side} auto`,
      }
    };
  });
  return latency(rows, 400, 650);
}

export interface CreateScheduleInput {
  name?: string;
  trigger: SchedulerSchedule["trigger"];
  triggerDetail: string;
  accountId: string;
  accountLabel: string;
  broker?: SchedulerSchedule["broker"];
  brokerLabel?: string;
  symbol: string;
  side: "BUY" | "SELL";
  size: string;
  sl: string;
  tp: string;
  expiry?: string;
  tags?: string[];
}

export async function createSingleSchedule(input: CreateScheduleInput): Promise<{ ok: boolean; schedule?: SchedulerSchedule; message: string }> {
  if (schedulesStore.length >= 50) {
    return latency({ ok: false, message: "Schedule cap reached (50/50). Delete or complete a schedule first." }, 300, 500);
  }
  const newSched: SchedulerSchedule = {
    id: `sch-${Date.now()}`,
    ref: genRef(),
    name: input.name || `${input.symbol} ${input.side} schedule`,
    trigger: input.trigger,
    triggerLabel: input.trigger,
    triggerDetail: input.triggerDetail,
    triggerBadge: input.trigger,
    accountLabel: input.accountLabel,
    accountId: input.accountId,
    broker: (input.broker as any) || "paper",
    brokerLabel: input.brokerLabel || input.accountLabel,
    symbol: input.symbol,
    side: input.side,
    size: input.size,
    sl: input.sl,
    tp: input.tp,
    status: "armed",
    nextFire: input.trigger === "one_time" ? input.triggerDetail : `Next: ${input.triggerDetail}`,
    nextFireSort: Date.now() + 3600000,
    lastResult: "Scheduled — awaiting fire",
    lastResultTone: "neutral",
    createdAt: new Date().toISOString().slice(0, 10),
    expiry: input.expiry || "Never",
    tags: input.tags || [],
    maxFailures: 3,
    consecutiveFailures: 0,
  };
  schedulesStore = [newSched, ...schedulesStore];
  return latency({ ok: true, schedule: newSched, message: `Created ${newSched.ref} — ${newSched.name} is now armed.` }, 400, 650);
}

export async function createBulkSchedules(rows: BulkParsedRow[]): Promise<{ ok: boolean; created: number; message: string }> {
  const valid = rows.filter(r => !r.error);
  if (schedulesStore.length + valid.length > 50) {
    return latency({ ok: false, created: 0, message: `Would exceed cap: ${schedulesStore.length}/50 slots used, ${valid.length} requested. Cap is 50.` }, 400, 600);
  }
  if (valid.length === 0) return latency({ ok: false, created: 0, message: "No valid rows to create." }, 300, 450);
  const newScheds: SchedulerSchedule[] = valid.map(r => ({
    id: `sch-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    ref: genRef(),
    name: r.parsed.name || `${r.parsed.symbol} ${r.parsed.side}`,
    trigger: r.parsed.trigger || "one_time",
    triggerLabel: r.parsed.trigger || "one_time",
    triggerDetail: r.parsed.triggerDetail || "—",
    triggerBadge: r.parsed.trigger || "one_time",
    accountLabel: r.parsed.accountLabel || "Paper Main",
    accountId: "acc-paper-main",
    broker: "paper",
    brokerLabel: "OStrade Paper",
    symbol: r.parsed.symbol || "EURUSD",
    side: r.parsed.side || "BUY",
    size: r.parsed.size || "0.10 lots",
    sl: "—",
    tp: "—",
    status: "armed" as const,
    nextFire: "Scheduled",
    nextFireSort: Date.now() + 3600000,
    lastResult: "Scheduled — awaiting fire",
    lastResultTone: "neutral" as const,
    createdAt: new Date().toISOString().slice(0, 10),
    expiry: "Never",
    tags: ["bulk"],
    maxFailures: 3,
    consecutiveFailures: 0,
  }));
  schedulesStore = [...newScheds, ...schedulesStore];
  return latency({ ok: true, created: newScheds.length, message: `Created ${newScheds.length} schedules. ${schedulesStore.length}/50 slots used.` }, 500, 800);
}

export async function updateScheduleStatus(id: string, status: SchedulerSchedule["status"]): Promise<{ ok: boolean; message: string }> {
  const idx = schedulesStore.findIndex(s => s.id === id);
  if (idx === -1) return latency({ ok: false, message: "Schedule not found." }, 250, 400);
  schedulesStore[idx] = { ...schedulesStore[idx], status, nextFire: status === "paused" ? "Paused" : status === "armed" ? "Resumed" : schedulesStore[idx].nextFire };
  return latency({ ok: true, message: `Schedule ${schedulesStore[idx].ref} is now ${status}.` }, 300, 500);
}

export async function runScheduleNow(id: string): Promise<{ ok: boolean; message: string }> {
  const s = schedulesStore.find(x => x.id === id);
  if (!s) return latency({ ok: false, message: "Schedule not found." }, 300, 450);
  if (s.accountLabel.includes("Paper")) {
    return latency({ ok: true, message: `Simulated run of ${s.ref}: filled on Paper (SIMULATED). Receipt OST-2025-${String(Math.floor(Math.random()*9000)+1000)} logged.` }, 600, 900);
  }
  return latency({ ok: true, message: `Preview run of ${s.ref} on ${s.accountLabel}: Ready — executes when the backend is connected.` }, 500, 750);
}

export async function deleteSchedule(id: string): Promise<{ ok: boolean; message: string }> {
  const before = schedulesStore.length;
  schedulesStore = schedulesStore.filter(s => s.id !== id);
  if (schedulesStore.length === before) return latency({ ok: false, message: "Schedule not found." }, 250, 400);
  return latency({ ok: true, message: "Schedule deleted. Slot freed." }, 300, 500);
}

export async function duplicateSchedule(id: string): Promise<{ ok: boolean; message: string }> {
  const orig = schedulesStore.find(s => s.id === id);
  if (!orig) return latency({ ok: false, message: "Schedule not found." }, 300, 500);
  if (schedulesStore.length >= 50) return latency({ ok: false, message: "Cap 50 reached — cannot duplicate." }, 300, 500);
  const copy = { ...orig, id: `sch-${Date.now()}`, ref: genRef(), name: orig.name + " (copy)" };
  schedulesStore = [copy, ...schedulesStore];
  return latency({ ok: true, message: `Duplicated as ${copy.ref}` }, 400, 600);
}

export function resetSchedulerStore() {
  schedulesStore = [...schedulerSchedules];
  nextRefNum = 2116;
}
