import { describe, expect, it } from 'vitest';
import { computeStats, layoutChart, niceScale, parseNumbers, parseRange } from '../src';

describe('parseNumbers', () => {
  it('reads label and trailing number', () => {
    expect(parseNumbers('Jan 120\nFeb 150')).toEqual([{ label: 'Jan', value: 120, line: 0 }, { label: 'Feb', value: 150, line: 1 }]);
  });
  it('handles colons, negatives, thousands separators and decimals', () => {
    const rows = parseNumbers('Rent: -1,200.50\nTips = 3.5\nRefund - 40');
    expect(rows.map((r) => [r.label, r.value])).toEqual([['Rent', -1200.5], ['Tips', 3.5], ['Refund', 40]]);
  });
  it('handles percentages, currency and accounting negatives', () => {
    const rows = parseNumbers('Growth 12%\nPrice $1,200\nLoss (45)\nCost -$5');
    expect(rows.map((r) => r.value)).toEqual([12, 1200, -45, -5]);
    expect(rows[0]?.unit).toBe('%');
  });
  it('uses the last number, so a date inside a label is not the value', () => {
    expect(parseNumbers('Q1 2026 120')[0]).toMatchObject({ label: 'Q1 2026', value: 120 });
    expect(parseNumbers('Q1 2026')).toEqual([]);
    expect(parseNumbers('Jan 2026')).toEqual([]);
    expect(parseNumbers('Revenue 2026')[0]?.value).toBe(2026); // a plain label with a year-sized number is still data
  });
  it('skips blank lines and lines with no number, and names unlabeled rows', () => {
    const rows = parseNumbers('Title\n\n42\nnotes here');
    expect(rows).toEqual([{ label: 'Row 1', value: 42, line: 2 }]);
  });
  it('does not treat a hyphen inside a word as a minus sign', () => {
    expect(parseNumbers('Route-66 10')[0]).toMatchObject({ label: 'Route-66', value: 10 });
  });
});

describe('parseRange', () => {
  const text = 'Title\nJan 10\nFeb 20\nMar 30\nend';
  it('parses only the selected lines and keeps real line numbers', () => {
    const start = text.indexOf('Feb'), end = text.indexOf('Mar') + 2;
    expect(parseRange(text, start + 1, end).map((r) => [r.label, r.line])).toEqual([['Feb', 2], ['Mar', 3]]);
  });
});

describe('computeStats', () => {
  it('summarises values', () => expect(computeStats([2, 4, 9])).toEqual({ count: 3, sum: 15, average: 5, min: 2, max: 9 }));
  it('handles no data', () => expect(computeStats([])).toEqual({ count: 0, sum: 0, average: null, min: null, max: null }));
});

describe('niceScale', () => {
  it('rounds to friendly limits', () => {
    const s = niceScale(0, 97);
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(97);
    expect(s.ticks).toContain(s.max);
  });
  it('copes with equal and zero values', () => {
    expect(niceScale(5, 5).max).toBeGreaterThan(niceScale(5, 5).min);
    expect(niceScale(0, 0).max).toBe(1);
  });
});

describe('layoutChart', () => {
  const W = 600, H = 320;
  const inside = (x: number, y: number, p: { x: number; y: number; width: number; height: number }) => x >= p.x - 0.01 && x <= p.x + p.width + 0.01 && y >= p.y - 0.01 && y <= p.y + p.height + 0.01;

  it('returns empty for no rows', () => expect(layoutChart([], 'bar', W, H)).toEqual({ kind: 'empty' }));

  it('keeps every bar inside the plot area, including negatives', () => {
    const l = layoutChart([{ label: 'a', value: 120 }, { label: 'b', value: -40 }, { label: 'c', value: 0 }], 'bar', W, H);
    if (l.kind !== 'bar') throw new Error('wrong kind');
    for (const b of l.bars) {
      expect(inside(b.x, b.y, l.plot)).toBe(true);
      expect(inside(b.x + b.width, b.y + b.height, l.plot)).toBe(true);
    }
    expect(l.bars[0]!.y + l.bars[0]!.height).toBeCloseTo(l.baselineY); // positive bar sits on the baseline
    expect(l.bars[1]!.y).toBeCloseTo(l.baselineY); // negative bar hangs from it
  });

  it('works when every value is negative or there is one value', () => {
    for (const rows of [[{ label: 'a', value: -5 }, { label: 'b', value: -9 }], [{ label: 'only', value: 7 }]]) {
      const l = layoutChart(rows, 'bar', W, H);
      if (l.kind !== 'bar') throw new Error('wrong kind');
      l.bars.forEach((b) => expect(Number.isFinite(b.y) && b.height >= 0).toBe(true));
    }
  });

  it('places line points left to right inside the plot', () => {
    const l = layoutChart([{ label: 'a', value: 1 }, { label: 'b', value: 3 }, { label: 'c', value: 2 }], 'line', W, H);
    if (l.kind !== 'line') throw new Error('wrong kind');
    expect(l.points[0]!.x).toBeLessThan(l.points[2]!.x);
    l.points.forEach((p) => expect(inside(p.x, p.y, l.plot)).toBe(true));
  });

  it('builds pie slices that add up to a full circle', () => {
    const l = layoutChart([{ label: 'a', value: 1 }, { label: 'b', value: 3 }], 'pie', W, H);
    if (l.kind !== 'pie') throw new Error('wrong kind');
    expect(l.slices.reduce((s, x) => s + x.fraction, 0)).toBeCloseTo(1);
    expect(l.slices[1]!.endAngle - l.slices[0]!.startAngle).toBeCloseTo(Math.PI * 2);
  });

  it('does not divide by zero when pie values are all zero', () => {
    const l = layoutChart([{ label: 'a', value: 0 }], 'pie', W, H);
    if (l.kind !== 'pie') throw new Error('wrong kind');
    expect(l.slices[0]!.fraction).toBe(0);
  });
});
