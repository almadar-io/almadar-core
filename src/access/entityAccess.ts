/**
 * Entity access policies — the declared `@read`/`@create`/`@update`/`@delete`
 * directives, keyed by entity name.
 *
 * The JS mirror of `orbital-core/src/runtime/entity_access.rs`'s
 * `EntityAccessPolicies`/`EntityAccessTable`. Both paths must agree: a
 * directive is a per-row predicate (`@entity` = the candidate row, or for
 * `@create` the incoming data; `@user` = the viewer), enforced once for
 * every trait that touches the entity — the un-bypassable twin of a
 * call-site `filter:`, which sibling traits can skip simply by not
 * declaring one.
 *
 * @packageDocumentation
 */

import type { OrbitalEntity } from '../types/entity.js';
import type { EntityRef } from '../types/orbital.js';
import type { OrbitalSchema } from '../types/schema.js';
import type { SExpr } from '../types/expression.js';

/** Inline entity definitions of an orbital: the primary plus any auxiliaries. */
function inlineEntities(schema: OrbitalSchema): OrbitalEntity[] {
  const out: OrbitalEntity[] = [];
  for (const orbital of schema.orbitals ?? []) {
    const refs: EntityRef[] = [orbital.entity, ...(orbital.auxiliaryEntities ?? [])];
    for (const ref of refs) {
      if (typeof ref === 'object' && ref !== null && 'fields' in ref) {
        out.push(ref as OrbitalEntity);
      }
    }
  }
  return out;
}

/** An entity's four declared directives. Any may be absent — an absent
 * directive means "no restriction" for that operation, exactly like an
 * absent fetch `filter:`. */
export interface EntityAccessPolicies {
  read?: SExpr;
  create?: SExpr;
  update?: SExpr;
  delete?: SExpr;
}

/** Whether the author declared any of the four directives on this entity. */
function isDeclared(p: EntityAccessPolicies): boolean {
  return (
    p.read !== undefined ||
    p.create !== undefined ||
    p.update !== undefined ||
    p.delete !== undefined
  );
}

/**
 * Every entity's access policies, keyed by entity name.
 *
 * A policy governs the **collection**, not the declaration. A `persistent:`
 * collection is one table, and two entity declarations over one table cannot
 * honestly carry different visibility rules. Keying by entity name alone let an
 * organism declare `@read` on its own entity and still ship an ALLOW-ALL list
 * wherever a page rendered through a std-atom trait that fetched the ATOM's
 * entity on the same collection — measured on `std-customer-success`, where
 * `/health-scores` returned 6 rows for every persona while the organism's own
 * `/cs-accounts` correctly returned 3 vs 6. 36 of 54 app organisms share a
 * collection this way (`R-SHADOW-ENTITY-SHARES-COLLECTION-DIRECTIVES-DONT-APPLY`).
 *
 * So an entity that declares nothing adopts the policy declared on its
 * collection. This can only ever ADD a restriction: an entity with its own
 * directives keeps exactly those, and an entity whose collection carries no
 * declared policy is untouched. Conflicting declarations on one collection are
 * rejected at validate time by `ORB_S_COLLECTION_POLICY_CONFLICT`.
 *
 * Mirrors `resolve_collection_inheritance` in
 * `orbital-rust/crates/orbital-core/src/runtime/entity_access.rs`.
 */
export function entityAccessTable(schema: OrbitalSchema): Map<string, EntityAccessPolicies> {
  const table = new Map<string, EntityAccessPolicies>();
  const collectionOf = new Map<string, string>();

  for (const def of inlineEntities(schema)) {
    table.set(def.name, {
      read: def.read_policy,
      create: def.create_policy,
      update: def.update_policy,
      delete: def.delete_policy,
    });
    if (def.collection) collectionOf.set(def.name, def.collection);
  }

  const byCollection = new Map<string, EntityAccessPolicies>();
  for (const [name, policies] of table) {
    const collection = collectionOf.get(name);
    if (collection && isDeclared(policies) && !byCollection.has(collection)) {
      byCollection.set(collection, policies);
    }
  }

  for (const [name, policies] of table) {
    if (isDeclared(policies)) continue;
    const collection = collectionOf.get(name);
    const inherited = collection ? byCollection.get(collection) : undefined;
    if (inherited) table.set(name, { ...inherited });
  }

  return table;
}

/** One entity's access policies, or `undefined` when it declares none. */
export function entityAccessPolicies(
  schema: OrbitalSchema,
  entityName: string,
): EntityAccessPolicies | undefined {
  return entityAccessTable(schema).get(entityName);
}
