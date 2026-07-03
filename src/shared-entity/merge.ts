/**
 * Shared-entity frame merge.
 *
 * The DRY primitive both execution paths share: several traits bound to one
 * `[shared]` entity each contribute field writes per frame, and exactly one
 * render trait paints the merged result. Both the JS interpreter (`@almadar/runtime`/
 * `@almadar/ui`) and the generated TypeScript (Rust
 * `orbital-shell-typescript` codegen) fold writes through this same
 * function, so the two execution paths merge state identically.
 *
 * @packageDocumentation
 */

import type { EntityRow, FieldValue } from '../types/entity.js';

/**
 * One field write a writer trait applies to the shared entity's running
 * scratch state within a frame.
 */
export interface EntityFieldWrite {
  readonly field: string;
  readonly value: FieldValue;
}

/**
 * A shared-entity snapshot. Aliases the canonical `EntityRow` — the SAME
 * row shape every other entity-state surface in the codebase uses (guard
 * contexts, `traitFieldStatesRef`, `RuntimeEntityStore`) — so a shared
 * entity's snapshot needs no conversion at its boundaries.
 */
export type EntityFrameState = EntityRow;

/**
 * Field-level fold of ordered writes onto the current entity state. A
 * later write to the same field overwrites an earlier one (ordered);
 * fields absent from `orderedWrites` are carried over verbatim rather than
 * the whole object being replaced, so disjoint writers never clobber each
 * other.
 */
export function mergeEntityFrame(
  current: EntityFrameState,
  orderedWrites: readonly EntityFieldWrite[],
): EntityFrameState {
  if (orderedWrites.length === 0) return current;
  const next: EntityRow = { ...current };
  for (const write of orderedWrites) {
    next[write.field] = write.value;
  }
  return next;
}
