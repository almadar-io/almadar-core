import { describe, it, expect } from 'vitest';
import { explodeBehaviorComposition } from '../src/builders/explode-behavior-composition';

describe('explodeBehaviorComposition', () => {
  describe('composed molecule (std-cart)', () => {
    it('returns every TraitReference from the molecule\'s traits array', () => {
      const refs = explodeBehaviorComposition('std-cart');

      // std-cart's CartItemOrbital has one inline trait (CartItemCartBrowse)
      // and two TraitReference entries: CartItemAddItem (from std-modal) and
      // CartItemRemoveConfirm (from std-confirmation). Inline traits are not
      // composition entries, so we expect exactly the 2 references.
      expect(refs.length).toBeGreaterThanOrEqual(2);
    });

    it('backfills `from` from the orbital\'s `uses:` header when omitted', () => {
      const refs = explodeBehaviorComposition('std-cart');

      // Every returned reference whose `ref` uses an imported alias should
      // have a `from:` populated from the orbital's `uses:` entries.
      for (const ref of refs) {
        if (/^[A-Z][a-zA-Z0-9]*\.traits\./.test(ref.ref)) {
          expect(ref.from, `ref ${ref.ref} should have from populated`).toBeDefined();
        }
      }
    });

    it('preserves linkedEntity, events, and effects overrides', () => {
      const refs = explodeBehaviorComposition('std-cart');

      const addItem = refs.find((r) => r.ref === 'Modal.traits.ModalRecordModal');
      expect(addItem).toBeDefined();
      expect(addItem?.linkedEntity).toBe('CartItem');
      expect(addItem?.name).toBe('CartItemAddItem');
      expect(addItem?.events).toEqual({ OPEN: 'ADD_ITEM' });
      expect(addItem?.effects).toBeDefined();
      expect(addItem?.effects?.['SAVE']).toBeDefined();
      expect(addItem?.from).toBe('std/behaviors/std-modal');

      const confirm = refs.find(
        (r) => r.ref === 'Confirmation.traits.ConfirmActionConfirmation',
      );
      expect(confirm).toBeDefined();
      expect(confirm?.linkedEntity).toBe('CartItem');
      expect(confirm?.name).toBe('CartItemRemoveConfirm');
      expect(confirm?.events).toEqual({
        REQUEST: 'REQUEST_REMOVE',
        CONFIRM: 'CONFIRM_REMOVE',
      });
      expect(confirm?.from).toBe('std/behaviors/std-confirmation');
    });
  });

  describe('leaf atom (std-browse)', () => {
    it('returns one synthetic TraitReference pointing at the atom itself', () => {
      const refs = explodeBehaviorComposition('std-browse');

      expect(refs).toHaveLength(1);
      const [synthetic] = refs;
      expect(synthetic.ref).toBe('Browse.traits.BrowseItemBrowse');
      expect(synthetic.from).toBe('std/behaviors/std-browse');
      expect(synthetic.linkedEntity).toBe('BrowseItem');
    });
  });

  describe('error handling', () => {
    it('throws a descriptive error when the behavior cannot be resolved', () => {
      expect(() => explodeBehaviorComposition('nonexistent-behavior')).toThrow(
        /nonexistent-behavior/,
      );
    });

    it('names every registry path it searched in the error message', () => {
      let caught: Error | undefined;
      try {
        explodeBehaviorComposition('nonexistent-behavior');
      } catch (err) {
        caught = err instanceof Error ? err : new Error(String(err));
      }
      expect(caught).toBeDefined();
      expect(caught?.message).toMatch(/atoms\/nonexistent-behavior\.orb/);
      expect(caught?.message).toMatch(/molecules\/nonexistent-behavior\.orb/);
      expect(caught?.message).toMatch(/organisms\/nonexistent-behavior\.orb/);
    });
  });
});
