/**
 * Schema to Domain Converter
 *
 * Converts a complete OrbitalSchema to domain language text.
 * Generates three sections: Entities, Pages, and Behaviors.
 * 
 * Updated to read from OrbitalSchema where entities, pages, and traits
 * are grouped into Orbital units. Also supports legacy KFlowSchema format
 * for backward compatibility.
 */

import type { DomainDocument, SectionMapping } from '../types.js';
import { formatSchemaEntityToDomain, schemaEntityToDomainEntity } from '../formatters/entity-formatter.js';
import { formatSchemaPageToDomain, schemaPageToDomainPage } from '../formatters/page-formatter.js';
import { formatSchemaTraitToDomain, schemaTraitToDomainBehavior } from '../formatters/behavior-formatter.js';
import { formatSExprToDomain, formatSExprGuardToDomain, isArraySExpr } from '../formatters/sexpr-formatter.js';
import type {
  OrbitalSchema,
  Entity,
  Page,
  Trait,
  TraitRef,
  EntityRef,
  PageRef,
} from '../../types/index.js';
import {
  isOrbitalDefinition,
  getTraitName,
  isEntityReference,
  isPageReferenceString,
  isPageReferenceObject,
} from '../../types/index.js';

/**
 * Get entity name safely from EntityRef (string or inline Entity)
 */
function getEntityName(entity: EntityRef): string {
  if (isEntityReference(entity)) {
    return entity.replace('.entity', '');
  }
  return entity.name;
}

/**
 * Get page name safely from PageRef (string, object reference, or inline Page)
 */
function getPageName(page: PageRef): string {
  if (isPageReferenceString(page)) {
    const parts = page.split('.');
    return parts[parts.length - 1];
  }
  if (isPageReferenceObject(page)) {
    const parts = page.ref.split('.');
    return parts[parts.length - 1];
  }
  return page.name;
}

/**
 * Check if entity is an inline definition (not a reference)
 */
function isInlineEntity(entity: EntityRef): entity is Entity {
  return !isEntityReference(entity);
}

/**
 * Check if page is an inline definition (not a reference)
 */
function isInlinePage(page: PageRef): page is Page {
  return !isPageReferenceString(page) && !isPageReferenceObject(page);
}

export interface SchemaToDomainResult {
  /** The complete domain text document */
  domainText: string;

  /** Parsed AST representation */
  document: DomainDocument;

  /** Mapping of sections to schema paths */
  mappings: SectionMapping[];

  /** Separate section texts for individual editing */
  sections: {
    entities: string[];
    pages: string[];
    behaviors: string[];
  };
}

/**
 * Legacy KFlowSchema format (for backward compatibility)
 */
interface LegacyKFlowSchema {
  name?: string;
  dataEntities?: Array<Record<string, unknown>>;
  ui?: { pages?: Array<Record<string, unknown>> };
  traits?: Array<Record<string, unknown>>;
  ticks?: Array<Record<string, unknown>>;
}

/**
 * Combined input type for the converter
 */
type SchemaInput = OrbitalSchema | LegacyKFlowSchema;

/**
 * Check if schema is in legacy format
 */
function isLegacySchema(schema: SchemaInput): schema is LegacyKFlowSchema {
  return 'dataEntities' in schema || ('ui' in schema && !('orbitals' in schema));
}

/**
 * Convert a complete OrbitalSchema or legacy KFlowSchema to domain language
 */
export function convertSchemaToDomain(schema: SchemaInput): SchemaToDomainResult {
  // Handle legacy format
  if (isLegacySchema(schema)) {
    return convertLegacySchemaToDomain(schema);
  }

  // Handle new OrbitalSchema format
  return convertOrbitalSchemaToDomain(schema);
}

/**
 * Convert legacy KFlowSchema to domain language
 */
function convertLegacySchemaToDomain(schema: LegacyKFlowSchema): SchemaToDomainResult {
  const document: DomainDocument = {
    type: 'document',
    entities: [],
    pages: [],
    behaviors: [],
  };

  const mappings: SectionMapping[] = [];
  const sections = {
    entities: [] as string[],
    pages: [] as string[],
    behaviors: [] as string[],
  };

  // Convert entities
  const dataEntities = schema.dataEntities || [];
  for (let i = 0; i < dataEntities.length; i++) {
    const entity = dataEntities[i];
    const domainText = formatSchemaEntityToDomain(entity);
    const domainEntity = schemaEntityToDomainEntity(entity);

    document.entities.push(domainEntity);
    sections.entities.push(domainText);

    mappings.push({
      sectionId: `entity_${entity.name}`,
      sectionType: 'entity',
      schemaPath: `dataEntities[${i}]`,
      domainText,
    });
  }

  // Convert pages
  const pages = schema.ui?.pages || [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const domainText = formatSchemaPageToDomain(page);
    const domainPage = schemaPageToDomainPage(page);

    document.pages.push(domainPage);
    sections.pages.push(domainText);

    mappings.push({
      sectionId: `page_${page.name}`,
      sectionType: 'page',
      schemaPath: `ui.pages[${i}]`,
      domainText,
    });
  }

  // Convert traits/behaviors
  const traits = schema.traits || [];
  for (let i = 0; i < traits.length; i++) {
    const trait = traits[i];
    const domainText = formatSchemaTraitToDomain(trait);
    const domainBehavior = schemaTraitToDomainBehavior(trait);

    document.behaviors.push(domainBehavior);
    sections.behaviors.push(domainText);

    mappings.push({
      sectionId: `behavior_${trait.name}`,
      sectionType: 'behavior',
      schemaPath: `traits[${i}]`,
      domainText,
    });
  }

  // Convert ticks to behaviors
  const ticks = schema.ticks || [];
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    const tickBehavior = formatTickToDomain(tick);

    sections.behaviors.push(tickBehavior);

    mappings.push({
      sectionId: `tick_${tick.id || tick.name}`,
      sectionType: 'tick',
      schemaPath: `ticks[${i}]`,
      domainText: tickBehavior,
    });
  }

  // Build complete document text
  const domainText = buildDomainDocument(sections);

  return {
    domainText,
    document,
    mappings,
    sections,
  };
}

/**
 * Convert OrbitalSchema to domain language
 */
function convertOrbitalSchemaToDomain(schema: OrbitalSchema): SchemaToDomainResult {
  const document: DomainDocument = {
    type: 'document',
    entities: [],
    pages: [],
    behaviors: [],
  };

  const mappings: SectionMapping[] = [];
  const sections = {
    entities: [] as string[],
    pages: [] as string[],
    behaviors: [] as string[],
  };

  // Extract from orbitals
  for (let orbitalIndex = 0; orbitalIndex < schema.orbitals.length; orbitalIndex++) {
    const orbital = schema.orbitals[orbitalIndex];

    // Skip orbital references - they don't have inline definitions
    if (!isOrbitalDefinition(orbital)) {
      continue;
    }

    // Convert entity (only if inline definition, not a reference)
    const entity = orbital.entity;
    if (isInlineEntity(entity)) {
      const entityRecord = entity as unknown as Record<string, unknown>;
      const domainText = formatSchemaEntityToDomain(entityRecord);
      const domainEntity = schemaEntityToDomainEntity(entityRecord);

      document.entities.push(domainEntity);
      sections.entities.push(domainText);

      mappings.push({
        sectionId: `entity_${entity.name}`,
        sectionType: 'entity',
        schemaPath: `orbitals[${orbitalIndex}].entity`,
        domainText,
      });
    }

    // Convert pages from this orbital (only inline definitions, not references)
    for (let pageIndex = 0; pageIndex < orbital.pages.length; pageIndex++) {
      const page = orbital.pages[pageIndex];

      // Skip page references - only convert inline page definitions
      if (!isInlinePage(page)) {
        continue;
      }

      const pageRecord = page as unknown as Record<string, unknown>;
      const pageDomainText = formatSchemaPageToDomain(pageRecord);
      const domainPage = schemaPageToDomainPage(pageRecord);

      document.pages.push(domainPage);
      sections.pages.push(pageDomainText);

      mappings.push({
        sectionId: `page_${page.name}`,
        sectionType: 'page',
        schemaPath: `orbitals[${orbitalIndex}].pages[${pageIndex}]`,
        domainText: pageDomainText,
      });
    }

    // Convert traits attached to this orbital (inline definitions)
    const orbitalTraits = orbital.traits || [];
    for (let traitIndex = 0; traitIndex < orbitalTraits.length; traitIndex++) {
      const traitEntry = orbitalTraits[traitIndex];

      // Traits are defined inline with full stateMachine objects
      // Check if this is an inline trait definition (has name and optionally stateMachine)
      const inlineTrait = traitEntry as unknown as Record<string, unknown>;
      const traitName = (inlineTrait.name as string) || getTraitName(traitEntry);

      // Skip if it's just a reference without inline definition (e.g., { ref: "SomeTrait" } without stateMachine)
      if (!inlineTrait.name && !inlineTrait.stateMachine) {
        continue;
      }

      // Use the inline trait definition, pass entity name for context
      const entityName = getEntityName(entity);
      const traitDomainText = formatSchemaTraitToDomain(inlineTrait, entityName);
      const domainBehavior = schemaTraitToDomainBehavior(inlineTrait, entityName);

      document.behaviors.push(domainBehavior);
      sections.behaviors.push(traitDomainText);

      mappings.push({
        sectionId: `behavior_${traitName}`,
        sectionType: 'behavior',
        schemaPath: `orbitals[${orbitalIndex}].traits[${traitIndex}]`,
        domainText: traitDomainText,
      });
    }
  }

  // Note: OrbitalSchema no longer has top-level traits
  // All traits are now defined within orbital.traits

  // Build complete document text
  const domainText = buildDomainDocument(sections);

  return {
    domainText,
    document,
    mappings,
    sections,
  };
}

/**
 * Format a tick to domain language
 */
function formatTickToDomain(tick: Record<string, unknown>): string {
  const lines: string[] = [];

  // Support both 'name' and 'id' for tick identifier
  const tickName = (tick.name as string) || (tick.id as string) || 'unnamed';
  const intervalValue = tick.interval;

  // Format interval - can be a number (ms) or object { ms: number }
  let intervalStr = 'every hour';
  if (typeof intervalValue === 'number') {
    // Direct milliseconds
    intervalStr = formatIntervalMs(intervalValue);
  } else if (intervalValue && typeof intervalValue === 'object') {
    const interval = intervalValue as Record<string, unknown>;
    if (interval.ms) {
      intervalStr = formatIntervalMs(interval.ms as number);
    } else if (interval.frames) {
      intervalStr = formatIntervalMs((interval.frames as number) * 1000);
    }
  }

  lines.push(`Every ${intervalStr}:`);

  // Guard - can be a string, S-expression, or object { condition: string | SExpr }
  if (tick.guard) {
    // Check for S-expression guard
    if (isArraySExpr(tick.guard)) {
      lines.push(`  ${formatSExprGuardToDomain(tick.guard)}`);
    } else if (typeof tick.guard === 'string') {
      lines.push(`  if ${tick.guard}`);
    } else {
      const guardObj = tick.guard as Record<string, unknown>;
      const condition = guardObj.condition;
      // Check if condition is S-expression
      if (isArraySExpr(condition)) {
        lines.push(`  ${formatSExprGuardToDomain(condition)}`);
      } else {
        lines.push(`  if ${condition}`);
      }
    }
  }

  // Effects - can be typed effects or S-expressions
  const effects = (tick.effects as Array<Record<string, unknown> | unknown[]>) || [];
  for (const effect of effects) {
    // Check for S-expression effect
    if (isArraySExpr(effect)) {
      const desc = formatSExprToDomain(effect);
      lines.push(`  - ${desc}`);
    } else {
      const effectObj = effect as unknown as Record<string, unknown>;
      const type = effectObj.type as string;
      const config = (effectObj.config as Record<string, unknown>) || {};
      const desc = formatEffectDescription(type, config);
      lines.push(`  - ${desc}`);
    }
  }

  return lines.join('\n');
}

/**
 * Convert just the entities section
 */
export function convertEntitiesToDomain(entities: Entity[]): string {
  return entities.map(e => formatSchemaEntityToDomain(e as unknown as Record<string, unknown>)).join('\n\n---\n\n');
}

/**
 * Convert just the pages section
 */
export function convertPagesToDomain(pages: Page[]): string {
  return pages.map(p => formatSchemaPageToDomain(p as unknown as Record<string, unknown>)).join('\n\n---\n\n');
}

/**
 * Convert just the traits/behaviors section
 */
export function convertTraitsToDomain(traits: Trait[]): string {
  return traits.map(t => formatSchemaTraitToDomain(t as unknown as Record<string, unknown>)).join('\n\n---\n\n');
}

/**
 * Build the complete domain document from sections
 */
function buildDomainDocument(sections: { entities: string[]; pages: string[]; behaviors: string[] }): string {
  const parts: string[] = [];

  if (sections.entities.length > 0) {
    parts.push('# Entities\n');
    parts.push(sections.entities.join('\n\n---\n\n'));
  }

  if (sections.pages.length > 0) {
    parts.push('\n\n# Pages\n');
    parts.push(sections.pages.join('\n\n---\n\n'));
  }

  if (sections.behaviors.length > 0) {
    parts.push('\n\n# Behaviors\n');
    parts.push(sections.behaviors.join('\n\n---\n\n'));
  }

  return parts.join('');
}

/**
 * Format interval in milliseconds to human readable
 */
export function formatIntervalMs(ms: number): string {
  const seconds = ms / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 1 && days === Math.floor(days)) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (hours >= 1 && hours === Math.floor(hours)) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (minutes >= 1 && minutes === Math.floor(minutes)) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

/**
 * Format an effect to human readable description
 */
export function formatEffectDescription(type: string, config: Record<string, unknown>): string {
  switch (type) {
    case 'notify':
      const message = config.message as string;
      const recipient = config.recipient as string;
      if (recipient) {
        return message ? `notify ${recipient} "${message}"` : `notify ${recipient}`;
      }
      return message ? `notify "${message}"` : 'send notification';

    case 'update_field':
      return `update ${config.field} to ${config.value}`;

    case 'navigate':
      return `navigate to ${config.path}`;

    case 'emit_event':
      const event = (config.eventKey || config.event) as string;
      return `emit ${event}`;

    case 'api_call':
      return `call ${config.endpoint}`;

    case 'persist_data':
      const dataAction = config.dataAction as string || 'save';
      const entity = config.entity as string;
      return entity ? `persist ${dataAction} ${entity}` : `persist ${dataAction}`;

    case 'send_in_app':
      const userId = config.userId as string;
      const title = config.title as string;
      const inAppMessage = config.message as string;
      const msgType = config.type as string || 'info';
      return `send_in_app to ${userId} title "${title}" message "${inAppMessage}" type ${msgType}`;

    default:
      // For unknown effect types, serialize the config as JSON
      if (Object.keys(config).length > 0) {
        return `${type}:${JSON.stringify(config)}`;
      }
      return `${type} action`;
  }
}
