<!-- Gap ledger for this repo: the source of truth for its open gaps. Managed with scripts/gaps-ledger.mjs in the Almadar monorepo. -->
# @almadar/core — open gaps

Every open gap this repo owns lives here. This file is the source of truth; the monorepo's `docs/Almadar_Gaps.md` only rolls it up.

- **One entry per gap:** `- **<code>** — <what is wrong and where>. <owning package> [mechanical|architectural] — <evidence, prevention rung>`. `[mechanical]` = small and well-scoped; `[architectural]` = needs design judgment.
- **Codes:** new gaps use this repo's prefix `G-CORE-`. Take the "Next code" below, then bump it in the same edit. Codes are never reused or renamed.
- **Close by deleting.** Remove the entry in the same commit as the fix. There is no "closed" section; git history is the record.
- **Cross-repo gaps don't go here.** If fixing it needs another repo, describe it in your report or PR body; the monorepo coordinator files it.

Next code: `G-CORE-012`

## Open gaps

### Foundation / Core tier (`@almadar/core`, patterns, logger, validation, analytics, i18n tables)

- **G-CORE-009** — `.lolo` `aspect : string` isn't validated against `ASSET_ASPECTS` at `orb validate` time. `[rung-2, compiler-owned, sacred — not queued without permission]` — orig: `Almadar_Core_Gaps.md` (residual)
