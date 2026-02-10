/**
 * Domain Language Registry
 *
 * Central registry for OrbitalSchema <-> Domain Language mappings.
 * This is the single source of truth for type conversions.
 *
 * When adding a new OrbitalSchema feature:
 * 1. Add type mapping here
 * 2. Formatters/parsers automatically use these mappings
 * 3. Build-time validation ensures coverage
 *
 * @packageDocumentation
 */

import {
    FIELD_TYPE_MAPPING,
    DOMAIN_TO_SCHEMA_FIELD_TYPE,
    EFFECT_OPERATORS,
    COMPARISON_OPERATORS,
    LOGICAL_OPERATORS,
    ARITHMETIC_OPERATORS,
    UI_SLOTS,
    BINDING_PREFIXES,
} from './types.js';

// Re-export all mappings from types.ts for centralized access
export {
    FIELD_TYPE_MAPPING,
    DOMAIN_TO_SCHEMA_FIELD_TYPE,
    EFFECT_OPERATORS,
    COMPARISON_OPERATORS,
    LOGICAL_OPERATORS,
    ARITHMETIC_OPERATORS,
    UI_SLOTS,
    BINDING_PREFIXES,
};

// ============================================================================
// Type Definitions for Registry
// ============================================================================

/**
 * Field type mapping entry with format/parse functions
 */
export interface FieldTypeMapping {
    /** OrbitalSchema type name */
    schemaType: string;
    /** Domain Language keyword(s) - can be array for aliases */
    domainKeywords: string[];
    /** Format schema field to domain text */
    format: (field: { type: string; values?: string[]; relation?: { entity: string } }) => string;
    /** Parse domain keyword to schema type */
    parse: (keyword: string) => string;
}

/**
 * Effect operator mapping entry
 */
export interface EffectMapping {
    /** S-Expression operator name */
    operator: string;
    /** Human-readable domain pattern templates */
    domainPatterns: string[];
    /** Description for documentation */
    description: string;
}

/**
 * Guard operator mapping entry
 */
export interface GuardMapping {
    /** S-Expression operator */
    operator: string;
    /** Human-readable domain patterns */
    domainPatterns: string[];
    /** Description */
    description: string;
}

// ============================================================================
// Field Type Registry
// ============================================================================

/**
 * Complete field type registry with format/parse functions
 */
export const FIELD_TYPE_REGISTRY: Record<string, FieldTypeMapping> = {
    string: {
        schemaType: 'string',
        domainKeywords: ['text', 'long text'],
        format: () => 'text',
        parse: () => 'string',
    },
    number: {
        schemaType: 'number',
        domainKeywords: ['number', 'currency'],
        format: () => 'number',
        parse: () => 'number',
    },
    boolean: {
        schemaType: 'boolean',
        domainKeywords: ['yes/no', 'boolean'],
        format: () => 'yes/no',
        parse: () => 'boolean',
    },
    date: {
        schemaType: 'date',
        domainKeywords: ['date'],
        format: () => 'date',
        parse: () => 'date',
    },
    timestamp: {
        schemaType: 'timestamp',
        domainKeywords: ['timestamp'],
        format: () => 'timestamp',
        parse: () => 'timestamp',
    },
    datetime: {
        schemaType: 'datetime',
        domainKeywords: ['datetime'],
        format: () => 'datetime',
        parse: () => 'datetime',
    },
    array: {
        schemaType: 'array',
        domainKeywords: ['list', 'array'],
        format: () => 'list',
        parse: () => 'array',
    },
    object: {
        schemaType: 'object',
        domainKeywords: ['object'],
        format: () => 'object',
        parse: () => 'object',
    },
    enum: {
        schemaType: 'enum',
        domainKeywords: ['enum'],
        format: (field) => {
            if (field.values && field.values.length > 0) {
                return `enum [${field.values.join(', ')}]`;
            }
            return 'enum';
        },
        parse: () => 'enum',
    },
    relation: {
        schemaType: 'relation',
        domainKeywords: ['relation', 'belongs to', 'has many'],
        format: (field) => {
            if (field.relation?.entity) {
                return `belongs to ${field.relation.entity}`;
            }
            return 'relation';
        },
        parse: () => 'relation',
    },
};

// ============================================================================
// Effect Registry (Human-Readable Domain Language)
// ============================================================================

/**
 * Effect operator registry with human-readable patterns
 */
export const EFFECT_REGISTRY: Record<string, EffectMapping> = {
    set: {
        operator: 'set',
        domainPatterns: [
            'update {field} to {value}',
            'set {field} to {value}',
        ],
        description: 'Update a field value',
    },
    emit: {
        operator: 'emit',
        domainPatterns: [
            'emit {event}',
            'emit {event} with {payload}',
        ],
        description: 'Emit an event to the event bus',
    },
    'render-ui': {
        operator: 'render-ui',
        domainPatterns: [
            'render {pattern} to {slot}',
            'render {pattern} to {slot} for {entity}',
            'render {pattern} to {slot} with {props}',
            'render null to {slot}',
        ],
        description: 'Render a UI pattern to a slot',
    },
    navigate: {
        operator: 'navigate',
        domainPatterns: [
            'navigate to {path}',
            'go to {path}',
        ],
        description: 'Navigate to a route',
    },
    persist: {
        operator: 'persist',
        domainPatterns: [
            'persist create {entity}',
            'persist update {entity}',
            'persist delete {entity}',
            'save {entity}',
        ],
        description: 'Persist entity to database',
    },
    'call-service': {
        operator: 'call-service',
        domainPatterns: [
            'call {service}.{action}',
            'call {service}.{action} with {params}',
        ],
        description: 'Call an external service',
    },
    spawn: {
        operator: 'spawn',
        domainPatterns: [
            'spawn {entity}',
            'spawn {entity} at {position}',
            'spawn {entity} with {props}',
        ],
        description: 'Create a new runtime entity (games)',
    },
    despawn: {
        operator: 'despawn',
        domainPatterns: [
            'despawn',
            'despawn {entity}',
            'remove {entity}',
        ],
        description: 'Remove a runtime entity (games)',
    },
    notify: {
        operator: 'notify',
        domainPatterns: [
            'show {type} notification {message}',
            'notify {message}',
        ],
        description: 'Show a notification',
    },
    do: {
        operator: 'do',
        domainPatterns: [
            'then {effect1} then {effect2}',
        ],
        description: 'Execute multiple effects',
    },
};

// ============================================================================
// Guard Registry (Human-Readable Domain Language)
// ============================================================================

/**
 * Guard operator registry with human-readable patterns
 */
export const GUARD_REGISTRY: Record<string, GuardMapping> = {
    // Comparison operators
    '=': {
        operator: '=',
        domainPatterns: [
            '{field} is {value}',
            '{field} equals {value}',
        ],
        description: 'Equality check',
    },
    '!=': {
        operator: '!=',
        domainPatterns: [
            '{field} is not {value}',
            '{field} != {value}',
        ],
        description: 'Inequality check',
    },
    '>': {
        operator: '>',
        domainPatterns: [
            '{field} > {value}',
            '{field} is greater than {value}',
        ],
        description: 'Greater than',
    },
    '<': {
        operator: '<',
        domainPatterns: [
            '{field} < {value}',
            '{field} is less than {value}',
        ],
        description: 'Less than',
    },
    '>=': {
        operator: '>=',
        domainPatterns: [
            '{field} >= {value}',
            '{field} is at least {value}',
        ],
        description: 'Greater than or equal',
    },
    '<=': {
        operator: '<=',
        domainPatterns: [
            '{field} <= {value}',
            '{field} is at most {value}',
        ],
        description: 'Less than or equal',
    },
    // Logical operators
    and: {
        operator: 'and',
        domainPatterns: [
            '{condition1} and {condition2}',
        ],
        description: 'Logical AND',
    },
    or: {
        operator: 'or',
        domainPatterns: [
            '{condition1} or {condition2}',
        ],
        description: 'Logical OR',
    },
    not: {
        operator: 'not',
        domainPatterns: [
            'not {condition}',
            '{field} is not {value}',
        ],
        description: 'Logical NOT',
    },
};

// ============================================================================
// Registry Utilities
// ============================================================================

/**
 * Get all registered field types
 */
export function getRegisteredFieldTypes(): string[] {
    return Object.keys(FIELD_TYPE_REGISTRY);
}

/**
 * Get all registered effect operators
 */
export function getRegisteredEffects(): string[] {
    return Object.keys(EFFECT_REGISTRY);
}

/**
 * Get all registered guard operators
 */
export function getRegisteredGuards(): string[] {
    return Object.keys(GUARD_REGISTRY);
}

/**
 * Check if a field type is registered
 */
export function isFieldTypeRegistered(type: string): boolean {
    return type in FIELD_TYPE_REGISTRY;
}

/**
 * Check if an effect operator is registered
 */
export function isEffectRegistered(operator: string): boolean {
    return operator in EFFECT_REGISTRY;
}

/**
 * Check if a guard operator is registered
 */
export function isGuardRegistered(operator: string): boolean {
    return operator in GUARD_REGISTRY;
}

/**
 * Get field type mapping
 */
export function getFieldTypeMapping(type: string): FieldTypeMapping | undefined {
    return FIELD_TYPE_REGISTRY[type];
}

/**
 * Get effect mapping
 */
export function getEffectMapping(operator: string): EffectMapping | undefined {
    return EFFECT_REGISTRY[operator];
}

/**
 * Get guard mapping
 */
export function getGuardMapping(operator: string): GuardMapping | undefined {
    return GUARD_REGISTRY[operator];
}

/**
 * Lookup domain keyword and return schema type
 */
export function domainKeywordToSchemaType(keyword: string): string | undefined {
    const normalizedKeyword = keyword.toLowerCase().trim();
    for (const mapping of Object.values(FIELD_TYPE_REGISTRY)) {
        if (mapping.domainKeywords.some(k => k.toLowerCase() === normalizedKeyword)) {
            return mapping.schemaType;
        }
    }
    return undefined;
}

/**
 * Lookup schema type and return primary domain keyword
 */
export function schemaTypeToDomainKeyword(type: string): string | undefined {
    const mapping = FIELD_TYPE_REGISTRY[type];
    return mapping?.domainKeywords[0];
}

// ============================================================================
// Registry Statistics
// ============================================================================

/**
 * Get registry statistics for validation/documentation
 */
export function getRegistryStats(): {
    fieldTypes: number;
    effects: number;
    guards: number;
    uiSlots: number;
} {
    return {
        fieldTypes: Object.keys(FIELD_TYPE_REGISTRY).length,
        effects: Object.keys(EFFECT_REGISTRY).length,
        guards: Object.keys(GUARD_REGISTRY).length,
        uiSlots: UI_SLOTS.length,
    };
}
