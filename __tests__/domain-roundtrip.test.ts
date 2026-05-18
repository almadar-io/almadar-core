/**
 * Domain-language ↔ OrbitalSchema roundtrip suite.
 *
 * Phase 0 gate for `docs/Almadar_Domain_Language.md`. The 9-behavior
 * set spans atoms / molecules / organisms across the std registry.
 * Each test: load the canonical `.orb`, run it through
 * `convertSchemaToDomain → convertDomainToSchema`, diff against the
 * source. Failure = drift the domain language must close (either by
 * extending the AST + parser + formatter, or by adding the field to
 * the deliberate-exclusion list with a one-line justification in
 * `domain-language/README.md`).
 *
 * Diff exclusions live in `EXCLUDE` below — paths use dotted JSON
 * notation with `**` wildcards. Add entries here AND document in the
 * README; the two must stay in sync.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OrbitalSchema } from '../src/types/index.js';
import { convertSchemaToDomain, convertDomainToSchema } from '../src/domain-language/index.js';

// ----------------------------------------------------------------------------
// Typed JSON-tree walker (no `unknown`, no shadow types)
// ----------------------------------------------------------------------------

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isJsonObject(v: Json): v is { [k: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Glob-style match on dotted paths. Patterns:
 *   - `*`  matches one path segment (object key OR array index)
 *   - `**` matches zero or more segments
 *
 * Paths produced by `diffJson` use a flat dot-separated form
 * (`schema.orbitals.0.entity.fields.3.name`); patterns therefore
 * never embed brackets.
 */
function pathMatchesExclude(p: string, exclude: ReadonlyArray<string>): boolean {
  for (const pattern of exclude) {
    if (pattern === p) return true;
    const regex = new RegExp(
      '^' +
        pattern
          .split('.')
          .map((seg) =>
            seg === '**'
              ? '.*'
              : seg === '*'
                ? '[^.]+'
                : seg.replace(/[.+?^${}()|[\]\\]/g, '\\$&'),
          )
          .join('\\.') +
        '$',
    );
    if (regex.test(p)) return true;
  }
  return false;
}

function diffJson(a: Json, b: Json, p: string, exclude: ReadonlyArray<string>): string[] {
  if (pathMatchesExclude(p, exclude)) return [];
  if (a === b) return [];

  if (Array.isArray(a) && Array.isArray(b)) {
    const out: string[] = [];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      const childPath = `${p}.${i}`;
      if (i >= a.length) {
        if (!pathMatchesExclude(childPath, exclude))
          out.push(`${childPath}: missing in A, B=${JSON.stringify(b[i])}`);
      } else if (i >= b.length) {
        if (!pathMatchesExclude(childPath, exclude))
          out.push(`${childPath}: missing in B, A=${JSON.stringify(a[i])}`);
      } else {
        out.push(...diffJson(a[i], b[i], childPath, exclude));
      }
    }
    return out;
  }

  if (isJsonObject(a) && isJsonObject(b)) {
    const out: string[] = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const childPath = `${p}.${k}`;
      if (pathMatchesExclude(childPath, exclude)) continue;
      const ak = a[k];
      const bk = b[k];
      if (ak === undefined && bk !== undefined)
        out.push(`${childPath}: missing in A, B=${JSON.stringify(bk)}`);
      else if (ak !== undefined && bk === undefined)
        out.push(`${childPath}: missing in B, A=${JSON.stringify(ak)}`);
      else if (ak !== undefined && bk !== undefined)
        out.push(...diffJson(ak, bk, childPath, exclude));
    }
    return out;
  }

  return [`${p}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`];
}

// ----------------------------------------------------------------------------
// Deliberate-exclusion list
//
// Items here are NOT drift — they are domain-language exclusions per
// docs/Almadar_Domain_Language.md (factory params / presentation overlay /
// out-of-scope-for-domain). Keep in sync with
// packages/almadar-core/src/domain-language/README.md.
// ----------------------------------------------------------------------------

const EXCLUDE: ReadonlyArray<string> = [
  // ----- Top-level metadata -----
  'schema.version',
  'schema.name', // app name — factory-derived from organism choice

  // ----- Orbital structure — Phase 2 projector emits these -----
  'schema.orbitals.*.name', // orbital identity is factory-derived
  'schema.orbitals.*.uses', // imports are factory-internal
  'schema.orbitals.*.uses.**',

  // ----- Trait stack — factory-derived; projector emits -----
  'schema.orbitals.*.traits',
  'schema.orbitals.*.traits.*',
  'schema.orbitals.*.traits.**',

  // ----- Page stack — factory-derived; projector emits -----
  'schema.orbitals.*.pages',
  'schema.orbitals.*.pages.*',
  'schema.orbitals.*.pages.**',

  // ----- Entity collection — auto-derived from entity name -----
  'schema.orbitals.*.entity.collection',

  // ----- Theme — PresentationOverlay carries this -----
  'schema.orbitals.*.theme',
  'schema.orbitals.*.theme.**',
];

// ----------------------------------------------------------------------------
// Roundtrip harness
// ----------------------------------------------------------------------------

const STD_REGISTRY = path.resolve(
  __dirname,
  '..',
  '..',
  'almadar-std',
  'behaviors',
  'registry',
);

const BEHAVIORS: ReadonlyArray<{ name: string; relPath: string }> = [
  { name: 'core/atoms/std-modal', relPath: 'core/atoms/std-modal.orb' },
  { name: 'core/atoms/std-confirmation', relPath: 'core/atoms/std-confirmation.orb' },
  { name: 'core/atoms/std-row-access-control', relPath: 'core/atoms/std-row-access-control.orb' },
  { name: 'core/molecules/std-list', relPath: 'core/molecules/std-list.orb' },
  { name: 'core/molecules/std-master-detail-layout', relPath: 'core/molecules/std-master-detail-layout.orb' },
  { name: 'core/molecules/std-dashboard', relPath: 'core/molecules/std-dashboard.orb' },
  { name: 'app/molecules/std-cart', relPath: 'app/molecules/std-cart.orb' },
  { name: 'app/organisms/std-ecommerce', relPath: 'app/organisms/std-ecommerce.orb' },
  { name: 'agent/organisms/std-agent-builder', relPath: 'agent/organisms/std-agent-builder.orb' },
];

function roundtrip(absPath: string): {
  diff: ReadonlyArray<string>;
  parseErrors: ReadonlyArray<string>;
} {
  const raw = fs.readFileSync(absPath, 'utf-8');
  const schema = JSON.parse(raw) as OrbitalSchema;
  const { domainText } = convertSchemaToDomain(schema);
  const result = convertDomainToSchema(domainText, schema);
  const schemaA = JSON.parse(raw) as Json;
  const schemaB = JSON.parse(JSON.stringify(result.schema)) as Json;
  return {
    diff: diffJson(schemaA, schemaB, 'schema', EXCLUDE),
    parseErrors: result.errors.map((e) => `${e.message}${e.suggestion ? ` (${e.suggestion})` : ''}`),
  };
}

describe('domain-language ↔ OrbitalSchema roundtrip', () => {
  for (const behavior of BEHAVIORS) {
    it(`roundtrips ${behavior.name}`, () => {
      const orbPath = path.join(STD_REGISTRY, behavior.relPath);
      if (!fs.existsSync(orbPath)) {
        throw new Error(`Fixture missing: ${orbPath}`);
      }
      const { diff, parseErrors } = roundtrip(orbPath);
      expect(parseErrors, `parse errors during roundtrip:\n${parseErrors.join('\n')}`).toEqual([]);
      expect(diff, `diff entries:\n${diff.join('\n')}`).toEqual([]);
    });
  }
});
