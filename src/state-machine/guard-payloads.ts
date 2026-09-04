/**
 * Guard Payload Builder
 *
 * Derive pass and fail payloads from guard s-expressions.
 * Extracted from orbital-verify-unified/src/analyze.ts.
 *
 * @packageDocumentation
 */

import type { GuardPayload } from './types.js';
import type { EventPayload, EventPayloadValue, SExprObject } from '../types/expression.js';

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
 * Guard operators this module synthesizes real pass/fail payloads for
 * (subject to the arg shape actually being payload-steerable — an
 * `@entity`/`@config`-only guard using one of these ops still falls
 * through to `{pass:{}, fail:{}}`, silently, same as always: that's an
 * unsteerable GUARD, not an unrecognized OPERATOR).
 */
const SYNTHESIZED_GUARD_OPERATORS = new Set([
  'not-nil', 'not_nil', 'nil',
  'eq', '==', '=', 'not-eq', '!=', 'neq',
  'gt', '>', 'gte', '>=', 'lt', '<', 'lte', '<=',
  'and', 'or', 'not',
  'object/has', 'object/get', 'array/includes', 'str/startsWith',
  'agent/is-pinned', 'agent/memory-strength',
]);

/**
 * Guard operators seen in the std/io behavior registries that this module
 * knowingly does NOT synthesize a payload for yet — higher-order /
 * control-flow combinators (`if`, `let`, `array/some`) and spatial
 * predicates (`grid/in-bounds`) whose args aren't a flat
 * (payload-ref, literal) pair. This is a tracked gap, not a silent one —
 * see docs/Almadar_Verification_Gaps.md. Add an operator here only
 * alongside a gap-ledger entry; never to quiet a genuinely new miss.
 */
const ACKNOWLEDGED_UNSYNTHESIZED_GUARD_OPERATORS = new Set(['if', 'let', 'array/some', 'grid/in-bounds']);

/**
 * True when `op` is a guard operator this module has consciously
 * accounted for — either with real synthesis or as a tracked gap.
 * Exported so the exhaustive corpus-coverage test
 * (`__tests__/guard-payloads-operator-coverage.test.ts`) can assert every
 * operator actually used in the std/io registries is on one list or the
 * other, and fail CI the moment a new one isn't.
 */
export function isRecognizedGuardOperator(op: string): boolean {
  return (
    SYNTHESIZED_GUARD_OPERATORS.has(op) ||
    ACKNOWLEDGED_UNSYNTHESIZED_GUARD_OPERATORS.has(op) ||
    op.startsWith('agent/')
  );
}

/**
 * Operators `buildGuardPayloads` fell through on with NO case at all (not
 * even a tracked gap) — deduped, in first-seen order. `@almadar/core` has
 * no logger dependency (`@almadar/logger` depends on `@almadar/core`, so
 * the reverse would cycle), so a module-level array + `console.warn` is
 * the loud fallback: a silently-returned `{pass:{}, fail:{}}` here is
 * exactly how the `object/has` gap (vim-mode / std-modal-editor
 * OPERATOR_PENDING) went unnoticed for every guardParity + replay-
 * precondition check that depended on it.
 */
export const unhandledGuardOperators: string[] = [];

function recordUnhandledOperator(op: string): void {
  if (unhandledGuardOperators.includes(op)) return;
  unhandledGuardOperators.push(op);
  console.warn(
    `[@almadar/core buildGuardPayloads] unrecognized guard operator "${op}" — synthesizing {pass:{}, fail:{}}; this guard arm cannot be walked pass/fail by verify. Add synthesis (or a tracked-gap entry) in guard-payloads.ts.`,
  );
}

/**
 * `object/has` / `object/get` / `array/includes` guards carry a
 * (collection, `@payload.*` ref) pair. The evaluator's own arg order is
 * fixed — `evalObjectHas`/`evalObjectGet` always read args[0] as the
 * collection, args[1] as the key/path — but detect whichever guard arg IS
 * the payload binding rather than assuming a position, since callers of
 * this synthesizer should not have to track that per-operator.
 */
function splitPayloadArg(a: unknown, b: unknown): { path: string[]; collection: unknown } | null {
  const pathA = extractPayloadFieldPath(a);
  if (pathA) return { path: pathA, collection: b };
  const pathB = extractPayloadFieldPath(b);
  if (pathB) return { path: pathB, collection: a };
  return null;
}

function isPlainRecord(v: unknown): v is SExprObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/** A key guaranteed absent from `keys` — the longest key, `_`-suffixed
 * until it no longer collides (terminates: each suffix strictly grows). */
function absentKey(keys: string[]): string {
  let candidate = `${keys.reduce((longest, k) => (k.length > longest.length ? k : longest), '')}_`;
  while (keys.includes(candidate)) candidate += '_';
  return candidate;
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

  // `object/has(collection, "@payload.field")` (arg order per
  // `evalObjectHas` — see `splitPayloadArg` doc) — the vim-mode /
  // std-modal-editor OPERATOR_PENDING gap: `["object/has",
  // "@config.operators", "@payload.key"]` (post config-inline, args[0] is a
  // literal map) checks whether `payload.key` names one of the map's own
  // keys. Pass with the map's first declared key (deterministic); fail
  // with a key guaranteed absent from it.
  if (op === 'object/has') {
    const split = splitPayloadArg(guard[1], guard[2]);
    if (split && isPlainRecord(split.collection)) {
      const keys = Object.keys(split.collection);
      if (keys.length > 0) {
        return { pass: nestedPayload(split.path, keys[0]), fail: nestedPayload(split.path, absentKey(keys)) };
      }
    }
  }

  // `object/get(collection, "@payload.field")` used BARE as a guard (no
  // wrapping `not-nil`/`eq`) — std-modal-editor's `motions` arms — is a
  // truthy check on the looked-up value: pass iff `collection[payload.field]`
  // is truthy. Fail with an absent key (`object/get` returns `undefined`,
  // falsy); pass with a key whose declared value is itself truthy — a key
  // present but mapped to a falsy literal would still fail the real guard.
  if (op === 'object/get') {
    const split = splitPayloadArg(guard[1], guard[2]);
    if (split && isPlainRecord(split.collection)) {
      const map = split.collection;
      const keys = Object.keys(map);
      const passKey = keys.find((k) => Boolean(map[k]));
      if (passKey !== undefined) {
        return { pass: nestedPayload(split.path, passKey), fail: nestedPayload(split.path, absentKey(keys)) };
      }
    }
  }

  // `array/includes(list, "@payload.field")` — pass with the list's first
  // element, fail with a value provably not in the list.
  if (op === 'array/includes') {
    const split = splitPayloadArg(guard[1], guard[2]);
    if (split && Array.isArray(split.collection) && split.collection.length > 0) {
      const passVal = split.collection[0];
      const failVal = typeof passVal === 'string' ? `${passVal}-not-in-list` : 'not-in-list';
      return { pass: nestedPayload(split.path, passVal), fail: nestedPayload(split.path, failVal) };
    }
  }

  if (op === 'str/startsWith') {
    const path = extractPayloadFieldPath(guard[1]);
    const prefix = typeof guard[2] === 'string' ? guard[2] : '';
    if (path) {
      return {
        pass: nestedPayload(path, `${prefix}mock-suffix`),
        fail: nestedPayload(path, prefix.length > 0 ? `not-${prefix}` : 'mock-test-value'),
      };
    }
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

  // Every branch above either returned or fell through because the guard's
  // ARGS weren't payload-steerable (a recognized op, deliberately empty —
  // not a gap). An op that isn't even on the recognized list is the real
  // fallthrough this function must never let happen silently.
  if (!isRecognizedGuardOperator(op)) {
    recordUnhandledOperator(op);
  }

  return { pass: {}, fail: {} };
}
