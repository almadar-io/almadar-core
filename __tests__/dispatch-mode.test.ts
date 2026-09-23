/**
 * `DispatchMode` / `computeDispatchMode` — the TS mirror of `orbital-core`'s
 * `runtime::dispatch_mode::compute` (`orbital-rust/crates/orbital-core/src/
 * runtime/dispatch_mode.rs`). Row for row against that file's own tests
 * (cited by name below); this package cannot read the Rust source at test
 * time (package tests never climb to siblings), so the matrix is encoded
 * literally here instead.
 */

import { describe, it, expect } from 'vitest';
import {
    computeDispatchMode,
    computeTraitDispatchMode,
    DispatchModeSchema,
    type DispatchMode,
    type Entity,
} from '../index';

describe('computeDispatchMode', () => {
    // Rust: dispatch_mode_local_wins
    it('local wins over every entity-persistence combination', () => {
        expect(computeDispatchMode(true, true)).toBe<DispatchMode>('hybridClientOnly');
        expect(computeDispatchMode(true, false)).toBe<DispatchMode>('hybridClientOnly');
    });

    // Rust: dispatch_mode_runtime_entity_when_not_local
    it('a non-local trait on a [runtime] entity dispatches optimistically', () => {
        expect(computeDispatchMode(false, true)).toBe<DispatchMode>('runtimeOptimistic');
    });

    // Rust: dispatch_mode_persisted_awaited_default
    it('a non-local trait on a non-runtime entity awaits the server by default', () => {
        expect(computeDispatchMode(false, false)).toBe<DispatchMode>('persistedAwaited');
    });

    it('covers the full (local, entityIsRuntime) matrix', () => {
        const matrix: Array<{ local: boolean; entityIsRuntime: boolean; expected: DispatchMode }> = [
            { local: true, entityIsRuntime: true, expected: 'hybridClientOnly' },
            { local: true, entityIsRuntime: false, expected: 'hybridClientOnly' },
            { local: false, entityIsRuntime: true, expected: 'runtimeOptimistic' },
            { local: false, entityIsRuntime: false, expected: 'persistedAwaited' },
        ];
        for (const { local, entityIsRuntime, expected } of matrix) {
            expect(computeDispatchMode(local, entityIsRuntime), `local=${local} entityIsRuntime=${entityIsRuntime}`).toBe(
                expected,
            );
        }
    });

    it('every DispatchMode value round-trips through the Zod schema', () => {
        const modes: DispatchMode[] = ['persistedAwaited', 'hybridClientOnly', 'runtimeOptimistic'];
        for (const mode of modes) {
            expect(DispatchModeSchema.safeParse(mode).success).toBe(true);
        }
        expect(DispatchModeSchema.safeParse('somethingElse').success).toBe(false);
    });
});

describe('computeTraitDispatchMode', () => {
    const runtimeEntity: Entity = { name: 'Session', persistence: 'runtime', fields: [] };
    const persistentEntity: Entity = { name: 'Order', persistence: 'persistent', fields: [] };
    const defaultPersistenceEntity: Entity = { name: 'Order', fields: [] };

    it('a local trait is hybridClientOnly regardless of the linked entity', () => {
        expect(computeTraitDispatchMode({ local: true }, runtimeEntity)).toBe<DispatchMode>('hybridClientOnly');
        expect(computeTraitDispatchMode({ local: true }, persistentEntity)).toBe<DispatchMode>('hybridClientOnly');
        expect(computeTraitDispatchMode({ local: true }, undefined)).toBe<DispatchMode>('hybridClientOnly');
    });

    it('a non-local trait linked to a [runtime] entity is runtimeOptimistic', () => {
        expect(computeTraitDispatchMode({ local: false }, runtimeEntity)).toBe<DispatchMode>('runtimeOptimistic');
    });

    it('a non-local trait linked to a persistent entity is persistedAwaited', () => {
        expect(computeTraitDispatchMode({ local: false }, persistentEntity)).toBe<DispatchMode>('persistedAwaited');
        expect(computeTraitDispatchMode({ local: false }, defaultPersistenceEntity)).toBe<DispatchMode>(
            'persistedAwaited',
        );
    });

    it('an unlinked/unresolved entity (undefined) is treated as not-runtime, matching Rust `None`', () => {
        expect(computeTraitDispatchMode({ local: false }, undefined)).toBe<DispatchMode>('persistedAwaited');
    });

    it('undeclared `local` (undefined) behaves like `local: false`', () => {
        expect(computeTraitDispatchMode({}, runtimeEntity)).toBe<DispatchMode>('runtimeOptimistic');
        expect(computeTraitDispatchMode({}, undefined)).toBe<DispatchMode>('persistedAwaited');
    });
});
