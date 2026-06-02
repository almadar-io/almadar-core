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
 * Phantom-typed brand for a component's data INLET, cardinality-neutral. The
 * shared base of `EntityRecord<T>` / `EntityCollection<T>`: it declares "this
 * prop is the bound-entity inlet" (the role) WITHOUT committing to record vs
 * collection. Structurally `(T | readonly T[])`.
 *
 * Use it on a SHARED base interface (e.g. `EntityDisplayProps<T>.entity`) whose
 * concrete extenders render either one record or a list — each extender narrows
 * to `EntityRecord<T>` / `EntityCollection<T>` in its own Props, and both are
 * assignable back to `EntityInlet<T>` (they intersect it), so the `extends`
 * stays sound. A prop left as `EntityInlet<T>` gets `kind: "entity"` with the
 * cardinality supplied by pattern-sync's base-prop default.
 */
export type EntityInlet<T> = (T | readonly T[]) & { readonly __entityInlet?: true };

/**
 * Phantom-typed brand for a component's data INLET binding a SINGLE entity
 * record. The inlet half of a pattern's circuit, symmetric with the event
 * OUTLET brands above: just as `EventEmit<P>` declares "this prop is a bus
 * outlet" by type identity, `EntityRecord<T>` declares "this prop is the
 * bound-entity inlet, cardinality = one record."
 *
 * Structurally `(T | readonly T[])` — the SAME permissive shape as
 * `EntityCollection<T>` — because record renderers routinely accept an array
 * and collapse to its first element (e.g. DetailPanel's
 * `Array.isArray(entity) ? entity[0] : entity`). The `cardinality: "record"` is
 * therefore a DECLARED intent carried by the brand, not a structural
 * constraint, so annotating an existing `entity: T | readonly T[]` prop is a
 * pure type swap with no body change. The two inlet brands differ ONLY in the
 * declared cardinality — that is the whole point: the shape is declared.
 *
 * Pattern-sync (`tools/almadar-pattern-sync/parser.ts`) detects this brand by
 * type identity — imported from `@almadar/core`, exactly like `EventKey` /
 * `EventEmit<P>` — and writes into the patterns registry:
 * - `kind: "entity"` — the discriminant declaring this prop is the data inlet.
 * - `cardinality: "record"` — one record (vs a collection).
 * - the element's fixed sub-slots (via `items.properties`) when `T` is a
 *   concrete interface; a generic `T` stays field-open (the domain entity
 *   supplies the fields at compose time).
 *
 * Consumers read the inlet descriptor to bind the domain entity WITHOUT
 * name-matching the prop, closing the pattern's circuit deterministically.
 *
 *     // DetailPanel.tsx
 *     entity: EntityRecord<T>;   // -> kind:"entity", cardinality:"record"
 */
export type EntityRecord<T> = EntityInlet<T> & {
  readonly __entityCardinality?: "record";
};

/**
 * Phantom-typed brand for a component's data INLET binding a COLLECTION of
 * entity records. Mirror of `EntityRecord<T>` with `cardinality: "collection"`.
 *
 * The structural type is `T | readonly T[]` — matching the real, permissive
 * contract of collection renderers (they accept a single record and normalize
 * it to a one-element list, e.g. DataGrid's `Array.isArray(entity) ? entity :
 * [entity]`). The `cardinality: "collection"` is therefore a DECLARED intent
 * carried by the brand, not a structural constraint — so annotating an existing
 * `entity: T | readonly T[]` prop is a pure type swap with no body change.
 *
 *     // DataGrid.tsx
 *     entity: EntityCollection<T>;  // -> kind:"entity", cardinality:"collection"
 */
export type EntityCollection<T> = EntityInlet<T> & {
  readonly __entityCardinality?: "collection";
};

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
