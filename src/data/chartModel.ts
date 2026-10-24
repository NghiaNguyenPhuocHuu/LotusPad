export interface DataPoint {
  label: string;
  value: number;
}
export type ChartKind = 'bar' | 'line' | 'pie';
export interface Padding { top: number; right: number; bottom: number; left: number }
export interface PlotArea { x: number; y: number; width: number; height: number }
export interface Tick { value: number; y: number }

export interface Scale { min: number; max: number; step: number; ticks: number[] }

/** Round-number axis limits that contain [min, max]. */
export function niceScale(min: number, max: number, targetTicks = 5): Scale {
  if (min === max) {
    if (min === 0) { min = 0; max = 1; } else { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
  }
  const raw = (max - min) / Math.max(1, targetTicks - 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { min: +lo.toFixed(10), max: +hi.toFixed(10), step, ticks };
}

export interface BarMark { label: string; value: number; x: number; y: number; width: number; height: number }
export interface LinePoint { label: string; value: number; x: number; y: number }
export interface PieSlice { label: string; value: number; fraction: number; startAngle: number; endAngle: number }

export type ChartLayout =
  | { kind: 'bar'; plot: PlotArea; baselineY: number; ticks: Tick[]; bars: BarMark[] }
  | { kind: 'line'; plot: PlotArea; baselineY: number; ticks: Tick[]; points: LinePoint[] }
  | { kind: 'pie'; cx: number; cy: number; radius: number; slices: PieSlice[] }
  | { kind: 'empty' };

const DEFAULT_PADDING: Padding = { top: 20, right: 20, bottom: 40, left: 56 };

/** Pure geometry for a chart. A renderer only has to paint the marks. */
export function layoutChart(rows: readonly DataPoint[], kind: ChartKind, width: number, height: number, padding: Padding = DEFAULT_PADDING): ChartLayout {
  if (rows.length === 0) return { kind: 'empty' };

  if (kind === 'pie') {
    const total = rows.reduce((s, r) => s + Math.abs(r.value), 0);
    let angle = -Math.PI / 2;
    const slices = rows.map((r) => {
      const fraction = total === 0 ? 0 : Math.abs(r.value) / total;
      const startAngle = angle;
      angle += fraction * Math.PI * 2;
      return { label: r.label, value: r.value, fraction, startAngle, endAngle: angle };
    });
    return { kind: 'pie', cx: width / 2, cy: height / 2, radius: Math.max(0, Math.min(width, height) / 2 - Math.max(padding.top, padding.left) / 2), slices };
  }

  const plot: PlotArea = { x: padding.left, y: padding.top, width: Math.max(0, width - padding.left - padding.right), height: Math.max(0, height - padding.top - padding.bottom) };
  const values = rows.map((r) => r.value);
  const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values));
  const y = (v: number) => plot.y + plot.height * (1 - (v - scale.min) / (scale.max - scale.min));
  const band = plot.width / rows.length;
  const centerX = (i: number) => plot.x + band * (i + 0.5);
  const ticks = scale.ticks.map((value) => ({ value, y: y(value) }));
  const baselineY = y(0);

  if (kind === 'line') {
    return { kind: 'line', plot, baselineY, ticks, points: rows.map((r, i) => ({ label: r.label, value: r.value, x: centerX(i), y: y(r.value) })) };
  }
  const barWidth = band * 0.7;
  const bars = rows.map((r, i) => ({ label: r.label, value: r.value, x: centerX(i) - barWidth / 2, y: Math.min(y(r.value), baselineY), width: barWidth, height: Math.abs(y(r.value) - baselineY) }));
  return { kind: 'bar', plot, baselineY, ticks, bars };
}
