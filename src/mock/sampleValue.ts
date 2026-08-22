/**
 * The one owner of mock-seed value synthesis.
 *
 * Five synthesizers used to hold four different policies on a field's declared
 * `default`, so the same entity seeded differently depending on which path
 * rendered it. This module is the single policy; callers supply only entropy.
 *
 * @packageDocumentation
 */

import type {
  ArrayEntityField,
  EntityField,
  ObjectEntityField,
  RelationEntityField,
} from '../types/field.js';
import type { EntityPersistence, EntityRow, FieldValue } from '../types/entity.js';
import { isFieldValue } from '../types/entity.js';
import {
  randomBoolean,
  randomEmail,
  randomInt,
  randomPhone,
  randomStraddlingDate,
  randomUrl,
  randomUuid,
  randomWords,
} from './random.js';

/**
 * Entropy source. `'seeded'` draws from the shared LCG — stateful and
 * order-dependent, so a value depends on how many draws earlier rows consumed.
 * `'index'` is a pure function of `(field, index)`, which is the only strategy
 * Rust can reproduce and therefore the one parity is asserted on.
 */
export type SampleStrategy = 'seeded' | 'index';

/** Recursion cap for self-referential `items` / `properties` walks. */
const MAX_NESTED_DEPTH = 3;

/** Keys never synthesized — the caller's row loop owns them. */
const RESERVED_FIELD_NAMES: ReadonlySet<string> = new Set(['id', 'createdAt', 'updatedAt']);

export interface SampleEntity {
  readonly name: string;
  readonly persistence?: EntityPersistence;
  readonly fields: readonly EntityField[];
}

export interface SampleContext {
  readonly entityName: string;
  /** 1-based row ordinal. Row 1 always yields `values[0]`. */
  readonly index: number;
  readonly strategy: SampleStrategy;
  /** Declared persistence of the OWNING entity; undefined means persistent. */
  readonly persistence?: EntityPersistence;
  readonly depth?: number;
}

/**
 * Image-bearing field names that still resolve to a real photo.
 *
 * A stopgap, kept verbatim from the two copies it replaces: no entity field in
 * the corpus can express an image type yet, and 470 string fields are named
 * this way, so deleting it would render broken `<img>` corpus-wide. Retire it
 * once a real `image` type exists — not before.
 */
export const IMAGE_FIELD_NAMES: ReadonlySet<string> = new Set([
  'image', 'imageurl', 'image_url',
  'photo', 'photourl', 'photo_url',
  'avatar', 'avatarurl', 'avatar_url',
  'thumbnail', 'thumbnailurl', 'thumbnail_url',
  'picture', 'pictureurl',
  'cover', 'coverurl',
  'banner', 'bannerurl',
]);

/** Deterministic stock-photo URL; the same entity+field renders the same image. */
export function sampleImageUrl(
  entityName: string,
  fieldName: string,
  ctx: SampleContext,
  width = 400,
  height = 400,
): string {
  const salt = ctx.strategy === 'seeded' ? randomInt({ min: 0, max: 1000 }) : ctx.index;
  const seed = `${entityName}-${fieldName}-${salt}`;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

/** `targetType` / `target_type` -> `Target Type`, for readable sample text. */
function titleCase(name: string): string {
  const spaced = name
    .split('')
    .flatMap((c) => (c === '_' || c === '-' ? [' '] : c === c.toUpperCase() && c !== c.toLowerCase() ? [' ', c] : [c]))
    .join('');
  return spaced
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Lowercase, punctuation-free fragment safe to embed in an email or URL. */
function slug(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'value';
}

/** A deterministic, validator-satisfying UUID for the pure-index strategy. */
function indexUuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0').slice(-12)}`;
}

/** The closed vocabulary a field declares, if any. */
function declaredValues(field: EntityField): readonly string[] | undefined {
  const values = 'values' in field ? field.values : undefined;
  return values && values.length > 0 ? values : undefined;
}

/**
 * Is `field.default` a value the synthesizer must return verbatim?
 *
 * Exported so codegen and tests share the one predicate rather than restating it.
 */
export function isDeclaredDefaultHonored(field: EntityField): boolean {
  const value = field.default;
  if (value === undefined || value === null) return false;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return true;
  if (typeof value === 'object') return true;
  if (typeof value !== 'string') return false;

  const values = declaredValues(field);
  // Gate 3: '' is a placeholder unless the field's own vocabulary declares it.
  if (value === '') return values !== undefined && values.includes('');
  // A default on a closed vocabulary of a collection is a new-record default,
  // not a claim about existing rows — so the row cycle wins over it.
  return values === undefined;
}

/** Rows to synthesize. A `[runtime]` entity is a per-orbital singleton. */
export function sampleRowCount(entity: SampleEntity, requested: number): number {
  return entity.persistence === 'runtime' ? 1 : requested;
}

function sampleText(field: EntityField, ctx: SampleContext): string {
  const fieldName = field.name ?? 'field';
  if (IMAGE_FIELD_NAMES.has(fieldName.toLowerCase())) {
    return sampleImageUrl(ctx.entityName, fieldName, ctx);
  }
  // Seeded strings are display text (titles, names, labels) — title-case
  // them so a seeded record reads "Harbor Summit", not "harbor summit".
  return ctx.strategy === 'seeded'
    ? titleCase(randomWords(2))
    : `${titleCase(fieldName)} ${ctx.index}`;
}

function sampleDate(ctx: SampleContext, dateOnly: boolean): string {
  if (ctx.strategy === 'index') {
    const month = String((ctx.index % 12) + 1).padStart(2, '0');
    return dateOnly ? `2026-${month}-15` : `2026-${month}-15T00:00:00.000Z`;
  }
  const iso = randomStraddlingDate({ days: 15 }).toISOString();
  return dateOnly ? iso.split('T')[0]! : iso;
}

function sampleRelation(field: RelationEntityField): FieldValue {
  // Placeholder; the caller's post-pass links real sibling ids.
  return field.relation?.cardinality === 'one' ? '' : [];
}

function sampleArray(field: ArrayEntityField, ctx: SampleContext): FieldValue {
  const depth = ctx.depth ?? 0;
  if (!field.items || depth >= MAX_NESTED_DEPTH) return [];
  const count = ctx.strategy === 'seeded' ? randomInt({ min: 3, max: 5 }) : 3;
  const elementName = field.name ?? 'item';
  const out: FieldValue[] = [];
  for (let i = 0; i < count; i++) {
    const element: EntityField = { ...field.items, name: `${elementName}[${i}]` };
    out.push(
      sampleFieldValue(element, {
        ...ctx,
        index: ctx.index * 10 + i,
        depth: depth + 1,
      }) ?? null,
    );
  }
  return out;
}

function sampleObject(field: ObjectEntityField, ctx: SampleContext): FieldValue {
  const depth = ctx.depth ?? 0;
  if (!field.properties || depth >= MAX_NESTED_DEPTH) return null;
  const out: Record<string, FieldValue> = {};
  for (const [propName, propField] of Object.entries(field.properties)) {
    const child: EntityField = { ...propField, name: propName };
    out[propName] = sampleFieldValue(child, { ...ctx, depth: depth + 1 }) ?? null;
  }
  return out;
}

/**
 * One sample value for one field. `undefined` means OMIT the key.
 *
 * Order matters — see the three gates in the plan. Gates 1 and 2 read declared
 * schema properties (`persistence`, `intrinsic`), never field names.
 */
export function sampleFieldValue(field: EntityField, ctx: SampleContext): FieldValue | undefined {
  const honoredDefault =
    field.default !== undefined && isFieldValue(field.default) ? field.default : undefined;

  // Gate 2: the owning trait computes this, so the data layer must not write it.
  if (field.intrinsic === true) return honoredDefault;

  // Gate 1: a runtime singleton's seeded row must equal its declared-defaults
  // projection, or persistence disagrees with the default layer in the @entity
  // merge and boots the machine into the wrong state.
  const isRuntime = ctx.persistence === 'runtime';
  if (isRuntime && honoredDefault !== undefined) return honoredDefault;

  if (!isRuntime && isDeclaredDefaultHonored(field) && honoredDefault !== undefined) {
    return honoredDefault;
  }

  const values = declaredValues(field);
  if (values) {
    // Row 1 yields values[0], which is the declared default for 85% of fields.
    const ordinal = isRuntime ? 1 : ctx.index;
    return values[(ordinal - 1) % values.length]!;
  }

  switch (field.type) {
    case 'string':
      return sampleText(field, ctx);
    // Semantic domains synthesize a value that SATISFIES their own validator —
    // the property that keeps the seeder and the validator from drifting.
    case 'email':
      return ctx.strategy === 'seeded'
        ? randomEmail()
        : `${slug(field.name ?? 'user')}${ctx.index}@example.com`;
    case 'url':
      return ctx.strategy === 'seeded'
        ? randomUrl()
        : `https://example.com/${slug(field.name ?? 'link')}/${ctx.index}`;
    case 'phone':
      return ctx.strategy === 'seeded'
        ? randomPhone()
        : `+1-555-${String(1000 + (ctx.index % 9000)).padStart(4, '0')}`;
    case 'uuid':
      return ctx.strategy === 'seeded' ? randomUuid() : indexUuid(ctx.index);
    case 'image':
      return sampleImageUrl(ctx.entityName, field.name ?? 'image', ctx);
    case 'number': {
      // A declared range constrains the value; an UNdeclared one must not, or
      // the index ladder silently flattens once it passes an invented ceiling.
      // Seeded fallback floors at 1 (declared min still wins): all-zero
      // counts/metrics made every mock-seeded page read as broken data.
      if (ctx.strategy === 'seeded') {
        return randomInt({ min: field.min ?? 1, max: field.max ?? 250 });
      }
      const stepped = (field.min ?? 0) + ctx.index * 10;
      return field.max !== undefined && stepped > field.max ? field.max : stepped;
    }
    // Money is numeric at rest — same sampling as `number` (index strategy
    // mirrors the Rust seeder for the shared parity fixture). Seeded fallback
    // avoids $0.00 amounts for the same reason as `number`.
    case 'money': {
      if (ctx.strategy === 'seeded') {
        return randomInt({ min: field.min ?? 10, max: field.max ?? 900 });
      }
      const steppedMoney = (field.min ?? 0) + ctx.index * 10;
      return field.max !== undefined && steppedMoney > field.max ? field.max : steppedMoney;
    }
    // File seeds the canonical struct value (satisfies isFileValue) —
    // mirrors the Rust seeder's FieldType::File arm byte-for-byte.
    case 'file': {
      const base = slug(field.name ?? 'file');
      return {
        name: `${base}-${ctx.index}.pdf`,
        url: `https://example.com/files/${base}/${ctx.index}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: ctx.index * 1024,
      };
    }
    case 'boolean':
      return ctx.strategy === 'seeded' ? randomBoolean() : ctx.index % 2 === 0;
    case 'date':
      return sampleDate(ctx, true);
    case 'timestamp':
    case 'datetime':
      return sampleDate(ctx, false);
    case 'enum':
      // Reached only when the enum declares no values — a malformed field.
      return null;
    case 'relation':
      return sampleRelation(field);
    case 'array':
      return sampleArray(field, ctx);
    case 'object':
      return sampleObject(field, ctx);
    case 'trait':
    case 'slot':
    case 'pattern':
    // Renderable content is computed by the owning trait's effects, never
    // seeded — same no-sample treatment as the config-only reference types.
    case 'node':
      return undefined;
    default:
      return sampleText(field, ctx);
  }
}

/** One row. Reserved keys are left to the caller. */
export function sampleRow(
  entity: SampleEntity,
  ctx: Omit<SampleContext, 'entityName' | 'depth'>,
): EntityRow {
  const row: EntityRow = {};
  for (const field of entity.fields) {
    const name = field.name;
    if (!name || RESERVED_FIELD_NAMES.has(name)) continue;
    const value = sampleFieldValue(field, {
      ...ctx,
      entityName: entity.name,
      persistence: ctx.persistence ?? entity.persistence,
    });
    if (value !== undefined) row[name] = value;
  }
  return row;
}

/** `count` rows, 1-based, honoring the runtime-singleton gate. */
export function sampleRows(
  entity: SampleEntity,
  count: number,
  strategy: SampleStrategy,
): EntityRow[] {
  const rowCount = sampleRowCount(entity, count);
  const rows: EntityRow[] = [];
  for (let i = 1; i <= rowCount; i++) {
    rows.push(sampleRow(entity, { index: i, strategy, persistence: entity.persistence }));
  }
  return rows;
}
