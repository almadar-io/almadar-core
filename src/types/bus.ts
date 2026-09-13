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
import type { OrbitalId, TraitId, EventId } from "./identity.js";
import type { EntityRow } from "./entity.js";

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

// NOTE: The phantom entity-inlet brands `EntityInlet`/`EntityRecord`/
// `EntityCollection` were removed in the entity-row clean slate. There is now
// ONE entity type — `EntityRow` (`./entity`), used directly: a single record is
// `EntityRow`, a collection is `readonly EntityRow[]`. pattern-sync detects an
// entity prop by the `EntityRow` type identity and derives record-vs-collection
// from array-vs-not, so no brand is needed.

/**
 * Identifies the origin of a bus event. Used by cross-trait listeners to
 * filter emits from specific orbitals, traits, transitions, or ticks.
 *
 * `transition` and `tick` are optional runtime-internal details; most
 * consumers only care about `orbital` and `trait`.
 */
export interface BusEventSource {
  orbital?: string;
  /** V4 dual-carry id sibling of `orbital` — stable across an orbital rename. */
  orbitalId?: OrbitalId;
  trait?: string;
  /** V4 dual-carry id sibling of `trait` — stable across a trait rename. */
  traitId?: TraitId;
  /** V4 dual-carry id of the emitted event — stable across an event rename. */
  eventId?: EventId;
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
   * True ONLY for bridge echoes the receiving tab already processed, so
   * the originating trait's self-subscription skips them instead of
   * re-dispatching its own echo (infinite loop / double execution).
   * Set by path 1 of useOrbitalBridge (compiled shell — echo of the
   * just-dispatched event; server-side cascade emits there carry
   * `fromBridge: true` but NOT `dispatched`, so they still reach the
   * source trait's transition handler, e.g. `loading -> browsing` on a
   * fetch's `emit.success`) and by ServerBridge (runtime path — stamped
   * on exactly one response-cascade echo per event the dispatch delivered
   * locally on the bare key, `stampLocallyDeliveredEchoes`; server-only
   * results stay unstamped). Cross-trait `listens` never filter on this
   * flag, so their delivery is unaffected. Push-leg events from OTHER
   * tabs (multiplayer) are never stamped.
   */
  dispatched?: boolean;
  /**
   * The client that originated the dispatch whose effects emitted this
   * event (from `OrbitalEventRequest.clientId`); absent for headless
   * dispatches (ticks, circuit-router probes, walkers). The server-side
   * listens fan-out skips client-originated cascade emits — under dual
   * execution the originating client relays every cascade hop through the
   * bridge itself, so the server dispatching the same hop double-ran it
   * (one Send persisted two rows). Headless topology keeps the fan-out:
   * there is no client to drive the circuit.
   */
  originClientId?: string;
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

/**
 * One event a transition's effects emitted, carried back to the client to
 * re-dispatch (in order) so the state machine advances through the
 * cascade without server-side recursion. Named/shaped to match the
 * generated compiled-path `EmittedEvent` (orbital-shell-typescript's
 * `shared/types.ts`) so the two execution paths agree on one shape.
 */
export interface EmittedEvent {
  event: string;
  payload?: EventPayload;
  source?: BusEventSource;
}

/**
 * Client → server event dispatch request. The single upstream owner of
 * this shape — both the JS interpreter and the compiled path's generated
 * `EventRequest` (orbital-shell-typescript's `shared/types.ts`) carry the
 * same fields, so the two execution paths cannot drift.
 */
export interface EventDispatchRequest {
  event: string;
  payload?: EventPayload;
  /** Current client state, for validation. */
  currentState?: string;
  /** Per-tab client id — the live-broadcast origin-exclusion key. */
  clientId?: string;
  /**
   * The dispatching trait's current `@entity` frame (declared defaults <
   * fetched row < `[shared]` frame). The server layers it over the row it
   * resolves via `resolveEntityView` so guards and effects read the same
   * values the client does.
   */
  fields?: EntityRow;
}

/**
 * Server → client event dispatch response. Mirrors the compiled path's
 * generated `EventResponse` (orbital-shell-typescript's `shared/types.ts`);
 * kept field-for-field in sync except `effectResults`, which core has no
 * canonical shape for yet (the per-app generated `EffectResult` is
 * distinct from core's `EffectResult` in `types/living.ts` — reusing that
 * one would misdescribe this field, so it is intentionally omitted here).
 */
export interface EventDispatchResponse {
  success: boolean;
  newState?: string;
  data?: Record<string, EntityRow[]>;
  /** Events emitted while running this transition's effects, in order. */
  emittedEvents?: EmittedEvent[];
  /**
   * `@entity` fields this transition's server-side `set` effects wrote,
   * post-effect. The client merges them over its own effect results
   * (server wins).
   */
  fields?: EntityRow;
  error?: string;
  /** Guard that failed, for debugging. */
  guardFailed?: string;
}
