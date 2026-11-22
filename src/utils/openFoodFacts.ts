import { capitalizeFoodName, round1 } from './nutrition';

export interface OpenFoodFactsProduct {
  code: string;
  name: string;
  brand: string;
  quantity?: string;
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
  brands?: string;
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

  const brand = (raw.brands || '')
    .split(',')[0]
    .trim();

  return {
    code: raw.code || rawName,
    name: capitalizeFoodName(rawName),
    brand,
    quantity: raw.quantity?.trim() || undefined,
    k: safeK,
    p: safeP,
    c: safeC,
    f: safeF,
    ...(alcGrams && alcGrams > 0 ? { a: alcGrams } : {}),
  };
}

export async function searchOpenFoodFacts(
  query: string,
  signal?: AbortSignal
): Promise<OpenFoodFactsProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(
      'Hors ligne : une connexion Internet est requise pour interroger Open Food Facts.'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    const isBarcode = /^\d{8,14}$/.test(trimmed);
    const fields =
      'code,product_name,product_name_fr,brands,nutriments,quantity';

    if (isBarcode) {
      const url = `https://fr.openfoodfacts.org/api/v2/product/${encodeURIComponent(
        trimmed
      )}.json?fields=${fields}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error('Réponse invalide d’Open Food Facts.');
      }
      const data = (await res.json()) as {
        status?: number;
        product?: RawOFFProduct;
      };
      if (!data.product) return [];
      const mapped = mapRawProduct(data.product);
      return mapped ? [mapped] : [];
    }

    const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      trimmed
    )}&search_simple=1&action=process&json=1&page_size=12&fields=${fields}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error('Impossible de joindre Open Food Facts.');
    }
    const data = (await res.json()) as { products?: RawOFFProduct[] };
    const products = Array.isArray(data.products) ? data.products : [];
    const results: OpenFoodFactsProduct[] = [];
    for (const raw of products) {
      const mapped = mapRawProduct(raw);
      if (mapped) results.push(mapped);
    }
    return results;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La recherche Open Food Facts a expiré ou été annulée.');
    }
    if (err instanceof Error) throw err;
    throw new Error('Erreur lors de la recherche Open Food Facts.');
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
