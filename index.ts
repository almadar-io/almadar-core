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

// Render-UI structural editing (contextual edit: EditFocus, RenderUiPatch, util)
export * from './src/render-ui-edit';

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

// Export schema diffing & protection functions
export {
  diffSchemas,
  diffSchemaSemantics,
  diffOrbitalSchemas,
  isDestructiveChange,
  getRemovals,
  categorizeRemovals,
  requiresConfirmation,
  detectPageContentReduction,
  hasSignificantPageReduction,
  type SchemaDiff,
  type SchemaDiffOptions,
  type SchemaDiffMode,
  type SchemaDiffAuthor,
  type SchemaDiffSource,
  type SchemaDiffChange,
  type SchemaDiffChangeset,
  type SchemaDiffSummary,
} from './src/diff';

// Export schema summarization functions
export {
  summarizeSchema,
  summarizeOrbital,
  classifyWorkflow,
} from './src/summarize';

export * from './src/factory/index';

// Export builders (compose behaviors, event wiring, layout strategy)
export {
  type LayoutStrategy,
  detectLayoutStrategy,
  type EventWiringEntry,
  applyEventWiring,
  type ComposeBehaviorsInput,
  type ComposeBehaviorsResult,
  composeBehaviors,
} from './src/builders/index';

// Export state machine graph algorithms (BFS, guard payloads, replay paths)
// Note: PayloadFieldSchema is re-exported selectively to avoid collision with
// the Zod PayloadFieldSchema from types/state-machine.ts
export {
  type StateEdge,
  type BFSNode,
  type BFSPathNode,
  type ReplayStep,
  type GuardPayload,
  type GraphTransition,
  buildStateGraph,
  collectReachableStates,
  walkStatePairs,
  buildGuardPayloads,
  extractPayloadFieldRef,
  constTruth,
  buildReplayPaths,
  type ReplayTransition,
  buildEdgeCoveringWalk,
  type EdgeWalkTransition,
  type WalkStep,
} from './src/state-machine/index';
