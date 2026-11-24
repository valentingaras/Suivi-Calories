import type { LogEntry, WeightEntry } from '../types/nutrition';
import { dayTotals, shiftDateKey, todayKey } from './nutrition';

export type MetabolismWindow = 21 | 28 | 60 | 90 | 'all';
export type MetabolismConfidence = 'medium' | 'good' | 'high';

export interface MetabolismOptions {
  windowDays: MetabolismWindow;
  excludeLowDays: boolean;
  minKcalThreshold?: number;
  anchorDateKey?: string;
}

export interface MetabolismPrerequisites {
  effectiveDays: number;
  minSpanDays: number;
  weightSpanDays: number;
  weightCount: number;
  minWeightCount: number;
  validIntakeCount: number;
  coverageRatio: number;
  minCoverageRatio: number;
  hasEnoughSpan: boolean;
  hasEnoughWeights: boolean;
  hasEnoughCoverage: boolean;
}

export interface MetabolismEstimate {
  ready: boolean;
  windowDays: MetabolismWindow;
  windowStart: string;
  windowEnd: string;
  excludedLowCount: number;
  prerequisites: MetabolismPrerequisites;
  avgIntakeKcal: number;
  weightSlopeKgPerDay: number;
  weightTrendKgPerWeek: number;
  modeledWeightChangeKg: number;
  dailyEnergyBalanceKcal: number; // positive = surplus, negative = deficit
  estimatedTdee: number; // raw rounded to nearest 10 kcal
  isExtremeEstimate: boolean;
  rmseKg: number;
  confidence: MetabolismConfidence;
}

const KCAL_PER_KG = 7700;
const MIN_SPAN_DAYS = 14;
const MIN_WEIGHT_SPAN_DAYS = 13; // 14 calendar days inclusive
const MIN_WEIGHT_COUNT = 4;
const MIN_COVERAGE_RATIO = 0.7;
export const DEFAULT_MIN_KCAL_FLOOR = 500;

function parseDayMs(dk: string): number {
  return new Date(`${dk}T00:00:00`).getTime();
}

function diffCalendarDays(startDk: string, endDk: string): number {
  const msPerDay = 86_400_000;
  return Math.round((parseDayMs(endDk) - parseDayMs(startDk)) / msPerDay);
}

export function computeMetabolismEstimate(
  log: Record<string, LogEntry[]>,
  weights: WeightEntry[],
  options: MetabolismOptions
): MetabolismEstimate {
  const {
    windowDays,
    excludeLowDays,
    minKcalThreshold = DEFAULT_MIN_KCAL_FLOOR,
    anchorDateKey = todayKey(),
  } = options;

  const windowEnd = anchorDateKey;
  const numericWindowStart =
    windowDays === 'all' ? null : shiftDateKey(anchorDateKey, -(windowDays - 1));

  // Gather food intake days inside [windowStart, windowEnd]
  const validIntakes: Array<{ dk: string; kcal: number }> = [];
  let excludedLowCount = 0;

  if (numericWindowStart === null) {
    const sortedLogKeys = Object.keys(log)
      .filter((dk) => dk <= windowEnd)
      .sort();
    for (const dk of sortedLogKeys) {
      const totals = dayTotals(log[dk]);
      if (totals.n === 0) continue;
      if (excludeLowDays && totals.k < minKcalThreshold) {
        excludedLowCount += 1;
        continue;
      }
      validIntakes.push({ dk, kcal: totals.k });
    }
  } else {
    for (let i = 0; i < (windowDays as number); i++) {
      const dk = shiftDateKey(numericWindowStart, i);
      const totals = dayTotals(log[dk]);
      if (totals.n === 0) continue;
      if (excludeLowDays && totals.k < minKcalThreshold) {
        excludedLowCount += 1;
        continue;
      }
      validIntakes.push({ dk, kcal: totals.k });
    }
  }

  // Gather sorted weigh-ins inside [windowStart, windowEnd]
  const windowWeights = weights
    .filter(
      (w) =>
        (numericWindowStart === null || w.d >= numericWindowStart) &&
        w.d <= windowEnd &&
        Number.isFinite(w.w) &&
        w.w > 0
    )
    .sort((a, b) => (a.d < b.d ? -1 : 1));

  const firstFoodDk = validIntakes[0]?.dk ?? null;
  const lastFoodDk = validIntakes[validIntakes.length - 1]?.dk ?? null;
  const firstWeightDk = windowWeights[0]?.d ?? null;
  const lastWeightDk = windowWeights[windowWeights.length - 1]?.d ?? null;

  // Determine effective active span inside the selected window
  const candidateStarts = [firstFoodDk, firstWeightDk].filter(Boolean) as string[];
  const candidateEnds = [lastFoodDk, lastWeightDk].filter(Boolean) as string[];

  const windowStart =
    numericWindowStart ??
    (candidateStarts.length > 0
      ? candidateStarts.reduce((a, b) => (a < b ? a : b))
      : windowEnd);

  let effectiveDays = 0;
  if (candidateStarts.length > 0 && candidateEnds.length > 0) {
    const effStart = candidateStarts.reduce((a, b) => (a < b ? a : b));
    const latestData = candidateEnds.reduce((a, b) => (a > b ? a : b));
    // Include up to yesterday if today hasn't been logged yet, otherwise up to today
    const yesterdayDk = shiftDateKey(anchorDateKey, -1);
    const effEnd =
      latestData === anchorDateKey
        ? anchorDateKey
        : latestData >= yesterdayDk
          ? yesterdayDk
          : anchorDateKey;
    effectiveDays = Math.max(1, diffCalendarDays(effStart, effEnd) + 1);
  }

  const weightSpanDays =
    firstWeightDk && lastWeightDk
      ? Math.max(0, diffCalendarDays(firstWeightDk, lastWeightDk))
      : 0;

  const coverageRatio =
    effectiveDays > 0 ? Math.min(1, validIntakes.length / effectiveDays) : 0;

  const hasEnoughSpan =
    effectiveDays >= MIN_SPAN_DAYS && weightSpanDays >= MIN_WEIGHT_SPAN_DAYS;
  const hasEnoughWeights = windowWeights.length >= MIN_WEIGHT_COUNT;
  const hasEnoughCoverage =
    validIntakes.length >= Math.ceil(MIN_SPAN_DAYS * MIN_COVERAGE_RATIO) &&
    coverageRatio >= MIN_COVERAGE_RATIO;

  const ready = hasEnoughSpan && hasEnoughWeights && hasEnoughCoverage;

  const prerequisites: MetabolismPrerequisites = {
    effectiveDays,
    minSpanDays: MIN_SPAN_DAYS,
    weightSpanDays,
    weightCount: windowWeights.length,
    minWeightCount: MIN_WEIGHT_COUNT,
    validIntakeCount: validIntakes.length,
    coverageRatio,
    minCoverageRatio: MIN_COVERAGE_RATIO,
    hasEnoughSpan,
    hasEnoughWeights,
    hasEnoughCoverage,
  };

  if (!ready || !firstWeightDk) {
    return {
      ready: false,
      windowDays,
      windowStart,
      windowEnd,
      excludedLowCount,
      prerequisites,
      avgIntakeKcal: 0,
      weightSlopeKgPerDay: 0,
      weightTrendKgPerWeek: 0,
      modeledWeightChangeKg: 0,
      dailyEnergyBalanceKcal: 0,
      estimatedTdee: 0,
      isExtremeEstimate: false,
      rmseKg: 0,
      confidence: 'medium',
    };
  }

  // Average daily calorie intake over valid logged days
  const totalIntake = validIntakes.reduce((sum, item) => sum + item.kcal, 0);
  const avgIntakeKcal = totalIntake / validIntakes.length;

  // Ordinary least squares linear regression on weigh-ins inside the window
  const points = windowWeights.map((pt) => ({
    t: diffCalendarDays(firstWeightDk, pt.d),
    w: pt.w,
  }));

  const m = points.length;
  const meanT = points.reduce((s, p) => s + p.t, 0) / m;
  const meanW = points.reduce((s, p) => s + p.w, 0) / m;

  let stt = 0;
  let stw = 0;
  for (const p of points) {
    const dt = p.t - meanT;
    stt += dt * dt;
    stw += dt * (p.w - meanW);
  }

  const slope = stt > 0 ? stw / stt : 0; // kg per day
  const intercept = meanW - slope * meanT;

  let sse = 0;
  for (const p of points) {
    const err = p.w - (intercept + slope * p.t);
    sse += err * err;
  }
  const rmseKg = m > 2 ? Math.sqrt(sse / (m - 2)) : 0;

  const dailyEnergyBalanceKcal = slope * KCAL_PER_KG;
  const rawTdee = avgIntakeKcal - dailyEnergyBalanceKcal;
  const estimatedTdee = Math.round(rawTdee / 10) * 10;
  const isExtremeEstimate = estimatedTdee < 900 || estimatedTdee > 5500;

  let confidence: MetabolismConfidence = 'medium';
  if (
    effectiveDays >= 21 &&
    windowWeights.length >= 7 &&
    coverageRatio >= 0.85 &&
    rmseKg < 0.75
  ) {
    confidence = 'high';
  } else if (
    effectiveDays >= 18 &&
    windowWeights.length >= 5 &&
    coverageRatio >= 0.78 &&
    rmseKg < 1.1
  ) {
    confidence = 'good';
  }

  return {
    ready: true,
    windowDays,
    windowStart,
    windowEnd,
    excludedLowCount,
    prerequisites,
    avgIntakeKcal: Math.round(avgIntakeKcal),
    weightSlopeKgPerDay: slope,
    weightTrendKgPerWeek: slope * 7,
    modeledWeightChangeKg: slope * weightSpanDays,
    dailyEnergyBalanceKcal: Math.round(dailyEnergyBalanceKcal),
    estimatedTdee,
    isExtremeEstimate,
    rmseKg,
    confidence,
  };
}
