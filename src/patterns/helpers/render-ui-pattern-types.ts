/**
 * Render-ui pattern-type collection over `.orb` IR — the ONE home for the
 * walk both the free-mode coherence filter (rabit) and the facet ingest
 * (calibrate) derive a behavior's rendered `type:` vocabulary from.
 *
 * Pure JSON traversal: no fs, no caching, no policy. `@`-prefixed type
 * values (e.g. `@config.viewPattern`) are call-site config bindings resolved
 * at compose time, not literal pattern types, and are skipped.
 */

import { type JsonValue, isJsonArray, isJsonObject } from '../../types/json.js';

function collectPatternTypeTokens(node: JsonValue, out: Set<string>): void {
  if (!isJsonObject(node)) return;
  const type = node['type'];
  if (typeof type === 'string' && !type.startsWith('@')) out.add(type);
  const children = node['children'];
  if (isJsonArray(children)) {
    for (const child of children) collectPatternTypeTokens(child, out);
  }
}

/**
 * Walk an `.orb` IR value collecting every `["render-ui", <slot>, <node>]`
 * pattern node's literal `type:` tokens (including nested `children`).
 */
export function collectRenderUiPatternTypes(ir: JsonValue, out: Set<string>): void {
  if (isJsonArray(ir)) {
    if (ir.length >= 3 && ir[0] === 'render-ui' && typeof ir[1] === 'string') {
      collectPatternTypeTokens(ir[2], out);
    }
    for (const item of ir) collectRenderUiPatternTypes(item, out);
  } else if (isJsonObject(ir)) {
    for (const value of Object.values(ir)) collectRenderUiPatternTypes(value, out);
  }
}

/** Convenience form: the distinct render-ui `type:` tokens of one `.orb` IR. */
export function renderUiPatternTypesOf(ir: JsonValue): ReadonlySet<string> {
  const out = new Set<string>();
  collectRenderUiPatternTypes(ir, out);
  return out;
}
