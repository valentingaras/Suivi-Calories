export type MealId = 'b' | 'l' | 'd' | 'o';

export type SexCode = '' | 'F' | 'H';
export type MorphologyCode = 'N' | 'M' | 'L';
export type ActivityFactor = '1.2' | '1.375' | '1.55' | '1.725';
export type ThemePreference = 'light' | 'dark' | 'system';

export type AppTab = 'today' | 'suivi' | 'pesee' | 'alim' | 'profil';

export interface Food {
  id: string;
  n: string;
  k: number; // kcal per 100g
  p: number; // protein g per 100g
  c: number; // carbs g per 100g
  f: number; // fat g per 100g
  a?: number; // pure alcohol g per 100g
}

export interface LogEntry {
  id: string;
  foodId?: string;
  n: string;
  g: number;
  k: number;
  p: number;
  c: number;
  f: number;
  al?: number;
  m?: MealId;
}

export interface Goals {
  k: number; // kcal target
  p: number; // protein target (g)
  c?: number;
  f?: number;
  h?: number; // height cm
  s?: SexCode;
  b?: string; // birth date YYYY-MM-DD
  m?: MorphologyCode;
  w?: number; // ideal/target weight kg
  a?: ActivityFactor | string;
}

export interface WeightEntry {
  d: string; // YYYY-MM-DD
  w: number; // kg
}

export type MealsOn = Record<MealId, boolean>;

export interface AppState {
  foods: Food[];
  goals: Goals;
  log: Record<string, LogEntry[]>;
  weights: WeightEntry[];
  alc?: number;
  mealsOn: MealsOn;
  theme?: ThemePreference;
  dbVersion?: number;
}

export interface MealMeta {
  id: MealId;
  name: string;
  shortName: string;
}

export interface DayTotals {
  k: number;
  p: number;
  c: number;
  f: number;
  al: number;
  n: number;
}
