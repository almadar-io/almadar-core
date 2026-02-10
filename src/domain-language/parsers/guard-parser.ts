/**
 * Guard Expression Parser
 *
 * Parses guard expressions deterministically from domain language.
 * All entity references are explicit (e.g., Order.amount, CurrentUser.role).
 */

import type {
  GuardCondition,
  FieldReference,
  FieldCheckCondition,
  ComparisonCondition,
  UserCheckCondition,
  LogicalCondition,
  DomainGuard,
  ParseResult,
  ParseError,
  ComparisonOperator,
} from '../types.js';

interface GuardParseContext {
  entityName: string;  // Current entity context (e.g., "Order")
  errors: ParseError[];
}

/**
 * Parse a guard expression from domain text
 *
 * @example
 * parseGuard("if amount > 1000", "Order")
 * // Returns: { field: { entityName: "Order", fieldName: "amount" }, operator: ">", value: 1000 }
 */
export function parseGuard(text: string, entityName: string): ParseResult<DomainGuard> {
  const ctx: GuardParseContext = { entityName, errors: [] };

  // Remove leading "if " if present
  let expression = text.trim();
  if (expression.toLowerCase().startsWith('if ')) {
    expression = expression.slice(3).trim();
  }

  const condition = parseCondition(expression, ctx);

  if (!condition) {
    return {
      success: false,
      errors: ctx.errors.length > 0 ? ctx.errors : [{
        message: `Failed to parse guard expression: "${text}"`,
      }],
      warnings: [],
    };
  }

  return {
    success: true,
    data: {
      type: 'guard',
      condition,
      raw: text,
    },
    errors: [],
    warnings: [],
  };
}

/**
 * Parse a condition (may be simple or compound with AND/OR)
 */
function parseCondition(text: string, ctx: GuardParseContext): GuardCondition | null {
  text = text.trim();

  // Check for logical operators (AND/OR) - split at top level
  const andMatch = splitAtTopLevel(text, ' AND ');
  if (andMatch) {
    const left = parseCondition(andMatch.left, ctx);
    const right = parseCondition(andMatch.right, ctx);
    if (left && right) {
      return {
        type: 'logical',
        operator: 'AND',
        left,
        right,
      };
    }
  }

  const orMatch = splitAtTopLevel(text, ' OR ');
  if (orMatch) {
    const left = parseCondition(orMatch.left, ctx);
    const right = parseCondition(orMatch.right, ctx);
    if (left && right) {
      return {
        type: 'logical',
        operator: 'OR',
        left,
        right,
      };
    }
  }

  // Try each simple condition type
  return parseUserCheck(text, ctx) ||
         parseFieldCheck(text, ctx) ||
         parseComparison(text, ctx);
}

/**
 * Parse user check conditions
 * - "user is manager" → CurrentUser.role == "manager"
 * - "user owns this" → Order.ownerId == CurrentUser.id
 */
function parseUserCheck(text: string, ctx: GuardParseContext): UserCheckCondition | null {
  const lowerText = text.toLowerCase();

  // "user is [role]"
  const roleMatch = lowerText.match(/^user\s+is\s+(\w+)$/);
  if (roleMatch) {
    return {
      type: 'user_check',
      check: 'is_role',
      role: roleMatch[1],
    };
  }

  // "user owns this"
  if (lowerText === 'user owns this') {
    return {
      type: 'user_check',
      check: 'owns_this',
      ownerField: 'ownerId',
    };
  }

  return null;
}

/**
 * Parse field check conditions
 * - "amount is provided" → Order.amount != null
 * - "amount is empty" → Order.amount == null
 * - "status is Pending" → Order.status == "Pending"
 * - "status is not Cancelled" → Order.status != "Cancelled"
 */
function parseFieldCheck(text: string, ctx: GuardParseContext): FieldCheckCondition | null {
  const lowerText = text.toLowerCase();

  // "[field] is provided"
  const providedMatch = text.match(/^(.+?)\s+is\s+provided$/i);
  if (providedMatch) {
    const field = parseFieldReference(providedMatch[1], ctx);
    if (field) {
      return {
        type: 'field_check',
        field,
        check: 'provided',
      };
    }
  }

  // "[field] is empty"
  const emptyMatch = text.match(/^(.+?)\s+is\s+empty$/i);
  if (emptyMatch) {
    const field = parseFieldReference(emptyMatch[1], ctx);
    if (field) {
      return {
        type: 'field_check',
        field,
        check: 'empty',
      };
    }
  }

  // "[field] is not [value]" (negated equality)
  const notEqualsMatch = text.match(/^(.+?)\s+is\s+not\s+(.+)$/i);
  if (notEqualsMatch) {
    // This should be handled as a comparison with !=
    return null; // Let comparison parser handle it
  }

  // "[field] is [value]" (equality check)
  const equalsMatch = text.match(/^(.+?)\s+is\s+(.+)$/i);
  if (equalsMatch) {
    const fieldName = equalsMatch[1].trim();
    const value = equalsMatch[2].trim();

    // Skip if value is a keyword
    if (['provided', 'empty', 'not'].includes(value.toLowerCase())) {
      return null;
    }

    const field = parseFieldReference(fieldName, ctx);
    if (field) {
      return {
        type: 'field_check',
        field,
        check: 'equals',
        value: parseValue(value),
      };
    }
  }

  return null;
}

/**
 * Parse comparison conditions
 * - "amount > 1000" → Order.amount > 1000
 * - "amount >= 1000" → Order.amount >= 1000
 * - "status != 'Cancelled'" → Order.status != "Cancelled"
 */
function parseComparison(text: string, ctx: GuardParseContext): ComparisonCondition | null {
  // Try each operator
  const operators: { pattern: RegExp; operator: ComparisonOperator }[] = [
    { pattern: /^(.+?)\s*>=\s*(.+)$/, operator: '>=' },
    { pattern: /^(.+?)\s*<=\s*(.+)$/, operator: '<=' },
    { pattern: /^(.+?)\s*!=\s*(.+)$/, operator: '!=' },
    { pattern: /^(.+?)\s*==\s*(.+)$/, operator: '==' },
    { pattern: /^(.+?)\s*>\s*(.+)$/, operator: '>' },
    { pattern: /^(.+?)\s*<\s*(.+)$/, operator: '<' },
  ];

  // Also handle "is not" as !=
  const isNotMatch = text.match(/^(.+?)\s+is\s+not\s+(.+)$/i);
  if (isNotMatch) {
    const field = parseFieldReference(isNotMatch[1], ctx);
    if (field) {
      return {
        type: 'comparison',
        field,
        operator: '!=',
        value: parseValue(isNotMatch[2]),
      };
    }
  }

  for (const { pattern, operator } of operators) {
    const match = text.match(pattern);
    if (match) {
      const field = parseFieldReference(match[1], ctx);
      if (field) {
        return {
          type: 'comparison',
          field,
          operator,
          value: parseValue(match[2]),
        };
      }
    }
  }

  return null;
}

/**
 * Parse a field reference
 * - "amount" → { entityName: "Order", fieldName: "amount" } (uses context)
 * - "Order.amount" → { entityName: "Order", fieldName: "amount" }
 * - "tracking number" → { entityName: "Order", fieldName: "trackingNumber" }
 */
function parseFieldReference(text: string, ctx: GuardParseContext): FieldReference | null {
  text = text.trim();

  // Check for explicit entity reference (Entity.field)
  const dotMatch = text.match(/^(\w+)\.(\w+)$/);
  if (dotMatch) {
    return {
      type: 'field_reference',
      entityName: dotMatch[1],
      fieldName: dotMatch[2],
    };
  }

  // Convert "tracking number" style to "trackingNumber"
  const fieldName = toCamelCase(text);

  return {
    type: 'field_reference',
    entityName: ctx.entityName,
    fieldName,
  };
}

/**
 * Parse a value (string, number, or boolean)
 */
function parseValue(text: string): string | number | boolean {
  text = text.trim();

  // Remove quotes if present
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }

  // Boolean
  if (text.toLowerCase() === 'true') return true;
  if (text.toLowerCase() === 'false') return false;

  // Number
  const num = parseFloat(text);
  if (!isNaN(num)) return num;

  // String (identifier-style value like "Pending")
  return text;
}

/**
 * Convert space-separated words to camelCase
 * "tracking number" → "trackingNumber"
 */
function toCamelCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}

/**
 * Split at top-level operator (not inside parentheses)
 */
function splitAtTopLevel(text: string, separator: string): { left: string; right: string } | null {
  const separatorLower = separator.toLowerCase();
  const textLower = text.toLowerCase();

  let depth = 0;
  for (let i = 0; i <= textLower.length - separatorLower.length; i++) {
    const char = text[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && textLower.slice(i, i + separatorLower.length) === separatorLower) {
      return {
        left: text.slice(0, i),
        right: text.slice(i + separator.length),
      };
    }
  }

  return null;
}

/**
 * Format a guard condition back to KFlow schema guard string
 */
export function formatGuardToSchema(guard: DomainGuard): string {
  return formatConditionToSchema(guard.condition);
}

function formatConditionToSchema(condition: GuardCondition): string {
  switch (condition.type) {
    case 'field_check': {
      const fieldRef = `${condition.field.entityName}.${condition.field.fieldName}`;
      switch (condition.check) {
        case 'provided':
          return `${fieldRef} != null`;
        case 'empty':
          return `${fieldRef} == null`;
        case 'equals':
          const value = typeof condition.value === 'string'
            ? `"${condition.value}"`
            : condition.value;
          return `${fieldRef} == ${value}`;
      }
      break;
    }

    case 'comparison': {
      const fieldRef = `${condition.field.entityName}.${condition.field.fieldName}`;
      const value = typeof condition.value === 'string'
        ? `"${condition.value}"`
        : condition.value;
      return `${fieldRef} ${condition.operator} ${value}`;
    }

    case 'user_check': {
      if (condition.check === 'is_role') {
        return `CurrentUser.role == "${condition.role}"`;
      } else {
        return `${condition.ownerField} == CurrentUser.id`;
      }
    }

    case 'logical': {
      const left = formatConditionToSchema(condition.left);
      const right = formatConditionToSchema(condition.right);
      const op = condition.operator === 'AND' ? '&&' : '||';
      return `(${left}) ${op} (${right})`;
    }
  }

  return '';
}

/**
 * Format a guard condition back to domain language
 */
export function formatGuardToDomain(guard: DomainGuard): string {
  return 'if ' + formatConditionToDomain(guard.condition);
}

function formatConditionToDomain(condition: GuardCondition): string {
  switch (condition.type) {
    case 'field_check': {
      const fieldName = toSpaceSeparated(condition.field.fieldName);
      switch (condition.check) {
        case 'provided':
          return `${fieldName} is provided`;
        case 'empty':
          return `${fieldName} is empty`;
        case 'equals':
          return `${fieldName} is ${condition.value}`;
      }
      break;
    }

    case 'comparison': {
      const fieldName = toSpaceSeparated(condition.field.fieldName);
      const opMap: Record<string, string> = {
        '==': 'is',
        '!=': 'is not',
        '>': '>',
        '<': '<',
        '>=': '>=',
        '<=': '<=',
      };
      return `${fieldName} ${opMap[condition.operator] || condition.operator} ${condition.value}`;
    }

    case 'user_check': {
      if (condition.check === 'is_role') {
        return `user is ${condition.role}`;
      } else {
        return 'user owns this';
      }
    }

    case 'logical': {
      const left = formatConditionToDomain(condition.left);
      const right = formatConditionToDomain(condition.right);
      return `${left} ${condition.operator} ${right}`;
    }
  }

  return '';
}

/**
 * Convert camelCase to space-separated words
 * "trackingNumber" → "tracking number"
 */
function toSpaceSeparated(text: string): string {
  return text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}
