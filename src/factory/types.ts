/**
 * Factory call surface types.
 *
 * The factory-call surface is the typed contract between the agent's
 * analysis output and the orbital generation pipeline. Each
 * `FactorySignature` describes what one factory advertises (entities,
 * pages, traits with capabilities + overridable config keys), and each
 * `FactoryCallSite` is one invocation against that signature with the
 * agent-emitted params.
 *
 * Types live here under the `factory/` namespace post-Phase-6. Until
 * the `domain-language/` deletion lands, the canonical definitions
 * stay in `../domain-language/types.ts` and this file re-exports them
 * for namespace stability — consumers import from
 * `@almadar/core/factory` rather than from the legacy
 * `@almadar/core` flat surface. Step 8 of the kill-DomainDocument
 * phase physically moves the definitions here.
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
} from '../domain-language/types.js';
