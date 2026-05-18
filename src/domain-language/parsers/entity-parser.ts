/**
 * Entity Parser
 *
 * Parses entity definitions from domain language.
 * All entity references are explicit (e.g., Order, User, Task).
 */

import type {
  DomainEntity,
  DomainField,
  DomainFieldDefault,
  DomainFieldItems,
  DomainFieldType,
  DomainRelationship,
  EntityPersistence,
  RelationshipType,
  ParseResult,
  ParseError,
} from '../types.js';
import { Lexer } from '../lexer.js';
import { TokenType, Token } from '../tokens.js';

interface EntityParseContext {
  errors: ParseError[];
  warnings: ParseError[];
}

/**
 * Parse an entity definition from domain text
 *
 * @example
 * parseEntity(`
 *   A Order is a customer purchase request
 *   It has:
 *     - order number: text, required, unique
 *     - amount: currency
 *     - status: Pending | Confirmed | Shipped
 *   It belongs to User
 *   It can be: Pending, Confirmed, Shipped, Delivered, Cancelled
 *   It starts as Pending
 * `)
 */
export function parseEntity(text: string): ParseResult<DomainEntity> {
  const ctx: EntityParseContext = { errors: [], warnings: [] };
  const lexer = new Lexer(text);
  const tokens = lexer.tokenize();

  let pos = 0;

  // Helper to get current token
  const current = () => tokens[pos] || { type: TokenType.EOF, value: '', line: 0, column: 0, offset: 0 };
  const peek = (offset = 0) => tokens[pos + offset] || { type: TokenType.EOF, value: '', line: 0, column: 0, offset: 0 };
  const advance = () => tokens[pos++];
  const isAtEnd = () => current().type === TokenType.EOF;
  const skip = (type: TokenType) => {
    while (current().type === type) advance();
  };

  // Skip leading whitespace
  skip(TokenType.NEWLINE);

  // Parse "A [Name] is [description]"
  const entityHeader = parseEntityHeader();
  if (!entityHeader) {
    return {
      success: false,
      errors: ctx.errors.length > 0 ? ctx.errors : [{
        message: 'Expected entity definition starting with "A [Name] is..."',
      }],
      warnings: [],
    };
  }

  const entity: DomainEntity = {
    type: 'entity',
    name: entityHeader.name,
    description: entityHeader.description,
    fields: [],
    relationships: [],
  };

  skip(TokenType.NEWLINE);

  // Parse remaining sections (fields, relationships, states)
  while (!isAtEnd()) {
    skip(TokenType.NEWLINE);
    if (isAtEnd()) break;

    const sectionResult = parseSection(entity);
    if (!sectionResult) {
      // Skip unknown content
      advance();
    }
  }

  return {
    success: true,
    data: entity,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };

  // === Helper Functions ===

  // Check if a token can be used as an entity name
  // Some keywords like "User", "Task", "Order" are valid entity names
  function isEntityName(token: Token): boolean {
    // Identifiers are always valid
    if (token.type === TokenType.IDENTIFIER) return true;

    // Certain keywords can also be entity names when capitalized
    const keywordEntityNames = [
      TokenType.USER,      // "User"
      TokenType.TEXT,      // "Text" (unlikely but possible)
      TokenType.NUMBER,    // "Number" (unlikely but possible)
      TokenType.DATE,      // "Date" (unlikely but possible)
    ];
    return keywordEntityNames.includes(token.type);
  }

  function parseEntityHeader(): { name: string; description: string } | null {
    // Expect "A" or "An"
    if (current().type !== TokenType.A && current().type !== TokenType.AN) {
      ctx.errors.push({ message: 'Expected "A" or "An" at start of entity definition' });
      return null;
    }
    advance();

    // Get entity name (identifier or keyword that can be an entity name)
    if (!isEntityName(current())) {
      ctx.errors.push({ message: 'Expected entity name after "A"' });
      return null;
    }
    const name = current().value;
    advance();

    // Expect "is"
    if (current().type !== TokenType.IS) {
      ctx.errors.push({ message: `Expected "is" after entity name "${name}"` });
      return null;
    }
    advance();

    // Collect description until newline
    const descParts: string[] = [];
    while (!isAtEnd() && current().type !== TokenType.NEWLINE) {
      descParts.push(current().value);
      advance();
    }

    return {
      name,
      description: descParts.join(' ').trim(),
    };
  }

  function parseSection(entity: DomainEntity): boolean {
    const token = current();

    // `Persistence: <value>` — Phase 0 drift fix. Mirrors
    // `Entity.persistence: EntityPersistence` on @almadar/core.
    if (token.type === TokenType.IDENTIFIER && peek(1).type === TokenType.COLON) {
      const propName = token.value.toLowerCase();
      if (propName === 'persistence') {
        advance(); advance(); // Persistence, :
        if (current().type === TokenType.IDENTIFIER) {
          const val = current().value.toLowerCase();
          if (val === 'persistent' || val === 'runtime' || val === 'singleton' || val === 'instance' || val === 'local') {
            entity.persistence = val as EntityPersistence;
            advance();
          }
        }
        return true;
      }
    }

    // INDENT followed by "- has [field] as [type]" (SKILL.md format)
    if (token.type === TokenType.INDENT) {
      advance();
      parseIndentedFields(entity);
      return true;
    }

    // "It has:" - fields section (old format)
    if (token.type === TokenType.IT) {
      advance();
      if (current().type === TokenType.HAS) {
        advance();
        skip(TokenType.COLON);
        skip(TokenType.NEWLINE);
        parseFieldsSection(entity);
        return true;
      }

      // "It belongs to [Entity]"
      if (current().type === TokenType.BELONGS) {
        advance();
        if (current().type === TokenType.TO) {
          advance();
          parseRelationship(entity, 'belongs_to');
          return true;
        }
      }

      // "It can be: [states]"
      if (current().type === TokenType.CAN) {
        advance();
        if (current().type === TokenType.BE) {
          advance();
          skip(TokenType.COLON);
          parseStates(entity);
          return true;
        }
      }

      // "It starts as [state]"
      if (current().type === TokenType.STARTS) {
        advance();
        if (current().type === TokenType.AS) {
          advance();
          parseInitialState(entity);
          return true;
        }
      }
    }

    // "has many [Entity]" - relationship
    if (token.type === TokenType.HAS) {
      advance();
      if (current().type === TokenType.MANY) {
        advance();
        parseRelationship(entity, 'has_many');
        return true;
      }
      if (current().type === TokenType.ONE) {
        advance();
        parseRelationship(entity, 'has_one');
        return true;
      }
    }

    return false;
  }

  /**
   * Parse indented field lines in SKILL.md format:
   * - has [field] as [type] (constraints)
   * - belongs to [Entity]
   * - has many [Entity]s
   */
  function parseIndentedFields(entity: DomainEntity): void {
    while (!isAtEnd() && current().type !== TokenType.DEDENT) {
      skip(TokenType.NEWLINE);
      if (current().type === TokenType.DEDENT) break;

      // Skip leading dash
      if (current().type === TokenType.DASH) {
        advance();
      }

      // "has [field] as [type]" pattern
      if (current().type === TokenType.HAS) {
        advance();

        // Check for "has many [Entity]s" pattern
        if (current().type === TokenType.MANY) {
          advance();
          parseRelationship(entity, 'has_many');
          continue;
        }

        // Parse field: "[name] as [type] (constraints)"
        const field = parseHasFieldLine();
        if (field) {
          entity.fields.push(field);
        }
        continue;
      }

      // "belongs to [Entity]" pattern
      if (current().type === TokenType.BELONGS) {
        advance();
        if (current().type === TokenType.TO) {
          advance();
          parseRelationship(entity, 'belongs_to');
          continue;
        }
      }

      // Skip unrecognized content to end of line
      while (!isAtEnd() && current().type !== TokenType.NEWLINE && current().type !== TokenType.DEDENT) {
        advance();
      }
      skip(TokenType.NEWLINE);
    }

    // Consume DEDENT
    if (current().type === TokenType.DEDENT) {
      advance();
    }
  }

  /**
   * Parse "has [field] as [type] (constraints)" pattern
   */
  function parseHasFieldLine(): DomainField | null {
    // Get field name
    if (current().type !== TokenType.IDENTIFIER) {
      return null;
    }
    const fieldName = toCamelCase(current().value);
    advance();

    // Expect "as"
    if (current().type !== TokenType.AS) {
      // Skip to end of line
      while (!isAtEnd() && current().type !== TokenType.NEWLINE && current().type !== TokenType.DEDENT) {
        advance();
      }
      return null;
    }
    advance();

    // Parse field type
    const field: DomainField = {
      type: 'field',
      name: fieldName,
      fieldType: 'text',
      required: false,
      unique: false,
      auto: false,
    };

    // Get field type (may be multiple tokens like "long text" or "yes/no")
    const typeParts: string[] = [];
    while (!isAtEnd() &&
           current().type !== TokenType.NEWLINE &&
           current().type !== TokenType.DEDENT &&
           current().type !== TokenType.LPAREN &&
           current().value !== 'with') {
      typeParts.push(current().value);
      advance();
    }
    const typeText = typeParts.join(' ').trim().toLowerCase();

    // Map type text to DomainFieldType
    if (typeText.includes('long text')) {
      field.fieldType = 'long text';
    } else if (typeText === 'text' || typeText === 'string') {
      field.fieldType = 'text';
    } else if (typeText === 'number' || typeText === 'integer') {
      field.fieldType = 'number';
    } else if (typeText === 'currency') {
      field.fieldType = 'currency';
    } else if (typeText === 'yes/no' || typeText === 'boolean') {
      field.fieldType = 'yes/no';
    } else if (typeText === 'date') {
      field.fieldType = 'date';
    } else if (typeText === 'timestamp' || typeText === 'datetime') {
      field.fieldType = 'timestamp';
    } else if (typeText.startsWith('enum')) {
      field.fieldType = 'enum';
      // Extract enum values from "enum [val1, val2, val3]"
      const enumMatch = typeText.match(/enum\s*\[([^\]]+)\]/);
      if (enumMatch) {
        field.enumValues = enumMatch[1].split(',').map(v => v.trim());
      }
    } else if (typeText === 'list' || typeText === 'array') {
      field.fieldType = 'list';
    } else if (typeText === 'object') {
      field.fieldType = 'object';
    } else {
      field.fieldType = 'text';
    }

    // Parse constraints in parentheses: (required), (optional), with default [value]
    if (current().type === TokenType.LPAREN) {
      advance();
      while (!isAtEnd() && current().type !== TokenType.RPAREN && current().type !== TokenType.NEWLINE) {
        const constraint = current().value.toLowerCase();
        if (constraint === 'required') {
          field.required = true;
        } else if (constraint === 'optional') {
          field.required = false;
        } else if (constraint === 'unique') {
          field.unique = true;
        }
        advance();
      }
      if (current().type === TokenType.RPAREN) {
        advance();
      }
    }

    // Parse "with default [value]"
    if (current().type === TokenType.IDENTIFIER && current().value.toLowerCase() === 'with') {
      advance();
      if (current().type === TokenType.DEFAULT) {
        advance();
        // Get default value
        if (current().type === TokenType.STRING) {
          field.default = current().value;
          advance();
        } else if (current().type === TokenType.NUMBER_LITERAL) {
          field.default = parseFloat(current().value);
          advance();
        } else if (current().type === TokenType.BOOLEAN) {
          field.default = current().value === 'true';
          advance();
        } else if (current().type === TokenType.IDENTIFIER) {
          field.default = current().value;
          advance();
        }
      }
    }

    return field;
  }

  function parseFieldsSection(entity: DomainEntity): void {
    // Expect INDENT
    if (current().type !== TokenType.INDENT) {
      return;
    }
    advance();

    while (!isAtEnd() && current().type !== TokenType.DEDENT) {
      skip(TokenType.NEWLINE);
      if (current().type === TokenType.DEDENT) break;

      // Parse field line: "- [name]: [type], [constraints]"
      const field = parseFieldLine();
      if (field) {
        entity.fields.push(field);
      }

      skip(TokenType.NEWLINE);
    }

    // Consume DEDENT
    if (current().type === TokenType.DEDENT) {
      advance();
    }
  }

  function parseFieldLine(): DomainField | null {
    // Optional dash
    if (current().type === TokenType.DASH) {
      advance();
    }

    // Field name (may be multiple words)
    const nameParts: string[] = [];
    while (!isAtEnd() &&
           current().type !== TokenType.COLON &&
           current().type !== TokenType.NEWLINE) {
      nameParts.push(current().value);
      advance();
    }

    if (nameParts.length === 0) {
      return null;
    }

    const fieldName = toCamelCase(nameParts.join(' '));

    // Expect colon
    if (current().type !== TokenType.COLON) {
      ctx.errors.push({ message: `Expected ":" after field name "${fieldName}"` });
      return null;
    }
    advance();

    // Parse field type and constraints
    return parseFieldTypeAndConstraints(fieldName);
  }

  function parseFieldTypeAndConstraints(fieldName: string): DomainField {
    const field: DomainField = {
      type: 'field',
      name: fieldName,
      fieldType: 'text',
      required: false,
      unique: false,
      auto: false,
    };

    const parts: string[] = [];
    while (!isAtEnd() && current().type !== TokenType.NEWLINE) {
      // Re-quote STRING tokens so empty `""` defaults survive the join.
      // Without this, the empty value gets joined-and-trimmed out of
      // existence and `default ""` becomes `default` (no payload).
      const tok = current();
      parts.push(tok.type === TokenType.STRING ? `"${tok.value}"` : tok.value);
      advance();
    }
    const content = parts.join(' ').trim();

    // Top-level segmentation by comma — type spec then constraints. This
    // ordering (vs early-returning on `|`) keeps the default clause
    // (`default "active"`) separated from the enum-value list.
    const segments = content.split(',').map(s => s.trim());
    if (segments.length === 0) return field;

    // First segment: type spec — one of:
    //   • `a | b | c`           enum values (constrains a string field)
    //   • `list of <itemType>`  list with typed items
    //   • a plain type keyword (`text`, `number`, …)
    const typeSpec = segments[0];
    if (typeSpec.includes('|')) {
      field.fieldType = 'text';
      field.enumValues = typeSpec.split('|').map(v => v.trim()).filter(v => v.length > 0);
    } else {
      const lower = typeSpec.toLowerCase();
      if (lower.startsWith('list of ')) {
        field.fieldType = 'list';
        field.items = { type: parseDomainFieldType(lower.slice('list of '.length).trim()) };
      } else {
        field.fieldType = parseDomainFieldType(lower);
      }
    }

    // Remaining segments: constraints. Preserve original casing for the
    // default value so `default "Active"` doesn't lowercase to `active`.
    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];
      const lower = segment.toLowerCase();
      if (lower === 'required') field.required = true;
      else if (lower === 'unique') field.unique = true;
      else if (lower === 'auto') field.auto = true;
      else if (lower.startsWith('default ')) {
        field.default = parseDefaultLiteral(segment.slice('default '.length).trim());
      }
    }

    return field;
  }

  /** Map a domain-syntax type keyword to `DomainFieldType`. Unknown → 'text'. */
  function parseDomainFieldType(keyword: string): DomainFieldType {
    if (keyword === 'long text') return 'long text';
    if (keyword === 'text' || keyword === 'string') return 'text';
    if (keyword === 'number' || keyword === 'integer') return 'number';
    if (keyword === 'currency') return 'currency';
    if (keyword === 'date') return 'date';
    if (keyword === 'timestamp') return 'timestamp';
    if (keyword === 'datetime') return 'datetime';
    if (keyword === 'yes/no' || keyword === 'boolean') return 'yes/no';
    if (keyword === 'list' || keyword === 'array') return 'list';
    if (keyword === 'object') return 'object';
    if (keyword === 'enum') return 'enum';
    if (keyword === 'relation') return 'relation';
    return 'text';
  }

  /**
   * Parse a `default <token>` literal. Handles quoted strings (including
   * empty `""`), structural JSON (`[]`, `{...}`), and scalars. Mirrors
   * the formatter's `formatDefaultValue` (entity-formatter.ts) so the
   * pair roundtrips byte-for-byte.
   */
  function parseDefaultLiteral(text: string): DomainFieldDefault {
    const trimmed = text.trim();
    // Quoted string (including empty `""`)
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    // Structural JSON (list / object)
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        return JSON.parse(trimmed) as DomainFieldDefault;
      } catch {
        // fall through to scalar parsing
      }
    }
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;
    if (trimmed.toLowerCase() === 'null') return null;
    const num = Number(trimmed);
    if (!Number.isNaN(num) && trimmed !== '') return num;
    return trimmed;
  }

  function parseRelationship(entity: DomainEntity, relType: RelationshipType): void {
    // Get target entity name
    if (current().type !== TokenType.IDENTIFIER) {
      return;
    }
    const targetEntity = current().value;
    advance();

    let alias: string | undefined;

    // Check for "as [Alias]"
    if (current().type === TokenType.AS) {
      advance();
      if (current().type === TokenType.IDENTIFIER) {
        alias = current().value;
        advance();
      }
    }

    entity.relationships.push({
      type: 'relationship',
      relationshipType: relType,
      targetEntity,
      alias,
    });
  }

  function parseStates(entity: DomainEntity): void {
    const states: string[] = [];

    while (!isAtEnd() && current().type !== TokenType.NEWLINE) {
      if (current().type === TokenType.IDENTIFIER) {
        states.push(current().value);
      }
      advance();
    }

    entity.states = states;
  }

  function parseInitialState(entity: DomainEntity): void {
    if (current().type === TokenType.IDENTIFIER) {
      entity.initialState = current().value;
      advance();
    }
  }
}

/**
 * Format an entity AST back to domain text
 */
export function formatEntityToDomain(entity: DomainEntity): string {
  const lines: string[] = [];

  // Header line
  const article = startsWithVowel(entity.name) ? 'An' : 'A';
  lines.push(`${article} ${entity.name} is ${entity.description}`);

  // Fields section
  if (entity.fields.length > 0) {
    lines.push('');
    lines.push('It has:');
    for (const field of entity.fields) {
      lines.push(`  - ${toSpaceSeparated(field.name)}: ${formatFieldType(field)}`);
    }
  }

  // Relationships
  for (const rel of entity.relationships) {
    lines.push('');
    if (rel.relationshipType === 'belongs_to') {
      const aliasStr = rel.alias ? ` as ${rel.alias}` : '';
      lines.push(`It belongs to ${rel.targetEntity}${aliasStr}`);
    } else if (rel.relationshipType === 'has_many') {
      lines.push(`It has many ${rel.targetEntity}`);
    } else if (rel.relationshipType === 'has_one') {
      lines.push(`It has one ${rel.targetEntity}`);
    }
  }

  // States
  if (entity.states && entity.states.length > 0) {
    lines.push('');
    lines.push(`It can be: ${entity.states.join(', ')}`);
    if (entity.initialState) {
      lines.push(`It starts as ${entity.initialState}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format entity AST to KFlow schema
 */
// eslint-disable-next-line almadar/no-record-string-unknown -- Returns loosely-typed schema for backward compatibility with both KFlowSchema and OrbitalSchema
export function formatEntityToSchema(entity: DomainEntity): Record<string, unknown> {
  // eslint-disable-next-line almadar/no-record-string-unknown -- Building loosely-typed field objects incrementally
  const fields: Record<string, unknown>[] = entity.fields.map(field => {
    // Enum-constrained fields keep the canonical type `'string'` per the
    // std schema convention; the constraint lives on `values: []` rather
    // than re-typing the field.
    const schemaType = field.enumValues && field.enumValues.length > 0
      ? mapFieldTypeToSchema(field.fieldType === 'enum' ? 'text' : field.fieldType)
      : mapFieldTypeToSchema(field.fieldType);
    // eslint-disable-next-line almadar/no-record-string-unknown -- Field object built incrementally
    const out: Record<string, unknown> = {
      name: field.name,
      type: schemaType,
    };
    if (field.required) out.required = true;
    if (field.unique) out.unique = true;
    if (field.auto) out.auto = true;
    if (field.enumValues && field.enumValues.length > 0) {
      out.values = field.enumValues; // OrbitalSchema uses `values` not `enumValues`
    }
    if (field.items) {
      out.items = { type: mapFieldTypeToSchema(field.items.type) };
    }
    // `default` may legitimately be `''` / `0` / `false` / `null` — only
    // skip the property when it's explicitly `undefined`.
    if (field.default !== undefined) {
      out.default = field.default;
    }
    return out;
  });

  // Add relationship fields
  for (const rel of entity.relationships) {
    if (rel.relationshipType === 'belongs_to') {
      const fieldName = rel.alias
        ? toCamelCase(rel.alias) + 'Id'
        : toCamelCase(rel.targetEntity) + 'Id';
      fields.push({
        name: fieldName,
        type: 'relation',
        relation: {
          entity: rel.targetEntity,
          type: 'many-to-one',
        },
      });
    }
  }

  // eslint-disable-next-line almadar/no-record-string-unknown -- Building loosely-typed entity object incrementally
  const out: Record<string, unknown> = {
    name: entity.name,
    collection: toKebabCase(entity.name) + 's',
    fields: fields.filter(f => Object.keys(f).length > 0),
  };
  if (entity.states && entity.states.length > 0) out.states = entity.states;
  if (entity.initialState !== undefined) out.initialState = entity.initialState;
  if (entity.persistence !== undefined) out.persistence = entity.persistence;
  return out;
}

// === Utility Functions ===

function toCamelCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}

function toSpaceSeparated(text: string): string {
  return text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function toKebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * Check if a word starts with a vowel SOUND (not just vowel letter)
 * Used for determining "A" vs "An" article
 */
function startsWithVowel(text: string): boolean {
  const lower = text.toLowerCase();

  // Words that start with vowel letter but consonant sound (use "A")
  // "U" pronounced as "yoo": user, unicorn, unique, universal, union, etc.
  // "Eu" pronounced as "yoo": European, eureka, etc.
  if (/^(u[^aeiou]|uni|euro)/i.test(lower)) {
    return false;
  }

  // Words that start with consonant letter but vowel sound (use "An")
  // Silent "H": hour, honest, honor, heir, etc.
  if (/^(hour|honest|honor|heir)/i.test(lower)) {
    return true;
  }

  // Default: check if first letter is a vowel
  return /^[aeiou]/i.test(text);
}

function parseValue(text: string): string | number | boolean {
  text = text.trim();
  if (text.toLowerCase() === 'true') return true;
  if (text.toLowerCase() === 'false') return false;
  const num = parseFloat(text);
  if (!isNaN(num)) return num;
  return text.replace(/^["']|["']$/g, '');
}

function formatFieldType(field: DomainField): string {
  const parts: string[] = [];

  if (field.enumValues && field.enumValues.length > 0) {
    parts.push(field.enumValues.join(' | '));
  } else {
    parts.push(field.fieldType);
  }

  if (field.required) parts.push('required');
  if (field.unique) parts.push('unique');
  if (field.auto) parts.push('auto');
  if (field.default !== undefined) {
    parts.push(`default ${field.default}`);
  }

  return parts.join(', ');
}

function mapFieldTypeToSchema(fieldType: DomainFieldType): string {
  // Use the centralized DOMAIN_TO_SCHEMA_FIELD_TYPE from types.ts
  const mapping: Record<DomainFieldType, string> = {
    'text': 'string',
    'long text': 'string',
    'number': 'number',
    'currency': 'number',
    'date': 'date',
    'timestamp': 'timestamp',
    'datetime': 'datetime',
    'yes/no': 'boolean',
    'enum': 'enum',
    'list': 'array',
    'object': 'object',
    'relation': 'relation',
  };
  return mapping[fieldType] || 'string';
}
