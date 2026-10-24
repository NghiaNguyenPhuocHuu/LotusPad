# LotusPad file format (version 1)

A LotusPad note is one UTF-8 JSON file with the extension `.lotuspad`. The rules below are enforced by `src/format/schema.ts`; the three files in `examples/` are valid samples.

## Layout

```json
{
  "format": "lotuspad",
  "version": 1,
  "id": "uuid",
  "title": "Sales sketch",
  "created": "2026-10-23T10:00:00Z",
  "modified": "2026-10-23T10:30:00Z",
  "mode": "book",
  "surfaces": [ { "id": "page-1", "size": [794, 1123], "background": "grid", "objects": [ ... ] } ],
  "ranges": [ { "id": "r1", "surfaceId": "page-1", "source": { "type": "text", "objectId": "t1", "start": 14, "end": 29 } } ]
}
```

## Modes and surfaces

| | `book` | `board` |
|---|---|---|
| Surfaces | one or more pages | exactly one |
| `size` | `[width, height]`, required | `null` (no edge) |

Units are px at 96 per inch. `background` is `blank`, `ruled`, `grid` or `dots`. Page order is array order.

## Objects

Every object has a unique `id` and a `type`. Positions are in surface coordinates.

- **stroke**: `color` (`"ink"` follows the theme, otherwise a CSS color), `width`, `raw` (`[x, y]` or `[x, y, pressure]`, never overwritten) and an optional `tidy` (`kind` is `line`, `rect`, `ellipse`, `triangle` or `smooth`, plus `points`). Keeping `raw` makes tidy reversible and lets a better tidy engine re-run later.
- **text**: `x`, `y`, `width`, `text`.
- **chart**: `x`, `y`, `width`, `height`, `chartType` (`bar`, `line`, `pie`) and `rangeId`.

## Ranges

A range says where chart data comes from. `source` is either a `text` span (`objectId`, character offsets `start` to `end`) or a `rect` on the surface (`x`, `y`, `width`, `height`). A text range must point at a text object on the same surface, with offsets inside its text. A chart must point at a range that exists.

## Versioning

- `version` is an integer. This spec is version 1.
- Older file: migrated step by step in memory (`MIGRATIONS` in `src/format/document.ts`).
- Newer file: opened read-only (`status: "newer"`). `serializeDocument` refuses to write it, so an older app can never damage a newer file.
- Unknown extra fields are kept and written back.
- Changing the meaning of a field, or removing one, needs a new version and a migration. Adding an optional field does not.
