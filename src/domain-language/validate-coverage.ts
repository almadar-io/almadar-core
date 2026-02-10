/**
 * Domain Language Coverage Validator
 *
 * Validates that all OrbitalSchema types are covered by Domain Language mappings.
 * Run during build to ensure completeness.
 *
 * Usage:
 *   npx tsx src/domain-language/validate-coverage.ts
 *
 * @packageDocumentation
 */

import {
    FIELD_TYPE_REGISTRY,
    EFFECT_REGISTRY,
    GUARD_REGISTRY,
    getRegistryStats,
} from './registry.js';

// Import OrbitalSchema type definitions
import { FieldTypeSchema, UI_SLOTS as ORBITAL_UI_SLOTS } from '../types/index.js';
import { UI_SLOTS as DOMAIN_UI_SLOTS } from './types.js';

// ============================================================================
// Coverage Validation
// ============================================================================

export interface CoverageResult {
    valid: boolean;
    missingFieldTypes: string[];
    missingEffects: string[];
    missingGuards: string[];
    missingUISlots: string[];
    warnings: string[];
    stats: {
        fieldTypes: { covered: number; total: number };
        effects: { covered: number; total: number };
        guards: { covered: number; total: number };
        uiSlots: { covered: number; total: number };
    };
}

/**
 * Get all OrbitalSchema field types from the Zod schema
 */
function getOrbitalFieldTypes(): string[] {
    // Extract enum values from Zod schema
    return FieldTypeSchema.options;
}

/**
 * Get all expected effect operators
 */
function getExpectedEffects(): string[] {
    return [
        'set',
        'emit',
        'render-ui',
        'navigate',
        'persist',
        'call-service',
        'spawn',
        'despawn',
        'notify',
        'do',
    ];
}

/**
 * Get all expected guard operators
 */
function getExpectedGuards(): string[] {
    return [
        // Comparison
        '=', '!=', '<', '>', '<=', '>=',
        // Logical
        'and', 'or', 'not',
    ];
}

/**
 * Validate Domain Language coverage of OrbitalSchema types
 */
export function validateDomainLanguageCoverage(): CoverageResult {
    const result: CoverageResult = {
        valid: true,
        missingFieldTypes: [],
        missingEffects: [],
        missingGuards: [],
        missingUISlots: [],
        warnings: [],
        stats: {
            fieldTypes: { covered: 0, total: 0 },
            effects: { covered: 0, total: 0 },
            guards: { covered: 0, total: 0 },
            uiSlots: { covered: 0, total: 0 },
        },
    };

    // Check field types
    const orbitalFieldTypes = getOrbitalFieldTypes();
    const registeredFieldTypes = new Set(Object.keys(FIELD_TYPE_REGISTRY));
    result.stats.fieldTypes.total = orbitalFieldTypes.length;

    for (const type of orbitalFieldTypes) {
        if (registeredFieldTypes.has(type)) {
            result.stats.fieldTypes.covered++;
        } else {
            result.missingFieldTypes.push(type);
            result.valid = false;
        }
    }

    // Check effects
    const expectedEffects = getExpectedEffects();
    const registeredEffects = new Set(Object.keys(EFFECT_REGISTRY));
    result.stats.effects.total = expectedEffects.length;

    for (const effect of expectedEffects) {
        if (registeredEffects.has(effect)) {
            result.stats.effects.covered++;
        } else {
            result.missingEffects.push(effect);
            result.valid = false;
        }
    }

    // Check guards
    const expectedGuards = getExpectedGuards();
    const registeredGuards = new Set(Object.keys(GUARD_REGISTRY));
    result.stats.guards.total = expectedGuards.length;

    for (const guard of expectedGuards) {
        if (registeredGuards.has(guard)) {
            result.stats.guards.covered++;
        } else {
            result.missingGuards.push(guard);
            result.valid = false;
        }
    }

    // Check UI slots
    const orbitalUISlots = new Set(ORBITAL_UI_SLOTS);
    const domainUISlots: Set<string> = new Set(DOMAIN_UI_SLOTS);
    result.stats.uiSlots.total = orbitalUISlots.size;

    for (const slot of orbitalUISlots) {
        if (domainUISlots.has(slot)) {
            result.stats.uiSlots.covered++;
        } else {
            result.missingUISlots.push(slot);
            result.valid = false;
        }
    }

    // Add warnings for extra registrations (not in OrbitalSchema)
    for (const type of registeredFieldTypes) {
        if (!orbitalFieldTypes.includes(type)) {
            result.warnings.push(`Extra field type in registry: ${type}`);
        }
    }

    return result;
}

/**
 * Format coverage result for console output
 */
export function formatCoverageResult(result: CoverageResult): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('='.repeat(60));
    lines.push('Domain Language Coverage Validation');
    lines.push('='.repeat(60));
    lines.push('');

    // Field types
    lines.push(`Field Types: ${result.stats.fieldTypes.covered}/${result.stats.fieldTypes.total}`);
    if (result.missingFieldTypes.length > 0) {
        lines.push(`  Missing: ${result.missingFieldTypes.join(', ')}`);
    }

    // Effects
    lines.push(`Effects: ${result.stats.effects.covered}/${result.stats.effects.total}`);
    if (result.missingEffects.length > 0) {
        lines.push(`  Missing: ${result.missingEffects.join(', ')}`);
    }

    // Guards
    lines.push(`Guards: ${result.stats.guards.covered}/${result.stats.guards.total}`);
    if (result.missingGuards.length > 0) {
        lines.push(`  Missing: ${result.missingGuards.join(', ')}`);
    }

    // UI Slots
    lines.push(`UI Slots: ${result.stats.uiSlots.covered}/${result.stats.uiSlots.total}`);
    if (result.missingUISlots.length > 0) {
        lines.push(`  Missing: ${result.missingUISlots.join(', ')}`);
    }

    // Warnings
    if (result.warnings.length > 0) {
        lines.push('');
        lines.push('Warnings:');
        for (const warning of result.warnings) {
            lines.push(`  - ${warning}`);
        }
    }

    lines.push('');
    if (result.valid) {
        lines.push('✅ All OrbitalSchema types are covered by Domain Language');
    } else {
        lines.push('❌ Missing mappings detected - add them to registry.ts');
    }
    lines.push('');

    return lines.join('\n');
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Run validation when executed directly
 */
async function main() {
    const result = validateDomainLanguageCoverage();
    console.log(formatCoverageResult(result));

    if (!result.valid) {
        process.exit(1);
    }
}

// Run if executed directly (Node.js only)
if (typeof process !== 'undefined' && process.argv) {
    const isMainModule = import.meta.url === `file://${process.argv[1]}`;
    if (isMainModule) {
        main().catch(console.error);
    }
}
