import { z } from 'zod';

export const FORMAT_NAME = 'lotuspad';
export const CURRENT_VERSION = 1;

const id = z.string().min(1);
const num = z.number().finite();
const size = z.number().positive().finite();
const point = z.tuple([num, num]);
const rawPoint = z.union([z.tuple([num, num]), z.tuple([num, num, num])]); // x, y, optional pressure 0..1

export const TIDY_KINDS = ['line', 'rect', 'ellipse', 'triangle', 'smooth'] as const;
export const CHART_TYPES = ['bar', 'line', 'pie'] as const;
export const BACKGROUNDS = ['blank', 'ruled', 'grid', 'dots'] as const;

// looseObject keeps unknown fields so a newer-minor writer's data survives a round trip.
export const StrokeSchema = z.looseObject({
  type: z.literal('stroke'),
  id,
  color: z.string().min(1), // "ink" (theme text color) or a CSS hex color
  width: size,
  raw: z.array(rawPoint).min(1), // what the user drew; never overwritten
  tidy: z.looseObject({ kind: z.enum(TIDY_KINDS), points: z.array(point).min(1) }).optional()
});

export const TextBlockSchema = z.looseObject({
  type: z.literal('text'),
  id,
  x: num,
  y: num,
  width: size,
  text: z.string()
});

export const ChartSchema = z.looseObject({
  type: z.literal('chart'),
  id,
  x: num,
  y: num,
  width: size,
  height: size,
  rangeId: id,
  chartType: z.enum(CHART_TYPES)
});

export const ObjectSchema = z.discriminatedUnion('type', [StrokeSchema, TextBlockSchema, ChartSchema]);

export const RangeSchema = z.looseObject({
  id,
  surfaceId: id,
  source: z.discriminatedUnion('type', [
    z.looseObject({ type: z.literal('text'), objectId: id, start: z.int().min(0), end: z.int().min(0) }),
    z.looseObject({ type: z.literal('rect'), x: num, y: num, width: size, height: size })
  ])
});

export const SurfaceSchema = z.looseObject({
  id,
  size: z.tuple([size, size]).nullable(), // [width, height] in px (1/96 inch); null = unbounded (board)
  background: z.enum(BACKGROUNDS),
  objects: z.array(ObjectSchema)
});

export const DocumentSchema = z
  .looseObject({
    format: z.literal(FORMAT_NAME),
    version: z.int().min(1),
    id,
    title: z.string(),
    created: z.iso.datetime({ offset: true }),
    modified: z.iso.datetime({ offset: true }),
    mode: z.enum(['book', 'board']),
    surfaces: z.array(SurfaceSchema),
    ranges: z.array(RangeSchema)
  })
  .superRefine((doc, ctx) => {
    const fail = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: 'custom', message, path });

    if (doc.mode === 'book') {
      if (doc.surfaces.length < 1) fail('A book needs at least one page', ['surfaces']);
      doc.surfaces.forEach((s, i) => s.size === null && fail('Book pages need a fixed size', ['surfaces', i, 'size']));
    } else {
      if (doc.surfaces.length !== 1) fail('A board has exactly one surface', ['surfaces']);
      doc.surfaces.forEach((s, i) => s.size !== null && fail('A board surface must have size null', ['surfaces', i, 'size']));
    }

    const seen = new Set<string>();
    const claim = (value: string, path: (string | number)[]) => {
      if (seen.has(value)) fail(`Duplicate id "${value}"`, path);
      seen.add(value);
    };
    doc.surfaces.forEach((s, i) => {
      claim(s.id, ['surfaces', i, 'id']);
      s.objects.forEach((o, j) => claim(o.id, ['surfaces', i, 'objects', j, 'id']));
    });
    doc.ranges.forEach((r, i) => claim(r.id, ['ranges', i, 'id']));

    const rangeIds = new Set(doc.ranges.map((r) => r.id));
    doc.surfaces.forEach((s, i) =>
      s.objects.forEach((o, j) => {
        if (o.type === 'chart' && !rangeIds.has(o.rangeId)) fail(`Chart points at missing range "${o.rangeId}"`, ['surfaces', i, 'objects', j, 'rangeId']);
      })
    );
    doc.ranges.forEach((r, i) => {
      const surface = doc.surfaces.find((s) => s.id === r.surfaceId);
      if (!surface) return fail(`Range points at missing surface "${r.surfaceId}"`, ['ranges', i, 'surfaceId']);
      if (r.source.type === 'text') {
        const src = r.source;
        const target = surface.objects.find((o) => o.id === src.objectId);
        if (!target || target.type !== 'text') fail(`Range needs a text block "${src.objectId}" on its surface`, ['ranges', i, 'source', 'objectId']);
        else if (src.end < src.start || src.end > target.text.length) fail('Range offsets are outside the text', ['ranges', i, 'source']);
      }
    });
  });

export type Stroke = z.infer<typeof StrokeSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type Chart = z.infer<typeof ChartSchema>;
export type LotusPadObject = z.infer<typeof ObjectSchema>;
export type Range = z.infer<typeof RangeSchema>;
export type Surface = z.infer<typeof SurfaceSchema>;
export type LotusPadDocument = z.infer<typeof DocumentSchema>;
