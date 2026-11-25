import { capitalizeFoodName, normText, round1 } from './nutrition';

export interface OpenFoodFactsProduct {
  code: string;
  name: string;
  brand: string;
  quantity?: string;
  source?: 'ciqual' | 'off';
  k: number;
  p: number;
  c: number;
  f: number;
  a?: number;
}

interface RawOFFNutriments {
  'energy-kcal_100g'?: number | string;
  'energy-kcal'?: number | string;
  energy_100g?: number | string;
  proteins_100g?: number | string;
  carbohydrates_100g?: number | string;
  fat_100g?: number | string;
  alcohol_100g?: number | string;
  alcohol?: number | string;
  alcohol_unit?: string;
}

interface RawOFFProduct {
  code?: string;
  product_name_fr?: string;
  product_name?: string;
  brands?: string | string[];
  quantity?: string;
  nutriments?: RawOFFNutriments;
}

function toNum(v: number | string | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : NaN;
  if (typeof v === 'string') {
    const parsed = parseFloat(v.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
  }
  return NaN;
}

function mapRawProduct(raw: RawOFFProduct): OpenFoodFactsProduct | null {
  const rawName = (raw.product_name_fr || raw.product_name || '').trim();
  if (!rawName || !raw.nutriments) return null;

  const n = raw.nutriments;
  let k = toNum(n['energy-kcal_100g']);
  if (Number.isNaN(k)) k = toNum(n['energy-kcal']);
  if (Number.isNaN(k)) {
    const kj = toNum(n.energy_100g);
    if (!Number.isNaN(kj)) k = kj / 4.184;
  }

  const p = toNum(n.proteins_100g);
  const c = toNum(n.carbohydrates_100g);
  const f = toNum(n.fat_100g);

  if (Number.isNaN(k) && [p, c, f].every(Number.isNaN)) {
    return null;
  }

  const safeP = Number.isNaN(p) ? 0 : round1(p);
  const safeC = Number.isNaN(c) ? 0 : round1(c);
  const safeF = Number.isNaN(f) ? 0 : round1(f);
  const safeK = Number.isNaN(k)
    ? Math.round(4 * safeP + 4 * safeC + 9 * safeF)
    : Math.round(k * 10) / 10;

  let rawAlc = toNum(n.alcohol_100g);
  if (Number.isNaN(rawAlc)) rawAlc = toNum(n.alcohol);
  let alcGrams: number | undefined;
  if (!Number.isNaN(rawAlc) && rawAlc > 0) {
    const unit = (n.alcohol_unit || '% vol').toLowerCase();
    alcGrams = unit === 'g' ? round1(rawAlc) : round1(rawAlc * 0.789);
  }

  const brand = Array.isArray(raw.brands)
    ? (raw.brands[0] || '').trim()
    : (raw.brands || '').split(',')[0].trim();

  return {
    code: raw.code || rawName,
    name: capitalizeFoodName(rawName),
    brand,
    quantity: raw.quantity?.trim() || undefined,
    source: 'off',
    k: safeK,
    p: safeP,
    c: safeC,
    f: safeF,
    ...(alcGrams && alcGrams > 0 ? { a: alcGrams } : {}),
  };
}

let ciqualIndexPromise: Promise<
  Array<{
    normName: string;
    product: OpenFoodFactsProduct;
  }>
> | null = null;

async function getCiqualIndex() {
  if (!ciqualIndexPromise) {
    ciqualIndexPromise = import('../data/ciqualDatabase').then(
      ({ CIQUAL_FOODS }) =>
        CIQUAL_FOODS.map(([name, group, k, p, c, f, a], idx) => ({
          normName: normText(name),
          product: {
            code: `ciqual_${idx}`,
            name: capitalizeFoodName(name),
            brand: group,
            source: 'ciqual' as const,
            k,
            p,
            c,
            f,
            ...(a && a > 0 ? { a } : {}),
          },
        }))
    );
  }
  return ciqualIndexPromise;
}

export async function searchCiqualFoods(
  query: string,
  limit = 25
): Promise<OpenFoodFactsProduct[]> {
  const tokens = normText(query)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  const index = await getCiqualIndex();
  const fullQuery = tokens.join(' ');
  const scored: Array<{ score: number; product: OpenFoodFactsProduct }> = [];

  for (const entry of index) {
    const { normName, product } = entry;
    if (!tokens.every((t) => normName.includes(t))) continue;

    let score = 0;
    if (normName === fullQuery) score += 100;
    else if (normName.startsWith(fullQuery)) score += 60;
    else if (normName.startsWith(tokens[0])) score += 35;

    for (const t of tokens) {
      if (new RegExp(`(^|[ ,(/])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(normName)) {
        score += 15;
      }
    }
    score -= normName.length * 0.05;
    scored.push({ score, product });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.product);
}

async function fetchJsonSafe(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error('Serveur Open Food Facts temporairement indisponible.');
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  if (!contentType.includes('application/json') && text.trimStart().startsWith('<')) {
    throw new Error(
      'Open Food Facts est temporairement surchargé (page de maintenance).'
    );
  }
  return JSON.parse(text) as unknown;
}

export function isBarcodeQuery(query: string): boolean {
  return /^\d{8,14}$/.test(query.trim());
}

export async function lookupProductByBarcode(
  barcode: string,
  signal?: AbortSignal
): Promise<OpenFoodFactsProduct | null> {
  const trimmed = barcode.trim();
  if (!isBarcodeQuery(trimmed)) return null;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'Hors ligne : une connexion Internet est requise pour lire un code-barres.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const fields =
      'code,product_name,product_name_fr,brands,nutriments,quantity';
    const url = `https://fr.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      trimmed
    )}.json?fields=${fields}`;
    const data = (await fetchJsonSafe(url, controller.signal)) as {
      status?: number;
      product?: RawOFFProduct;
    } | null;
    if (!data || !data.product) return null;
    return mapRawProduct(data.product);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La recherche du code-barres a expiré ou été annulée.');
    }
    if (err instanceof Error) throw err;
    throw new Error('Erreur lors de la lecture du code-barres.');
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function searchCiqualOrBarcode(
  query: string,
  signal?: AbortSignal
): Promise<OpenFoodFactsProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (isBarcodeQuery(trimmed)) {
    const product = await lookupProductByBarcode(trimmed, signal);
    return product ? [product] : [];
  }

  return searchCiqualFoods(trimmed);
}
