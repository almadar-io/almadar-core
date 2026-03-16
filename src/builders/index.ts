/**
 * Builders Module
 *
 * Utilities for composing orbital definitions into applications.
 *
 * @packageDocumentation
 */

// Layout strategy detection
export { type LayoutStrategy, detectLayoutStrategy } from './layout-strategy.js';

// Event wiring
export { type EventWiringEntry, applyEventWiring } from './event-wiring.js';

// Compose behaviors (main entry point)
export {
  type ComposeBehaviorsInput,
  type ComposeBehaviorsResult,
  composeBehaviors,
} from './compose-behaviors.js';
