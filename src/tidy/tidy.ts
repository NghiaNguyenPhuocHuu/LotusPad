export type Pt = [number, number];
export type ShapeKind = 'line' | 'rect' | 'ellipse' | 'triangle' | 'smooth';
export interface TidyResult {
  kind: ShapeKind;
  points: Pt[];
}

export interface TidyConfig {
  /** Strokes shorter than this (px) are left alone. */
  minLength: number;
  /** Closed shapes shorter than this are not snapped. */
  minClosedLength: number;
  /** chord / path length at or above this means a straight line. */
  straightRatio: number;
  /** Gap between start and end, as a share of path length, still treated as closed for polygons. */
  closeRatio: number;
  /** Larger gap allowed for ellipses, so a circle that does not quite meet still snaps. */
  ellipseGapRatio: number;
  /** Mean distance from the ellipse (relative to its size) allowed for an ellipse. */
  ellipseError: number;
  /** How far (degrees) a corner may be from 90 and still count as a rectangle corner. */
  angleTolerance: number;
  /** Lines and rectangles within this many degrees of the axes snap to the axes. */
  axisSnapDeg: number;
  /** Polygon simplification tolerance as a share of the shape's diagonal. */
  polygonEpsilon: number;
  /** Chaikin smoothing passes for free-form strokes. */
  smoothingPasses: number;
}

export const DEFAULT_TIDY_CONFIG: TidyConfig = {
  minLength: 25,
  minClosedLength: 80,
  straightRatio: 0.92,
  closeRatio: 0.2,
  ellipseGapRatio: 0.3,
  ellipseError: 0.09,
  angleTolerance: 20,
  axisSnapDeg: 8,
  polygonEpsilon: 0.08,
  smoothingPasses: 2
};

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deg = (r: number) => (r * 180) / Math.PI;

function pathLength(p: Pt[]): number {
  let total = 0;
  for (let i = 1; i < p.length; i++) total += dist(p[i - 1]!, p[i]!);
  return total;
}

export function chaikin(points: Pt[], passes: number): Pt[] {
  let p = points;
  for (let k = 0; k < passes && p.length > 2; k++) {
    const out: Pt[] = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!, b = p[i + 1]!;
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    out.push(p[p.length - 1]!);
    p = out;
  }
  return p;
}

function snapLine(a: Pt, b: Pt, axisSnapDeg: number): Pt[] {
  let [x1, y1] = a, [x2, y2] = b;
  const angle = Math.abs(deg(Math.atan2(y2 - y1, x2 - x1))) % 180;
  if (angle < axisSnapDeg || angle > 180 - axisSnapDeg) y1 = y2 = (y1 + y2) / 2;
  else if (Math.abs(angle - 90) < axisSnapDeg) x1 = x2 = (x1 + x2) / 2;
  return [[x1, y1], [x2, y2]];
}

function bounds(p: Pt[]) {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0 };
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}

/** Ramer-Douglas-Peucker. Works when the first and last points coincide (closed shapes). */
function simplify(p: Pt[], eps: number): Pt[] {
  if (p.length < 3) return p;
  const a = p[0]!, b = p[p.length - 1]!;
  let worst = 0, index = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = distToSegment(p[i]!, a, b);
    if (d > worst) { worst = d; index = i; }
  }
  if (worst <= eps) return [a, b];
  return [...simplify(p.slice(0, index + 1), eps).slice(0, -1), ...simplify(p.slice(index), eps)];
}

function detectEllipse(p: Pt[], c: TidyConfig): TidyResult | null {
  const { x0, y0, w, h } = bounds(p);
  if (w < 12 || h < 12) return null;
  const cx = x0 + w / 2, cy = y0 + h / 2;
  const error = p.reduce((s, q) => s + Math.abs(Math.hypot((q[0] - cx) / (w / 2), (q[1] - cy) / (h / 2)) - 1), 0) / p.length;
  if (error > c.ellipseError) return null;
  const out: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    out.push([cx + (w / 2) * Math.cos(t), cy + (h / 2) * Math.sin(t)]);
  }
  return { kind: 'ellipse', points: out };
}

function cornerAngle(prev: Pt, at: Pt, next: Pt): number {
  const a = Math.atan2(prev[1] - at[1], prev[0] - at[0]);
  const b = Math.atan2(next[1] - at[1], next[0] - at[0]);
  let d = Math.abs(deg(a - b)) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function detectPolygon(p: Pt[], c: TidyConfig): TidyResult | null {
  const { w, h } = bounds(p);
  const closed = [...p, p[0]!];
  const verts = simplify(closed, c.polygonEpsilon * Math.hypot(w, h)).slice(0, -1);

  if (verts.length === 3) return { kind: 'triangle', points: [...verts, verts[0]!] };
  if (verts.length !== 4) return null;

  const square = verts.every((v, i) => Math.abs(cornerAngle(verts[(i + 3) % 4]!, v, verts[(i + 1) % 4]!) - 90) <= c.angleTolerance);
  if (!square) return null;

  // Average edge direction folded into a quarter turn, so opposite and adjacent edges agree.
  let sin = 0, cos = 0;
  verts.forEach((v, i) => {
    const n = verts[(i + 1) % 4]!;
    const a = Math.atan2(n[1] - v[1], n[0] - v[0]);
    sin += Math.sin(4 * a);
    cos += Math.cos(4 * a);
  });
  let theta = Math.atan2(sin, cos) / 4;
  if (Math.abs(deg(theta)) < c.axisSnapDeg) theta = 0;

  const rot = (q: Pt, t: number): Pt => [q[0] * Math.cos(t) - q[1] * Math.sin(t), q[0] * Math.sin(t) + q[1] * Math.cos(t)];
  const local = p.map((q) => rot(q, -theta));
  const b = bounds(local);
  const corners: Pt[] = [[b.x0, b.y0], [b.x1, b.y0], [b.x1, b.y1], [b.x0, b.y1]].map((q) => rot(q as Pt, theta));
  return { kind: 'rect', points: [...corners, corners[0]!] };
}

/** Turns a hand-drawn stroke into a clean shape. Pure: same input, same output. */
export function tidyStroke(raw: readonly (readonly number[])[], config: Partial<TidyConfig> = {}): TidyResult {
  const c = { ...DEFAULT_TIDY_CONFIG, ...config };
  const p: Pt[] = raw.map((q) => [q[0]!, q[1]!]);
  if (p.length < 4) return { kind: 'smooth', points: p };

  const length = pathLength(p);
  if (length < c.minLength) return { kind: 'smooth', points: p };

  const first = p[0]!, last = p[p.length - 1]!;
  const gap = dist(first, last);

  if (gap / length >= c.straightRatio) return { kind: 'line', points: snapLine(first, last, c.axisSnapDeg) };

  if (length >= c.minClosedLength && gap <= c.ellipseGapRatio * length) {
    const ellipse = detectEllipse(p, c);
    if (ellipse) return ellipse;
    if (gap <= c.closeRatio * length) {
      const polygon = detectPolygon(p, c);
      if (polygon) return polygon;
    }
  }
  return { kind: 'smooth', points: chaikin(p, c.smoothingPasses) };
}
