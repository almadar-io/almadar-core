/**
 * S-Expression Operators
 *
 * Defines all operators available in the S-expression language.
 * This is the single source of truth for operator metadata.
 *
 * Operators are organized by category:
 * - Arithmetic: +, -, *, /, %, abs, min, max, floor, ceil, round
 * - Comparison: =, !=, <, >, <=, >=
 * - Logic: and, or, not, if
 * - Control: let, do, when
 * - Effects: set, emit, persist, navigate, notify, spawn, despawn
 * - Collections: map, filter, find, count, sum, first, last, nth, concat, includes
 * - Standard Library: std-math, std-str, std-array, std-object, std-validate, std-time, std-format, std-async
 *
 * @packageDocumentation
 */

// ============================================================================
// Operator Categories
// ============================================================================

export const OPERATOR_CATEGORIES = [
  'arithmetic',
  'comparison',
  'logic',
  'control',
  'effect',
  'collection',
  // Standard library categories
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

export type OperatorCategory = (typeof OPERATOR_CATEGORIES)[number];

// ============================================================================
// Operator Metadata
// ============================================================================

/**
 * Basic return types for core operators.
 */
export type BasicReturnType = 'number' | 'boolean' | 'string' | 'any' | 'void' | 'array';

/**
 * Metadata for an operator
 */
export interface OperatorMeta {
  /** Operator category */
  category: OperatorCategory;
  /** Minimum number of arguments */
  minArity: number;
  /** Maximum number of arguments (null = unlimited) */
  maxArity: number | null;
  /** Human-readable description */
  description: string;
  /** Whether this operator has side effects (only valid in effect context) */
  hasSideEffects: boolean;
  /** Return type hint - basic types for core operators, extended types for std modules */
  returnType: string;
}

/**
 * Operator registry - single source of truth for all operators.
 */
export const OPERATORS: Record<string, OperatorMeta> = {
  // ============================================================================
  // Arithmetic Operators
  // ============================================================================
  '+': {
    category: 'arithmetic',
    minArity: 2,
    maxArity: null,
    description: 'Add numbers',
    hasSideEffects: false,
    returnType: 'number',
  },
  '-': {
    category: 'arithmetic',
    minArity: 1,
    maxArity: 2,
    description: 'Subtract numbers or negate',
    hasSideEffects: false,
    returnType: 'number',
  },
  '*': {
    category: 'arithmetic',
    minArity: 2,
    maxArity: null,
    description: 'Multiply numbers',
    hasSideEffects: false,
    returnType: 'number',
  },
  '/': {
    category: 'arithmetic',
    minArity: 2,
    maxArity: 2,
    description: 'Divide numbers',
    hasSideEffects: false,
    returnType: 'number',
  },
  '%': {
    category: 'arithmetic',
    minArity: 2,
    maxArity: 2,
    description: 'Modulo (remainder)',
    hasSideEffects: false,
    returnType: 'number',
  },
  abs: {
    category: 'arithmetic',
    minArity: 1,
    maxArity: 1,
    description: 'Absolute value',
    hasSideEffects: false,
    returnType: 'number',
  },
  min: {
    category: 'arithmetic',
    minArity: 2,
    maxArity: null,
    description: 'Minimum of values',
    hasSideEffects: false,
    returnType: 'number',
  },
  max: {
    category: 'arithmetic',
    minArity: 2,
    maxArity: null,
    description: 'Maximum of values',
    hasSideEffects: false,
    returnType: 'number',
  },
  floor: {
    category: 'arithmetic',
    minArity: 1,
    maxArity: 1,
    description: 'Round down to integer',
    hasSideEffects: false,
    returnType: 'number',
  },
  ceil: {
    category: 'arithmetic',
    minArity: 1,
    maxArity: 1,
    description: 'Round up to integer',
    hasSideEffects: false,
    returnType: 'number',
  },
  round: {
    category: 'arithmetic',
    minArity: 1,
    maxArity: 1,
    description: 'Round to nearest integer',
    hasSideEffects: false,
    returnType: 'number',
  },
  clamp: {
    category: 'arithmetic',
    minArity: 3,
    maxArity: 3,
    description: 'Clamp value between min and max',
    hasSideEffects: false,
    returnType: 'number',
  },

  // ============================================================================
  // Comparison Operators
  // ============================================================================
  '=': {
    category: 'comparison',
    minArity: 2,
    maxArity: 2,
    description: 'Equal to',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  '!=': {
    category: 'comparison',
    minArity: 2,
    maxArity: 2,
    description: 'Not equal to',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  '<': {
    category: 'comparison',
    minArity: 2,
    maxArity: 2,
    description: 'Less than',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  '>': {
    category: 'comparison',
    minArity: 2,
    maxArity: 2,
    description: 'Greater than',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  '<=': {
    category: 'comparison',
    minArity: 2,
    maxArity: 2,
    description: 'Less than or equal to',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  '>=': {
    category: 'comparison',
    minArity: 2,
    maxArity: 2,
    description: 'Greater than or equal to',
    hasSideEffects: false,
    returnType: 'boolean',
  },

  // ============================================================================
  // Logic Operators
  // ============================================================================
  and: {
    category: 'logic',
    minArity: 2,
    maxArity: null,
    description: 'Logical AND (short-circuit)',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  or: {
    category: 'logic',
    minArity: 2,
    maxArity: null,
    description: 'Logical OR (short-circuit)',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  not: {
    category: 'logic',
    minArity: 1,
    maxArity: 1,
    description: 'Logical NOT',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  if: {
    category: 'logic',
    minArity: 3,
    maxArity: 3,
    description: 'Conditional expression (if condition then else)',
    hasSideEffects: false,
    returnType: 'any',
  },

  // ============================================================================
  // Control Operators
  // ============================================================================
  let: {
    category: 'control',
    minArity: 2,
    maxArity: 2,
    description: 'Bind local variables: [let, [[name, value], ...], body]',
    hasSideEffects: false,
    returnType: 'any',
  },
  do: {
    category: 'control',
    minArity: 1,
    maxArity: null,
    description: 'Execute expressions in sequence, return last',
    hasSideEffects: true,
    returnType: 'any',
  },
  when: {
    category: 'control',
    minArity: 2,
    maxArity: 2,
    description: 'Execute effect only when condition is true',
    hasSideEffects: true,
    returnType: 'void',
  },
  fn: {
    category: 'control',
    minArity: 2,
    maxArity: 2,
    description: 'Lambda expression: [fn, varName, body] or [fn, [vars], body]',
    hasSideEffects: false,
    returnType: 'any',
  },

  // ============================================================================
  // Effect Operators
  // ============================================================================
  set: {
    category: 'effect',
    minArity: 2,
    maxArity: 2,
    description: 'Set a binding to a value',
    hasSideEffects: true,
    returnType: 'void',
  },
  emit: {
    category: 'effect',
    minArity: 1,
    maxArity: 2,
    description: 'Emit an event with optional payload',
    hasSideEffects: true,
    returnType: 'void',
  },
  persist: {
    category: 'effect',
    minArity: 2,
    maxArity: 3,
    description: 'Persist data (create/update/delete)',
    hasSideEffects: true,
    returnType: 'void',
  },
  navigate: {
    category: 'effect',
    minArity: 1,
    maxArity: 2,
    description: 'Navigate to a route',
    hasSideEffects: true,
    returnType: 'void',
  },
  notify: {
    category: 'effect',
    minArity: 1,
    maxArity: 2,
    description: 'Show a notification',
    hasSideEffects: true,
    returnType: 'void',
  },
  spawn: {
    category: 'effect',
    minArity: 1,
    maxArity: 2,
    description: 'Spawn a new entity instance',
    hasSideEffects: true,
    returnType: 'void',
  },
  despawn: {
    category: 'effect',
    minArity: 0,
    maxArity: 1,
    description: 'Despawn an entity instance',
    hasSideEffects: true,
    returnType: 'void',
  },
  'call-service': {
    category: 'effect',
    minArity: 2,
    maxArity: 3,
    description: 'Call an external service',
    hasSideEffects: true,
    returnType: 'void',
  },
  'render-ui': {
    category: 'effect',
    minArity: 2,
    maxArity: 3,
    description: 'Render UI to a slot',
    hasSideEffects: true,
    returnType: 'void',
  },

  // ============================================================================
  // Collection Operators
  // ============================================================================
  map: {
    category: 'collection',
    minArity: 2,
    maxArity: 2,
    description: 'Transform each element in collection',
    hasSideEffects: false,
    returnType: 'array',
  },
  filter: {
    category: 'collection',
    minArity: 2,
    maxArity: 2,
    description: 'Filter collection by predicate',
    hasSideEffects: false,
    returnType: 'array',
  },
  find: {
    category: 'collection',
    minArity: 2,
    maxArity: 2,
    description: 'Find first element matching predicate',
    hasSideEffects: false,
    returnType: 'any',
  },
  count: {
    category: 'collection',
    minArity: 1,
    maxArity: 1,
    description: 'Count elements in collection',
    hasSideEffects: false,
    returnType: 'number',
  },
  sum: {
    category: 'collection',
    minArity: 1,
    maxArity: 2,
    description: 'Sum values in collection',
    hasSideEffects: false,
    returnType: 'number',
  },
  first: {
    category: 'collection',
    minArity: 1,
    maxArity: 1,
    description: 'Get first element',
    hasSideEffects: false,
    returnType: 'any',
  },
  last: {
    category: 'collection',
    minArity: 1,
    maxArity: 1,
    description: 'Get last element',
    hasSideEffects: false,
    returnType: 'any',
  },
  nth: {
    category: 'collection',
    minArity: 2,
    maxArity: 2,
    description: 'Get element at index',
    hasSideEffects: false,
    returnType: 'any',
  },
  concat: {
    category: 'collection',
    minArity: 2,
    maxArity: null,
    description: 'Concatenate collections',
    hasSideEffects: false,
    returnType: 'array',
  },
  includes: {
    category: 'collection',
    minArity: 2,
    maxArity: 2,
    description: 'Check if collection includes element',
    hasSideEffects: false,
    returnType: 'boolean',
  },
  empty: {
    category: 'collection',
    minArity: 1,
    maxArity: 1,
    description: 'Check if collection is empty',
    hasSideEffects: false,
    returnType: 'boolean',
  },
} as const;

// ============================================================================
// Operator Helpers
// ============================================================================

/**
 * Get operator metadata by name.
 *
 * @param operator - Operator name
 * @returns Operator metadata or undefined if not found
 */
export function getOperatorMeta(operator: string): OperatorMeta | undefined {
  return OPERATORS[operator];
}

/**
 * Check if an operator exists.
 *
 * @param operator - Operator name
 * @returns true if operator exists
 */
export function isKnownOperator(operator: string): boolean {
  return operator in OPERATORS;
}

/**
 * Check if an operator has side effects.
 *
 * @param operator - Operator name
 * @returns true if operator has side effects
 */
export function isEffectOperator(operator: string): boolean {
  const meta = OPERATORS[operator];
  return meta?.hasSideEffects ?? false;
}

/**
 * Check if an operator is valid in a guard context (no side effects).
 *
 * @param operator - Operator name
 * @returns true if operator can be used in guards
 */
export function isGuardOperator(operator: string): boolean {
  const meta = OPERATORS[operator];
  return meta !== undefined && !meta.hasSideEffects;
}

/**
 * Get all operators in a category.
 *
 * @param category - Operator category
 * @returns Array of operator names
 */
export function getOperatorsByCategory(category: OperatorCategory): string[] {
  return Object.entries(OPERATORS)
    .filter(([_, meta]) => meta.category === category)
    .map(([name]) => name);
}

/**
 * Get all operator names.
 *
 * @returns Array of all operator names
 */
export function getAllOperators(): string[] {
  return Object.keys(OPERATORS);
}

/**
 * Validate operator arity.
 *
 * @param operator - Operator name
 * @param argCount - Number of arguments provided
 * @returns Error message if invalid, null if valid
 */
export function validateOperatorArity(operator: string, argCount: number): string | null {
  const meta = OPERATORS[operator];
  if (!meta) {
    return `Unknown operator: ${operator}`;
  }

  if (argCount < meta.minArity) {
    return `Operator '${operator}' requires at least ${meta.minArity} argument(s), got ${argCount}`;
  }

  if (meta.maxArity !== null && argCount > meta.maxArity) {
    return `Operator '${operator}' accepts at most ${meta.maxArity} argument(s), got ${argCount}`;
  }

  return null;
}

// ============================================================================
// Type Exports
// ============================================================================

export type OperatorName = keyof typeof OPERATORS;
