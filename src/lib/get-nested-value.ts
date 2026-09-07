/**
 * `getNestedValue` — safely retrieve a nested value from an object using a
 * dot-notation path (e.g. `"company.address.city"`).
 *
 * Single owner moved here from `@almadar/ui/lib/getNestedValue` (Stage B
 * B1-F): emitted SERVER code cannot import `@almadar/ui` (a render-substrate
 * package), so a helper server-side codegen needs — reading a listen
 * payload's mapped field, a template binding, a display column — has to
 * live in core. `@almadar/ui/lib` re-exports this symbol for its own
 * consumers.
 *
 * @packageDocumentation
 */
import type { EventPayload, EventPayloadValue, FieldValue } from '../types/index.js';

type NestedValueInput =
  | EventPayload
  | EventPayloadValue
  | FieldValue
  | Record<string, FieldValue | undefined>
  | null
  | undefined;

/**
 * Get a nested value from an object using a dot-notation path.
 *
 * Widened over the UI original to admit every shape a payload/field value
 * can hold (`EventPayload`, `EventPayloadValue`, `FieldValue`) — a `string`,
 * `number`, `Date`, or array at any level bails to `undefined` rather than
 * traversing, since none of those are keyed objects.
 *
 * @example
 * const data = { company: { name: "Acme Corp", address: { city: "NYC" } } };
 * getNestedValue(data, "company.name");         // => "Acme Corp"
 * getNestedValue(data, "company.address.city"); // => "NYC"
 * getNestedValue(data, "company.missing");      // => undefined
 */
export function getNestedValue(obj: NestedValueInput, path: string): FieldValue | undefined {
  if (obj === null || obj === undefined || !path) return undefined;
  if (typeof obj !== 'object' || Array.isArray(obj)) return undefined;

  // Fast path: no dots means simple property access.
  if (!path.includes('.')) {
    return (obj as Record<string, FieldValue | undefined>)[path];
  }

  const parts = path.split('.');
  let value: Record<string, FieldValue | undefined> | FieldValue | undefined = obj as Record<
    string,
    FieldValue | undefined
  >;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) return undefined;
    value = (value as Record<string, FieldValue | undefined>)[part];
  }

  return value as FieldValue | undefined;
}
