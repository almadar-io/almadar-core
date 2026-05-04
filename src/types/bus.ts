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
 * Phantom-typed brand for declarative bus-emit props on UI components.
 *
 * Used by component authors to BOTH mark a prop as a bus-event reference
 * AND document the payload shape that the component will fire onto the
 * bus when that prop is bound. Authors write:
 *
 *     // Tabs.tsx
 *     export interface TabsProps {
 *       tabChangeEvent?: EventEmit<{ tabId: string }>;
 *     }
 *
 * Consumers see only the structural `string` (no UX impact: passing a
 * literal `"TAB_CHANGED"` keeps working). The phantom `P` parameter
 * carries the bus-payload schema at the type level for pattern-sync to
 * extract.
 *
 * Pattern-sync (`tools/almadar-pattern-sync/parser.ts`) detects this
 * brand via TS type-lookup (mirrors how it detects `EventKey`) and
 * writes two registry fields per prop:
 * - `kind: "event-ref"` — the discriminant rules read in lolo / orb
 *   validator to know "this prop's string value is a bus event name."
 * - `emitPayloadSchema` — the structural shape of `P`, serialized as
 *   the same JSON-Schema-shaped record Almadar uses for trait
 *   `payloadSchema`. Validator rules cross-check this against the
 *   trait's declared `emits { EVENT { ... } }` payload to catch mismatches
 *   at parse / validate time instead of runtime.
 *
 * Example payload bus emission inside the component (no wrapper —
 * `EventEmit<P>` erases to `string`):
 *
 *     if (tabChangeEvent) eventBus.emit(`UI:${tabChangeEvent}`, { tabId });
 *
 * The brand is structurally an unused optional readonly property; TS
 * never asks for it at construction, so authors and consumers never
 * see it.
 */
export type EventEmit<P> = string & { readonly __emitPayload?: P };

/**
 * Phantom-typed brand for declarative bus-listen props on UI components.
 *
 * Mirror of `EventEmit<P>`. Used by future patterns where a UI component
 * subscribes to a bus event and forwards its payload upward via prop
 * (e.g. an editor pattern that listens for `EXTERNAL_RESET` and exposes
 * the consumed payload to the parent). Pattern-sync detects this brand
 * the same way as `EventEmit<P>` and writes:
 * - `kind: "event-listen"` (or a sub-discriminant of `event-ref`)
 * - `listenPayloadSchema` with the structural shape of `P`
 *
 * Validator rules use this to verify the trait the prop is bound to
 * actually emits a payload of the expected shape.
 *
 * Reserved for symmetry; no @almadar/ui component uses it as of this
 * commit. Add usages incrementally as patterns require them.
 */
export type EventListen<P> = string & { readonly __listenPayload?: P };

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
