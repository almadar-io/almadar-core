/**
 * App-Level Types
 *
 * Types for app summaries, stats, and save operations.
 */

import type { CategorizedRemovals } from './changeset.js';

// ============================================================================
// GitHub Integration
// ============================================================================

/**
 * GitHub repository link metadata stored in Firestore.
 * Enables GitHub as the source of truth for schema files.
 */
export interface GitHubLink {
  repoUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  connectedAt: number;
}

// ============================================================================
// Stats & Summary
// ============================================================================

/**
 * Dashboard stats derived from schema.
 */
export interface StatsView {
  states: number;
  events: number;
  pages: number;
  entities: number;
  transitions: number;
}

/**
 * App summary for list views.
 */
export interface AppSummary {
  id: string;
  name: string;
  description?: string;
  updatedAt: number;
  createdAt: number;
  stats: StatsView;
  domain?: { category: string; subDomain?: string };
  domainContext?: unknown;
  hasValidationErrors: boolean;
  github?: GitHubLink;
}

// ============================================================================
// Save Operations
// ============================================================================

/**
 * Options for saving a schema.
 */
export interface SaveOptions {
  confirmRemovals?: boolean;
  snapshotReason?: string;
  skipProtection?: boolean;
  expectedVersion?: number;
  source?: 'requirements-agent' | 'builder-agent' | 'manual';
}

/**
 * Result of saving a schema.
 */
export interface SaveResult {
  success: boolean;
  requiresConfirmation?: boolean;
  removals?: CategorizedRemovals;
  error?: string;
  snapshotId?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation issue with optional LLM context.
 */
export interface ValidationIssue {
  code: string;
  message: string;
  path: (string | number)[];
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
  llmContext?: unknown;
}

/**
 * Validation results.
 */
export interface ValidationResults {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  validatedAt: number;
}

/**
 * Validation document stored in subcollection.
 */
export interface ValidationDocument {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  validatedAt: number;
}
