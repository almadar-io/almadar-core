/**
 * Three-way merge of an orbital's factory params: the common ancestor (`base`), and each side's
 * edit (`ours`, `theirs`). Objects merge key by key; a list whose items are objects carrying a
 * string `id` (entity fields, trait children, nav items) merges item by item and keeps either
 * side's reorder alongside the other's inserts; any other list is one value.
 *
 * Only a value both sides changed differently (`both-changed`) or an item/key one side removed
 * while the other changed it (`delete-vs-edit`) is a conflict. A conflicted value keeps ours in
 * `merged` until it is resolved.
 */
import { isJsonObject, type JsonObject, type JsonValue } from '../types/json.js';

export type ParamConflictKind = 'both-changed' | 'delete-vs-edit';

export interface ParamConflict {
  /** Keys and item ids from the params root to the conflicted value. */
  path: string[];
  kind: ParamConflictKind;
  /** `null` stands for absent. */
  base: JsonValue;
  ours: JsonValue;
  theirs: JsonValue;
}

export interface ParamsMerge {
  merged: JsonValue;
  conflicts: ParamConflict[];
}

type Maybe = JsonValue | undefined;

function canonical(v: JsonValue): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (isJsonObject(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k] ?? null)}`).join(',')}}`;
  return JSON.stringify(v);
}

const same = (a: Maybe, b: Maybe): boolean => (a === undefined || b === undefined ? a === b : canonical(a) === canonical(b));

type IdItem = JsonObject & { id: string };

function isIdList(v: Maybe): v is IdItem[] {
  return Array.isArray(v) && v.length > 0 && v.every((i) => isJsonObject(i) && typeof i['id'] === 'string');
}

const idList = (v: Maybe): v is IdItem[] => v === undefined || (Array.isArray(v) && v.length === 0) || isIdList(v);

export function mergeParams(base: JsonValue, ours: JsonValue, theirs: JsonValue): ParamsMerge {
  const conflicts: ParamConflict[] = [];
  const merged = mergeValue([], base, ours, theirs, conflicts);
  return { merged: merged === undefined ? null : merged, conflicts };
}

function mergeValue(path: string[], base: Maybe, ours: Maybe, theirs: Maybe, conflicts: ParamConflict[]): Maybe {
  if (same(ours, theirs)) return ours;
  if (same(base, ours)) return theirs;
  if (same(base, theirs)) return ours;
  if (ours !== undefined && theirs !== undefined && isJsonObject(ours) && isJsonObject(theirs) && (base === undefined || isJsonObject(base))) {
    return mergeObject(path, base, ours, theirs, conflicts);
  }
  if (ours !== undefined && theirs !== undefined && (isIdList(ours) || isIdList(theirs)) && idList(ours) && idList(theirs) && idList(base)) {
    return mergeIdList(path, base ?? [], ours, theirs, conflicts);
  }
  conflicts.push({
    path,
    kind: ours === undefined || theirs === undefined ? 'delete-vs-edit' : 'both-changed',
    base: base ?? null,
    ours: ours ?? null,
    theirs: theirs ?? null,
  });
  return ours;
}

function mergeObject(path: string[], base: JsonObject | undefined, ours: JsonObject, theirs: JsonObject, conflicts: ParamConflict[]): JsonObject {
  const out: JsonObject = {};
  const keys = [...new Set([...Object.keys(base ?? {}), ...Object.keys(ours), ...Object.keys(theirs)])];
  for (const key of keys) {
    const value = mergeValue([...path, key], base?.[key], ours[key], theirs[key], conflicts);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const idsOf = (list: readonly IdItem[]): string[] => list.map((i) => i.id);

function mergeIdList(path: string[], base: IdItem[], ours: IdItem[], theirs: IdItem[], conflicts: ParamConflict[]): JsonValue[] {
  const byId = (list: IdItem[]) => new Map(list.map((i) => [i.id, i]));
  const b = byId(base);
  const o = byId(ours);
  const t = byId(theirs);
  const result = new Map<string, JsonValue>();
  for (const id of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
    const value = mergeValue([...path, id], b.get(id), o.get(id), t.get(id), conflicts);
    if (value !== undefined) result.set(id, value);
  }

  // Order: the side that reordered the items both kept wins; the other side's additions follow
  // the item they followed there.
  const common = (list: IdItem[]) => idsOf(list).filter((id) => b.has(id));
  const reordered = (list: IdItem[]) => canonical(common(list).filter((id) => o.has(id) && t.has(id))) !== canonical(idsOf(base).filter((id) => o.has(id) && t.has(id)));
  const [primary, secondary] = reordered(ours) || !reordered(theirs) ? [ours, theirs] : [theirs, ours];
  const order = idsOf(primary).filter((id) => result.has(id));
  const secondaryIds = idsOf(secondary);
  secondaryIds.forEach((id, index) => {
    if (!result.has(id) || order.includes(id)) return;
    const before = secondaryIds.slice(0, index).reverse().find((prev) => order.includes(prev));
    order.splice(before === undefined ? 0 : order.indexOf(before) + 1, 0, id);
  });
  for (const id of result.keys()) if (!order.includes(id)) order.push(id);
  return order.map((id) => result.get(id) ?? null);
}
