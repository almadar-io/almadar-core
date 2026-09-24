/**
 * lolo-document: the structural index + byte-preserving span edits every
 * `.lolo` editor shares (Kura's scene editor, the designer on compose orbitals).
 */
import { describe, expect, it } from 'vitest';
import {
  addEntityFields,
  addListens,
  addTraitRef,
  addUses,
  aliasForBehavior,
  appendPageTrait,
  applyEdits,
  arrayElementSpans,
  formatLoloValue,
  parseLoloDocument,
  removePageTrait,
  removeTrait,
  renameEvent,
  setConfigArrayRow,
  setConfigValue,
} from '../src/lolo-document';

const SAMPLE = `app my-platformer "1.0.0"
"A platformer scene."

orbital MyLevelOrbital {
  uses Body from "std/behaviors/std-platformer-body"
  uses Gate from "std/behaviors/std-objective-flow"

  type LevelBody = { x : number!  y : number! }

  entity LevelState [runtime, shared] {
    id     : string!
    body   : LevelBody = { x: 2, y: 1 }
    result : string = "none"
  }

  trait Physics = Body.traits.PlatformerBody -> LevelState {
    events { STEER: MOVE  JUMP: LEAP }
    config {
      running: true
      gravity: -24
      platforms: [
        { id: "g0", x: 0, y: -2, width: 12, height: 3, type: "ground" }
        { id: "p1", x: 14, y: 3, width: 2, height: 0.4, type: "platform" }
      ]
    }
  }
  trait Flow = Gate.traits.ObjectiveFlow -> LevelState { config { running: true } }

  trait LevelPlay -> @rebindable LevelState [interaction, instance] {
    initial: idle
    state idle {
      INIT -> idle
        (render-ui main { type: game-shell })
    }
    listens { MOVE { dx : number! } }
    config {
      heroName : string = "riya"
        @label "Hero" @tier "presentation"
    }
  }

  page "/my-level" as MyLevelPage -> Physics, Flow, LevelPlay
}
`;

describe('parseLoloDocument', () => {
  it('indexes the sample scene', () => {
    const doc = parseLoloDocument(SAMPLE);
    expect(doc.app?.name).toBe('my-platformer');
    expect(doc.orbital.name).toBe('MyLevelOrbital');
    expect(doc.uses.map((u) => u.alias)).toEqual(['Body', 'Gate']);
    expect(doc.types.map((t) => t.name)).toEqual(['LevelBody']);
    expect(doc.entities[0].name).toBe('LevelState');
    expect(doc.entities[0].fields.map((f) => f.name)).toEqual(['id', 'body', 'result']);
    expect(doc.traits.map((t) => [t.name, t.inline])).toEqual([
      ['Physics', false],
      ['Flow', false],
      ['LevelPlay', true],
    ]);
    const physics = doc.traits[0];
    expect(physics.alias).toBe('Body');
    expect(physics.trait).toBe('PlatformerBody');
    expect(physics.entity).toBe('LevelState');
    expect(physics.events?.entries.map((e) => `${e.upstream}:${e.local}`)).toEqual(['STEER:MOVE', 'JUMP:LEAP']);
    expect(physics.config?.entries.map((e) => e.key)).toEqual(['running', 'gravity', 'platforms']);
    expect(physics.config?.entries[2].rawValue.startsWith('[')).toBe(true);
    expect(physics.config?.entries[2].rawValue.endsWith(']')).toBe(true);
    const play = doc.traits[2];
    expect(play.rebindable).toBe(true);
    expect(play.stateBlocks.map((s) => s.name)).toEqual(['idle']);
    expect(play.config?.entries[0]).toMatchObject({ key: 'heroName', type: 'string', rawValue: '"riya"' });
    expect(doc.pages[0]).toMatchObject({ path: '/my-level', name: 'MyLevelPage', traits: ['Physics', 'Flow', 'LevelPlay'] });
  });
});

describe('applyEdits', () => {
  it('rejects overlapping edits', () => {
    expect(() => applyEdits('abcdef', [{ start: 0, end: 3, insert: 'x' }, { start: 2, end: 4, insert: 'y' }])).toThrow();
  });
});

describe('mutations', () => {
  const doc = (): ReturnType<typeof parseLoloDocument> => parseLoloDocument(SAMPLE);
  const run = (edits: ReturnType<typeof addUses>): string => applyEdits(SAMPLE, edits);
  it('addUses appends after the last uses line and dedups', () => {
    const out = run(addUses(doc(), 'Particles', 'std/behaviors/std-fx-particles'));
    expect(out).toContain('  uses Gate from "std/behaviors/std-objective-flow"\n  uses Particles from "std/behaviors/std-fx-particles"\n');
    expect(addUses(doc(), 'Body', 'std/behaviors/std-platformer-body')).toEqual([]);
  });

  it('addTraitRef inserts before the page and appendPageTrait binds it', () => {
    const d = doc();
    const edits = [
      ...addTraitRef(d, { name: 'Fx', alias: 'Particles', trait: 'FxParticles', entity: 'LevelState', config: { running: true } }),
      ...appendPageTrait(d, '/my-level', 'Fx'),
    ];
    const out = run(edits);
    expect(out).toContain('  trait Fx = Particles.traits.FxParticles -> LevelState {\n    config {\n      running: true\n    }\n  }\n\n  page "/my-level"');
    expect(out).toContain('-> Physics, Flow, LevelPlay, Fx\n');
  });

  it('removeTrait drops the block, the page entry and the orphaned uses', () => {
    const out = run(removeTrait(doc(), 'Flow'));
    expect(out).not.toContain('trait Flow');
    expect(out).not.toContain('uses Gate');
    expect(out).toContain('-> Physics, LevelPlay\n');
    expect(out).toContain('uses Body');
  });

  it('removePageTrait keeps the others', () => {
    const out = run(removePageTrait(doc(), '/my-level', 'Flow'));
    expect(out).toContain('-> Physics, LevelPlay\n');
  });

  it('a trait-less page gains and loses its arrow with its first/last trait', () => {
    const empty = 'app Empty "1.0.0"\norbital Empty {\n  entity SceneState [runtime, shared] {\n    id : string!\n  }\n\n  page "/" as EmptyPage\n}\n';
    const parsed = parseLoloDocument(empty);
    expect(parsed.pages[0]?.arrowSpan).toBeUndefined();

    const bound = applyEdits(empty, appendPageTrait(parsed, '/', 'Fx'));
    expect(bound).toContain('  page "/" as EmptyPage -> Fx\n');
    const boundDoc = parseLoloDocument(bound);
    expect(boundDoc.pages[0]?.traits).toEqual(['Fx']);
    expect(boundDoc.pages[0]?.arrowSpan).toBeDefined();

    const unbound = applyEdits(bound, removePageTrait(boundDoc, '/', 'Fx'));
    expect(unbound).toBe(empty);
  });

  it('parses a page whose attributes follow the trait list, with and without an arrow', () => {
    const withArrow = parseLoloDocument('orbital S {\n  page "/" as P -> A, B [initial]\n}\n');
    expect(withArrow.pages[0]?.traits).toEqual(['A', 'B']);
    const bare = parseLoloDocument('orbital S {\n  page "/" as P [initial]\n}\n');
    expect(bare.pages[0]?.traits).toEqual([]);
    expect(applyEdits('orbital S {\n  page "/" as P [initial]\n}\n', appendPageTrait(bare, '/', 'A'))).toBe('orbital S {\n  page "/" as P -> A [initial]\n}\n');
  });

  it('setConfigValue replaces an existing scalar and adds a missing key', () => {
    const d = doc();
    const out = run([...setConfigValue(d, 'Physics', 'gravity', -9.8), ...setConfigValue(d, 'Physics', 'moveSpeed', 6)]);
    expect(out).toContain('      gravity: -9.8\n');
    expect(out).toContain('      moveSpeed: 6\n    }\n  }');
    expect(out).toContain('      platforms: [\n        { id: "g0"');
  });

  it('setConfigValue on a single-line config block expands it', () => {
    const out = run(setConfigValue(doc(), 'Flow', 'running', false));
    expect(out).toContain('trait Flow = Gate.traits.ObjectiveFlow -> LevelState { config { running: false } }');
  });

  it('setConfigValue on an inline trait writes the typed form', () => {
    const out = run(setConfigValue(doc(), 'LevelPlay', 'fxPresets', []));
    expect(out).toContain('      fxPresets : [object] = []\n    }\n  }\n\n  page');
  });

  it('setConfigArrayRow patches one row in place and appends unknown keys', () => {
    const d = doc();
    const out = run(setConfigArrayRow(d, 'Physics', 'platforms', 1, { x: 15.5, y: 3.25, rotation: 0.5 }));
    expect(out).toContain('{ id: "p1", x: 15.5, y: 3.25, width: 2, height: 0.4, type: "platform", rotation: 0.5 }');
    expect(out).toContain('{ id: "g0", x: 0, y: -2, width: 12, height: 3, type: "ground" }');
  });

  it('arrayElementSpans finds every element of a multi-line object array', () => {
    const d = doc();
    const entry = d.traits[0].config?.entries.find((e) => e.key === 'platforms');
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(arrayElementSpans(SAMPLE, entry.valueSpan).length).toBe(2);
  });

  it('renameEvent replaces an existing rename or adds one', () => {
    const d = doc();
    const out = run([...renameEvent(d, 'Physics', 'STEER', 'GO'), ...renameEvent(d, 'Physics', 'BODY_FELL', 'FELL')]);
    expect(out).toContain('STEER: GO');
    expect(out).toContain('BODY_FELL: FELL');
  });

  it('addListens restates the atom routes on a referenced trait and appends on an inline one', () => {
    const d = doc();
    const refEdits = addListens(d, 'Flow', { source: 'Physics', event: 'BODY_GOAL', local: 'PROGRESS' }, [
      { source: 'Physics', event: 'BODY_HAZARD', local: 'RESTART' },
    ]);
    const out = run(refEdits);
    expect(out).toContain('    listens {\n      Physics.BODY_HAZARD -> RESTART\n      Physics.BODY_GOAL -> PROGRESS\n    }\n');
    const inl = run(addListens(d, 'LevelPlay', { source: 'Physics', event: 'BODY_GOAL', local: 'WIN' }));
    expect(inl).toContain('listens { MOVE { dx : number! }\n      Physics.BODY_GOAL -> WIN\n    }');
  });

  it('addEntityFields appends only missing fields', () => {
    const out = run(addEntityFields(doc(), 'LevelState', [
      { name: 'result', type: 'string' },
      { name: 'fx', type: '[object]', default: [] },
      { name: 'score', type: 'number', default: 0 },
    ]));
    expect(out).toContain('    result : string = "none"\n    fx : [object] = []\n    score : number = 0\n  }');
  });
});

describe('formatLoloValue', () => {
  it('renders the corpus literal style', () => {
    expect(formatLoloValue('a"b')).toBe('"a\\"b"');
    expect(formatLoloValue({ id: 's1', x: 6, star: true })).toBe('{ id: "s1", x: 6, star: true }');
    expect(formatLoloValue(['idle', 'walk'])).toBe('["idle" "walk"]');
    expect(formatLoloValue([{ id: 'a' }, { id: 'b' }], '    ')).toBe('[\n      { id: "a" }\n      { id: "b" }\n    ]');
    expect(formatLoloValue([])).toBe('[]');
    expect(formatLoloValue(null)).toBe('null');
  });
});

describe('aliasForBehavior', () => {
  it('turns a kebab behavior name into the identifier form USES_RE indexes', () => {
    expect(aliasForBehavior('std-arcade-flow')).toBe('StdArcadeFlow');
    expect(aliasForBehavior('ui-canvas-2d')).toBe('UiCanvas2d');
    expect(aliasForBehavior('std-fx-particles')).toBe('StdFxParticles');
  });
});

describe('applyEdits identity', () => {
  it('is the identity with no edits (byte-identical round trip)', () => {
    expect(applyEdits(SAMPLE, [])).toBe(SAMPLE);
  });
});
