import patternsRegistry from './patterns-registry.json' with { type: 'json' };
import integratorsRegistry from './integrators-registry.json' with { type: 'json' };
import componentMapping from './component-mapping.json' with { type: 'json' };
import eventContracts from './event-contracts.json' with { type: 'json' };

// Export both registries
export { patternsRegistry, integratorsRegistry, componentMapping, eventContracts };

// Export pattern types for compile-time validation
export {
  PatternType,
  PatternPropsMap,
  PatternProps,
  PatternConfig,
  AnyPatternConfig,
  PATTERN_TYPES,
  isValidPatternType,
} from './pattern-types.js';

// Content-grade vs chrome classification (single owner — lint/slot consumers)
export {
  RenderUiPayload,
  isContentBodyPattern,
  isContentBodyPatternType,
  isMainSlotRenderUi,
} from './content-grade.js';

// Backwards compatible alias - registry refers to patterns registry
export const registry = patternsRegistry;

export const PATTERN_REGISTRY = patternsRegistry;
export const INTEGRATORS_REGISTRY = integratorsRegistry;
export const COMPONENT_MAPPING = componentMapping;
export const EVENT_CONTRACTS = eventContracts;

import type { PatternPropDef } from './types.js';

export type {
  PatternPropDef,
  PropKind,
  PatternPayloadField,
  PatternCallbackArg,
} from './types.js';

// Canonical emit-payload shapes dispatched by framework data patterns.
// Pattern-level contracts live alongside the pattern registry; the
// framework-level primitives (EventPayloadValue, FieldValue) stay in
// @almadar/core.
export type {
  ItemActionPayload,
  SelectionChangePayload,
  LoadMoreRequestPayload,
  FormSubmitPayload,
} from './payloads.js';

export type PatternEntry = {
  type: string;
  category: string;
  /** Atomic-design tier of the mapped component: 'atoms' | 'molecules' | 'organisms' | 'templates'. */
  tier?: string;
  /** Component family from the @almadar/ui family-first layout: 'core' | 'game' | 'marketing' | 'avl'. */
  family?: string;
  description?: string;
  suggestedFor?: string[];
  typicalSize?: string;
  propsSchema?: Record<string, PatternPropDef>;
  entityAware?: boolean;
  /** True when the pattern is a neutral DRAWABLE — its props are grounded in core
   *  `ScenePos`. Set by pattern-sync from the `ScenePos` type identity (not a
   *  name/signal); gates what may compose under a draw-host canvas's `children`. */
  drawable?: boolean;
  /** True when the pattern is a canvas DRAW-HOST — it declares a slot of drawables
   *  (`drawables: DrawableNode[]`). Set by pattern-sync from the `DrawableNode` type
   *  identity (not a name/signal); UISlotRenderer routes the host's authored
   *  `children` into its `drawables` prop (painted) instead of DOM-wrapping them. */
  drawHost?: boolean;
};

type PatternsRegistry = {
  version?: string;
  exportedAt?: string;
  patterns: Record<string, PatternEntry>;
  categories?: string[];
};

type ComponentMappingEntry = {
  component: string;
  importPath: string;
  category: string;
};

type ComponentMapping = {
  version?: string;
  exportedAt?: string;
  mappings: Record<string, ComponentMappingEntry>;
};

export function getPatternDefinition(patternType: string): PatternEntry | null {
  return (patternsRegistry as PatternsRegistry).patterns?.[patternType] ?? null;
}

export function getComponentForPattern(patternType: string): string | null {
  const mapping = componentMapping as ComponentMapping;
  return mapping.mappings?.[patternType]?.component ?? null;
}

/**
 * Check if a pattern is entity-aware (requires data injection).
 *
 * A pattern is entity-aware when it declares an `entity` prop in its
 * propsSchema, regardless of the declared type. Display patterns like
 * DataGrid and Timeline declare entity as "string" or "unknown" but
 * still need entity data injected at runtime.
 *
 * @param patternType - Pattern type to check
 * @returns true if the pattern is entity-aware
 */
export function isEntityAwarePattern(patternType: string): boolean {
  const definition = getPatternDefinition(patternType);
  if (!definition) return false;

  // Explicit flag takes precedence
  if (definition.entityAware === true) return true;

  const propsSchema = definition.propsSchema;
  if (!propsSchema) return false;

  // Any pattern with an entity prop needs data injection
  return 'entity' in propsSchema;
}

/**
 * Check if a pattern is a neutral DRAWABLE — a descriptor the canvas draw-host
 * paints (draw-sprite / draw-shape / draw-text / draw-sprite-layer /
 * draw-shape-layer), as opposed to a DOM/React pattern.
 *
 * A pattern is drawable when its props are grounded in core `ScenePos`: it
 * declares a `position: ScenePos` (atoms) or a `-layer` whose `items` element
 * carries one (molecules). Mirrors {@link isEntityAwarePattern}: an explicit
 * `drawable` flag (stamped by pattern-sync from the `ScenePos` type identity)
 * takes precedence, with a structural `scenePos`-tag fallback. This is what the
 * orbital-rust validator consults to gate a canvas host's `children`.
 *
 * @param patternType - Pattern type to check
 * @returns true if the pattern is a drawable
 */
export function isDrawablePattern(patternType: string): boolean {
  const definition = getPatternDefinition(patternType);
  if (!definition) return false;

  // Explicit flag takes precedence.
  if (definition.drawable === true) return true;

  const propsSchema = definition.propsSchema;
  if (!propsSchema) return false;

  // Structural fallback: any prop grounded in core `ScenePos` (directly or
  // transitively through array items / object properties).
  return Object.values(propsSchema).some(propGroundsDrawable);
}

/** The subset of a prop schema this walk needs — the `scenePos` tag plus the
 *  recursive `items`/`mapValue`/`properties` shape both `PatternPropDef` and
 *  `PatternPropTypeSchema` satisfy structurally. */
interface ScenePosProbe {
  scenePos?: boolean;
  items?: ScenePosProbe;
  mapValue?: ScenePosProbe;
  properties?: Record<string, ScenePosProbe>;
}

/** True when a prop def is (or transitively contains) a core-`ScenePos`-typed value. */
function propGroundsDrawable(schema: ScenePosProbe): boolean {
  if (schema.scenePos) return true;
  if (schema.items && propGroundsDrawable(schema.items)) return true;
  if (schema.mapValue && propGroundsDrawable(schema.mapValue)) return true;
  if (schema.properties) {
    for (const v of Object.values(schema.properties)) {
      if (propGroundsDrawable(v)) return true;
    }
  }
  return false;
}

/**
 * Check if a pattern is a canvas DRAW-HOST — a component that paints authored
 * `children` (canvas-2d / canvas-3d / the unified canvas), as opposed to a
 * DOM/React container that wraps its children.
 *
 * A pattern is a draw-host when it declares a slot of drawables: a prop typed
 * `DrawableNode[]` (the host's `drawables`). Mirrors {@link isDrawablePattern}:
 * an explicit `drawHost` flag (stamped by pattern-sync from the `DrawableNode`
 * type identity) takes precedence, with a structural `drawableSlot`-tag fallback.
 * This is what UISlotRenderer consults to route a host's `children` into its
 * `drawables` prop (painted) instead of DOM-wrapping them.
 *
 * @param patternType - Pattern type to check
 * @returns true if the pattern is a draw-host
 */
export function isDrawHostPattern(patternType: string): boolean {
  const definition = getPatternDefinition(patternType);
  if (!definition) return false;

  // Explicit flag takes precedence.
  if (definition.drawHost === true) return true;

  const propsSchema = definition.propsSchema;
  if (!propsSchema) return false;

  // Structural fallback: any prop typed as a `DrawableNode` slot (directly or
  // transitively through array items / object properties).
  return Object.values(propsSchema).some(propHostsDrawables);
}

/** The subset of a prop schema the draw-host walk needs — the `drawableSlot` tag
 *  plus the recursive shape both `PatternPropDef` and `PatternPropTypeSchema` satisfy. */
interface DrawableSlotProbe {
  drawableSlot?: boolean;
  items?: DrawableSlotProbe;
  mapValue?: DrawableSlotProbe;
  properties?: Record<string, DrawableSlotProbe>;
}

/** True when a prop def is (or transitively contains) a `DrawableNode`-typed slot. */
function propHostsDrawables(schema: DrawableSlotProbe): boolean {
  if (schema.drawableSlot) return true;
  if (schema.items && propHostsDrawables(schema.items)) return true;
  if (schema.mapValue && propHostsDrawables(schema.mapValue)) return true;
  if (schema.properties) {
    for (const v of Object.values(schema.properties)) {
      if (propHostsDrawables(v)) return true;
    }
  }
  return false;
}

// Export prompt helpers for @almadar/skills
export {
  getPatternsGroupedByCategory,
  getPatternPropsCompact,
  getPatternActionsRef,
  generatePatternDescription,
  getAllPatternTypes,
  getPatternMetadata,
  getOrbAllowedPatterns,
  getOrbAllowedPatternsCompact,
  getOrbAllowedPatternsSlim,
  getOrbAllowedPatternsFiltered,
} from './helpers/prompt-helpers.js';

export {
  collectRenderUiPatternTypes,
  renderUiPatternTypesOf,
} from './helpers/render-ui-pattern-types.js';

// Export pattern recommender for @almadar/agent design tool
export {
  recommendPatterns,
  buildRecommendationContext,
  formatRecommendationsForPrompt,
  type RecommendationContext,
  type PatternRecommendation,
} from './helpers/pattern-recommender.js';

// Export pattern-swap shape gate (contextual edit: deterministic compatibility)
export {
  findCompatiblePatterns,
  getEntityCardinality,
  getEmittedEvents,
  type PatternSwapGate,
} from './helpers/pattern-swap.js';
