/**
 * Domain Language Types
 *
 * AST node types for the domain language that maps to KFlow schema.
 * All entity references use explicit names (e.g., Order, Task, CurrentUser)
 * per GAP-002 - no magic variables like `entity.` or `context.`.
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Registry (OrbitalSchema ↔ Domain Language Mapping)
// ============================================================================

/**
 * Field type mapping: OrbitalSchema type → Domain Language keyword
 *
 * This is the single source of truth for type conversion.
 * When adding new field types to OrbitalSchema, add the mapping here.
 */
export const FIELD_TYPE_MAPPING = {
    // OrbitalSchema → Domain Language
    'string': 'text',
    'number': 'number',
    'boolean': 'yes/no',
    'date': 'date',
    'timestamp': 'timestamp',
    'datetime': 'datetime',
    'array': 'list',
    'object': 'object',
    'enum': 'enum',
    'relation': 'relation',
} as const;

/**
 * Reverse mapping: Domain Language keyword → OrbitalSchema type
 */
export const DOMAIN_TO_SCHEMA_FIELD_TYPE = {
    'text': 'string',
    'long text': 'string',
    'number': 'number',
    'currency': 'number',
    'yes/no': 'boolean',
    'date': 'date',
    'timestamp': 'timestamp',
    'datetime': 'datetime',
    'list': 'array',
    'object': 'object',
    'enum': 'enum',
    'relation': 'relation',
} as const;

/**
 * Effect operator mapping: Both systems use the same operator names
 */
export const EFFECT_OPERATORS = [
    'set',
    'emit',
    'navigate',
    'render-ui',
    'persist',
    'call-service',
    'spawn',
    'despawn',
    'do',
    'notify',
] as const;

/**
 * Guard/comparison operators: S-Expression syntax only
 */
export const COMPARISON_OPERATORS = ['=', '!=', '<', '>', '<=', '>='] as const;
export const LOGICAL_OPERATORS = ['and', 'or', 'not'] as const;
export const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%'] as const;

/**
 * UI Slots: Same in both OrbitalSchema and Domain Language
 */
export const UI_SLOTS = [
    'main',
    'sidebar',
    'modal',
    'drawer',
    'overlay',
    'center',
    'toast',
    'hud-top',
    'hud-bottom',
    'floating',
    'system',
] as const;

/**
 * Binding prefixes for S-Expressions
 */
export const BINDING_PREFIXES = {
    entity: '@entity',
    payload: '@payload',
    state: '@state',
    now: '@now',
} as const;

// ============================================================================
// Effect Type
// ============================================================================

/**
 * Effect operator names (S-expression first element)
 * These are the operators used in S-expression effects like ['emit', ...]
 */
export type EffectType = (typeof EFFECT_OPERATORS)[number];

// ============================================================================
// Base Types
// ============================================================================

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

export interface ASTNode {
  type: string;
  range?: SourceRange;
}

// ============================================================================
// Field Types
// ============================================================================

/**
 * Domain Language field types
 *
 * Note: These map to OrbitalSchema types via DOMAIN_TO_SCHEMA_FIELD_TYPE
 */
export type DomainFieldType =
  | 'text'
  | 'long text'
  | 'number'
  | 'currency'
  | 'date'
  | 'timestamp'
  | 'datetime'
  | 'yes/no'
  | 'enum'
  | 'list'
  | 'object'
  | 'relation';

/**
 * OrbitalSchema field types (for reference)
 */
export type SchemaFieldType = keyof typeof FIELD_TYPE_MAPPING;

export interface DomainField extends ASTNode {
  type: 'field';
  name: string;
  fieldType: DomainFieldType;
  required: boolean;
  unique: boolean;
  auto: boolean;
  default?: unknown;
  enumValues?: string[];  // For enum types
}

// ============================================================================
// Relationship Types
// ============================================================================

export type RelationshipType = 'belongs_to' | 'has_many' | 'has_one';

export interface DomainRelationship extends ASTNode {
  type: 'relationship';
  relationshipType: RelationshipType;
  targetEntity: string;
  alias?: string;  // e.g., "as Assignee"
}

// ============================================================================
// Entity AST
// ============================================================================

export interface DomainEntity extends ASTNode {
  type: 'entity';
  name: string;
  description: string;
  fields: DomainField[];
  relationships: DomainRelationship[];
  states?: string[];
  initialState?: string;
}

// ============================================================================
// Page AST
// ============================================================================

export interface DomainPageSection extends ASTNode {
  type: 'page_section';
  description: string;
}

export interface DomainPageAction extends ASTNode {
  type: 'page_action';
  trigger: string;      // e.g., "Click a task"
  action: string;       // e.g., "Navigate to Task Details"
}

export interface DomainPage extends ASTNode {
  type: 'page';
  name: string;
  description: string;
  purpose: string;
  url: string;
  primaryEntity?: string;  // Explicit entity reference (no inference!)
  traitName?: string;      // Trait/behavior to use for this page
  sections: DomainPageSection[];
  actions: DomainPageAction[];
  onAccess?: string;
}

// ============================================================================
// Guard Expression AST
// ============================================================================

export type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';
export type LogicalOperator = 'AND' | 'OR';

export interface FieldReference extends ASTNode {
  type: 'field_reference';
  entityName: string;   // Explicit entity name (Order, Task, CurrentUser)
  fieldName: string;
}

export interface FieldCheckCondition extends ASTNode {
  type: 'field_check';
  field: FieldReference;
  check: 'provided' | 'empty' | 'equals';
  value?: string | number | boolean;
}

export interface ComparisonCondition extends ASTNode {
  type: 'comparison';
  field: FieldReference;
  operator: ComparisonOperator;
  value: string | number | boolean;
}

export interface UserCheckCondition extends ASTNode {
  type: 'user_check';
  check: 'is_role' | 'owns_this';
  role?: string;
  ownerField?: string;  // Field that contains owner ID
}

export interface LogicalCondition extends ASTNode {
  type: 'logical';
  operator: LogicalOperator;
  left: GuardCondition;
  right: GuardCondition;
}

export type GuardCondition =
  | FieldCheckCondition
  | ComparisonCondition
  | UserCheckCondition
  | LogicalCondition;

export interface DomainGuard extends ASTNode {
  type: 'guard';
  condition: GuardCondition;
  raw: string;  // Original text for display
}

// ============================================================================
// Effect AST
// ============================================================================

// EffectType is imported from schema/index.js above

export interface DomainEffect extends ASTNode {
  type: 'effect';
  effectType: EffectType;
  description: string;  // Human-readable description
  config: Record<string, unknown>;
}

// ============================================================================
// Behavior AST (Traits)
// ============================================================================

export interface DomainTransition extends ASTNode {
  type: 'transition';
  fromState: string;
  toState: string;
  event: string;
  guards: DomainGuard[];
  effects: DomainEffect[];
}

export interface DomainTick extends ASTNode {
  type: 'tick';
  name: string;
  interval: string;     // e.g., "Every hour", "Every day at 9am"
  intervalMs?: number;  // Parsed milliseconds
  guard?: DomainGuard;
  effects: DomainEffect[];
}

export interface DomainBehavior extends ASTNode {
  type: 'behavior';
  name: string;           // e.g., "Order Lifecycle"
  entityName: string;     // The entity this behavior applies to
  states: string[];
  initialState: string;
  transitions: DomainTransition[];
  ticks: DomainTick[];
  rules: string[];        // Business rules in natural language
}

// ============================================================================
// Full Document AST
// ============================================================================

export interface DomainDocument extends ASTNode {
  type: 'document';
  entities: DomainEntity[];
  pages: DomainPage[];
  behaviors: DomainBehavior[];
}

// ============================================================================
// Section Mapping (for bidirectional sync)
// ============================================================================

export interface SectionMapping {
  sectionId: string;
  sectionType: 'entity' | 'page' | 'behavior' | 'tick';
  schemaPath: string;       // JSON path in KFlow schema
  domainText: string;       // The domain text for this section
  aiDescription?: string;   // AI-generated prose description
  range?: SourceRange;      // Location in source text
  lastModified?: number;    // Timestamp
}

// ============================================================================
// Parse Result
// ============================================================================

export interface ParseError {
  message: string;
  range?: SourceRange;
  suggestion?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: ParseError[];
  warnings: ParseError[];
}
