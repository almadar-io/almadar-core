/**
 * Guard Payload Builder
 *
 * Derive pass and fail payloads from guard s-expressions.
 * Extracted from orbital-verify-unified/src/analyze.ts.
 *
 * @packageDocumentation
 */

import type { GuardPayload } from './types.js';
import type { EventPayload, EventPayloadValue } from '../types/expression.js';

/**
 * Extracts the first segment of a payload field reference.
 * 
 * Parses binding references in the format "@payload.field" and extracts
 * the first field name segment. Used for identifying payload fields in
 * guard conditions for test data generation.
 * 
 * @param {unknown} ref - Binding reference to extract from
 * @returns {string | null} First field segment or null for non-payload references
 * 
 * @example
 * extractPayloadFieldRef('@payload.item'); // returns 'item'
 * extractPayloadFieldRef('@payload.data.weight'); // returns 'data'
 * extractPayloadFieldRef('@entity.id'); // returns null
 * extractPayloadFieldRef('@user.name'); // returns null
 */
export function extractPayloadFieldRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const match = ref.match(/^@payload\.([A-Za-z0-9_]+)/);
  return match ? match[1] : null;
}

/**
 * Full dotted path of a payload reference — `'@payload.data.providerName'`
 * → `['data', 'providerName']`. `extractPayloadFieldRef` keeps only the
 * first segment, which made every guard on a NESTED payload field
 * unsatisfiable by synthesis: `when ?data.providerName` was seeded as
 * `{data: 'mock-test-value'}`, the runtime read `.providerName` off a
 * string, and the pass-case dispatch was correctly rejected (std-booking
 * BookingWizard NEXT — the whole step chain became unwalkable). Returns
 * `null` for non-payload references.
 */
export function extractPayloadFieldPath(ref: unknown): string[] | null {
  if (typeof ref !== 'string') return null;
  const match = ref.match(/^@payload\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)/);
  return match ? match[1].split('.') : null;
}

/** `['data','providerName']` + leaf → `{data: {providerName: leaf}}`. */
function nestedPayload(path: string[], leaf: EventPayloadValue): EventPayload {
  let value: EventPayloadValue = leaf;
  for (let i = path.length - 1; i >= 1; i--) {
    value = { [path[i]]: value };
  }
  return { [path[0]]: value };
}

function isPayloadObject(v: EventPayloadValue): v is EventPayload {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/**
 * Deep-merge for synthesized payloads. A shallow spread clobbers sibling
 * NESTED fields — `(and ?data.customerName ?data.email)` built
 * `{data:{customerName}}` then `{data:{email}}` and the spread kept only
 * the last, so multi-field AND guards on one payload object could never
 * pass. Later keys win on genuine conflicts, mirroring spread order.
 */
function mergePayloads(a: EventPayload, b: EventPayload): EventPayload {
  const out: EventPayload = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    out[k] = prev !== undefined && isPayloadObject(prev) && v !== undefined && isPayloadObject(v)
      ? mergePayloads(prev, v)
      : v;
  }
  return out;
}

/**
 * Builds test payloads that satisfy or violate guard conditions.
 * 
 * Generates pass/fail test data for guard s-expressions used in state machine
 * transitions. Pass payloads satisfy the guard condition (allowing transition),
 * fail payloads violate it (blocking transition). Used for automated testing
 * and validation of state machine behavior.
 * 
 * Supports operators: not-nil, nil, eq, not-eq, gt, gte, lt, lte, and, or, not
 * 
 * @param {unknown} guard - Guard s-expression to analyze
 * @returns {GuardPayload} Object with pass and fail payloads
 * 
 * @example
 * // Guard: ['not-nil', '@payload.completed']
 * buildGuardPayloads(['not-nil', '@payload.completed']);
 * // Returns: { pass: { completed: 'mock-test-value' }, fail: { completed: null } }
 * 
 * @example
 * // Guard: ['eq', '@payload.status', 'active']
 * buildGuardPayloads(['eq', '@payload.status', 'active']);
 * // Returns: { pass: { status: 'active' }, fail: { status: 'not-active' } }
 * 
 * @example
 * // Guard: ['and', ['not-nil', '@payload.id'], ['eq', '@payload.status', 'ready']]
 * buildGuardPayloads(['and', ['not-nil', '@payload.id'], ['eq', '@payload.status', 'ready']]);
 * // Returns: { pass: { id: 'mock-test-value', status: 'ready' }, fail: { id: null } }
 */
/**
 * Evaluate a guard that is fully constant (no `@payload`/`@entity`/`@config`
 * bindings — e.g. after molecule/organism inlining folds `@config.mode` to a
 * literal). Returns the constant truth value, or `null` when the guard depends
 * on a binding (so a payload must be synthesized). This lets callers (a) emit
 * an empty payload for a constant guard (no field to satisfy) and (b) skip the
 * meaningless variant: an always-true guard has no fail case, an always-false
 * guard has no pass case. Without it, `(or (= "create" "create") @payload.row)`
 * (create-mode modal OPEN) was synthesized with a spurious `row`, which the
 * runtime read as edit-mode and rejected.
 */
export function constTruth(guard: unknown): boolean | null {
  if (typeof guard === 'boolean') return guard;
  if (typeof guard === 'string') {
    if (guard.startsWith('@')) return null; // a binding — not constant
    return guard.length > 0; // bare non-binding literal: truthy iff non-empty
  }
  if (!Array.isArray(guard) || guard.length === 0) return null;
  const op = String(guard[0]);
  const isLiteral = (x: unknown): boolean =>
    x === null ||
    typeof x === 'number' ||
    typeof x === 'boolean' ||
    (typeof x === 'string' && !x.startsWith('@'));
  if (op === '=' || op === '==' || op === 'eq') {
    return isLiteral(guard[1]) && isLiteral(guard[2]) ? guard[1] === guard[2] : null;
  }
  if (op === '!=' || op === 'ne' || op === 'not-eq' || op === 'neq') {
    return isLiteral(guard[1]) && isLiteral(guard[2]) ? guard[1] !== guard[2] : null;
  }
  if (op === 'not') {
    const inner = constTruth(guard[1]);
    return inner === null ? null : !inner;
  }
  if (op === 'or') {
    const subs = (guard.slice(1) as unknown[]).map(constTruth);
    if (subs.some((s) => s === true)) return true; // short-circuit
    if (subs.every((s) => s === false)) return false;
    return null;
  }
  if (op === 'and') {
    const subs = (guard.slice(1) as unknown[]).map(constTruth);
    if (subs.some((s) => s === false)) return false; // short-circuit
    if (subs.every((s) => s === true)) return true;
    return null;
  }
  return null;
}

export function buildGuardPayloads(guard: unknown): GuardPayload {
  // A fully-constant guard (post-inline literal fold) is decided by its
  // literals, not by the payload — synthesize nothing for either case.
  if (constTruth(guard) !== null) {
    return { pass: {}, fail: {} };
  }
  // Bare-binding existence guard: e.g. `when @payload.row` lowers to
  // the string `"@payload.row"`. The transition fires iff that field is
  // truthy. Synthesize pass with a truthy mock and fail with null so
  // the verifier can drive both branches. Without this, std-confirmation
  // and std-modal's existence guards (REQUEST/EDIT requiring @payload.row)
  // get empty payloads in both cases — the pass case then fails the
  // server-side guard and the portal observer flags "slot not mounted".
  if (typeof guard === 'string') {
    const path = extractPayloadFieldPath(guard);
    // Single-segment existence guards keep the row-shaped mock (`?row` —
    // std-confirmation/std-modal open a record view off it); a NESTED leaf
    // (`?data.providerName`) is a scalar field, so a string mock is the
    // truthy value its consumers (str/…, renders) can actually use.
    if (path) {
      return path.length === 1
        ? { pass: { [path[0]]: { id: 'mock-test-id', name: 'mock-test-name' } }, fail: { [path[0]]: null } }
        : { pass: nestedPayload(path, 'mock-test-value'), fail: nestedPayload(path, null) };
    }
  }

  if (!Array.isArray(guard) || guard.length === 0) {
    return { pass: {}, fail: {} };
  }

  const op = String(guard[0]);

  if (op === 'not-nil' || op === 'not_nil') {
    const path = extractPayloadFieldPath(guard[1]);
    if (path) return { pass: nestedPayload(path, 'mock-test-value'), fail: nestedPayload(path, null) };
  }

  if (op === 'nil') {
    const path = extractPayloadFieldPath(guard[1]);
    if (path) return { pass: {}, fail: nestedPayload(path, 'mock-test-value') };
  }

  if (op === 'eq' || op === '==' || op === '=') {
    const path = extractPayloadFieldPath(guard[1]);
    const val = guard[2];
    if (path && val !== undefined) {
      const failVal =
        typeof val === 'number' ? val + 1
        : typeof val === 'string' ? `not-${val}`
        : null;
      return { pass: nestedPayload(path, val), fail: nestedPayload(path, failVal) };
    }
  }

  if (op === 'not-eq' || op === '!=' || op === 'neq') {
    const path = extractPayloadFieldPath(guard[1]);
    const val = guard[2];
    if (path && val !== undefined) {
      const passVal =
        typeof val === 'number' ? val + 1
        : typeof val === 'string' ? `not-${val}`
        : 'other';
      return { pass: nestedPayload(path, passVal), fail: nestedPayload(path, val) };
    }
  }

  if (op === 'gt' || op === '>') {
    const path = extractPayloadFieldPath(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (path) return { pass: nestedPayload(path, n + 1), fail: nestedPayload(path, n - 1) };
  }

  if (op === 'gte' || op === '>=') {
    const path = extractPayloadFieldPath(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (path) return { pass: nestedPayload(path, n), fail: nestedPayload(path, n - 1) };
  }

  if (op === 'lt' || op === '<') {
    const path = extractPayloadFieldPath(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (path) return { pass: nestedPayload(path, n - 1), fail: nestedPayload(path, n + 1) };
  }

  if (op === 'lte' || op === '<=') {
    const path = extractPayloadFieldPath(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (path) return { pass: nestedPayload(path, n), fail: nestedPayload(path, n + 1) };
  }

  if (op === 'and') {
    // Accept BOTH array sub-guards and bare-binding string sub-guards
    // (e.g. `(and "@payload.row" (not-nil "@payload.id"))`). Dropping the
    // bare strings with filter(Array.isArray) lost their fields from the
    // pass payload. AND passes iff every sub-guard passes, so merge all
    // sub-guards' pass payloads; AND fails iff any sub-guard fails, so the
    // first sub-guard's fail payload is a sufficient violation.
    const subs = guard.slice(1) as unknown[];
    if (subs.length >= 2) {
      const built = subs.map(buildGuardPayloads);
      const pass = built.reduce<GuardPayload['pass']>((acc, b) => mergePayloads(acc, b.pass), {});
      return { pass, fail: built[0].fail };
    }
    if (subs.length === 1) return buildGuardPayloads(subs[0]);
  }

  if (op === 'or') {
    // Accept BOTH array sub-guards and bare-binding string sub-guards
    // (post-substitution mode-aware guards like
    // `(or (= "edit" "create") "@payload.row")` mix array + string children).
    const subs = guard.slice(1) as unknown[];
    if (subs.length >= 2) {
      const s1 = buildGuardPayloads(subs[0]);
      const s2 = buildGuardPayloads(subs[1]);
      // For OR: pass if EITHER branch passes. Prefer the second branch's
      // pass payload if the first yields nothing useful — the literal-fold
      // case `(= "edit" "create") || @payload.row` has the first branch
      // return `{}` and the row-payload comes from the second.
      const combinedPass = Object.keys(s1.pass).length > 0 ? s1.pass : s2.pass;
      return { pass: combinedPass, fail: mergePayloads(s1.fail, s2.fail) };
    }
    if (subs.length === 1) return buildGuardPayloads(subs[0]);
  }

  if (op === 'not') {
    const inner = buildGuardPayloads(guard[1]);
    return { pass: inner.fail, fail: inner.pass };
  }

  // Agent pure operators used in guards
  if (op === 'agent/is-pinned') {
    const field = extractPayloadFieldRef(guard[1]);
    if (field) return { pass: { [field]: 'mem_test_unpinned' }, fail: { [field]: 'mem_test_pinned' } };
  }

  if (op === 'agent/memory-strength') {
    const field = extractPayloadFieldRef(guard[1]);
    if (field) return { pass: { [field]: 'mem_test_id' }, fail: { [field]: 'mem_nonexistent' } };
  }

  // Agent operators in comparison contexts (e.g., [">=", ["agent/context-usage"], 0.85])
  // These don't use @payload, they query agent state directly. Return empty payloads
  // since the guard result depends on agent context, not event payload.
  if (op.startsWith('agent/')) {
    return { pass: {}, fail: {} };
  }

  return { pass: {}, fail: {} };
}
