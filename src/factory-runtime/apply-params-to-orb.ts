/**
 * `applyParamsToOrb` — pure runtime overlay function. Equivalent to the body
 * the std-ts codegen emits inline for every std factory, lifted out so that:
 *   1. team-published behaviors (Firestore-stored) can dispatch through the
 *      same overlay as std behaviors;
 *   2. std factories can collapse to one-line wrappers calling this function.
 *
 * Reference: `docs/Almadar_Studio_SDK.md` §7.4.2.
 *
 * Pure data → data. No I/O.
 *
 * @packageDocumentation
 */

import type {
  Effect,
  Entity,
  EntityField,
  Expression,
  OrbitalDefinition,
  OrbitalEntity,
  OrbitalSchema,
  PageRefObject,
  SExpr,
  CallSiteConfig,
  CallSiteConfigEntry,
  Trait,
  TraitEventContract,
  TraitEventListener,
  TraitReference,
  TraitTick,
} from '../types/index.js';
import { isCallSiteConfigDeclaration, persistenceModeAllowsOverrides } from '../types/index.js';
import type {
  MakePageRefOpts,
  MakeTraitRefOpts,
} from '../builders.js';
import {
  makeOrbitalWithUses,
  makePageRef,
  makeTraitRef,
} from '../builders.js';
import type { OrbitalParamsManifest } from './manifest-types.js';
import type {
  OrbitalFactoryParams,
  OrbitalTraitOverride,
  ParamValidationResult,
} from './types.js';

/**
 * Structural validation of caller-supplied params against the manifest.
 * Rejects unknown top-level keys and unknown `traitOverrides` keys (the
 * latter against the manifest's `traitNames` allow-list).
 */
export function validateOrbitalFactoryParams(
  manifest: OrbitalParamsManifest,
  raw: object,
): ParamValidationResult {
  if (raw === null || Array.isArray(raw)) {
    return {
      ok: false,
      error: { kind: 'not-object', received: Array.isArray(raw) ? 'array' : 'null' },
    };
  }

  const ALLOWED_KEYS = new Set<string>(manifest.paramFields.map((f) => f.name));
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_KEYS.has(key)) {
      return { ok: false, error: { kind: 'unknown-key', key } };
    }
  }

  const candidate = raw as OrbitalFactoryParams;
  if (candidate.traitOverrides !== undefined) {
    const to = candidate.traitOverrides;
    if (to === null || typeof to !== 'object' || Array.isArray(to)) {
      return {
        ok: false,
        error: {
          kind: 'trait-overrides-not-object',
          received: Array.isArray(to) ? 'array' : typeof to,
        },
      };
    }
    const allowed = new Set<string>(manifest.traitNames);
    for (const traitName of Object.keys(to)) {
      if (!allowed.has(traitName)) {
        return {
          ok: false,
          error: {
            kind: 'unknown-trait-override',
            trait: traitName,
            allowed: manifest.traitNames,
          },
        };
      }
    }
  }

  return { ok: true, params: candidate };
}

interface OverlayContext {
  readonly canonicalEntityName: string;
  readonly canonicalEntity: OrbitalEntity;
}

function assertResolvedEntity(
  entity: OrbitalSchema['orbitals'][number]['entity'],
  orbitalName: string,
  orbName: string,
): OrbitalEntity {
  if (typeof entity === 'string') {
    throw new Error(
      `applyParamsToOrb: orbital "${orbitalName}" in orb "${orbName}" has an unresolved entity reference (string form). Pass a resolved .orb.`,
    );
  }
  if ('extends' in entity) {
    throw new Error(
      `applyParamsToOrb: orbital "${orbitalName}" in orb "${orbName}" has an unresolved EntityCall ("extends" form). Pass a resolved .orb.`,
    );
  }
  return entity;
}

function findOrbitalOrThrow(
  orb: OrbitalSchema,
  orbitalName: string,
): OrbitalSchema['orbitals'][number] {
  const orbital = orb.orbitals.find((o) => o.name === orbitalName);
  if (!orbital) {
    throw new Error(
      `applyParamsToOrb: orbital "${orbitalName}" not found in orb "${orb.name}". Available: ${orb.orbitals
        .map((o) => o.name)
        .join(', ')}`,
    );
  }
  return orbital;
}

function buildEntity(
  ctx: OverlayContext,
  effectiveName: string,
  effectiveCollection: string | undefined,
  params: OrbitalFactoryParams,
): Entity {
  const canonicalFields: readonly EntityField[] = Array.isArray(ctx.canonicalEntity.fields)
    ? ctx.canonicalEntity.fields
    : [];

  const extras: readonly EntityField[] = params.fields ?? [];

  for (const f of extras) {
    if (f.type === 'enum') {
      if (!Array.isArray(f.values) || f.values.length === 0) {
        throw new Error(
          `Field "${f.name ?? '<unnamed>'}" (type: "enum") requires a non-empty \`values: string[]\` array. ` +
            `Got: ${f.values === undefined ? 'undefined' : JSON.stringify(f.values)}.`,
        );
      }
    }
    if (f.type === 'relation') {
      const rel = f.relation;
      if (!rel || typeof rel.entity !== 'string' || rel.entity.length === 0) {
        throw new Error(
          `Field "${f.name ?? '<unnamed>'}" (type: "relation") requires \`relation: { entity: <EntityName>, cardinality: "one" | "many" }\`. ` +
            `Got: ${rel === undefined ? 'undefined' : JSON.stringify(rel)}.`,
        );
      }
      if (rel.cardinality !== 'one' && rel.cardinality !== 'many') {
        throw new Error(
          `Field "${f.name ?? '<unnamed>'}" (type: "relation") requires \`relation.cardinality: "one" | "many"\`. ` +
            `Got: ${rel.cardinality === undefined ? 'undefined' : JSON.stringify(rel.cardinality)}.`,
        );
      }
    }
  }

  let mergedFields: readonly EntityField[];
  if (extras.length === 0) {
    mergedFields = canonicalFields;
  } else {
    const extraNames = new Set(extras.map((f) => f.name));
    mergedFields = [
      ...canonicalFields.filter((f) => !extraNames.has(f.name)),
      ...extras,
    ];
  }

  const allowPersistenceOverride = persistenceModeAllowsOverrides(
    ctx.canonicalEntity.persistence,
  );

  const entity: Entity = {
    name: effectiveName,
    persistence: allowPersistenceOverride
      ? (params.persistence ?? ctx.canonicalEntity.persistence)
      : ctx.canonicalEntity.persistence,
    fields: [...mergedFields],
  };
  if (allowPersistenceOverride && effectiveCollection !== undefined) {
    entity.collection = effectiveCollection;
  }
  return entity;
}

type TraitOrInline = OrbitalSchema['orbitals'][number]['traits'][number];
type PageOrRef = NonNullable<OrbitalSchema['orbitals'][number]['pages']>[number];

type TraitRefObject = Extract<TraitOrInline, { ref: string }>;

function isTraitReferenceObject(t: TraitOrInline): t is TraitRefObject {
  if (t === null || typeof t !== 'object') return false;
  if (!('ref' in t)) return false;
  return typeof t.ref === 'string';
}

function isPageRefObject(p: PageOrRef): p is PageRefObject {
  if (p === null || typeof p !== 'object') return false;
  if (!('ref' in p)) return false;
  return typeof p.ref === 'string';
}

function rewriteInlineLinkedEntity<T extends { linkedEntity?: string }>(
  shape: T,
  oldName: string,
  newName: string,
): T {
  if (shape.linkedEntity !== oldName) return shape;
  return { ...shape, linkedEntity: newName };
}

const ENTITY_POSITIONAL_OPS: ReadonlyArray<{
  readonly op: string;
  readonly actionGuard?: ReadonlySet<string>;
  readonly entityIndex: number;
}> = [
  { op: 'fetch', entityIndex: 1 },
  { op: 'ref', entityIndex: 1 },
  { op: 'spawn', entityIndex: 1 },
  { op: 'persist', actionGuard: new Set(['create', 'update', 'delete']), entityIndex: 2 },
];

const ENTITY_VALUED_PROPS: ReadonlySet<string> = new Set([
  'entity',
  'source',
  'entityType',
  'linkedEntity',
]);

interface SExprMap { readonly [k: string]: SExpr }

function rewriteEntityInSExpr(value: SExpr, oldName: string, newName: string): SExpr {
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    const prefix = `@${oldName}`;
    if (value === prefix || value.startsWith(`${prefix}.`)) {
      return `@${newName}${value.slice(prefix.length)}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string') {
      for (const entry of ENTITY_POSITIONAL_OPS) {
        if (first !== entry.op) continue;
        if (entry.actionGuard !== undefined) {
          const action = value[1];
          if (typeof action !== 'string' || !entry.actionGuard.has(action)) continue;
        }
        const at = entry.entityIndex;
        const slot = value[at];
        if (typeof slot !== 'string' || slot !== oldName) continue;
        const rewritten: SExpr[] = [];
        for (let i = 0; i < value.length; i++) {
          rewritten.push(i === at ? newName : rewriteEntityInSExpr(value[i], oldName, newName));
        }
        return rewritten;
      }
    }
    return value.map((v) => rewriteEntityInSExpr(v, oldName, newName));
  }
  return rewriteEntityInSExprMap(value as SExprMap, oldName, newName);
}

function rewriteEntityInSExprMap(obj: SExprMap, oldName: string, newName: string): SExprMap {
  const next: { [k: string]: SExpr } = {};
  for (const [k, v] of Object.entries(obj)) {
    if (ENTITY_VALUED_PROPS.has(k) && typeof v === 'string' && v === oldName) {
      next[k] = newName;
    } else {
      next[k] = rewriteEntityInSExpr(v, oldName, newName);
    }
  }
  return next;
}

function rewritePayloadFieldType(typeStr: string, oldName: string, newName: string): string {
  if (typeStr === oldName) return newName;
  if (typeStr === `[${oldName}]`) return `[${newName}]`;
  return typeStr;
}

function rewriteEventContract(
  contract: TraitEventContract,
  oldName: string,
  newName: string,
): TraitEventContract {
  if (!contract.payloadSchema || contract.payloadSchema.length === 0) return contract;
  return {
    ...contract,
    payloadSchema: contract.payloadSchema.map((f) => {
      const next = { ...f, type: rewritePayloadFieldType(f.type, oldName, newName) };
      if (typeof f.entityType === 'string' && f.entityType === oldName) {
        next.entityType = newName;
      }
      return next;
    }),
  };
}

function rewriteListener(
  listener: TraitEventListener,
  oldName: string,
  newName: string,
): TraitEventListener {
  if (!listener.payloadMapping) return listener;
  const prefix = `@${oldName}`;
  const nextMapping: Record<string, string> = {};
  for (const [k, v] of Object.entries(listener.payloadMapping)) {
    nextMapping[k] =
      v === prefix || v.startsWith(`${prefix}.`)
        ? `@${newName}${v.slice(prefix.length)}`
        : v;
  }
  return { ...listener, payloadMapping: nextMapping };
}

function rewriteTick(tick: TraitTick, oldName: string, newName: string): TraitTick {
  const next: TraitTick = { ...tick };
  if (next.guard !== undefined && next.guard !== null) {
    next.guard = rewriteEntityInSExpr(next.guard as SExpr, oldName, newName) as Expression;
  }
  next.effects = next.effects.map(
    (e) => rewriteEntityInSExpr(e as SExpr, oldName, newName) as Effect,
  );
  return next;
}

/**
 * Rebind an inline `Trait` to a renamed entity. Combines top-level
 * `linkedEntity` rewrite + body-level entity-ref rewriting (SExpr literals
 * in transitions / effects / ticks / payloads / listens).
 */
export function rebindInlineTraitEntity(trait: Trait, oldName: string, newName: string): Trait {
  if (oldName === newName) return trait;
  return rewriteEntityInInlineTrait(rewriteInlineLinkedEntity(trait, oldName, newName), oldName, newName);
}

export function rewriteEntityInInlineTrait(trait: Trait, oldName: string, newName: string): Trait {
  if (oldName === newName) return trait;
  const next: Trait = { ...trait };

  if (next.stateMachine) {
    next.stateMachine = {
      ...next.stateMachine,
      transitions: next.stateMachine.transitions.map((t) => {
        const updated = { ...t };
        if (updated.guard !== undefined && updated.guard !== null) {
          updated.guard = rewriteEntityInSExpr(updated.guard as SExpr, oldName, newName) as Expression;
        }
        if (updated.effects) {
          updated.effects = updated.effects.map(
            (e) => rewriteEntityInSExpr(e as SExpr, oldName, newName) as Effect,
          );
        }
        return updated;
      }),
    };
  }

  if (next.initialEffects) {
    next.initialEffects = next.initialEffects.map(
      (e) => rewriteEntityInSExpr(e as SExpr, oldName, newName) as Effect,
    );
  }

  if (next.ticks) {
    next.ticks = next.ticks.map((t) => rewriteTick(t, oldName, newName));
  }

  if (next.emits) {
    next.emits = next.emits.map((c) => rewriteEventContract(c, oldName, newName));
  }

  if (next.listens) {
    next.listens = next.listens.map((l) => rewriteListener(l, oldName, newName));
  }

  return next;
}

type TraitInput = OrbitalSchema['orbitals'][number]['traits'][number];
type PageInput = NonNullable<OrbitalSchema['orbitals'][number]['pages']>[number];

function rebuildTraits(
  ctx: OverlayContext,
  effectiveEntityName: string,
  traits: OrbitalSchema['orbitals'][number]['traits'],
): OrbitalDefinition['traits'] {
  return traits.map((t): TraitInput => {
    if (!isTraitReferenceObject(t)) {
      if (typeof t === 'string') return t;
      return rebindInlineTraitEntity(t, ctx.canonicalEntityName, effectiveEntityName);
    }
    const rewrittenLinkedEntity =
      t.linkedEntity === ctx.canonicalEntityName ? effectiveEntityName : t.linkedEntity;
    const opts: MakeTraitRefOpts = {
      ...t,
      linkedEntity: rewrittenLinkedEntity,
    } as MakeTraitRefOpts;
    return makeTraitRef(opts);
  });
}

function rebuildPages(
  ctx: OverlayContext,
  effectiveEntityName: string,
  pages: OrbitalSchema['orbitals'][number]['pages'],
): NonNullable<OrbitalDefinition['pages']> {
  if (!pages) return [];
  return pages.map((p): PageInput => {
    if (!isPageRefObject(p)) {
      return p;
    }
    const rewrittenLinkedEntity =
      p.linkedEntity === ctx.canonicalEntityName ? effectiveEntityName : p.linkedEntity;
    const opts: MakePageRefOpts = {
      ...p,
      linkedEntity: rewrittenLinkedEntity,
    } as MakePageRefOpts;
    return makePageRef(opts);
  });
}

/**
 * Merge call-site config overrides onto a base `CallSiteConfig`. Every entry
 * in the result is a `ConfigField` (Rust's `HashMap<String, ConfigField>`):
 * bare values — base AND override — are wrapped as `{ type: 'unknown', default }`
 * when not already a declaration. Override folds into an existing declaration's
 * `default` field.
 *
 * This is the single canonical implementation shared by:
 *   - `applyParamsToOrb` (runtime factory overlay)
 *   - generated factory bodies (via import from `@almadar/core/factory-runtime`)
 *   - generated `mergeExtraTraitWithOverlay` in dispatch.ts
 */
export function mergeCallSiteConfigOverrides(
  base: CallSiteConfig,
  overrides: CallSiteConfig,
): Record<string, CallSiteConfigEntry> {
  const next: Record<string, CallSiteConfigEntry> = {};
  for (const [k, entry] of Object.entries(base)) {
    next[k] = isCallSiteConfigDeclaration(entry)
      ? entry
      : { type: 'unknown', default: entry };
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (isCallSiteConfigDeclaration(v)) {
      next[k] = v;
      continue;
    }
    const existing = base[k];
    next[k] = existing !== undefined && isCallSiteConfigDeclaration(existing)
      ? { ...existing, default: v }
      : { type: 'unknown', default: v };
  }
  return next;
}

/**
 * The overlay. Resolves the effective entity name + collection, calls
 * `makeOrbitalWithUses` with the rewritten data, then applies the params'
 * trait/page overrides post-hoc.
 */
export function applyParamsToOrb(
  orb: OrbitalSchema,
  orbitalName: string,
  _manifest: OrbitalParamsManifest,
  params: OrbitalFactoryParams,
): OrbitalDefinition {
  const orbital = findOrbitalOrThrow(orb, orbitalName);
  const canonicalEntity = assertResolvedEntity(orbital.entity, orbitalName, orb.name);
  const canonicalEntityName = canonicalEntity.name;
  const effectiveEntityName = params.entityName ?? canonicalEntityName;
  const effectiveCollection =
    typeof canonicalEntity.collection === 'string'
      ? (params.collection ??
        (params.entityName
          ? `${params.entityName.toLowerCase()}s`
          : canonicalEntity.collection))
      : params.collection;

  const ctx: OverlayContext = { canonicalEntityName, canonicalEntity };

  const built = makeOrbitalWithUses({
    name: orbital.name,
    uses: orbital.uses ?? [],
    entity: buildEntity(ctx, effectiveEntityName, effectiveCollection, params),
    traits: rebuildTraits(ctx, effectiveEntityName, orbital.traits),
    pages: rebuildPages(ctx, effectiveEntityName, orbital.pages),
  });

  if (built.traits && params.traitOverrides !== undefined) {
    built.traits = built.traits.map((t) => {
      if (!isTraitReferenceObject(t) || typeof t.name !== 'string') return t;
      const override: OrbitalTraitOverride | undefined = params.traitOverrides?.[t.name];
      if (!override) return t;
      const merged: TraitReference = { ...t };
      if (override.config !== undefined) {
        merged.config = mergeCallSiteConfigOverrides(t.config ?? {}, override.config);
      }
      if (override.linkedEntity !== undefined) merged.linkedEntity = override.linkedEntity;
      if (override.events !== undefined) {
        if (
          override.events === null ||
          typeof override.events !== 'object' ||
          Array.isArray(override.events)
        ) {
          throw new Error(
            `traitOverrides["${t.name}"].events must be a Record<string,string> ` +
              `(rename map like { "OPEN": "ADD_ITEM" }), got ${
                Array.isArray(override.events) ? 'an array' : typeof override.events
              }`,
          );
        }
        for (const [k, v] of Object.entries(override.events)) {
          if (typeof v !== 'string') {
            throw new Error(
              `traitOverrides["${t.name}"].events["${k}"] must be a string ` +
                `(target event name), got ${typeof v}`,
            );
          }
        }
        merged.events = { ...(t.events ?? {}), ...override.events };
      }
      if (override.name !== undefined) merged.name = override.name;
      if (override.emitsScope !== undefined) merged.emitsScope = override.emitsScope;
      if (override.listens !== undefined) merged.listens = override.listens;
      return merged;
    });
  }

  if (built.pages && params.pagePath !== undefined) {
    built.pages = built.pages.map((p, idx) => {
      if (!isPageRefObject(p) || idx !== 0) return p;
      return { ...p, path: params.pagePath } as PageRefObject;
    });
  }

  return built;
}
