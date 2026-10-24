import { describe, expect, it } from 'vitest';
import { tidyStroke, type Pt } from '../src';

function rng(seed: number) { // small seeded generator so fixtures never change
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const jitter = (pts: Pt[], amp: number, seed = 1): Pt[] => { const r = rng(seed); return pts.map(([x, y]) => [x + (r() - 0.5) * 2 * amp, y + (r() - 0.5) * 2 * amp]); };
const walk = (v: Pt[], step = 6): Pt[] => {
  const out: Pt[] = [v[0]!];
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1]!, b = v[i]!, n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
};
const rotate = (pts: Pt[], deg: number, c: Pt): Pt[] => { const t = (deg * Math.PI) / 180; return pts.map(([x, y]) => [c[0] + (x - c[0]) * Math.cos(t) - (y - c[1]) * Math.sin(t), c[1] + (x - c[0]) * Math.sin(t) + (y - c[1]) * Math.cos(t)]); };
const circle = (cx: number, cy: number, r: number, share = 1, n = 80): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = -Math.PI / 2 + (i / n) * share * Math.PI * 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt; });
const rectPath = (x: number, y: number, w: number, h: number): Pt[] => walk([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]);
const angle = (a: Pt, b: Pt, c: Pt) => { let d = Math.abs((Math.atan2(a[1] - b[1], a[0] - b[0]) - Math.atan2(c[1] - b[1], c[0] - b[0])) * 180 / Math.PI) % 360; return d > 180 ? 360 - d : d; };

describe('lines', () => {
  it('flattens a near-horizontal line', () => {
    const r = tidyStroke(jitter(walk([[50, 100], [350, 106]]), 2));
    expect(r.kind).toBe('line');
    expect(r.points).toHaveLength(2);
    expect(r.points[0]![1]).toBe(r.points[1]![1]);
  });
  it('straightens a vertical line', () => {
    const r = tidyStroke(jitter(walk([[100, 40], [96, 300]]), 1.5));
    expect(r.kind).toBe('line');
    expect(r.points[0]![0]).toBe(r.points[1]![0]);
  });
  it('keeps the endpoints of a diagonal line', () => {
    const raw = walk([[0, 0], [200, 120]]);
    const r = tidyStroke(raw);
    expect(r.points).toEqual([raw[0], raw[raw.length - 1]]);
  });
});

describe('closed shapes', () => {
  it('snaps a messy rectangle', () => {
    const r = tidyStroke(jitter(rectPath(100, 80, 240, 140), 3));
    expect(r.kind).toBe('rect');
    expect(r.points).toHaveLength(5);
    const xs = r.points.map((p) => p[0]), ys = r.points.map((p) => p[1]);
    expect(Math.min(...xs)).toBeCloseTo(100, -1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(130);
    expect(r.points[0]).toEqual(r.points[4]);
  });

  it('snaps a rectangle drawn at an angle and keeps it rotated', () => {
    const r = tidyStroke(jitter(rotate(rectPath(100, 100, 240, 120), 30, [220, 160]), 2));
    expect(r.kind).toBe('rect');
    const p = r.points;
    for (let i = 0; i < 4; i++) expect(angle(p[(i + 3) % 4]!, p[i]!, p[i + 1]!)).toBeCloseTo(90, 3);
    expect(Math.abs(p[1]![1] - p[0]![1])).toBeGreaterThan(20); // not axis aligned
  });

  it('snaps a wobbly circle to an ellipse', () => {
    const r = tidyStroke(jitter(circle(200, 200, 90), 3));
    expect(r.kind).toBe('ellipse');
    const xs = r.points.map((p) => p[0]);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(200, -1);
  });

  it('snaps a circle that does not quite close', () => {
    expect(tidyStroke(jitter(circle(200, 200, 90, 0.8), 2)).kind).toBe('ellipse');
  });

  it('snaps a triangle', () => {
    const r = tidyStroke(jitter(walk([[200, 60], [320, 260], [80, 260], [200, 60]]), 3));
    expect(r.kind).toBe('triangle');
    expect(r.points).toHaveLength(4);
  });
});

describe('everything else', () => {
  it('smooths a squiggle without snapping it', () => {
    const squiggle: Pt[] = Array.from({ length: 60 }, (_, i) => [i * 6, 100 + Math.sin(i / 3) * 40 + (i % 2)] as Pt);
    expect(tidyStroke(squiggle).kind).toBe('smooth');
  });
  it('leaves a dot or tiny stroke alone', () => {
    const dot: Pt[] = [[10, 10], [11, 10], [11, 11], [10, 11]];
    expect(tidyStroke(dot)).toEqual({ kind: 'smooth', points: dot });
  });
  it('ignores pressure values in raw points', () => {
    expect(tidyStroke(walk([[0, 0], [300, 3]]).map(([x, y]) => [x, y, 0.5])).kind).toBe('line');
  });
  it('respects config overrides', () => {
    expect(tidyStroke(walk([[0, 0], [300, 3]]), { straightRatio: 1.1 }).kind).toBe('smooth');
  });
});
