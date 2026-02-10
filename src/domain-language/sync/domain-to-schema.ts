/**
 * Domain to Schema Converter
 *
 * Applies domain language text changes to an OrbitalSchema.
 * Supports incremental updates (single section) and full replacement.
 * 
 * Updated to use OrbitalSchema where entities, pages, and traits
 * are grouped into Orbital units instead of flat arrays.
 */

import type { DomainDocument, ParseError, SectionMapping } from '../types.js';
import { parseEntity, formatEntityToSchema } from '../parsers/entity-parser.js';
import { parsePage, formatPageToSchema } from '../parsers/page-parser.js';
import { parseBehavior, formatBehaviorToSchema } from '../parsers/behavior-parser.js';
import { parseDomainEffect } from '../parsers/sexpr-parser.js';
import type {
  OrbitalSchema,
  Orbital,
  OrbitalDefinition,
  Entity,
  Page,
  TraitRef,
  Trait,
} from '../../types/index.js';
import { isOrbitalDefinition, getTraitName, isEntityReference, isPageReferenceString, isPageReferenceObject, EntityRef, PageRef } from '../../types/index.js';

/**
 * Helper to get entity name from EntityRef (handles string references)
 */
function getEntityName(entity: EntityRef): string {
  if (isEntityReference(entity)) {
    // Reference format: "Alias.entity" - extract alias
    return entity.replace('.entity', '');
  }
  return entity.name;
}

/**
 * Helper to get page name from PageRef
 */
function getPageName(page: PageRef): string {
  if (isPageReferenceString(page)) {
    // "Alias.pages.PageName" -> "PageName"
    const parts = page.split('.');
    return parts[parts.length - 1];
  }
  if (isPageReferenceObject(page)) {
    const parts = page.ref.split('.');
    return parts[parts.length - 1];
  }
  return page.name;
}

export interface DomainToSchemaResult {
  /** Whether the conversion was successful */
  success: boolean;

  /** The updated schema */
  schema: OrbitalSchema;

  /** Any parse errors encountered */
  errors: ParseError[];

  /** Warnings (non-fatal issues) */
  warnings: ParseError[];

  /** Updated section mappings */
  mappings: SectionMapping[];
}

/**
 * Parse a complete domain document and convert to OrbitalSchema
 */
export function convertDomainToSchema(domainText: string, baseSchema?: OrbitalSchema): DomainToSchemaResult {
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];
  const mappings: SectionMapping[] = [];

  // Start with base schema or empty
  // Note: OrbitalSchema no longer has top-level traits - they are inside orbitals
  const schema: OrbitalSchema = baseSchema ? {
    ...baseSchema,
    orbitals: [...(baseSchema.orbitals || [])],
  } : {
    name: 'Application',
    orbitals: [],
  };

  // Split document into sections
  const sections = splitDomainDocument(domainText);

  // Parse entities, pages, and behaviors
  const parsedEntities: Array<{ name: string; entity: Entity; text: string }> = [];
  const parsedPages: Array<{ name: string; page: Page; forEntity?: string; text: string }> = [];
  const parsedTraits: Array<{ name: string; trait: Trait; forEntity?: string; text: string }> = [];
  const parsedTicks: Array<Record<string, unknown>> = [];

  // Parse entities
  for (const text of sections.entities) {
    const result = parseEntity(text);
    if (result.success && result.data) {
      const entityRecord = formatEntityToSchema(result.data);
      const entity: Entity = {
        name: entityRecord.name as string,
        fields: (entityRecord.fields || []) as Entity['fields'],
        persistence: 'persistent',
      };
      parsedEntities.push({
        name: result.data.name,
        entity,
        text,
      });
    } else {
      errors.push(...result.errors);
    }
    warnings.push(...result.warnings);
  }

  // Parse pages
  for (const text of sections.pages) {
    const result = parsePage(text);
    if (result.success && result.data) {
      const pageRecord = formatPageToSchema(result.data);
      const page: Page = {
        name: pageRecord.name as string,
        path: (pageRecord.path || '/') as string,
        primaryEntity: pageRecord.primaryEntity as string | undefined,
      };

      // Add trait reference if specified in domain text
      if (result.data.traitName) {
        page.traits = [{
          ref: result.data.traitName,
          linkedEntity: result.data.primaryEntity,
        }];
      }

      // Use EXPLICIT primaryEntity from domain text - NO INFERENCE!
      // If primaryEntity is not specified, page becomes orphaned (not attached to orbital)
      const forEntity = result.data.primaryEntity || page.primaryEntity;
      parsedPages.push({
        name: result.data.name,
        page,
        forEntity,
        text,
      });
    } else {
      errors.push(...result.errors);
    }
    warnings.push(...result.warnings);
  }

  // Parse behaviors/traits
  for (const text of sections.behaviors) {
    // Check if it's a tick (starts with "Every")
    if (text.trim().toLowerCase().startsWith('every')) {
      const tick = parseTickFromDomain(text);
      if (tick) {
        parsedTicks.push(tick);
      }
      continue;
    }

    // Parse as behavior/trait
    const result = parseBehavior(text, '');
    if (result.success && result.data) {
      const traitRecord = formatBehaviorToSchema(result.data);
      const trait: Trait = {
        name: traitRecord.name as string,
        stateMachine: traitRecord.stateMachine as Trait['stateMachine'],
      };
      // Use explicit "Entity: X" from behavior syntax if present
      // Behaviors without explicit entity go to schema level (assigned via page references or name matching)
      const forEntity = result.data.entityName || undefined;
      parsedTraits.push({
        name: result.data.name,
        trait,
        forEntity,
        text,
      });
    } else {
      errors.push(...result.errors);
    }
    warnings.push(...result.warnings);
  }

  // Log what was parsed
  console.log(`[DomainToSchema] Parsed: ${parsedEntities.length} entities, ${parsedPages.length} pages, ${parsedTraits.length} traits`);
  if (parsedEntities.length > 0) {
    console.log(`[DomainToSchema] Entities: ${parsedEntities.map(e => e.name).join(', ')}`);
  }
  if (parsedTraits.length > 0) {
    console.log(`[DomainToSchema] Traits: ${parsedTraits.map(t => t.name).join(', ')}`);
  }

  // Build a map of trait names to their linked entities from page trait references
  // This connects traits to orbitals via the pages that use them
  const traitToEntityMap = new Map<string, string>();
  for (const { page } of parsedPages) {
    if (page.traits && page.primaryEntity) {
      for (const traitRef of page.traits) {
        // PageTraitRef is always an object with ref property
        if (traitRef.ref) {
          // Use linkedEntity if specified, otherwise use page's primaryEntity
          const linkedEntity = traitRef.linkedEntity || page.primaryEntity;
          if (linkedEntity) {
            traitToEntityMap.set(traitRef.ref.toLowerCase(), linkedEntity);
          }
        }
      }
    }
  }

  // Log traitToEntityMap for debugging
  if (traitToEntityMap.size > 0) {
    console.log(`[DomainToSchema] Page trait references: ${Array.from(traitToEntityMap.entries()).map(([t, e]) => `${t}→${e}`).join(', ')}`);
  } else {
    console.log(`[DomainToSchema] No page trait references found (pages may be missing primaryEntity or traits)`);
  }

  // Group into Orbitals - each entity becomes an Orbital
  const orbitals: OrbitalDefinition[] = [];

  for (let i = 0; i < parsedEntities.length; i++) {
    const { name, entity, text } = parsedEntities[i];

    // Find pages for this entity
    const entityPages = parsedPages
      .filter(p => p.forEntity === name || p.page.primaryEntity === name)
      .map(p => p.page);

    // Find traits for this entity using CONCRETE strategies only:
    // 1. Explicit forEntity from "Entity: X" syntax in behavior definition
    // 2. Page trait references via "shows Entity using Trait" syntax
    // NO name-based inference - all associations must be explicit
    const entityTraits: TraitRef[] = parsedTraits
      .filter(t => {
        const traitNameLower = t.name.toLowerCase();

        // Strategy 1: Explicit forEntity from "Entity: X" syntax
        if (t.forEntity === name) {
          console.log(`[DomainToSchema] ✓ Trait "${t.name}" → Entity "${name}" (explicit Entity: syntax)`);
          return true;
        }

        // Strategy 2: Check if trait is linked to this entity via page trait references
        // This uses "shows Entity using Trait" syntax in page definitions
        const linkedEntity = traitToEntityMap.get(traitNameLower);
        if (linkedEntity === name) {
          console.log(`[DomainToSchema] ✓ Trait "${t.name}" → Entity "${name}" (page trait reference)`);
          return true;
        }

        return false;
      })
      .map(t => t.trait.name); // TraitRef can be just a string

    const orbital: OrbitalDefinition = {
      name,
      entity,
      traits: entityTraits,
      pages: entityPages,
    };

    orbitals.push(orbital);

    // Add mapping for entity
    mappings.push({
      sectionId: `entity_${name}`,
      sectionType: 'entity',
      schemaPath: `orbitals[${i}].entity`,
      domainText: text,
    });
  }

  // Add mappings for pages and traits
  for (const { name, forEntity, text } of parsedPages) {
    const orbitalIndex = parsedEntities.findIndex(e => e.name === forEntity);
    const pageIndex = orbitalIndex >= 0
      ? orbitals[orbitalIndex].pages.findIndex(p => getPageName(p) === name)
      : -1;

    mappings.push({
      sectionId: `page_${name}`,
      sectionType: 'page',
      schemaPath: orbitalIndex >= 0 && pageIndex >= 0
        ? `orbitals[${orbitalIndex}].pages[${pageIndex}]`
        : `orphanedPages`,
      domainText: text,
    });
  }

  for (const { name, forEntity, text } of parsedTraits) {
    const orbitalIndex = parsedEntities.findIndex(e => e.name === forEntity);
    const traitIndex = orbitalIndex >= 0
      ? orbitals[orbitalIndex].traits.findIndex(t => getTraitName(t) === name)
      : -1;

    mappings.push({
      sectionId: `behavior_${name}`,
      sectionType: 'behavior',
      schemaPath: orbitalIndex >= 0 && traitIndex >= 0
        ? `orbitals[${orbitalIndex}].traits[${traitIndex}]`
        : `traits`,
      domainText: text,
    });
  }

  // Collect all trait names that were assigned to orbitals
  const assignedTraitNames = new Set<string>();
  for (const orbital of orbitals) {
    for (const traitRef of orbital.traits) {
      const traitName = getTraitName(traitRef);
      assignedTraitNames.add(traitName.toLowerCase());
    }
  }

  // Note: OrbitalSchema no longer has top-level traits.
  // Traits are now inline in orbitals. Each orbital's traits array can contain
  // either trait references (strings) or inline trait definitions.
  // The traits are already assigned to orbitals via assignedTraitNames above.

  // Log for debugging
  console.log(`[DomainToSchema] ${parsedTraits.length} traits parsed, ${assignedTraitNames.size} assigned to orbitals`);
  for (const orbital of orbitals) {
    if (orbital.traits.length > 0) {
      console.log(`[DomainToSchema] Orbital ${orbital.name}: ${orbital.traits.length} traits - ${orbital.traits.join(', ')}`);
    }
  }

  schema.orbitals = orbitals;

  return {
    success: errors.length === 0,
    schema,
    errors,
    warnings,
    mappings,
  };
}

/**
 * Apply a single section update to an OrbitalSchema
 */
export function applySectionUpdate(
  schema: OrbitalSchema,
  sectionType: 'entity' | 'page' | 'behavior' | 'tick',
  sectionId: string,
  newDomainText: string,
): DomainToSchemaResult {
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];
  const updatedSchema: OrbitalSchema = JSON.parse(JSON.stringify(schema));

  // Extract the name from sectionId (e.g., "entity_Order" -> "Order")
  const name = sectionId.replace(/^(entity|page|behavior|tick)_/, '');

  switch (sectionType) {
    case 'entity': {
      const result = parseEntity(newDomainText);
      if (result.success && result.data) {
        const entityRecord = formatEntityToSchema(result.data);
        const entity: Entity = {
          name: entityRecord.name as string,
          fields: (entityRecord.fields || []) as Entity['fields'],
          persistence: 'persistent',
        };

        // Find and update existing orbital or create new
        const orbitalIndex = updatedSchema.orbitals.findIndex(
          o => isOrbitalDefinition(o) && getEntityName(o.entity) === name
        );

        if (orbitalIndex >= 0) {
          const orbital = updatedSchema.orbitals[orbitalIndex] as OrbitalDefinition;
          orbital.entity = entity;
        } else {
          // Create new orbital for this entity
          updatedSchema.orbitals.push({
            name: result.data.name,
            entity,
            traits: [],
            pages: [],
          });
        }
      } else {
        errors.push(...result.errors);
      }
      warnings.push(...result.warnings);
      break;
    }

    case 'page': {
      const result = parsePage(newDomainText);
      if (result.success && result.data) {
        const pageRecord = formatPageToSchema(result.data);
        const page: Page = {
          name: pageRecord.name as string,
          path: (pageRecord.path || '/') as string,
          primaryEntity: pageRecord.primaryEntity as string | undefined,
        };

        // Find orbital that contains this page or matches primary entity
        for (const orbital of updatedSchema.orbitals) {
          if (!isOrbitalDefinition(orbital)) continue;

          const pageIndex = orbital.pages.findIndex(p => getPageName(p) === name);
          if (pageIndex >= 0) {
            orbital.pages[pageIndex] = page;
            break;
          }

          // Add to matching entity's orbital
          if (page.primaryEntity && getEntityName(orbital.entity) === page.primaryEntity) {
            orbital.pages.push(page);
            break;
          }
        }
      } else {
        errors.push(...result.errors);
      }
      warnings.push(...result.warnings);
      break;
    }

    case 'behavior': {
      const result = parseBehavior(newDomainText, '');
      if (result.success && result.data) {
        const traitRecord = formatBehaviorToSchema(result.data);
        const trait: Trait = {
          name: traitRecord.name as string,
          stateMachine: traitRecord.stateMachine as Trait['stateMachine'],
        };
        const traitRef: TraitRef = trait.name; // Simple string ref

        // NO INFERENCE! Traits without explicit entity reference go to schema level.
        // First, try to find existing trait by name in any orbital or schema-level
        let found = false;

        // Check if trait already exists in an orbital (update in place)
        for (const orbital of updatedSchema.orbitals) {
          if (!isOrbitalDefinition(orbital)) continue;
          const traitIndex = orbital.traits.findIndex(t => getTraitName(t) === name);
          if (traitIndex >= 0) {
            orbital.traits[traitIndex] = traitRef;
            found = true;
            break;
          }
        }

        // If not found in orbitals, add to the first orbital
        // OrbitalSchema no longer has top-level traits - traits must be in orbitals
        if (!found) {
          // Find first orbital definition and add the trait there
          const firstOrbital = updatedSchema.orbitals.find(o => isOrbitalDefinition(o));
          if (firstOrbital && isOrbitalDefinition(firstOrbital)) {
            firstOrbital.traits.push(traitRef);
          } else {
            errors.push({ message: `No orbital found to attach trait "${name}" to` });
          }
        }
      } else {
        errors.push(...result.errors);
      }
      warnings.push(...result.warnings);
      break;
    }

    case 'tick': {
      // Ticks are converted to trait ticks - add as schema-level trait
      const tick = parseTickFromDomain(newDomainText);
      if (tick) {
        warnings.push({ message: 'Tick conversion to traits is not fully implemented' });
      } else {
        errors.push({ message: 'Failed to parse tick from domain text' });
      }
      break;
    }
  }

  return {
    success: errors.length === 0,
    schema: updatedSchema,
    errors,
    warnings,
    mappings: [],
  };
}

/**
 * Delete a section from the schema
 */
export function deleteSection(
  schema: OrbitalSchema,
  sectionType: 'entity' | 'page' | 'behavior' | 'tick',
  sectionId: string,
): OrbitalSchema {
  const updatedSchema: OrbitalSchema = JSON.parse(JSON.stringify(schema));

  // Extract the name from sectionId
  const name = sectionId.replace(/^(entity|page|behavior|tick)_/, '');

  switch (sectionType) {
    case 'entity': {
      // Remove the entire orbital containing this entity
      updatedSchema.orbitals = updatedSchema.orbitals.filter(
        o => !isOrbitalDefinition(o) || getEntityName(o.entity) !== name
      );
      break;
    }

    case 'page': {
      // Remove page from its orbital
      for (const orbital of updatedSchema.orbitals) {
        if (!isOrbitalDefinition(orbital)) continue;
        orbital.pages = orbital.pages.filter(p => getPageName(p) !== name);
      }
      break;
    }

    case 'behavior': {
      // Remove trait reference from orbitals
      // OrbitalSchema no longer has top-level traits - all traits are in orbitals
      for (const orbital of updatedSchema.orbitals) {
        if (!isOrbitalDefinition(orbital)) continue;
        orbital.traits = orbital.traits.filter(t => getTraitName(t) !== name);
      }
      break;
    }

    case 'tick': {
      // Ticks would be in schema.traits - not fully implemented
      break;
    }
  }

  return updatedSchema;
}

/**
 * Split a domain document into its component sections
 */
function splitDomainDocument(text: string): { entities: string[]; pages: string[]; behaviors: string[] } {
  const result = {
    entities: [] as string[],
    pages: [] as string[],
    behaviors: [] as string[],
  };

  // Split by major headers
  const normalizedText = text.replace(/\r\n/g, '\n');

  // Find section boundaries
  let currentSection: 'entities' | 'pages' | 'behaviors' | null = null;
  let currentContent: string[] = [];

  const lines = normalizedText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    // Check for section headers
    if (trimmed === '# entities' || trimmed === '#entities') {
      flushSection();
      currentSection = 'entities';
      continue;
    }
    if (trimmed === '# pages' || trimmed === '#pages') {
      flushSection();
      currentSection = 'pages';
      continue;
    }
    if (trimmed === '# behaviors' || trimmed === '#behaviors' ||
      trimmed === '# traits' || trimmed === '#traits') {
      flushSection();
      currentSection = 'behaviors';
      continue;
    }

    // Add line to current content
    currentContent.push(line);
  }

  // Flush final section
  flushSection();

  // If no headers were found, try to auto-detect sections
  if (result.entities.length === 0 && result.pages.length === 0 && result.behaviors.length === 0) {
    return autoDetectSections(normalizedText);
  }

  return result;

  function flushSection() {
    if (!currentSection || currentContent.length === 0) {
      currentContent = [];
      return;
    }

    const content = currentContent.join('\n').trim();
    if (content) {
      // Split by --- separator first
      let items = content.split(/\n---\n/).map((s) => s.trim()).filter((s) => s);

      // For entities section, also split by "A/An [Name] is" patterns
      // This handles cases where LLM doesn't use --- separators
      if (currentSection === 'entities') {
        items = splitEntitiesByPattern(items);
      }
      // For pages section, split by "[Name] at /" patterns
      else if (currentSection === 'pages') {
        items = splitPagesByPattern(items);
      }
      // For behaviors section, split by "[Name] behavior:" patterns
      else if (currentSection === 'behaviors') {
        items = splitBehaviorsByPattern(items);
      }

      result[currentSection].push(...items);
    }

    currentContent = [];
  }
}

/**
 * Split entity content by "A/An [Name] is" patterns
 */
function splitEntitiesByPattern(items: string[]): string[] {
  const result: string[] = [];

  for (const item of items) {
    // Check if this item contains multiple entities
    const lines = item.split('\n');
    let currentEntity: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Check for entity definition start: "A X is" or "An X is"
      if (/^an?\s+\w+\s+is\s/i.test(trimmed) && currentEntity.length > 0) {
        // Flush previous entity
        result.push(currentEntity.join('\n').trim());
        currentEntity = [line];
      } else {
        currentEntity.push(line);
      }
    }

    // Flush last entity
    if (currentEntity.length > 0) {
      result.push(currentEntity.join('\n').trim());
    }
  }

  return result.filter(s => s);
}

/**
 * Split page content by "[Name] at /" patterns
 */
function splitPagesByPattern(items: string[]): string[] {
  const result: string[] = [];

  for (const item of items) {
    const lines = item.split('\n');
    let currentPage: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Check for page definition start: "[Name] at /path" or "[Name]Page at /path"
      if (/^\w+(?:page)?\s+at\s+\//i.test(trimmed) && currentPage.length > 0) {
        // Flush previous page
        result.push(currentPage.join('\n').trim());
        currentPage = [line];
      } else {
        currentPage.push(line);
      }
    }

    // Flush last page
    if (currentPage.length > 0) {
      result.push(currentPage.join('\n').trim());
    }
  }

  return result.filter(s => s);
}

/**
 * Split behavior content by "[Name] behavior:" patterns
 */
function splitBehaviorsByPattern(items: string[]): string[] {
  const result: string[] = [];

  for (const item of items) {
    const lines = item.split('\n');
    let currentBehavior: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Check for behavior definition start: "[Name] behavior:" or "Every X"
      if ((/^\w+\s+behavior:?$/i.test(trimmed) || /^every\s+/i.test(trimmed)) && currentBehavior.length > 0) {
        // Flush previous behavior
        result.push(currentBehavior.join('\n').trim());
        currentBehavior = [line];
      } else {
        currentBehavior.push(line);
      }
    }

    // Flush last behavior
    if (currentBehavior.length > 0) {
      result.push(currentBehavior.join('\n').trim());
    }
  }

  return result.filter(s => s);
}

/**
 * Auto-detect sections when no headers are present
 */
function autoDetectSections(text: string): { entities: string[]; pages: string[]; behaviors: string[] } {
  const result = {
    entities: [] as string[],
    pages: [] as string[],
    behaviors: [] as string[],
  };

  // Split by --- separator
  const sections = text.split(/\n---\n/).map((s) => s.trim()).filter((s) => s);

  for (const section of sections) {
    const firstLine = section.split('\n')[0].toLowerCase();

    // Entity: starts with "A" or "An"
    if (firstLine.match(/^an?\s+\w+\s+is/)) {
      result.entities.push(section);
    }
    // Page: starts with "The"
    else if (firstLine.match(/^the\s+\w+.*shows/)) {
      result.pages.push(section);
    }
    // Tick: starts with "Every"
    else if (firstLine.match(/^every\s+/)) {
      result.behaviors.push(section);
    }
    // Behavior: Has "States:" or "Transitions:"
    else if (section.toLowerCase().includes('states:') ||
      section.toLowerCase().includes('transitions:')) {
      result.behaviors.push(section);
    }
    // Default: try to detect based on content
    else if (section.toLowerCase().includes('it has:')) {
      result.entities.push(section);
    }
    else if (section.toLowerCase().includes('it displays:')) {
      result.pages.push(section);
    }
    else {
      // Unknown section - try as entity
      result.entities.push(section);
    }
  }

  return result;
}

/**
 * Parse a tick from domain text
 */
function parseTickFromDomain(text: string): Record<string, unknown> | null {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim();

  // Parse "Every [interval]:"
  const intervalMatch = firstLine.match(/^every\s+(.+?):?$/i);
  if (!intervalMatch) return null;

  const intervalStr = intervalMatch[1];
  const intervalMs = parseIntervalToMs(intervalStr);

  // Convert interval to PascalCase name
  const tickName = intervalStr
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  const tick: Record<string, unknown> = {
    name: tickName,
    interval: intervalMs,
    effects: [] as Array<unknown[]>,  // S-Expression arrays
  };

  // Parse remaining lines for guard and effects
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.toLowerCase().startsWith('if ')) {
      tick.guard = line.slice(3).trim();
    } else if (line.startsWith('-')) {
      const effectText = line.slice(1).trim();
      const effect = parseEffectFromText(effectText);
      if (effect) {
        (tick.effects as Array<unknown[]>).push(effect);
      }
    }
  }

  return tick;
}

/**
 * Parse an interval string to milliseconds
 */
function parseIntervalToMs(text: string): number {
  const lower = text.toLowerCase();

  const match = lower.match(/(\d+)\s*(second|minute|hour|day|week)s?/);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'second': return value * 1000;
      case 'minute': return value * 60 * 1000;
      case 'hour': return value * 60 * 60 * 1000;
      case 'day': return value * 24 * 60 * 60 * 1000;
      case 'week': return value * 7 * 24 * 60 * 60 * 1000;
    }
  }

  // Default to 1 hour
  return 60 * 60 * 1000;
}

/**
 * Parse an effect from text description to S-Expression format.
 * Delegates to the existing parseDomainEffect function from sexpr-parser.
 */
function parseEffectFromText(text: string): unknown[] | null {
  try {
    const result = parseDomainEffect(text);
    // parseDomainEffect returns SExpr which can be a primitive or array
    // We only want arrays for effects
    if (Array.isArray(result)) {
      return result;
    }
    // If it returned a primitive, wrap in array or return null
    return null;
  } catch {
    return null;
  }
}

