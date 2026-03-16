/**
 * S-Expression Operators
 *
 * Re-exports operator types and data from the canonical @almadar/operators package.
 * This ensures almadar-core stays in sync with the single source of truth.
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
} from '@almadar/operators';

// Legacy alias for backward compatibility with code importing getAllOperators
import { OPERATOR_NAMES as _NAMES } from '@almadar/operators';

/**
 * Get all operator names.
 * 
 * Returns a list of all registered S-expression operator names.
 * This is a legacy alias - prefer importing OPERATOR_NAMES directly
 * from @almadar/operators for new code.
 * 
 * @returns {string[]} Array of operator names
 * 
 * @example
 * const operators = getAllOperators();
 * // Returns: ['set', 'emit', 'navigate', 'renderUI', ...]
 */
export const getAllOperators = () => _NAMES;

/**
 * Operator name type.
 * 
 * Represents a valid operator name string.
 */
export type OperatorName = string;
