export interface Stats {
  count: number;
  sum: number;
  average: number | null;
  min: number | null;
  max: number | null;
}

export function computeStats(values: readonly number[]): Stats {
  if (values.length === 0) return { count: 0, sum: 0, average: null, min: null, max: null };
  const sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, sum, average: sum / values.length, min: Math.min(...values), max: Math.max(...values) };
}
