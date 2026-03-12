/**
 * Guard Payload Builder
 *
 * Derive pass and fail payloads from guard s-expressions.
 * Extracted from orbital-verify-unified/src/analyze.ts.
 *
 * @packageDocumentation
 */

import type { GuardPayload } from './types.js';

/**
 * Extract the first @payload path segment from a binding reference.
 * "@payload.item" -> "item", "@payload.data.weight" -> "data".
 * Returns null for non-payload refs (@entity, @state, @user, etc.).
 */
export function extractPayloadFieldRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const match = ref.match(/^@payload\.([A-Za-z0-9_]+)/);
  return match ? match[1] : null;
}

/**
 * Derive pass and fail payloads from a guard s-expression.
 *
 * Pass payload: satisfies the guard condition (transition fires).
 * Fail payload: violates the guard condition (transition is blocked).
 *
 * For @entity.* and @user.* guards: returns { pass: {}, fail: {} } because
 * these reference runtime state that cannot be directly faked in tests.
 *
 * Handles operators: not-nil, nil, eq, not-eq, gt, gte, lt, lte, and, or, not
 */
export function buildGuardPayloads(guard: unknown): GuardPayload {
  if (!Array.isArray(guard) || guard.length === 0) {
    return { pass: {}, fail: {} };
  }

  const op = String(guard[0]);

  if (op === 'not-nil' || op === 'not_nil') {
    const field = extractPayloadFieldRef(guard[1]);
    if (field) return { pass: { [field]: 'mock-test-value' }, fail: { [field]: null } };
  }

  if (op === 'nil') {
    const field = extractPayloadFieldRef(guard[1]);
    if (field) return { pass: {}, fail: { [field]: 'mock-test-value' } };
  }

  if (op === 'eq' || op === '==' || op === '=') {
    const field = extractPayloadFieldRef(guard[1]);
    const val = guard[2];
    if (field && val !== undefined) {
      const failVal =
        typeof val === 'number' ? val + 1
        : typeof val === 'string' ? `not-${val}`
        : null;
      return { pass: { [field]: val }, fail: { [field]: failVal } };
    }
  }

  if (op === 'not-eq' || op === '!=' || op === 'neq') {
    const field = extractPayloadFieldRef(guard[1]);
    const val = guard[2];
    if (field && val !== undefined) {
      const passVal =
        typeof val === 'number' ? val + 1
        : typeof val === 'string' ? `not-${val}`
        : 'other';
      return { pass: { [field]: passVal }, fail: { [field]: val } };
    }
  }

  if (op === 'gt' || op === '>') {
    const field = extractPayloadFieldRef(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (field) return { pass: { [field]: n + 1 }, fail: { [field]: n - 1 } };
  }

  if (op === 'gte' || op === '>=') {
    const field = extractPayloadFieldRef(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (field) return { pass: { [field]: n }, fail: { [field]: n - 1 } };
  }

  if (op === 'lt' || op === '<') {
    const field = extractPayloadFieldRef(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (field) return { pass: { [field]: n - 1 }, fail: { [field]: n + 1 } };
  }

  if (op === 'lte' || op === '<=') {
    const field = extractPayloadFieldRef(guard[1]);
    const n = typeof guard[2] === 'number' ? guard[2] : 0;
    if (field) return { pass: { [field]: n }, fail: { [field]: n + 1 } };
  }

  if (op === 'and') {
    const subs = (guard.slice(1) as unknown[]).filter(Array.isArray);
    if (subs.length >= 2) {
      const s1 = buildGuardPayloads(subs[0]);
      const s2 = buildGuardPayloads(subs[1]);
      return { pass: { ...s1.pass, ...s2.pass }, fail: s1.fail };
    }
    if (subs.length === 1) return buildGuardPayloads(subs[0]);
  }

  if (op === 'or') {
    const subs = (guard.slice(1) as unknown[]).filter(Array.isArray);
    if (subs.length >= 2) {
      const s1 = buildGuardPayloads(subs[0]);
      const s2 = buildGuardPayloads(subs[1]);
      return { pass: s1.pass, fail: { ...s1.fail, ...s2.fail } };
    }
    if (subs.length === 1) return buildGuardPayloads(subs[0]);
  }

  if (op === 'not') {
    const inner = buildGuardPayloads(guard[1]);
    return { pass: inner.fail, fail: inner.pass };
  }

  return { pass: {}, fail: {} };
}
