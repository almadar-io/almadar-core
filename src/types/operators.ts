/**
 * S-Expression Operators
 *
 * Re-exports operator types and data from the canonical @kflow/almadar-operators package.
 * This ensures almadar-core stays in sync with the single source of truth.
 *
 * For TypeScript packages, import from `@kflow/almadar-operators` directly
 * or use these re-exports for backward compatibility.
 *
 * @packageDocumentation
 */

// Re-export everything from the canonical source
export {
  // Types
  type OperatorCategory,
  type TargetPlatform,
  type CategoryMeta,
  type OperatorMeta,
  type OperatorsSchema,
  type OperatorStats,

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
} from '@kflow/almadar-operators';

// ============================================================================
// Backward Compatibility
// ============================================================================

/**
 * @deprecated Use OperatorCategory from @kflow/almadar-operators
 * Kept for backward compatibility with existing code.
 */
export const OPERATOR_CATEGORIES = [
  'arithmetic',
  'comparison',
  'logic',
  'control',
  'effect',
  'collection',
  'std-math',
  'std-str',
  'std-array',
  'std-object',
  'std-validate',
  'std-time',
  'std-format',
  'std-async',
  'std-nn',
  'std-tensor',
  'std-train',
] as const;

/**
 * @deprecated Use string for return types
 * Kept for backward compatibility.
 */
export type BasicReturnType = 'number' | 'boolean' | 'string' | 'any' | 'void' | 'array';

// ============================================================================
// Helper Functions (legacy)
// ============================================================================

// Need separate import for use in helper functions
import { OPERATORS as _OPERATORS, OPERATOR_NAMES as _NAMES } from '@kflow/almadar-operators';

/**
 * @deprecated Use OPERATOR_NAMES from @kflow/almadar-operators
 */
export function getAllOperatorNames(): string[] {
  return _NAMES;
}

/**
 * @deprecated Use Object.keys(OPERATORS) from @kflow/almadar-operators
 */
export function getAllOperators(): string[] {
  return _NAMES;
}

/**
 * @deprecated Use OPERATOR_NAMES from @kflow/almadar-operators
 */
export function getOperatorsForCategory(category: string): string[] {
  return Object.entries(_OPERATORS)
    .filter(([_, meta]) => meta.category === category)
    .map(([name]) => name);
}

/**
 * @deprecated Access OPERATORS directly from @kflow/almadar-operators
 */
export type OperatorName = keyof typeof _OPERATORS;
