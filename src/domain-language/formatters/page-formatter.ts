/**
 * Page Formatter
 *
 * Converts KFlow Page schema to domain language text.
 */

import type { DomainPage, DomainPageSection, DomainPageAction } from '../types.js';

/**
 * Convert a KFlow Page schema to domain language text
 */
export function formatSchemaPageToDomain(page: Record<string, unknown>): string {
  const domainPage = schemaPageToDomainPage(page);
  return formatPageText(domainPage);
}

/**
 * Convert KFlow Page schema to DomainPage AST
 */
export function schemaPageToDomainPage(page: Record<string, unknown>): DomainPage {
  const name = page.name as string;
  const path = (page.path as string) || '';
  const purpose = (page.purpose as string) || (page.description as string) || '';
  const primaryEntity = page.primaryEntity as string | undefined;

  // Extract description from purpose or title or generate from name
  const title = page.title as string;
  const viewType = page.viewType as string;
  const description = title || purpose || viewType || generateDescriptionFromName(name);

  // Convert sections - can come from 'sections' array or 'traits' array
  const sections: DomainPageSection[] = [];
  const schemaSections = (page.sections as Array<Record<string, unknown>>) || [];
  const schemaTraits = (page.traits as Array<string | Record<string, unknown>>) || [];

  // Process legacy sections
  for (const section of schemaSections) {
    const rawPattern = section.pattern;
    let pattern: string;
    let config: Record<string, unknown> = {};

    if (typeof rawPattern === 'string') {
      pattern = rawPattern;
      config = (section.config as Record<string, unknown>) || {};
    } else if (rawPattern && typeof rawPattern === 'object') {
      const patternObj = rawPattern as Record<string, unknown>;
      pattern = (patternObj.type as string) || 'custom-section';
      const { type, ...restConfig } = patternObj;
      config = restConfig;
    } else {
      pattern = 'custom-section';
    }

    const sectionDescription = generateSectionDescription(pattern, config);
    sections.push({
      type: 'page_section',
      description: sectionDescription,
    });
  }

  // Process traits as sections (OrbitalSchema format)
  for (const trait of schemaTraits) {
    let traitName: string;
    let linkedEntity: string | undefined;

    if (typeof trait === 'string') {
      traitName = trait;
    } else {
      traitName = (trait.ref as string) || (trait.name as string) || 'Unknown';
      linkedEntity = trait.linkedEntity as string;
    }

    // Generate description from trait name
    const traitDescription = linkedEntity
      ? `${formatTraitName(traitName)} for ${linkedEntity}`
      : formatTraitName(traitName);

    sections.push({
      type: 'page_section',
      description: traitDescription,
    });
  }

  // Convert actions
  const actions: DomainPageAction[] = [];
  const schemaActions = (page.actions as Array<Record<string, unknown>>) || [];

  for (const action of schemaActions) {
    actions.push({
      type: 'page_action',
      trigger: (action.trigger as string) || '',
      action: (action.action as string) || '',
    });
  }

  return {
    type: 'page',
    name,
    description,
    purpose,
    url: path,
    primaryEntity,
    sections,
    actions,
  };
}

/**
 * Format trait name to human readable
 */
function formatTraitName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}

/**
 * Format DomainPage AST to domain language text
 */
function formatPageText(page: DomainPage): string {
  const lines: string[] = [];

  // Header line
  const displayName = page.name.replace(/Page$/, '');
  lines.push(`The ${displayName} shows ${page.description}`);

  // Entity - EXPLICIT reference, no inference needed on parse
  if (page.primaryEntity) {
    lines.push(`Entity: ${page.primaryEntity}`);
  }

  // Purpose
  if (page.purpose) {
    lines.push(`Purpose: ${page.purpose}`);
  }

  // URL
  if (page.url) {
    lines.push(`URL: ${page.url}`);
  }

  // Sections
  if (page.sections.length > 0) {
    lines.push('');
    lines.push('It displays:');
    for (const section of page.sections) {
      lines.push(`  - ${section.description}`);
    }
  }

  // Actions
  if (page.actions.length > 0) {
    lines.push('');
    lines.push('Users can:');
    for (const action of page.actions) {
      if (action.action) {
        lines.push(`  - ${action.trigger} to ${action.action}`);
      } else {
        lines.push(`  - ${action.trigger}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate a description from a page name
 */
function generateDescriptionFromName(name: string): string {
  // Remove "Page" suffix and convert to readable text
  const baseName = name.replace(/Page$/, '');

  // Handle common patterns
  if (baseName.endsWith('List')) {
    const entity = baseName.slice(0, -4);
    return `a list of ${pluralize(entity.toLowerCase())}`;
  }

  if (baseName.endsWith('Detail') || baseName.endsWith('Details')) {
    const entity = baseName.replace(/Details?$/, '');
    return `details for a ${entity.toLowerCase()}`;
  }

  if (baseName.startsWith('Create') || baseName.startsWith('New')) {
    const entity = baseName.replace(/^(Create|New)/, '');
    return `a form to create a new ${entity.toLowerCase()}`;
  }

  if (baseName.startsWith('Edit')) {
    const entity = baseName.replace(/^Edit/, '');
    return `a form to edit ${entity ? `a ${entity.toLowerCase()}` : 'content'}`;
  }

  if (baseName === 'Dashboard') {
    return 'an overview of system activity';
  }

  if (baseName === 'Settings') {
    return 'user settings and preferences';
  }

  if (baseName === 'Login') {
    return 'the login form';
  }

  if (baseName === 'Register' || baseName === 'Signup') {
    return 'the registration form';
  }

  // Default: just format the name
  return toSpaceSeparated(baseName).toLowerCase();
}

/**
 * Generate a human-readable description from a section pattern and config
 */
function generateSectionDescription(pattern: string, config: Record<string, unknown>): string {
  switch (pattern) {
    case 'page-header':
      const title = config.title as string;
      return title ? `Header with title "${title}"` : 'Page header';

    case 'entity-list':
      const entity = config.entity as string;
      const presentation = config.presentation as string;
      if (entity) {
        const presentationType = presentation === 'cards' ? 'cards' : 'table';
        return `${entity} list displayed as ${presentationType}`;
      }
      return 'List of items';

    case 'entity-detail':
      const detailEntity = config.entity as string;
      return detailEntity ? `${detailEntity} details` : 'Item details';

    case 'form-section':
      const formEntity = config.entity as string;
      const mode = config.mode as string;
      if (formEntity) {
        return mode === 'edit'
          ? `Form to edit ${formEntity}`
          : `Form to create ${formEntity}`;
      }
      return 'Data entry form';

    case 'dashboard-stats':
      return 'Summary statistics';

    case 'chart-section':
      const chartType = config.chartType as string;
      const chartTitle = config.title as string;
      return chartTitle
        ? `${chartTitle} (${chartType || 'chart'})`
        : `${chartType || 'Chart'} visualization`;

    case 'timeline-section':
      return 'Activity timeline';

    case 'profile-section':
      return 'Profile information';

    case 'custom-section':
      const customDesc = config.description as string;
      return customDesc || 'Custom content section';

    default:
      // Try to generate from pattern name
      const readable = pattern.replace(/-/g, ' ');
      return readable.charAt(0).toUpperCase() + readable.slice(1);
  }
}

/**
 * Convert camelCase/PascalCase to space-separated words
 */
function toSpaceSeparated(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}

/**
 * Simple pluralization
 */
function pluralize(word: string): string {
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es';
  }
  if (word.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(word[word.length - 2])) {
    return word.slice(0, -1) + 'ies';
  }
  return word + 's';
}
