/**
 * Owner columns derived from a program's `[identity]` entity.
 *
 * The JS mirror of `orbital-core/src/runtime/seed.rs`
 * (`identity_entity_name` / `owner_fields_from_schema`). Both paths must agree:
 * a column is an owner column because the source *declared* it as a relation to
 * the `[identity]` entity (`patientId : Person`), never because its name looks
 * like one — a name-matching guess would silently scope the wrong column.
 *
 * @packageDocumentation
 */

import type { OrbitalEntity } from '../types/entity.js';
import type { EntityRef } from '../types/orbital.js';
import type { OrbitalSchema } from '../types/schema.js';

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

/**
 * The name of the schema's `[identity]` entity, if it declares one.
 *
 * At most one per composed program (`ORB_S_IDENTITY_NOT_UNIQUE`); same-name
 * duplicates across orbitals are rejected upstream by `validate_entity_uniqueness`,
 * so the first match is the only match.
 */
export function identityEntityName(schema: OrbitalSchema): string | undefined {
  return inlineEntities(schema).find((def) => def.identity === true)?.name;
}

/**
 * Owner columns as `Entity.field` pairs — every relation field pointing at the
 * `[identity]` entity. Empty when the program declares no identity, which keeps
 * every unmigrated app behaving exactly as before.
 */
export function ownerFieldsFromSchema(schema: OrbitalSchema): string[] {
  const identity = identityEntityName(schema);
  if (identity === undefined) return [];

  const out: string[] = [];
  const defs = inlineEntities(schema);
  const declaredByCollection = new Map<string, string[]>();
  for (const def of defs) {
    for (const field of def.fields ?? []) {
      // Cardinality-one only: an owner column holds ONE viewer id. A
      // `[Person]` array is a participant list, not ownership.
      if (field.name && field.type === 'relation' && field.relation.entity === identity) {
        out.push(`${def.name}.${field.name}`);
        if (def.collection) {
          const cols = declaredByCollection.get(def.collection) ?? [];
          if (!cols.includes(field.name)) cols.push(field.name);
          declaredByCollection.set(def.collection, cols);
        }
      }
    }
  }

  // Collection mirror of `entityAccessTable`'s policy inheritance: an entity
  // sharing a collection with a declaring sibling is scoped by that sibling's
  // @read policy, so its same-named column IS the owner column the policy
  // compares — an imported atom's entity structurally cannot declare the
  // relation itself (it does not know the app's identity entity). Still
  // declaration-grounded, never name-guessing across collections.
  for (const def of defs) {
    const cols = def.collection ? declaredByCollection.get(def.collection) : undefined;
    if (!cols) continue;
    for (const col of cols) {
      const key = `${def.name}.${col}`;
      if (out.includes(key)) continue;
      if ((def.fields ?? []).some((f) => f.name === col)) out.push(key);
    }
  }
  return out;
}
