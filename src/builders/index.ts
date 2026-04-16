/**
 * Builders Module
 *
 * Utilities for composing orbital definitions into applications.
 *
 * @deprecated Phase 0 of the Lolo v3 plan moved the canonical implementation
 * to `@almadar/runtime/composition`. These files remain as a temporary mirror
 * to keep existing callers working without a coordinated migration. Both
 * copies are byte-identical. Phase 4 will delete this directory and migrate
 * the four production callers to import from `@almadar/runtime` instead.
 *
 * Why core does not re-export from runtime: `@almadar/runtime` depends on
 * `@almadar/core`, so a re-export from core to runtime would create a circular
 * package dependency. The duplication is intentional and temporary.
 *
 * @packageDocumentation
 */

// Layout strategy detection
export { type LayoutStrategy, detectLayoutStrategy } from './layout-strategy.js';

// Event wiring
export { type EventWiringEntry, applyEventWiring } from './event-wiring.js';

// Compose behaviors (main entry point)
export {
  type ComposeBehaviorsInput,
  type ComposeBehaviorsResult,
  composeBehaviors,
} from './compose-behaviors.js';

// Phase 4.2 reference-form builders (mirrored from ../builders.ts for the
// dual-export convention so both `@almadar/core/builders` and consumers
// that pull from `./builders/index` get the same symbols).
export {
  type MakeTraitRefOpts,
  type MakePageRefOpts,
  type MakeOrbitalWithUsesOpts,
  type MakeAtomOrbitalOpts,
  type MakeAtomOrbitalTraitOverrides,
  makeTraitRef,
  makePageRef,
  makeOrbitalWithUses,
  makeAtomOrbital,
} from '../builders.js';

