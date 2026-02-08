/**
 * @almadar/core
 *
 * Core types and schemas for the Almadar/Orbital system.
 * This is the central type package that other packages depend on.
 *
 * @packageDocumentation
 */

// Export all types
export * from './src/types/index';

// Export schema resolution functions
export {
  schemaToIR,
  clearSchemaCache,
  getSchemaCacheStats,
  getPage,
  getPages,
  getEntity,
  getTrait,
} from './src/resolver';
