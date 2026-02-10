/**
 * Section Mapping
 *
 * Tracks the relationship between domain language sections and KFlow schema paths.
 * Enables bidirectional sync and conflict detection.
 */

import type { SectionMapping, SourceRange } from '../types.js';

export interface MappingStore {
  /** All tracked mappings */
  mappings: SectionMapping[];

  /** Last sync timestamp */
  lastSync: number;

  /** Schema version hash for change detection */
  schemaHash?: string;
}

/**
 * Create a new mapping store
 */
export function createMappingStore(mappings: SectionMapping[] = []): MappingStore {
  return {
    mappings,
    lastSync: Date.now(),
  };
}

/**
 * Find a mapping by section ID
 */
export function findMapping(store: MappingStore, sectionId: string): SectionMapping | undefined {
  return store.mappings.find((m) => m.sectionId === sectionId);
}

/**
 * Find a mapping by schema path
 */
export function findMappingByPath(store: MappingStore, schemaPath: string): SectionMapping | undefined {
  return store.mappings.find((m) => m.schemaPath === schemaPath);
}

/**
 * Find all mappings of a specific type
 */
export function findMappingsByType(
  store: MappingStore,
  sectionType: 'entity' | 'page' | 'behavior' | 'tick',
): SectionMapping[] {
  return store.mappings.filter((m) => m.sectionType === sectionType);
}

/**
 * Update or add a mapping
 */
export function upsertMapping(store: MappingStore, mapping: SectionMapping): MappingStore {
  const index = store.mappings.findIndex((m) => m.sectionId === mapping.sectionId);

  const newMappings = [...store.mappings];
  if (index >= 0) {
    newMappings[index] = { ...mapping, lastModified: Date.now() };
  } else {
    newMappings.push({ ...mapping, lastModified: Date.now() });
  }

  return {
    ...store,
    mappings: newMappings,
    lastSync: Date.now(),
  };
}

/**
 * Remove a mapping
 */
export function removeMapping(store: MappingStore, sectionId: string): MappingStore {
  return {
    ...store,
    mappings: store.mappings.filter((m) => m.sectionId !== sectionId),
    lastSync: Date.now(),
  };
}

/**
 * Detect changes between old and new mappings
 */
export function detectChanges(
  oldMappings: SectionMapping[],
  newMappings: SectionMapping[],
): {
  added: SectionMapping[];
  removed: SectionMapping[];
  modified: SectionMapping[];
} {
  const oldIds = new Set(oldMappings.map((m) => m.sectionId));
  const newIds = new Set(newMappings.map((m) => m.sectionId));

  const added = newMappings.filter((m) => !oldIds.has(m.sectionId));
  const removed = oldMappings.filter((m) => !newIds.has(m.sectionId));

  const modified: SectionMapping[] = [];
  for (const newMapping of newMappings) {
    const oldMapping = oldMappings.find((m) => m.sectionId === newMapping.sectionId);
    if (oldMapping && oldMapping.domainText !== newMapping.domainText) {
      modified.push(newMapping);
    }
  }

  return { added, removed, modified };
}

/**
 * Generate a unique section ID
 */
export function generateSectionId(
  sectionType: 'entity' | 'page' | 'behavior' | 'tick',
  name: string,
): string {
  return `${sectionType}_${name}`;
}

/**
 * Extract section type and name from a section ID
 */
export function parseSectionId(sectionId: string): {
  sectionType: 'entity' | 'page' | 'behavior' | 'tick';
  name: string;
} | null {
  const match = sectionId.match(/^(entity|page|behavior|tick)_(.+)$/);
  if (!match) return null;

  return {
    sectionType: match[1] as 'entity' | 'page' | 'behavior' | 'tick',
    name: match[2],
  };
}

/**
 * Get the schema path for a section
 */
export function getSchemaPath(
  sectionType: 'entity' | 'page' | 'behavior' | 'tick',
  index: number,
): string {
  switch (sectionType) {
    case 'entity':
      return `dataEntities[${index}]`;
    case 'page':
      return `ui.pages[${index}]`;
    case 'behavior':
      return `traits[${index}]`;
    case 'tick':
      return `ticks[${index}]`;
  }
}

/**
 * Update range information for a mapping based on text position
 */
export function updateMappingRange(
  mapping: SectionMapping,
  fullText: string,
): SectionMapping {
  const start = fullText.indexOf(mapping.domainText);
  if (start === -1) {
    return mapping;
  }

  const end = start + mapping.domainText.length;

  // Calculate line/column for start
  const textBefore = fullText.slice(0, start);
  const startLine = textBefore.split('\n').length;
  const lastNewline = textBefore.lastIndexOf('\n');
  const startColumn = start - lastNewline;

  // Calculate line/column for end
  const textToEnd = fullText.slice(0, end);
  const endLine = textToEnd.split('\n').length;
  const lastNewlineEnd = textToEnd.lastIndexOf('\n');
  const endColumn = end - lastNewlineEnd;

  const range: SourceRange = {
    start: {
      line: startLine,
      column: startColumn,
      offset: start,
    },
    end: {
      line: endLine,
      column: endColumn,
      offset: end,
    },
  };

  return {
    ...mapping,
    range,
  };
}

/**
 * Resolve conflicts between domain changes and schema changes
 */
export function resolveConflict(
  domainMapping: SectionMapping,
  schemaMapping: SectionMapping,
  preference: 'domain' | 'schema' | 'newest',
): SectionMapping {
  if (preference === 'domain') {
    return domainMapping;
  }

  if (preference === 'schema') {
    return schemaMapping;
  }

  // Use newest
  const domainTime = domainMapping.lastModified || 0;
  const schemaTime = schemaMapping.lastModified || 0;

  return domainTime >= schemaTime ? domainMapping : schemaMapping;
}

/**
 * Compute a simple hash of a schema for change detection
 */
export function computeSchemaHash(schema: Record<string, unknown>): string {
  const str = JSON.stringify(schema);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Check if schema has changed since last sync
 */
export function hasSchemaChanged(store: MappingStore, schema: Record<string, unknown>): boolean {
  const currentHash = computeSchemaHash(schema);
  return store.schemaHash !== currentHash;
}

/**
 * Update the schema hash in the store
 */
export function updateSchemaHash(store: MappingStore, schema: Record<string, unknown>): MappingStore {
  return {
    ...store,
    schemaHash: computeSchemaHash(schema),
    lastSync: Date.now(),
  };
}
