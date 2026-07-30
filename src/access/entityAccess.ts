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

/** Every entity's access policies, keyed by entity name. */
export function entityAccessTable(schema: OrbitalSchema): Map<string, EntityAccessPolicies> {
  const table = new Map<string, EntityAccessPolicies>();
  for (const def of inlineEntities(schema)) {
    table.set(def.name, {
      read: def.read_policy,
      create: def.create_policy,
      update: def.update_policy,
      delete: def.delete_policy,
    });
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
