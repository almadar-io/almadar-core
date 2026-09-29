/**
 * The L1 contract slice of a behavior package: from its factory signatures when a behavior has
 * one, else from its `.orb` alone (a template, or a behavior published from the Studio), plus the
 * orbital- and app-level config every `.orb` declares.
 */
import { describe, it, expect } from 'vitest';
import type { FactorySignatureCatalog } from '../src/factory/types.js';
import { buildLoloBehaviorContracts, serializeLoloBehaviorContracts } from '../src/factory/lolo-behavior-contracts.js';

const empty: FactorySignatureCatalog = { generatedFromStdVersion: '0.0.0', signatures: [] };

const hiveLog = {
  name: 'hive-log',
  config: { accent: { type: 'string', default: 'amber' } },
  orbitals: [{
    name: 'HiveOrbital',
    config: { limit: { default: 10 } },
    pages: [{ name: 'HivesPage' }],
    traits: [{ name: 'HiveBrowse', entityContract: { requires: ['name', 'status'] }, config: { columns: { default: ['name'] }, dense: { default: false } } }],
  }],
};

describe('buildLoloBehaviorContracts', () => {
  it('a behavior with no factory signature takes its slice from its .orb', () => {
    const slice = buildLoloBehaviorContracts([empty], [{ name: 'hive-log', orb: hiveLog }]);
    expect(slice['hive-log']).toEqual({
      traits: { HiveBrowse: { requires: ['name', 'status'], config: { columns: 'array', dense: 'boolean' } } },
      pages: ['HivesPage'],
      orbitals: { HiveOrbital: { config: { limit: 'number' } } },
      appConfig: { accent: 'string' },
    });
  });

  it('control: a behavior with a factory signature keeps its signature\'s traits and pages, and still gets the .orb config', () => {
    const catalog: FactorySignatureCatalog = {
      generatedFromStdVersion: '1.0.0',
      signatures: [{
        organism: 'hive-log',
        orbital: 'HiveOrbital',
        tier: 'organisms',
        factoryPath: 'functions/hive-log.ts',
        entities: [],
        traits: [{
          name: 'FromSignature',
          emittedEvents: [],
          listenedEvents: [],
          overridableConfigKeys: [{ key: 'size', type: 'integer' }],
          capabilities: [],
          entityContract: { requires: ['id'], provides: [] },
        }],
        pages: [{ name: 'SigPage', defaultPath: '/sig', primaryEntity: 'Hive' }],
        emittedEvents: [],
        listenedEvents: [],
      }],
    };
    const slice = buildLoloBehaviorContracts([catalog], [{ name: 'hive-log', orb: hiveLog }]);
    expect(slice['hive-log']?.traits).toEqual({ FromSignature: { requires: ['id'], config: { size: 'number' } } });
    expect(slice['hive-log']?.pages).toEqual(['SigPage']);
    expect(slice['hive-log']?.appConfig).toEqual({ accent: 'string' });
  });

  it('serializes key-sorted, so the sidecar is byte-stable', () => {
    const a = serializeLoloBehaviorContracts(buildLoloBehaviorContracts([empty], [{ name: 'hive-log', orb: hiveLog }]));
    expect(a.indexOf('"appConfig"')).toBeLessThan(a.indexOf('"orbitals"'));
    expect(serializeLoloBehaviorContracts(buildLoloBehaviorContracts([empty], [{ name: 'hive-log', orb: hiveLog }]))).toBe(a);
  });
});
