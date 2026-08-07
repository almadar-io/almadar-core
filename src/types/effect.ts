/**
 * Effect Types (Self-Contained)
 *
 * Defines effect types for trait transitions and ticks.
 * Effects are S-expressions (arrays) that describe actions to perform.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { type SExpr, type Expression, type EventPayload, SExprDataSchema } from './expression.js';
import type { RuntimeValue, JsonValue } from './json.js';
import { type ServiceParams } from './service.js';
import { type EntityRow } from './entity.js';

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
} from '../patterns/index.js';

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
export type CallServiceConfig = {
    service: string;
    action: string;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    params?: ServiceParams;
    onSuccess?: string;
    onError?: string;
};

// ============================================================================
// Typed Effect Tuples
// ============================================================================

/**
 * A binding reference to a render tree stored elsewhere — a trait `config`
 * knob or a payload field — e.g. `"@config.bodyContent"`. Resolved to a pattern
 * node at render time. This is how an atom renders a tree that contains data
 * bindings (`entity: "@payload.data"`, `fields: "@config.fields"`): the tree is
 * a permissive `TraitConfigValue` stored in `config` (a binding string is not a
 * valid `AnyPatternConfig` prop value), and the render-ui effect points at it.
 * Worked example: `std-browse`'s loaded transition is `['render-ui', 'main',
 * '@config.bodyContent']`. The Rust validator accepts this form; this variant
 * lets the TS effect type express it.
 */
export type RenderBinding = `@${string}`;

/**
 * A binding reference resolving to a {@link UISlot} at inline time — a trait
 * `config` knob holding the slot name, e.g. `"@config.reviewSlot"`. Mirrors
 * {@link RenderBinding} for the SLOT position: the compiler's inline phase
 * substitutes the config value before anything renders, and the Rust
 * validator accepts the pre-substitution form (worked example:
 * `std-approval-gate`'s review queue renders into `@config.reviewSlot`).
 * This variant lets the TS effect type express the template-layer form.
 */
export type SlotBinding = `@config.${string}`;

/**
 * Template-layer pattern node: a render tree whose discriminant and/or props
 * are still bindings (`type: '@config.viewPattern'`, `title: '@config.title'`)
 * or loose nested descriptors the compiler's inline phase resolves. The
 * resolved layer is {@link AnyPatternConfig}; this variant lets generated
 * behavior descriptors (std-ts) carry the pre-substitution form the Rust
 * validator accepts (worked example: `std-graphs` renders
 * `{ type: '@config.viewPattern', chartType: '@config.chartType', … }`).
 */
export type TemplatePatternConfig = { type: PatternType | RenderBinding } & Record<string, JsonValue>;

/**
 * Render UI effect - displays a pattern in a UI slot.
 * @example ['render-ui', 'main', { patternType: 'entity-table', columns: ['name'] }]
 * @example ['render-ui', 'main', '@config.bodyContent']  // a {@link RenderBinding} target
 * @example ['render-ui', '@config.reviewSlot', { patternType: 'entity-table' }]  // a {@link SlotBinding} slot
 */
export type RenderUIEffect =
    | ['render-ui', UISlot | SlotBinding, AnyPatternConfig]
    | ['render-ui', UISlot | SlotBinding, AnyPatternConfig, ResolvedPatternProps]
    | ['render-ui', UISlot | SlotBinding, TemplatePatternConfig]
    | ['render-ui', UISlot | SlotBinding, RenderBinding]
    | ['render-ui', UISlot | SlotBinding, null];

/**
 * Lambda expression for per-item rendering in data-grid/data-list.
 * The compiler generates: {(paramName: Record<string, unknown>) => (<>JSX</>)}
 * where @{paramName}.field bindings reference the current iteration item.
 *
 * @example ["fn", "item", { "type": "stack", "children": [{ "type": "typography", "content": "@item.title" }] }]
 */
export type RenderItemLambda = ['fn', string, AnyPatternConfig];

/**
 * Dynamic-collection children entry: renders one child per item of a collection
 * expression, authored inline in a `children:` position and kept verbatim as IR
 * (no new node kind). The collection expression is an {@link SExpr} evaluated at
 * render time; the {@link RenderItemLambda} body is instantiated per item with
 * the lambda param bound as an `@item`-scope binding. Both execution paths lower
 * onto the one lambda + `@item` + splice machinery.
 *
 * @example ["array/map", "@entity.tasks", ["fn", "item", { "type": "typography", "content": "@item.title" }]]
 */
export type RenderChildrenMap = ['array/map', SExpr, RenderItemLambda];

/**
 * Navigate effect - navigates to an internal page path or an external URL.
 * @example ['navigate', '/tasks'] or ['navigate', '/tasks/:id', { id: '123' }]
 * @example ['navigate', 'https://example.com']
 */
export type NavigateEffect =
    | ['navigate', string | SExpr]
    | ['navigate', string | SExpr, Record<string, string>];

/**
 * Emit effect - emits an event, optionally with payload.
 * @example ['emit', 'SAVE'] or ['emit', 'PLAYER_DIED', { playerId: '@entity.id' }]
 * @example ['emit', 'FILTER_CHANGED', '@entity.filters']
 */
export type EmitEffect = ['emit', string] | ['emit', string, EventPayload | string];

/**
 * `emit:` config block attached to async / reactive data operators.
 *
 * Each key names an event the runtime should fire on the bus when the
 * effect reaches the corresponding lifecycle point. The set of keys an
 * operator actually supports is enforced by the compiler validator:
 *
 * | Operator         | Supported keys            |
 * |------------------|---------------------------|
 * | `fetch`          | `success`, `failure`      |
 * | `persist`        | `success`, `failure`      |
 * | `call-service`   | `success`, `failure`      |
 * | `set`            | `success`                 |
 * | `ref`            | `on_change`, `failure`    |
 * | `os/watch-*`     | `on_message`, `failure`   |
 *
 * Payload convention:
 * - `success` / `on_change` → the effect's result (fetched entity, new value)
 * - `failure`               → `{ error: string, code?: string }`
 * - `on_message`            → the incoming message (os/watch-* streams)
 *
 * See `docs/Almadar_Std_Gaps.md` §3.1 for the close-the-circuit design.
 */
export interface EmitConfig {
    /** Fires after a one-shot async effect resolves successfully. */
    success?: string;
    /** Fires when the effect throws; payload is `{ error: string }`. */
    failure?: string;
    /** Reactive-subscription event (per update for `ref`). */
    on_change?: string;
    /** Per-event fire for `os/watch-*` streams. */
    on_message?: string;
}

/**
 * Set effect - sets a binding to a value.
 *
 * Two forms are supported to match the runtime's `set` handler signature
 * `(targetId, field, value)`:
 *
 * - 3-element binding form (legacy / std behaviors): ['set', '@entity.field', value]
 * - 4-element target form (canonical runtime): ['set', entityId, fieldName, value]
 *
 * The 4-element form is what `OrbitalServerRuntime`'s set handler
 * dispatches directly (`update(entityType, targetId, { field: value })`).
 * Prefer the 4-element form when authoring schemas in TypeScript that
 * load directly into the runtime.
 *
 * @example ['set', '@entity.health', 100]                       // 3-element
 * @example ['set', '@entity.id', 'health', 100]                 // 4-element
 * @example ['set', '@entity.id', 'count', ['+', '@entity.count', 1]]
 */
export type SetEffect =
    | ['set', string, SExpr]
    | ['set', string, string, SExpr];

/**
 * Trailing config object on persist effects. When present, it carries the
 * `emit` map specifying which events to fire on persist success/failure.
 * Mirrors what the runtime's `EffectExecutor` reads at the 5th tuple
 * position. See `(persist create Entity @payload.data { emit: { success:
 * "Saved", failure: "SaveFailed" } })` in `.lolo` source.
 */
export type PersistEmitConfig = {
    emit?: { success?: string; failure?: string };
};

/**
 * Persist effect data argument: an entity row literal (field map), a
 * binding string referencing a row in scope (e.g. `@payload.data`,
 * `@entity`), or an expression form that evaluates to a row (e.g.
 * `["object/merge", "@payload.data", { sender: "@user.id" }]`). At
 * runtime, binding strings and expressions resolve to `EntityRow` values
 * before the persist op runs — both paths evaluate the expression first.
 */
export type PersistData = EntityRow | string | SExpr[];

/**
 * Persist effect - creates, updates, deletes, or clears entities.
 *
 * Each operation accepts an optional trailing `PersistEmitConfig` so the
 * runtime can fire success / failure events when the operation completes.
 *
 * @example ['persist', 'create', 'Task', { title: '@payload.title' }]
 * @example ['persist', 'update', '@entity.entityType', '@payload.data']
 * @example ['persist', 'create', 'Task', '@payload.data', { emit: { success: 'TaskCreated' } }]
 */
export type PersistEffect =
    | ['persist', 'create', string, PersistData]
    | ['persist', 'create', string, PersistData, PersistEmitConfig]
    | ['persist', 'update', string, PersistData]
    | ['persist', 'update', string, PersistData, PersistEmitConfig]
    | ['persist', 'delete', string]
    | ['persist', 'delete', string, PersistData]
    | ['persist', 'delete', string, PersistData, PersistEmitConfig]
    | ['persist', 'clear', string]
    | ['persist', 'clear', string, PersistData]
    | ['persist', 'clear', string, PersistData, PersistEmitConfig];

/**
 * Call service effect - invokes an external service.
 *
 * Two shapes are accepted:
 *
 * 1. Flat form (what the runtime reads and every .orb file uses):
 *    `['call-service', serviceName, action, params?]` — args[0]=service,
 *    args[1]=action, args[2]=params. This is the canonical form; the
 *    runtime's EffectExecutor decodes exactly these positions.
 *
 * 2. Legacy config-object form (kept for the `callService()` helper):
 *    `['call-service', serviceName, CallServiceConfig]` — retained so
 *    older call sites using the builder helper continue to typecheck.
 *
 * @example ['call-service', 'llm', 'generate', { userPrompt: '@entity.inputText' }]
 * @example ['call-service', 'llm', 'generate', { userPrompt: '...' }, { emit: { success: 'OK', failure: 'ERR' } }]
 * @example ['call-service', 'WeatherAPI', { service: 'weather', action: 'get', onSuccess: 'OK' }]
 */
export type CallServiceEffect =
    | ['call-service', string, string]
    | ['call-service', string, string, ServiceParams]
    | ['call-service', string, string, ServiceParams, PersistEmitConfig]
    | ['call-service', string, CallServiceConfig];

/**
 * Spawn effect - creates a new entity instance (games).
 * @example ['spawn', 'Bullet', { x: '@entity.x', y: '@entity.y' }]
 */
export type SpawnEffect = ['spawn', string] | ['spawn', string, EntityRow];

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
 * Options accepted by `fetch` / `ref` / `deref` effects. Mirrors what
 * `OrbitalServerRuntime`'s fetch handler reads at runtime: `id`, `filter`,
 * `limit`, `offset`, `include`, plus the trailing `emit:` map for
 * success/failure event names.
 */
export type FetchOptions = {
    /** Fetch a single entity by ID */
    id?: string;
    /** Filter expression (S-expression) */
    filter?: SExpr;
    /** Maximum number of entities to return. The template layer may carry a
     *  binding (`'@config.pageSize'`) or a computed S-expression — the
     *  compiler's inline phase resolves it to a number. */
    limit?: number | RenderBinding | SExpr[];
    /** Number of entities to skip — same template-layer forms as `limit`. */
    offset?: number | RenderBinding | SExpr[];
    /** Relations to populate (entity field names) */
    include?: string[];
    /** Lifecycle events to emit on resolve / reject */
    emit?: { success?: string; failure?: string };
};

/**
 * Fetch effect - retrieves entity data (server-side).
 * @example ['fetch', 'User'] or ['fetch', 'User', { id: '@payload.userId' }]
 */
export type FetchEffect = ['fetch', string] | ['fetch', string, FetchOptions];

/**
 * Result returned by a fetch / ref / deref handler.
 *
 * `rows` carries the entity (or entities) that survived `filter` AND
 * pagination (`offset`/`limit`). `total` is the count of rows that
 * matched the filter BEFORE pagination, so paginating consumers can
 * compute `totalPages = ceil(total / pageSize)` without a second
 * round-trip. Single-entity fetches by id return `total: 1` (or `0`
 * if not found, in which case the handler returns `null` instead).
 */
export interface FetchResult {
    rows: EntityRow | EntityRow[];
    total: number;
}

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
export type LetEffect = ['let', [string, SExpr][], ...SExpr[]];

/**
 * Log effect - logs a message for debugging.
 * @example ['log', 'User created:', '@entity.name']
 */
export type LogEffect = ['log', ...SExpr[]];

/**
 * Wait effect - delays execution.
 * @example ['wait', 1000] - wait 1 second
 */
export type WaitEffect = ['wait', number];

// ============================================================================
// Resource Effects (reactive entity subscriptions and atomic operations)
// ============================================================================

/**
 * Ref effect - creates a reactive entity subscription.
 * Returns a reactive reference that auto-updates when the entity changes.
 * @example ['ref', '@entity.health'] - reactive subscription to health
 * @example ['ref', 'User', { id: '@payload.userId' }] - reactive ref to specific user
 */
export type RefEffect =
    | ['ref', string]
    | ['ref', string, FetchOptions];

/**
 * Deref effect - snapshot read of an entity value.
 * Returns the current value without subscribing to changes.
 * @example ['deref', '@entity.health'] - read current health value
 * @example ['deref', 'User', { id: '@payload.userId' }] - read specific user snapshot
 */
export type DerefEffect =
    | ['deref', string]
    | ['deref', string, FetchOptions];

/**
 * Swap! effect - atomic compare-and-swap on an entity field.
 * Only updates if the current value matches the expected value.
 * @example ['swap!', '@entity.health', ['fn', ['old'], ['-', 'old', '@payload.damage']]]
 * @example ['swap!', '@entity.counter', ['+', '@entity.counter', 1]]
 */
export type SwapEffect = ['swap!', string, SExpr];

/**
 * Options accepted by `watch` effects. Mirrors what the runtime reads when
 * registering the change callback: `debounce` and the trailing `emit:` map.
 */
export type WatchOptions = {
    /** Debounce duration in milliseconds */
    debounce?: number;
    /** Lifecycle events to emit on update / failure */
    emit?: { on_message?: string; failure?: string };
};

/**
 * Watch effect - registers a callback for entity changes.
 * Emits an event whenever the watched binding changes.
 * @example ['watch', '@entity.health', 'HEALTH_CHANGED']
 * @example ['watch', '@entity.status', 'STATUS_UPDATED', { debounce: 100 }]
 */
export type WatchEffect =
    | ['watch', string, string]
    | ['watch', string, string, WatchOptions];

/**
 * Atomic effect - groups multiple effects into an atomic transaction.
 * All effects either succeed together or are rolled back.
 * @example ['atomic', ['set', '@entity.x', 10], ['set', '@entity.y', 20]]
 * @example ['atomic', ['persist', 'update', 'User', { balance: 100 }], ['emit', 'BALANCE_UPDATED']]
 */
export type AtomicEffect = ['atomic', ...SExpr[]];

// ============================================================================
// ML Effects (from almadar-std/modules/nn, tensor, train)
// ============================================================================

/**
 * One layer in an NN architecture description. The set of valid layer kinds
 * lives in `almadar-std/modules/nn`; here we keep the wire shape generic
 * enough for the cross-package runtime + Python bridge to round-trip.
 */
export type NnLayer = {
    type: string;
    [key: string]: string | number | boolean | number[] | string[] | undefined;
};

/**
 * Hyperparameters for `train` and `evaluate`. Recursive to allow nested
 * optimizer / scheduler config blocks without falling back to `unknown`.
 */
export type NnConfig = {
    [key: string]: string | number | boolean | string[] | number[] | NnConfig | undefined;
};

/**
 * Forward-pass config: `input` is a binding string (`@payload.input`), and
 * `on-complete` names the event to fire when the prediction lands.
 */
export type ForwardConfig = {
    architecture: NnLayer[];
    input: string;
    'on-complete'?: string;
    config?: NnConfig;
};

/**
 * Training-loop config. `dataset` is a binding string referencing the rows
 * to train on. Optimizer / loss / scheduler land inside `config`.
 */
export type TrainConfig = {
    architecture: NnLayer[];
    dataset: string;
    config?: NnConfig;
    'on-complete'?: string;
};

/**
 * Evaluation config. `metrics` lists named metrics the Python backend
 * computes (`accuracy`, `precision`, ...).
 */
export type EvaluateConfig = {
    architecture: NnLayer[];
    dataset: string;
    metrics: string[];
    config?: NnConfig;
    'on-complete'?: string;
};

/**
 * Forward effect - runs a neural network forward pass (Python backend).
 * @example ['forward', 'primary', { architecture: [...], input: '@payload.input', 'on-complete': 'PREDICTION_READY' }]
 */
export type ForwardEffect = ['forward', string, ForwardConfig];

/**
 * Train effect - runs a training loop (Python backend).
 * @example ['train', { architecture: [...], dataset: '@entity.data', config: { epochs: 10 }, 'on-complete': 'TRAINING_DONE' }]
 */
export type TrainEffect = ['train', TrainConfig];

/**
 * Evaluate effect - runs model evaluation (Python backend).
 * @example ['evaluate', { architecture: [...], dataset: '@entity.testData', metrics: ['accuracy'], 'on-complete': 'EVAL_DONE' }]
 */
export type EvaluateEffect = ['evaluate', EvaluateConfig];

/**
 * Checkpoint save effect - saves model weights.
 * @example ['checkpoint/save', '/path/to/model.pt', '@entity.weights']
 */
export type CheckpointSaveEffect = ['checkpoint/save', string, SExpr];

/**
 * Checkpoint load effect - loads model weights.
 * @example ['checkpoint/load', '/path/to/model.pt']
 */
export type CheckpointLoadEffect = ['checkpoint/load', string];

// ============================================================================
// Agent Effects (from agent/* operator namespace)
// ============================================================================

/**
 * Agent effect - invokes an agent/* operator.
 * Covers all 22 operators in the std-agent category.
 * @example ['agent/memorize', 'use data-grid for tables', 'preference']
 * @example ['agent/recall', 'user preferences']
 * @example ['agent/generate', 'Summarize this schema']
 */
export type AgentEffect = [`agent/${string}`, ...SExpr[]];

/**
 * OS effect - invokes an os/* operator.
 *
 * Covers reactive subscriptions to OS / network resources:
 * - `os/watch-http`, `os/watch-ws`, `os/watch-sse` — long-lived streams
 *   that fire `on_message` / `failure` events through a trailing
 *   `EmitConfig` block (see `EmitConfig` for the supported keys).
 * - `os/read-file`, `os/exec`, etc. — one-shot OS operations.
 *
 * @example ['os/watch-http', 'wss://push.example.com', { emit: { on_message: 'PUSH_RECEIVED', failure: 'PUSH_DISCONNECTED' } }]
 * @example ['os/read-file', '/etc/hosts']
 */
export type OsEffect = [`os/${string}`, ...SExpr[]];

/**
 * Browser effect - invokes a browser/* device operator (client host path).
 * User-initiated, async, resolves via the standard trailing emit envelope.
 * Concrete operators (browser/open-file-picker, browser/clipboard-read,
 * browser/clipboard-write, browser/geolocation-current) and their arity /
 * payload shapes live in @almadar/std BROWSER_OPERATORS.
 * @example ['browser/open-file-picker', { multiple: false }, { emit: { success: 'FILES_PICKED', failure: 'PICK_CANCELLED' } }]
 */
export type BrowserEffect = [`browser/${string}`, ...SExpr[]];

/**
 * LLM effect - invokes an llm/* operator (agent path).
 * @example ['llm/generate', '@entity.request', { emit: { success: 'PLANNED', failure: 'PLAN_FAILED' } }]
 */
export type LlmEffect = [`llm/${string}`, ...SExpr[]];

/**
 * Behavior effect - invokes a behavior/* operator (agent path).
 * @example ['behavior/instantiate', '@entity.plan', { emit: { failure: 'BUILD_FAILED' } }]
 */
export type BehaviorEffect = [`behavior/${string}`, ...SExpr[]];

/**
 * Validate effect - invokes a validate/* operator (agent path).
 * @example ['validate/validate', '@entity.schema', { emit: { failure: 'INVALID' } }]
 */
export type ValidateEffect = [`validate/${string}`, ...SExpr[]];

/**
 * Remaining agent-path operator effects: session/* (workspace session ops),
 * compose/* (schema composition), trace/* (trace emission), memory/*
 * (agent memory), application/* (app lifecycle). Expression-only namespaces
 * (array/, math/, object/, str/, …) are deliberately NOT effect heads.
 * @example ['session/write-spec', '@entity.spec']
 * @example ['compose/compose-all', { emit: { failure: 'COMPOSE_FAILED' } }]
 */
export type SessionEffect = [`session/${string}`, ...SExpr[]];
export type ComposeEffect = [`compose/${string}`, ...SExpr[]];
export type TraceEffect = [`trace/${string}`, ...SExpr[]];
export type MemoryEffect = [`memory/${string}`, ...SExpr[]];
export type ApplicationEffect = [`application/${string}`, ...SExpr[]];

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
    | RefEffect
    | DerefEffect
    | SwapEffect
    | WatchEffect
    | AtomicEffect
    | AsyncDelayEffect
    | AsyncDebounceEffect
    | AsyncThrottleEffect
    | AsyncIntervalEffect
    | AsyncRaceEffect
    | AsyncAllEffect
    | AsyncSequenceEffect
    | ForwardEffect
    | TrainEffect
    | EvaluateEffect
    | CheckpointSaveEffect
    | CheckpointLoadEffect
    | AgentEffect
    | OsEffect
    | BrowserEffect
    | LlmEffect
    | BehaviorEffect
    | ValidateEffect
    | SessionEffect
    | ComposeEffect
    | TraceEffect
    | MemoryEffect
    | ApplicationEffect;

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
 * Schema for Effect - validates S-expression format. Arguments validate as
 * s-expr-shaped DATA (`SExprDataSchema`) — literal data arrays (empty or
 * non-operator-headed) are valid argument values; the operator-head refine
 * applies to the effect itself, not to every argument.
 */
export const EffectSchema = z.array(SExprDataSchema).min(1).refine(
    (arr) => typeof arr[0] === 'string',
    { message: 'Effect must be an S-expression with a string operator as first element' }
);

export type EffectInput = z.input<typeof EffectSchema>;

/**
 * Type guard to check if a value is a valid Effect (S-expression).
 * 
 * Validates that a value conforms to the Effect structure. Effects are
 * represented as arrays where the first element is a string (effect type)
 * and subsequent elements are parameters. Used for runtime validation
 * of effect structures.
 * 
 * @param {RuntimeValue} value - Value to check
 * @returns {boolean} True if value is a valid Effect, false otherwise
 *
 * @example
 * isEffect(['set', '@entity.health', 100]); // returns true
 * isEffect('not-an-effect'); // returns false
 * isEffect([]); // returns false
 */
export function isEffect(value: RuntimeValue): value is Effect {
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
 * Creates a set effect for state updates.
 * 
 * Generates an effect that sets a binding to a value. Used in state
 * machine transitions to update entity fields, UI state, or other
 * mutable data.
 * 
 * @param {string} binding - Target binding (e.g., '@entity.health')
 * @param {SExpr} value - Value to set (can be literal or expression)
 * @returns {Effect} Set effect array
 * 
 * @example
 * set('@entity.health', 100); // returns ["set", "@entity.health", 100]
 * set('@state.loading', false); // returns ["set", "@state.loading", false]
 */
export function set(binding: string, value: SExpr): Effect {
    return ['set', binding, value];
}

/**
 * Creates an emit effect for event dispatching.
 * 
 * Generates an effect that emits an event with optional payload.
 * Used in state machine transitions to trigger events that can be
 * handled by other traits, services, or external systems.
 * 
 * @param {string} event - Event name to emit
 * @param {EventPayload} [payload] - Optional event payload
 * @returns {Effect} Emit effect array
 * 
 * @example
 * emit('PLAYER_DIED', { playerId: '@entity.id' }); // returns ["emit", "PLAYER_DIED", { playerId: "@entity.id" }]
 * emit('GAME_STARTED'); // returns ["emit", "GAME_STARTED"]
 */
export function emit(event: string, payload?: EventPayload): Effect {
    return payload ? ['emit', event, payload] : ['emit', event];
}

/**
 * Creates a navigation effect for page routing.
 * 
 * Generates an effect that navigates to a specified path with optional
 * parameters. Used in state machine transitions to change pages or
 * update URL parameters.
 * 
 * @param {string} path - Target path (e.g., '/tasks')
 * @param {Record<string, string>} [params] - Optional URL parameters
 * @returns {NavigateEffect} Navigation effect array
 * 
 * @example
 * navigate('/tasks'); // returns ["navigate", "/tasks"]
 * navigate('/user', { id: '123' }); // returns ["navigate", "/user", { id: "123" }]
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
    props: ResolvedPatternProps
): RenderUIEffect;
export function renderUI(
    target: UISlot,
    pattern: AnyPatternConfig,
    props?: ResolvedPatternProps
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
    data: PersistData
): PersistEffect;
export function persist(
    action: 'delete' | 'clear',
    entity: string,
    data?: PersistData
): PersistEffect;
export function persist(
    action: 'create' | 'update' | 'delete' | 'clear',
    entity: string,
    data?: PersistData
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
export function spawn(entity: string, initialState: EntityRow): SpawnEffect;
export function spawn(entity: string, initialState?: EntityRow): SpawnEffect {
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
 * Create a fetch effect (server-side data retrieval)
 * @example ["fetch", "User"] - fetch all users
 * @example ["fetch", "User", { "id": "@payload.userId" }] - fetch by ID
 * @example ["fetch", "User", { "filter": ["=", "@entity.status", "active"], "limit": 10 }]
 */
export function fetch(entity: string): FetchEffect;
export function fetch(entity: string, options: FetchOptions): FetchEffect;
export function fetch(entity: string, options?: FetchOptions): FetchEffect {
    return options ? ['fetch', entity, options] : ['fetch', entity];
}

// ============================================================================
// Resource Effect Builder Helpers
// ============================================================================

/**
 * Create a ref effect (reactive entity subscription).
 *
 * @param {string} binding - Binding or entity name to subscribe to
 * @param {FetchOptions} [selector] - Optional selector for specific entity
 * @returns {RefEffect} Ref effect array
 *
 * @example
 * ref('@entity.health'); // returns ["ref", "@entity.health"]
 * ref('User', { id: '@payload.userId' }); // returns ["ref", "User", { id: "@payload.userId" }]
 */
export function ref(binding: string): RefEffect;
export function ref(binding: string, selector: FetchOptions): RefEffect;
export function ref(binding: string, selector?: FetchOptions): RefEffect {
    return selector ? ['ref', binding, selector] : ['ref', binding];
}

/**
 * Create a deref effect (snapshot read).
 *
 * @param {string} binding - Binding or entity name to read
 * @param {FetchOptions} [selector] - Optional selector for specific entity
 * @returns {DerefEffect} Deref effect array
 *
 * @example
 * deref('@entity.health'); // returns ["deref", "@entity.health"]
 * deref('User', { id: '@payload.userId' }); // returns ["deref", "User", { id: "@payload.userId" }]
 */
export function deref(binding: string): DerefEffect;
export function deref(binding: string, selector: FetchOptions): DerefEffect;
export function deref(binding: string, selector?: FetchOptions): DerefEffect {
    return selector ? ['deref', binding, selector] : ['deref', binding];
}

/**
 * Create a swap! effect (atomic compare-and-swap).
 *
 * @param {string} binding - Binding to atomically update
 * @param {SExpr} transform - Transformation expression applied to the current value
 * @returns {SwapEffect} Swap effect array
 *
 * @example
 * swap('@entity.counter', ['+', '@entity.counter', 1]);
 * // returns ["swap!", "@entity.counter", ["+", "@entity.counter", 1]]
 */
export function swap(binding: string, transform: SExpr): SwapEffect {
    return ['swap!', binding, transform];
}

/**
 * Create a watch effect (entity change callback).
 *
 * @example
 * watch('@entity.health', 'HEALTH_CHANGED');
 * watch('@entity.status', 'STATUS_UPDATED', { debounce: 100 });
 */
export function watch(binding: string, event: string): WatchEffect;
export function watch(binding: string, event: string, options: WatchOptions): WatchEffect;
export function watch(binding: string, event: string, options?: WatchOptions): WatchEffect {
    return options
        ? ['watch', binding, event, options]
        : ['watch', binding, event];
}

/**
 * Create an atomic effect (transaction group).
 *
 * @param {...SExpr[]} effects - Effects to execute atomically
 * @returns {AtomicEffect} Atomic effect array
 *
 * @example
 * atomic(['set', '@entity.x', 10], ['set', '@entity.y', 20]);
 * // returns ["atomic", ["set", "@entity.x", 10], ["set", "@entity.y", 20]]
 */
export function atomic(...effects: SExpr[]): AtomicEffect {
    return ['atomic', ...effects];
}

// ============================================================================
// Runtime Pattern Types
// ============================================================================

/** Resolved pattern props for render-ui effects at runtime. Recursive for nested pattern configs. */
export type ResolvedPatternProps = {
  [prop: string]: string | number | boolean | null | undefined | ResolvedPatternProps | ResolvedPatternProps[];
};

/** A node in a render-ui effect tree. */
export interface RenderUINode {
  type: string;
  props?: ResolvedPatternProps;
  /** Static child nodes and/or dynamic-collection map entries. A
   *  {@link RenderChildrenMap} entry expands at render time into resolved
   *  `RenderUINode`s, so components always receive a flat, fully-resolved list. */
  children?: Array<RenderUINode | RenderChildrenMap>;
  content?: string;
  entity?: string;
  renderItem?: RenderUINode;
}

