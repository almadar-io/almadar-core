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
  type OrbitalConfig,
  type OrbitalSchemaInput,
  type OrbitalConfigInput,
  OrbitalSchemaSchema,
  OrbitalConfigSchema,
  parseOrbitalSchema,
  safeParseOrbitalSchema,
} from "./schema.js";

// Backward compatibility alias - FullOrbitalUnit is just Orbital
export type { Orbital as FullOrbitalUnit } from "./orbital.js";

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
  isSingletonEntity,
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
} from "./expression.js";

// ============================================================================
// S-Expression Operators
// ============================================================================

export {
  // Types
  type OperatorCategory,
  type TargetPlatform,
  type CategoryMeta,
  type OperatorMeta,
  type OperatorsSchema,
  type OperatorStats,
  type OperatorName,
  // Data
  OPERATORS_SCHEMA,
  OPERATORS,
  CATEGORIES,
  OPERATOR_NAMES,
  // Functions
  getOperatorMeta,
  isKnownOperator,
  isEffectOperator,
  isGuardOperator,
  getOperatorsByCategory,
  getOperatorsForTarget,
  validateOperatorArity,
  getOperatorStats,
  getAllOperators,
} from "./operators.js";

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
  type UISlot,
  type PatternConfig,
  type RenderUIConfig,
  type CallServiceConfig,
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
} from "./effect.js";

// ============================================================================
// Trait Types
// ============================================================================

export {
  type Trait,
  type TraitRef,
  type TraitReference,
  type TraitCategory,
  type TraitEventListener,
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
  // Schemas
  TraitSchema,
  TraitRefSchema,
  TraitReferenceSchema,
  TraitCategorySchema,
  TraitEventListenerSchema,
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
  SERVICE_TYPES,
  ServiceTypeSchema,
  ServiceDefinitionSchema,
  RestServiceDefSchema,
  SocketServiceDefSchema,
  McpServiceDefSchema,
  RestAuthConfigSchema,
  SocketEventsSchema,
  ServiceRefSchema,
  ServiceRefStringSchema,
  isRestService,
  isSocketService,
  isMcpService,
  isServiceReference,
  parseServiceRef,
  getServiceNames,
  findService,
  hasService,
} from "./service.js";

// ============================================================================
// Pattern Types
// ============================================================================

export {
  type PatternType,
  PATTERN_TYPES,
  PatternTypeSchema,
  getAllPatternTypes,
  isValidPatternType,
} from "./pattern.js";

// ============================================================================
// Asset Types
// ============================================================================

export {
  // Constants
  ENTITY_ROLES,
  VISUAL_STYLES,
  GAME_TYPES,
  // Types
  type EntityRole,
  type VisualStyle,
  type GameType,
  type AnimationDef,
  type SemanticAssetRef,
  type ResolvedAsset,
  type AssetMapping,
  type AssetMap,
  type SemanticAssetRefInput,
  type ResolvedAssetInput,
  type AssetMappingInput,
  type AssetMapInput,
  type AnimationDefInput,
  // Schemas
  EntityRoleSchema,
  VisualStyleSchema,
  GameTypeSchema,
  AnimationDefSchema,
  SemanticAssetRefSchema,
  ResolvedAssetSchema,
  AssetMappingSchema,
  AssetMapSchema,
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
  type ChangeAuthor,
  type ChangeSummary,
  type ChangeSetDocument,
  type SnapshotDocument,
  type CategorizedRemovals,
  type PageContentReduction,
  type HistoryMeta,
  type ValidationMeta,
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
