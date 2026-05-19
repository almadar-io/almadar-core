/**
 * Structural diff between two `FactoryCallSite[]` lists. Identity is
 * `(organism, orbital)`. Renames surface as delete+add — the agent
 * layer reconstructs them from `analysis.renames`.
 *
 * Post-Phase-6 lives under the `factory/` namespace. Canonical
 * implementation stays in `../domain-language/sync/diff-factory-calls.ts`
 * until Step 8's physical relocation.
 *
 * @packageDocumentation
 */

export { diffFactoryCalls } from '../domain-language/sync/diff-factory-calls.js';
export type { CallSiteDiff } from '../domain-language/sync/diff-factory-calls.js';
