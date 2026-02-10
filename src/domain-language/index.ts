/**
 * Domain Language Module
 *
 * Provides parsing and formatting for the domain-specific language
 * that maps to KFlow schema.
 *
 * The domain language allows domain experts to express their knowledge
 * using natural-language-like syntax that is deterministically parsed
 * into structured AST nodes.
 *
 * @example Entity Definition
 * ```
 * A Order is a customer purchase request
 * It has:
 *   - order number: text, required, unique
 *   - amount: currency
 *   - status: Pending | Confirmed | Shipped
 * It belongs to User
 * It can be: Pending, Confirmed, Shipped, Delivered, Cancelled
 * It starts as Pending
 * ```
 *
 * @example Page Definition
 * ```
 * The Dashboard shows an overview of system activity
 * Purpose: Help users monitor their tasks
 * URL: /dashboard
 *
 * It displays:
 *   - Summary statistics for today
 *   - Recent orders list
 *
 * Users can:
 *   - Click a task to view details
 * ```
 *
 * @example Behavior Definition
 * ```
 * Order Lifecycle
 *
 * States: Pending, Confirmed, Shipped, Delivered, Cancelled
 *
 * Transitions:
 *   - From Pending to Confirmed when CONFIRM
 *     if Order.amount > 0
 *     then notify customer
 * ```
 */

// Types
export type {
  // Base types
  SourceLocation,
  SourceRange,
  ASTNode,

  // Field types
  DomainFieldType,
  DomainField,

  // Relationship types
  RelationshipType,
  DomainRelationship,

  // Entity
  DomainEntity,

  // Page
  DomainPageSection,
  DomainPageAction,
  DomainPage,

  // Guard expressions
  ComparisonOperator,
  LogicalOperator,
  FieldReference,
  FieldCheckCondition,
  ComparisonCondition,
  UserCheckCondition,
  LogicalCondition,
  GuardCondition,
  DomainGuard,

  // Effects
  EffectType,
  DomainEffect,

  // Behavior
  DomainTransition,
  DomainTick,
  DomainBehavior,

  // Document
  DomainDocument,
  SectionMapping,

  // Parse result
  ParseError,
  ParseResult,
} from './types.js';

// Tokens
export { TokenType, KEYWORDS, MULTI_WORD_KEYWORDS } from './tokens.js';
export type { Token } from './tokens.js';

// Lexer
export { Lexer, tokenize } from './lexer.js';

// Parsers
export {
  // Entity
  parseEntity,
  formatEntityToDomain,
  formatEntityToSchema,

  // Page
  parsePage,
  formatPageToDomain,
  formatPageToSchema,

  // Behavior
  parseBehavior,
  formatBehaviorToDomain,
  formatBehaviorToSchema,

  // Guard
  parseGuard,
  formatGuardToSchema,
  formatGuardToDomain,

  // S-Expression Parsing (Domain → S-Expression)
  parseDomainGuard,
  parseDomainEffect,
  parseDomainEffects,
} from './parsers/index.js';

// Formatters (Schema → Domain)
export {
  formatSchemaEntityToDomain,
  schemaEntityToDomainEntity,
  formatSchemaPageToDomain,
  schemaPageToDomainPage,
  formatSchemaTraitToDomain,
  schemaTraitToDomainBehavior,
  formatSchemaGuardToDomain,
  formatDomainGuardToSchema,
  formatGuardConditionToDomain,
} from './formatters/index.js';

// Sync (Bidirectional)
export {
  // Schema to Domain
  convertSchemaToDomain,
  convertEntitiesToDomain,
  convertPagesToDomain,
  convertTraitsToDomain,
  type SchemaToDomainResult,

  // Domain to Schema
  convertDomainToSchema,
  applySectionUpdate,
  deleteSection,
  type DomainToSchemaResult,

  // Section Mapping
  createMappingStore,
  findMapping,
  findMappingByPath,
  findMappingsByType,
  upsertMapping,
  removeMapping,
  detectChanges,
  generateSectionId,
  parseSectionId,
  getSchemaPath,
  updateMappingRange,
  resolveConflict,
  computeSchemaHash,
  hasSchemaChanged,
  updateSchemaHash,
  type MappingStore,

  // Validation Bridge
  // DEPRECATED: Validation is now done by orbital-rust CLI
  // convertSchemaErrorsToDomain,
  // groupErrorsBySection,
  // formatErrorsForDisplay,
  // type SchemaValidationError,
  // type DomainValidationError,

  // Chunk Merging (for incremental orbital generation)
  mergeDomainChunks,
  validateDomainChunk,
  formatMergeSummary,
  type DomainChunk,
  type MergeResult,
} from './sync/index.js';

// Registry (Type Mappings)
export {
  FIELD_TYPE_REGISTRY,
  EFFECT_REGISTRY,
  GUARD_REGISTRY,
  getRegisteredFieldTypes,
  getRegisteredEffects,
  getRegisteredGuards,
  isFieldTypeRegistered,
  isEffectRegistered,
  isGuardRegistered,
  getFieldTypeMapping,
  getEffectMapping,
  getGuardMapping,
  domainKeywordToSchemaType,
  schemaTypeToDomainKeyword,
  getRegistryStats,
  type FieldTypeMapping,
  type EffectMapping,
  type GuardMapping,
} from './registry.js';

// Node.js-only utilities (validate-coverage, generate-docs) are not exported here.
// Import them directly from their files if needed in Node.js environments:
//   import { validateDomainLanguageCoverage } from '@kflow-builder/shared/domain-language/validate-coverage'
//   import { generateDomainLanguageReference } from '@kflow-builder/shared/domain-language/generate-docs'
