import type { FactoryConfigParam, FactorySignatureCatalog } from './types.js';

/**
 * Rehydrate `overridableConfigKeys` from a catalog's `knobDefs` table,
 * in place, and drop the wire-only `overridableConfigKeyRefs`.
 *
 * Call this immediately after parsing a catalog and before handing it to any
 * consumer — every consumer reads `overridableConfigKeys` and must never see
 * a signature mid-rehydration.
 *
 * A catalog with no `knobDefs` is returned untouched, which is what makes the
 * format change backward compatible: old catalogs still carry their knobs
 * inline. An out-of-range or missing ref is skipped rather than throwing —
 * a truncated table should degrade to fewer knobs, not take down every
 * consumer of the catalog.
 */
export function rehydrateKnobDefs(catalog: FactorySignatureCatalog): FactorySignatureCatalog {
  const table = catalog.knobDefs;
  if (table === undefined || table.length === 0) return catalog;
  for (const sig of catalog.signatures) {
    for (const trait of sig.traits ?? []) {
      const refs = trait.overridableConfigKeyRefs;
      if (refs === undefined) continue;
      const knobs: FactoryConfigParam[] = [];
      for (const i of refs) {
        const knob = table[i];
        if (knob !== undefined) knobs.push(knob);
      }
      const mutable = trait as {
        overridableConfigKeys: ReadonlyArray<FactoryConfigParam>;
        overridableConfigKeyRefs?: ReadonlyArray<number>;
      };
      mutable.overridableConfigKeys = knobs;
      delete mutable.overridableConfigKeyRefs;
    }
  }
  return catalog;
}
