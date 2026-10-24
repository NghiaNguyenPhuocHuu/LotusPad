import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CURRENT_VERSION, FileTooNewError, PAGE_SIZES, createDocument, parseDocument, serializeDocument, type LotusPadDocument } from '../src';

const load = (name: string) => readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8');
const ok = (text: string): LotusPadDocument => {
  const r = parseDocument(text);
  if (r.status !== 'ok') throw new Error(JSON.stringify(r));
  return r.doc;
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('example files', () => {
  for (const name of readdirSync(new URL('../examples/', import.meta.url))) {
    it(`${name} parses and round-trips unchanged`, () => {
      const original = JSON.parse(load(name));
      const out = serializeDocument(ok(load(name)));
      expect(JSON.parse(out)).toEqual(original);
      expect(serializeDocument(ok(out))).toBe(out); // stable on a second pass
    });
  }

  it('keeps unknown fields', () => {
    expect(JSON.parse(serializeDocument(ok(load('full.lotuspad'))))).toHaveProperty('futureField.kept', true);
  });
});

describe('newer and broken files', () => {
  it('flags a newer version and refuses to write it', () => {
    const text = JSON.stringify({ ...JSON.parse(load('empty.lotuspad')), version: 99, surfaces: 'new shape' });
    const r = parseDocument(text);
    expect(r).toMatchObject({ status: 'newer', version: 99 });
    expect(() => serializeDocument({ ...ok(load('empty.lotuspad')), version: 99 })).toThrow(FileTooNewError);
  });

  it('rejects bad input with readable messages', () => {
    expect(parseDocument('{nope')).toMatchObject({ status: 'invalid' });
    expect(parseDocument('{"hello":1}')).toMatchObject({ status: 'invalid' });
    expect(parseDocument(JSON.stringify({ format: 'lotuspad', version: 0 }))).toMatchObject({ status: 'invalid' });
  });
});

describe('rules', () => {
  const base = () => clone(JSON.parse(load('full.lotuspad')));
  const errors = (d: unknown) => {
    const r = parseDocument(JSON.stringify(d));
    return r.status === 'invalid' ? r.errors.join('\n') : 'ok';
  };

  it('book pages need a size, boards must not have one', () => {
    const book = base(); book.surfaces[0].size = null;
    expect(errors(book)).toContain('fixed size');
    const board = base(); board.mode = 'board';
    expect(errors(board)).toContain('size null');
  });

  it('rejects duplicate ids and dangling references', () => {
    const dup = base(); dup.surfaces[0].objects[1].id = 't1';
    expect(errors(dup)).toContain('Duplicate id');
    const chart = base(); chart.surfaces[0].objects[2].rangeId = 'missing';
    expect(errors(chart)).toContain('missing range');
    const range = base(); range.ranges[0].source.end = 999;
    expect(errors(range)).toContain('outside the text');
  });
});

describe('createDocument', () => {
  it('makes a valid A4 book by default', () => {
    const doc = createDocument();
    expect(doc.version).toBe(CURRENT_VERSION);
    expect(doc.surfaces[0]?.size).toEqual(PAGE_SIZES.A4);
    expect(ok(serializeDocument(doc))).toEqual(doc);
  });
  it('makes a valid whiteboard', () => {
    const doc = createDocument({ mode: 'board' });
    expect(doc.surfaces[0]?.size).toBeNull();
    expect(ok(serializeDocument(doc)).mode).toBe('board');
  });
});
