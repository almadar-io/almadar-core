/**
 * Internationalization (i18n) — vocabulary tables for the `.lolo`/`.orb`
 * language (English, Arabic, Slovenian). See `Almadar_i18n.md` / the i18n
 * program plan for the section contract; this module is the JS-path owner.
 *
 * @packageDocumentation
 */

import enRaw from './en.json';
import arRaw from './ar.json';
import slRaw from './sl.json';

export type LanguageCode = 'en' | 'ar' | 'sl';

export const LANGUAGE_CODES: readonly LanguageCode[] = ['en', 'ar', 'sl'];

export const I18N_SECTIONS = [
  'keywords',
  'shapes',
  'tags',
  'categories',
  'capabilities',
  'annotations',
  'sigils',
  'effects',
  'types',
  'units',
  'literals',
  'reservedEvents',
  'orb',
] as const;

export type I18nSection = typeof I18N_SECTIONS[number];

export interface I18nMeta {
  code: LanguageCode;
  name: string;
  rtl: boolean;
}

export type I18nTables = { meta: I18nMeta } & Record<I18nSection, Record<string, string>>;

/** Supplied by the caller (@almadar/std) — core must not import std. */
export interface OperatorTables {
  operators: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Validating loader — builds an I18nTables from the raw JSON import without a
// type assertion. Throws on genuine structural corruption (not an object, a
// malformed `meta`, or a present section that isn't Record<string,string>).
// A section that is entirely ABSENT is tolerated as empty rather than
// thrown on — ar.json/sl.json are filled in section-by-section by other
// agents, and an incomplete table is the coverage gate's job to report
// (kind: 'missing'), not a load-time crash.
// ---------------------------------------------------------------------------

/** Shape of an on-disk i18n table before validation; every field is unvalidated. */
interface RawI18nTable {
  meta: unknown;
  keywords: unknown;
  shapes: unknown;
  tags: unknown;
  categories: unknown;
  capabilities: unknown;
  annotations: unknown;
  sigils: unknown;
  effects: unknown;
  types: unknown;
  units: unknown;
  literals: unknown;
  reservedEvents: unknown;
  orb: unknown;
}

function isPlainObject(x: unknown): x is object {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isRawI18nTable(x: unknown): x is RawI18nTable {
  return isPlainObject(x);
}

function isStringRecord(x: unknown): x is Record<string, string> {
  if (!isPlainObject(x)) return false;
  for (const value of Object.values(x)) {
    if (typeof value !== 'string') return false;
  }
  return true;
}

function isLanguageCode(x: unknown): x is LanguageCode {
  return x === 'en' || x === 'ar' || x === 'sl';
}

function isI18nMeta(x: unknown): x is I18nMeta {
  if (!isPlainObject(x) || !('code' in x) || !('name' in x) || !('rtl' in x)) return false;
  return isLanguageCode(x.code) && typeof x.name === 'string' && typeof x.rtl === 'boolean';
}

function emptySections(): Record<I18nSection, Record<string, string>> {
  return {
    keywords: {},
    shapes: {},
    tags: {},
    categories: {},
    capabilities: {},
    annotations: {},
    sigils: {},
    effects: {},
    types: {},
    units: {},
    literals: {},
    reservedEvents: {},
    orb: {},
  };
}

/** Validating loader — the one owner of the table shape; every reader (core, pattern-sync) goes through it. */
export function parseI18nTables(raw: unknown, source: string): I18nTables {
  if (!isRawI18nTable(raw)) {
    throw new Error(`i18n table "${source}": expected a JSON object, got ${typeof raw}`);
  }
  if (!isI18nMeta(raw.meta)) {
    throw new Error(`i18n table "${source}": missing or malformed "meta" (expected { code, name, rtl })`);
  }
  const badSections: string[] = [];
  const sections = emptySections();
  for (const section of I18N_SECTIONS) {
    const value = raw[section];
    if (value === undefined) continue;
    if (!isStringRecord(value)) {
      badSections.push(section);
      continue;
    }
    sections[section] = value;
  }
  if (badSections.length > 0) {
    throw new Error(`i18n table "${source}": sections not Record<string,string>: ${badSections.join(', ')}`);
  }
  return { meta: raw.meta, ...sections };
}

export function parseOperatorTables(raw: unknown, source: string): OperatorTables {
  if (!isPlainObject(raw) || !('operators' in raw) || !isStringRecord(raw.operators)) {
    throw new Error(`operator table "${source}": expected { operators: Record<string,string> }`);
  }
  return { operators: raw.operators };
}

export const coreTables: Record<LanguageCode, I18nTables> = {
  en: parseI18nTables(enRaw, 'en.json'),
  ar: parseI18nTables(arRaw, 'ar.json'),
  sl: parseI18nTables(slRaw, 'sl.json'),
};

export function getVocabulary(lang: LanguageCode): I18nTables {
  return coreTables[lang];
}

/** Native → English map for one section family; operators come from the caller (std). */
export function aliasMap(
  lang: LanguageCode,
  section: I18nSection | 'operators',
  operators?: OperatorTables,
): ReadonlyMap<string, string> {
  let table: Record<string, string>;
  if (section === 'operators') {
    if (!operators) {
      throw new Error(`aliasMap("${lang}", "operators") requires an OperatorTables argument`);
    }
    table = operators.operators;
  } else {
    table = coreTables[lang][section];
  }
  const map = new Map<string, string>();
  for (const [english, native] of Object.entries(table)) {
    map.set(native, english);
  }
  return map;
}

/** The token equals exactly one language's `keywords.app` value. */
/** The keywords that can legally open a `.lolo` program (top-level structure, LOLO.md §3). */
export const LOLO_FIRST_TOKEN_KEYWORDS = ['app', 'uses', 'expects', 'type', 'theme', 'orbital'] as const;

/** A `.lolo` program's language: its first token is one language's translation of a first-token keyword. */
export function languageOfLoloFirstToken(token: string): LanguageCode | undefined {
  const matches = LANGUAGE_CODES.filter((lang) =>
    LOLO_FIRST_TOKEN_KEYWORDS.some((kw) => coreTables[lang].keywords[kw] === token),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

/** A top-level `.orb` key equals exactly one language's `orb.orbitals` value. */
export function languageOfOrbTopLevelKeys(keys: readonly string[]): LanguageCode | undefined {
  const keySet = new Set(keys);
  const matches = LANGUAGE_CODES.filter((lang) => keySet.has(coreTables[lang].orb.orbitals));
  return matches.length === 1 ? matches[0] : undefined;
}

// ---------------------------------------------------------------------------
// Coverage gate
// ---------------------------------------------------------------------------

export type I18nProblemKind =
  | 'missing'
  | 'orphan'
  | 'empty'
  | 'inconsistent'
  | 'collision'
  | 'selector-not-unique'
  | 'operators-mismatch'
  | 'identical-to-english';

export interface I18nProblem {
  lang: LanguageCode;
  section: string;
  kind: I18nProblemKind;
  key: string;
  detail?: string;
}

export interface I18nCoverageInput {
  core: Record<LanguageCode, I18nTables>;
  std?: Record<LanguageCode, OperatorTables>;
  canonicalOperators?: readonly string[];
}

/**
 * The one implementation of the i18n coverage rules (plan B1):
 * missing/orphan/empty key sets, cross-section translation consistency,
 * native-value collisions (within a section, and across effects∪operators),
 * unique language-selector translations, and operator-set parity.
 * Never truncates — returns every problem found.
 */
export function checkI18nCoverage(input: I18nCoverageInput): { ok: boolean; problems: I18nProblem[] } {
  const problems: I18nProblem[] = [];
  const { core, std, canonicalOperators } = input;
  const enTable = core.en;

  // (1) missing / orphan / empty
  for (const lang of LANGUAGE_CODES) {
    const table = core[lang];
    for (const section of I18N_SECTIONS) {
      const values = table[section];
      if (lang !== 'en') {
        const enKeys = new Set(Object.keys(enTable[section]));
        const langKeys = new Set(Object.keys(values));
        for (const key of enKeys) {
          if (!langKeys.has(key)) {
            problems.push({ lang, section, kind: 'missing', key });
          }
        }
        for (const key of langKeys) {
          if (!enKeys.has(key)) {
            problems.push({ lang, section, kind: 'orphan', key });
          }
        }
      }
      for (const [key, value] of Object.entries(values)) {
        if (value === '') {
          problems.push({ lang, section, kind: 'empty', key });
        }
      }
    }
  }

  // (2) inconsistent — the same English word translated differently across sections
  // (including operators) within one language
  for (const lang of LANGUAGE_CODES) {
    const table = core[lang];
    const occurrences = new Map<string, Array<{ section: string; value: string }>>();
    for (const section of I18N_SECTIONS) {
      for (const [key, value] of Object.entries(table[section])) {
        const list = occurrences.get(key) ?? [];
        list.push({ section, value });
        occurrences.set(key, list);
      }
    }
    const opTable = std?.[lang]?.operators;
    if (opTable) {
      for (const [key, value] of Object.entries(opTable)) {
        const list = occurrences.get(key) ?? [];
        list.push({ section: 'operators', value });
        occurrences.set(key, list);
      }
    }
    for (const [key, entries] of occurrences) {
      if (entries.length < 2) continue;
      const baseline = entries[0];
      for (let i = 1; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.value !== baseline.value) {
          problems.push({
            lang,
            section: entry.section,
            kind: 'inconsistent',
            key,
            detail: `"${key}" is "${baseline.value}" in ${baseline.section} but "${entry.value}" in ${entry.section}`,
          });
        }
      }
    }
  }

  // (3) collision — two English keys sharing a native value, per section and across effects∪operators
  for (const lang of LANGUAGE_CODES) {
    const table = core[lang];
    for (const section of I18N_SECTIONS) {
      const byValue = new Map<string, string[]>();
      for (const [key, value] of Object.entries(table[section])) {
        const keys = byValue.get(value) ?? [];
        keys.push(key);
        byValue.set(value, keys);
      }
      for (const [value, keys] of byValue) {
        if (keys.length < 2) continue;
        for (let i = 1; i < keys.length; i++) {
          problems.push({
            lang,
            section,
            kind: 'collision',
            key: keys[i],
            detail: `shares native value "${value}" with "${keys[0]}" in ${section}`,
          });
        }
      }
    }

    const combined = new Map<string, Array<{ section: string; key: string }>>();
    for (const [key, value] of Object.entries(table.effects)) {
      const list = combined.get(value) ?? [];
      list.push({ section: 'effects', key });
      combined.set(value, list);
    }
    const opTable = std?.[lang]?.operators;
    if (opTable) {
      for (const [key, value] of Object.entries(opTable)) {
        const list = combined.get(value) ?? [];
        list.push({ section: 'operators', key });
        combined.set(value, list);
      }
    }
    // The same English word in both sections (`set`, `if`, …) is one concept, not a collision.
    for (const [value, entries] of combined) {
      const hasEffects = entries.some((e) => e.section === 'effects');
      const hasOperators = entries.some((e) => e.section === 'operators');
      if (!(hasEffects && hasOperators)) continue;
      const first = entries[0];
      for (const entry of entries.slice(1)) {
        if (entry.key === first.key) continue;
        problems.push({
          lang,
          section: 'effects∪operators',
          kind: 'collision',
          key: entry.key,
          detail: `shares native value "${value}" with "${first.key}" (${first.section}) in effects∪operators`,
        });
      }
    }
  }

  // (5) selector-not-unique — the translations that select a file's language (every first-token
  // keyword for `.lolo`, `orb.orbitals` for `.orb`) must not be shared by two languages.
  const selectorUses = new Map<string, Array<{ lang: LanguageCode; section: string; key: string }>>();
  for (const lang of LANGUAGE_CODES) {
    const table = core[lang];
    const selectors: Array<{ section: string; key: string; value: string }> = [
      ...LOLO_FIRST_TOKEN_KEYWORDS.map((key) => ({ section: 'keywords', key, value: table.keywords[key] })),
      { section: 'orb', key: 'orbitals', value: table.orb.orbitals },
    ];
    for (const { section, key, value } of selectors) {
      if (value === undefined) continue;
      const uses = selectorUses.get(value) ?? [];
      uses.push({ lang, section, key });
      selectorUses.set(value, uses);
    }
  }
  for (const [value, uses] of selectorUses) {
    const langs = new Set(uses.map((u) => u.lang));
    if (langs.size < 2) continue;
    for (const use of uses) {
      const others = uses.filter((u) => u.lang !== use.lang).map((u) => `${u.lang}:${u.section}.${u.key}`);
      problems.push({
        lang: use.lang,
        section: use.section,
        kind: 'selector-not-unique',
        key: use.key,
        detail: `${use.section}.${use.key} = "${value}" is also a language selector in: ${others.join(', ')}`,
      });
    }
  }

  // operators-mismatch — every language's operator key set must equal the canonical set exactly
  if (std && canonicalOperators) {
    const canonicalSet = new Set(canonicalOperators);
    for (const lang of LANGUAGE_CODES) {
      const opTable = std[lang]?.operators;
      if (!opTable) continue;
      const langKeys = new Set(Object.keys(opTable));
      for (const op of canonicalSet) {
        if (!langKeys.has(op)) {
          problems.push({ lang, section: 'operators', kind: 'operators-mismatch', key: op, detail: 'missing from language operator table' });
        }
      }
      for (const op of langKeys) {
        if (!canonicalSet.has(op)) {
          problems.push({ lang, section: 'operators', kind: 'operators-mismatch', key: op, detail: 'not present in canonical operator set' });
        }
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Informational only — NOT part of the coverage gate (Slovenian legitimately
 * carries loanwords identical to English). Lists native values equal to the
 * English value, for a human to spot-check.
 */
export function reportIdenticalToEnglish(input: I18nCoverageInput): I18nProblem[] {
  const problems: I18nProblem[] = [];
  const enTable = input.core.en;
  for (const lang of LANGUAGE_CODES) {
    if (lang === 'en') continue;
    const table = input.core[lang];
    for (const section of I18N_SECTIONS) {
      for (const [key, value] of Object.entries(table[section])) {
        const enValue = enTable[section][key];
        if (enValue !== undefined && value === enValue) {
          problems.push({ lang, section, kind: 'identical-to-english', key, detail: `matches English value "${enValue}"` });
        }
      }
    }
  }
  return problems;
}
