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
export const getAllOperators = () => _NAMES;
export type OperatorName = string;
