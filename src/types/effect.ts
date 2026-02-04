/**
 * Effect Types (Self-Contained)
 *
 * Defines effect types for trait transitions and ticks.
 * Effects are S-expressions (arrays) that describe actions to perform.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { type SExpr } from './expression.js';

// ============================================================================
// UI Slots
// ============================================================================

/**
 * Known UI slots where content can be rendered
 */
export const UI_SLOTS = [
    'main',
    'sidebar',
    'modal',
    'drawer',
    'overlay',
    'center',
    'toast',
    'hud-top',
    'hud-bottom',
    'floating',
    'system', // For invisible system components (InputListener, CollisionDetector)
] as const;

export type UISlot = (typeof UI_SLOTS)[number];

export const UISlotSchema = z.enum(UI_SLOTS);

// ============================================================================
// Pattern Config (for render-ui effects)
// ============================================================================

/**
 * Pattern configuration for render-ui effect
 */
export interface PatternConfig {
    type: string;
    [key: string]: unknown;
}

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
// Effect Type (S-Expression Only)
// ============================================================================

/**
 * Effect type - S-expression format (array form).
 *
 * Effects are arrays where the first element is the operator name (string)
 * and subsequent elements are the arguments.
 *
 * @example
 * ["set", "@entity.health", 100]
 * ["emit", "PLAYER_DIED", { "playerId": "@entity.id" }]
 * ["render-ui", "main", { "type": "entity-table", "entity": "Task" }]
 * ["call-service", "WeatherAPI", { "action": "getWeather", "onSuccess": "OK", "onError": "ERR" }]
 * ["navigate", "/tasks"]
 * ["persist", "create", "Task", { "title": "@payload.title" }]
 */
export type Effect = SExpr[];

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
export function navigate(path: string, params?: Record<string, string>): Effect {
    return params ? ['navigate', path, params] : ['navigate', path];
}

/**
 * Create a render-ui effect
 * @example ["render-ui", "main", { "type": "entity-table", "entity": "Task" }]
 */
export function renderUI(
    target: UISlot,
    pattern: PatternConfig | null,
    props?: Record<string, unknown>
): Effect {
    const patternObj = pattern ? { ...pattern } : null;
    return props
        ? ['render-ui', target, patternObj as SExpr, props]
        : ['render-ui', target, patternObj as SExpr];
}

/**
 * Create a persist effect
 * @example ["persist", "create", "Task", { "title": "@payload.title" }]
 */
export function persist(
    action: 'create' | 'update' | 'delete' | 'clear',
    entity: string,
    data?: Record<string, unknown>
): Effect {
    return data ? ['persist', action, entity, data] : ['persist', action, entity];
}

/**
 * Create a call-service effect
 * @example ["call-service", "stripe", { "action": "charge", "onSuccess": "OK", "onError": "ERR" }]
 */
export function callService(
    service: string,
    config: { action: string; onSuccess: string; onError: string; params?: Record<string, unknown> }
): Effect {
    return ['call-service', service, config];
}

/**
 * Create a spawn effect (games)
 * @example ["spawn", "Bullet", { "x": "@entity.x", "y": "@entity.y" }]
 */
export function spawn(
    entity: string,
    initialState?: Record<string, unknown>
): Effect {
    return initialState ? ['spawn', entity, initialState] : ['spawn', entity];
}

/**
 * Create a despawn effect (games)
 * @example ["despawn", "@entity.id"]
 */
export function despawn(entityId: string): Effect {
    return ['despawn', entityId];
}

/**
 * Create a do effect (multiple effects)
 * @example ["do", ["set", "@entity.x", 0], ["set", "@entity.y", 0]]
 */
export function doEffects(...effects: Effect[]): Effect {
    return ['do', ...effects];
}

/**
 * Create a notify effect
 * @example ["notify", "in_app", "Task created successfully"]
 */
export function notify(
    channel: 'email' | 'push' | 'sms' | 'in_app',
    message: string,
    recipient?: string
): Effect {
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
export function fetch(
    entity: string,
    options?: FetchOptions
): Effect {
    return options ? ['fetch', entity, options as SExpr] : ['fetch', entity];
}
