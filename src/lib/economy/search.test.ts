import { describe, expect, it } from 'vitest';
import type { ItemMapping } from '@/lib/api/prices';
import { normaliseQuery, searchItems } from './search';

function item(id: number, name: string): ItemMapping {
  return {
    id,
    name,
    examine: '',
    members: true,
    value: 1,
    icon: '',
  };
}

const MAPPING: ItemMapping[] = [
  item(1, 'Rune scimitar'),
  item(2, 'Rune scimitar (broken)'),
  item(3, 'Dragon scimitar'),
  item(4, 'Scimitar'),
  item(5, "Verac's flail"),
  item(6, 'Abyssal whip'),
  item(7, 'Rune platebody'),
];

describe('normaliseQuery', () => {
  // OSRS item names are full of apostrophes, and players never type them.
  it('strips apostrophes, including the typographic one', () => {
    expect(normaliseQuery("Verac's")).toBe('veracs');
    expect(normaliseQuery('Verac’s')).toBe('veracs');
  });

  it('collapses whitespace and lowercases', () => {
    expect(normaliseQuery('  RUNE   scimitar ')).toBe('rune scimitar');
  });
});

describe('searchItems', () => {
  it('returns nothing for an empty query rather than everything', () => {
    expect(searchItems(MAPPING, '')).toEqual([]);
    expect(searchItems(MAPPING, '   ')).toEqual([]);
  });

  it('ranks an exact name above a prefix match', () => {
    const results = searchItems(MAPPING, 'scimitar');

    expect(results[0]?.item.name).toBe('Scimitar');
    expect(results[0]?.kind).toBe('exact');
  });

  it('ranks a prefix match above a mid-name match', () => {
    const results = searchItems(MAPPING, 'rune');

    // "Rune scimitar" and "Rune platebody" start with it; nothing else should
    // outrank them.
    expect(results[0]?.kind).toBe('prefix');
  });

  it('prefers the shorter name within a tier', () => {
    const results = searchItems(MAPPING, 'rune scimitar');

    expect(results[0]?.item.name).toBe('Rune scimitar');
    expect(results[1]?.item.name).toBe('Rune scimitar (broken)');
  });

  it('finds an item whose apostrophe the user did not type', () => {
    const results = searchItems(MAPPING, 'veracs');

    expect(results[0]?.item.name).toBe("Verac's flail");
  });

  it('is case insensitive', () => {
    expect(searchItems(MAPPING, 'ABYSSAL')[0]?.item.name).toBe('Abyssal whip');
  });

  it('returns nothing for a query that matches no item', () => {
    expect(searchItems(MAPPING, 'twisted bow')).toEqual([]);
  });

  it('respects the result limit', () => {
    expect(searchItems(MAPPING, 'scimitar', { limit: 2 })).toHaveLength(2);
  });

  // An item with no live price has nothing useful to show on a price page, and
  // including it pushes real results off the end of the list.
  it('excludes items with no live price when a tradeable set is supplied', () => {
    const results = searchItems(MAPPING, 'scimitar', {
      tradeableIds: new Set(['3', '4']),
    });

    expect(results.map((result) => result.item.id).sort()).toEqual([3, 4]);
  });
});
