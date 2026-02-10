/**
 * Changeset & Snapshot Types
 *
 * Unified types for schema change tracking, snapshots, and removal categorization.
 * Used by @almadar/server for Firestore storage and by consumers for type safety.
 */

// ============================================================================
// Schema Change Types
// ============================================================================

/**
 * A single change within a changeset.
 */
export interface SchemaChange {
  id: string;
  operation: 'add' | 'modify' | 'remove' | 'rename';
  target: string;
  path: (string | number)[];
  before?: unknown;
  after?: unknown;
  description: string;
  reason?: string;
  dependsOn?: string[];
}

/**
 * Author of a changeset.
 */
export interface ChangeAuthor {
  type: 'agent' | 'user';
  id?: string;
  name?: string;
}

/**
 * Summary statistics for a changeset.
 */
export interface ChangeSummary {
  added: number;
  modified: number;
  removed: number;
  description: string;
}

/**
 * Complete changeset document.
 * Stored at: users/{uid}/apps/{appId}/changesets/{changeSetId}
 */
export interface ChangeSetDocument {
  id: string;
  version: number;
  timestamp: number;
  source: 'requirements-agent' | 'builder-agent' | 'user' | 'auto-fix';
  author: ChangeAuthor;
  trigger?: string;
  changes: SchemaChange[];
  summary: ChangeSummary;
  status: 'applied' | 'reverted' | 'pending';
  description: string;
}

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Schema snapshot document.
 * Stored at: users/{uid}/apps/{appId}/snapshots/{snapshotId}
 */
export interface SnapshotDocument {
  id: string;
  timestamp: number;
  schema: Record<string, unknown>;
  reason: string;
  version?: number;
}

// ============================================================================
// Schema Protection Types
// ============================================================================

/**
 * Removals categorized by severity.
 */
export interface CategorizedRemovals {
  /** States, pages, entities — always require confirmation */
  critical: SchemaChange[];
  /** Fields, actions — auto-snapshotted */
  standard: SchemaChange[];
  /** Transitions, guards — tracked */
  minor: SchemaChange[];
  /** Implicit content removal within pages */
  pageContentReductions: PageContentReduction[];
}

/**
 * Detected reduction in page content (components, actions, displays removed).
 */
export interface PageContentReduction {
  pageName: string;
  componentsRemoved: number;
  actionsRemoved: number;
  displaysRemoved: number;
  before: { sections: number; actions: number };
  after: { sections: number; actions: number };
  isSignificant: boolean;
}

// ============================================================================
// History Metadata Types
// ============================================================================

/**
 * History metadata stored in main app document for quick access.
 */
export interface HistoryMeta {
  latestSnapshotId?: string;
  latestChangeSetId?: string;
  snapshotCount: number;
  changeSetCount: number;
}

/**
 * Validation metadata stored in main app document for quick access.
 */
export interface ValidationMeta {
  errorCount: number;
  warningCount: number;
  validatedAt: number;
}
