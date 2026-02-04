/**
 * Pattern Type for Orbital Units
 *
 * Defines pattern type validation.
 * The actual pattern definitions come from @almadar/patterns.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Pattern Type
// ============================================================================

/**
 * Common pattern types.
 * The full list is defined in @almadar/patterns registry.
 */
export const PATTERN_TYPES = [
  // Display patterns
  'entity-table',
  'entity-list',
  'entity-cards',
  'entity-grid',
  // Form patterns
  'form',
  'form-section',
  // Header patterns
  'page-header',
  // Stats patterns
  'stats',
  'stat-card',
  // Layout patterns
  'master-detail',
  'dashboard-grid',
  // Game patterns
  'game-canvas',
  'game-hud',
  'game-controls',
] as const;

/**
 * Pattern type union.
 * This is a string type to allow for custom/extended patterns.
 */
export type PatternType = string;

/**
 * Zod schema for pattern types.
 * Accepts any string - validation against full registry happens at runtime.
 */
export const PatternTypeSchema = z.string();

// ============================================================================
// Pattern Type Functions
// ============================================================================

/**
 * Get the common pattern types.
 * For the full registry, import from @almadar/patterns.
 */
export function getAllPatternTypes(): string[] {
  return [...PATTERN_TYPES];
}

/**
 * Check if a pattern type is in the common list.
 * For comprehensive validation, use @almadar/patterns registry.
 */
export function isValidPatternType(patternType: string): patternType is PatternType {
  return (PATTERN_TYPES as readonly string[]).includes(patternType);
}
