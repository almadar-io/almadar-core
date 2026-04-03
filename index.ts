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

// Export schema diffing & protection functions
export {
  diffSchemas,
  isDestructiveChange,
  getRemovals,
  categorizeRemovals,
  requiresConfirmation,
  detectPageContentReduction,
  hasSignificantPageReduction,
} from './src/diff';

// Export schema summarization functions
export {
  summarizeSchema,
  summarizeOrbital,
  classifyWorkflow,
} from './src/summarize';

// Export domain language engine (lexer, parsers, formatters, sync)
export * from './src/domain-language/index';

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
  buildReplayPaths,
  type ReplayTransition,
  buildEdgeCoveringWalk,
  type EdgeWalkTransition,
  type WalkStep,
} from './src/state-machine/index';
