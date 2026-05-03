/**
 * Bus Event Types (framework concept)
 *
 * Canonical event shape for Almadar's cross-package event bus. Hoisted into
 * `@almadar/core` so `@almadar/ui`, `@almadar/runtime`, and generated code
 * all agree on the same structure. Replaces the previously divergent
 * `KFlowEvent` (ui) and `RuntimeEvent` (runtime) definitions.
 *
 * @packageDocumentation
 */

import type { EventPayload } from "./expression.js";

/**
 * Declared event key. A trait's event names (INIT, SAVE, CLOSE,
 * CONFIRM_REMOVE, ...) flow through the orbital schema and the UI as
 * strings; this alias marks "this string is a declared event key, not
 * arbitrary text."
 *
 * Component props typed as `EventKey` are detected by the pattern-sync
 * tool (`tools/almadar-pattern-sync/parser.ts`) via a TS-type lookup and
 * marked as `kind: "event"` in the patterns registry
 * (`@almadar/patterns`). Consumers of the registry — the Rust compiler's
 * inline phase and the `@almadar/runtime` preprocess — read that marker
 * to apply call-site `events: { OLD: NEW }` renames to render-ui trees
 * without name-matching heuristics.
 *
 * Plain alias over `string`. Not branded because event keys originate
 * from user data at runtime (orb schema literals, bus emits), so cast
 * friction would buy nothing. The value of the alias is at the type
 * surface — it's a marker the pattern-sync tool can find via
 * `getSymbolAtLocation`.
 */
export type EventKey = string;

/**
 * Identifies the origin of a bus event. Used by cross-trait listeners to
 * filter emits from specific orbitals, traits, transitions, or ticks.
 *
 * `transition` and `tick` are optional runtime-internal details; most
 * consumers only care about `orbital` and `trait`.
 */
export interface BusEventSource {
  orbital?: string;
  trait?: string;
  transition?: string;
  tick?: string;
  /**
   * True when the orbital bridge re-broadcasts an event onto the bus
   * (any source — both echoes of the dispatched event and server-side
   * cascade emits via `(emit X)` / `fetch.emit.success`). Cross-trait
   * listeners filter on this flag so the click-time qualified emit
   * (which has no `fromBridge`) doesn't double-fire alongside the
   * post-server bridge confirmation. See `dispatched` for the narrower
   * "echo of the just-dispatched event" signal.
   */
  fromBridge?: boolean;
  /**
   * True ONLY for the bridge echo of the event the source trait JUST
   * dispatched (path 1 of useOrbitalBridge). The originating trait's
   * `useUIEvents` skips events with this flag to prevent the source
   * from re-dispatching its own bridge echo (infinite loop). Server-
   * side cascade emits (path 2) carry `fromBridge: true` but NOT
   * `dispatched`, so they reach the source trait's transition handler
   * — that's how a fetch's `emit.success` advances the trait's own
   * state machine (e.g. `loading -> browsing` on `BrowseItemLoaded`).
   */
  dispatched?: boolean;
}

/**
 * An event flowing on the bus.
 *
 * The `source` field is structured so cross-trait listeners can match
 * `event.source?.orbital === 'X' && event.source?.trait === 'Y'` without
 * parsing a delimiter.
 */
export interface BusEvent {
  /** Event type identifier (e.g., 'CartItemLoaded', 'TASK_COMPLETED') */
  type: EventKey;
  /** Optional structured payload */
  payload?: EventPayload;
  /** Timestamp when the event was emitted */
  timestamp: number;
  /** Optional origin info for filtering */
  source?: BusEventSource;
}

/** Bus event listener callback. */
export type BusEventListener = (event: BusEvent) => void;

/** Returned by `on()` / `once()` to detach a listener. */
export type Unsubscribe = () => void;
