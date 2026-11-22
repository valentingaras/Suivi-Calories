import { DEFAULT_FOODS_DB } from '../data/foodsDatabase';
import type {
  AppState,
  DayTotals,
  Food,
  Goals,
  LogEntry,
  MealId,
  MealMeta,
  MealsOn,
  WeightEntry,
} from '../types/nutrition';
import { writeToIndexedDB } from './db';

export const STORAGE_KEY = 'suivi-calories-v1';
export const CURRENT_DB_VERSION = 4;

export function capitalizeFoodName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toLocaleUpperCase('fr-FR') + trimmed.slice(1);
}

function sanitizeFood(f: Food & { note?: unknown }): Food {
  const clean: Food = {
    id: f.id,
    n: capitalizeFoodName(f.n),
    k: f.k,
    p: f.p,
    c: f.c,
    f: f.f,
  };
  if (f.a && f.a > 0) clean.a = f.a;
  return clean;
}

export const MEALS: MealMeta[] = [
  { id: 'b', name: 'Petit-déjeuner', shortName: 'Matin' },
  { id: 'l', name: 'Déjeuner', shortName: 'Midi' },
  { id: 'd', name: 'Dîner', shortName: 'Soir' },
  { id: 'o', name: 'Autre', shortName: 'Autre' },
];

export function createFreshState(): AppState {
  return {
    foods: DEFAULT_FOODS_DB.map((f) => ({ ...f })),
    goals: { k: 2000, p: 120, c: 220, f: 70, m: 'N', a: '1.55' },
    log: {},
    weights: [],
    alc: 1,
    mealsOn: { b: true, l: true, d: true, o: true },
    theme: 'light',
    dbVersion: CURRENT_DB_VERSION,
  };
}

export function mergeFoodsWithDefaults(existingFoods: Food[]): Food[] {
  const mapByNorm = new Map<string, Food>();
  for (const f of existingFoods) {
    const clean = sanitizeFood(f);
    if (clean.n) {
      mapByNorm.set(normText(clean.n), clean);
    }
  }

  for (const defFood of DEFAULT_FOODS_DB) {
    const cleanDef = sanitizeFood(defFood);
    const key = normText(cleanDef.n);
    if (!mapByNorm.has(key)) {
      mapByNorm.set(key, cleanDef);
    }
  }

  return Array.from(mapByNorm.values());
}

export function normalizeAppState(parsed: Partial<AppState>): AppState {
  const needsFoodMigration = !parsed.dbVersion || parsed.dbVersion < CURRENT_DB_VERSION;
  const baseFoods = Array.isArray(parsed.foods) ? parsed.foods : [];
  const foods = needsFoodMigration
    ? mergeFoodsWithDefaults(baseFoods)
    : baseFoods.map(sanitizeFood);

  return {
    foods,
    goals: {
      k: parsed.goals?.k ?? 2000,
      p: parsed.goals?.p ?? 120,
      c: parsed.goals?.c,
      f: parsed.goals?.f,
      h: parsed.goals?.h,
      s: parsed.goals?.s || '',
      b: parsed.goals?.b || '',
      m: parsed.goals?.m || 'N',
      w: parsed.goals?.w,
      a: parsed.goals?.a || '1.55',
    },
    log: parsed.log ?? {},
    weights: Array.isArray(parsed.weights) ? parsed.weights : [],
    alc: parsed.alc ?? 1,
    mealsOn: parsed.mealsOn ?? { b: true, l: true, d: true, o: true },
    theme: parsed.theme ?? 'light',
    dbVersion: CURRENT_DB_VERSION,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (parsed && Array.isArray(parsed.foods) && parsed.goals && parsed.log) {
        const state = normalizeAppState(parsed);
        saveState(state);
        return state;
      }
    }
  } catch {
    // Fallback to clean state if localStorage is unavailable or malformed
  }
  const fresh = createFreshState();
  saveState(fresh);
  return fresh;
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
  void writeToIndexedDB(state);
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const res: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      res.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}

export function parseFoodsCsv(csvText: string): Food[] {
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';
  const result: Food[] = [];
  const stamp = Date.now();

  const optNum = (v: string | undefined): number => {
    const s = (v ?? '').trim();
    if (s === '') return 0;
    const n = parseNum(s);
    return Number.isNaN(n) ? NaN : n;
  };

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const n = capitalizeFoodName(cols[0] ?? '');
    if (!n) continue;
    const k = optNum(cols[1]);
    const p = optNum(cols[2]);
    const c = optNum(cols[3]);
    const f = optNum(cols[4]);
    const a = optNum(cols[5]);
    if ([k, p, c, f, a].some(Number.isNaN)) continue;

    const item: Food = {
      id: `imp_${stamp}_${i}`,
      n,
      k,
      p,
      c,
      f,
    };
    if (a > 0) item.a = a;
    result.push(item);
  }

  return result;
}

export function parseNum(val: string | number): number {
  const n = parseFloat(String(val).replace(',', '.').trim());
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatDecimalFr(n: number): string {
  return String(round1(n)).replace('.', ',');
}

export function normText(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function dateKey(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function shiftDateKey(dk: string, deltaDays: number): string {
  const d = new Date(`${dk}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return dateKey(d);
}

export function formatDayLabel(dk: string): string {
  const s = new Date(`${dk}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatLongDayLabel(dk: string): string {
  const s = new Date(`${dk}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortDate(dk: string): string {
  return new Date(`${dk}T00:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

export function mealOf(entry: LogEntry): MealId {
  return entry.m || 'o';
}

export function defaultMealForHour(hour = new Date().getHours()): MealId {
  if (hour < 11) return 'b';
  if (hour < 15) return 'l';
  if (hour < 18) return 'o';
  return 'd';
}

export function visibleMealsForEntries(mealsOn: MealsOn, entries: LogEntry[]): MealMeta[] {
  const visible = MEALS.filter(
    (m) => mealsOn[m.id] || entries.some((x) => mealOf(x) === m.id)
  );
  return visible.length ? visible : [MEALS[0]];
}

export function dayTotals(entries: LogEntry[] | undefined): DayTotals {
  const t: DayTotals = { k: 0, p: 0, c: 0, f: 0, al: 0, n: 0 };
  if (!entries) return t;
  for (const x of entries) {
    t.k += x.k;
    t.p += x.p;
    t.c += x.c;
    t.f += x.f;
    t.al += x.al || 0;
    t.n += 1;
  }
  return t;
}

export function dosesForDay(entries: LogEntry[] | undefined): number {
  if (!entries) return 0;
  return entries.reduce((sum, x) => sum + (x.al || 0), 0) / 10;
}

export function rolling7DayAlcoholDoses(
  log: Record<string, LogEntry[]>,
  anchorDateKey: string
): number {
  const d = new Date(`${anchorDateKey}T00:00:00`);
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    total += dosesForDay(log[dateKey(dt)]);
  }
  return total;
}

export function ageOf(birthDate?: string): number | null {
  if (!birthDate) return null;
  const d = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  if (
    now.getMonth() < d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
  ) {
    age -= 1;
  }
  return age >= 18 && age <= 100 ? age : null;
}

export function latestWeight(weights: WeightEntry[]): number | null {
  if (!weights.length) return null;
  const sorted = [...weights].sort((a, b) => (a.d < b.d ? -1 : 1));
  return sorted[sorted.length - 1].w;
}

export function suggestIdealWeight(goals: Goals): { w: number; m: string } | null {
  if (!goals.h) return null;
  const a = ageOf(goals.b);
  let w: number;
  let m: string;
  if (a !== null) {
    const kk = goals.m === 'L' ? 1.1 : goals.m === 'M' ? 0.9 : 1;
    w = (goals.h - 100 + a / 10) * 0.9 * kk;
    m = `formule de Creff, ${a} ans, morphologie ${
      goals.m === 'L' ? 'large' : goals.m === 'M' ? 'fine' : 'normale'
    }`;
  } else if (goals.s === 'H') {
    w = goals.h - 100 - (goals.h - 150) / 4;
    m = 'formule de Lorentz';
  } else if (goals.s === 'F') {
    w = goals.h - 100 - (goals.h - 150) / 2.5;
    m = 'formule de Lorentz';
  } else {
    w = 22 * Math.pow(goals.h / 100, 2);
    m = 'IMC 22, renseigne ta date de naissance pour affiner';
  }
  return { w, m };
}

export function recommendedMacros(
  goals: Goals
): { w: number; f: number; c: number; m: string } | null {
  const s = suggestIdealWeight(goals);
  let w: number;
  let m: string;
  if (goals.w) {
    w = goals.w;
    m = 'poids de forme renseigné';
  } else if (s) {
    w = s.w;
    m = s.m;
  } else {
    return null;
  }
  const f = Math.round(w);
  const c = Math.max(0, Math.round((goals.k - 4 * goals.p - 9 * f) / 4));
  return { w, f, m, c };
}

export function suggestedGoals(
  goals: Goals,
  weights: WeightEntry[]
): {
  e: number;
  k: number;
  p: number;
  loss: boolean;
  cw: number | null;
  w: number;
} | null {
  const a = ageOf(goals.b);
  if (!goals.h || !goals.s || a === null) return null;
  const cw = latestWeight(weights);
  const rc = recommendedMacros(goals);
  const w = cw ?? (rc ? rc.w : null);
  if (!w) return null;
  const bmr = 10 * w + 6.25 * goals.h - 5 * a + (goals.s === 'H' ? 5 : -161);
  const activity = Number(goals.a) || 1.55;
  const e = Math.round((bmr * activity) / 10) * 10;
  const ref = rc ? rc.w : w;
  const loss = Boolean(cw && rc && rc.w < cw - 1);
  return {
    e,
    k: loss ? e - Math.round((0.12 * e) / 10) * 10 : e,
    p: Math.round(1.6 * ref),
    loss,
    cw,
    w,
  };
}
