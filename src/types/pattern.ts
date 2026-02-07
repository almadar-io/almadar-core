/**
 * Pattern Type for Orbital Units
 *
 * Re-exports pattern type definitions from @almadar/patterns,
 * which is the single source of truth for all pattern types.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// Pattern Type - Re-exported from @almadar/patterns
// ============================================================================

/**
 * All valid pattern type names, imported from the almadar-patterns registry.
 * The authoritative list is auto-generated from patterns-registry.json.
 */
export {
  PATTERN_TYPES,
  PatternType,
  isValidPatternType,
} from '@almadar/patterns';

/**
 * Zod schema for pattern types.
 * Accepts any string - validation against full registry happens at runtime.
 */
export const PatternTypeSchema = z.string();

// Re-export for backward compatibility
import { PATTERN_TYPES as _PATTERN_TYPES } from '@almadar/patterns';

/**
 * Get all valid pattern types from the registry.
 * Delegates to @almadar/patterns which is the SSOT.
 */
export function getAllPatternTypes(): string[] {
  return [..._PATTERN_TYPES];
}
