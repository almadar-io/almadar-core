/**
 * Page Parser
 *
 * Parses page definitions from domain language.
 */

import type {
  DomainPage,
  DomainPageSection,
  DomainPageAction,
  ParseResult,
  ParseError,
} from '../types.js';
import { Lexer } from '../lexer.js';
import { TokenType } from '../tokens.js';

interface PageParseContext {
  errors: ParseError[];
  warnings: ParseError[];
}

/**
 * Parse a page definition from domain text
 *
 * @example
 * parsePage(`
 *   The Dashboard shows an overview of system activity
 *   Purpose: Help users monitor their tasks and orders
 *   URL: /dashboard
 *
 *   It displays:
 *     - Summary statistics for today
 *     - Recent orders list
 *     - Pending tasks requiring attention
 *
 *   Users can:
 *     - Click a task to view details
 *     - Filter orders by status
 * `)
 */
export function parsePage(text: string): ParseResult<DomainPage> {
  const ctx: PageParseContext = { errors: [], warnings: [] };
  const lexer = new Lexer(text);
  const tokens = lexer.tokenize();

  let pos = 0;

  // Helper functions
  const current = () => tokens[pos] || { type: TokenType.EOF, value: '', line: 0, column: 0, offset: 0 };
  const advance = () => tokens[pos++];
  const isAtEnd = () => current().type === TokenType.EOF;
  const skip = (type: TokenType) => {
    while (current().type === type) advance();
  };

  // Skip leading whitespace
  skip(TokenType.NEWLINE);

  // Parse "The [PageName] shows [description]"
  const pageHeader = parsePageHeader();
  if (!pageHeader) {
    return {
      success: false,
      errors: ctx.errors.length > 0 ? ctx.errors : [{
        message: 'Expected page definition starting with "The [PageName] shows..."',
      }],
      warnings: [],
    };
  }

  const page: DomainPage = {
    type: 'page',
    name: pageHeader.name,
    description: pageHeader.description,
    purpose: '',
    url: pageHeader.url || '',
    primaryEntity: pageHeader.primaryEntity,
    traitName: pageHeader.traitName,
    sections: [],
    actions: [],
  };

  skip(TokenType.NEWLINE);

  // Parse remaining sections
  while (!isAtEnd()) {
    skip(TokenType.NEWLINE);
    if (isAtEnd()) break;

    const parsed = parsePageSection(page);
    if (!parsed) {
      advance();
    }
  }

  // Generate URL if not provided
  if (!page.url) {
    page.url = '/' + toKebabCase(page.name.replace(/Page$/i, ''));
  }

  return {
    success: true,
    data: page,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };

  // === Helper Functions ===

  function parsePageHeader(): { name: string; description: string; url?: string; primaryEntity?: string; traitName?: string } | null {
    // Check for alternative format: "[PageName] at /[path]:"
    if (current().type === TokenType.IDENTIFIER) {
      const firstToken = current().value;
      advance();

      // Check if next token is "at" or more identifiers followed by "at"
      const nameParts: string[] = [firstToken];
      while (current().type === TokenType.IDENTIFIER && current().value.toLowerCase() !== 'at') {
        nameParts.push(current().value);
        advance();
      }

      // Check for "at" keyword (which is just an identifier)
      if (current().type === TokenType.IDENTIFIER && current().value.toLowerCase() === 'at') {
        advance();

        // Collect URL path
        const pathParts: string[] = [];
        while (!isAtEnd() && current().type !== TokenType.COLON && current().type !== TokenType.NEWLINE) {
          pathParts.push(current().value);
          advance();
        }
        const url = pathParts.join('');

        // Skip colon
        if (current().type === TokenType.COLON) {
          advance();
        }

        // Normalize page name - preserve PascalCase
        let name = nameParts.map(p => toPascalCase(p)).join('');
        if (!name.toLowerCase().endsWith('page')) {
          name += 'Page';
        }

        // Parse the page body for additional info
        skip(TokenType.NEWLINE);
        let primaryEntity: string | undefined;
        let traitName: string | undefined;

        // Parse indented lines for "shows", "view type", "is initial page"
        if (current().type === TokenType.INDENT) {
          advance();
          while (!isAtEnd() && current().type !== TokenType.DEDENT) {
            skip(TokenType.NEWLINE);
            if (current().type === TokenType.DEDENT) break;

            // Skip dash
            if (current().type === TokenType.DASH) {
              advance();
            }

            // Check for "shows [Entity] using [Trait]"
            if (current().type === TokenType.SHOWS) {
              advance();
              if (current().type === TokenType.IDENTIFIER) {
                primaryEntity = current().value;
                advance();
              }
              // Check for "using [TraitName]"
              if (current().type === TokenType.IDENTIFIER && current().value.toLowerCase() === 'using') {
                advance();
                if (current().type === TokenType.IDENTIFIER) {
                  traitName = current().value;
                  advance();
                }
              }
            }

            // Skip to end of line
            while (!isAtEnd() && current().type !== TokenType.NEWLINE && current().type !== TokenType.DEDENT) {
              advance();
            }
            skip(TokenType.NEWLINE);
          }
          if (current().type === TokenType.DEDENT) {
            advance();
          }
        }

        return {
          name,
          description: `Page at ${url}`,
          url,
          primaryEntity,
          traitName,
        };
      }

      // Reset position if not "at" format - rewind not possible with current design
      // Fall through to old format check
    }

    // Original format: "The [PageName] shows [description]"
    // Expect "The"
    if (current().type !== TokenType.THE) {
      ctx.errors.push({ message: 'Expected "The" at start of page definition' });
      return null;
    }
    advance();

    // Get page name (may be multiple identifiers like "Task List Page")
    const nameParts: string[] = [];
    while (current().type === TokenType.IDENTIFIER) {
      nameParts.push(current().value);
      advance();
    }

    if (nameParts.length === 0) {
      ctx.errors.push({ message: 'Expected page name after "The"' });
      return null;
    }

    // Normalize page name - preserve PascalCase
    let name = nameParts.map(p => toPascalCase(p)).join('');
    if (!name.toLowerCase().endsWith('page')) {
      name += 'Page';
    }

    // Expect "shows"
    if (current().type !== TokenType.SHOWS) {
      ctx.errors.push({ message: `Expected "shows" after page name "${name}"` });
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

  function parsePageSection(page: DomainPage): boolean {
    const token = current();

    // "Entity: [EntityName]" - EXPLICIT entity reference (no inference!)
    if (token.type === TokenType.ENTITY) {
      advance();
      skip(TokenType.COLON);
      page.primaryEntity = collectUntilNewline();
      return true;
    }

    // "Purpose: [text]"
    if (token.type === TokenType.PURPOSE) {
      advance();
      skip(TokenType.COLON);
      page.purpose = collectUntilNewline();
      return true;
    }

    // "URL: [path]"
    if (token.type === TokenType.URL) {
      advance();
      skip(TokenType.COLON);
      page.url = collectUntilNewline();
      return true;
    }

    // "It displays:" - sections
    if (token.type === TokenType.IT) {
      advance();
      if (current().type === TokenType.DISPLAYS) {
        advance();
        skip(TokenType.COLON);
        skip(TokenType.NEWLINE);
        parseDisplaysSection(page);
        return true;
      }
    }

    // "Users can:" or "Users" - actions
    if (token.type === TokenType.USERS) {
      advance();
      if (current().type === TokenType.CAN) {
        advance();
        skip(TokenType.COLON);
        skip(TokenType.NEWLINE);
        parseActionsSection(page);
        return true;
      }
    }

    // "When accessed:" - onAccess
    if (token.type === TokenType.WHEN) {
      advance();
      if (current().type === TokenType.ACCESSED) {
        advance();
        skip(TokenType.COLON);
        page.onAccess = collectUntilNewline();
        return true;
      }
    }

    return false;
  }

  function parseDisplaysSection(page: DomainPage): void {
    // Expect INDENT
    if (current().type !== TokenType.INDENT) {
      return;
    }
    advance();

    while (!isAtEnd() && current().type !== TokenType.DEDENT) {
      skip(TokenType.NEWLINE);
      if (current().type === TokenType.DEDENT) break;

      // Parse section line: "- [description]"
      const section = parseSectionLine();
      if (section) {
        page.sections.push(section);
      }

      skip(TokenType.NEWLINE);
    }

    // Consume DEDENT
    if (current().type === TokenType.DEDENT) {
      advance();
    }
  }

  function parseSectionLine(): DomainPageSection | null {
    // Optional dash
    if (current().type === TokenType.DASH) {
      advance();
    }

    const description = collectUntilNewline();
    if (!description) {
      return null;
    }

    return {
      type: 'page_section',
      description,
    };
  }

  function parseActionsSection(page: DomainPage): void {
    // Expect INDENT
    if (current().type !== TokenType.INDENT) {
      return;
    }
    advance();

    while (!isAtEnd() && current().type !== TokenType.DEDENT) {
      skip(TokenType.NEWLINE);
      if (current().type === TokenType.DEDENT) break;

      // Parse action line: "- [trigger] to [action]"
      const action = parseActionLine();
      if (action) {
        page.actions.push(action);
      }

      skip(TokenType.NEWLINE);
    }

    // Consume DEDENT
    if (current().type === TokenType.DEDENT) {
      advance();
    }
  }

  function parseActionLine(): DomainPageAction | null {
    // Optional dash
    if (current().type === TokenType.DASH) {
      advance();
    }

    const fullText = collectUntilNewline();
    if (!fullText) {
      return null;
    }

    // Split on " to " to separate trigger and action
    const toIndex = fullText.toLowerCase().indexOf(' to ');
    if (toIndex === -1) {
      // No "to" found, treat whole thing as trigger
      return {
        type: 'page_action',
        trigger: fullText,
        action: '',
      };
    }

    return {
      type: 'page_action',
      trigger: fullText.slice(0, toIndex).trim(),
      action: fullText.slice(toIndex + 4).trim(),
    };
  }

  function collectUntilNewline(): string {
    const parts: string[] = [];
    while (!isAtEnd() && current().type !== TokenType.NEWLINE) {
      parts.push(current().value);
      advance();
    }
    return parts.join(' ').trim();
  }
}

/**
 * Format a page AST back to domain text
 */
export function formatPageToDomain(page: DomainPage): string {
  const lines: string[] = [];

  // Header line
  const displayName = page.name.replace(/Page$/, '');
  lines.push(`The ${displayName} shows ${page.description}`);

  // Entity - EXPLICIT reference (no inference on parse!)
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

  // On access
  if (page.onAccess) {
    lines.push('');
    lines.push(`When accessed: ${page.onAccess}`);
  }

  return lines.join('\n');
}

/**
 * Format page AST to KFlow schema
 */
export function formatPageToSchema(page: DomainPage): Record<string, unknown> {
  // Infer viewType from page name (this is acceptable - it's a display hint, not critical data)
  const viewType = inferViewTypeFromPageName(page.name);

  // Use EXPLICIT primaryEntity from domain text - NO INFERENCE!
  const primaryEntity = page.primaryEntity;

  return {
    name: page.name,
    path: page.url.startsWith('/') ? page.url : `/${page.url}`,
    purpose: page.purpose || page.description,
    sections: page.sections.map((section, index) => {
      const pattern = inferPatternFromDescription(section.description);
      const patternConfig = inferPatternConfigFromDescription(section.description, page.primaryEntity);

      return {
        id: `section-${index}`,
        purpose: section.description,
        order: index,
        estimatedSize: 'medium',
        pattern: {
          type: pattern,
          ...patternConfig,
        },
      };
    }),
    traits: [],
    primaryEntity,
    viewType,
    isInitial: page.url === '/' || page.url === '/dashboard',
  };
}

/**
 * Infer view type from page name
 */
function inferViewTypeFromPageName(name: string): string {
  const lower = name.toLowerCase();

  if (lower.includes('list') || lower.includes('index')) {
    return 'list';
  }
  if (lower.includes('detail') || lower.includes('view')) {
    return 'detail';
  }
  if (lower.includes('create') || lower.includes('new')) {
    return 'create';
  }
  if (lower.includes('edit')) {
    return 'edit';
  }
  if (lower.includes('dashboard')) {
    return 'dashboard';
  }

  return 'list';
}

/**
 * Get pattern config from description, using explicit entity when available
 * IMPORTANT: Use primaryEntity from explicit "Entity:" line when available.
 * Pattern detection from description is acceptable (e.g., "list" → entity-list pattern)
 * but entity association MUST come from explicit data.
 */
function inferPatternConfigFromDescription(description: string, primaryEntity?: string): Record<string, unknown> {
  const lower = description.toLowerCase();

  // Use explicit entity when available, otherwise use a placeholder
  // The placeholder indicates the schema needs explicit entity data
  const entityName = primaryEntity || 'Item';

  // Header pattern - doesn't need entity
  if (lower.includes('header') || lower.includes('title')) {
    const titleMatch = description.match(/title\s*["']?([^"']+)["']?/i) ||
                      description.match(/["']([^"']+)["']/);
    return {
      title: titleMatch ? titleMatch[1] : 'Page Title',
    };
  }

  // Entity list pattern
  if (lower.includes('list') || lower.includes('table')) {
    return {
      entity: entityName,
      fieldNames: ['id', 'name', 'createdAt'],
    };
  }

  // Entity detail pattern
  if (lower.includes('detail')) {
    return {
      entity: entityName,
      fieldNames: ['id', 'name', 'description', 'createdAt'],
    };
  }

  // Form pattern
  if (lower.includes('form')) {
    return {
      entity: entityName,
      fields: [
        { field: 'name', label: 'Name', type: 'text', required: true },
        { field: 'description', label: 'Description', type: 'textarea' },
      ],
    };
  }

  // Stats/statistics/summary patterns
  if (lower.includes('stats') || lower.includes('statistics') ||
      lower.includes('summary') || lower.includes('overview')) {
    return {
      entity: entityName,
      fieldNames: ['id', 'name', 'value'],
    };
  }

  // Default: entity-list needs entity and fieldNames
  return {
    entity: entityName,
    fieldNames: ['id', 'name', 'createdAt'],
  };
}

// === Utility Functions ===

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convert text to PascalCase, preserving existing PascalCase words.
 * "notesPage" → "NotesPage"
 * "NotesPage" → "NotesPage" (preserved)
 * "notes page" → "NotesPage"
 */
function toPascalCase(text: string): string {
  // If already PascalCase (starts with uppercase, has lowercase), preserve it
  if (/^[A-Z][a-zA-Z]*$/.test(text)) {
    return text;
  }
  // If it's all lowercase or has spaces, convert to PascalCase
  if (text.includes(' ')) {
    return text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  }
  // Single word - capitalize first letter, preserve rest
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toKebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Infer a section pattern from its natural language description
 * Valid pattern types: page-header, title-only, entity-list, entity-table, entity-detail, form-section
 */
function inferPatternFromDescription(description: string): string {
  const lower = description.toLowerCase();

  // Header patterns - check FIRST to prevent "Header with title Details" being matched as detail
  if (lower.includes('header')) {
    return 'page-header';
  }

  // List patterns
  if (lower.includes('list') || lower.includes('table')) {
    return 'entity-list';
  }

  // Statistics/dashboard - map to entity-list for now
  if (lower.includes('statistics') || lower.includes('stats') ||
      lower.includes('summary') || lower.includes('overview')) {
    return 'entity-list';
  }

  // Form patterns
  if (lower.includes('form') || lower.includes('input') || lower.includes('edit')) {
    return 'form-section';
  }

  // Detail patterns
  if (lower.includes('detail') || lower.includes('view')) {
    return 'entity-detail';
  }

  // Chart patterns - map to entity-list for now
  if (lower.includes('chart') || lower.includes('graph')) {
    return 'entity-list';
  }

  // Timeline - map to entity-list for now
  if (lower.includes('timeline') || lower.includes('history') || lower.includes('activity')) {
    return 'entity-list';
  }

  // Title-only patterns (without "header" keyword)
  if (lower.includes('title')) {
    return 'page-header';
  }

  // Default to entity-list
  return 'entity-list';
}
