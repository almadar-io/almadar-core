/**
 * Factory namespace — the post-Phase-6 canonical home for the
 * factory-call surface, overlays, projector, diff, and mutation
 * reducer.
 *
 * During the transition the underlying type definitions stay in
 * `../domain-language/types.ts`; this barrel exposes them under the
 * `factory/` namespace so consumers can migrate imports independently.
 * Step 8 physically relocates the definitions here.
 *
 * @packageDocumentation
 */

export type {
  FactorySignatureEntityField,
  FactoryEntitySignature,
  FactoryTraitSignature,
  FactoryPageSignature,
  FactorySignature,
  FactorySignatureCatalog,
  FactoryCallSite,
  FactoryCallSiteParams,
  FactoryParamValue,
  SchemaFieldType,
} from './types.js';

export type {
  PresentationOverlay,
  PresentationNavItem,
  TraitOverlay,
  TraitOverlayEntry,
  TraitOverlayListener,
  RuleOverlay,
  RuleOverlayEntry,
  OwnershipOverlayEntry,
} from './overlays.js';

export {
  translateOverlaysToParams,
  translateDomainToParams,
} from './translate.js';
export type {
  TranslationBinding,
  TranslationResult,
  TranslationWarning,
} from './translate.js';

export { diffFactoryCalls } from './diff.js';
export type { CallSiteDiff } from './diff.js';

export {
  applyFactoryCallPlanMutation,
} from './mutate.js';
export type {
  FactoryCallPlanMutation,
  FactoryCallPlanState,
  OrbitalCallInput,
} from './mutate.js';
