/**
 * Structural diff between two `FactoryCallSite[]` lists. Pure typed,
 * no side effects. Used by downstream consumers (agent planner, UI
 * cascade view) to turn a "previous calls" + "next calls" pair into a
 * minimal change set.
 *
 * Identity for diffing is `(organism, orbital)`. Renames are not
 * handled here — they show up as a delete + add. The agent layer is
 * expected to merge those back into a `'rename'` op if it can prove
 * the underlying domain entity was renamed.
 */

import type {
  FactoryCallSite,
  FactoryCallSiteParams,
  FactoryParamValue,
} from './types.js';

export type CallSiteDiff =
  | { kind: 'add'; orbitalName: string; next: FactoryCallSite }
  | { kind: 'delete'; orbitalName: string; prior: FactoryCallSite }
  | {
      kind: 'edit';
      orbitalName: string;
      prior: FactoryCallSite;
      next: FactoryCallSite;
    }
  | { kind: 'keep'; orbitalName: string; call: FactoryCallSite };

export function diffFactoryCalls(
  prior: ReadonlyArray<FactoryCallSite>,
  next: ReadonlyArray<FactoryCallSite>,
): ReadonlyArray<CallSiteDiff> {
  const out: CallSiteDiff[] = [];
  const priorByKey = new Map(prior.map((c) => [callKey(c), c]));
  const nextByKey = new Map(next.map((c) => [callKey(c), c]));

  for (const [key, p] of priorByKey) {
    const n = nextByKey.get(key);
    if (!n) {
      out.push({ kind: 'delete', orbitalName: p.orbital, prior: p });
      continue;
    }
    if (paramsEqual(p.params, n.params)) {
      out.push({ kind: 'keep', orbitalName: p.orbital, call: n });
    } else {
      out.push({ kind: 'edit', orbitalName: p.orbital, prior: p, next: n });
    }
  }
  for (const [key, n] of nextByKey) {
    if (!priorByKey.has(key)) {
      out.push({ kind: 'add', orbitalName: n.orbital, next: n });
    }
  }
  return out;
}

function callKey(c: FactoryCallSite): string {
  return `${c.organism}::${c.orbital}`;
}

function paramsEqual(a: FactoryCallSiteParams, b: FactoryCallSiteParams): boolean {
  return canonicalParams(a) === canonicalParams(b);
}

function canonicalParams(p: FactoryCallSiteParams): string {
  const keys: Array<keyof FactoryCallSiteParams> = [
    'collection',
    'entityFields',
    'entityName',
    'extraTraits',
    'pagePaths',
    'persistence',
    'traitOverrides',
  ];
  const parts: string[] = [];
  for (const k of keys) {
    const v = p[k];
    if (v === undefined) continue;
    parts.push(`${k}:${canonicalNode(v)}`);
  }
  return `{${parts.join(',')}}`;
}

function canonicalNode(
  v:
    | string
    | FactoryCallSiteParams[keyof FactoryCallSiteParams],
): string {
  if (v === undefined) return 'u';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) {
    return `[${v.map((x) => canonicalParamValue(x as FactoryParamValue)).join(',')}]`;
  }
  const keys = Object.keys(v).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const child = (v as Readonly<Record<string, FactoryParamValue | { config?: Readonly<Record<string, FactoryParamValue>> }>>)[k];
    parts.push(`${JSON.stringify(k)}:${canonicalParamValue(child)}`);
  }
  return `{${parts.join(',')}}`;
}

function canonicalParamValue(
  v: FactoryParamValue | { config?: Readonly<Record<string, FactoryParamValue>> },
): string {
  if (v === null || v === undefined) return 'u';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) {
    return `[${v.map(canonicalParamValue).join(',')}]`;
  }
  const keys = Object.keys(v).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const child = (v as Readonly<Record<string, FactoryParamValue | undefined>>)[k];
    if (child === undefined) continue;
    parts.push(`${JSON.stringify(k)}:${canonicalParamValue(child)}`);
  }
  return `{${parts.join(',')}}`;
}
