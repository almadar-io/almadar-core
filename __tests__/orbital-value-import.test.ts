import { describe, it, expect } from 'vitest';
import { orbitalImportFromValue, parseProgram } from '../src/builders';
import type { OrbitalValue } from '../src/types/behavior-value';

const tasks: OrbitalValue = {
  behavior: 'almadar-std/std-kanban',
  orbital: 'KanbanOrbital',
  name: 'Tasks',
  entity: 'Task',
  config: { pageSize: 20 },
  extend: [{ name: 'priority', type: 'string' }],
  traits: { KanbanBoard: { config: { compact: true }, events: { MOVE: 'SHIFT' } } },
};

describe('orbitalImportFromValue', () => {
  it('builds the §8b import orbital, wrapping plain config into the IR declaration form', () => {
    expect(orbitalImportFromValue(tasks)).toEqual({
      name: 'Tasks',
      uses: [{ from: 'almadar-std/std-kanban', as: 'Source' }],
      entity: 'Source.orbitals.KanbanOrbital.entity',
      traits: [],
      pages: [],
      reference: {
        ref: 'Source.orbitals.KanbanOrbital',
        entity: 'Task',
        extend: [{ name: 'priority', type: 'string' }],
        config: { pageSize: { type: 'unknown', default: 20 } },
        traits: { KanbanBoard: { config: { compact: { type: 'unknown', default: true } }, events: { MOVE: 'SHIFT' } } },
      },
    });
  });

  it('carries the source behavior\'s app knobs as the import\'s uses config', () => {
    const imported = orbitalImportFromValue({ behavior: 'almadar-behaviors/std-store-solution', orbital: 'ProductOrbital', app: { appName: 'Candles' } });
    expect(imported.uses).toEqual([{ from: 'almadar-behaviors/std-store-solution', as: 'Source', config: { appName: { type: 'unknown', default: 'Candles' } } }]);
    expect(imported.reference).toEqual({ ref: 'Source.orbitals.ProductOrbital' });
  });

  it('control: a bare value imports under its upstream name with an empty body', () => {
    expect(orbitalImportFromValue({ behavior: 'almadar-std/std-kanban', orbital: 'KanbanOrbital' })).toEqual({
      name: 'KanbanOrbital',
      uses: [{ from: 'almadar-std/std-kanban', as: 'Source' }],
      entity: 'Source.orbitals.KanbanOrbital.entity',
      traits: [],
      pages: [],
      reference: { ref: 'Source.orbitals.KanbanOrbital' },
    });
  });
});

describe('parseProgram', () => {
  const inline = {
    name: 'Inline',
    entity: { name: 'Note', persistence: 'runtime', fields: [{ name: 'id', type: 'string' }] },
    traits: [],
    pages: [],
  };

  it('turns orbital values into import orbitals and keeps inline orbitals in place, in order', () => {
    const program = parseProgram({ name: 'App', orbitals: [inline, { behavior: 'almadar-std/std-kanban', orbital: 'KanbanOrbital', name: 'Tasks' }] });
    expect(program.orbitals.map((o) => o.name)).toEqual(['Inline', 'Tasks']);
    expect(program.orbitals[1]?.reference?.ref).toBe('Source.orbitals.KanbanOrbital');
  });

  it('a program made only of orbital values parses', () => {
    const program = parseProgram({ name: 'App', orbitals: [{ behavior: 'almadar-std/std-kanban', orbital: 'KanbanOrbital' }] });
    expect(program.orbitals.map((o) => o.name)).toEqual(['KanbanOrbital']);
  });

  it('control: an orbital value with a key the import form lacks is refused', () => {
    expect(() => parseProgram({ name: 'App', orbitals: [{ behavior: 'almadar-std/std-kanban', orbital: 'KanbanOrbital', notAKey: 1 }] })).toThrow();
  });

  it('control: a program with no orbital values parses exactly as parseOrbitalSchema would', () => {
    expect(parseProgram({ name: 'App', orbitals: [inline] }).orbitals[0]?.name).toBe('Inline');
  });
});
