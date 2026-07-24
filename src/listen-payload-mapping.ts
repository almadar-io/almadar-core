/**
 * Listen-route payload mapping — the `with { field: ?sourceField }` clause.
 *
 * A `listens` entry's `payloadMapping` is `{ targetField: "@payload.<sourceField>" | literal }`
 * (see `TraitEventListener.payloadMapping`). Applying it rewrites the SOURCE
 * trait's outgoing payload into the shape the LOCAL trigger expects before the
 * internal event dispatches. ONE contract, shared by every delivery path:
 * the server runtime (`OrbitalServerRuntime`) and the client cross-trait
 * wiring (`@almadar/ui` useTraitStateMachine).
 *
 * @packageDocumentation
 */

import type { EventPayload } from './types/index';

/**
 * Apply a listen entry's `payloadMapping` to the source event payload.
 *
 * - No mapping, or no payload → the payload passes through unchanged.
 * - `"@payload.<field>"` values read that field from the source payload.
 * - Any other string value is a literal and is delivered verbatim.
 */
export function applyListenPayloadMapping(
    payloadMapping: Record<string, string> | undefined,
    payload: EventPayload | undefined,
): EventPayload | undefined {
    if (!payloadMapping || !payload) return payload;
    const mapped: EventPayload = {};
    for (const [key, expr] of Object.entries(payloadMapping)) {
        if (expr.startsWith('@payload.')) {
            mapped[key] = payload[expr.slice('@payload.'.length)];
        } else {
            mapped[key] = expr;
        }
    }
    return mapped;
}
