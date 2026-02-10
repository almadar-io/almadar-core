/**
 * Domain Language Sync Module
 *
 * Provides bidirectional synchronization between domain language text
 * and KFlow schema structures.
 */

// Schema to Domain
export {
  convertSchemaToDomain,
  convertEntitiesToDomain,
  convertPagesToDomain,
  convertTraitsToDomain,
  type SchemaToDomainResult,
} from './schema-to-domain.js';

// Domain to Schema
export {
  convertDomainToSchema,
  applySectionUpdate,
  deleteSection,
  type DomainToSchemaResult,
} from './domain-to-schema.js';

// Section Mapping
export {
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
} from './section-mapping.js';

// Validation Bridge
// DEPRECATED: Validation is now done by orbital-rust CLI
// The validation-bridge.js module has been removed
// export {
//   convertSchemaErrorsToDomain,
//   groupErrorsBySection,
//   formatErrorsForDisplay,
//   type SchemaValidationError,
//   type DomainValidationError,
// } from './validation-bridge.js';

// Chunk Merging (for incremental orbital generation)
export {
  mergeDomainChunks,
  validateDomainChunk,
  formatMergeSummary,
  type DomainChunk,
  type MergeResult,
} from './merge-chunks.js';
