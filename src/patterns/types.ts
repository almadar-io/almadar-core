/**
 * Shared types for @almadar/patterns
 *
 * @packageDocumentation
 */

import type { EventPayloadValue } from '../types/expression.js';

/**
 * Semantic kind marker for a pattern prop. Complements the structural
 * `types` field (which declares "string" / "array" / "object" / ...)
 * with meaning — *what is this value, beyond its JSON shape?*
 *
 * Consumers of the patterns registry (the Rust compiler's inline phase
 * in `orbital-compiler`, the JS preprocess in `@almadar/runtime`, and
 * verifiers in `@almadar-io/verify`) read `kind` to decide whether a
 * prop participates in call-site `events: { OLD: NEW }` renames,
 * entity substitutions, and similar structural rewrites. Without this
 * marker, consumers fall back to name-matching heuristics that drift
 * between implementations — the problem this field eliminates.
 *
 * Kinds:
 * - `"event"`      — the prop value is a declared event key (string).
 *                     Inline phase rewrites via the trait's events map.
 *                     Source type: `EventKey` from `@almadar/core`.
 * - `"event-list"` — the prop is an array of action-descriptor objects.
 *                     Each item has a field (default `"event"`, override
 *                     with {@link PatternPropDef.eventField}) holding a
 *                     declared event key. Same rename applies per item.
 * - `"entity"`     — the prop is the pattern's data INLET: the bound entity
 *                     record(s) it renders. The inlet half of the circuit,
 *                     symmetric with the event OUTLET kinds above. Source type:
 *                     `EntityRecord<T>` / `EntityCollection<T>` from
 *                     `@almadar/core`; {@link PatternPropDef.cardinality} says
 *                     which. Consumers bind the domain entity to it without
 *                     name-matching the prop (replacing the `'entity' in
 *                     propsSchema` name check).
 *
 * Reserved for future use: `"config-binding"`. Add here rather than
 * inventing per-consumer markers.
 */
export type PropKind =
  | 'event'
  | 'event-ref'
  | 'event-listen'
  | 'event-list'
  | 'callback'
  | 'entity';

/**
 * Recursive structural schema for array elements / nested objects, mirrored
 * into the registry by pattern-sync. Mirrors a tiny subset of JSON Schema
 * (and `PropTypeSchema` in the pattern-sync tool). Lets consumers make
 * element-aware decisions instead of falling back to name-list heuristics.
 */
export interface PatternPropTypeSchema {
  types: string[];
  enumValues?: string[];
  items?: PatternPropTypeSchema;
  properties?: Record<string, PatternPropTypeSchema>;
  required?: string[];
  /** Set when the value's source type is core `ScenePos` — the type-identity
   *  signal that grounds a pattern's `drawable` capability. */
  scenePos?: boolean;
  /** Set when the value's source type is the `DrawableNode` union — the type-identity
   *  signal that grounds a pattern's `drawHost` capability. */
  drawableSlot?: boolean;
}

/**
 * One field of an emit/listen payload schema, mirrored into the registry
 * by pattern-sync from a component's `EventEmit<P>` / `EventListen<P>`
 * brand. Validator (L2.2) compares this against the trait's declared
 * `emits { EVENT { ... } }` / `listens` payload shape.
 */
export interface PatternPayloadField {
  name: string;
  type: string;
  required?: boolean;
}

/**
 * One positional parameter of a React callback prop. Validator (L2.2)
 * uses the names to verify name-and-type parity with the trait's declared
 * event payload; codegen (C2) uses the same names to wrap the dispatch
 * site as `(name) => dispatch('EVENT', { name })`.
 */
export interface PatternCallbackArg {
  name: string;
  type: string;
}

/**
 * Schema describing a single prop in a pattern's propsSchema. Emitted
 * by the pattern-sync tool (`tools/almadar-pattern-sync/`) from a
 * component's TypeScript Props interface, consumed by every part of
 * the stack that inspects pattern shape.
 */
export interface PatternPropDef {
  /** Structural JSON types this prop accepts ("string", "array", ...). */
  types?: string[];
  /** Whether the prop is required at the pattern call site. */
  required?: boolean;
  /** Human-readable prop description (from TS JSDoc when available). */
  description?: string;
  /** Allowed literal values when the TS type is a string-literal union. */
  enumValues?: string[];
  /**
   * Comma-separated intent words from a `@synonyms` JSDoc tag on the prop
   * (parity with behaviors' knob `@synonyms`). Feeds the pattern embeddings +
   * the contextual-edit agent's intent→prop mapping. Absent when untagged.
   */
  synonyms?: string;
  /**
   * The prop's facing, from a `@tier` JSDoc tag — same enum as behaviors:
   * `domain` (user-meaningful) / `presentation` (styling) / `internal`
   * (wiring). Lets consumers prioritize the props a user is likely to edit.
   */
  tier?: 'domain' | 'presentation' | 'internal';
  /**
   * Semantic marker layered over {@link PatternPropDef.types}. Set by
   * the pattern-sync tool when the prop's TS type references a
   * semantic alias (e.g. `EventKey` from `@almadar/core`). Absent when
   * the prop has no additional semantic meaning beyond its JSON shape.
   */
  kind?: PropKind;
  /**
   * For `kind: "event-list"`: the name of the field inside each array
   * item that holds the event key. Defaults to `"event"` when
   * omitted. Only meaningful alongside `kind: "event-list"`.
   */
  eventField?: string;
  /**
   * For `kind: "entity"` (the data inlet): whether the prop binds a single
   * entity record (`"record"`) or a collection of records (`"collection"`).
   * Source: `EntityRecord<T>` vs `EntityCollection<T>` from `@almadar/core`.
   * The structural switch a consumer reads to know list-render vs detail-render
   * — declared, not inferred from `types: ["object"|"array"]`.
   */
  cardinality?: 'record' | 'collection';
  /**
   * Element schema for array-typed props (mirrors JSON Schema's `items`).
   * Emitted by pattern-sync from the TS element type; present in the registry
   * JSON but previously undeclared here (a typing gap fixed alongside the
   * inlet work). For an `EntityCollection<T>` inlet, its `properties` are the
   * fixed sub-slots when `T` is a concrete interface.
   */
  items?: PatternPropTypeSchema;
  /** Per-key schemas for object-typed props sourced from a declared interface. */
  properties?: Record<string, PatternPropTypeSchema>;
  /** Required keys for object-typed props sourced from a declared interface. */
  propertyRequired?: string[];
  /** Set when the prop's source type is core `ScenePos` — the type-identity signal
   *  that grounds the pattern's `drawable` capability (see {@link isDrawablePattern}). */
  scenePos?: boolean;
  /** Set when the prop's source type is the `DrawableNode` union — the type-identity
   *  signal that grounds the pattern's `drawHost` capability (see {@link isDrawHostPattern}). */
  drawableSlot?: boolean;
  /**
   * For `kind: "event-ref"` whose source is `EventEmit<P>`: the
   * structural shape of `P` — the bus payload the component fires when
   * the prop is bound. Validator compares against the trait's declared
   * `emits { EVENT { ... } }` payload.
   */
  emitPayloadSchema?: PatternPayloadField[];
  /**
   * For `kind: "event-listen"` whose source is `EventListen<P>`: the
   * structural shape of `P` — the payload the component subscribes to.
   */
  listenPayloadSchema?: PatternPayloadField[];
  /**
   * For `kind: "callback"`: positional parameter list of the function
   * type. C2 uses these names to build the named-arg → object-payload
   * wrapper at the dispatch site.
   */
  callbackArgs?: PatternCallbackArg[];
  /**
   * Default value extracted from the component's parameter destructuring
   * (`function Button({ size = 'md', variant = 'primary' })`). Surfaces
   * what the component would render in the absence of an explicit
   * override. Consumers:
   *
   * - The Studio drop pipeline (`apps/builder` `useSchemaEditor.addPattern`)
   *   seeds fresh SExpression nodes with these values so dropped patterns
   *   carry sensible content immediately.
   * - The Inspector reads it to hint at the implicit value when a prop
   *   isn't set on the SExpression.
   *
   * Populated by `almadar-pattern-sync` from each component's TS source
   * (initializer expressions on the first parameter's binding pattern).
   * Function-valued defaults (lambdas, callbacks) are omitted — only
   * JSON-serializable scalars / arrays / objects round-trip through the
   * registry.
   */
  default?: EventPayloadValue;
}
