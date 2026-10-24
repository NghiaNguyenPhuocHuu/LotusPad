import { CURRENT_VERSION, DocumentSchema, FORMAT_NAME, type LotusPadDocument, type Surface } from './schema';

/** Page sizes in px at 96 per inch. */
export const PAGE_SIZES = {
  A4: [794, 1123],
  Letter: [816, 1056],
  A5: [559, 794]
} as const satisfies Record<string, readonly [number, number]>;

export type ParseResult =
  | { status: 'ok'; doc: LotusPadDocument }
  | { status: 'newer'; version: number; raw: unknown } // written by a newer LotusPad: show read-only, never save over it
  | { status: 'invalid'; errors: string[] };

export class FileTooNewError extends Error {
  constructor(version: number) {
    super(`This file uses format version ${version}, but this app supports up to ${CURRENT_VERSION}. Update LotusPad to edit it.`);
    this.name = 'FileTooNewError';
  }
}

/** Upgrades a document from version n to n+1. Add an entry here whenever CURRENT_VERSION increases. */
const MIGRATIONS: Record<number, (doc: Record<string, unknown>) => Record<string, unknown>> = {};

export function parseDocument(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { status: 'invalid', errors: ['The file is not valid JSON'] };
  }
  if (typeof raw !== 'object' || raw === null || (raw as { format?: unknown }).format !== FORMAT_NAME) {
    return { status: 'invalid', errors: ['This is not a LotusPad file'] };
  }
  let current = raw as Record<string, unknown>;
  const version = current.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { status: 'invalid', errors: ['The file has no valid version number'] };
  }
  if (version > CURRENT_VERSION) return { status: 'newer', version, raw };

  for (let v = version; v < CURRENT_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return { status: 'invalid', errors: [`No migration from version ${v}`] };
    current = { ...migrate(current), version: v + 1 };
  }
  const result = DocumentSchema.safeParse(current);
  if (!result.success) {
    return { status: 'invalid', errors: result.error.issues.map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`) };
  }
  return { status: 'ok', doc: result.data };
}

/** Validates, then writes pretty JSON. Refuses documents from a newer version so nothing is lost. */
export function serializeDocument(doc: LotusPadDocument): string {
  if (doc.version > CURRENT_VERSION) throw new FileTooNewError(doc.version);
  const checked = DocumentSchema.parse(doc);
  return JSON.stringify(checked, null, 2) + '\n';
}

export interface CreateOptions {
  mode?: 'book' | 'board';
  title?: string;
  pageSize?: readonly [number, number];
  now?: Date;
  newId?: () => string;
}

export function createDocument(options: CreateOptions = {}): LotusPadDocument {
  const { mode = 'book', title = 'Untitled', pageSize = PAGE_SIZES.A4, now = new Date(), newId = () => crypto.randomUUID() } = options;
  const stamp = now.toISOString();
  const surface: Surface = {
    id: newId(),
    size: mode === 'book' ? [pageSize[0], pageSize[1]] : null,
    background: mode === 'book' ? 'ruled' : 'dots',
    objects: []
  };
  return { format: FORMAT_NAME, version: CURRENT_VERSION, id: newId(), title, created: stamp, modified: stamp, mode, surfaces: [surface], ranges: [] };
}
