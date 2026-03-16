/**
 * Service Contract Types
 *
 * Formalizes the two public surfaces of an Almadar service:
 * 1. Call-Service Contract — what the .orb schema can invoke on the TypeScript package
 * 2. Event Contract — what events enter/leave the service
 *
 * Plus internal-but-standardized patterns:
 * 3. StoreContract — database abstraction boundary
 * 4. LazyService — singleton lifecycle pattern
 *
 * @packageDocumentation
 */

// ============================================================================
// Service Action Names (generated from services-registry.json)
// ============================================================================

/**
 * All known service action names across all contracts.
 * Kept in sync with `tools/almadar-service-sync/services-registry.json`.
 *
 * Persist operations are listed separately because they also appear
 * as `EffectResult.action` for persist effects.
 */
export type PersistActionName =
  | "create"
  | "update"
  | "delete"
  | "list"
  | "query";

/**
 * Union of all service action names across all 22 service contracts.
 */
export type ServiceActionName =
  | PersistActionName
  // Data service
  | "get"
  | "getById"
  | "set"
  | "remove"
  | "size"
  // LLM
  | "generate"
  | "classify"
  | "extract"
  | "summarize"
  // Messaging
  | "send"
  | "sendMessage"
  | "sendSMS"
  | "sendWhatsApp"
  // Auth / Identity
  | "authorize"
  | "revoke"
  | "token"
  | "refresh"
  | "userinfo"
  | "register"
  // Git / VCS
  | "cloneRepo"
  | "commit"
  | "createBranch"
  | "createPR"
  | "getPRComments"
  | "pull"
  | "push"
  // CI / Build
  | "build"
  | "compile"
  | "compileSchema"
  | "run"
  | "validate"
  | "validateSchema"
  | "publish"
  // Queue / Jobs
  | "enqueue"
  | "dequeue"
  | "cancel"
  // Storage / Assets
  | "upload"
  | "download"
  | "getSignedUrl"
  // Search / Issues
  | "search"
  | "getIssue"
  | "listIssues"
  // Agent / Generation
  | "generateAll"
  | "generateDomainLanguage"
  | "generateFix"
  | "generateOrbitals"
  | "cancelGeneration"
  | "getGenerationHistory"
  | "recordGeneration"
  // Telemetry / Metrics
  | "startSpan"
  | "endSpan"
  | "getSpan"
  | "recordMetric"
  | "getMetrics"
  | "increment"
  | "logs"
  // Events / Channels
  | "addEvent"
  | "emit"
  | "findEmitters"
  | "findListeners"
  | "getListenerCounts"
  | "getChannel"
  | "subscribe"
  // User / Preferences
  | "getUserPreferences"
  | "updateUserPreferences"
  | "getThreadHistory"
  // Media
  | "getVideo"
  // Payments
  | "createPaymentIntent"
  | "confirmPayment"
  | "refund"
  // Lifecycle
  | "complete"
  | "fail"
  | "expire"
  | "resume"
  | "status"
  | "stop"
  | "lock"
  | "unlock"
  | "clear";

// ============================================================================
// Call-Service Contract
// ============================================================================

/**
 * Action definition for a service contract.
 * Each action has typed params and a typed result.
 */
export interface ServiceAction {
  params: Record<string, unknown>;
  result: unknown;
}

/**
 * What `["call-service", "name", "action", {...}]` actually calls at runtime.
 * Each service defines its action map as a Record<string, ServiceAction>.
 *
 * @example
 * ```typescript
 * type LLMActions = {
 *   generate: {
 *     params: { userPrompt: string; model: string; maxTokens: number };
 *     result: { content: string; tokensUsed: number; latencyMs: number };
 *   };
 * };
 *
 * class LLMService implements ServiceContract<LLMActions> {
 *   async execute(action, params) { ... }
 * }
 * ```
 */
export interface ServiceContract<
  Actions extends Record<string, ServiceAction>,
> {
  execute<A extends keyof Actions & string>(
    action: A,
    params: Actions[A]["params"],
  ): Promise<Actions[A]["result"]>;
}

// ============================================================================
// Event Contract
// ============================================================================

/**
 * Event contract — what events the service emits/listens with typed payloads.
 * Derived from the `.orb` schema's `emits` and `listens` declarations.
 *
 * @example
 * ```typescript
 * type LLMEventMap = {
 *   AGENT_LLM_REQUEST: { requestId: string; prompt: string };
 *   LLM_RESPONSE: { requestId: string; content: string; tokensUsed: number };
 *   LLM_ERROR: { requestId: string; error: string };
 * };
 *
 * const events: ServiceEvents<LLMEventMap> = getEventBus();
 * events.emit('LLM_RESPONSE', { requestId: '1', content: '...', tokensUsed: 42 });
 * ```
 */
export interface ServiceEvents<
  EventMap extends Record<string, Record<string, unknown>>,
> {
  emit<E extends keyof EventMap & string>(
    event: E,
    payload: EventMap[E],
  ): void;
  on<E extends keyof EventMap & string>(
    event: E,
    handler: (payload: EventMap[E]) => void,
  ): () => void;
}

/**
 * Create a typed view of an untyped EventBus. Wraps the raw EventBus
 * with compile-time type checking while keeping runtime behavior identical.
 *
 * @example
 * ```typescript
 * type LLMEventMap = {
 *   LLM_RESPONSE: { requestId: string; content: string };
 *   LLM_ERROR: { requestId: string; error: string };
 * };
 *
 * const typedBus = createTypedEventBus<LLMEventMap>(getServerEventBus());
 * typedBus.emit('LLM_RESPONSE', { requestId: '1', content: '...' }); // type-safe
 * typedBus.on('LLM_ERROR', (payload) => { payload.error; }); // payload is typed
 * ```
 */
/**
 * Creates a typed event bus from an untyped bus implementation.
 * 
 * This wrapper adds TypeScript type safety to event emission and listening.
 * The generic `EventMap` defines the shape of all events and their payloads.
 * 
 * @template EventMap - Type mapping event names to their payload types
 * @param {Object} bus - Untyped event bus implementation
 * @param {Function} bus.emit - Function to emit events
 * @param {Function} bus.on - Function to listen to events
 * @returns {ServiceEvents<EventMap>} Typed event bus interface
 * 
 * @example
 * interface MyEvents {
 *   'user.created': { id: string; name: string };
 *   'user.deleted': { id: string };
 * }
 * 
 * const typedBus = createTypedEventBus<MyEvents>(rawBus);
 * typedBus.emit('user.created', { id: '123', name: 'Alice' });
 */
export function createTypedEventBus<
  EventMap extends Record<string, Record<string, unknown>>,
>(bus: {
  emit(event: string, payload?: unknown, meta?: Record<string, unknown>): void;
  on(event: string, handler: (payload: unknown, meta?: Record<string, unknown>) => void): () => void;
}): ServiceEvents<EventMap> {
  return {
    emit<E extends keyof EventMap & string>(event: E, payload: EventMap[E]): void {
      bus.emit(event, payload);
    },
    on<E extends keyof EventMap & string>(
      event: E,
      handler: (payload: EventMap[E]) => void,
    ): () => void {
      return bus.on(event, handler as (payload: unknown) => void);
    },
  };
}

// ============================================================================
// Store Contract
// ============================================================================

/** Filter operator for store queries. */
export type StoreFilterOp =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "not-in"
  | "contains";

/** A single filter clause for store queries. */
export interface StoreFilter<T> {
  field: keyof T & string;
  op: StoreFilterOp;
  value: unknown;
}

/**
 * Database abstraction boundary. Services receive `StoreContract<T>`,
 * not raw database clients. Swappable per database engine.
 *
 * @example
 * ```typescript
 * interface LLMRequest { id: string; prompt: string; status: string }
 *
 * class FirestoreLLMRequestStore implements StoreContract<LLMRequest> {
 *   async getById(id) { ... }
 *   async create(data) { ... }
 *   async update(id, data) { ... }
 *   async delete(id) { ... }
 *   async query(filters) { ... }
 * }
 * ```
 */
export interface StoreContract<T extends { id: string }> {
  getById(id: string): Promise<T | null>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  query(filters: StoreFilter<T>[]): Promise<T[]>;
}

// ============================================================================
// Lazy Service (Singleton Pattern)
// ============================================================================

/**
 * Standardized singleton lifecycle. Replaces ad-hoc
 * `let x = null; export function getX()` patterns.
 *
 * @example
 * ```typescript
 * const llmClient = createLazyService(() => new LLMClient({ apiKey: process.env.LLM_KEY }));
 *
 * // In request handler:
 * const client = llmClient.get(); // created on first call, cached after
 *
 * // In test teardown:
 * llmClient.reset(); // next get() creates a fresh instance
 * ```
 */
export interface LazyService<T> {
  /** Get the singleton instance (creates on first call). */
  get(): T;
  /** Reset the singleton (next get() creates fresh). For test isolation. */
  reset(): void;
}

/**
 * Create a lazy singleton from a factory function.
 * 
 * Creates a service that lazily initializes on first access and caches the instance.
 * Useful for expensive resources like database connections or API clients.
 * 
 * @template T - The type of service to create
 * @param {() => T} factory - Factory function that creates the service instance
 * @returns {LazyService<T>} Lazy service with get() and reset() methods
 * 
 * @example
 * const dbService = createLazyService(() => new DatabaseClient(config));
 * const db = dbService.get(); // Initializes on first call
 */
export function createLazyService<T>(factory: () => T): LazyService<T> {
  let instance: T | null = null;
  return {
    get(): T {
      if (instance === null) {
        instance = factory();
      }
      return instance;
    },
    reset(): void {
      instance = null;
    },
  };
}
