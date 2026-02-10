/**
 * Guard Formatter
 *
 * Converts KFlow guard conditions to domain language and vice versa.
 * All entity references are explicit (e.g., Order.amount, CurrentUser.role).
 *
 * Supports both legacy string-based conditions and S-expression format.
 */

import type {
  DomainGuard,
  GuardCondition,
  FieldCheckCondition,
  ComparisonCondition,
  UserCheckCondition,
  LogicalCondition,
  FieldReference,
  ComparisonOperator,
} from '../types.js';
import { formatSExprGuardToDomain, isArraySExpr } from './sexpr-formatter.js';

/**
 * Convert a KFlow schema guard to domain language text.
 * Handles both legacy string conditions and S-expression format.
 */
export function formatSchemaGuardToDomain(guard: Record<string, unknown> | unknown[], entityName: string): string {
  // Check for S-expression format (array with operator)
  if (isArraySExpr(guard)) {
    return formatSExprGuardToDomain(guard, entityName);
  }

  // Legacy object format with condition string
  const condition = (guard as unknown as Record<string, unknown>).condition as string;
  if (!condition) {
    return '';
  }

  // Check if condition itself is an S-expression
  if (isArraySExpr(condition)) {
    return formatSExprGuardToDomain(condition, entityName);
  }

  // Parse the schema guard condition and convert to domain language
  const parsed = parseSchemaCondition(condition, entityName);
  if (!parsed) {
    return `if ${condition}`;
  }

  return formatGuardConditionToDomain(parsed);
}

/**
 * Convert a DomainGuard to KFlow schema guard format
 */
export function formatDomainGuardToSchema(guard: DomainGuard): string {
  return formatConditionToSchemaString(guard.condition);
}

/**
 * Format a guard condition AST to domain-friendly text
 */
export function formatGuardConditionToDomain(condition: GuardCondition): string {
  return 'if ' + formatConditionText(condition);
}

/**
 * Format a condition to readable text (without "if" prefix)
 */
function formatConditionText(condition: GuardCondition): string {
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
      const opMap: Record<ComparisonOperator, string> = {
        '==': 'is',
        '!=': 'is not',
        '>': '>',
        '<': '<',
        '>=': '>=',
        '<=': '<=',
      };
      const op = opMap[condition.operator] || condition.operator;
      return `${fieldName} ${op} ${condition.value}`;
    }

    case 'user_check': {
      if (condition.check === 'is_role') {
        return `user is ${condition.role}`;
      } else {
        return 'user owns this';
      }
    }

    case 'logical': {
      const left = formatConditionText(condition.left);
      const right = formatConditionText(condition.right);
      return `${left} ${condition.operator} ${right}`;
    }
  }

  return '';
}

/**
 * Format a condition AST to KFlow schema string format
 */
function formatConditionToSchemaString(condition: GuardCondition): string {
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
      const left = formatConditionToSchemaString(condition.left);
      const right = formatConditionToSchemaString(condition.right);
      const op = condition.operator === 'AND' ? '&&' : '||';
      return `(${left}) ${op} (${right})`;
    }
  }

  return '';
}

/**
 * Parse a schema condition string into a GuardCondition AST
 * This handles conditions like "Order.amount > 1000" or "CurrentUser.role == \"admin\""
 */
function parseSchemaCondition(condition: string, defaultEntityName: string): GuardCondition | null {
  condition = condition.trim();

  // Handle logical operators
  const andMatch = splitLogicalOperator(condition, '&&');
  if (andMatch) {
    const left = parseSchemaCondition(andMatch.left, defaultEntityName);
    const right = parseSchemaCondition(andMatch.right, defaultEntityName);
    if (left && right) {
      return {
        type: 'logical',
        operator: 'AND',
        left,
        right,
      };
    }
  }

  const orMatch = splitLogicalOperator(condition, '||');
  if (orMatch) {
    const left = parseSchemaCondition(orMatch.left, defaultEntityName);
    const right = parseSchemaCondition(orMatch.right, defaultEntityName);
    if (left && right) {
      return {
        type: 'logical',
        operator: 'OR',
        left,
        right,
      };
    }
  }

  // Handle CurrentUser checks
  if (condition.includes('CurrentUser.role')) {
    const roleMatch = condition.match(/CurrentUser\.role\s*==\s*["']?(\w+)["']?/);
    if (roleMatch) {
      return {
        type: 'user_check',
        check: 'is_role',
        role: roleMatch[1],
      };
    }
  }

  if (condition.includes('CurrentUser.id')) {
    const ownerMatch = condition.match(/(\w+)\s*==\s*CurrentUser\.id/);
    if (ownerMatch) {
      return {
        type: 'user_check',
        check: 'owns_this',
        ownerField: ownerMatch[1],
      };
    }
  }

  // Handle null checks
  const nullCheckMatch = condition.match(/^(.+?)\s*(==|!=)\s*null$/);
  if (nullCheckMatch) {
    const fieldRef = parseFieldReference(nullCheckMatch[1], defaultEntityName);
    if (fieldRef) {
      return {
        type: 'field_check',
        field: fieldRef,
        check: nullCheckMatch[2] === '!=' ? 'provided' : 'empty',
      };
    }
  }

  // Handle comparison operators
  const comparisonMatch = condition.match(/^(.+?)\s*(>=|<=|!=|==|>|<)\s*(.+)$/);
  if (comparisonMatch) {
    const fieldRef = parseFieldReference(comparisonMatch[1], defaultEntityName);
    if (fieldRef) {
      return {
        type: 'comparison',
        field: fieldRef,
        operator: comparisonMatch[2] as ComparisonOperator,
        value: parseValue(comparisonMatch[3]),
      };
    }
  }

  return null;
}

/**
 * Parse a field reference like "Order.amount" or just "amount"
 */
function parseFieldReference(text: string, defaultEntityName: string): FieldReference | null {
  text = text.trim();

  // Remove parentheses if present
  if (text.startsWith('(') && text.endsWith(')')) {
    text = text.slice(1, -1).trim();
  }

  // Check for Entity.field format
  const dotMatch = text.match(/^(\w+)\.(\w+)$/);
  if (dotMatch) {
    return {
      type: 'field_reference',
      entityName: dotMatch[1],
      fieldName: dotMatch[2],
    };
  }

  // Use default entity
  if (/^\w+$/.test(text)) {
    return {
      type: 'field_reference',
      entityName: defaultEntityName,
      fieldName: text,
    };
  }

  return null;
}

/**
 * Parse a value (string, number, boolean)
 */
function parseValue(text: string): string | number | boolean {
  text = text.trim();

  // Remove quotes
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

  // String (identifier-style)
  return text;
}

/**
 * Split condition at logical operator respecting parentheses
 */
function splitLogicalOperator(text: string, operator: string): { left: string; right: string } | null {
  let depth = 0;

  for (let i = 0; i < text.length - operator.length; i++) {
    const char = text[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && text.slice(i, i + operator.length) === operator) {
      return {
        left: text.slice(0, i).trim(),
        right: text.slice(i + operator.length).trim(),
      };
    }
  }

  return null;
}

/**
 * Convert camelCase to space-separated words
 */
function toSpaceSeparated(text: string): string {
  return text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}
