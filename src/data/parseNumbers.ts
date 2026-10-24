export interface Row {
  label: string;
  value: number;
  /** Zero-based line number in the source text. */
  line: number;
  /** "%" when the number had a percent sign. */
  unit?: '%';
}

const MONTH_OR_QUARTER = /^(q[1-4]|jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)$/i;

// A number at the very end of a line: optional sign attached to the number (a spaced dash is a separator), currency, thousands commas, decimals, percent, or (accounting) parentheses.
const TAIL = /(?<![A-Za-z0-9.])(\(?)\s*([-\u2212]?)(?:[$\u20AC\u00A3\u00A5]\s*)?([-\u2212]?)(\d[\d,]*(?:\.\d+)?)\s*(%?)\s*(\)?)\s*$/;

/** Reads "label value" rows from free text. Lines without a trailing number are skipped. */
export function parseNumbers(text: string): Row[] {
  const rows: Row[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const m = TAIL.exec(line);
    if (!m) return;
    const [, open, signA, signB, digits, percent, close] = m;
    const number = Number((digits ?? '').replace(/,/g, ''));
    if (!Number.isFinite(number)) return;

    const label = line.slice(0, m.index).replace(/[\s:=,\-\u2013]+$/, '').trim();
    const isYear = /^\d{4}$/.test(digits ?? '') && number >= 1900 && number <= 2100;
    const lastWord = label.split(/\s+/).pop() ?? '';
    if (isYear && (label === '' || MONTH_OR_QUARTER.test(lastWord))) return; // "Q1 2026", "Jan 2026": a date, not data

    const negative = Boolean(signA || signB) || (open === '(' && close === ')');
    const row: Row = { label: label || `Row ${rows.length + 1}`, value: negative ? -number : number, line: index };
    if (percent) row.unit = '%';
    rows.push(row);
  });
  return rows;
}

/** Same as parseNumbers, for a character range of a larger text (a user's selection). Partial lines count whole. */
export function parseRange(text: string, start: number, end: number): Row[] {
  const from = text.lastIndexOf('\n', Math.max(0, start) - 1) + 1;
  const nl = text.indexOf('\n', end);
  const to = nl === -1 ? text.length : nl;
  const firstLine = text.slice(0, from).split('\n').length - 1;
  return parseNumbers(text.slice(from, to)).map((r) => ({ ...r, line: r.line + firstLine }));
}
