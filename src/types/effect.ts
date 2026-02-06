/**
 * Effect Types (Self-Contained)
 *
 * Defines effect types for trait transitions and ticks.
 * Effects are S-expressions (arrays) that describe actions to perform.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { type SExpr, type Expression } from './expression.js';

// ============================================================================
// UI Slots
// ============================================================================

/**
 * Known UI slots where content can be rendered
 */
export const UI_SLOTS = [
    // App slots
    'main',
    'sidebar',
    'modal',
    'drawer',
    'overlay',
    'center',
    'toast',
    'floating',
    'system', // For invisible system components (InputListener, CollisionDetector)
    'content',
    'screen',
    // Game HUD slots
    'hud',
    'hud-top',
    'hud-bottom',
    'hud.health',
    'hud.score',
    'hud.inventory',
    'hud.stamina',
    // Game overlay slots
    'overlay.inventory',
    'overlay.dialogue',
    'overlay.menu',
    'overlay.pause',
] as const;

export type UISlot = (typeof UI_SLOTS)[number];

export const UISlotSchema = z.enum(UI_SLOTS);

// ============================================================================
// Pattern Config (for render-ui effects)
// ============================================================================

// Import pattern types for local use and re-export for consumers
import type {
    PatternType,
    PatternConfig,
    PatternProps,
    PatternPropsMap,
    AnyPatternConfig,
} from '@almadar/patterns';

/**
 * Type-safe pattern configuration for render-ui effects.
 *
 * Re-exported from @almadar/patterns. Generated from patterns-registry.json.
 *
 * @example
 * // Type-safe with specific pattern type
 * const config: PatternConfig<'entity-table'> = {
 *   patternType: 'entity-table',
 *   columns: ['name', 'email'],  // ✅ Required prop
 *   entity: 'User',
 * };
 *
 * // Error: Property 'columns' is missing (required prop)
 * const bad: PatternConfig<'entity-table'> = { patternType: 'entity-table' };
 *
 * // Error: 'fake-pattern' is not assignable to PatternType
 * const invalid: PatternConfig = { patternType: 'fake-pattern' };
 */
export type {
    PatternType,
    PatternConfig,
    PatternProps,
    PatternPropsMap,
    AnyPatternConfig,
};

// ============================================================================
// Service Config (for call-service effects)
// ============================================================================

/**
 * Configuration extracted from call-service effects
 */
export interface CallServiceConfig {
    service: string;
    action: string;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    params?: Record<string, unknown>;
    onSuccess?: string;
    onError?: string;
}

// ============================================================================
// Typed Effect Tuples
// ============================================================================

/**
 * Render UI effect - displays a pattern in a UI slot.
 * @example ['render-ui', 'main', { patternType: 'entity-table', columns: ['name'] }]
 */
export type RenderUIEffect =
    | ['render-ui', UISlot, AnyPatternConfig]
    | ['render-ui', UISlot, AnyPatternConfig, Record<string, unknown>];

/**
 * Navigate effect - navigates to a path.
 * @example ['navigate', '/tasks'] or ['navigate', '/tasks/:id', { id: '123' }]
 */
export type NavigateEffect = ['navigate', string] | ['navigate', string, Record<string, string>];

/**
 * Emit effect - emits an event, optionally with payload.
 * @example ['emit', 'SAVE'] or ['emit', 'PLAYER_DIED', { playerId: '@entity.id' }]
 * @example ['emit', 'FILTER_CHANGED', '@entity.filters']
 */
export type EmitEffect = ['emit', string] | ['emit', string, Record<string, unknown> | string];

/**
 * Set effect - sets a binding to a value.
 * @example ['set', '@entity.health', 100]
 */
export type SetEffect = ['set', string, unknown];

/**
 * Persist effect - creates, updates, deletes, or clears entities.
 * @example ['persist', 'create', 'Task', { title: '@payload.title' }]
 * @example ['persist', 'update', '@entity.entityType', '@payload.data']
 */
export type PersistEffect =
    | ['persist', 'create', string, Record<string, unknown> | string]
    | ['persist', 'update', string, Record<string, unknown> | string]
    | ['persist', 'delete', string]
    | ['persist', 'delete', string, Record<string, unknown> | string]
    | ['persist', 'clear', string]
    | ['persist', 'clear', string, Record<string, unknown> | string];

/**
 * Call service effect - invokes an external service.
 * @example ['call-service', 'WeatherAPI', { service: 'weather', action: 'get', onSuccess: 'OK' }]
 */
export type CallServiceEffect = ['call-service', string, CallServiceConfig];

/**
 * Spawn effect - creates a new entity instance (games).
 * @example ['spawn', 'Bullet', { x: '@entity.x', y: '@entity.y' }]
 */
export type SpawnEffect = ['spawn', string] | ['spawn', string, Record<string, unknown>];

/**
 * Despawn effect - removes an entity instance (games).
 * @example ['despawn', '@entity.id']
 */
export type DespawnEffect = ['despawn', string];

/**
 * Do effect - executes multiple effects in sequence.
 * Uses SExpr to allow deeply nested conditionals.
 * @example ['do', ['set', '@entity.x', 0], ['set', '@entity.y', 0]]
 */
export type DoEffect = ['do', ...SExpr[]];

/**
 * Notify effect - sends a notification.
 * @example ['notify', 'in_app', 'Task created successfully']
 * @example ['notify', 'in_app', ['str/concat', 'Item: ', '@entity.name']]
 */
export type NotifyEffect =
    | ['notify', string, string | SExpr]
    | ['notify', string, string | SExpr, string];

/**
 * Fetch effect - retrieves entity data (server-side).
 * @example ['fetch', 'User'] or ['fetch', 'User', { id: '@payload.userId' }]
 */
export type FetchEffect = ['fetch', string] | ['fetch', string, Record<string, unknown>];

/**
 * If effect - conditional effect execution.
 * Uses SExpr to allow deeply nested conditionals.
 * @example ['if', ['>', '@entity.health', 0], ['emit', 'ALIVE'], ['emit', 'DEAD']]
 */
export type IfEffect = ['if', Expression, SExpr] | ['if', Expression, SExpr, SExpr];

/**
 * When effect - conditional effect similar to if but without else.
 * Uses SExpr to allow deeply nested conditionals.
 * @example ['when', ['>', '@entity.health', 0], ['emit', 'ALIVE']]
 */
export type WhenEffect = ['when', Expression, SExpr];

/**
 * Let effect - creates local bindings for effects.
 * Uses SExpr to allow deeply nested conditionals.
 * @example ['let', ['temp', ['get', '@payload.value']], ['set', '@entity.value', 'temp']]
 */
export type LetEffect = ['let', [string, unknown][], ...SExpr[]];

/**
 * Log effect - logs a message for debugging.
 * @example ['log', 'User created:', '@entity.name']
 */
export type LogEffect = ['log', ...unknown[]];

/**
 * Wait effect - delays execution.
 * @example ['wait', 1000] - wait 1 second
 */
export type WaitEffect = ['wait', number];

// ============================================================================
// Async Effects (from almadar-std/modules/async)
// ============================================================================

/**
 * Async delay effect - wait then execute effects.
 * @example ['async/delay', 2000, ['emit', 'TIMEOUT']]
 */
export type AsyncDelayEffect = ['async/delay', number | string, ...Effect[]];

/**
 * Async debounce effect - debounce then execute effect.
 * @example ['async/debounce', 300, ['emit', 'SEARCH_COMPLETE']]
 * @example ['async/debounce', '@entity.debounceMs', ['emit', 'SEARCH_COMPLETE']]
 */
export type AsyncDebounceEffect = ['async/debounce', number | string, SExpr];

/**
 * Async throttle effect - throttle then execute effect.
 * @example ['async/throttle', 100, ['emit', 'SCROLL_HANDLED']]
 * @example ['async/throttle', '@entity.throttleMs', ['emit', 'SCROLL_HANDLED']]
 */
export type AsyncThrottleEffect = ['async/throttle', number | string, SExpr];

/**
 * Async interval effect - execute effect at intervals.
 * @example ['async/interval', 1000, ['emit', 'TICK']]
 * @example ['async/interval', '@entity.intervalMs', ['emit', 'POLL_TICK']]
 */
export type AsyncIntervalEffect = ['async/interval', number | string, SExpr];

/**
 * Async race effect - first effect to complete wins.
 * @example ['async/race', ['call', 'api1'], ['call', 'api2']]
 */
export type AsyncRaceEffect = ['async/race', ...Effect[]];

/**
 * Async all effect - wait for all effects to complete.
 * @example ['async/all', ['call', 'api1'], ['call', 'api2']]
 */
export type AsyncAllEffect = ['async/all', ...Effect[]];

/**
 * Async sequence effect - execute effects in sequence.
 * @example ['async/sequence', ['call', 'validate'], ['call', 'save']]
 */
export type AsyncSequenceEffect = ['async/sequence', ...Effect[]];

/**
 * Union of all typed effects.
 * Provides compile-time validation for common effect types.
 */
export type TypedEffect =
    | RenderUIEffect
    | NavigateEffect
    | EmitEffect
    | SetEffect
    | PersistEffect
    | CallServiceEffect
    | SpawnEffect
    | DespawnEffect
    | DoEffect
    | NotifyEffect
    | FetchEffect
    | IfEffect
    | WhenEffect
    | LetEffect
    | LogEffect
    | WaitEffect
    | AsyncDelayEffect
    | AsyncDebounceEffect
    | AsyncThrottleEffect
    | AsyncIntervalEffect
    | AsyncRaceEffect
    | AsyncAllEffect
    | AsyncSequenceEffect;

// ============================================================================
// Effect Type (Strictly Typed)
// ============================================================================

/**
 * Effect type - typed S-expression format.
 *
 * Effects are strongly typed tuples that enforce:
 * - Valid effect operators (render-ui, emit, set, persist, navigate, call-service)
 * - Valid UISlots for render-ui
 * - Valid PatternTypes and props for render-ui
 * - Correct argument types for each effect
 *
 * Available typed effects:
 * - RenderUIEffect: ['render-ui', UISlot, PatternConfig]
 * - NavigateEffect: ['navigate', path] or ['navigate', path, params]
 * - EmitEffect: ['emit', eventName] or ['emit', eventName, payload]
 * - SetEffect: ['set', binding, value]
 * - PersistEffect: ['persist', operation, entity, data?]
 * - CallServiceEffect: ['call-service', serviceName, config]
 *
 * @example
 * ["set", "@entity.health", 100]
 * ["emit", "PLAYER_DIED", { "playerId": "@entity.id" }]
 * ["render-ui", "main", { "patternType": "entity-table", "columns": ["name"] }]
 * ["call-service", "WeatherAPI", { "action": "getWeather", "onSuccess": "OK" }]
 * ["navigate", "/tasks"]
 * ["persist", "create", "Task", { "title": "@payload.title" }]
 */
export type Effect = TypedEffect;

/**
 * Schema for Effect - validates S-expression format
 */
export const EffectSchema = z.array(z.unknown()).min(1).refine(
    (arr) => typeof arr[0] === 'string',
    { message: 'Effect must be an S-expression with a string operator as first element' }
);

export type EffectInput = z.input<typeof EffectSchema>;

/**
 * Type guard to check if a value is a valid Effect (S-expression).
 */
export function isEffect(value: unknown): value is Effect {
    return Array.isArray(value) && value.length > 0 && typeof value[0] === 'string';
}

/**
 * Alias for isEffect (for clarity when working with S-expressions)
 */
export const isSExprEffect = isEffect;

// ============================================================================
// Effect Builder Helpers
// ============================================================================

/**
 * Create a set effect
 * @example ["set", "@entity.health", 100]
 */
export function set(binding: string, value: SExpr): Effect {
    return ['set', binding, value];
}

/**
 * Create an emit effect
 * @example ["emit", "PLAYER_DIED", { "playerId": "@entity.id" }]
 */
export function emit(event: string, payload?: Record<string, unknown>): Effect {
    return payload ? ['emit', event, payload] : ['emit', event];
}

/**
 * Create a navigate effect
 * @example ["navigate", "/tasks"]
 */
export function navigate(path: string): NavigateEffect;
export function navigate(path: string, params: Record<string, string>): NavigateEffect;
export function navigate(path: string, params?: Record<string, string>): NavigateEffect {
    return params ? ['navigate', path, params] : ['navigate', path];
}

/**
 * Create a render-ui effect
 * @example ["render-ui", "main", { "patternType": "entity-table", "columns": ["name"] }]
 */
export function renderUI(
    target: UISlot,
    pattern: AnyPatternConfig
): RenderUIEffect;
export function renderUI(
    target: UISlot,
    pattern: AnyPatternConfig,
    props: Record<string, unknown>
): RenderUIEffect;
export function renderUI(
    target: UISlot,
    pattern: AnyPatternConfig,
    props?: Record<string, unknown>
): RenderUIEffect {
    return props
        ? ['render-ui', target, pattern, props]
        : ['render-ui', target, pattern];
}

/**
 * Create a persist effect
 * @example ["persist", "create", "Task", { "title": "@payload.title" }]
 */
export function persist(
    action: 'create' | 'update',
    entity: string,
    data: Record<string, unknown>
): PersistEffect;
export function persist(
    action: 'delete' | 'clear',
    entity: string,
    data?: Record<string, unknown>
): PersistEffect;
export function persist(
    action: 'create' | 'update' | 'delete' | 'clear',
    entity: string,
    data?: Record<string, unknown>
): PersistEffect {
    if (action === 'create' || action === 'update') {
        return ['persist', action, entity, data!] as PersistEffect;
    }
    return data
        ? ['persist', action, entity, data] as PersistEffect
        : ['persist', action, entity] as PersistEffect;
}

/**
 * Create a call-service effect
 * @example ["call-service", "stripe", { "service": "stripe", "action": "charge", "onSuccess": "OK", "onError": "ERR" }]
 */
export function callService(
    serviceName: string,
    config: CallServiceConfig
): CallServiceEffect {
    return ['call-service', serviceName, config];
}

/**
 * Create a spawn effect (games)
 * @example ["spawn", "Bullet", { "x": "@entity.x", "y": "@entity.y" }]
 */
export function spawn(entity: string): SpawnEffect;
export function spawn(entity: string, initialState: Record<string, unknown>): SpawnEffect;
export function spawn(entity: string, initialState?: Record<string, unknown>): SpawnEffect {
    return initialState ? ['spawn', entity, initialState] : ['spawn', entity];
}

/**
 * Create a despawn effect (games)
 * @example ["despawn", "@entity.id"]
 */
export function despawn(entityId: string): DespawnEffect {
    return ['despawn', entityId];
}

/**
 * Create a do effect (multiple effects)
 * @example ["do", ["set", "@entity.x", 0], ["set", "@entity.y", 0]]
 */
export function doEffects(...effects: SExpr[]): DoEffect {
    return ['do', ...effects];
}

/**
 * Create a notify effect
 * @example ["notify", "in_app", "Task created successfully"]
 */
export function notify(
    channel: 'email' | 'push' | 'sms' | 'in_app',
    message: string
): NotifyEffect;
export function notify(
    channel: 'email' | 'push' | 'sms' | 'in_app',
    message: string,
    recipient: string
): NotifyEffect;
export function notify(
    channel: 'email' | 'push' | 'sms' | 'in_app',
    message: string,
    recipient?: string
): NotifyEffect {
    return recipient
        ? ['notify', channel, message, recipient]
        : ['notify', channel, message];
}

/**
 * Fetch options for entity data retrieval
 */
export interface FetchOptions {
    /** Fetch a single entity by ID */
    id?: string;
    /** Filter expression (S-expression) */
    filter?: SExpr;
    /** Maximum number of entities to return */
    limit?: number;
    /** Number of entities to skip */
    offset?: number;
    /** Allow additional properties for flexibility */
    [key: string]: unknown;
}

/**
 * Create a fetch effect (server-side data retrieval)
 * @example ["fetch", "User"] - fetch all users
 * @example ["fetch", "User", { "id": "@payload.userId" }] - fetch by ID
 * @example ["fetch", "User", { "filter": ["=", "@entity.status", "active"], "limit": 10 }]
 */
export function fetch(entity: string): FetchEffect;
export function fetch(entity: string, options: FetchOptions): FetchEffect;
export function fetch(entity: string, options?: FetchOptions): FetchEffect {
    return options ? ['fetch', entity, options as Record<string, unknown>] : ['fetch', entity];
}

