/**
 * Entity Formatter
 *
 * Converts KFlow DataEntity schema to domain language text.
 */

import type { DomainEntity, DomainField, DomainFieldType, DomainRelationship } from '../types.js';

/**
 * Convert a KFlow DataEntity to domain language text
 */
export function formatSchemaEntityToDomain(entity: Record<string, unknown>): string {
  const domainEntity = schemaEntityToDomainEntity(entity);
  return formatEntityText(domainEntity);
}

/**
 * Convert KFlow DataEntity to DomainEntity AST
 */
export function schemaEntityToDomainEntity(entity: Record<string, unknown>): DomainEntity {
  const name = entity.name as string;
  const description = (entity.description as string) || `a ${name.toLowerCase()}`;
  const fields: DomainField[] = [];
  const relationships: DomainRelationship[] = [];

  // Process fields
  const schemaFields = (entity.fields as Array<Record<string, unknown>>) || [];
  for (const field of schemaFields) {
    const fieldName = field.name as string;
    const fieldType = field.type as string;

    // Handle relation fields separately
    if (fieldType === 'relation') {
      const relation = field.relation as Record<string, unknown>;
      if (relation) {
        const relType = relation.type as string;
        const targetEntity = relation.entity as string;

        if (relType === 'many-to-one') {
          // Extract alias from field name (e.g., assigneeId -> Assignee)
          let alias: string | undefined;
          if (fieldName.endsWith('Id') && !fieldName.toLowerCase().startsWith(targetEntity.toLowerCase())) {
            alias = fieldName.slice(0, -2); // Remove "Id" suffix
            alias = alias.charAt(0).toUpperCase() + alias.slice(1);
          }

          relationships.push({
            type: 'relationship',
            relationshipType: 'belongs_to',
            targetEntity,
            alias,
          });
        } else if (relType === 'one-to-many') {
          relationships.push({
            type: 'relationship',
            relationshipType: 'has_many',
            targetEntity,
          });
        } else if (relType === 'one-to-one') {
          relationships.push({
            type: 'relationship',
            relationshipType: 'has_one',
            targetEntity,
          });
        }
      }
      continue;
    }

    // Map schema field type to domain field type
    const domainFieldType = mapSchemaTypeToDomain(fieldType);

    const domainField: DomainField = {
      type: 'field',
      name: fieldName,
      fieldType: domainFieldType,
      required: (field.required as boolean) || false,
      unique: (field.unique as boolean) || false,
      auto: (field.auto as boolean) || false,
    };

    // Handle enum values - check both 'enumValues' and 'values' properties
    if (fieldType === 'enum') {
      const enumValues = (field.enumValues || field.values) as string[] | undefined;
      if (enumValues && enumValues.length > 0) {
        domainField.enumValues = enumValues;
      }
    }

    // Handle default value
    if (field.default !== undefined) {
      domainField.default = field.default;
    }

    fields.push(domainField);
  }

  // Extract states from entity if present
  const states = entity.states as string[] | undefined;
  const initialState = entity.initialState as string | undefined;

  return {
    type: 'entity',
    name,
    description,
    fields,
    relationships,
    states,
    initialState,
  };
}

/**
 * Format DomainEntity AST to domain language text
 */
function formatEntityText(entity: DomainEntity): string {
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
 * Map KFlow schema field type to domain field type
 * Uses the centralized FIELD_TYPE_MAPPING from types.ts
 */
function mapSchemaTypeToDomain(schemaType: string): DomainFieldType {
  const mapping: Record<string, DomainFieldType> = {
    'string': 'text',
    'number': 'number',
    'boolean': 'yes/no',
    'date': 'date',
    'timestamp': 'timestamp',
    'datetime': 'datetime',
    'enum': 'enum',
    'array': 'list',
    'object': 'object',
    'relation': 'relation',
  };
  return mapping[schemaType] || 'text';
}

/**
 * Format a field's type and constraints for display
 */
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
    const defaultStr = typeof field.default === 'string'
      ? `"${field.default}"`
      : String(field.default);
    parts.push(`default ${defaultStr}`);
  }

  return parts.join(', ');
}

/**
 * Convert camelCase to space-separated words
 */
function toSpaceSeparated(text: string): string {
  return text.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
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
