/**
 * `extractManifest(orb)` — derive the typed `OrbitalParamsManifest[]` from a
 * resolved `.orb`, one entry per orbital.
 *
 * Pure data → data. No I/O. No behavior-specific branching.
 *
 * @packageDocumentation
 */

import type { OrbitalSchema, TraitReference } from '../types/index.js';
import type { OrbitalParamsManifest, ParamFieldDescriptor } from './manifest-types.js';

const STATIC_PARAM_FIELDS: readonly ParamFieldDescriptor[] = [
  {
    name: 'fields',
    type: 'EntityField[]',
    description: 'Extra fields appended to the canonical entity.',
  },
  {
    name: 'pagePath',
    type: 'string',
    description: 'URL override for the orbital first page.',
  },
  {
    name: 'persistence',
    type: "'persistent' | 'runtime' | 'singleton' | 'instance' | 'local'",
    description: 'Override the canonical entity persistence mode.',
  },
  {
    name: 'entityName',
    type: 'string',
    description:
      "Rename the canonical entity. PascalCase singular, ≤32 chars. Threads through every trait's linkedEntity binding; compiler rewrites @Entity.x refs.",
  },
  {
    name: 'collection',
    type: 'string',
    description:
      'Override derived collection key. Defaults to plural(entityName).toLowerCase().',
  },
  {
    name: 'traitOverrides',
    type: 'Partial<Record<TraitName, { config?, linkedEntity?, events?, name?, emitsScope?, listens? }>>',
    description:
      ".lolo's native trait-composition surface 1:1: per-imported-trait config, linkedEntity, events, name, emitsScope, listens. effects is excluded (atom-owned; use listens via a sibling trait).",
  },
] as const;

interface SplitTraits {
  readonly refTraitNames: readonly string[];
  readonly inlineTraitNames: readonly string[];
}

function splitTraits(traits: OrbitalSchema['orbitals'][number]['traits']): SplitTraits {
  const refTraitNames: string[] = [];
  const inlineTraitNames: string[] = [];
  for (const t of traits) {
    if (!t || typeof t !== 'object') continue;
    const tName = typeof (t as TraitReference).name === 'string'
      ? (t as TraitReference).name
      : null;
    if (!tName) continue;
    if (typeof (t as TraitReference).ref === 'string') {
      refTraitNames.push(tName);
    } else {
      inlineTraitNames.push(tName);
    }
  }
  return { refTraitNames, inlineTraitNames };
}

export function extractManifest(orb: OrbitalSchema): readonly OrbitalParamsManifest[] {
  const behaviorName = orb.name;
  return orb.orbitals.map((orbital) => {
    const { refTraitNames, inlineTraitNames } = splitTraits(orbital.traits);
    return {
      organism: behaviorName,
      orbitalName: orbital.name,
      paramFields: STATIC_PARAM_FIELDS,
      traitNames: refTraitNames,
      inlineTraitNames,
    };
  });
}
