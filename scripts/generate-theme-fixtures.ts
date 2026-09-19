/**
 * Generates `fixtures/theme-tokens/every-key.json`: a `color` and an
 * `illustration` slice with EVERY key populated, iterated from
 * `COLOR_TOKEN_KEYS` / `ILLUSTRATION_TOKEN_KEYS` (ledger §166). The Rust
 * `ColorTokens`/`IllustrationTokens` mirrors (`orbital-core`
 * `schema/types.rs`) round-trip it in `tests/theme_tokens_fixture.rs`, so a
 * key core knows and Rust does not goes red there.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COLOR_TOKEN_KEYS,
  ILLUSTRATION_TOKEN_KEYS,
  ColorTokensSchema,
  IllustrationTokensSchema,
  type ColorTokens,
  type IllustrationTokens,
} from '../src/types/domain.js';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(PACKAGE_ROOT, 'fixtures', 'theme-tokens');

const color: ColorTokens = Object.fromEntries(COLOR_TOKEN_KEYS.map((k, i) => [k, `#${i.toString(16).padStart(6, '0')}`]));
const illustration: IllustrationTokens = Object.fromEntries(
  ILLUSTRATION_TOKEN_KEYS.map((k) => [k, k === 'style' ? 'minimal' : `${k}.svg`]),
);

const fixture = {
  color: ColorTokensSchema.parse(color),
  illustration: IllustrationTokensSchema.parse(illustration),
};
if (Object.keys(fixture.color).length !== COLOR_TOKEN_KEYS.length) throw new Error('ColorTokensSchema dropped a key');
if (Object.keys(fixture.illustration).length !== ILLUSTRATION_TOKEN_KEYS.length) throw new Error('IllustrationTokensSchema dropped a key');

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'every-key.json'), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`✓ Generated theme-tokens fixture (${COLOR_TOKEN_KEYS.length} color + ${ILLUSTRATION_TOKEN_KEYS.length} illustration keys)`);
