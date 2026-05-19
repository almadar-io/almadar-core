/**
 * Per-orbital projector: one binding + one chosen `FactorySignature` →
 * one `FactoryCallSite`. The agent picks the signature upstream
 * (catalog embedding search); this function does ZERO matching — it
 * lowers binding fields onto the factory's advertised param surface
 * field-by-field.
 *
 * Post-Phase-6 the function lives under the `factory/` namespace and
 * is exported as `translateOverlaysToParams`. The old name
 * `translateDomainToParams` stays exported as a deprecated alias
 * while consumers migrate.
 *
 * The canonical implementation stays in
 * `../domain-language/sync/translate-domain-to-params.ts` until
 * Step 8 physically relocates it here. The `TranslationBinding`
 * shape's redefinition (drop `DomainEntity` / `DomainPage`) is
 * coupled to Step 3 (the agent's DomainDocument drop).
 *
 * @packageDocumentation
 */

export {
  translateDomainToParams as translateOverlaysToParams,
  translateDomainToParams,
} from '../domain-language/sync/translate-domain-to-params.js';

export type {
  TranslationBinding,
  TranslationResult,
  TranslationWarning,
} from '../domain-language/sync/translate-domain-to-params.js';
