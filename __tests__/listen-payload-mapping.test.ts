import { describe, it, expect } from 'vitest';
import { applyListenPayloadMapping } from '../src/listen-payload-mapping';

describe('applyListenPayloadMapping', () => {
    it('maps @payload.<field> references onto target fields', () => {
        expect(
            applyListenPayloadMapping(
                { searchTerm: '@payload.value' },
                { value: 'algebra' },
            ),
        ).toEqual({ searchTerm: 'algebra' });
    });

    it('delivers non-@payload values as literals', () => {
        expect(
            applyListenPayloadMapping(
                { message: 'order shipped', id: '@payload.orderId' },
                { orderId: 'o-1' },
            ),
        ).toEqual({ message: 'order shipped', id: 'o-1' });
    });

    it('drops unmapped source fields (the mapping replaces the payload)', () => {
        expect(
            applyListenPayloadMapping(
                { searchTerm: '@payload.value' },
                { value: 'x', extra: 'y' },
            ),
        ).toEqual({ searchTerm: 'x' });
    });

    it('passes the payload through when there is no mapping', () => {
        const payload = { value: 'x' };
        expect(applyListenPayloadMapping(undefined, payload)).toBe(payload);
    });

    it('passes undefined payload through untouched (mapping not applied)', () => {
        expect(
            applyListenPayloadMapping({ searchTerm: '@payload.value' }, undefined),
        ).toBeUndefined();
    });

    it('maps a missing source field to undefined', () => {
        expect(
            applyListenPayloadMapping({ searchTerm: '@payload.value' }, { other: 1 }),
        ).toEqual({ searchTerm: undefined });
    });
});
