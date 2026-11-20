import { eatDay, netPnl, type TradeRecord } from "@/data/records";

export type ExportFormat = "CSV" | "XLSX" | "PDF" | "KES" | "JSON";
export type StatementFormat = "MT5 HTML" | "Deriv CSV" | "Binance XLSX" | "Alpaca CSV" | "OANDA CSV";
type Cell = string | number;
const csv = (rows: Cell[][]) => rows.map((row) => row.map((cell) => typeof cell === "number" ? cell : `"${(/^[=+@\-\t\r\n]/.test(cell) ? `'${cell}` : cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
const cols = ["Reference", "Closed at (UTC)", "Day (EAT)", "Broker", "Account", "Symbol", "Side", "Size", "Unit", "Entry", "Exit", "SL", "TP", "Gross USD", "Commission USD", "Swap USD", "Net USD", "R", "Duration minutes", "Source", "Source label", "Source reference"];

export async function exportRecords(rows: TradeRecord[], format: ExportFormat, rate = 0): Promise<Blob> {
  const values = [cols, ...rows.map((r) => [r.ref, r.closedAt, eatDay(r.closedAt), r.broker, r.accountLabel, r.symbol, r.side, r.size, r.sizeUnit, r.entry, r.exit, r.sl, r.tp, r.gross, r.commission, r.swap, netPnl(r), r.risk ? +(netPnl(r) / r.risk).toFixed(2) : "", r.openedAt ? Math.round((Date.parse(r.closedAt) - Date.parse(r.openedAt)) / 60000) : "", r.source, r.sourceName, r.sourceRef ?? ""])];
  if (format === "CSV") return new Blob(["\uFEFF", csv(values)], { type: "text/csv;charset=utf-8" });
  if (format === "JSON") return new Blob([JSON.stringify({ mode: "local simulation", trades: rows.map((r) => ({ ...r, netUsd: netPnl(r) })) }, null, 2)], { type: "application/json" });
  if (format === "XLSX") {
    const { default: write } = await import("write-excel-file/browser");
    return write(values.map((row, i) => row.map((value) => ({ value, fontWeight: i === 0 ? "bold" as const : undefined }))), { columns: cols.map((_, i) => ({ width: i < 5 ? 25 : 18 })) }).toBlob();
  }
  if (format === "KES") {
    const statement: Cell[][] = [["Year (EAT)", "Account", "Realized USD", "Illustrative USD/KES rate", "Realized KES (illustrative)", "Status"]];
    const groups = new Map<string, { year: string; label: string; net: number }>();
    for (const r of rows) {
      const year = eatDay(r.closedAt).slice(0, 4);
      const key = `${year}/${r.accountId}`;
      const group = groups.get(key) ?? { year, label: r.accountLabel, net: 0 };
      group.net += netPnl(r);
      groups.set(key, group);
    }
    groups.forEach(({ year, label, net }) => statement.push([year, label, +net.toFixed(2), rate, +(net * rate).toFixed(2), "Draft only — verified daily rates and backend required; not for filing"]));
    return new Blob(["\uFEFF", csv(statement)], { type: "text/csv;charset=utf-8" });
  }
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const net = rows.reduce((sum, r) => sum + netPnl(r), 0);
  const wins = rows.filter((r) => netPnl(r) > 0).length;
  doc.setFontSize(22).text("OStrade | Monthly summary", 16, 22);
  doc.setFontSize(10).text(`${eatDay(rows[0].closedAt).slice(0, 7)} / Local records preview / USD`, 16, 31);
  doc.setFontSize(13).text(`${rows.length} closed trades / ${(wins / rows.length * 100).toFixed(1)}% win rate / ${net.toFixed(2)} USD net`, 16, 49);
  doc.text("Cumulative realized P&L", 16, 65);
  const ordered = rows.slice().sort((a, b) => a.closedAt.localeCompare(b.closedAt));
  const series = [0];
  ordered.forEach((r) => series.push(series[series.length - 1] + netPnl(r)));
  const low = Math.min(...series), high = Math.max(...series);
  const y = (v: number) => 129 - (v - low) / Math.max(high - low, 1) * 51;
  doc.setDrawColor(210).line(16, y(0), 191, y(0));
  doc.setDrawColor(225, 96, 44).setLineWidth(0.6);
  series.slice(1).forEach((v, i) => doc.line(16 + i * 175 / ordered.length, y(series[i]), 16 + (i + 1) * 175 / ordered.length, y(v)));
  doc.text("Top closed trades", 16, 151);
  doc.setFontSize(10);
  ordered.sort((a, b) => netPnl(b) - netPnl(a)).slice(0, 8).forEach((r, i) => doc.text(`${eatDay(r.closedAt)}   ${r.symbol}   ${r.ref}   ${netPnl(r).toFixed(2)} USD`, 16, 165 + i * 8));
  return doc.output("blob");
}

function parseDelimited(text: string) {
  const delimiter = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const result: string[][] = [];
  let field = "", row: string[] = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === "\n" || c === "\r")) {
      row.push(field); field = "";
      if (c !== delimiter) { result.push(row); row = []; if (c === "\r" && text[i + 1] === "\n") i++; }
    } else field += c;
  }
  if (quoted) throw new Error("The statement contains an unterminated quoted cell.");
  if (row.length || field) result.push([...row, field]);
  return result;
}

export async function readStatement(file: File, format: StatementFormat, columns: { ref: string; net: string; commission: string; swap: string }) {
  if (file.size > 5_000_000) throw new Error("Choose a statement under 5 MB.");
  let rows: string[][] = [];
  if (format === "Binance XLSX") {
    const { readSheet } = await import("read-excel-file/browser");
    rows = (await readSheet(file)).map((row) => row.map((cell) => String(cell ?? "")));
  } else if (format === "MT5 HTML") {
    // Read table text only. Never mount broker-provided HTML or resolve its resources.
    const doc = document.createElement("template");
    doc.innerHTML = await file.text();
    rows = Array.from(doc.content.querySelectorAll("tr"), (row) => Array.from(row.querySelectorAll(":scope > td, :scope > th"), (cell) => cell.textContent ?? ""));
  } else rows = parseDelimited(await file.text());
  const normalize = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const refNames = ["reference", "ref", "tradeid", "ticket", "deal", "transactionid", "id", "orderid"];
  const pnlNames = ["netpnl", "netusd", "realizedpnl", "profit", "netprofit", "pnl", "pl"];
  const index = (row: string[], value: string, fallback: string[]) => row.findIndex((name) => (value.trim() ? [normalize(value)] : fallback).includes(normalize(name)));
  const header = rows.findIndex((row) => index(row, columns.ref, refNames) >= 0 && index(row, columns.net, pnlNames) >= 0);
  if (header < 0) throw new Error("Could not map the reference and net P&L columns. Enter the exact column names and try again.");
  const field = (key: keyof typeof columns, fallback: string[]) => index(rows[header], columns[key], fallback);
  const ref = field("ref", refNames), net = field("net", pnlNames), commission = field("commission", ["commission", "commissionusd", "fee"]), swap = field("swap", ["swap", "swapusd", "financing"]);
  if ((columns.commission.trim() && commission < 0) || (columns.swap.trim() && swap < 0)) throw new Error("An optional mapped fee column does not exist in this statement.");
  const num = (value?: string) => value?.trim() ? Number(value.trim().replace(/[$ ,]/g, "").replace(/[−–]/g, "-").replace(/^\((.+)\)$/, "-$1")) : undefined;
  const entries = rows.slice(header + 1).flatMap((row) => {
    const reference = row[ref]?.trim(), amount = num(row[net]);
    if (!reference || amount === undefined || !Number.isFinite(amount)) return [];
    const fee = num(row[commission]), financing = num(row[swap]);
    return [{ ref: reference, net: amount, commission: Number.isFinite(fee) ? fee : undefined, swap: Number.isFinite(financing) ? financing : undefined }];
  });
  if (!entries.length) throw new Error("No rows with a reference and numeric net P&L were found.");
  return entries;
}
