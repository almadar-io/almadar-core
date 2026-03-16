/**
 * Shared Intermediate Representation Types
 *
 * Unified IR types used by both the compiler and runtime.
 * This is the single source of truth for IR structures.
 *
 * @packageDocumentation
 */

import type { SExpr // ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object is a ResolvedIR.
 * 
 * Validates that an unknown value conforms to the ResolvedIR structure.
 * Checks for required properties and correct types. Used for runtime
 * type checking and validation.
 * 
 * @param {unknown} ir - Value to check
 * @returns {boolean} True if value is ResolvedIR, false otherwise
 * 
 * @example
 * if (isResolvedIR(schema)) {
 *   // Type-safe access to ResolvedIR properties
 *   console.log('Valid IR:', schema.appName);
 * }
 */
// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object is a ResolvedIR.
 * 
 * Validates that an unknown value conforms to the ResolvedIR structure.
 * Checks for required properties and correct types. Used for runtime
 * type checking and validation.
 * 
 * @param {unknown} ir - Value to check
 * @returns {boolean} True if value is ResolvedIR, false otherwise
 * 
 * @example
 * if (isResolvedIR(schema)) {
 *   // Type-safe access to ResolvedIR properties
 *   console.log('Valid IR:', schema.appName);
 * }
 */
export function isResolvedIR(ir: unknown): ir is ResolvedIR {
=======
export function isResolvedIR(ir: unknown): ir is ResolvedIR {
=======
// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object is a ResolvedIR.
 * 
 * Validates that an unknown value conforms to the ResolvedIR structure.
 * Checks for required properties and correct types. Used for runtime
 * type checking and validation.
 * 
 * @param {unknown} ir - Value to check
 * @returns {boolean} True if value is ResolvedIR, false otherwise
 * 
 * @example
 * if (isResolvedIR(schema)) {
 *   // Type-safe access to ResolvedIR properties
 *   console.log('Valid IR:', schema.appName);
 * }
 */
export function isResolvedIR(ir: unknown): ir is ResolvedIR { from './expression.js';

// Type Guards
// ============================================================================

export function isResolvedIR(ir: unknown): ir is ResolvedIR {
  if (!ir || typeof ir !== 'object') return false;
  const r = ir as ResolvedIR;
  return typeof r.appName === 'string' && r.traits instanceof Map && r.pages instanceof Map;
}
=======
// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object is a ResolvedIR.
 * 
 * Validates that an unknown value conforms to the ResolvedIR structure.
 * Checks for required properties and correct types. Used for runtime
 * type checking and validation.
 * 
 * @param {unknown} ir - Value to check
 * @returns {boolean} True if value is ResolvedIR, false otherwise
 * 
 * @example
 * if (isResolvedIR(schema)) {
 *   // Type-safe access to ResolvedIR properties
 *   console.log('Valid IR:', schema.appName);
 * }
 */
export function isResolvedIR(ir: unknown): ir is ResolvedIR {
  if (!ir || typeof ir !== 'object') return false;
  const r = ir as ResolvedIR;
  return typeof r.appName === 'string' && r.traits instanceof Map && r.pages instanceof Map;
}============================================================================
// Transition Types
// ============================================================================

/**
 * Transition source state specification.
 * - string: Single state name (e.g., 'Idle')
 * - '*': Wildcard - matches any current state
 * - string[]: Array of states - matches any of the listed states
 */
export type TransitionFrom = string | '*' | string[];

// ============================================================================
// Field Types
// ============================================================================

export interface ResolvedField {
  name: string;
  type: string;
  tsType: string;
  description?: string;
  default?: unknown;
  required: boolean;
  validation?: unknown;
  /** Enum values for enum or constrained string fields */
  values?: string[];
  /** Enum values (alias for values, for compatibility) */
  enumValues?: string[];
  /** Relation configuration for foreign key references */
  relation?: {
    entity: string;
    cardinality?: string;
    field?: string;
  };
}

// ============================================================================
// Entity Types
// ============================================================================

export interface ResolvedEntity {
  name: string;
  description?: string;
  icon?: string;
  collection: string;
  fields: ResolvedField[];

  /** Whether this entity only exists in runtime (not persisted to Firestore) */
  runtime?: boolean;

  /** Whether this is a singleton entity (only one instance exists) */
  singleton?: boolean;

  /** Whether this entity has pre-authored instances in the schema */
  hasInstances?: boolean;

  /** Pre-authored instances from the schema (seed data or static reference data) */
  instances?: Record<string, unknown>[];

  /** Default field values from schema (for spawning singletons) */
  defaults?: Record<string, unknown>;

  // Cross-references
  usedByTraits: string[];
  usedByPages: string[];
}

export interface ResolvedEntityBinding {
  /** Binding name in code */
  name: string;

  /** Entity being bound */
  entity: ResolvedEntity;

  /** CRUD operations to generate */
  operations: ('list' | 'get' | 'create' | 'update' | 'delete')[];
}

// ============================================================================
// Trait Types
// ============================================================================

export interface ResolvedTraitState {
  name: string;
  isInitial: boolean;
  isFinal: boolean;
}

export interface ResolvedTraitEvent {
  key: string;
  name: string;
  payload?: Record<string, string>;
}

export interface ResolvedTraitTransition {
  /** Source state(s): string, '*' for wildcard, or array of states */
  from: TransitionFrom;
  to: string;
  event: string;
  guard?: SExpr;
  effects: SExpr[];
}

export interface ResolvedTraitGuard {
  name: string;
  condition: SExpr;
}

export interface ResolvedTraitTick {
  name: string;
  interval: number | 'frame';
  guard?: SExpr;
  effects: SExpr[];
  priority: number;
  appliesTo: string[];
}

export interface ResolvedTraitListener {
  event: string;
  triggers: string;
  guard?: SExpr;
}

export interface ResolvedTraitDataEntity {
  name: string;
  fields: ResolvedField[];
  runtime: boolean;
  singleton: boolean;
}

/**
 * UI binding for interaction traits - maps states to presentations
 */
export interface ResolvedTraitUIBinding {
  [stateName: string]: {
    /** Presentation type: modal, drawer, popover, inline, confirm-dialog */
    presentation: string;
    /** Content pattern(s) to render */
    content: Record<string, unknown> | Record<string, unknown>[];
    /** Presentation props */
    props?: {
      size?: string;
      position?: string;
      title?: string;
      closable?: boolean;
      width?: string;
      showProgress?: boolean;
      step?: number;
      totalSteps?: number;
    };
  };
}

/**
 * Fully resolved trait - expanded from schema OR library.
 * The compiler generates code from this structure universally,
 * without knowing which specific trait it is.
 */
export interface ResolvedTrait {
  /** Unique trait identifier */
  name: string;

  /** Human-readable description */
  description?: string;

  /** Where this trait came from */
  source: 'schema' | 'library' | 'inline';

  /** Category for organizing traits */
  category?: 'lifecycle' | 'temporal' | 'validation' | 'notification' | 'integration' | 'interaction' |
  'game-core' | 'game-character' | 'game-ai' | 'game-combat' | 'game-items' | 'game-cards' | 'game-board' | 'game-puzzle';

  // State Machine (all optional - not all traits have state machines)
  states: ResolvedTraitState[];
  events: ResolvedTraitEvent[];
  transitions: ResolvedTraitTransition[];
  guards: ResolvedTraitGuard[];

  // Behavior
  ticks: ResolvedTraitTick[];

  // Communication
  listens: ResolvedTraitListener[];

  // Data
  dataEntities: ResolvedTraitDataEntity[];

  // Instance configuration (from page binding)
  config?: Record<string, unknown>;

  // UI Bindings for interaction traits
  ui?: ResolvedTraitUIBinding;
}

/**
 * Trait binding on a page - links a resolved trait to the page
 */
export interface ResolvedTraitBinding {
  /** Reference name */
  ref?: string;

  /** Fully resolved trait */
  trait: ResolvedTrait;

  /** Entity this trait operates on (if any) */
  linkedEntity?: string;

  /** Instance configuration */
  config?: Record<string, unknown>;
}

// ============================================================================
// Pattern & Section Types
// ============================================================================

export interface ResolvedPattern {
  /** Pattern type (e.g., 'page-header', 'entity-list', 'game-canvas') */
  type: string;

  /** Pattern configuration */
  config: Record<string, unknown>;

  /** Shell component to use */
  shellComponent?: string;
}

export interface ResolvedSectionEvent {
  event: string;
  action: string;
  target?: string;
}

export interface ResolvedSection {
  /** Section identifier */
  id: string;

  /** Resolved pattern */
  pattern: ResolvedPattern;

  /** Events emitted by this section */
  events: ResolvedSectionEvent[];

  /** Position in page layout */
  position?: number;

  /** Entity binding for this section */
  binding?: ResolvedEntityBinding;
}

// ============================================================================
// Page Types
// ============================================================================

export interface ResolvedNavigation {
  event?: string;
  from?: string;
  to: string;
  trigger?: string;
  params?: Record<string, string>;
  label?: string;
  path?: string;
  icon?: string;
}

export interface ResolvedPage {
  /** Page identifier */
  name: string;

  /** URL path */
  path: string;

  /** Feature folder name */
  featureName: string;

  /** Layout component */
  layout?: string;

  /** View type (dashboard, list, detail, create, edit) */
  viewType?: 'dashboard' | 'list' | 'detail' | 'create' | 'edit';

  /** Resolved sections */
  sections: ResolvedSection[];

  /** Resolved trait bindings */
  traits: ResolvedTraitBinding[];

  /** Entity data bindings */
  entityBindings: ResolvedEntityBinding[];

  /** Navigation wiring */
  navigation: ResolvedNavigation[];

  /** Singleton entities to spawn on this page (runtime singletons) */
  singletonEntities: ResolvedEntity[];
}

// ============================================================================
// IR Types
// ============================================================================

/**
 * Complete resolved IR - all references expanded
 */
export interface ResolvedIR {
  /** App name */
  appName: string;

  /** App description */
  description?: string;

  /** App version */
  version?: string;

  /** All resolved entities (Map for lookup) */
  entities: Map<string, ResolvedEntity>;

  /** All resolved traits (Map for lookup) */
  traits: Map<string, ResolvedTrait>;

  /** All resolved pages (Map for lookup) */
  pages: Map<string, ResolvedPage>;

  /** Entity bindings (used for data hook generation) */
  entityBindings: ResolvedEntityBinding[];

  /** Raw data entities (used for instance data generation) */
  rawEntities?: unknown[];

  /** Generation timestamp */
  generatedAt: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates an empty resolved trait with default structure.
 * 
 * Generates a skeleton ResolvedTrait object with empty arrays for all
 * collections. Used as a template or fallback when creating trait instances.
 * 
 * @param {string} name - Trait name
 * @param {'schema' | 'library' | 'inline'} source - Trait source type
 * @returns {ResolvedTrait} Empty trait structure
 * 
 * @example
 * const emptyTrait = createEmptyResolvedTrait('MyTrait', 'schema');
 * // Returns: { name: 'MyTrait', source: 'schema', states: [], ... }
 */
export function createEmptyResolvedTrait(name: string, source: 'schema' | 'library' | 'inline'): ResolvedTrait {
  return {
    name,
    source,
    states: [],
    events: [],
    transitions: [],
    guards: [],
    ticks: [],
    listens: [],
    dataEntities: [],
  };
}

/**
 * Creates an empty resolved page with default structure.
 * 
 * Generates a skeleton ResolvedPage object with default path and empty
 * arrays for all collections. Used as a template or fallback when creating
 * page instances.
 * 
 * @param {string} name - Page name
 * @returns {ResolvedPage} Empty page structure with default path
 * 
 * @example
 * const emptyPage = createEmptyResolvedPage('Dashboard');
 * // Returns: { name: 'Dashboard', path: '/dashboard', featureName: 'dashboard', ... }
 */
export function createEmptyResolvedPage(name: string): ResolvedPage {
  return {
    name,
    path: `/${name.toLowerCase()}`,
    featureName: name.toLowerCase(),
    sections: [],
    traits: [],
    entityBindings: [],
    navigation: [],
    singletonEntities: [],
  };
}

/**
 * Infer TypeScript type from schema type
 */
export function inferTsType(schemaType: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'Date',
    datetime: 'Date',
    timestamp: 'number',
    array: 'unknown[]',
    object: 'Record<string, unknown>',
    any: 'unknown',
  };

  // Handle array types like "string[]"
  if (schemaType.endsWith('[]')) {
    const baseType = schemaType.slice(0, -2);
    return `${typeMap[baseType] || baseType}[]`;
  }

  return typeMap[schemaType] || schemaType;
}

/**
 * Creates a resolved field with TypeScript type inference.
 * 
 * Converts a field definition to a ResolvedField object with automatic
 * TypeScript type inference. Used during schema resolution to create
 * type-safe field definitions.
 * 
 * @param {Object} field - Field definition
 * @param {string} field.name - Field name
 * @param {string} field.type - Field type
 * @param {string} [field.description] - Optional description
 * @param {unknown} [field.default] - Optional default value
 * @param {boolean} [field.required] - Required flag
 * @param {unknown} [field.validation] - Validation rules
 * @param {string[]} [field.values] - Enum values
 * @returns {ResolvedField} Resolved field with TypeScript type
 * 
 * @example
 * const resolvedField = createResolvedField({
 *   name: 'status',
 *   type: 'string',
 *   description: 'Current status',
 *   required: true
 * });
 * // Returns: { name: 'status', type: 'string', tsType: 'string', ... }
 */
export function createResolvedField(field: {
  name: string;
  type: string;
  description?: string;
  default?: unknown;
  required?: boolean;
  validation?: unknown;
  values?: string[];
}): ResolvedField {
  return {
    name: field.name,
    type: field.type,
    tsType: inferTsType(field.type),
    description: field.description,
    default: field.default,
    required: field.required ?? false,
    validation: field.validation,
    values: field.values,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isResolvedIR(ir: unknown): ir is ResolvedIR {
  if (!ir || typeof ir !== 'object') return false;
  const r = ir as ResolvedIR;
  return typeof r.appName === 'string' && r.traits instanceof Map && r.pages instanceof Map;
}
