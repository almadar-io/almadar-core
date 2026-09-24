// The one identity of a cascade delivery (Runtime Spec Clause 5.3); twin of orbital-core `dispatch_visit_key`.
import type { EventPayload, EventPayloadValue } from './expression.js';

function isPayloadList(value: EventPayloadValue): value is readonly EventPayloadValue[] {
  return Array.isArray(value);
}

function canonicalJson(value: EventPayloadValue): string {
  if (value === undefined || value === null) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (isPayloadList(value)) {
    return `[${value.map((item: EventPayloadValue) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record: EventPayload = value;
    const fields = Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`);
    return `{${fields.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** `(trait, event, from, payload)`: only an exact repeat of all four is a cycle. */
export function dispatchVisitKey(
  trait: string,
  event: string,
  from: string,
  payload: EventPayload | null | undefined,
): string {
  return `${trait}\u0000${event}\u0000${from}\u0000${canonicalJson(payload)}`;
}
