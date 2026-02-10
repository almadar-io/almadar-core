/**
 * S-Expression Parser
 *
 * Parses domain language text (guards/effects) back to S-Expression arrays.
 * This is the reverse of what sexpr-formatter.ts does.
 *
 * @example
 * parseDomainGuard("health is at least 0") → [">=", "@entity.health", 0]
 * parseDomainEffect("update status to 'done'") → ["set", "@entity.status", "done"]
 *
 * @packageDocumentation
 */

import type { SExpr } from '../../types/index.js';
import { getPatternDefinition } from '@almadar/patterns';

// Helper functions for pattern validation
function isKnownPattern(pattern: string): boolean {
  return getPatternDefinition(pattern) !== null;
}

function validatePatternReference(pattern: string): string | null {
  // Simple suggestion logic - could be enhanced
  return null;
}

// ============================================================================
// Parse Warnings (collected during parsing)
// ============================================================================

export interface ParseWarning {
  message: string;
  type: 'unknown-pattern' | 'invalid-syntax';
}

let parseWarnings: ParseWarning[] = [];

/**
 * Get and clear parse warnings from the last parse operation.
 */
export function getParseWarnings(): ParseWarning[] {
  const warnings = parseWarnings;
  parseWarnings = [];
  return warnings;
}

/**
 * Add a parse warning.
 */
function addWarning(message: string, type: ParseWarning['type']): void {
  parseWarnings.push({ message, type });
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Parse a domain guard expression to S-Expression.
 *
 * @param text - Domain language guard (e.g., "health is at least 0", "status is 'active'")
 * @param entityName - The entity context for unqualified field references
 * @returns S-Expression array
 *
 * @example
 * parseDomainGuard("health is at least 0") → [">=", "@entity.health", 0]
 * parseDomainGuard("status is 'active'") → ["=", "@entity.status", "active"]
 * parseDomainGuard("x > 0 and y < 100") → ["and", [">", "@entity.x", 0], ["<", "@entity.y", 100]]
 */
export function parseDomainGuard(text: string, entityName?: string): SExpr {
  const ctx: ParseContext = { entityName: entityName || '' };
  let expr = text.trim();

  // Remove "if " prefix if present
  if (expr.toLowerCase().startsWith('if ')) {
    expr = expr.slice(3).trim();
  }

  return parseExpression(expr, ctx);
}

/**
 * Parse a domain effect expression to S-Expression.
 *
 * @param text - Domain language effect (e.g., "update status to 'done'", "emit ORDER_PLACED")
 * @param entityName - The entity context for unqualified field references
 * @returns S-Expression array
 *
 * @example
 * parseDomainEffect("update status to 'done'") → ["set", "@entity.status", "done"]
 * parseDomainEffect("emit ORDER_PLACED") → ["emit", "ORDER_PLACED"]
 * parseDomainEffect("render entity-table to main") → ["render-ui", "main", { type: "entity-table" }]
 */
export function parseDomainEffect(text: string, entityName?: string): SExpr {
  const ctx: ParseContext = { entityName: entityName || '' };
  let expr = text.trim();

  // Remove "then " prefix if present
  if (expr.toLowerCase().startsWith('then ')) {
    expr = expr.slice(5).trim();
  }

  return parseEffect(expr, ctx);
}

/**
 * Parse multiple domain effects (comma or "then" separated).
 *
 * @param text - Domain language effects
 * @param entityName - The entity context
 * @returns Array of S-Expressions (wrapped in ["do", ...] if multiple)
 */
export function parseDomainEffects(text: string, entityName?: string): SExpr[] {
  const ctx: ParseContext = { entityName: entityName || '' };
  let expr = text.trim();

  // Remove "then " prefix
  if (expr.toLowerCase().startsWith('then ')) {
    expr = expr.slice(5).trim();
  }

  // Split by ", then " or just "then"
  const parts = expr.split(/,\s*then\s+|\s+then\s+/i).filter(p => p.trim());

  return parts.map(p => parseEffect(p.trim(), ctx));
}

// ============================================================================
// Parse Context
// ============================================================================

interface ParseContext {
  entityName: string;
}

// ============================================================================
// Inline S-Expression / JSON Parsing
// ============================================================================

/**
 * Check if text is an inline S-Expression or JSON.
 *
 * Supports:
 * - JSON array: [...]
 * - JSON object: {...}
 * - Lisp S-Expression: (op args...)
 */
function isInlineSExpr(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('[') || trimmed.startsWith('{') || trimmed.startsWith('(');
}

/**
 * Parse inline S-Expression or JSON to SExpr.
 *
 * Supports:
 * - JSON: ["emit", "EVENT"] or {"type": "stats"}
 * - Lisp: (emit EVENT) or (render-ui main {type: "stats"})
 */
function parseInlineSExpr(text: string): SExpr {
  const trimmed = text.trim();

  // JSON array or object
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Try relaxed JSON (single quotes, unquoted keys)
      return parseRelaxedJson(trimmed);
    }
  }

  // Lisp-style S-Expression: (op args...)
  if (trimmed.startsWith('(')) {
    return parseLispSExpr(trimmed);
  }

  throw new Error(`Invalid inline S-Expression: ${text}`);
}

/**
 * Parse relaxed JSON (allows single quotes, unquoted keys).
 */
function parseRelaxedJson(text: string): SExpr {
  // Replace single quotes with double quotes (simple approach)
  let normalized = text;

  // Handle single-quoted strings
  normalized = normalized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  // Handle unquoted keys in objects: {key: value} → {"key": value}
  normalized = normalized.replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":');

  try {
    return JSON.parse(normalized);
  } catch (e) {
    throw new Error(`Failed to parse relaxed JSON: ${text}`);
  }
}

/**
 * Parse Lisp-style S-Expression: (op arg1 arg2 ...)
 *
 * Examples:
 * - (emit EVENT) → ["emit", "EVENT"]
 * - (render-ui main {type: "stats"}) → ["render-ui", "main", {type: "stats"}]
 * - (and (> x 0) (< x 100)) → ["and", [">", "x", 0], ["<", "x", 100]]
 */
function parseLispSExpr(text: string): SExpr {
  const trimmed = text.trim();

  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    throw new Error(`Invalid Lisp S-Expression: ${text}`);
  }

  const inner = trimmed.slice(1, -1).trim();
  const tokens = tokenizeLisp(inner);

  if (tokens.length === 0) {
    return [];
  }

  return tokens.map(parseLispToken);
}

/**
 * Tokenize Lisp expression, respecting nested parens, braces, and quotes.
 */
function tokenizeLisp(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      current += char;
      if (char === stringChar && text[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
      continue;
    }

    if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
      continue;
    }

    if (char === ' ' || char === '\t' || char === '\n') {
      if (depth === 0 && current.trim()) {
        tokens.push(current.trim());
        current = '';
      } else if (depth > 0) {
        current += char;
      }
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Parse a single Lisp token to SExpr value.
 */
function parseLispToken(token: string): SExpr {
  const trimmed = token.trim();

  // Nested S-Expression
  if (trimmed.startsWith('(')) {
    return parseLispSExpr(trimmed);
  }

  // JSON object or array
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseRelaxedJson(trimmed);
  }

  // Quoted string
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  // Binding (starts with @)
  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  // Symbol/identifier
  return trimmed;
}

// ============================================================================
// Expression Parsing (Guards)
// ============================================================================

/**
 * Parse a general expression (guard context).
 */
function parseExpression(text: string, ctx: ParseContext): SExpr {
  text = text.trim();

  // Check for inline S-Expression/JSON first
  if (isInlineSExpr(text)) {
    return parseInlineSExpr(text);
  }

  // Handle logical operators at top level
  const andMatch = splitAtTopLevel(text, ' and ');
  if (andMatch) {
    const left = parseExpression(andMatch.left, ctx);
    const right = parseExpression(andMatch.right, ctx);
    return ['and', left, right];
  }

  const orMatch = splitAtTopLevel(text, ' or ');
  if (orMatch) {
    const left = parseExpression(orMatch.left, ctx);
    const right = parseExpression(orMatch.right, ctx);
    return ['or', left, right];
  }

  // Handle "not X"
  if (text.toLowerCase().startsWith('not ')) {
    const inner = parseExpression(text.slice(4).trim(), ctx);
    return ['not', inner];
  }

  // Handle parentheses
  if (text.startsWith('(') && text.endsWith(')')) {
    return parseExpression(text.slice(1, -1), ctx);
  }

  // Parse comparison/condition
  return parseComparison(text, ctx);
}

/**
 * Parse a comparison expression.
 */
function parseComparison(text: string, ctx: ParseContext): SExpr {
  // "X is at least Y" → [">=", X, Y]
  const atLeastMatch = text.match(/^(.+?)\s+is\s+at\s+least\s+(.+)$/i);
  if (atLeastMatch) {
    const field = parseFieldRef(atLeastMatch[1], ctx);
    const value = parseValue(atLeastMatch[2]);
    return ['>=', field, value];
  }

  // "X is at most Y" → ["<=", X, Y]
  const atMostMatch = text.match(/^(.+?)\s+is\s+at\s+most\s+(.+)$/i);
  if (atMostMatch) {
    const field = parseFieldRef(atMostMatch[1], ctx);
    const value = parseValue(atMostMatch[2]);
    return ['<=', field, value];
  }

  // "X is greater than Y" → [">", X, Y]
  const greaterThanMatch = text.match(/^(.+?)\s+is\s+greater\s+than\s+(.+)$/i);
  if (greaterThanMatch) {
    const field = parseFieldRef(greaterThanMatch[1], ctx);
    const value = parseValue(greaterThanMatch[2]);
    return ['>', field, value];
  }

  // "X is less than Y" → ["<", X, Y]
  const lessThanMatch = text.match(/^(.+?)\s+is\s+less\s+than\s+(.+)$/i);
  if (lessThanMatch) {
    const field = parseFieldRef(lessThanMatch[1], ctx);
    const value = parseValue(lessThanMatch[2]);
    return ['<', field, value];
  }

  // "X is not Y" → ["!=", X, Y]
  const isNotMatch = text.match(/^(.+?)\s+is\s+not\s+(.+)$/i);
  if (isNotMatch) {
    const field = parseFieldRef(isNotMatch[1], ctx);
    const value = parseValue(isNotMatch[2]);
    return ['!=', field, value];
  }

  // "X is Y" → ["=", X, Y]
  const isMatch = text.match(/^(.+?)\s+is\s+(.+)$/i);
  if (isMatch) {
    const field = parseFieldRef(isMatch[1], ctx);
    const value = parseValue(isMatch[2]);
    return ['=', field, value];
  }

  // Operator-based comparisons: >=, <=, !=, ==, >, <
  const opPatterns: { pattern: RegExp; op: string }[] = [
    { pattern: /^(.+?)\s*>=\s*(.+)$/, op: '>=' },
    { pattern: /^(.+?)\s*<=\s*(.+)$/, op: '<=' },
    { pattern: /^(.+?)\s*!=\s*(.+)$/, op: '!=' },
    { pattern: /^(.+?)\s*==\s*(.+)$/, op: '=' },
    { pattern: /^(.+?)\s*>\s*(.+)$/, op: '>' },
    { pattern: /^(.+?)\s*<\s*(.+)$/, op: '<' },
  ];

  for (const { pattern, op } of opPatterns) {
    const match = text.match(pattern);
    if (match) {
      const left = parseFieldRef(match[1], ctx);
      const right = parseValue(match[2]);
      return [op, left, right];
    }
  }

  // Default: return as binding or literal
  return parseFieldRef(text, ctx);
}

// ============================================================================
// Effect Parsing
// ============================================================================

/**
 * Parse an effect expression.
 *
 * Supports both human-readable syntax and inline S-Expressions:
 * - Human: update status to 'done'
 * - S-Expr: ["set", "@entity.status", "done"]
 * - Lisp: (set @entity.status "done")
 * - JSON: {"type": "stats", "metrics": [...]}
 */
function parseEffect(text: string, ctx: ParseContext): SExpr {
  text = text.trim();

  // Check for inline S-Expression/JSON first (highest priority)
  if (isInlineSExpr(text)) {
    return parseInlineSExpr(text);
  }

  // "update X to Y" → ["set", "@entity.X", Y]
  const updateMatch = text.match(/^update\s+(.+?)\s+to\s+(.+)$/i);
  if (updateMatch) {
    const field = parseFieldRef(updateMatch[1], ctx);
    const value = parseEffectValue(updateMatch[2], ctx);
    return ['set', field, value];
  }

  // "emit EVENT with PAYLOAD" → ["emit", "EVENT", PAYLOAD]
  const emitWithMatch = text.match(/^emit\s+(\S+)\s+with\s+(.+)$/i);
  if (emitWithMatch) {
    const event = emitWithMatch[1];
    const payload = parseEffectValue(emitWithMatch[2], ctx);
    return ['emit', event, payload];
  }

  // "emit EVENT" → ["emit", "EVENT"]
  const emitMatch = text.match(/^emit\s+(\S+)$/i);
  if (emitMatch) {
    return ['emit', emitMatch[1]];
  }

  // "render null to SLOT" → ["render-ui", "SLOT", null]
  const renderNullMatch = text.match(/^render\s+null\s+to\s+(\S+)$/i);
  if (renderNullMatch) {
    return ['render-ui', renderNullMatch[1], null];
  }

  // "render PATTERN to SLOT for ENTITY with PROPS" → ["render-ui", "SLOT", { type, entity, props }]
  const renderFullMatch = text.match(/^render\s+(\S+)\s+to\s+(\S+)\s+for\s+(\S+)\s+with\s+(.+)$/i);
  if (renderFullMatch) {
    const pattern = renderFullMatch[1];
    const slot = renderFullMatch[2];
    const entity = renderFullMatch[3];
    const propsText = renderFullMatch[4];
    const props = parseRenderProps(propsText);
    // Validate pattern type
    validatePatternType(pattern);
    return ['render-ui', slot, { type: pattern, entity, ...props }];
  }

  // "render PATTERN to SLOT for ENTITY" → ["render-ui", "SLOT", { type, entity }]
  const renderEntityMatch = text.match(/^render\s+(\S+)\s+to\s+(\S+)\s+for\s+(\S+)$/i);
  if (renderEntityMatch) {
    const pattern = renderEntityMatch[1];
    const slot = renderEntityMatch[2];
    const entity = renderEntityMatch[3];
    // Validate pattern type
    validatePatternType(pattern);
    return ['render-ui', slot, { type: pattern, entity }];
  }

  // "render PATTERN to SLOT with PROPS" → ["render-ui", "SLOT", { type, props }]
  const renderPropsMatch = text.match(/^render\s+(\S+)\s+to\s+(\S+)\s+with\s+(.+)$/i);
  if (renderPropsMatch) {
    const pattern = renderPropsMatch[1];
    const slot = renderPropsMatch[2];
    const propsText = renderPropsMatch[3];
    const props = parseRenderProps(propsText);
    // Validate pattern type
    validatePatternType(pattern);
    return ['render-ui', slot, { type: pattern, ...props }];
  }

  // "render PATTERN to SLOT" → ["render-ui", "SLOT", { type: "PATTERN" }]
  const renderMatch = text.match(/^render\s+(\S+)\s+to\s+(\S+)$/i);
  if (renderMatch) {
    const pattern = renderMatch[1];
    const slot = renderMatch[2];
    // Validate pattern type
    validatePatternType(pattern);
    return ['render-ui', slot, { type: pattern }];
  }

  // "render to SLOT" → ["render-ui", "SLOT"]
  const renderSlotMatch = text.match(/^render\s+to\s+(\S+)$/i);
  if (renderSlotMatch) {
    return ['render-ui', renderSlotMatch[1]];
  }

  // "navigate to PATH with PARAMS" → ["navigate", "PATH", PARAMS]
  const navWithMatch = text.match(/^navigate\s+to\s+(.+?)\s+with\s+(.+)$/i);
  if (navWithMatch) {
    const path = navWithMatch[1];
    const params = parseEffectValue(navWithMatch[2], ctx);
    return ['navigate', path, params];
  }

  // "navigate to PATH" → ["navigate", "PATH"]
  const navMatch = text.match(/^navigate\s+to\s+(.+)$/i);
  if (navMatch) {
    return ['navigate', navMatch[1]];
  }

  // "show TYPE notification MESSAGE" → ["notify", "MESSAGE", "TYPE"]
  const showNotifyMatch = text.match(/^show\s+(\w+)\s+notification\s+"(.+)"$/i);
  if (showNotifyMatch) {
    return ['notify', showNotifyMatch[2], showNotifyMatch[1]];
  }

  // "notify MESSAGE" → ["notify", "MESSAGE"]
  const notifyMatch = text.match(/^notify\s+"(.+)"$/i);
  if (notifyMatch) {
    return ['notify', notifyMatch[1]];
  }

  // "persist ACTION DATA" → ["persist", "ACTION", DATA]
  const persistWithMatch = text.match(/^persist\s+(\w+)\s+(.+)$/i);
  if (persistWithMatch) {
    const action = persistWithMatch[1];
    const data = parseFieldRef(persistWithMatch[2], ctx);
    return ['persist', action, data];
  }

  // "persist ACTION" → ["persist", "ACTION"]
  const persistMatch = text.match(/^persist\s+(\w+)$/i);
  if (persistMatch) {
    return ['persist', persistMatch[1]];
  }

  // "spawn ENTITY with PROPS" → ["spawn", "ENTITY", PROPS]
  const spawnWithMatch = text.match(/^spawn\s+(\S+)\s+with\s+(.+)$/i);
  if (spawnWithMatch) {
    const entityType = spawnWithMatch[1];
    const props = parseEffectValue(spawnWithMatch[2], ctx);
    return ['spawn', entityType, props];
  }

  // "spawn ENTITY" → ["spawn", "ENTITY"]
  const spawnMatch = text.match(/^spawn\s+(\S+)$/i);
  if (spawnMatch) {
    return ['spawn', spawnMatch[1]];
  }

  // "despawn ID" → ["despawn", ID]
  const despawnIdMatch = text.match(/^despawn\s+(.+)$/i);
  if (despawnIdMatch && despawnIdMatch[1] !== 'this') {
    return ['despawn', parseFieldRef(despawnIdMatch[1], ctx)];
  }

  // "despawn this" or "despawn" → ["despawn"]
  if (text.toLowerCase() === 'despawn' || text.toLowerCase() === 'despawn this') {
    return ['despawn'];
  }

  // "call SERVICE.ACTION" → ["call-service", "SERVICE", "ACTION"]
  const callServiceMatch = text.match(/^call\s+(\w+)\.(\w+)$/i);
  if (callServiceMatch) {
    return ['call-service', callServiceMatch[1], callServiceMatch[2]];
  }

  // "call SERVICE" → ["call-service", "SERVICE"]
  const callMatch = text.match(/^call\s+(\S+)$/i);
  if (callMatch) {
    return ['call-service', callMatch[1]];
  }

  // Fallback: return as literal
  return text;
}

// ============================================================================
// Field Reference Parsing
// ============================================================================

/**
 * Parse a field reference to a binding.
 * Converts domain text to @entity.field format.
 */
function parseFieldRef(text: string, ctx: ParseContext): string {
  text = text.trim();

  // Already a binding (@entity.field, @payload.field, etc.)
  if (text.startsWith('@')) {
    return text;
  }

  // "current state" → "@state"
  if (text.toLowerCase() === 'current state') {
    return '@state';
  }

  // "current time" → "@now"
  if (text.toLowerCase() === 'current time') {
    return '@now';
  }

  // "entity" alone → "@entity"
  if (text.toLowerCase() === 'entity') {
    return '@entity';
  }

  // "payload" alone → "@payload"
  if (text.toLowerCase() === 'payload') {
    return '@payload';
  }

  // "incoming X" → "@payload.X"
  if (text.toLowerCase().startsWith('incoming ')) {
    const field = toCamelCase(text.slice(9).trim());
    return `@payload.${field}`;
  }

  // "X's Y" → "@X.Y" (singleton binding)
  const possessiveMatch = text.match(/^(\w+)'s\s+(.+)$/);
  if (possessiveMatch) {
    const entity = possessiveMatch[1];
    const field = toCamelCase(possessiveMatch[2]);
    return `@${entity}.${field}`;
  }

  // "Entity.field" → "@Entity.field"
  if (text.includes('.')) {
    // Check if first part is capitalized (entity reference)
    const parts = text.split('.');
    if (parts[0] && /^[A-Z]/.test(parts[0])) {
      return `@${text}`;
    }
    // Otherwise it's an entity field
    return `@entity.${text}`;
  }

  // Simple field name → "@entity.fieldName"
  const fieldName = toCamelCase(text);
  return `@entity.${fieldName}`;
}

// ============================================================================
// Value Parsing
// ============================================================================

/**
 * Parse a value (can be literal or binding).
 */
function parseValue(text: string): SExpr {
  text = text.trim();

  // Quoted string
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }

  // "nothing" or "null" → null
  if (text.toLowerCase() === 'nothing' || text.toLowerCase() === 'null') {
    return null as unknown as SExpr;
  }

  // Boolean
  if (text.toLowerCase() === 'true') return true;
  if (text.toLowerCase() === 'false') return false;

  // Number
  const num = parseFloat(text);
  if (!isNaN(num) && text.match(/^-?\d+(\.\d+)?$/)) {
    return num;
  }

  // Already a binding
  if (text.startsWith('@')) {
    return text;
  }

  // Simple identifier - could be an enum value or string
  if (/^[a-zA-Z_]\w*$/.test(text)) {
    return text;
  }

  // Default: return as string
  return text;
}

/**
 * Parse a value in effect context (handles nested expressions).
 */
function parseEffectValue(text: string, ctx: ParseContext): SExpr {
  text = text.trim();

  // JSON object literal
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      // Handle binding references in JSON
      const processed = text.replace(/@[\w.]+/g, (match) => `"${match}"`);
      const obj = JSON.parse(processed);
      // Convert quoted bindings back
      return processBindingsInObject(obj);
    } catch {
      // Not valid JSON, return as-is
      return text;
    }
  }

  // Arithmetic expression
  const arithmeticMatch = text.match(/^\((.+?)\s+(plus|minus|times|divided by)\s+(.+)\)$/i);
  if (arithmeticMatch) {
    const left = parseEffectValue(arithmeticMatch[1], ctx);
    const right = parseEffectValue(arithmeticMatch[3], ctx);
    const opMap: Record<string, string> = {
      'plus': '+',
      'minus': '-',
      'times': '*',
      'divided by': '/',
    };
    return [opMap[arithmeticMatch[2].toLowerCase()] || arithmeticMatch[2], left, right];
  }

  // Field reference
  if (text.includes('.') || text.toLowerCase().startsWith('incoming ') ||
      text.match(/^\w+'s\s+/) || /^[a-z]/.test(text)) {
    // Looks like a field reference
    return parseFieldRef(text, ctx);
  }

  // Delegate to parseValue
  return parseValue(text);
}

/**
 * Process bindings in a parsed JSON object.
 */
function processBindingsInObject(obj: unknown): SExpr {
  if (obj === null || obj === undefined) {
    return null as unknown as SExpr;
  }

  if (typeof obj === 'string') {
    // Convert quoted binding back
    if (obj.startsWith('@')) {
      return obj;
    }
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj as SExpr;
  }

  if (Array.isArray(obj)) {
    return obj.map(processBindingsInObject) as SExpr;
  }

  // Object
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = processBindingsInObject(value);
  }
  return result as SExpr;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Split at top-level separator (not inside parentheses).
 */
function splitAtTopLevel(text: string, separator: string): { left: string; right: string } | null {
  const separatorLower = separator.toLowerCase();
  const textLower = text.toLowerCase();

  let depth = 0;
  for (let i = 0; i <= textLower.length - separatorLower.length; i++) {
    const char = text[i];
    if (char === '(' || char === '[' || char === '{') depth++;
    else if (char === ')' || char === ']' || char === '}') depth--;
    else if (depth === 0 && textLower.slice(i, i + separatorLower.length) === separatorLower) {
      return {
        left: text.slice(0, i).trim(),
        right: text.slice(i + separator.length).trim(),
      };
    }
  }

  return null;
}

/**
 * Convert space-separated text to camelCase.
 * Preserves existing camelCase (single word with mixed case).
 */
function toCamelCase(text: string): string {
  const words = text.split(/\s+/);

  // If single word, preserve its casing (e.g., "isActive" stays "isActive")
  if (words.length === 1) {
    return words[0];
  }

  // Multiple words: convert to camelCase
  return words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');
}

/**
 * Split array content by commas, respecting quoted strings
 */
function splitArrayItems(content: string): string[] {
  const items: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if ((char === "'" || char === '"') && (i === 0 || content[i - 1] !== '\\')) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuote = false;
      }
      current += char;
    } else if (char === ',' && !inQuote) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

/**
 * Remove quotes from a string value
 */
function unquote(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Generic syntax patterns detected by markers:
 *
 * 1. "as" pattern: field as 'Label' → {field, label}
 *    Used for: metrics, columns, any labeled field
 *
 * 2. "->" pattern: Label -> EVENT → {label, event}
 *    With variant: Label -> EVENT:variant → {label, event, variant}
 *    Used for: itemActions, buttons, any action binding
 *
 * 3. ":" + "->" pattern: id: 'Label' -> EVENT → {id, label, event}
 *    Used for: tabs, navigation items
 *
 * 4. "@" pattern: section @ span → {section, colSpan}
 *    With row span: section @ colxrow → {section, colSpan, rowSpan}
 *    Used for: cells, grid layouts
 *
 * The parser auto-detects which pattern based on syntax markers,
 * so any prop can use any pattern without hardcoding prop names.
 */
function parseArrayItem(item: string): unknown {
  const trimmed = item.trim();

  // Pattern 3: id: 'Label' -> EVENT (has both : and ->)
  const tabMatch = trimmed.match(/^(\w+):\s*['"]([^'"]+)['"]\s*->\s*(\w+)$/);
  if (tabMatch) {
    return { id: tabMatch[1], label: tabMatch[2], event: tabMatch[3] };
  }

  // Pattern 2 with variant: Label -> EVENT:variant
  const actionVariantMatch = trimmed.match(/^([^->]+)\s*->\s*(\w+):(\w+)$/);
  if (actionVariantMatch) {
    return {
      label: actionVariantMatch[1].trim(),
      event: actionVariantMatch[2],
      variant: actionVariantMatch[3],
    };
  }

  // Pattern 2: Label -> EVENT or 'Label' -> EVENT
  const actionMatch = trimmed.match(/^(['"]?)([^'"->]+)\1\s*->\s*(\w+)$/);
  if (actionMatch) {
    return { label: actionMatch[2].trim(), event: actionMatch[3] };
  }

  // Pattern 4 with rowSpan: section @ colxrow
  const cellSpanMatch = trimmed.match(/^(\w+)\s*@\s*(\d+)x(\d+)$/);
  if (cellSpanMatch) {
    return {
      section: cellSpanMatch[1],
      colSpan: parseInt(cellSpanMatch[2], 10),
      rowSpan: parseInt(cellSpanMatch[3], 10),
    };
  }

  // Pattern 4: section @ span
  const cellMatch = trimmed.match(/^(\w+)\s*@\s*(\d+)$/);
  if (cellMatch) {
    return {
      section: cellMatch[1],
      colSpan: parseInt(cellMatch[2], 10),
    };
  }

  // Pattern 1: field as 'Label' or field as "Label"
  const asMatch = trimmed.match(/^(\w+)\s+as\s+['"]([^'"]+)['"]$/);
  if (asMatch) {
    return { field: asMatch[1], label: asMatch[2] };
  }

  // No pattern detected - return as simple string
  return unquote(trimmed);
}

/**
 * Parse array content, auto-detecting complex syntax patterns
 */
function parseArrayProp(content: string): unknown[] {
  const items = splitArrayItems(content);
  return items.map(parseArrayItem);
}

/**
 * Check if array content contains complex syntax markers
 */
function hasComplexSyntax(content: string): boolean {
  return /\s+as\s+['"]/.test(content) ||  // "as" pattern
         /->\s*\w+/.test(content) ||       // "->" pattern
         /\w+\s*@\s*\d+/.test(content);    // "@" pattern
}

/**
 * Parse render props from text like "title 'Notes'" or "columns [title, createdAt]"
 *
 * Auto-detects complex array syntax based on markers:
 * - "as" pattern: field as 'Label' → {field, label}
 * - "->" pattern: Label -> EVENT → {label, event}
 * - ":" + "->" pattern: id: 'Label' -> EVENT → {id, label, event}
 * - "@" pattern: section @ span → {section, colSpan}
 *
 * Works generically for any prop name - no need to hardcode specific keys.
 */
function parseRenderProps(text: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  // Match "key 'value'" or "key [array]" or "key value"
  const propsRegex = /(\w+)\s+(?:'([^']+)'|"([^"]+)"|\[([^\]]+)\]|(\S+))/g;
  let match;

  while ((match = propsRegex.exec(text)) !== null) {
    const key = match[1];
    const singleQuoted = match[2];
    const doubleQuoted = match[3];
    const arrayContent = match[4];
    const bareValue = match[5];

    if (singleQuoted !== undefined) {
      props[key] = singleQuoted;
    } else if (doubleQuoted !== undefined) {
      props[key] = doubleQuoted;
    } else if (arrayContent !== undefined) {
      // Auto-detect complex syntax based on markers, not key names
      if (hasComplexSyntax(arrayContent)) {
        props[key] = parseArrayProp(arrayContent);
      } else {
        // Simple array: "title, createdAt" → ["title", "createdAt"]
        props[key] = arrayContent.split(/\s*,\s*/).map(s => s.trim());
      }
    } else if (bareValue !== undefined) {
      // Try to parse as number or boolean
      if (bareValue === 'true') props[key] = true;
      else if (bareValue === 'false') props[key] = false;
      else if (/^\d+(\.\d+)?$/.test(bareValue)) props[key] = parseFloat(bareValue);
      else props[key] = bareValue;
    }
  }

  return props;
}

/**
 * Validate a pattern type against the registry.
 * Adds a warning if the pattern is unknown.
 */
function validatePatternType(pattern: string): void {
  if (!isKnownPattern(pattern)) {
    const suggestion = validatePatternReference(pattern);
    addWarning(
      suggestion || `Unknown pattern type: "${pattern}"`,
      'unknown-pattern'
    );
  }
}
