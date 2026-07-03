import { describe, expect, it } from 'vitest';

import { mergeEntityFrame } from '../src/shared-entity/merge.js';
import type { EntityFrameState } from '../src/shared-entity/merge.js';

describe('mergeEntityFrame', () => {
    it('preserves fields untouched by the writes (field-level, not whole-object replace)', () => {
        const current: EntityFrameState = { x: 1 };

        const next = mergeEntityFrame(current, [
            { field: 'y', value: 2 },
            { field: 'fx', value: 0.5 },
        ]);

        expect(next).toEqual({ x: 1, y: 2, fx: 0.5 });
    });

    it('lets a later write to the same field win over an earlier one', () => {
        const next = mergeEntityFrame({}, [
            { field: 'x', value: 1 },
            { field: 'x', value: 2 },
        ]);

        expect(next.x).toBe(2);
    });

    it('returns the same reference when there are no writes', () => {
        const current: EntityFrameState = { x: 1 };

        expect(mergeEntityFrame(current, [])).toBe(current);
    });
});
