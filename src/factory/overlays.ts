/**
 * Cross-cutting overlays threaded into factory params at projection
 * time. These are the agent's natural-language-shaped inputs that the
 * translator lowers onto per-trait config keys + extra-trait emission.
 *
 * - `PresentationOverlay`: nav + theme (presentation layer).
 * - `TraitOverlay`: per-trait config + rename + listen surface.
 * - `RuleOverlay`: capability-tagged rules + ownership signal.
 *
 * Post-Phase-6 these types live under the `factory/` namespace. The
 * canonical definitions stay in `../domain-language/types.ts` until
 * the kill-DomainDocument phase's Step 8 physically moves them here.
 *
 * @packageDocumentation
 */

export type {
  PresentationOverlay,
  PresentationNavItem,
  TraitOverlay,
  TraitOverlayEntry,
  TraitOverlayListener,
  RuleOverlay,
  DomainRuleOverlayEntry as RuleOverlayEntry,
  OwnershipOverlayEntry,
} from '../domain-language/types.js';
