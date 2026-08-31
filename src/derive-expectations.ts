/**
 * `expects` derivation — compute an orbital's consumer-side requirement
 * declarations from a FULL multi-orbital schema (the organism's golden `.orb`).
 *
 * Derivation, not authorship (docs/Almadar_LOLO_Expects_Proposal.md §7): a
 * sliced orbital is born with correct expectations because the walk reads the
 * same cross-boundary edge families the organism declares — `@user.<field>`
 * reads in access directives/guards/effects (→ `expects identity`), relation
 * fields, `persist`/`fetch` effect targets, and cross-orbital `linkedEntity`
 * bindings (→ `expects entity`), and `navigate` targets resolving to a
 * sibling's page (→ `expects page`). Shape field types are copied verbatim from
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
import { parseImportedTraitRef } from './types/orbital.js';
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
 * Mirror of the compiler's `path_matches_pattern`
 * (`validation/effect/navigate.rs`): equal segment count, and every pattern
 * segment either a `:param` or an exact match.
 */
function pathMatchesPattern(path: string, pattern: string): boolean {
  const pathParts = path.split('/').filter((s) => s.length > 0);
  const patternParts = pattern.split('/').filter((s) => s.length > 0);
  if (pathParts.length !== patternParts.length) return false;
  return patternParts.every((seg, i) => seg.startsWith(':') || seg === pathParts[i]);
}

/**
 * Mirror of the compiler's `find_matching_page_path`: exact → `:param`
 * pattern → declared-path-extends-target prefix (the arm that resolves the
 * static prefix of a dynamic navigate). Deterministic tie-break by sorted
 * path, because the compiler iterates a HashMap and we must not depend on
 * its order to pick a different winner than it would accept.
 */
function findMatchingPagePath(navPath: string, pagePaths: ReadonlySet<string>): string | null {
  if (pagePaths.has(navPath)) return navPath;
  const sorted = [...pagePaths].sort();

  // A trailing slash means the effect was `(str/concat "/articles/" <dynamic>)`
  // — the runtime path has ONE MORE segment than the prefix, so the provider is
  // the route that adds exactly one `:param` segment. Both `/articles` and
  // `/articles/:slug` satisfy the compiler here (its first arm drops empty
  // segments, making `/articles/` and `/articles` look identical), but only
  // `/articles/:slug` is the route actually being navigated to — and a
  // declaration is only worth having if it names the right thing.
  if (navPath.endsWith('/')) {
    const prefixParts = navPath.split('/').filter((s) => s.length > 0);
    const parameterised = sorted.find((p) => {
      const parts = p.split('/').filter((s) => s.length > 0);
      return (
        parts.length === prefixParts.length + 1 &&
        parts[parts.length - 1]?.startsWith(':') === true &&
        prefixParts.every((seg, i) => parts[i] === seg)
      );
    });
    if (parameterised !== undefined) return parameterised;
  }

  return (
    sorted.find((p) => pathMatchesPattern(navPath, p)) ??
    sorted.find((p) => p.startsWith(navPath.replace(/\/+$/, ''))) ??
    null
  );
}

/**
 * Mirror of the compiler's `extract_static_path_prefix`: a navigate target is
 * either a literal path, or a `str/concat`/`concat` whose FIRST argument is a
 * literal prefix (`(str/concat "/articles/" @payload.data.slug)` → `/articles/`).
 * Anything else is runtime-resolved and undecidable statically.
 */
function navigateTargetOf(node: WalkableData): string | null {
  if (!Array.isArray(node) || node.length < 2 || node[0] !== 'navigate') return null;
  const target = node[1];
  if (typeof target === 'string') return target.startsWith('@') ? null : target;
  if (Array.isArray(target) && target.length >= 2) {
    const op = target[0];
    const first = target[1];
    if ((op === 'str/concat' || op === 'concat') && typeof first === 'string') return first;
  }
  return null;
}

/**
 * Resolve a behavior by the trailing segment of a `uses` import path
 * (`std/behaviors/std-mod-queue` → `std-mod-queue`). Supplied by the caller
 * because `@almadar/core` does no IO; every consumer already holds a loader.
 */
export type DeriveExpectationsOptions = {
  loadBehavior?: (behaviorName: string) => OrbitalSchema | null;
};

/** Trailing path segment of a `uses` import — the behavior's registry name. */
function behaviorNameOf(from: string): string {
  const segments = from.split('/');
  return (segments[segments.length - 1] ?? from).replace(/\.orb$/, '');
}

/** The `ref` string of a trait reference, or undefined for an inline trait. */
function traitRefString(t: TraitRef): string | undefined {
  if (typeof t === 'string') return t;
  return isInlineTrait(t) ? undefined : t.ref;
}

/**
 * Entities an imported behavior contributes when one of its traits is
 * composed — the derivation-side mirror of the compiler's Gap #22 synthesis
 * (`orbital-compiler/src/phases/inline/mod.rs:863-894`).
 *
 * `bound` is the trait's own entity, contributed ONLY when the call site does
 * not rebind `linkedEntity` (the gate at `inline/mod.rs:872`). `aux` is the
 * owning orbital's auxiliary entities, which travel whether or not the call
 * site rebinds (`:888-894`).
 */
function contributedEntitiesOf(
  behavior: OrbitalSchema,
  traitName: string,
): { bound?: string; aux: string[] } | undefined {
  for (const o of behavior.orbitals) {
    for (const t of o.traits ?? []) {
      if (typeof t !== 'object' || t === null || !isInlineTrait(t)) continue;
      if (t.name !== traitName) continue;
      const primary = asOrbitalEntity(o.entity);
      const bound = t.linkedEntity ?? primary?.name;
      const aux: string[] = [];
      for (const ref of o.auxiliaryEntities ?? []) {
        const def = asOrbitalEntity(ref);
        if (def !== undefined) aux.push(def.name);
      }
      return { ...(bound !== undefined ? { bound } : {}), aux };
    }
  }
  return undefined;
}

/** Narrow an `EntityRef` to its inline definition, or undefined for a string ref. */
function asOrbitalEntity(ref: EntityRef | undefined): OrbitalEntity | undefined {
  if (typeof ref === 'object' && ref !== null && 'fields' in ref) return ref as OrbitalEntity;
  return undefined;
}

/**
 * Derive the `expects` declarations for one orbital of a full schema.
 * Pure; never mutates the input schema.
 */
export function deriveExpectations(
  schema: OrbitalSchema,
  orbitalName: string,
  options: DeriveExpectationsOptions = {},
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
    }
  }

  // Entities an IMPORTED ATOM contributes. These are real entities of the
  // composed program — the compiler surfaces them into the composing
  // orbital's `auxiliaryEntities` during inline (Gap #22,
  // `inline/mod.rs:863-894`) — but they are absent from the pre-inline
  // schema, so without this pass a sibling that persists/fetches one reads
  // as naming an entity nobody declares and `addEntityRef` drops it.
  //
  // Runs strictly AFTER every real declaration is collected, and never
  // overwrites one: a contributed name is the weakest claim of ownership.
  // (Same ordering invariant the compiled path learned the hard way in
  // `phases/validate.rs collect_names` — declarations before anything derived.)
  //
  // Recorded WITHOUT a definition: an entity here is licensed to exist, not
  // described. Attaching a shape would opt the expectation into payload
  // checking against a provider the slice cannot see.
  const contributedNames = new Set<string>();
  const { loadBehavior } = options;
  if (loadBehavior !== undefined) {
    for (const o of schema.orbitals) {
      const behaviorByAlias = new Map<string, string>();
      for (const use of o.uses ?? []) behaviorByAlias.set(use.as, behaviorNameOf(use.from));
      if (behaviorByAlias.size === 0) continue;
      for (const t of o.traits ?? []) {
        const ref = traitRefString(t);
        if (ref === undefined) continue;
        const parsed = parseImportedTraitRef(ref);
        if (parsed === null) continue;
        const behaviorName = behaviorByAlias.get(parsed.alias);
        if (behaviorName === undefined) continue;
        const behavior = loadBehavior(behaviorName);
        if (behavior === null) continue;
        const contributed = contributedEntitiesOf(behavior, parsed.traitName);
        if (contributed === undefined) continue;
        const rebound = typeof t === 'object' && t !== null && !isInlineTrait(t)
          ? t.linkedEntity !== undefined
          : false;
        const names = rebound ? contributed.aux : [...(contributed.bound !== undefined ? [contributed.bound] : []), ...contributed.aux];
        for (const name of names) {
          if (ownerByEntity.has(name)) continue;
          ownerByEntity.set(name, o.name);
          contributedNames.add(name);
        }
      }
    }
  }
  // A PRIMARY `[identity]` roster shadows one an import dragged in as an
  // auxiliary copy — the composing app decides who `@user` is. Same rule as
  // `identityEntityName` and the compiled path's `identity_entities`.
  for (const o of schema.orbitals) {
    const primary = o.entity;
    if (typeof primary === 'object' && primary !== null && 'fields' in primary
      && (primary as OrbitalEntity).identity === true) {
      identityDef = primary as OrbitalEntity;
      break;
    }
  }
  if (identityDef === undefined) {
    for (const o of schema.orbitals) {
      identityDef = inlineEntitiesOf(o).find((def) => def.identity === true);
      if (identityDef !== undefined) break;
    }
  }

  const ownDefs = inlineEntitiesOf(orbital);
  const ownEntityNames = new Set(ownDefs.map((d) => d.name));

  const userFields = new Set<string>();
  /** Sibling entity name → field names the orbital actually references. */
  const entityRefs = new Map<string, Set<string>>();
  /** Route patterns a SIBLING orbital declares and this one navigates to. */
  const pageRefs = new Set<string>();

  // Every page the organism declares, and who owns it — the two halves a
  // slice does not have, which is exactly why derivation (not the effect) is
  // the place that can resolve a navigate prefix to a provider's pattern.
  const ownerByPagePath = new Map<string, string>();
  for (const o of schema.orbitals) {
    for (const page of o.pages ?? []) {
      if (typeof page === 'string') continue;
      const path = page.path;
      if (typeof path === 'string' && path.length > 0 && !ownerByPagePath.has(path)) {
        ownerByPagePath.set(path, o.name);
      }
    }
  }
  const organismPagePaths = new Set(ownerByPagePath.keys());

  const addPageRef = (navPath: string): void => {
    const matched = findMatchingPagePath(navPath, organismPagePaths);
    // No page in the whole organism matches → a genuine dead route. Derive
    // nothing, so the slice still reports it and a typo stays an error.
    if (matched === null) return;
    // Ours already: the slice declares it, nothing to expect.
    if (ownerByPagePath.get(matched) === orbitalName) return;
    pageRefs.add(matched);
  };

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
    const navTarget = navigateTargetOf(node);
    if (navTarget !== null) {
      addPageRef(navTarget);
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

  for (const path of [...pageRefs].sort()) {
    expectations.push({ kind: 'page', path });
  }

  for (const name of [...entityRefs.keys()].sort()) {
    const referenced = entityRefs.get(name) ?? new Set<string>();
    const provider = defByEntity.get(name);
    const shape: EntityField[] = [];
    // An atom-contributed entity has no definition in this schema by
    // construction, so every field would report as undeclared. That is not a
    // finding — the provider exists, just not until inline — and the
    // expectation stays existence-only either way.
    const contributed = contributedNames.has(name);
    for (const field of [...referenced].sort()) {
      const declared = provider?.fields.find((f) => f.name === field);
      if (declared !== undefined) {
        shape.push({ ...declared });
      } else if (!contributed) {
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
