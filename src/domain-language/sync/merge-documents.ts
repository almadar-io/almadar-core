/**
 * Phase 5 — `mergeDocuments(base, overlay)` overlay reducer.
 *
 * The studio questionnaire renders `mergeDocuments(factoryBase,
 * userOverlay)` as its surface — the user edits the overlay; the base
 * never mutates. Server-side, the planner reads the user's persisted
 * overlay and merges it on top of the catalog's `baseDocument` to
 * derive the final `DomainDocument` fed to `translateDomainToParams`.
 *
 * Semantics:
 *   - `entities[]`, `pages[]`, `behaviors[]` matched by `name`. The
 *     overlay's entry replaces the base's; missing names from one side
 *     are kept verbatim from the other.
 *   - Within a matched entity / page / behavior, overlay fields win
 *     (overlay-replace, not deep-merge). This means a user clearing
 *     `fields: []` is honoured rather than silently re-inflating from
 *     the base. The questionnaire UI emits partial overlays only for
 *     the slots the user touched, so this is the right granularity.
 *   - Arrays inside matched entries (`entities[i].fields[]`,
 *     `pages[i].sections[]`) are NOT field-level merged — the overlay
 *     replaces the base array verbatim when present. For granular
 *     additions ("add a field"), the UI authors a `DomainMutation`
 *     and applies via `applyMutation` instead of going through
 *     `mergeDocuments`.
 *   - Top-level `type` is always `'document'`.
 *
 * Pure function — no I/O, no mutation of inputs. Returns a new
 * `DomainDocument`.
 *
 * @packageDocumentation
 */

import type { DomainBehavior, DomainDocument, DomainEntity, DomainPage } from '../types.js';

/**
 * Compose a base `DomainDocument` (factory catalog baseline) with a
 * user-authored overlay (questionnaire answers + edits). Entities,
 * pages, and behaviors are matched by `name`; the overlay replaces
 * any base entry with the same name. Unmatched entries on either side
 * survive unchanged.
 *
 * Idempotent: `mergeDocuments(d, emptyDocument)` returns a deep-copy
 * of `d`. `mergeDocuments(emptyDocument, d)` likewise.
 *
 * @param base    The starting document (factory `baseDocument` or
 *                organism-level union).
 * @param overlay The user-authored overlay carrying edits.
 * @returns A new merged document; neither input is mutated.
 */
export function mergeDocuments(
  base: DomainDocument,
  overlay: DomainDocument,
): DomainDocument {
  return {
    type: 'document',
    entities: mergeByName(base.entities, overlay.entities),
    pages: mergeByName(base.pages, overlay.pages),
    behaviors: mergeByName(base.behaviors, overlay.behaviors),
  };
}

/**
 * Merge two arrays of named AST nodes. Items present in both arrays
 * are taken from the overlay (overlay-wins). Items present in only
 * one side survive verbatim. Output preserves base order, with new
 * overlay-only items appended in overlay order.
 */
function mergeByName<T extends { name: string }>(
  baseItems: ReadonlyArray<T>,
  overlayItems: ReadonlyArray<T>,
): T[] {
  const overlayByName = new Map<string, T>();
  for (const item of overlayItems) overlayByName.set(item.name, item);

  const result: T[] = [];
  const seen = new Set<string>();
  for (const item of baseItems) {
    const replacement = overlayByName.get(item.name);
    if (replacement) {
      result.push(replacement);
    } else {
      result.push(item);
    }
    seen.add(item.name);
  }
  for (const item of overlayItems) {
    if (!seen.has(item.name)) {
      result.push(item);
    }
  }
  return result;
}

// Re-export the constituent node types so consumers can build inputs
// without separately importing them from `../types.js`.
export type { DomainBehavior, DomainDocument, DomainEntity, DomainPage };
