import { describe, expect, it } from 'vitest';
import { browseOrder, buildCatalog, isOddName, modelNumber } from './build-device-catalog.mjs';

describe('isOddName', () => {
  it('flags internal codes and non-Latin names', () => {
    expect(isOddName('SM-J337A')).toBe(true);
    expect(isOddName('X521')).toBe(true);
    expect(isOddName('VinsQ(M910)')).toBe(true);
    expect(isOddName('三星 W26')).toBe(true);
  });

  it('keeps real model names', () => {
    expect(isOddName('Galaxy A55 5G')).toBe(false);
    expect(isOddName('C55')).toBe(false);
    expect(isOddName('Y500 Pro')).toBe(false);
  });
});

describe('modelNumber', () => {
  it('reads the model number, not specs', () => {
    expect(modelNumber('Galaxy S24 Ultra')).toBe(24);
    expect(modelNumber('GT3 240W')).toBe(3);
    expect(modelNumber('C33 128GB')).toBe(33);
    expect(modelNumber('Galaxy A5 (2017)')).toBe(5);
    expect(modelNumber('Pixel Fold')).toBe(0);
  });
});

describe('browseOrder / buildCatalog', () => {
  const header = ['Retail Branding', 'Marketing Name', 'Device', 'Model'];
  const row = (brand, name) => [brand, name, 'x', 'x'];

  it('puts newer-looking names first and codes last', () => {
    const rows = [
      header,
      row('Samsung', 'Galaxy S9'),
      row('Samsung', 'SM-J337A'),
      row('Samsung', 'Galaxy S24'),
      row('Samsung', 'Galaxy S24 Ultra'),
      ...Array.from({ length: 5 }, (_, i) => row('Samsung', `Galaxy Note${i + 1}`)),
    ];
    const [samsung] = buildCatalog(rows, { brands: {} });
    expect(samsung.models.slice(0, 3)).toEqual(['Galaxy S24', 'Galaxy S24 Ultra', 'Galaxy S9']);
    expect(samsung.models.at(-1)).toBe('SM-J337A');
  });

  it('keeps the hand-made extras order (newest first)', () => {
    const [apple] = buildCatalog([header], { brands: { Apple: ['iPhone Air', 'iPhone 17', 'iPhone 6'] } });
    expect(apple.models).toEqual(['iPhone Air', 'iPhone 17', 'iPhone 6']);
  });

  it('is a stable comparator', () => {
    const a = { name: 'Galaxy S24', rows: 1, extraIndex: Infinity };
    expect(browseOrder(a, a)).toBe(0);
  });
});
