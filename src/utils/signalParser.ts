import type { MarketSymbol } from "@/data/markets";
import type { SignalOrder, SourceKey } from "@/data/signalDesk";

export function contractUnits(s: MarketSymbol) {
  return s.volumeUnit === "lots"
    ? Number(s.contractSize.replace(/,/g, "").match(/[\d.]+/)?.[0] || 1)
    : 1;
}

export function parseSignalText(
  raw: string,
  symbols: MarketSymbol[],
  aliases: Record<string, string>,
  source: SourceKey | "auto" = "auto",
): SignalOrder {
  let text = raw.replace(/(\d),(?=\d{3}\b)/g, "$1");
  let detected: SourceKey = /telegram|gold desk|@\w+bot/i.test(raw)
    ? "telegram"
    : /copyfactory|provider:/i.test(raw)
      ? "copyfactory"
      : /subject:|forwarded message/i.test(raw)
        ? "email"
        : "paste";
  if (text.trim().startsWith("{")) {
    try {
      const j = JSON.parse(raw);
      const targetValues: unknown[] = Array.isArray(j.tp)
        ? j.tp
        : [j.tp1 ?? j.tp, j.tp2, j.tp3];
      const targetTokens = targetValues
        .filter((v) => typeof v === "number" || typeof v === "string")
        .slice(0, 3)
        .map((v, i) => `TP${i + 1} ${v}`)
        .join(" ");
      const entryValue = j.entry ?? j.price;
      text = `${j.action ?? j.side ?? ""} ${j.ticker ?? j.symbol ?? ""} ${j.type ?? ""} ${entryValue != null ? `@ ${entryValue}` : ""} ${j.sl != null ? `SL ${j.sl}` : ""} ${targetTokens} ${j.size != null || j.qty != null ? `SIZE ${j.size ?? j.qty}` : ""}`;
      detected = "webhook";
    } catch {
      text = "";
    }
  }
  text = text
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("#"))
    .join(" ");
  const tokens = text.toUpperCase().match(/[A-Z][A-Z\d_/.-]*/g) || [];
  const sym =
    symbols.find((s) =>
      tokens.some(
        (t) =>
          s.canonical === t ||
          Object.values(s.brokerSymbols).some((b) => b.toUpperCase() === t),
      ),
    ) ??
    symbols.find((s) => text.toLowerCase().includes(s.name.toLowerCase())) ??
    symbols.find((s) =>
      Object.entries(aliases).some(
        ([a, c]) =>
          c === s.canonical &&
          new RegExp(
            `\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            "i",
          ).test(text),
      ),
    );
  const buy = /\b(BUY|LONG|RISE|CALL)\b/i.test(text);
  const sell = /\b(SELL|SHORT|FALL|PUT)\b/i.test(text);
  const side = buy === sell ? "" : buy ? "BUY" : "SELL";
  const kind: SignalOrder["kind"] = /\b(stake|ticks|RISE|FALL)\b/i.test(text)
    ? "Contract"
    : /\bLIMIT\b/i.test(text)
      ? "Limit"
      : /\b(STOP(?!\s*LOSS)|ABOVE|BELOW)\b/.test(
            text.toUpperCase().replace(/STOP LOSS/g, "SL"),
          )
        ? "Stop"
        : "Market";
  const explicit = text.match(
    /(?:@|\b(?:ENTRY|PRICE|PX|LIMIT|STOP(?!\s*LOSS)|ABOVE|BELOW)\b)\s*[:=@]?\s*([\d.]+)/i,
  )?.[1];
  // A stake or a duration is never an entry price (e.g. "R_10 RISE stake 5").
  const afterSide =
    text.split(/\b(?:BUY|SELL|LONG|SHORT|RISE|FALL|CALL|PUT)\b/i)[1]?.trim() ??
    "";
  const quoteToken = afterSide.match(/^([A-Z][\w/.-]*)\s+([\d.]+)\b/i);
  const bare =
    afterSide.match(/^([\d.]+)\b/)?.[1] ??
    (quoteToken &&
    sym &&
    [sym.canonical, ...Object.values(sym.brokerSymbols)].some(
      (v) => v.toUpperCase() === quoteToken[1].toUpperCase(),
    )
      ? quoteToken[2]
      : undefined);
  const entry = Number(
    explicit ?? bare ?? (sym ? (side === "SELL" ? sym.bid : sym.ask) : 0),
  );
  const amount =
    text.match(
      /\b(?:LOT[S]?|SIZE|VOLUME|STAKE|QTY)\s*[:=]?\s*\$?([\d.]+)/i,
    )?.[1] ?? text.match(/\b([\d.]+)\s*LOTS?\b/i)?.[1];
  const size =
    amount != null
      ? Number(amount)
      : sym?.volumeUnit === "stake"
        ? 5
        : sym?.volumeUnit === "shares"
          ? 1
          : 0.1;
  const warnings: string[] = [];
  const level = (m: RegExpMatchArray, sign: number) => {
    let value = Number(m[2]);
    if (m[1] === "$") {
      value =
        entry +
        (sign * value) / Math.max(size * (sym ? contractUnits(sym) : 1), 0.001);
      warnings.push(
        "Money-based level estimated in USD. Review before placing.",
      );
    } else if (m[3]?.startsWith("p"))
      value = entry + sign * value * (sym?.pip || 0.0001);
    else if (m[3] === "%") value = entry + (sign * entry * value) / 100;
    return Number(value.toFixed(sym?.digits ?? 5));
  };
  const slMatch = text
    .toLowerCase()
    .match(/\b(?:sl|stop\s*loss)\s*[:=@]?\s*(\$?)([\d.]+)\s*(pips?\b|p\b|%)?/);
  const sl = slMatch ? level(slMatch, side === "SELL" ? 1 : -1) : 0;
  const targets = [
    ...text
      .toLowerCase()
      .matchAll(
        /\b(?:tp[1-3]?|take\s*profit|target)\s*[:=@]?\s*(\$?)([\d.]+)\s*(pips?\b|p\b|%)?/g,
      ),
  ].map((m) => level(m, side === "SELL" ? -1 : 1));
  if (!sym)
    warnings.push(
      "Instrument not recognized. Select a market or enter its canonical symbol.",
    );
  if (!side) warnings.push("Specify one direction: BUY or SELL.");
  if (!sl && kind !== "Contract")
    warnings.push("No stop loss found. Add a protective stop before placing.");
  if (!targets.length && kind !== "Contract")
    warnings.push("No take profit found. Review the exit target.");
  if (!amount && sym)
    warnings.push(
      `No size provided. Review the default ${size} ${sym.volumeUnit}.`,
    );
  const confidence = Math.max(
    0,
    100 -
      (!sym ? 38 : 0) -
      (!side ? 30 : 0) -
      (!sl && kind !== "Contract" ? 14 : 0) -
      (!targets.length && kind !== "Contract" ? 8 : 0) -
      (!amount ? 5 : 0),
  );
  return {
    symbol: sym?.canonical ?? "",
    side,
    entry,
    sl,
    targets,
    size,
    kind,
    duration:
      text.match(
        /(?:ticks\s+\d+|\d+\s*(?:ticks?|min(?:utes?)?|hr|hours?|seconds?))\b/i,
      )?.[0] || "",
    source: source === "auto" ? detected : source,
    confidence,
    warnings,
  };
}

export function readTabularText(text: string): string[][] {
  if (/<tr[\s>]/i.test(text))
    return [...text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((r) =>
        [...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
          c[1]
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .trim(),
        ),
      )
      .filter((r) => r.length);
  const separator = text.split(/\r?\n/)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === separator && !quoted) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" && !quoted) {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
