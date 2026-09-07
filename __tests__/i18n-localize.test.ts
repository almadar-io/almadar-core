import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  coreTables,
  lexLolo,
  localizeLoloSource,
  localizeMap,
  localizeOrbValue,
  parseOperatorTables,
  type LanguageCode,
  type OperatorTables,
} from '../src/i18n/index.js';

/**
 * Core must not import `@almadar/std`, so the operator table is read off disk
 * the way every caller supplies it. These tests run from the repo, not from a
 * standalone package checkout, so the path is guarded: without operators the
 * renderer still works, it just leaves operator heads in English.
 */
function operatorsFor(lang: LanguageCode): OperatorTables | undefined {
  try {
    const file = join(__dirname, '../../almadar-std/i18n', `${lang}.json`);
    return parseOperatorTables(JSON.parse(readFileSync(file, 'utf8')), `std/${lang}.json`);
  } catch {
    return undefined;
  }
}

const SAMPLE = `app TaskApp "1.0.0"

orbital TaskManager {
  entity Task [persistent: tasks] {
    id : string!
    title : string
    completed : boolean = false
  }
  trait TaskBrowser -> Task [interaction] {
    initial: active
    state active {
      INIT -> active
        (fetch Task)
        (render-ui main { type: "entity-table", entity: "Task", fields: ["title", "completed"] })
      COMPLETE -> active
        (set @entity.completed true)
    }
  }
  page "/tasks" -> TaskBrowser
}
`;

describe('lexLolo', () => {
  it('keeps a namespaced operator and a hyphenated effect as one token', () => {
    const texts = lexLolo('(str/upper (render-ui main null))')
      .filter((t) => t.kind === 'identifier')
      .map((t) => t.text);
    expect(texts).toEqual(['str/upper', 'render-ui', 'main']);
  });

  it('splits a sigil into prefix and name, and never enters a string or comment', () => {
    const tokens = lexLolo(';; @entity.x\n(set @entity.title "@entity.nope")');
    expect(tokens.filter((t) => t.kind === 'comment')).toHaveLength(1);
    expect(tokens.filter((t) => t.kind === 'sigil').map((t) => t.text)).toEqual(['entity.title']);
    expect(tokens.filter((t) => t.kind === 'string').map((t) => t.text)).toEqual(['"@entity.nope"']);
  });

  it('reads a payload sigil separately from a binding sigil', () => {
    const kinds = lexLolo('(set @entity.id ?row)').map((t) => t.kind);
    expect(kinds).toContain('sigil');
    expect(kinds).toContain('payload-sigil');
  });
});

describe('localizeMap', () => {
  it('is the identity for English', () => {
    for (const [english, native] of localizeMap('en')) expect(native).toBe(english);
  });

  it('omits a translation the parser would read back as a different word', () => {
    // Arabic has no letter case: `event` and `Event` are both `حدث`, and
    // `canon_any` resolves that to the keyword. See G-i18n-1.
    const ar = localizeMap('ar');
    expect(ar.get('event')).toBe(coreTables.ar.keywords.event);
    expect(ar.get('Event')).toBeUndefined();
    // Slovenian keeps the case distinction, so the shape survives.
    expect(localizeMap('sl').get('Event')).toBe(coreTables.sl.shapes.Event);
  });
});

describe('localizeLoloSource', () => {
  it('returns English unchanged', () => {
    expect(localizeLoloSource(SAMPLE, 'en')).toBe(SAMPLE);
  });

  it.each(['ar', 'sl'] as const)('translates the vocabulary of %s', (lang) => {
    const out = localizeLoloSource(SAMPLE, lang, { operators: operatorsFor(lang) });
    const t = coreTables[lang];
    expect(out).toContain(t.keywords.app);
    expect(out).toContain(t.keywords.orbital);
    expect(out).toContain(t.keywords.entity);
    expect(out).toContain(t.keywords.trait);
    expect(out).toContain(t.keywords.state);
    expect(out).toContain(t.keywords.page);
    expect(out).toContain(t.tags.persistent);
    expect(out).toContain(t.categories.interaction);
    expect(out).toContain(t.types.string);
    expect(out).toContain(t.effects.fetch);
    expect(out).toContain(t.effects['render-ui']);
    expect(out).toContain(t.effects.set);
    expect(out).toContain(t.sigils.entity);
    expect(out).toContain(t.literals.true);
    expect(out).toContain(t.reservedEvents.INIT);
  });

  it.each(['ar', 'sl'] as const)('leaves every author identifier alone in %s', (lang) => {
    const out = localizeLoloSource(SAMPLE, lang, { operators: operatorsFor(lang) });
    for (const name of ['TaskApp', 'TaskManager', 'Task', 'tasks', 'TaskBrowser', 'active', 'COMPLETE']) {
      expect(out).toContain(name);
    }
  });

  it.each(['ar', 'sl'] as const)('leaves pattern props opaque in %s', (lang) => {
    // `parse_object_literal` reads object keys verbatim, so a prop that spells
    // a keyword (`type`, `entity`, `fields`) must survive untranslated.
    const out = localizeLoloSource(SAMPLE, lang, { operators: operatorsFor(lang) });
    expect(out).toContain('{ type: "entity-table", entity: "Task", fields: ["title", "completed"] }');
  });

  it.each(['ar', 'sl'] as const)('never translates a field name that spells a keyword (%s)', (lang) => {
    const source = 'app A "1"\norbital O {\n  entity E [runtime] {\n    state : string\n    name : string\n    event : string\n  }\n}\n';
    const out = localizeLoloSource(source, lang, { operators: operatorsFor(lang) });
    expect(out).toContain('state : ');
    expect(out).toContain('name : ');
    expect(out).toContain('event : ');
  });

  it.each(['ar', 'sl'] as const)('never translates a let binding name that spells an effect (%s)', (lang) => {
    // `(let ((match …)) …)` — `match` is the author's variable, not the
    // match operator, even though it sits right after a `(`.
    const source = 'app A "1"\norbital O {\n  entity E [runtime] { id : string }\n  trait T -> E [interaction] {\n    initial: s\n    state s {\n      INIT -> s\n        (let ((match (array/first @items))) (set @entity.id @match))\n    }\n  }\n}\n';
    const out = localizeLoloSource(source, lang, { operators: operatorsFor(lang) });
    expect(out).toContain('(match ');
    expect(out).toContain('@match');
  });

  it.each(['ar', 'sl'] as const)('keeps symbolic operators as symbols in %s', (lang) => {
    const source = 'app A "1"\norbital O {\n  entity E [runtime] { n : number }\n  trait T -> E [interaction] {\n    initial: s\n    state s {\n      INIT -> s when (>= @entity.n 1)\n        (set @entity.n (+ @entity.n 1))\n    }\n  }\n}\n';
    const out = localizeLoloSource(source, lang, { operators: operatorsFor(lang) });
    expect(out).toContain('(>= ');
    expect(out).toContain('(+ ');
  });

  it.each(['ar', 'sl'] as const)('preserves comments, blank lines and alignment in %s', (lang) => {
    const source = ';; a comment about state\napp A "1"\n\norbital O {\n  entity E [runtime] {\n    id    : string\n    title : string\n  }\n}\n';
    const out = localizeLoloSource(source, lang, { operators: operatorsFor(lang) });
    expect(out).toContain(';; a comment about state');
    expect(out.split('\n')).toHaveLength(source.split('\n').length);
    expect(out).toMatch(/id {4}: /);
  });
});

describe('localizeOrbValue', () => {
  it.each(['ar', 'sl'] as const)('rewrites keys, type values, heads and sigil roots for %s', (lang) => {
    const t = coreTables[lang];
    const out = localizeOrbValue(
      { orbitals: [{ name: 'Demo', entity: { name: 'Task', fields: [{ name: 'title', type: 'string' }] } }] },
      lang,
    );
    const json = JSON.stringify(out);
    expect(json).toContain(t.orb.orbitals);
    expect(json).toContain(t.types.string);
    // A user's name is a value, not a key — untouched.
    expect(json).toContain('"Demo"');
    expect(json).toContain('"Task"');
  });

  it('translates an s-expression head but not its arguments', () => {
    const out = localizeOrbValue({ effects: [['set', '@entity.title', 'set']] }, 'sl');
    expect(JSON.stringify(out)).toContain(coreTables.sl.effects.set);
    // The trailing "set" is a string VALUE and must survive.
    expect(JSON.stringify(out)).toContain('"set"');
  });

  it('returns English unchanged', () => {
    const value = { orbitals: [{ name: 'Demo' }] };
    expect(localizeOrbValue(value, 'en')).toBe(value);
  });
});
