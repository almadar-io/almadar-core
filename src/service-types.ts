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
