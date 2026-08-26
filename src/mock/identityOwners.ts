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
 * Every `[identity]`-tagged entity, primaries first, paired with whether it is
 * an orbital's PRIMARY entity or an auxiliary copy an import brought along.
 */
function identityEntitiesTagged(schema: OrbitalSchema): Array<{ def: OrbitalEntity; primary: boolean }> {
  const out: Array<{ def: OrbitalEntity; primary: boolean }> = [];
  for (const orbital of schema.orbitals ?? []) {
    const ref = orbital.entity;
    if (typeof ref === 'object' && ref !== null && 'fields' in ref && (ref as OrbitalEntity).identity === true) {
      out.push({ def: ref as OrbitalEntity, primary: true });
    }
  }
  for (const orbital of schema.orbitals ?? []) {
    for (const ref of orbital.auxiliaryEntities ?? []) {
      if (typeof ref === 'object' && ref !== null && 'fields' in ref && (ref as OrbitalEntity).identity === true) {
        out.push({ def: ref as OrbitalEntity, primary: false });
      }
    }
  }
  return out;
}

/**
 * The name of the schema's `[identity]` entity, if it declares one.
 *
 * A behavior declares its own roster so it runs standalone. Composing it never
 * imports that orbital, but a trait bound to one of its siblings drags the
 * roster in as an auxiliary copy, tag and all — so a PRIMARY roster shadows
 * every imported copy: the composing app decides who `@user` is. With no
 * primary roster the copies still count, which is what lets a thin app that
 * wraps one behavior inherit that behavior's roster.
 *
 * Compiled-path twin: `identity_entities` in
 * `orbital-compiler/src/phases/validation/user_identity.rs`.
 */
export function identityEntityName(schema: OrbitalSchema): string | undefined {
  const tagged = identityEntitiesTagged(schema);
  return (tagged.find((e) => e.primary) ?? tagged[0])?.def.name;
}

/**
 * Every `[identity]`-tagged name, shadowed copies included.
 *
 * Owner-column derivation asks whether a relation targets *a* roster, not *the*
 * one: `Timesheet.employeeId : Employee` is an owner column whether or not
 * `Employee` won the `@user` binding. Dropping the shadowed names here would
 * leave an imported behavior's rows unscoped at runtime while the compiled path
 * treats the very same column as an owner column.
 */
export function identityEntityNames(schema: OrbitalSchema): string[] {
  const out: string[] = [];
  for (const { def } of identityEntitiesTagged(schema)) {
    if (!out.includes(def.name)) out.push(def.name);
  }
  return out;
}

/**
 * Owner columns as `Entity.field` pairs — every relation field pointing at an
 * `[identity]`-tagged entity, shadowed imported rosters included. Empty when the
 * program declares no identity, which keeps every unmigrated app behaving
 * exactly as before.
 */
export function ownerFieldsFromSchema(schema: OrbitalSchema): string[] {
  const identities = identityEntityNames(schema);
  if (identities.length === 0) return [];

  const out: string[] = [];
  const defs = inlineEntities(schema);
  const declaredByCollection = new Map<string, string[]>();
  for (const def of defs) {
    for (const field of def.fields ?? []) {
      // Cardinality-one only: an owner column holds ONE viewer id. A
      // `[Person]` array is a participant list, not ownership.
      if (field.name && field.type === 'relation' && identities.includes(field.relation.entity)) {
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
