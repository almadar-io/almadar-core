/**
 * Explode Behavior Composition
 *
 * Human-authoring primitive (Phase 5.3 of Almadar_Agent_Behaviors_Plan).
 *
 * Reads a behavior's compiled `.orb` from the sibling `@almadar/std`
 * registry on disk and returns the flat list of `TraitReference` objects
 * it's composed from — each with `from`, `ref`, `linkedEntity`, and any
 * call-site overrides. **Not exposed to the agent or LLM.** The helper
 * exists for developers designing new molecules or debugging compositions.
 *
 * The function is Node-only. It walks the filesystem under
 * `packages/almadar-std/behaviors/registry/{atoms,molecules,organisms}/`
 * relative to this source file and will throw a descriptive error if the
 * behavior cannot be resolved.
 *
 * When the target is a leaf atom (no `uses:` / composition), the function
 * returns a single synthetic `TraitReference` pointing at the atom's own
 * inline trait so consumers always get something useful.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { OrbitalSchema } from '../types/schema.js';
import type { OrbitalDefinition, UseDeclaration } from '../types/orbital.js';
import type { Trait, TraitRef, TraitReference } from '../types/trait.js';
import { isInlineTrait } from '../types/trait.js';

// ============================================================================
// Registry resolution
// ============================================================================

/**
 * Resolve the filesystem path of `packages/almadar-std/behaviors/registry/`
 * relative to this source file. The helper lives in
 * `packages/almadar-core/src/builders/` and the std package is its sibling,
 * so the path is `../../../almadar-std/behaviors/registry/`.
 *
 * Uses `import.meta.url` so the path works under both Node ESM execution
 * and tsup's ESM build output.
 */
function registryRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..', 'almadar-std', 'behaviors', 'registry');
}

const LEVELS = ['atoms', 'molecules', 'organisms'] as const;
type BehaviorLevel = (typeof LEVELS)[number];

interface ResolvedBehavior {
  level: BehaviorLevel;
  path: string;
  schema: OrbitalSchema;
}

/**
 * Resolve a behavior name (e.g. `std-cart`) to its compiled `.orb` JSON by
 * searching `atoms/`, `molecules/`, then `organisms/`.
 *
 * Throws a descriptive error naming the behavior and every path searched
 * when the behavior cannot be found.
 */
function resolveBehavior(behaviorName: string): ResolvedBehavior {
  const root = registryRoot();
  const searched: string[] = [];

  for (const level of LEVELS) {
    const path = resolve(root, level, `${behaviorName}.orb`);
    searched.push(path);
    let source: string;
    try {
      source = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `explodeBehaviorComposition: failed to parse ${path} as JSON: ${message}`,
      );
    }
    return { level, path, schema: parsed as OrbitalSchema };
  }

  throw new Error(
    `explodeBehaviorComposition: behavior "${behaviorName}" not found. ` +
      `Searched:\n  - ${searched.join('\n  - ')}`,
  );
}

// ============================================================================
// Composition walk
// ============================================================================

/**
 * A trait entry in an `OrbitalDefinition.traits` array is either a call-site
 * `TraitReference` (object with a `ref:` string), a bare string reference,
 * or an inline `Trait` definition. Only `TraitReference` objects carry
 * composition metadata (`from`, overrides), so we filter for those.
 */
function isTraitReferenceObject(entry: TraitRef): entry is TraitReference {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'ref' in entry &&
    typeof (entry as { ref: unknown }).ref === 'string' &&
    !isInlineTrait(entry as TraitRef)
  );
}

/**
 * Build a lookup from trait-alias prefix (e.g. `"Modal"`) to the `from:`
 * path declared in the orbital's `uses:` header. Used to backfill `from`
 * on `TraitReference` entries that omitted it at author time but whose
 * `ref` uses an imported alias (`Modal.traits.X`).
 */
function aliasToFromMap(
  uses: UseDeclaration[] | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!uses) return map;
  for (const use of uses) {
    map.set(use.as, use.from);
  }
  return map;
}

/**
 * Extract the alias prefix from a trait reference string of the form
 * `"Alias.traits.TraitName"`. Returns `null` for local refs like
 * `"MyTrait"` that don't cross an import boundary.
 */
function extractAlias(ref: string): string | null {
  const match = ref.match(/^([A-Z][a-zA-Z0-9]*)\.traits\.[A-Z][a-zA-Z0-9]*$/);
  return match ? match[1] : null;
}

/**
 * Find the inline trait that represents the "core" behavior of an atom —
 * the atom itself, not a composition. Atoms typically have exactly one
 * inline trait and no `uses:` imports.
 */
function findAtomInlineTrait(
  orbital: OrbitalDefinition,
): Trait | undefined {
  for (const entry of orbital.traits) {
    if (typeof entry === 'object' && entry !== null && isInlineTrait(entry as TraitRef)) {
      return entry as Trait;
    }
  }
  return undefined;
}

/**
 * Build a synthetic `TraitReference` pointing at a leaf atom's own inline
 * trait so consumers always get a non-empty result. The `from` follows the
 * registry convention used by `uses:` entries — `"std/behaviors/<behavior>"`
 * — and `ref` is `"<PascalAlias>.traits.<TraitName>"` using the atom's
 * name as the alias (e.g. `"Browse.traits.BrowseItemBrowse"` for
 * `std-browse`).
 */
function syntheticLeafReference(
  behaviorName: string,
  orbital: OrbitalDefinition,
  trait: Trait,
): TraitReference {
  // Strip the `std-` prefix and PascalCase the remainder for the alias.
  const base = behaviorName.replace(/^std-/, '');
  const alias = base
    .split('-')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('') || 'Behavior';

  const entityName =
    typeof orbital.entity === 'string'
      ? orbital.entity
      : 'name' in orbital.entity && typeof orbital.entity.name === 'string'
        ? orbital.entity.name
        : undefined;

  const reference: TraitReference = {
    ref: `${alias}.traits.${trait.name}`,
    from: `std/behaviors/${behaviorName}`,
  };
  if (trait.linkedEntity !== undefined) {
    reference.linkedEntity = trait.linkedEntity;
  } else if (entityName !== undefined) {
    reference.linkedEntity = entityName;
  }
  return reference;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Flatten a behavior's `.orb` composition into the list of
 * `TraitReference` objects it's built from.
 *
 * For composed behaviors (molecules, organisms) this returns every
 * `TraitReference` entry from every orbital's `traits:` array, carrying
 * the call-site `ref`, backfilled `from` (looked up against the orbital's
 * `uses:` imports when omitted), `linkedEntity`, `events`, `effects`, and
 * any other override fields declared at the call site.
 *
 * For leaf atoms (no composition, only an inline trait) the function
 * returns a single synthetic `TraitReference` pointing at the atom's own
 * trait, so consumers always get a non-empty array they can iterate.
 *
 * @param behaviorName - Registry name of the behavior (e.g. `"std-cart"`,
 *                       `"std-browse"`).
 * @returns Flat list of every `TraitReference` the behavior is composed of.
 * @throws Error when the behavior cannot be found in any registry level.
 */
export function explodeBehaviorComposition(
  behaviorName: string,
): TraitReference[] {
  const resolved = resolveBehavior(behaviorName);
  const orbitals = Array.isArray(resolved.schema.orbitals)
    ? resolved.schema.orbitals
    : [];

  const references: TraitReference[] = [];

  for (const orbital of orbitals) {
    const aliasMap = aliasToFromMap(orbital.uses);
    for (const entry of orbital.traits ?? []) {
      if (!isTraitReferenceObject(entry)) continue;

      const copy: TraitReference = { ...entry };
      if (copy.from === undefined) {
        const alias = extractAlias(copy.ref);
        const fromPath = alias !== null ? aliasMap.get(alias) : undefined;
        if (fromPath !== undefined) {
          copy.from = fromPath;
        }
      }
      references.push(copy);
    }
  }

  if (references.length > 0) return references;

  // Leaf behavior: no composition entries. Synthesize a reference to the
  // atom's own inline trait so callers always get something to work with.
  const firstOrbital = orbitals[0];
  const inlineTrait = firstOrbital
    ? findAtomInlineTrait(firstOrbital)
    : undefined;
  if (firstOrbital && inlineTrait) {
    return [syntheticLeafReference(behaviorName, firstOrbital, inlineTrait)];
  }

  return [];
}
