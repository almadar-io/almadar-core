/**
 * Schema Diffing & Protection
 *
 * Pure functions for comparing OrbitalSchema objects, detecting destructive changes,
 * and categorizing removals. No I/O — operates on in-memory schema objects.
 */

import type { OrbitalSchema } from './types/schema.js';
import type {
  SchemaChange,
  ChangeSetDocument,
  CategorizedRemovals,
  PageContentReduction,
} from './types/changeset.js';

// ============================================================================
// Schema Diffing
// ============================================================================

/**
 * Diff two OrbitalSchema objects and produce a list of changes.
 * Compares orbitals, entities, traits, pages, services, and top-level fields.
 */
export function diffSchemas(
  before: OrbitalSchema,
  after: OrbitalSchema,
): { changes: SchemaChange[] } {
  const changes: SchemaChange[] = [];
  let changeId = 0;
  const nextId = () => `change-${++changeId}`;

  // Compare top-level fields
  if (before.name !== after.name) {
    changes.push({
      id: nextId(),
      operation: 'modify',
      target: 'schema',
      path: ['name'],
      before: before.name,
      after: after.name,
      description: `Renamed schema from "${before.name}" to "${after.name}"`,
    });
  }

  if (before.description !== after.description) {
    changes.push({
      id: nextId(),
      operation: 'modify',
      target: 'schema',
      path: ['description'],
      before: before.description,
      after: after.description,
      description: `Modified schema description`,
    });
  }

  // Compare orbitals by name
  const beforeOrbitals = new Map(
    (before.orbitals || []).map((o, i) => [o.name, { orbital: o, index: i }]),
  );
  const afterOrbitals = new Map(
    (after.orbitals || []).map((o, i) => [o.name, { orbital: o, index: i }]),
  );

  // Detect removed orbitals
  for (const [name, { index }] of beforeOrbitals) {
    if (!afterOrbitals.has(name)) {
      changes.push({
        id: nextId(),
        operation: 'remove',
        target: 'orbital',
        path: ['orbitals', index],
        before: name,
        description: `Removed orbital: ${name}`,
      });
    }
  }

  // Detect added orbitals
  for (const [name, { index }] of afterOrbitals) {
    if (!beforeOrbitals.has(name)) {
      changes.push({
        id: nextId(),
        operation: 'add',
        target: 'orbital',
        path: ['orbitals', index],
        after: name,
        description: `Added orbital: ${name}`,
      });
    }
  }

  // Detect modified orbitals (deep compare via JSON)
  for (const [name, { orbital: afterOrbital, index }] of afterOrbitals) {
    const beforeEntry = beforeOrbitals.get(name);
    if (beforeEntry) {
      const beforeJson = JSON.stringify(beforeEntry.orbital);
      const afterJson = JSON.stringify(afterOrbital);
      if (beforeJson !== afterJson) {
        changes.push({
          id: nextId(),
          operation: 'modify',
          target: 'orbital',
          path: ['orbitals', index],
          description: `Modified orbital: ${name}`,
        });

        // Drill into entity changes
        const beforeEntity = beforeEntry.orbital.entity;
        const afterEntity = afterOrbital.entity;
        if (JSON.stringify(beforeEntity) !== JSON.stringify(afterEntity)) {
          const entityName =
            typeof afterEntity === 'string'
              ? afterEntity
              : afterEntity && typeof afterEntity === 'object' && 'name' in afterEntity
                ? (afterEntity as { name: string }).name
                : 'entity';
          changes.push({
            id: nextId(),
            operation: 'modify',
            target: 'entity',
            path: ['orbitals', index, 'entity'],
            description: `Modified entity: ${entityName}`,
          });
        }

        // Drill into trait changes
        const beforeTraits = beforeEntry.orbital.traits || [];
        const afterTraits = afterOrbital.traits || [];
        if (JSON.stringify(beforeTraits) !== JSON.stringify(afterTraits)) {
          changes.push({
            id: nextId(),
            operation: 'modify',
            target: 'traits',
            path: ['orbitals', index, 'traits'],
            description: `Modified traits in orbital: ${name}`,
          });
        }

        // Drill into page changes
        const beforePages = beforeEntry.orbital.pages || [];
        const afterPages = afterOrbital.pages || [];
        if (JSON.stringify(beforePages) !== JSON.stringify(afterPages)) {
          changes.push({
            id: nextId(),
            operation: 'modify',
            target: 'pages',
            path: ['orbitals', index, 'pages'],
            description: `Modified pages in orbital: ${name}`,
          });
        }
      }
    }
  }

  // Compare services
  const beforeServices = JSON.stringify(before.services || []);
  const afterServices = JSON.stringify(after.services || []);
  if (beforeServices !== afterServices) {
    changes.push({
      id: nextId(),
      operation: 'modify',
      target: 'services',
      path: ['services'],
      description: 'Modified services',
    });
  }

  return { changes };
}

// ============================================================================
// Destructive Change Detection
// ============================================================================

/**
 * Check if a changeset contains any removals.
 */
export function isDestructiveChange(changeSet: { changes: SchemaChange[] }): boolean {
  return changeSet.changes.some((c) => c.operation === 'remove');
}

/**
 * Extract all removal operations from a changeset.
 */
export function getRemovals(changeSet: { changes: SchemaChange[] }): SchemaChange[] {
  return changeSet.changes.filter((c) => c.operation === 'remove');
}

/**
 * Categorize removals by severity.
 *
 * - Critical: orbitals, entities, states, pages (require confirmation)
 * - Standard: fields, actions, traits (auto-snapshotted)
 * - Minor: transitions, guards (tracked)
 */
export function categorizeRemovals(changeSet: {
  changes: SchemaChange[];
}): CategorizedRemovals {
  const critical: SchemaChange[] = [];
  const standard: SchemaChange[] = [];
  const minor: SchemaChange[] = [];

  for (const change of changeSet.changes) {
    if (change.operation !== 'remove') continue;

    const target = change.target.toLowerCase();
    if (
      target === 'orbital' ||
      target === 'entity' ||
      target === 'state' ||
      target === 'page'
    ) {
      critical.push(change);
    } else if (
      target === 'field' ||
      target === 'action' ||
      target === 'trait' ||
      target === 'traits'
    ) {
      standard.push(change);
    } else {
      minor.push(change);
    }
  }

  return { critical, standard, minor, pageContentReductions: [] };
}

/**
 * Check if critical removals require explicit confirmation.
 */
export function requiresConfirmation(removals: CategorizedRemovals): boolean {
  return removals.critical.length > 0;
}

// ============================================================================
// Page Content Reduction
// ============================================================================

/**
 * Detect implicit content reduction within pages.
 * Catches cases where a page 'modify' reduces components/actions/displays
 * without an explicit 'remove' operation.
 */
export function detectPageContentReduction(
  beforePages: unknown[],
  afterPages: unknown[],
): PageContentReduction[] {
  const reductions: PageContentReduction[] = [];

  const getPageName = (p: unknown): string | null => {
    if (p && typeof p === 'object' && 'name' in p) {
      return (p as { name: string }).name;
    }
    return null;
  };

  const countContent = (
    page: unknown,
  ): { sections: number; actions: number } => {
    if (!page || typeof page !== 'object') return { sections: 0, actions: 0 };
    const p = page as Record<string, unknown>;
    const traits = Array.isArray(p.traits) ? p.traits : [];
    return { sections: traits.length, actions: 0 };
  };

  // Build maps by name
  const beforeMap = new Map<string, unknown>();
  for (const p of beforePages) {
    const name = getPageName(p);
    if (name) beforeMap.set(name, p);
  }

  for (const afterPage of afterPages) {
    const name = getPageName(afterPage);
    if (!name) continue;
    const beforePage = beforeMap.get(name);
    if (!beforePage) continue;

    const beforeContent = countContent(beforePage);
    const afterContent = countContent(afterPage);

    const sectionsRemoved = beforeContent.sections - afterContent.sections;
    const actionsRemoved = beforeContent.actions - afterContent.actions;

    if (sectionsRemoved > 0 || actionsRemoved > 0) {
      reductions.push({
        pageName: name,
        componentsRemoved: sectionsRemoved,
        actionsRemoved,
        displaysRemoved: 0,
        before: beforeContent,
        after: afterContent,
        isSignificant: sectionsRemoved > 0,
      });
    }
  }

  return reductions;
}

/**
 * Check if page content reductions are significant.
 */
export function hasSignificantPageReduction(
  reductions: PageContentReduction[],
): boolean {
  return reductions.some((r) => r.isSignificant);
}
