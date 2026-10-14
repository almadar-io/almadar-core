import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  BehaviorPackageError,
  readBehaviorPackage,
  behaviorRegistryDir,
  behaviorProgramFiles,
  resolveDeclaredFile,
  type BehaviorPackageOrbBlock,
} from '../src/behavior-package.js';

const ORB: BehaviorPackageOrbBlock = {
  prefix: 'almadar-test',
  registry: 'behaviors/registry',
  index: 'dist/behaviors-registry.json',
  loloContracts: 'behaviors/lolo-behavior-contracts.json',
  embeddings: ['dist/behaviors-embeddings.json'],
  compiler: '>=4.10.0',
};

function fakePackage(orb: BehaviorPackageOrbBlock | undefined, files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'behavior-package-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@test/pkg', version: '1.0.0', orb }));
  for (const rel of files) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), '{}');
  }
  return root;
}

describe('orb block without signatures', () => {
  it('reads a package that declares no signatures file', () => {
    const pkg = readBehaviorPackage(fakePackage(ORB, []));
    expect(pkg.orb.prefix).toBe('almadar-test');
  });

  it('control: a package published with the retired factorySignatures key still reads, the key ignored', () => {
    const pkg = readBehaviorPackage(fakePackage({ ...ORB, factorySignatures: 'dist/registry/factory-signatures.json' } as BehaviorPackageOrbBlock, []));
    expect(pkg.orb.prefix).toBe('almadar-test');
    expect('factorySignatures' in pkg.orb).toBe(false);
  });
});

describe('readBehaviorPackage', () => {
  it('reads the declared orb block of a package root', () => {
    const root = fakePackage(ORB, []);
    const pkg = readBehaviorPackage(root);
    expect(pkg.name).toBe('@test/pkg');
    expect(pkg.orb.index).toBe('dist/behaviors-registry.json');
  });

  it('refuses a malformed orb block (missing a declared key)', () => {
    const root = mkdtempSync(join(tmpdir(), 'behavior-package-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@test/pkg', orb: { prefix: 'x' } }));
    expect(() => readBehaviorPackage(root)).toThrow(/malformed/);
  });

  it('refuses a package.json without an orb block', () => {
    const root = fakePackage(undefined, []);
    expect(() => readBehaviorPackage(root)).toThrow(BehaviorPackageError);
  });
});

describe('resolveDeclaredFile', () => {
  it('resolves a declared single-file key to an absolute path that exists', () => {
    const root = fakePackage(ORB, ['behaviors/lolo-behavior-contracts.json']);
    const file = resolveDeclaredFile(readBehaviorPackage(root), 'loloContracts');
    expect(file).toBe(join(root, 'behaviors/lolo-behavior-contracts.json'));
  });

  it('resolves the registry directory key', () => {
    const root = fakePackage(ORB, ['behaviors/registry/app/atoms/x.orb']);
    expect(behaviorRegistryDir(readBehaviorPackage(root))).toBe(join(root, 'behaviors/registry'));
  });

  it('fails when the declared file is missing — no layout guess, no fallback copy', () => {
    const root = fakePackage(ORB, ['behaviors/registry/lolo-behavior-contracts.json']);
    expect(() => resolveDeclaredFile(readBehaviorPackage(root), 'loloContracts')).toThrow(/loloContracts/);
  });

  it('refuses a declared path that escapes the package root', () => {
    const root = fakePackage({ ...ORB, index: '../outside.json' }, []);
    expect(() => resolveDeclaredFile(readBehaviorPackage(root), 'index')).toThrow(/outside the package/);
  });
});

describe('behaviorProgramFiles', () => {
  const declared = ['dist/behaviors-registry.json', 'behaviors/lolo-behavior-contracts.json', 'behaviors/signatures.lolo', 'dist/behaviors-embeddings.json'];

  it('maps every program under the registry, nested folders included, to its file by basename', () => {
    const root = fakePackage(ORB, [...declared, 'behaviors/registry/app/atoms/std-a.orb', 'behaviors/registry/websites/atoms/blog/std-b.orb', 'behaviors/registry/ui/core/templates/ui-c.orb']);
    const files = behaviorProgramFiles(readBehaviorPackage(root));
    expect([...files.keys()].sort()).toEqual(['std-a', 'std-b', 'ui-c']);
    expect(files.get('std-b')).toBe(join(root, 'behaviors/registry/websites/atoms/blog/std-b.orb'));
  });

  it('control: files that are not programs are not behaviors', () => {
    const root = fakePackage(ORB, [...declared, 'behaviors/registry/app/atoms/std-a.orb', 'behaviors/registry/notes.json', 'behaviors/registry/app/atoms/README.md']);
    expect([...behaviorProgramFiles(readBehaviorPackage(root)).keys()]).toEqual(['std-a']);
  });

  it('edge: two programs with one name are refused, naming both files', () => {
    const root = fakePackage(ORB, [...declared, 'behaviors/registry/app/atoms/std-a.orb', 'behaviors/registry/game/atoms/std-a.orb']);
    expect(() => behaviorProgramFiles(readBehaviorPackage(root))).toThrow(/std-a.*app\/atoms.*game\/atoms|std-a.*game\/atoms.*app\/atoms/);
  });
});
