# `@almadar/core` Domain Language

The domain language is a typed, human-readable surface that maps
bidirectionally to a subset of `OrbitalSchema`. Users (and the LLM)
describe what their domain *is* — entities, behaviors, pages — and the
projector (`packages/almadar-core/src/domain-language/sync/`) deterministically
converts to / from the resolved schema.

The bidirectional pair is `convertDomainToSchema` ↔ `convertSchemaToDomain`,
with a typed AST in the middle (`DomainDocument = { entities, pages,
behaviors }`) and a `SectionMapping` registry that keeps domain-text
spans bound to schema paths across edits.

See `docs/Almadar_Domain_Language.md` for the broader plan this module
underpins.

## Core principle — the language is constrained, not exhaustive

The domain language is **deliberately narrower** than the surface
`OrbitalSchema` exposes. A field is admissible on `DomainDocument`
only if it represents something a user could *author* in a
questionnaire/prompt AND has a deterministic destination in the
resolved schema (either via the converter here, or via the Phase 2
projector reading factory signatures).

Concretely: anything *factory-derived* (orbital naming, `uses[]`
imports, the full trait stack, the full page set with trait
references, theme refs) does NOT roundtrip and stays on the
exclusion list below. Phase 2's projector (separate module) emits it
from factory signatures.

This avoids the "wishlist problem": the user describes a concept, the
system silently can't translate it, and the resolved schema is missing
what the prompt asked for. Memory:
`feedback_domain_language_constrained_not_exhaustive.md`.

## Roundtripped surface

The 9-behavior roundtrip suite in
`packages/almadar-core/__tests__/domain-roundtrip.test.ts` gates the
following fields. Every entry here is preserved byte-for-byte through
`convertSchemaToDomain → convertDomainToSchema`.

**Entity-level**
- `Entity.name`
- `Entity.description` (free text)
- `Entity.persistence` (`'persistent' | 'runtime' | 'singleton' | 'instance' | 'local'`)
  — domain syntax: `Persistence: <value>` line, only emitted for non-default values.
- `Entity.states[]`
- `Entity.initialState`

**Field-level** (`Entity.fields[]`)
- `field.name` (camelCase → "space separated" in domain text)
- `field.type` (mapped via `FIELD_TYPE_REGISTRY`: `text / long text /
  number / currency / yes/no / date / timestamp / datetime / list /
  object / enum / relation`)
- `field.required`, `field.unique`, `field.auto`
- `field.default` — scalars, structural JSON (`[]`, `{...}`), and
  empty strings (`""`) all roundtrip.
- `field.values[]` — enum constraint on a string field. Schema convention:
  `type: 'string'` + `values: [...]`. Domain syntax: `a | b | c` in the
  type-spec position.
- `field.items` — list-item type for `fieldType: 'list'`. Domain syntax:
  `list of <itemType>`.

**Relationships**
- `belongs_to`, `has_many`, `has_one` with optional alias.

**Behavior-level** (mapped to `Trait`)
- `Trait.name`
- `Trait.scope` (`'instance' | 'collection'`) — domain syntax: `Scope: <value>`
  line, only emitted for non-default values.
- `Trait.stateMachine.states[]`, `states[].isInitial`
- `Trait.stateMachine.transitions[]` (from, to, event, guards, effects).
  Malformed guards/effects (rare; emerge from natural-language guard
  text that wasn't an S-expression) are skipped with no error rather
  than aborting the conversion.

**Page-level**
- `Page.name`, `Page.path`, `Page.primaryEntity`, page `purpose`,
  page sections / actions.

## Deliberately NOT in `DomainDocument`

Each entry below is omitted by design. Roundtrip tests EXCLUDE these
paths (see `EXCLUDE` in `__tests__/domain-roundtrip.test.ts`). Anything
new that *should* be added must (a) prove a factory-signature consumer
exists and (b) come with a roundtrip proof.

| Path | Why not in domain |
|---|---|
| `schema.name` | App name is factory/template-derived from the organism choice; no user-authoring need. |
| `schema.version` | Top-level metadata — bookkeeping, not domain. |
| `schema.orbitals[].name` | Orbital identity is factory-derived; the projector picks orbital names from the matched signature. |
| `schema.orbitals[].uses[]` | Import block is factory-internal. Phase 2 projector emits `uses[]` based on which factory it picked. |
| `schema.orbitals[].traits[]` | Trait stack is factory-derived. Domain `behaviors[]` describes *what should happen*; the projector chooses the factory whose `traits[]` cover it. |
| `schema.orbitals[].pages[]` (trait refs, viewType, etc.) | Page-trait composition is factory-derived. Domain `pages[]` carries URL/purpose/primaryEntity only. |
| `schema.orbitals[].entity.collection` | Auto-derived from `entity.name`. |
| `schema.orbitals[].theme` | Presentation, not domain. `PresentationOverlay` (separate type) carries it. |

## Future extensions — signature-gated

Several concepts from the legacy `AnalysisDomainModel` (`actors`,
`processes`, typed `rules`, `interactions`, entity `ownedBy` /
`visibleTo`) are **not yet here**. They are candidate additions, each
gated on at least one factory signature advertising a consumer.

The expansion sequencing is:

1. Phase 1 ships `factory-signatures.json` (the catalog).
2. Inspect the catalog: for each consumable knob, identify the
   corresponding domain concept.
3. Add the concept to `DomainDocument` (extend `types.ts` + parser +
   formatter + converter), and add a roundtrip proof to the test
   suite.

Likely first wave:

- `DomainEntity.ownedBy?: string` — once a factory signature advertises
  a row-access trait that consumes an ownership knob.
- `DomainRule { type: 'audit' | 'access', appliesTo: string[] }` —
  once a factory advertises audit / access traits.

Unlikely until specific factories ship:

- `DomainActor`, `DomainProcess`, `DomainInteraction` — no current
  factory consumes these as typed inputs.

Anything Stage A wants to convey that doesn't fit the language stays
in the prompt-only path (Stage A's existing behavior). The language
never pretends to capture what it can't translate.

## Module surface

Bidirectional converters: `convertDomainToSchema(text, baseSchema?)`,
`convertSchemaToDomain(schema)`.

Typed AST: `DomainDocument`, `DomainEntity`, `DomainField`,
`DomainRelationship`, `DomainPage`, `DomainBehavior`, `DomainGuard`,
`DomainEffect`, `DomainTransition`, `DomainTick`, plus the canonical
re-exports `EntityPersistence`, `TraitScope`.

Section mapping (cross-turn identity): `MappingStore`,
`generateSectionId`, `findMapping`, `upsertMapping`, `detectChanges`,
`computeSchemaHash`.

Type registries (single source of truth for the field-type /
effect-operator / guard-operator mappings): `FIELD_TYPE_REGISTRY`,
`EFFECT_REGISTRY`, `GUARD_REGISTRY`. New schema types are added here
first; the parsers + formatters consume the registry via lookup
helpers (`getFieldTypeMapping`, etc.).
