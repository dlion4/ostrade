import { useMemo, useRef, useState } from "react";
import type { Candle } from "@/services/markets";
import { bollinger, ema, rsi } from "@/utils/indicators";

export type DrawMode = "none" | "hline" | "trend";
export type Drawing =
  | { id: string; kind: "hline"; price: number }
  | { id: string; kind: "trend"; a: { i: number; price: number }; b: { i: number; price: number } };

interface Props {
  candles: Candle[];
  digits: number;
  showEma20: boolean;
  showEma50: boolean;
  showBollinger: boolean;
  showRsi: boolean;
  drawMode: DrawMode;
  drawings: Drawing[];
  onAddDrawing: (d: Drawing) => void;
}

const W = 960;
const PRICE_H = 270;
const VOL_H = 64;
const PAD_L = 10;
const PAD_R = 74;
const PAD_T = 14;
const RSI_H = 96;

function linePath(points: (number | null)[], x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  let pen = false;
  points.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

export function CandleChart({ candles, digits, showEma20, showEma50, showBollinger, showRsi, drawMode, drawings, onAddDrawing }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [pending, setPending] = useState<{ i: number; price: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const closes = useMemo(() => candles.map((c) => c.c), [candles]);
  const e20 = useMemo(() => ema(closes, 20), [closes]);
  const e50 = useMemo(() => ema(closes, 50), [closes]);
  const bb = useMemo(() => bollinger(closes, 20, 2), [closes]);
  const r14 = useMemo(() => rsi(closes, 14), [closes]);

  const n = candles.length;
  const plotW = W - PAD_L - PAD_R;
  const step = plotW / Math.max(1, n);
  const bodyW = Math.max(2, step * 0.62);

  let lo = Math.min(...candles.map((c) => c.l));
  let hi = Math.max(...candles.map((c) => c.h));
  if (showBollinger) {
    bb.forEach((p) => {
      if (p) {
        lo = Math.min(lo, p.lower);
        hi = Math.max(hi, p.upper);
      }
    });
  }
  drawings.forEach((d) => {
    if (d.kind === "hline") {
      lo = Math.min(lo, d.price);
      hi = Math.max(hi, d.price);
    }
  });
  const padP = (hi - lo) * 0.06 || hi * 0.001;
  lo -= padP;
  hi += padP;

  const x = (i: number) => PAD_L + step * i + step / 2;
  const y = (p: number) => PAD_T + (1 - (p - lo) / (hi - lo)) * (PRICE_H - PAD_T);
  const priceAt = (yy: number) => lo + (1 - (yy - PAD_T) / (PRICE_H - PAD_T)) * (hi - lo);
  const maxV = Math.max(...candles.map((c) => c.v), 1);
  const volTop = PRICE_H + 8;
  const vy = (v: number) => volTop + VOL_H - (v / maxV) * VOL_H;
  const last = candles[n - 1];
  const fmt = (v: number) => v.toFixed(digits);
  const ticksY = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);

  const toViewBox = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return { vx: ((clientX - rect.left) / rect.width) * W, vy: ((clientY - rect.top) / rect.height) * (PRICE_H + VOL_H + 14) };
  };

  const handleClick = (e: React.MouseEvent) => {
    if (drawMode === "none") return;
    const pt = toViewBox(e.clientX, e.clientY);
    if (!pt || pt.vy > PRICE_H) return;
    const i = Math.min(n - 1, Math.max(0, Math.floor((pt.vx - PAD_L) / step)));
    const price = Number(priceAt(pt.vy).toFixed(digits));
    if (drawMode === "hline") {
      onAddDrawing({ id: `d-${Date.now()}`, kind: "hline", price });
      return;
    }
    if (!pending) {
      setPending({ i, price });
    } else {
      onAddDrawing({ id: `d-${Date.now()}`, kind: "trend", a: pending, b: { i, price } });
      setPending(null);
    }
  };

  const handleMove = (e: React.MouseEvent) => {
    const pt = toViewBox(e.clientX, e.clientY);
    if (!pt) return;
    const i = Math.floor((pt.vx - PAD_L) / step);
    setHover(i >= 0 && i < n ? i : null);
  };

  const inspected = candles[hover ?? n - 1];
  const insIdx = hover ?? n - 1;
  const up = inspected.c >= inspected.o;

  return (
    <div className="os-chart-wrap">
      <div className="os-chart-ohlc os-mono" aria-live="polite">
        <span className="os-chart-ohlc-time">{inspected.t}</span>
        <span>O <b>{fmt(inspected.o)}</b></span>
        <span>H <b>{fmt(inspected.h)}</b></span>
        <span>L <b>{fmt(inspected.l)}</b></span>
        <span>C <b className={up ? "os-up" : "os-down"}>{fmt(inspected.c)}</b></span>
        <span>Vol <b>{inspected.v.toLocaleString("en-US")}</b></span>
        {showEma20 && e20[insIdx] !== null && <span className="os-ind-ema20">EMA20 <b>{fmt(e20[insIdx] as number)}</b></span>}
        {showEma50 && e50[insIdx] !== null && <span className="os-ind-ema50">EMA50 <b>{fmt(e50[insIdx] as number)}</b></span>}
        {showRsi && r14[insIdx] !== null && <span className="os-ind-rsi">RSI14 <b>{(r14[insIdx] as number).toFixed(1)}</b></span>}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${PRICE_H + VOL_H + 14}`}
        className={`os-candle-svg ${drawMode !== "none" ? "is-drawing" : ""}`}
        role="img"
        aria-label={`Candlestick chart, last close ${fmt(last.c)}`}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
      >
        {ticksY.map((p) => (
          <g key={p}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(p)} y2={y(p)} className="os-grid-line" />
            <text x={W - PAD_R + 6} y={y(p) + 4} className="os-axis-label">{fmt(p)}</text>
          </g>
        ))}

        {showBollinger && (
          <>
            <path d={linePath(bb.map((p) => p?.upper ?? null), x, y)} className="os-bb-line" />
            <path d={linePath(bb.map((p) => p?.lower ?? null), x, y)} className="os-bb-line" />
            <path d={linePath(bb.map((p) => p?.mid ?? null), x, y)} className="os-bb-mid" />
          </>
        )}

        {candles.map((c, i) => {
          const isUp = c.c >= c.o;
          const top = y(Math.max(c.o, c.c));
          const h = Math.max(1, Math.abs(y(c.o) - y(c.c)));
          return (
            <g key={`${c.t}-${i}`} className={`os-candle ${isUp ? "is-up" : "is-down"}`} style={{ animationDelay: `${Math.min(i, 59) * 8}ms` }}>
              <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} />
              <rect x={x(i) - bodyW / 2} y={top} width={bodyW} height={h} rx={1} />
              <rect x={x(i) - bodyW / 2} y={vy(c.v)} width={bodyW} height={volTop + VOL_H - vy(c.v)} className="os-vol-bar" />
            </g>
          );
        })}

        {showEma20 && <path d={linePath(e20, x, y)} className="os-ema20" />}
        {showEma50 && <path d={linePath(e50, x, y)} className="os-ema50" />}

        {drawings.map((d) =>
          d.kind === "hline" ? (
            <g key={d.id}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(d.price)} y2={y(d.price)} className="os-draw-hline" />
              <text x={PAD_L + 4} y={y(d.price) - 4} className="os-draw-label">H {fmt(d.price)}</text>
            </g>
          ) : (
            <line key={d.id} x1={x(d.a.i)} y1={y(d.a.price)} x2={x(d.b.i)} y2={y(d.b.price)} className="os-draw-trend" />
          )
        )}
        {pending && <circle cx={x(pending.i)} cy={y(pending.price)} r={5} className="os-draw-pending" />}

        <line x1={PAD_L} x2={W - PAD_R} y1={y(last.c)} y2={y(last.c)} className="os-last-line" />
        <rect x={W - PAD_R + 2} y={y(last.c) - 10} width={PAD_R - 4} height={20} rx={4} className="os-last-tag" />
        <text x={W - PAD_R + 6} y={y(last.c) + 4} className="os-last-text">{fmt(last.c)}</text>

        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={volTop + VOL_H} className="os-crosshair" />}
        <line x1={PAD_L} x2={W - PAD_R} y1={volTop - 2} y2={volTop - 2} className="os-grid-line" />
      </svg>

      {showRsi && (
        <svg viewBox={`0 0 ${W} ${RSI_H}`} className="os-rsi-svg" role="img" aria-label="RSI 14 panel">
          <rect x={PAD_L} y={RSI_H * 0.3} width={W - PAD_L - PAD_R} height={RSI_H * 0.4} className="os-rsi-band" />
          {[30, 50, 70].map((lvl) => (
            <g key={lvl}>
              <line x1={PAD_L} x2={W - PAD_R} y1={RSI_H - (lvl / 100) * RSI_H} y2={RSI_H - (lvl / 100) * RSI_H} className="os-grid-line" />
              <text x={W - PAD_R + 6} y={RSI_H - (lvl / 100) * RSI_H + 4} className="os-axis-label">{lvl}</text>
            </g>
          ))}
          <path d={linePath(r14, x, (v) => RSI_H - (v / 100) * RSI_H)} className="os-rsi-line" />
        </svg>
      )}

      <div className="os-chart-xaxis os-mono" aria-hidden>
        {candles.filter((_, i) => i % 10 === 0 || i === n - 1).map((c, i) => <span key={`${c.t}-${i}`}>{c.t}</span>)}
      </div>
      {drawMode === "trend" && <p className="os-draw-hint">{pending ? "Click the second anchor to finish the trend line." : "Click the first anchor point of the trend line."}</p>}
      {drawMode === "hline" && <p className="os-draw-hint">Click anywhere on the price area to place a horizontal line.</p>}
    </div>
  );
}
