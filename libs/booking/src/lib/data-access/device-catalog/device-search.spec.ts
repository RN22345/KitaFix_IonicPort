import { describe, expect, it } from 'vitest';
import {
  DeviceCatalog,
  browseModels,
  listedDevice,
  matchScore,
  searchBrands,
  searchDevices,
  searchModels,
} from './device-search';

const catalog: DeviceCatalog = {
  brands: [
    { name: 'Apple', models: ['iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 15'] },
    { name: 'OPPO', models: ['A55 5G', 'Reno10 5G'] },
    { name: 'Redmi', models: ['Note 13', 'Note 13 Pro', 'Note 12'] },
    { name: 'Samsung', models: ['Galaxy A55 5G', 'Galaxy S24', 'Galaxy S24 Ultra', 'Galaxy S24+'] },
  ],
};

describe('matchScore', () => {
  it('ranks exact, prefix, word and compact matches', () => {
    expect(matchScore('Galaxy S24', 'galaxy s24')).toBe(0);
    expect(matchScore('Galaxy S24', 'gal')).toBe(1);
    expect(matchScore('Galaxy S24', 's24')).toBe(2);
    expect(matchScore('Note 13 Pro', 'note13')).toBe(3);
    expect(matchScore('Galaxy S24', 'pixel')).toBe(-1);
    expect(matchScore('Galaxy S24', '   ')).toBe(-1);
  });
});

describe('searchBrands', () => {
  it('shows popular brands that exist before typing', () => {
    expect(searchBrands(catalog, '')).toEqual(['Samsung', 'Apple', 'Redmi', 'OPPO']);
  });

  it('puts popular brands first among equal matches', () => {
    const withApex: DeviceCatalog = { brands: [{ name: 'Apex', models: ['A1'] }, ...catalog.brands] };
    expect(searchBrands(withApex, 'ap')).toEqual(['Apple', 'Apex']);
  });

  it('matches regardless of case', () => {
    expect(searchBrands(catalog, 'op')).toEqual(['OPPO']);
    expect(searchBrands(catalog, 'SAM')).toEqual(['Samsung']);
  });
});

describe('searchModels', () => {
  it('finds models of the chosen brand, best match first', () => {
    expect(searchModels(catalog, 'samsung', 's24')).toEqual([
      'Galaxy S24',
      'Galaxy S24+',
      'Galaxy S24 Ultra',
    ]);
  });

  it('returns nothing for an unknown brand or an empty query', () => {
    expect(searchModels(catalog, 'Nokia', 'g21')).toEqual([]);
    expect(searchModels(catalog, 'Samsung', '')).toEqual([]);
  });
});

describe('searchDevices', () => {
  it('finds a phone without knowing the brand', () => {
    expect(searchDevices(catalog, 'iphone 13')[0]).toEqual({ brand: 'Apple', model: 'iPhone 13' });
  });

  it('accepts "brand model" queries', () => {
    expect(searchDevices(catalog, 'redmi note 13')[0]).toEqual({ brand: 'Redmi', model: 'Note 13' });
  });

  it('matches the same model name under different brands once each', () => {
    const results = searchDevices(catalog, 'a55');
    expect(results).toContainEqual({ brand: 'OPPO', model: 'A55 5G' });
    expect(results).toContainEqual({ brand: 'Samsung', model: 'Galaxy A55 5G' });
    expect(new Set(results.map((r) => `${r.brand}|${r.model}`)).size).toBe(results.length);
  });

  it('waits for at least two characters', () => {
    expect(searchDevices(catalog, 'a')).toEqual([]);
  });
});

describe('browseModels', () => {
  it('lists the top of a brand in catalog order before typing', () => {
    expect(browseModels(catalog, 'apple')).toEqual(['iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 15']);
    expect(browseModels(catalog, 'apple', 2)).toHaveLength(2);
    expect(browseModels(catalog, 'Nokia')).toEqual([]);
  });
});

describe('listedDevice', () => {
  it('returns the catalog spelling when the pair is listed', () => {
    expect(listedDevice(catalog, ' samsung ', 'galaxy  s24 ultra')).toEqual({
      brand: 'Samsung',
      model: 'Galaxy S24 Ultra',
    });
  });

  it('returns null for an unlisted brand or model', () => {
    expect(listedDevice(catalog, 'Samsung', 'Galaxy S99')).toBeNull();
    expect(listedDevice(catalog, 'Cherry Mobile', 'Flare S4')).toBeNull();
  });
});
