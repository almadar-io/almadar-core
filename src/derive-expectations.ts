/**
 * `expects` derivation — compute an orbital's consumer-side requirement
 * declarations from a FULL multi-orbital schema (the organism's golden `.orb`).
 *
 * Derivation, not authorship (docs/Almadar_LOLO_Expects_Proposal.md §7): a
 * sliced orbital is born with correct expectations because the walk reads the
 * same cross-boundary edge families the organism declares — `@user.<field>`
 * reads in access directives/guards/effects (→ `expects identity`), relation
 * fields, `persist`/`fetch` effect targets, and cross-orbital `linkedEntity`
 * bindings (→ `expects entity`). Shape field types are copied verbatim from
 * the provider's declared fields in the golden schema — full fidelity, zero
 * guessing; a usage naming a field the provider never declared is reported in
 * `diagnostics` and omitted from the shape.
 *
 * `expects event` is Phase 2 and deliberately not derived here.
 *
 * @packageDocumentation
 */

import type { OrbitalSchema } from './types/schema.js';
import type { EntityRef, ExpectDeclaration } from './types/orbital.js';
import type { OrbitalEntity } from './types/entity.js';
import type { EntityField } from './types/field.js';
import type { TraitRef } from './types/trait.js';
import { isInlineTrait, isCallSiteConfigDeclaration } from './types/trait.js';
import type { CallSiteConfig, DeclaredTraitConfig } from './types/trait.js';
import type { SExpr } from './types/expression.js';
import { parseBinding } from './types/expression.js';
import type { Effect } from './types/effect.js';

/** A derivation note: a cross-boundary usage with no provider-side declaration. */
export type ExpectationDiagnostic = {
  kind:
    | 'unknown-orbital'
    | 'identity-field-not-declared'
    | 'entity-field-not-declared';
  /** The orbital the expectations were derived for. */
  orbital: string;
  /** Provider entity the field was expected on (when known). */
  entity?: string;
  /** Field name the consumer reads but the provider does not declare. */
  field?: string;
};

export type DeriveExpectationsResult = {
  expectations: ExpectDeclaration[];
  diagnostics: ExpectationDiagnostic[];
};

/** Inline entity definitions of an orbital: the primary plus any auxiliaries. */
function inlineEntitiesOf(orbital: OrbitalSchema['orbitals'][number]): OrbitalEntity[] {
  const out: OrbitalEntity[] = [];
  const refs: EntityRef[] = [orbital.entity, ...(orbital.auxiliaryEntities ?? [])];
  for (const ref of refs) {
    if (typeof ref === 'object' && ref !== null && 'fields' in ref) {
      out.push(ref as OrbitalEntity);
    }
  }
  return out;
}

/** Read-only structural view over the JSON lattice the walker traverses —
 *  `SExpr` (mutable) and `TraitConfigValue` (readonly) both assign to it. */
type WalkableData =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<WalkableData>
  | { readonly [key: string]: WalkableData };

/** Recursively walk an S-expression, visiting arrays, atoms, AND object-literal
 *  values (persist payloads / fetch options live in object position, which
 *  `walkSExpr` does not descend into). */
function walkSExprData(node: WalkableData, visit: (n: WalkableData) => void): void {
  visit(node);
  if (node === null || typeof node !== 'object') return;
  const children: ReadonlyArray<WalkableData> = Array.isArray(node) ? node : Object.values(node);
  for (const child of children) walkSExprData(child, visit);
}

/** Top-level keys of every object literal in a persist data argument — the
 *  payload fields written to the target entity. Object values are not
 *  recursed into (a nested literal is a field VALUE, not more field names);
 *  expression forms (`object/merge` args) are recursed so their row literals
 *  contribute. */
function collectPersistPayloadKeys(data: WalkableData, out: Set<string>): void {
  if (Array.isArray(data)) {
    for (const child of data) collectPersistPayloadKeys(child, out);
    return;
  }
  if (data !== null && typeof data === 'object') {
    for (const key of Object.keys(data)) out.add(key);
  }
}

function isPlainString(value: WalkableData): value is string {
  return typeof value === 'string' && !value.startsWith('@');
}

/**
 * Derive the `expects` declarations for one orbital of a full schema.
 * Pure; never mutates the input schema.
 */
export function deriveExpectations(
  schema: OrbitalSchema,
  orbitalName: string,
): DeriveExpectationsResult {
  const diagnostics: ExpectationDiagnostic[] = [];
  const orbital = schema.orbitals.find((o) => o.name === orbitalName);
  if (orbital === undefined) {
    return { expectations: [], diagnostics: [{ kind: 'unknown-orbital', orbital: orbitalName }] };
  }

  // Entity ownership across the whole schema (first declaration wins —
  // same-name duplicates are rejected upstream by entity-uniqueness).
  const ownerByEntity = new Map<string, string>();
  const defByEntity = new Map<string, OrbitalEntity>();
  let identityDef: OrbitalEntity | undefined;
  for (const o of schema.orbitals) {
    for (const def of inlineEntitiesOf(o)) {
      if (!ownerByEntity.has(def.name)) {
        ownerByEntity.set(def.name, o.name);
        defByEntity.set(def.name, def);
      }
      if (def.identity === true && identityDef === undefined) identityDef = def;
    }
  }

  const ownDefs = inlineEntitiesOf(orbital);
  const ownEntityNames = new Set(ownDefs.map((d) => d.name));

  const userFields = new Set<string>();
  /** Sibling entity name → field names the orbital actually references. */
  const entityRefs = new Map<string, Set<string>>();

  const addEntityRef = (name: string, field?: string): void => {
    if (ownEntityNames.has(name)) return; // never expect your own entity
    const owner = ownerByEntity.get(name);
    if (owner === undefined || owner === orbitalName) return; // not a sibling's
    let fields = entityRefs.get(name);
    if (fields === undefined) {
      fields = new Set<string>();
      entityRefs.set(name, fields);
    }
    if (field !== undefined) fields.add(field);
  };

  const visitExpr = (node: WalkableData): void => {
    if (typeof node === 'string') {
      const parsed = node.startsWith('@') ? parseBinding(node) : null;
      if (parsed === null) return;
      if (parsed.root === 'user') {
        if (parsed.path.length > 0) userFields.add(parsed.path[0]);
        return;
      }
      if (parsed.root === 'entity' && parsed.path.length >= 2) {
        // Hydrated-relation read: `@entity.<relationField>.<field>` reads
        // `<field>` of the relation target.
        const relName = parsed.path[0];
        for (const def of ownDefs) {
          const rel = (def.fields ?? []).find(
            (f) => f.name === relName && f.type === 'relation',
          );
          if (rel !== undefined && rel.type === 'relation') {
            addEntityRef(rel.relation.entity, parsed.path[1]);
          }
        }
        return;
      }
      if (parsed.type === 'entity') {
        // `@EntityName.<field>` — a direct cross-entity read.
        addEntityRef(parsed.root, parsed.path[0]);
      }
      return;
    }
    if (Array.isArray(node) && node.length > 0 && node[0] === 'persist') {
      const target = node[2];
      if (target !== undefined && isPlainString(target)) {
        addEntityRef(target);
        const data = node[3];
        if (data !== undefined && typeof data !== 'string') {
          const keys = new Set<string>();
          collectPersistPayloadKeys(data, keys);
          for (const key of keys) addEntityRef(target, key);
        }
      }
      return;
    }
    if (Array.isArray(node) && node.length > 0 && node[0] === 'fetch') {
      const target = node[1];
      if (target !== undefined && isPlainString(target)) {
        addEntityRef(target);
        const options = node[2];
        if (options !== undefined && !Array.isArray(options) && typeof options === 'object' && options !== null) {
          const include = options['include'];
          if (Array.isArray(include)) {
            for (const item of include) {
              if (typeof item === 'string') addEntityRef(target, item);
            }
          }
        }
      }
    }
  };

  const walk = (expr: SExpr | Effect | null | undefined): void => {
    if (expr === null || expr === undefined) return;
    // Effect tuples are refinements of the s-expr wire shape (EffectSchema is
    // an array of SExprData); the walker only reads the shared structure.
    walkSExprData(expr as SExpr, visitExpr);
  };

  // Config entries evaluate in the consumer's context: a `@user.*` default on
  // a composed trait's knob (AppShell `viewerName`) is an identity requirement
  // of THIS orbital, same as one in a guard (G-EXPECT-DERIVE-CONFIG).
  const walkConfig = (config: CallSiteConfig | DeclaredTraitConfig | undefined): void => {
    if (config === undefined) return;
    for (const entry of Object.values(config)) {
      const value = isCallSiteConfigDeclaration(entry) ? entry.default : entry;
      if (value !== undefined) walkSExprData(value, visitExpr);
    }
  };

  // 1. Access directives on the orbital's own entities.
  for (const def of ownDefs) {
    walk(def.read_policy);
    walk(def.create_policy);
    walk(def.update_policy);
    walk(def.delete_policy);
  }

  // 2. Relation-typed fields on the orbital's own entities (existence-only
  //    unless a field-level usage above already recorded fields).
  for (const def of ownDefs) {
    for (const field of def.fields ?? []) {
      if (field.type === 'relation' && field.name !== undefined) {
        addEntityRef(field.relation.entity);
      }
    }
  }

  // 3. Traits: guards, effects, ticks, listens; linkedEntity bindings.
  const walkTraitRef = (t: TraitRef): void => {
    if (typeof t === 'string') return;
    if (!isInlineTrait(t)) {
      if (t.linkedEntity !== undefined) addEntityRef(t.linkedEntity);
      walkConfig(t.config);
      return;
    }
    if (t.linkedEntity !== undefined) addEntityRef(t.linkedEntity);
    walkConfig(t.config);
    const sm = t.stateMachine;
    if (sm !== undefined) {
      for (const g of sm.guards ?? []) walk(g.expression);
      for (const tr of sm.transitions) {
        walk(tr.guard);
        for (const eff of tr.effects ?? []) walk(eff);
      }
    }
    for (const eff of t.initialEffects ?? []) walk(eff);
    for (const tick of t.ticks ?? []) {
      walk(tick.guard);
      for (const eff of tick.effects) walk(eff);
    }
    for (const listener of t.listens ?? []) {
      walk(listener.guard);
      for (const value of Object.values(listener.payloadMapping ?? {})) walk(value);
    }
  };
  for (const t of orbital.traits) walkTraitRef(t);

  // ---- Build declarations -------------------------------------------------
  const expectations: ExpectDeclaration[] = [];

  // One name, one declaration: when the [identity] roster is ALSO a referenced
  // sibling entity (e.g. a relation field targeting it), fold those field refs
  // into the identity expectation instead of emitting a second
  // `expects entity` for the same name — duplicate expectations are a parse
  // error downstream (ELOLO_DUPLICATE_EXPECTATION), and the named identity
  // declaration is the one that carries relation-target resolution
  // (Almadar_LOLO_Expects_Proposal.md §5.1).
  if (identityDef !== undefined && userFields.size > 0) {
    const alsoReferenced = entityRefs.get(identityDef.name);
    if (alsoReferenced !== undefined) {
      for (const field of alsoReferenced) userFields.add(field);
      entityRefs.delete(identityDef.name);
    }
  }

  if (userFields.size > 0) {
    const shape: EntityField[] = [];
    for (const field of [...userFields].sort()) {
      const declared = identityDef?.fields.find((f) => f.name === field);
      if (declared !== undefined) {
        shape.push({ ...declared });
      } else {
        diagnostics.push({
          kind: 'identity-field-not-declared',
          orbital: orbitalName,
          entity: identityDef?.name,
          field,
        });
      }
    }
    expectations.push({
      kind: 'identity',
      ...(identityDef !== undefined ? { name: identityDef.name } : {}),
      ...(shape.length > 0 ? { shape } : {}),
    });
  }

  for (const name of [...entityRefs.keys()].sort()) {
    const referenced = entityRefs.get(name) ?? new Set<string>();
    const provider = defByEntity.get(name);
    const shape: EntityField[] = [];
    for (const field of [...referenced].sort()) {
      const declared = provider?.fields.find((f) => f.name === field);
      if (declared !== undefined) {
        shape.push({ ...declared });
      } else {
        diagnostics.push({
          kind: 'entity-field-not-declared',
          orbital: orbitalName,
          entity: name,
          field,
        });
      }
    }
    expectations.push({
      kind: 'entity',
      name,
      ...(shape.length > 0 ? { shape } : {}),
    });
  }

  return { expectations, diagnostics };
}
