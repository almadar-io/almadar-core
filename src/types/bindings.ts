/**
 * S-Expression Bindings
 *
 * Defines binding types and utilities for S-expression context.
 * Bindings are references to values that are resolved at runtime.
 *
 * Core Bindings:
 * - @entity - The linked entity for this trait (e.g., @entity.health)
 * - @payload - Event payload data (e.g., @payload.amount)
 * - @state - Current state machine state
 * - @now - Current timestamp (Date.now())
 *
 * Entity Bindings:
 * - @EntityName.field - Reference to singleton/runtime entity (e.g., @GameConfig.gravity)
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// Re-export core binding utilities from expression.ts
export {
  isBinding,
  parseBinding,
  isValidBinding,
  CORE_BINDINGS,
  type CoreBinding,
  type ParsedBinding,
} from './expression.js';

// ============================================================================
// Binding Schema
// ============================================================================

/**
 * Schema for a binding string.
 * Validates that the string starts with @ and has valid format.
 */
export const BindingSchema = z.string().refine(
  (val) => {
    if (!val.startsWith('@')) return false;
    const parts = val.slice(1).split('.');
    if (parts.length === 0 || parts[0] === '') return false;
    // All parts must be valid identifiers (letters, numbers, underscore)
    // supporting unicode characters for i18n
    return parts.every((part) => /^[\p{L}_][\p{L}0-9_]*$/u.test(part));
  },
  { message: 'Invalid binding format. Must be @name or @name.path.to.field' }
);

// ============================================================================
// Binding Constants
// ============================================================================

/**
 * Binding documentation for LLM prompts and validation messages.
 */
export const BINDING_DOCS = {
  entity: {
    description: 'Reference to the linked entity for this trait',
    examples: ['@entity.health', '@entity.x', '@entity.status'],
    requiresPath: true,
  },
  payload: {
    description: 'Reference to the event payload data',
    examples: ['@payload.amount', '@payload.targetId', '@payload.action'],
    requiresPath: true,
  },
  state: {
    description: 'Current state machine state name',
    examples: ['@state'],
    requiresPath: false,
  },
  now: {
    description: 'Current timestamp in milliseconds',
    examples: ['@now'],
    requiresPath: false,
  },
} as const;

/**
 * Validation rules for bindings in different contexts.
 */
export const BINDING_CONTEXT_RULES = {
  guard: {
    allowed: ['entity', 'payload', 'state', 'now'] as const,
    description: 'Guards can access entity fields, event payload, current state, and time',
  },
  effect: {
    allowed: ['entity', 'payload', 'state', 'now'] as const,
    description: 'Effects can access and modify entity fields, use payload data',
  },
  tick: {
    allowed: ['entity', 'state', 'now'] as const,
    description: 'Ticks can access entity fields, current state, and time (no payload)',
  },
} as const;

export type BindingContext = keyof typeof BINDING_CONTEXT_RULES;

// ============================================================================
// Binding Validation Helpers
// ============================================================================

/**
 * Check if a binding is valid in a given context.
 *
 * @param binding - Parsed binding
 * @param context - Context where binding is used
 * @returns Error message if invalid, null if valid
 */
export function validateBindingInContext(
  binding: { type: 'core' | 'entity'; root: string },
  context: BindingContext
): string | null {
  const rules = BINDING_CONTEXT_RULES[context];

  if (binding.type === 'core') {
    if (!(rules.allowed as readonly string[]).includes(binding.root)) {
      return `Binding @${binding.root} is not allowed in ${context} context. Allowed: ${rules.allowed.join(', ')}`;
    }
  }

  // Entity bindings are always allowed (they reference singletons/runtime entities)
  return null;
}

/**
 * Get all valid binding examples for a context.
 *
 * @param context - Context to get examples for
 * @returns Array of example binding strings
 */
export function getBindingExamples(context: BindingContext): string[] {
  const rules = BINDING_CONTEXT_RULES[context];
  const examples: string[] = [];

  for (const binding of rules.allowed) {
    const doc = BINDING_DOCS[binding];
    examples.push(...doc.examples);
  }

  // Add entity binding example
  examples.push('@GameConfig.gravity', '@Filter.searchTerm');

  return examples;
}
