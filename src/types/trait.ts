/**
 * Trait Types (Self-Contained)
 *
 * Defines trait types for behavioral patterns.
 * Self-contained - imports only from local orbital types.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { StateMachine } from './state-machine.js';
import { StateMachineSchema } from './state-machine.js';
import type { Effect } from './effect.js';
import { EffectSchema } from './effect.js';
import type { Expression } from './expression.js';
import { ExpressionSchema } from './expression.js';

// ============================================================================
// Trait Categories
// ============================================================================

/**
 * Categories for organizing traits
 */
export type TraitCategory =
    | 'lifecycle'
    | 'temporal'
    | 'validation'
    | 'notification'
    | 'integration'
    | 'interaction'
    | 'game-core'
    | 'game-character'
    | 'game-ai'
    | 'game-combat'
    | 'game-items'
    | 'game-cards'
    | 'game-board'
    | 'game-puzzle';

export const TraitCategorySchema = z.enum([
    'lifecycle',
    'temporal',
    'validation',
    'notification',
    'integration',
    'interaction',
    'game-core',
    'game-character',
    'game-ai',
    'game-combat',
    'game-items',
    'game-cards',
    'game-board',
    'game-puzzle',
]);

// ============================================================================
// Trait Entity Field (simplified)
// ============================================================================

/**
 * Field types for trait data entities
 */
export type TraitFieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'timestamp' | 'datetime' | 'enum';

/**
 * Simplified field for trait data entities
 */
export interface TraitEntityField {
    name: string;
    type: TraitFieldType;
    required?: boolean;
    default?: unknown;
    values?: string[];
}

export const TraitEntityFieldSchema = z.object({
    name: z.string().min(1),
    type: z.enum([
        'string',
        'number',
        'boolean',
        'date',
        'array',
        'object',
        'timestamp',
        'datetime',
        'enum',
    ]),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    values: z.array(z.string()).optional(),
});

// ============================================================================
// Trait Data Entity
// ============================================================================

/**
 * Simplified data entity for traits
 */
export interface TraitDataEntity {
    name: string;
    collection?: string;
    fields: TraitEntityField[];
    timestamps?: boolean;
    description?: string;
    runtime?: boolean;
    singleton?: boolean;
    pages?: string[];
}

export const TraitDataEntitySchema = z.object({
    name: z.string().min(1),
    collection: z.string().optional(),
    fields: z.array(TraitEntityFieldSchema).min(1),
    timestamps: z.boolean().optional(),
    description: z.string().optional(),
    runtime: z.boolean().optional(),
    singleton: z.boolean().optional(),
    pages: z.array(z.string()).optional(),
});

// ============================================================================
// Trait Tick
// ============================================================================

/**
 * Tick rule for traits.
 * Guards can be legacy strings or S-expressions.
 * Effects can be typed Effect objects or S-expressions.
 */
export interface TraitTick {
    name: string;
    description?: string;
    priority?: number;
    interval: string | number;
    appliesTo?: string[];
    pages?: string[];
    /** Guard expression - string (legacy) or S-expression array */
    guard?: Expression;
    /** Effects to execute (S-expressions) */
    effects: Effect[];
    /**
     * Events this tick emits.
     * Must reference events defined in trait's emits array.
     * Used for validation and documentation.
     */
    emits?: string[];
}

export const TraitTickSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    priority: z.number().optional(),
    interval: z.union([z.literal('frame'), z.number().positive()]),
    appliesTo: z.array(z.string()).optional(),
    pages: z.array(z.string()).optional(),
    guard: ExpressionSchema.optional(),
    effects: z.array(EffectSchema).min(1),
    emits: z.array(z.string()).optional(),
});

// ============================================================================
// Event Scope
// ============================================================================

/**
 * Event scope determines visibility:
 * - 'internal': Trait-to-trait within same orbital (default)
 * - 'external': Exposed for cross-orbital communication
 */
export type EventScope = 'internal' | 'external';

export const EventScopeSchema = z.enum(['internal', 'external']);

// ============================================================================
// Event Payload Field
// ============================================================================

/**
 * Payload field definition for events.
 * Defines the structure of data carried by events.
 */
export interface EventPayloadField {
    /** Field name */
    name: string;
    /** Field type */
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'entity';
    /** Whether field is required in payload */
    required?: boolean;
    /** Human-readable description */
    description?: string;
    /** For 'entity' type: the entity type name */
    entityType?: string;
}

export const EventPayloadFieldSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'object', 'array', 'entity']),
    required: z.boolean().optional(),
    description: z.string().optional(),
    entityType: z.string().optional(),
});

// ============================================================================
// Trait Event Contract
// ============================================================================

/**
 * Event contract for events a trait emits.
 * Declares the event name, scope, and payload schema.
 */
export interface TraitEventContract {
    /** Event name (UPPER_SNAKE_CASE) */
    event: string;
    /** Human-readable description */
    description?: string;
    /** Payload schema - what data this event carries */
    payload?: EventPayloadField[];
    /**
     * Event scope:
     * - 'internal': Trait-to-trait within same orbital (default)
     * - 'external': Exposed for cross-orbital communication
     */
    scope?: EventScope;
}

export const TraitEventContractSchema = z.object({
    event: z.string().min(1).regex(
        /^[A-Z][A-Z0-9_]*$/,
        'Event name must be UPPER_SNAKE_CASE'
    ),
    description: z.string().optional(),
    payload: z.array(EventPayloadFieldSchema).optional(),
    scope: EventScopeSchema.optional(),
});

// ============================================================================
// Trait Event Listener
// ============================================================================

/**
 * Event listener for trait communication.
 * Guards can be legacy strings or S-expressions.
 * Enhanced with scope and payloadMapping for cross-orbital communication.
 */
export interface TraitEventListener {
    /** Event key to listen for (may be namespaced: TraitName.EVENT_NAME) */
    event: string;
    /** State machine event to trigger */
    triggers: string;
    /** Guard expression - string (legacy) or S-expression array */
    guard?: Expression;
    /**
     * Listener scope:
     * - 'internal': Listen to events within same orbital (default)
     * - 'external': Listen to events from other orbitals
     */
    scope?: EventScope;
    /** Map event payload fields to transition payload */
    payloadMapping?: Record<string, string>;
}

export const TraitEventListenerSchema = z.object({
    event: z.string().min(1),
    triggers: z.string().min(1),
    guard: ExpressionSchema.optional(),
    scope: EventScopeSchema.optional(),
    payloadMapping: z.record(z.string()).optional(),
});

// ============================================================================
// Required Field
// ============================================================================

/**
 * Field required by a trait from its linkedEntity
 */
export interface RequiredField {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'timestamp' | 'datetime' | 'enum';
    description?: string;
}

export const RequiredFieldSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object', 'timestamp', 'datetime', 'enum']),
    description: z.string().optional(),
});

// ============================================================================
// Trait Reference
// ============================================================================

/**
 * Reference to a trait from an entity or page
 */
export interface TraitReference {
    ref: string;
    linkedEntity?: string;
    config?: Record<string, Record<string, unknown>>;
    appliesTo?: string[];
}

export const TraitReferenceSchema = z.object({
    ref: z.string().min(1),
    linkedEntity: z.string().optional(),
    config: z.record(z.record(z.unknown())).optional(),
    appliesTo: z.array(z.string()).optional(),
});

/**
 * Simplified trait reference - supports string, reference object, or inline Trait definition
 * - string: "TraitName" - reference to a trait by name
 * - { ref: "TraitName" }: reference object with optional config
 * - { name: "TraitName", stateMachine: {...} }: inline trait definition
 */
export type TraitRef = string | { ref: string; config?: Record<string, unknown>; linkedEntity?: string } | Trait;

// TraitRefSchema is defined after TraitSchema (see below) to avoid forward reference

// ============================================================================
// Trait UI Binding
// ============================================================================

export type PresentationType = 'modal' | 'drawer' | 'popover' | 'inline' | 'confirm-dialog';

export interface TraitUIBinding {
    [stateName: string]: {
        presentation: PresentationType;
        content: Record<string, unknown> | Record<string, unknown>[];
        props?: {
            size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
            position?: 'left' | 'right' | 'top' | 'bottom' | 'center';
            title?: string;
            closable?: boolean;
            width?: string;
            showProgress?: boolean;
            step?: number;
            totalSteps?: number;
        };
    };
}

// ============================================================================
// Trait Definition
// ============================================================================

/**
 * A Trait is a reusable behavioral module with state machine.
 *
 * Traits declare their event contracts via `emits` and `listens`:
 * - `emits`: Events this trait can emit (with scope and payload schema)
 * - `listens`: Events this trait listens for (with optional payloadMapping)
 */
export interface Trait {
    name: string;
    description?: string;
    description_visual_prompt?: string;
    category?: TraitCategory;
    requiredFields?: RequiredField[];
    dataEntities?: TraitDataEntity[];
    stateMachine?: StateMachine;
    initialEffects?: Effect[];
    ticks?: TraitTick[];
    /**
     * Events this trait emits.
     * Each event can be scoped as internal or external.
     * External events are namespaced at orbital level (TraitName.EVENT_NAME).
     */
    emits?: TraitEventContract[];
    /**
     * Events this trait listens for.
     * External listeners reference namespaced events (TraitName.EVENT_NAME).
     */
    listens?: TraitEventListener[];
    ui?: TraitUIBinding;
}

export const TraitSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    description_visual_prompt: z.string().optional(),
    category: TraitCategorySchema.optional(),
    requiredFields: z.array(RequiredFieldSchema).optional(),
    dataEntities: z.array(TraitDataEntitySchema).optional(),
    stateMachine: StateMachineSchema.optional(),
    initialEffects: z.array(EffectSchema).optional(),
    ticks: z.array(TraitTickSchema).optional(),
    emits: z.array(TraitEventContractSchema).optional(),
    listens: z.array(TraitEventListenerSchema).optional(),
    ui: z.record(z.unknown()).optional(),
});

// TraitRefSchema defined here after TraitSchema to avoid forward reference
export const TraitRefSchema = z.union([
    z.string().min(1),
    z.object({
        ref: z.string().min(1),
        config: z.record(z.unknown()).optional(),
        linkedEntity: z.string().optional(),
    }),
    TraitSchema, // Allow inline trait definitions
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a trait ref is an inline Trait definition
 */
export function isInlineTrait(traitRef: TraitRef): traitRef is Trait {
    return typeof traitRef === 'object' && 'name' in traitRef && !('ref' in traitRef);
}

/**
 * Get trait name from a trait reference
 */
export function getTraitName(traitRef: TraitRef): string {
    if (typeof traitRef === 'string') {
        return traitRef;
    }
    if (isInlineTrait(traitRef)) {
        return traitRef.name;
    }
    return traitRef.ref;
}

/**
 * Get trait config from a trait reference
 */
export function getTraitConfig(traitRef: TraitRef): Record<string, unknown> | undefined {
    if (typeof traitRef === 'string') {
        return undefined;
    }
    if (isInlineTrait(traitRef)) {
        return undefined; // Inline traits don't have config
    }
    return traitRef.config;
}

/**
 * Normalize trait reference to object form
 */
export function normalizeTraitRef(traitRef: TraitRef): { ref: string; config?: Record<string, unknown> } {
    if (typeof traitRef === 'string') {
        return { ref: traitRef };
    }
    if (isInlineTrait(traitRef)) {
        return { ref: traitRef.name };
    }
    return traitRef;
}

// ============================================================================
// Type exports
// ============================================================================

export type TraitInput = z.input<typeof TraitSchema>;
export type TraitReferenceInput = z.input<typeof TraitReferenceSchema>;

// Backward compatibility aliases
export type OrbitalTraitRef = TraitRef;
export const OrbitalTraitRefSchema = TraitRefSchema;
