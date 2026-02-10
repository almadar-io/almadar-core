/**
 * Domain Language Chunk Merging
 *
 * Utilities for merging multiple domain language chunks into a single document.
 * Used by the lean skill to generate orbitals incrementally.
 *
 * @packageDocumentation
 */

export interface DomainChunk {
    /** The domain language text for this orbital */
    text: string;
    /** Optional name for this orbital (for debugging) */
    name?: string;
}

export interface MergeResult {
    /** The merged domain language text */
    text: string;
    /** Number of entities merged */
    entityCount: number;
    /** Number of pages merged */
    pageCount: number;
    /** Number of behaviors merged */
    behaviorCount: number;
}

/**
 * Extract a section from domain text by header
 */
function extractSection(text: string, header: string): string {
    const headerPattern = new RegExp(`^#\\s*${header}\\s*$`, 'im');
    const match = text.match(headerPattern);
    if (!match) return '';

    const startIndex = match.index! + match[0].length;

    // Find the next section header or end of text
    const nextHeaderMatch = text.slice(startIndex).match(/^#\s*\w+/m);
    const endIndex = nextHeaderMatch
        ? startIndex + nextHeaderMatch.index!
        : text.length;

    return text.slice(startIndex, endIndex).trim();
}

/**
 * Count items in a section (entities, pages, or behaviors)
 */
function countItems(sectionText: string, type: 'entity' | 'page' | 'behavior'): number {
    if (!sectionText) return 0;

    switch (type) {
        case 'entity':
            // Count "A/An [Name] is" patterns
            return (sectionText.match(/^A[n]?\s+\w+\s+is\s/gim) || []).length;
        case 'page':
            // Count "[Name] at /" or "The [Name] shows" patterns
            return (sectionText.match(/^(The\s+)?\w+\s+(at\s+\/|shows\s)/gim) || []).length;
        case 'behavior':
            // Count "[Name] behavior:" patterns
            return (sectionText.match(/^\w+(\s+\w+)*\s+behavior:/gim) || []).length;
    }
}

/**
 * Merge multiple domain language chunks into a single document.
 *
 * Each chunk can contain:
 * - `# Entities` section with entity definitions
 * - `# Pages` section with page definitions
 * - `# Behaviors` section with behavior/trait definitions
 *
 * The merge combines all sections, maintaining the standard order:
 * 1. Entities
 * 2. Pages
 * 3. Behaviors
 *
 * @example
 * ```typescript
 * const chunks = [
 *   { text: '# Entities\n\nA Task is...', name: 'Task' },
 *   { text: '# Entities\n\nA User is...', name: 'User' },
 * ];
 * const result = mergeDomainChunks(chunks);
 * // result.text contains both entities merged
 * ```
 */
export function mergeDomainChunks(chunks: DomainChunk[]): MergeResult {
    const entities: string[] = [];
    const pages: string[] = [];
    const behaviors: string[] = [];

    for (const chunk of chunks) {
        const entitySection = extractSection(chunk.text, 'Entities');
        const pageSection = extractSection(chunk.text, 'Pages');
        const behaviorSection = extractSection(chunk.text, 'Behaviors');

        if (entitySection) entities.push(entitySection);
        if (pageSection) pages.push(pageSection);
        if (behaviorSection) behaviors.push(behaviorSection);
    }

    const sections: string[] = [];

    if (entities.length > 0) {
        sections.push(`# Entities\n\n${entities.join('\n\n---\n\n')}`);
    }

    if (pages.length > 0) {
        sections.push(`# Pages\n\n${pages.join('\n\n---\n\n')}`);
    }

    if (behaviors.length > 0) {
        sections.push(`# Behaviors\n\n${behaviors.join('\n\n---\n\n')}`);
    }

    const mergedText = sections.join('\n\n');

    // Count items for reporting
    const allEntities = entities.join('\n\n');
    const allPages = pages.join('\n\n');
    const allBehaviors = behaviors.join('\n\n');

    return {
        text: mergedText,
        entityCount: countItems(allEntities, 'entity'),
        pageCount: countItems(allPages, 'page'),
        behaviorCount: countItems(allBehaviors, 'behavior'),
    };
}

/**
 * Validate that a domain chunk has the expected structure.
 * Returns errors if the chunk is malformed.
 */
export function validateDomainChunk(chunk: DomainChunk): string[] {
    const errors: string[] = [];

    if (!chunk.text || chunk.text.trim().length === 0) {
        errors.push('Chunk text is empty');
        return errors;
    }

    // Check for at least one section
    const hasEntities = /^#\s*Entities/im.test(chunk.text);
    const hasPages = /^#\s*Pages/im.test(chunk.text);
    const hasBehaviors = /^#\s*Behaviors/im.test(chunk.text);

    if (!hasEntities && !hasPages && !hasBehaviors) {
        errors.push('Chunk must have at least one section: # Entities, # Pages, or # Behaviors');
    }

    return errors;
}

/**
 * Format a merged result as a summary string
 */
export function formatMergeSummary(result: MergeResult): string {
    const parts: string[] = [];
    if (result.entityCount > 0) parts.push(`${result.entityCount} entities`);
    if (result.pageCount > 0) parts.push(`${result.pageCount} pages`);
    if (result.behaviorCount > 0) parts.push(`${result.behaviorCount} behaviors`);
    return parts.join(', ') || 'empty';
}
