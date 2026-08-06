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

// Agent-trace view-model (Trace* render shapes for the studio trace UI)
export * from './src/agent-trace-view';

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

// Embedded-trait `@config.X` forward resolution — shared by the JS
// interpreter (`@almadar/runtime`) and the render substrate (`@almadar/ui`).
export {
  collectEmbeddedTraitReferrers,
  collectTraitEmbedAdjacency,
  collectTraitConfigRefAdjacency,
  traitDeclaresConfigForward,
  buildResolvedTraitConfigs,
} from './src/embedded-trait-config';

// The slot-outlet contract — which single trait owns a page's content region.
// Two wiring-lint classes were stuck (one at warning-only, one withdrawn after
// three calibrations) purely because this fact was not derivable.
export {
  isContentMainWriter,
  resolvePageContentOwner,
  resolveContentOwners,
  reduceToOwners,
} from './src/page-content-owner';
export type { PageContentOwner } from './src/page-content-owner';

// Listen-route `with { ... }` payload mapping — shared by the server runtime
// (`@almadar/runtime`) and the client cross-trait wiring (`@almadar/ui`).
export { applyListenPayloadMapping } from './src/listen-payload-mapping';
export type { ListenPayloadEvaluator } from './src/listen-payload-mapping';

// ML contract validation — one pure implementation for the runtime path
// (`@almadar/evaluator` contract/* operators) and the compiled TS shell.
export {
  validateContract,
  isTensorValue,
  describeTensorMismatch,
  tensorShape,
  tensorLastDimSize,
  gatherTensorLastDim,
  mapTensorLastDim,
  contractFieldName,
} from './src/ml-contract';
export type {
  TensorValue,
  ContractRange,
  ContractFieldSpec,
  ContractFieldEntry,
  ContractSpec,
  ContractViolation,
  ContractValidationResult,
} from './src/ml-contract';

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

// Row-level entity access policies. Also reachable via `@almadar/core/mock`,
// but server code (generated app servers, `@almadar/server`) must not import
// through the mock door to read a production authorization contract.
export {
  type EntityAccessPolicies,
  entityAccessPolicies,
  entityAccessTable,
} from './src/access/entityAccess';

// `expects` derivation — compute an orbital's consumer-side requirement
// declarations from the organism's golden schema (proposal §7; the ONE owner —
// rabit's factory generation and edit-demote materializer both derive through
// this, never their own walks).
export {
  deriveExpectations,
  type DeriveExpectationsResult,
  type ExpectationDiagnostic,
} from './src/derive-expectations';

// Shared-entity frame merge (mechanics-as-traits DRY primitive: the JS
// interpreter and the generated TypeScript codegen both fold mechanic
// writes through this one function).
export {
  mergeEntityFrame,
  type EntityFieldWrite,
  type EntityFrameState,
} from './src/shared-entity/merge';

// Pattern registry, component mappings, and pattern utilities (merged from
// the former @almadar/patterns package to break the core ↔ patterns cycle).
export * from './src/patterns/index';
