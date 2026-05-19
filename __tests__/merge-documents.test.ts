/**
 * Phase 5 — `mergeDocuments(base, overlay)` overlay reducer tests.
 *
 * Covers the five fixture cases the plan enumerates:
 *   1. Empty overlay → deep-copy base.
 *   2. Empty base    → deep-copy overlay.
 *   3. Overlapping entity by name → overlay replaces base entry.
 *   4. Overlapping page by name   → overlay replaces base entry.
 *   5. Disjoint entities + pages   → union, base order preserved.
 */

import { describe, expect, it } from 'vitest';
import {
  mergeDocuments,
  type DomainDocument,
  type DomainEntity,
  type DomainPage,
} from '../src/domain-language/index.js';

const emptyDoc: DomainDocument = {
  type: 'document',
  entities: [],
  pages: [],
  behaviors: [],
};

function makeEntity(name: string, fields: string[] = []): DomainEntity {
  return {
    type: 'entity',
    name,
    description: '',
    fields: fields.map((f) => ({
      type: 'field',
      name: f,
      fieldType: 'text',
      required: false,
      unique: false,
      auto: false,
    })),
    relationships: [],
  };
}

function makePage(name: string, url: string): DomainPage {
  return {
    type: 'page',
    name,
    description: '',
    purpose: '',
    url,
    sections: [],
    actions: [],
  };
}

describe('mergeDocuments', () => {
  it('returns a deep-copy of base when overlay is empty', () => {
    const base: DomainDocument = {
      type: 'document',
      entities: [makeEntity('Product', ['name', 'price'])],
      pages: [makePage('ProductPage', '/products')],
      behaviors: [],
    };
    const merged = mergeDocuments(base, emptyDoc);
    expect(merged.entities).toHaveLength(1);
    expect(merged.entities[0].name).toBe('Product');
    expect(merged.entities[0].fields.map((f) => f.name)).toEqual(['name', 'price']);
    expect(merged.pages).toHaveLength(1);
    expect(merged.pages[0].url).toBe('/products');
  });

  it('returns a deep-copy of overlay when base is empty', () => {
    const overlay: DomainDocument = {
      type: 'document',
      entities: [makeEntity('Cart')],
      pages: [makePage('CartPage', '/cart')],
      behaviors: [],
    };
    const merged = mergeDocuments(emptyDoc, overlay);
    expect(merged.entities[0].name).toBe('Cart');
    expect(merged.pages[0].name).toBe('CartPage');
  });

  it('overlay entity replaces base entity with the same name', () => {
    const base: DomainDocument = {
      type: 'document',
      entities: [makeEntity('Product', ['name'])],
      pages: [],
      behaviors: [],
    };
    const overlay: DomainDocument = {
      type: 'document',
      entities: [
        { ...makeEntity('Product', ['name', 'price']), collection: 'catalog' },
      ],
      pages: [],
      behaviors: [],
    };
    const merged = mergeDocuments(base, overlay);
    expect(merged.entities).toHaveLength(1);
    expect(merged.entities[0].fields.map((f) => f.name)).toEqual(['name', 'price']);
    expect(merged.entities[0].collection).toBe('catalog');
  });

  it('overlay page replaces base page with the same name', () => {
    const base: DomainDocument = {
      type: 'document',
      entities: [],
      pages: [makePage('Catalog', '/products')],
      behaviors: [],
    };
    const overlay: DomainDocument = {
      type: 'document',
      entities: [],
      pages: [makePage('Catalog', '/shop')],
      behaviors: [],
    };
    const merged = mergeDocuments(base, overlay);
    expect(merged.pages).toHaveLength(1);
    expect(merged.pages[0].url).toBe('/shop');
  });

  it('unions disjoint entities + pages, base order preserved, overlay-only appended', () => {
    const base: DomainDocument = {
      type: 'document',
      entities: [makeEntity('Product'), makeEntity('Cart')],
      pages: [makePage('ProductPage', '/products')],
      behaviors: [],
    };
    const overlay: DomainDocument = {
      type: 'document',
      entities: [makeEntity('Wishlist')],
      pages: [makePage('WishlistPage', '/wishlist')],
      behaviors: [],
    };
    const merged = mergeDocuments(base, overlay);
    expect(merged.entities.map((e) => e.name)).toEqual(['Product', 'Cart', 'Wishlist']);
    expect(merged.pages.map((p) => p.name)).toEqual(['ProductPage', 'WishlistPage']);
  });

  it('does not mutate either input', () => {
    const base: DomainDocument = {
      type: 'document',
      entities: [makeEntity('Product', ['name'])],
      pages: [],
      behaviors: [],
    };
    const overlay: DomainDocument = {
      type: 'document',
      entities: [makeEntity('Product', ['name', 'price'])],
      pages: [],
      behaviors: [],
    };
    const baseCopy = JSON.stringify(base);
    const overlayCopy = JSON.stringify(overlay);
    mergeDocuments(base, overlay);
    expect(JSON.stringify(base)).toBe(baseCopy);
    expect(JSON.stringify(overlay)).toBe(overlayCopy);
  });
});
