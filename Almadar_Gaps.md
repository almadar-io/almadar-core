<!-- Gap ledger for this repo: the source of truth for its open gaps. Managed with scripts/gaps-ledger.mjs in the Almadar monorepo. -->
# @almadar/core — open gaps

Every open gap this repo owns lives here. This file is the source of truth; the monorepo's `docs/Almadar_Gaps.md` only rolls it up.

- **One entry per gap:** `- **<code>** — <what is wrong and where>. <owning package> [mechanical|architectural] — <evidence, prevention rung>`. `[mechanical]` = small and well-scoped; `[architectural]` = needs design judgment.
- **Codes:** new gaps use this repo's prefix `G-CORE-`. Take the "Next code" below, then bump it in the same edit. Codes are never reused or renamed.
- **Close by deleting.** Remove the entry in the same commit as the fix. There is no "closed" section; git history is the record.
- **Cross-repo gaps don't go here.** If fixing it needs another repo, describe it in your report or PR body; the monorepo coordinator files it.

Next code: `G-CORE-022`

## Open gaps


- **G-CORE-016** — `OrbitalDefinition.traits` is typed `TraitRef[]`, whose object form omits fields a `.orb` reference trait carries and `TraitReference` declares (`typeArgs`, `linkedEntityId`, `eventIds`, `from`, …). Code reading a parsed `.orb` (rename, composition) cannot type a reference's `typeArgs` without a JSON round trip. Converge `TraitRef`'s object form onto `TraitReference` (contract change, owner sign-off; Rust twin `orbital-core` `TraitReference`). `@almadar/core` `src/types/orbital.ts` + `trait.ts` [architectural] — found 2026-10-04 (renameEntity typeArgs)
- **G-CORE-015** — `__tests__/compose-app.test.ts` > `dedupeComposedIdentity — FIX-K` > `does not union literals compared against the demoted entity by name` is red (expected [] , got 1 entry) against uncommitted edits in `src/builders/index.ts` + `src/builders/compose-behaviors.ts` (a "converge composition into core" refactor no active session claims). Either the refactor regressed FIX-K or the test needs the refactor's new contract — needs whoever owns that refactor. Found 2026-10-04. [owner-decision]
- **G-CORE-014** — Two types describe the same event payload field: `PayloadField` (`types/state-machine.ts`) and `EventPayloadField` (`types/trait.ts`), each with its own zod schema. Adding a field to one and not the other broke `@almadar/std`'s DTS build on 2026-10-03 (`projectedFrom`, TS2353 in generated std functions). Converge to one type + schema (the Rust IR has one `PayloadField`). `src/types` [architectural] — found 2026-10-03; prevention rung: none (type duplication — fix by converging)
### Foundation / Core tier (`@almadar/core`, patterns, logger, validation, analytics, i18n tables)

- **G-CORE-012** — `OrbitalSchemaSchema`'s inferred output is not assignable to `OrbitalSchema` (the zod `traits` element type ≠ `TraitRef`), so a request body can't be typed `z.ZodType<{ schema: OrbitalSchema }>` from it; `@kflow-builder/shared` had to keep the resolve body's zod check server-side. Converge the zod schema and the TS type (one generated from the other). `src/types/schema.ts` [architectural] — found 2026-09-26
