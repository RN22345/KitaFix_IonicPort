#!/usr/bin/env node
/**
 * Builds src/assets/data/device-catalog.json - the brand/model suggestions on
 * New Booking - from:
 *   1. Google Play's public "supported devices" list (every certified Android
 *      device; Google keeps it current), and
 *   2. tools/device-catalog/extra-devices.json (Apple, Huawei phones without
 *      Google services) - edit that file by hand once a year.
 *
 * Usage:
 *   node tools/device-catalog/build-device-catalog.mjs              # download + build
 *   node tools/device-catalog/build-device-catalog.mjs --input x.csv  # use a saved CSV
 *
 * Runs weekly in .github/workflows/device-catalog.yml. No npm dependencies.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE_URL = 'https://storage.googleapis.com/play_public/supported_devices.csv';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXTRAS = join(ROOT, 'tools', 'device-catalog', 'extra-devices.json');
const OUTPUT = join(ROOT, 'src', 'assets', 'data', 'device-catalog.json');

/** Brands with fewer models than this are dropped (mostly one-off OEM / TV boxes) unless listed below. */
const MIN_MODELS_PER_BRAND = 8;

/** Canonical brand names (key: lower-case name in the source). Unlisted brands keep their most common spelling. */
const BRAND_NAMES = {
  'lge': 'LG',
  'tct (alcatel)': 'Alcatel',
  'oppo': 'OPPO',
  'vivo': 'vivo',
  'realme': 'realme',
  'xiaomi': 'Xiaomi',
  'redmi': 'Redmi',
  'poco': 'POCO',
  'samsung': 'Samsung',
  'google': 'Google',
  'motorola': 'Motorola',
  'oneplus': 'OnePlus',
  'huawei': 'Huawei',
  'honor': 'HONOR',
  'infinix': 'Infinix',
  'tecno': 'TECNO',
  'itel': 'itel',
  'nokia': 'Nokia',
  'hmd global': 'Nokia',
  'asus': 'ASUS',
  'sony': 'Sony',
  'nothing': 'Nothing',
  'cherry mobile': 'Cherry Mobile',
};

/** Always kept, whatever their model count (popular in the Philippines). */
const ALWAYS_KEEP = new Set(['Cherry Mobile', 'Nothing', 'Google', 'OnePlus', 'Nokia', 'itel']);

/** Minimal RFC 4180 CSV parser (quoted fields, doubled quotes). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** The file is UTF-16 (with BOM); fall back to UTF-8 for hand-made test files. */
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  return new TextDecoder('utf-8').decode(buffer).replace(/^﻿/, '');
}

const clean = (value) => value.replace(/\s+/g, ' ').trim();

/** "OPPO Reno10 5G" under brand OPPO -> "Reno10 5G". Keeps "Galaxy S24", "Redmi Note 13" under Redmi -> "Note 13". */
function stripBrand(model, brand) {
  const prefix = `${brand.toLowerCase()} `;
  return model.toLowerCase().startsWith(prefix) ? model.slice(prefix.length) : model;
}

/** Natural, case-insensitive order: "Galaxy S9" before "Galaxy S10". */
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function buildCatalog(rows, extras) {
  const [header, ...data] = rows;
  const brandCol = header.indexOf('Retail Branding');
  const nameCol = header.indexOf('Marketing Name');
  if (brandCol < 0 || nameCol < 0) {
    throw new Error(`Unexpected CSV header: ${header.join(',')}`);
  }

  /** lower-case brand -> { spellings: Map<spelling, count>, models: Map<lower model, model> } */
  const brands = new Map();
  const add = (rawBrand, rawModel) => {
    const brandText = clean(rawBrand ?? '');
    const modelText = clean(rawModel ?? '');
    if (!brandText || !modelText) return;
    const key = BRAND_NAMES[brandText.toLowerCase()]?.toLowerCase() ?? brandText.toLowerCase();
    let entry = brands.get(key);
    if (!entry) {
      entry = { spellings: new Map(), models: new Map() };
      brands.set(key, entry);
    }
    const display = BRAND_NAMES[brandText.toLowerCase()] ?? brandText;
    entry.spellings.set(display, (entry.spellings.get(display) ?? 0) + 1);
    const model = clean(stripBrand(modelText, display));
    if (model && model.toLowerCase() !== key) {
      entry.models.set(model.toLowerCase(), entry.models.get(model.toLowerCase()) ?? model);
    }
  };

  for (const row of data) add(row[brandCol], row[nameCol]);
  for (const [brand, models] of Object.entries(extras.brands ?? {})) {
    for (const model of models) add(brand, model);
  }

  const result = [];
  for (const entry of brands.values()) {
    const name = [...entry.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const models = [...entry.models.values()].sort(collator.compare);
    const fromExtras = Object.keys(extras.brands ?? {}).some((b) => b.toLowerCase() === name.toLowerCase());
    if (models.length >= MIN_MODELS_PER_BRAND || ALWAYS_KEEP.has(name) || fromExtras) {
      result.push({ name, models });
    }
  }
  result.sort((a, b) => collator.compare(a.name, b.name));
  return result;
}

async function main() {
  const inputIndex = process.argv.indexOf('--input');
  let buffer;
  if (inputIndex > 0) {
    buffer = await readFile(process.argv[inputIndex + 1]);
  } else {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    buffer = new Uint8Array(await response.arrayBuffer());
  }
  const rows = parseCsv(decode(buffer)).filter((row) => row.length > 1);
  const extras = JSON.parse(await readFile(EXTRAS, 'utf8'));
  const brands = buildCatalog(rows, extras);

  const catalog = {
    source: 'Google Play supported devices + tools/device-catalog/extra-devices.json',
    sourceUrl: SOURCE_URL,
    brandCount: brands.length,
    modelCount: brands.reduce((sum, brand) => sum + brand.models.length, 0),
    brands,
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  // One brand per line keeps weekly diffs readable in the update PR.
  const body = brands.map((brand) => `    ${JSON.stringify(brand)}`).join(',\n');
  const { brands: _omit, ...meta } = catalog;
  const json = `${JSON.stringify(meta, null, 2).slice(0, -2)},\n  "brands": [\n${body}\n  ]\n}\n`;
  await writeFile(OUTPUT, json);
  console.log(`device-catalog.json: ${catalog.brandCount} brands, ${catalog.modelCount} models`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
