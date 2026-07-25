/**
 * Orbitals Types Module (Self-Contained)
 *
 * Central export for all orbital type definitions.
 * NO imports from ../../schema/ - completely self-contained.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Types
// ============================================================================

// Orbital - the atomic building block
export {
  type Orbital,
  type OrbitalDefinition,
  type OrbitalUnit, // Backward compatibility
  type EventListener,
  type OrbitalInput,
  // Use Declaration (Import System)
  type UseDeclaration,
  UseDeclarationSchema,
  // Entity/Page reference types
  type EntityRef,
  type EntityCall,
  type PageRef,
  type PageRefObject,
  // Computed Event Types (Trait-Centric Model)
  type EventSource,
  type ComputedEventContract,
  type ComputedEventListener,
  OrbitalSchema as OrbitalZodSchema, // Zod schema for validating Orbital
  OrbitalUnitSchema, // Backward compatibility
  OrbitalDefinitionSchema,
  // Entity/Page reference schemas
  EntityRefSchema,
  EntityRefStringSchema,
  EntityCallSchema,
  PageRefSchema,
  PageRefStringSchema,
  PageRefObjectSchema,
  EventListenerSchema,
  EventSourceSchema,
  ComputedEventContractSchema,
  ComputedEventListenerSchema,
  // Type guards
  isOrbitalDefinition,
  isEntityReference,
  isEntityReferenceAny,
  isEntityCall,
  isPageReference,
  isPageReferenceString,
  isPageReferenceObject,
  // Reference parsing utilities
  parseEntityRef,
  parsePageRef,
  parseImportedTraitRef,
  isImportedTraitRef,
} from "./orbital.js";

// OrbitalSchema - top-level app definition
export {
  type OrbitalSchema,
  type OrbitalSchema as AppSchema, // Alias
  type OrbitalSchemaWithTraits,
  type OrbitalConfig,
  type OrbitalSchemaInput,
  type OrbitalConfigInput,
  type SchemaMetadata,
  type ConfigProvenanceRecord,
  OrbitalSchemaSchema,
  OrbitalConfigSchema,
  SchemaMetadataSchema,
  ConfigProvenanceRecordSchema,
  parseOrbitalSchema,
  safeParseOrbitalSchema,
} from "./schema.js";

// Backward compatibility alias - FullOrbitalUnit is just Orbital
export type { Orbital as FullOrbitalUnit } from "./orbital.js";

// Identity model (V4) - branded node ids + name ledger
export {
  type OrbitalId,
  type EntityId,
  type TraitId,
  type EventId,
  type PageId,
  type ServiceId,
  type ThemeId,
  type PaletteEntryId,
  type IdKind,
  type IdForKind,
  type LedgerKind,
  type LedgerEntry,
  type IdentityLedger,
  mintId,
  isOrbitalId,
  asOrbitalId,
  isEntityId,
  asEntityId,
  isTraitId,
  asTraitId,
  isEventId,
  asEventId,
  isPageId,
  asPageId,
  isServiceId,
  asServiceId,
  isThemeId,
  asThemeId,
  isPaletteEntryId,
  asPaletteEntryId,
  ledgerResolveName,
  ledgerRename,
  ledgerCurName,
  OrbitalIdSchema,
  EntityIdSchema,
  TraitIdSchema,
  EventIdSchema,
  PageIdSchema,
  ServiceIdSchema,
  ThemeIdSchema,
  PaletteEntryIdSchema,
  LedgerKindSchema,
  LedgerEntrySchema,
  IdentityLedgerSchema,
  idPrefix,
  idKindOf,
} from "./identity.js";

// Entity - data nucleus
export {
  type Entity,
  type OrbitalEntity, // Backward compatibility
  type EntityPersistence,
  type OrbitalEntityInput,
  EntitySchema,
  OrbitalEntitySchema, // Backward compatibility
  EntityPersistenceSchema,
  deriveCollection,
  isRuntimeEntity,
  persistenceModeAllowsOverrides,
  isFieldValue,
  type FieldValue,
  type EntityRow,
  type EntityWith,
  type EntityData,
} from "./entity.js";

// Page - trait-driven UI entry
export {
  type Page,
  type OrbitalPage, // Backward compatibility
  type PageTraitRef,
  type ViewType,
  type OrbitalPageInput,
  type OrbitalPageStrictInput,
  PageSchema,
  OrbitalPageSchema, // Backward compatibility
  OrbitalPageStrictSchema,
  PageTraitRefSchema,
  ViewTypeSchema,
} from "./page.js";

// ============================================================================
// Field Types
// ============================================================================

export {
  type Field,
  type EntityField, // Backward compatibility
  type ScalarEntityField,
  type EnumEntityField,
  type RelationEntityField,
  type ArrayEntityField,
  type FieldType,
  type FieldFormat,
  type RelationConfig,
  type EntityFieldInput,
  FieldSchema,
  EntityFieldSchema, // Backward compatibility
  FieldTypeSchema,
  FieldFormatSchema,
  RelationConfigSchema,
} from "./field.js";

// ============================================================================
// S-Expression Types
// ============================================================================

export {
  // Types
  type SExpr,
  type SExprAtom,
  type Expression,
  type ParsedBinding,
  type CoreBinding,
  type SExprInput,
  type ExpressionInput,
  // Schemas
  SExprSchema,
  SExprAtomSchema,
  ExpressionSchema,
  // Type guards
  isSExpr,
  isSExprAtom,
  isBinding,
  isSExprCall,
  isValidBinding,
  // Utilities
  parseBinding,
  getOperator,
  getArgs,
  sexpr,
  walkSExpr,
  collectBindings,
  // Constants
  CORE_BINDINGS,
  // Runtime evaluation types
  type EvalContext,
  type EventPayload,
  type EventPayloadValue,
  isEventPayloadValue,
  type LogMeta,
  type LogMetaValue,
} from "./expression.js";

// ============================================================================
// S-Expression Bindings
// ============================================================================

export {
  // Schemas
  BindingSchema,
  // Constants
  BINDING_DOCS,
  BINDING_CONTEXT_RULES,
  // Types
  type BindingContext,
  // Helpers
  validateBindingInContext,
  getBindingExamples,
} from "./bindings.js";

// Binding root classification (narrow union + helper). Complements the
// `parseBinding` / `ParsedBinding` shapes exported from ./expression.js
// (which return `root: string`) — use `toBindingRoot(parsed.root)` to
// narrow to the exhaustive `BindingRoot` union.
export {
  BINDING_ROOTS,
  toBindingRoot,
  type BindingRoot,
  type TraitFieldRef,
  TraitFieldRefSchema,
  isTraitFieldRef,
} from "./binding.js";

// Authenticated user context — the shape `@user.x` resolves against, shared by
// the JS interpreter and the compiled shell.
export {
  ANONYMOUS_USER,
  DEV_TOKEN_PREFIX,
  MOCK_PERSONAS,
  decodeDevIdentityToken,
  encodeDevIdentityToken,
  findMockPersona,
  normalizeUserContext,
  resolvePersonaSpec,
  type UserContext,
  type RawUserClaims,
} from "./user.js";

// ============================================================================
// State Machine Types
// ============================================================================

export {
  type State,
  type Event,
  type Guard,
  type Transition,
  type StateMachine,
  type PayloadField,
  type StateInput,
  type EventInput,
  type GuardInput,
  type TransitionInput,
  type StateMachineInput,
  StateSchema,
  EventSchema,
  GuardSchema,
  TransitionSchema,
  StateMachineSchema,
  PayloadFieldSchema,
  // Event utilities
  isCircuitEvent,
} from "./state-machine.js";

// ============================================================================
// Effect Types
// ============================================================================

export {
  // Core types
  type Effect,
  type EffectInput,
  type TypedEffect,
  type UISlot,
  type PatternConfig,
  type CallServiceConfig,
  type EmitConfig,
  // Typed effect tuples (per-operator tuple shapes)
  type RenderBinding,
  type RenderUIEffect,
  type NavigateEffect,
  type EmitEffect,
  type SetEffect,
  type PersistEffect,
  type FetchEffect,
  type CallServiceEffect,
  type SpawnEffect,
  type DespawnEffect,
  type NotifyEffect,
  type LogEffect,
  type DoEffect,
  type RenderItemLambda,
  type RenderChildrenMap,
  // Resource effect types
  type RefEffect,
  type DerefEffect,
  type SwapEffect,
  type WatchEffect,
  type AtomicEffect,
  type WatchOptions,
  type FetchOptions,
  type FetchResult,
  type PersistEmitConfig,
  type PersistData,
  type ForwardEffect,
  type TrainEffect,
  type EvaluateEffect,
  type ForwardConfig,
  type TrainConfig,
  type EvaluateConfig,
  type NnLayer,
  type NnConfig,
  type CheckpointSaveEffect,
  type CheckpointLoadEffect,
  // Agent effect type
  type AgentEffect,
  // OS effect type
  type OsEffect,
  // Agent-path operator effect types
  type LlmEffect,
  type BehaviorEffect,
  type ValidateEffect,
  type SessionEffect,
  type ComposeEffect,
  type TraceEffect,
  type MemoryEffect,
  type ApplicationEffect,
  // Schemas
  UI_SLOTS,
  EffectSchema,
  UISlotSchema,
  // Type guards
  isEffect,
  isSExprEffect,
  // Effect builders (S-expression style)
  set,
  emit,
  navigate,
  renderUI,
  persist,
  callService,
  spawn,
  despawn,
  doEffects,
  notify,
  // Resource effect builders
  ref,
  deref,
  swap,
  watch,
  atomic,
  // Runtime pattern types
  type ResolvedPatternProps,
  type RenderUINode,
} from "./effect.js";

// ============================================================================
// Agent Types
// ============================================================================

export {
  type AgentContext,
  type AgentMemoryRecord,
  type AgentMemoryCategory,
  type AgentCompactStrategy,
  type AgentCompactResult,
  type AgentGenerateOptions,
  type AgentCodeSearchResult,
  type LlmMessage,
  type LlmToolCall,
  type LlmToolDef,
  type LlmCallToolsResult,
  type LlmTokenUsage,
  type BuilderResult,
  type ValidateResult,
  type ComposeAllResult,
  type ComposeChildrenResult,
  type RepairResult,
  type LoloEmitResult,
  type PlannerResult,
  type ExecutePlanResult,
  type DispatchUpdatesResult,
  type ServiceCallResult,
  type SessionHistoryEntry,
  isSessionHistoryEntry,
  type LlmContext,
  type WorkspaceContext,
  type SessionContext,
  type MemoryContext,
  type TraceContext,
  type IntegrationContext,
} from "./agent.js";

// ============================================================================
// Plan & Analysis Types (lifted from @almadar-io/rabit)
// ============================================================================

export {
  type ClarificationLevel,
  type ClarificationCandidate,
  type Clarification,
  type AnalysisPageOverride,
  type ExtraTraitRef,
  type AnalysisOrbitalParams,
  type AnalysisOrbital,
  type AnalysisRename,
  type ComplexityAssessment,
  type AnalysisResult,
  type SpawnResult,
  type PlanSnapshotStatus,
  type PlanSnapshot,
  isPlanSnapshot,
  type ComposeOptions,
  type GitHubRepo,
  type GitHubIssue,
} from "./plan.js";

// ============================================================================
// Trait Types
// ============================================================================

export {
  type Trait,
  type TraitRef,
  type TraitReference,
  type TraitCategory,
  type TraitConfig,
  type TraitConfigObject,
  type TraitConfigValue,
  type ConfigFieldDeclaration,
  type ConfigFieldItemsDeclaration,
  type DeclaredTraitConfig,
  REFERENCE_CONFIG_TYPES,
  type ReferenceConfigType,
  isReferenceConfigType,
  type CallSiteConfigEntry,
  type CallSiteConfig,
  isCallSiteConfigDeclaration,
  normalizeCallSiteConfigToValues,
  CONFIG_REF_EVENT_PATTERN,
  configRefEventKnob,
  type ConfigRefEventError,
  resolveConfigRefEventName,
  TraitConfigSchema,
  TraitConfigValueSchema,
  ConfigFieldDeclarationSchema,
  DeclaredTraitConfigSchema,
  type TraitEventListener,
  type ListenSource,
  type TraitTick,
  type TraitDataEntity,
  type TraitEntityField,
  type RequiredField,
  type TraitUIBinding,
  type PresentationType,
  type TraitInput,
  type TraitReferenceInput,
  // Event Contract Types (Trait-Centric Model)
  type EventScope,
  type EventPayloadField,
  type TraitEventContract,
  // Backward compatibility
  type OrbitalTraitRef,
  // Rebindable entity binding contract
  type EntityFieldContract,
  // Schemas
  TraitSchema,
  EntityFieldContractSchema,
  TraitRefSchema,
  TraitReferenceSchema,
  TraitCategorySchema,
  TraitEventListenerSchema,
  ListenSourceSchema,
  TraitTickSchema,
  TraitDataEntitySchema,
  TraitEntityFieldSchema,
  RequiredFieldSchema,
  OrbitalTraitRefSchema, // Backward compatibility
  // Event Contract Schemas (Trait-Centric Model)
  EventScopeSchema,
  EventPayloadFieldSchema,
  TraitEventContractSchema,
  // Helpers
  isInlineTrait,
  getTraitName,
  getTraitConfig,
  normalizeTraitRef,
} from "./trait.js";

// ============================================================================
// Domain Types
// ============================================================================

export {
  type DomainContext,
  type DomainCategory,
  type GameSubCategory,
  type NodeClassification,
  type StateSemanticRole,
  type EventSemanticRole,
  type EntitySemanticRole,
  type UserPersona,
  type DesignPreferences,
  type DesignTokens,
  type CustomPatternDefinition,
  type CustomPatternMap,
  type AllowedCustomComponent,
  type DomainContextInput,
  type DesignPreferencesInput,
  type UserPersonaInput,
  type DesignTokensInput,
  type CustomPatternDefinitionInput,
  type CustomPatternMapInput,
  // New types for UX Enhancement
  type DomainVocabulary,
  type UXHints,
  type RelatedLink,
  type SuggestedGuard,
  // Theme types
  type ThemeTokens,
  type ThemeVariant,
  type ThemeDefinition,
  type ThemeRef,
  // Skin axis sub-interfaces (Layer 1 visual variation)
  type SpacingScale,
  type DensityTokens,
  type TypeScaleEntry,
  type TypeSlot,
  type TypeSizeKey,
  type TypeWeight,
  type TypeIntent,
  type TypeScale,
  type TypeIntentMap,
  type TypeScaleTokens,
  type MotionDurationKey,
  type MotionEasingKey,
  type MotionIntent,
  type MotionDurationPalette,
  type MotionEasingPalette,
  type MotionIntentMap,
  type MotionTokens,
  type IconFamily,
  type IconographyTokens,
  type ElevationTokens,
  type GeometryTokens,
  type ColorTokens,
  type IllustrationStyle,
  type IllustrationTokens,
  // SkinSpec composed type + slice aliases (doc §2.3 vocabulary)
  type SkinSpec,
  type ColorSlice,
  type DensitySlice,
  type TypeSlice,
  type GeometrySlice,
  type ElevationSlice,
  type MotionSlice,
  type IconographySlice,
  type IllustrationSlice,
  ALLOWED_CUSTOM_COMPONENTS,
  AGENT_DOMAIN_CATEGORIES,
  type AgentDomainCategory,
  AgentDomainCategorySchema,
  DomainContextSchema,
  DomainCategorySchema,
  GameSubCategorySchema,
  NodeClassificationSchema,
  StateSemanticRoleSchema,
  EventSemanticRoleSchema,
  EntitySemanticRoleSchema,
  UserPersonaSchema,
  DesignPreferencesSchema,
  DesignTokensSchema,
  CustomPatternDefinitionSchema,
  CustomPatternMapSchema,
  // New schemas for UX Enhancement
  DomainVocabularySchema,
  UXHintsSchema,
  RelatedLinkSchema,
  SuggestedGuardSchema,
  // Theme schemas
  ThemeTokensSchema,
  ThemeVariantSchema,
  ThemeDefinitionSchema,
  ThemeRefSchema,
  ThemeRefStringSchema,
  isThemeReference,
  // Skin axis schemas (Layer 1 visual variation)
  SpacingScaleSchema,
  DensityTokensSchema,
  TypeScaleEntrySchema,
  TypeSlotSchema,
  TypeSizeKeySchema,
  TypeWeightSchema,
  TypeIntentSchema,
  TypeScaleSchema,
  TypeIntentMapSchema,
  TypeScaleTokensSchema,
  MotionDurationKeySchema,
  MotionEasingKeySchema,
  MotionIntentSchema,
  MotionDurationPaletteSchema,
  MotionEasingPaletteSchema,
  MotionIntentMapSchema,
  MotionTokensSchema,
  IconFamilySchema,
  IconographyTokensSchema,
  ElevationTokensSchema,
  GeometryTokensSchema,
  ColorTokensSchema,
  IllustrationStyleSchema,
  IllustrationTokensSchema,
  // SkinSpec composed schema + slice schemas (doc §2.3 vocabulary)
  SkinSpecSchema,
  ColorSliceSchema,
  DensitySliceSchema,
  TypeSliceSchema,
  GeometrySliceSchema,
  ElevationSliceSchema,
  MotionSliceSchema,
  IconographySliceSchema,
  IllustrationSliceSchema,
} from "./domain.js";

// ============================================================================
// Interaction Model
// ============================================================================

export {
  type InteractionModel,
  type CreateFlow,
  type EditFlow,
  type ViewFlow,
  type DeleteFlow,
  type ListInteraction,
  type InteractionModelInput,
  InteractionModelSchema,
  DEFAULT_INTERACTION_MODELS,
  getInteractionModelForDomain,
} from "./interaction-model.js";

// ============================================================================
// Service Types
// ============================================================================

export {
  type ServiceType,
  type ServiceDefinition,
  type RestServiceDef,
  type SocketServiceDef,
  type McpServiceDef,
  type RestAuthConfig,
  type SocketEvents,
  type ServiceRef,
  type ServiceRefObject,
  SERVICE_TYPES,
  ServiceTypeSchema,
  ServiceDefinitionSchema,
  RestServiceDefSchema,
  SocketServiceDefSchema,
  McpServiceDefSchema,
  RestAuthConfigSchema,
  SocketEventsSchema,
  ServiceRefSchema,
  ServiceRefObjectSchema,
  ServiceRefStringSchema,
  isRestService,
  isSocketService,
  isMcpService,
  isServiceReference,
  isServiceReferenceObject,
  parseServiceRef,
  getServiceNames,
  findService,
  hasService,
  type ServiceParams,
  type ServiceParamsValue,
} from "./service.js";

// ============================================================================
// Pattern Types
// ============================================================================

export {
  type PatternType,
  PATTERN_TYPES,
  PatternTypeSchema,
  isValidPatternType,
} from "./pattern.js";

// ============================================================================
// Asset Types
// ============================================================================

export {
  // Constants
  ENTITY_ROLES,
  VISUAL_STYLES,
  CAMERA_MODES,
  ASSET_DIMENSIONS,
  ASSET_ASPECTS,
  ANIMATION_NAMES,
  SPRITE_DIRECTIONS,
  // Types
  type EntityRole,
  type VisualStyle,
  type AssetDimension,
  type AssetAspect,
  type AnimationName,
  type SpriteDirection,
  type AnimationDef,
  type SpriteSheetAtlas,
  type SubTexture,
  type TextureAtlas,
  type Tilesheet,
  type SemanticAssetRef,
  type Asset,
  type ScenePos,
  type Camera,
  type CameraMode,
  type AssetCatalogEntry,
  type AssetCatalog,
  type AssetUrl,
  type SemanticAssetRefInput,
  type AnimationDefInput,
  type AssetCatalogEntryInput,
  type SpriteSheetAtlasInput,
  // Schemas
  EntityRoleSchema,
  VisualStyleSchema,
  AssetDimensionSchema,
  AssetAspectSchema,
  AnimationNameSchema,
  SpriteDirectionSchema,
  AnimationDefSchema,
  SpriteSheetAtlasSchema,
  SubTextureSchema,
  TextureAtlasSchema,
  TilesheetSchema,
  SemanticAssetRefSchema,
  AssetSchema,
  ScenePosSchema,
  CameraModeSchema,
  CameraSchema,
  AssetCatalogEntrySchema,
  AssetCatalogSchema,
  // Helpers
  createAssetKey,
  parseAssetKey,
  getDefaultAnimationsForRole,
  validateAssetAnimations,
} from "./asset.js";

// ============================================================================
// Changeset & Snapshot Types
// ============================================================================

export {
  type SchemaChange,
  type ChangesetValue,
  type ChangeAuthor,
  type ChangeSummary,
  type ChangeSetDocument,
  type SnapshotDocument,
  type CategorizedRemovals,
  type PageContentReduction,
  type HistoryMeta,
  type ValidationMeta,
  type SemanticChangeKind,
  type SemanticSchemaChange,
} from "./changeset.js";

// ============================================================================
// App Types
// ============================================================================

export {
  type GitHubLink,
  type StatsView,
  type AppSummary,
  type SaveOptions,
  type SaveResult,
  type ValidationIssue,
  type ValidationResults,
  type ValidationDocument,
} from "./app.js";

// ============================================================================
// Service Contract Types (Call-Service + Event Surface)
// ============================================================================

export {
  // Service Action Names
  type PersistActionName,
  type ServiceActionName,
  // Call-Service Contract
  type ServiceAction,
  type ServiceContract,
  // Event Contract
  type ServiceEvents,
  // Store Contract
  type StoreFilterOp,
  type StoreFilter,
  type StoreContract,
  // Typed EventBus wrapper
  createTypedEventBus,
  // Lazy Service (Singleton Pattern)
  type LazyService,
  createLazyService,
} from "../service-types.js";

// ============================================================================
// IR Types (Intermediate Representation)
// ============================================================================

export {
  // Transition types
  type TransitionFrom,
  // Field types
  type ResolvedField,
  // Entity types
  type ResolvedEntity,
  type ResolvedEntityBinding,
  // Trait types
  type ResolvedTraitState,
  type ResolvedTraitEvent,
  type ResolvedTraitTransition,
  type ResolvedTraitGuard,
  type ResolvedTraitTick,
  type ResolvedTraitListener,
  type ResolvedTraitDataEntity,
  type ResolvedTraitUIBinding,
  type ResolvedTrait,
  type ResolvedTraitBinding,
  // Pattern & Section types
  type ResolvedPattern,
  type ResolvedSectionEvent,
  type ResolvedSection,
  // Page types
  type ResolvedNavigation,
  type ResolvedPage,
  // IR types
  type ResolvedIR,
  // Factory functions
  createEmptyResolvedTrait,
  createEmptyResolvedPage,
  createResolvedField,
  inferTsType,
  // Type guards
  isResolvedIR,
} from "./ir.js";

// Context Extensions (declaration-merging surface for consumers)
export { type ContextExtensions } from "./context.js";

// Bus event envelope (unified across @almadar/ui and @almadar/runtime)
export {
  type EventKey,
  type EventEmit,
  type EventListen,
  type BusEvent,
  type BusEventSource,
  type BusEventListener,
  type Unsubscribe,
} from "./bus.js";

// Verification wire types (shared by @almadar/ui's verificationRegistry
// producer and @almadar-io/verify's state-bridge consumer — hoisted
// so the window.__orbitalVerification contract can't drift).
export {
  type CheckStatus,
  type VerificationCheck,
  type EffectTrace,
  type ServerResponseTrace,
  type TransitionTrace,
  type BridgeHealth,
  type VerificationSummary,
  type TraitStateSnapshot,
  type VerificationSnapshot,
  type AssetLoadStatus,
  type EventLogEntry,
  type OrbitalVerificationAPI,
} from "./verification.js";

// ============================================================================
// JSON Primitives (universal "data crossed a boundary" types)
// ============================================================================

export {
  type JsonValue,
  type JsonObject,
  type ToolArgs,
  isJsonPrimitive,
  isJsonObject,
  isJsonArray,
} from "./json.js";

// ============================================================================
// SSE Event Types (agent wire contract consumed by the public SDK)
// ============================================================================

export {
  type SSEEvent,
  type SSEEventType,
  type SSEEventBase,
  type StartEvent,
  type MessageEvent,
  type ToolCallEvent,
  type ToolResultEvent,
  type TodoUpdateEvent,
  type TodoActivityType,
  type TodoDetailEvent,
  type FileOperationEvent,
  type FileWrittenEvent,
  type SchemaUpdateEvent,
  type GenerationLogEvent,
  type SubagentEvent,
  type SubagentStartEvent,
  type SubagentProgressEvent,
  type SubagentCompleteEvent,
  type InterruptEvent,
  type ErrorEvent,
  type CancelledEvent,
  type CompleteEvent,
  type AppCreatedEvent,
  type SchemaPhaseValidatedEvent,
  type SchemaPhaseUpdateEvent,
  type OrbitalAddedEvent,
  type OrbitalSchemaCompleteEvent,
  type ProcessStartEvent,
  type ProcessCompleteEvent,
  type ProcessErrorEvent,
  type ProcessRepairEvent,
  type ProcessRepairCompleteEvent,
  type ParamsRepairEmittedEvent,
  type ChangesetRecordedEvent,
  type SnapshotCreatedEvent,
} from "./sse.js";

// ============================================================================
// Validation Errors
// ============================================================================

export {
  type ValidationError,
  type ValidationErrorCode,
  type ValidationResult,
  type KnownValidationErrorCode,
  KNOWN_VALIDATION_ERROR_CODES,
  isKnownValidationErrorCode,
} from "./validation.js";

// ============================================================================
// Living Orbital Schema (Golden Data Structure — §VIII type system)
// ============================================================================

export {
  // Semantic annotation
  type AnnotationTier,
  type SemanticAnnotation,
  widenTier,
  // ML scalars / vectors
  type SemanticVector,
  type Probability,
  type GateState,
  // Graph vertex / edge typing
  type VertexType,
  type VertexId,
  type EdgeType,
  type EffectPayload,
  type KnobPayload,
  type VertexPayload,
  type LivingVertex,
  type LivingOrbital,
  type LivingEntity,
  type LivingTrait,
  type LivingState,
  type LivingTransition,
  type LivingPage,
  type LivingField,
  type LivingEvent,
  type LivingEffect,
  type LivingValue,
  type LivingEdge,
  // Evolution / lineage
  type EvolutionDelta,
  type LineageEntry,
  // Effect simulation
  type EffectResult,
  // The living schema contract
  type LivingOrbitalSchema,
} from "./living.js";

// ============================================================================
// Parsed AST (LLM-emit relaxed views of the canonical orbital types)
// ============================================================================

export {
  type ParsedOrbital,
  type ParsedEntity,
  type ParsedTrait,
  type ParsedTraitConfig,
  type ParsedStateMachine,
  type ParsedState,
  type ParsedEvent,
  type ParsedTransition,
  type ParsedEmitDeclaration,
  type ParsedListenDeclaration,
  type ParsedPage,
  type ParsedDomainContext,
  type ParsedDesign,
  type ValidatedOrbital,
} from "./parsed-ast.js";
