/**
 * Brand / model lists for New Booking. Pure functions over the catalog in
 * src/assets/data/device-catalog.json (built by tools/device-catalog).
 * By default the customer picks from these lists; ticking "Not in the list"
 * lets them type any brand and model instead.
 */

export interface CatalogBrand {
  name: string;
  models: readonly string[];
}

export interface DeviceCatalog {
  brands: readonly CatalogBrand[];
}

export interface DeviceSuggestion {
  brand: string;
  model: string;
}

/** Shown before the customer types anything (common in the Philippines). */
export const POPULAR_BRANDS: readonly string[] = [
  'Samsung',
  'Apple',
  'Xiaomi',
  'Redmi',
  'OPPO',
  'vivo',
  'realme',
  'Infinix',
  'TECNO',
  'Huawei',
];

/** "Galaxy S24+" -> "galaxys24" so "s24" and "note13" still match. */
export function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * How well `candidate` matches `query` (lower is better), or -1 for no match.
 * 0 exact, 1 starts with, 2 a word starts with it, 3 contained once spaces and
 * symbols are ignored.
 */
export function matchScore(candidate: string, query: string): number {
  const text = candidate.toLowerCase().trim();
  const q = query.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!q) return -1;
  if (text === q) return 0;
  if (text.startsWith(q)) return 1;
  if (text.split(/[\s\-_/()]+/).some((word) => word.startsWith(q)) || text.includes(` ${q}`)) return 2;
  const c = compact(q);
  if (c && compact(text).includes(c)) return 3;
  return -1;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function rank<T>(
  items: readonly T[],
  label: (item: T) => string,
  query: string,
  limit: number,
  boost: (text: string) => number = () => 0,
): T[] {
  const scored: { item: T; score: number; boost: number; text: string }[] = [];
  for (const item of items) {
    const text = label(item);
    const score = matchScore(text, query);
    if (score >= 0) scored.push({ item, score, boost: boost(text), text });
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      b.boost - a.boost ||
      a.text.length - b.text.length ||
      collator.compare(a.text, b.text),
  );
  return scored.slice(0, limit).map((entry) => entry.item);
}

export function findBrand(catalog: DeviceCatalog, name: string): CatalogBrand | undefined {
  const key = name.trim().toLowerCase();
  return key ? catalog.brands.find((brand) => brand.name.toLowerCase() === key) : undefined;
}

/** Brand names for the Brand field. Empty query -> the popular brands that exist in the catalog. */
export function searchBrands(catalog: DeviceCatalog, query: string, limit = 6): string[] {
  if (!query.trim()) {
    return POPULAR_BRANDS.filter((name) => findBrand(catalog, name)).slice(0, limit);
  }
  // Popular brands win ties ("ap" -> Apple before Apex).
  const popular = (name: string) => (POPULAR_BRANDS.some((p) => p.toLowerCase() === name.toLowerCase()) ? 1 : 0);
  return rank(catalog.brands, (brand) => brand.name, query, limit, popular).map((brand) => brand.name);
}

/** Models of one brand for the Model field. Nothing until the customer types. */
export function searchModels(catalog: DeviceCatalog, brand: string, query: string, limit = 8): string[] {
  const found = findBrand(catalog, brand);
  if (!found || !query.trim()) return [];
  return rank(found.models, (model) => model, query, limit);
}

/**
 * A brand's models to browse before typing: the top of the catalog list, which
 * the catalog builder orders newest-looking first (see browseOrder in
 * tools/device-catalog/build-device-catalog.mjs).
 */
export function browseModels(catalog: DeviceCatalog, brand: string, limit = 40): string[] {
  return findBrand(catalog, brand)?.models.slice(0, limit) ?? [];
}

const sameName = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The catalog's own spelling of a brand + model, or null when the pair is not
 * in the list (case and extra spaces do not matter).
 */
export function listedDevice(catalog: DeviceCatalog, brand: string, model: string): DeviceSuggestion | null {
  const found = findBrand(catalog, brand.replace(/\s+/g, ' '));
  const listed = found?.models.find((item) => sameName(item, model));
  return found && listed ? { brand: found.name, model: listed } : null;
}

const flatCache = new WeakMap<DeviceCatalog, DeviceSuggestion[]>();

/** Every brand + model pair, built once per loaded catalog. */
function flatten(catalog: DeviceCatalog): DeviceSuggestion[] {
  let all = flatCache.get(catalog);
  if (!all) {
    all = catalog.brands.flatMap((brand) => brand.models.map((model) => ({ brand: brand.name, model })));
    flatCache.set(catalog, all);
  }
  return all;
}

/**
 * Search every brand at once ("galaxy s24", "samsung a55", "iphone 13"), used
 * when the brand is empty or not in the catalog. Picking a result fills both fields.
 */
export function searchDevices(catalog: DeviceCatalog, query: string, limit = 8): DeviceSuggestion[] {
  if (compact(query).length < 2) return [];
  const all = flatten(catalog);
  const byModel = rank(all, (item) => item.model, query, limit);
  const byFull = rank(all, (item) => `${item.brand} ${item.model}`, query, limit);
  const seen = new Set<string>();
  const merged: DeviceSuggestion[] = [];
  for (const item of [...byFull, ...byModel]) {
    const key = `${item.brand}|${item.model}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged.slice(0, limit);
}
