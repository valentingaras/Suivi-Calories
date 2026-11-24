import { useMemo, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Goals, LogEntry, WeightEntry } from '../types/nutrition';
import {
  DEFAULT_MIN_KCAL_FLOOR,
  computeMetabolismEstimate,
  type MetabolismConfidence,
  type MetabolismWindow,
} from '../utils/metabolism';
import { formatDecimalFr, suggestedGoals } from '../utils/nutrition';

interface MetabolismCardProps {
  log: Record<string, LogEntry[]>;
  goals: Goals;
  weights: WeightEntry[];
  onApplyGoalKcal?: (nextKcal: number) => void;
}

const WINDOW_OPTIONS: Array<{ value: MetabolismWindow; label: string }> = [
  { value: 21, label: '21 j' },
  { value: 28, label: '28 j' },
  { value: 60, label: '60 j' },
  { value: 90, label: '90 j' },
  { value: 'all', label: 'Tout' },
];

const CONFIDENCE_META: Record<
  MetabolismConfidence,
  { label: string; textClass: string }
> = {
  high: {
    label: 'Fiabilité élevée',
    textClass: 'text-[#0B7B54] dark:text-[#34D399]',
  },
  good: {
    label: 'Bonne fiabilité',
    textClass: 'text-[#0D9464] dark:text-[#34D399]',
  },
  medium: {
    label: 'Fiabilité moyenne',
    textClass: 'text-[#B45309] dark:text-[#FBBF24]',
  },
};

function roundTo10(value: number): number {
  return Math.max(800, Math.round(value / 10) * 10);
}

export function MetabolismCard({
  log,
  goals,
  weights,
  onApplyGoalKcal,
}: MetabolismCardProps) {
  const [windowDays, setWindowDays] = useState<MetabolismWindow>(28);
  const [excludeLowDays, setExcludeLowDays] = useState<boolean>(true);
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  const estimate = useMemo(
    () =>
      computeMetabolismEstimate(log, weights, {
        windowDays,
        excludeLowDays,
        minKcalThreshold: DEFAULT_MIN_KCAL_FLOOR,
      }),
    [log, weights, windowDays, excludeLowDays]
  );

  const theoretical = useMemo(
    () => suggestedGoals(goals, weights),
    [goals, weights]
  );

  const { prerequisites: pre } = estimate;
  const weightCoveredDays = pre.weightCount >= 2 ? pre.weightSpanDays + 1 : 0;
  const spanPct = Math.min(100, Math.round((weightCoveredDays / pre.minSpanDays) * 100));
  const weightPct = Math.min(
    100,
    Math.round((pre.weightCount / pre.minWeightCount) * 100)
  );
  const minValidDays = Math.ceil(pre.minSpanDays * pre.minCoverageRatio);
  const coveragePct = Math.round(pre.coverageRatio * 100);
  const intakeBarPct = Math.min(
    100,
    Math.round(
      Math.min(
        pre.coverageRatio / pre.minCoverageRatio,
        pre.validIntakeCount / minValidDays
      ) * 100
    )
  );

  const trendWeeklyAbs = Math.abs(estimate.weightTrendKgPerWeek);
  const trendDirection =
    trendWeeklyAbs < 0.05
      ? 'Stabilité'
      : estimate.weightTrendKgPerWeek < 0
        ? 'Perte'
        : 'Prise';
  const trendSign =
    trendWeeklyAbs < 0.05
      ? ''
      : estimate.weightTrendKgPerWeek < 0
        ? '−'
        : '+';

  const balanceAbs = Math.abs(estimate.dailyEnergyBalanceKcal);
  const balanceLabel =
    balanceAbs < 25
      ? 'Équilibre'
      : estimate.dailyEnergyBalanceKcal < 0
        ? 'Déficit'
        : 'Surplus';
  const balanceSign =
    balanceAbs < 25
      ? ''
      : estimate.dailyEnergyBalanceKcal < 0
        ? '−'
        : '+';

  const theoreticalDiff =
    theoretical && estimate.ready ? estimate.estimatedTdee - theoretical.e : null;

  const targetSuggestions = useMemo(() => {
    if (!estimate.ready || estimate.isExtremeEstimate) return [];
    return [
      {
        id: 'loss',
        label: 'Perte douce',
        delta: '−300 kcal',
        kcal: roundTo10(estimate.estimatedTdee - 300),
      },
      {
        id: 'maintain',
        label: 'Maintien',
        delta: 'Équilibre',
        kcal: roundTo10(estimate.estimatedTdee),
      },
      {
        id: 'gain',
        label: 'Prise lente',
        delta: '+250 kcal',
        kcal: roundTo10(estimate.estimatedTdee + 250),
      },
    ];
  }, [estimate.ready, estimate.isExtremeEstimate, estimate.estimatedTdee]);

  const handleApply = (kcal: number) => {
    if (!onApplyGoalKcal) return;
    onApplyGoalKcal(kcal);
    setAppliedMsg(`Objectif journalier mis à jour à ${kcal} kcal.`);
  };

  const confMeta = CONFIDENCE_META[estimate.confidence];

  return (
    <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
      {/* Header + Period selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Métabolisme réel estimé
          </h2>
          <p className="mt-0.5 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
            Dépense réelle calculée selon vos calories consommées et la tendance du poids
          </p>
        </div>

        <div
          role="group"
          aria-label="Période d’analyse du métabolisme"
          className="inline-grid grid-cols-5 gap-1 rounded-xl bg-[#ECF2EE] p-1 self-start sm:self-auto dark:bg-[#111A15]"
        >
          {WINDOW_OPTIONS.map((opt) => {
            const active = windowDays === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  setWindowDays(opt.value);
                  setAppliedMsg(null);
                }}
                className={`min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-[#14231C] shadow-xs dark:bg-[#1D2B23] dark:text-[#EAF2ED]'
                    : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Incomplete-day auto-filter toggle */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#EDF2EE] pb-3.5 dark:border-[#233229]">
        <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-xs font-medium text-[#394B42] dark:text-[#B9C9C0]">
          <input
            type="checkbox"
            checked={excludeLowDays}
            onChange={(e) => {
              setExcludeLowDays(e.target.checked);
              setAppliedMsg(null);
            }}
            className="h-4 w-4 rounded border-[#C6D5CC] accent-[#0D9464] cursor-pointer"
          />
          <span>
            Ignorer les journées incomplètes (&lt; {DEFAULT_MIN_KCAL_FLOOR} kcal)
          </span>
        </label>

        {estimate.excludedLowCount > 0 && (
          <span className="text-xs font-medium tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
            {estimate.excludedLowCount} jour{estimate.excludedLowCount > 1 ? 's' : ''} incomplet
            {estimate.excludedLowCount > 1 ? 's' : ''} exclu
            {estimate.excludedLowCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!estimate.ready ? (
        /* Prerequisites State */
        <div className="mt-4 space-y-4">
          <p className="text-sm leading-relaxed text-[#52655B] dark:text-[#98ABA0]">
            Continuez à noter vos repas et vos pesées : il faut encore un peu de recul
            pour lisser les variations naturelles d’eau et estimer votre dépense réelle.
          </p>

          <div className="space-y-3 rounded-xl bg-[#F6FAF7] p-4 dark:bg-[#1C2A22]">
            {/* 1. Weight Span */}
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#14231C] dark:text-[#EAF2ED]">
                  Amplitude des pesées
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    pre.hasEnoughSpan
                      ? 'text-[#0B7B54] dark:text-[#34D399]'
                      : 'text-[#5B6E64] dark:text-[#98ABA0]'
                  }`}
                >
                  {weightCoveredDays} / {pre.minSpanDays} jours
                  {pre.hasEnoughSpan ? ' · Validé' : ''}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#DCE6E0] dark:bg-[#27372E]">
                <div
                  className={`h-full rounded-full transition-all ${
                    pre.hasEnoughSpan
                      ? 'bg-[#0D9464] dark:bg-[#34D399]'
                      : 'bg-[#6FA892] dark:bg-[#2E7D61]'
                  }`}
                  style={{ width: `${spanPct}%` }}
                />
              </div>
            </div>

            {/* 2. Weight Count */}
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#14231C] dark:text-[#EAF2ED]">
                  Pesées sur la période
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    pre.hasEnoughWeights
                      ? 'text-[#0B7B54] dark:text-[#34D399]'
                      : 'text-[#5B6E64] dark:text-[#98ABA0]'
                  }`}
                >
                  {pre.weightCount} / {pre.minWeightCount} pesées
                  {pre.hasEnoughWeights ? ' · Validé' : ''}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#DCE6E0] dark:bg-[#27372E]">
                <div
                  className={`h-full rounded-full transition-all ${
                    pre.hasEnoughWeights
                      ? 'bg-[#0D9464] dark:bg-[#34D399]'
                      : 'bg-[#6FA892] dark:bg-[#2E7D61]'
                  }`}
                  style={{ width: `${weightPct}%` }}
                />
              </div>
            </div>

            {/* 3. Food Coverage */}
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#14231C] dark:text-[#EAF2ED]">
                  Jours alimentaires renseignés
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    pre.hasEnoughCoverage
                      ? 'text-[#0B7B54] dark:text-[#34D399]'
                      : 'text-[#5B6E64] dark:text-[#98ABA0]'
                  }`}
                >
                  {coveragePct} % ({pre.validIntakeCount} j · min. {minValidDays} j et 70 %)
                  {pre.hasEnoughCoverage ? ' · Validé' : ''}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#DCE6E0] dark:bg-[#27372E]">
                <div
                  className={`h-full rounded-full transition-all ${
                    pre.hasEnoughCoverage
                      ? 'bg-[#0D9464] dark:bg-[#34D399]'
                      : 'bg-[#6FA892] dark:bg-[#2E7D61]'
                  }`}
                  style={{ width: `${intakeBarPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Ready State */
        <div className="mt-4 space-y-5">
          {/* Primary Result */}
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="block text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                Dépense journalière estimée (entretien)
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <strong className="text-3xl font-bold tracking-tight tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                  {estimate.estimatedTdee}
                </strong>
                <span className="text-sm font-semibold text-[#5B6E64] dark:text-[#98ABA0]">
                  kcal / jour
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className={`font-semibold ${confMeta.textClass}`}>
                {confMeta.label}
              </span>
              <span aria-hidden="true" className="text-[#9AAEA3] dark:text-[#5E7367]">
                ·
              </span>
              <span className="tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                {pre.validIntakeCount} j saisis ({coveragePct} %)
              </span>
              <span aria-hidden="true" className="text-[#9AAEA3] dark:text-[#5E7367]">
                ·
              </span>
              <span className="tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                {pre.weightCount} pesées
              </span>
            </div>
          </div>

          {estimate.isExtremeEstimate && (
            <p
              role="status"
              className="rounded-xl bg-[#FEF3C7] px-3.5 py-2.5 text-xs font-medium leading-relaxed text-[#92400E] dark:bg-[#332712] dark:text-[#FCD34D]"
            >
              Variation de poids importante sur une période courte : prolongez le suivi
              ou vérifiez vos pesées récentes pour obtenir une estimation plus stable.
            </p>
          )}

          {/* 3-KPI Breakdown */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#F6FAF7] p-3.5 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                Apport moyen (
                {windowDays === 'all' ? `${pre.effectiveDays} j` : `${windowDays} j`})
              </span>
              <strong className="mt-1 block text-lg font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                {estimate.avgIntakeKcal}{' '}
                <span className="text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                  kcal/j
                </span>
              </strong>
            </div>

            <div className="rounded-xl bg-[#F6FAF7] p-3.5 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                Tendance poids · {trendDirection}
              </span>
              <strong
                className={`mt-1 block text-lg font-bold tabular-nums font-display ${
                  trendDirection === 'Perte'
                    ? 'text-[#0B7B54] dark:text-[#34D399]'
                    : trendDirection === 'Prise'
                      ? 'text-[#B45309] dark:text-[#FBBF24]'
                      : 'text-[#14231C] dark:text-[#EAF2ED]'
                }`}
              >
                {trendSign}
                {formatDecimalFr(trendWeeklyAbs)}{' '}
                <span className="text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                  kg/sem.
                </span>
              </strong>
            </div>

            <div className="rounded-xl bg-[#F6FAF7] p-3.5 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                Bilan · {balanceLabel}
              </span>
              <strong className="mt-1 block text-lg font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                {balanceSign}
                {balanceAbs}{' '}
                <span className="text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                  kcal/j
                </span>
              </strong>
            </div>
          </div>

          {/* Comparison with theoretical formula from Paramètres */}
          {theoretical && theoreticalDiff !== null && (
            <p className="text-xs leading-relaxed text-[#5B6E64] dark:text-[#98ABA0]">
              Comparaison avec la formule théorique (Paramètres) :{' '}
              <strong className="font-semibold tabular-nums text-[#14231C] dark:text-[#EAF2ED]">
                {theoretical.e} kcal/j
              </strong>{' '}
              ({theoreticalDiff === 0
                ? 'identique'
                : `${theoreticalDiff > 0 ? '+' : '−'}${Math.abs(theoreticalDiff)} kcal/j d’écart`}
              ).
            </p>
          )}

          {/* Actionable Target Buttons */}
          {targetSuggestions.length > 0 && onApplyGoalKcal && (
            <div className="border-t border-[#EDF2EE] pt-4 dark:border-[#233229]">
              <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                  Appliquer comme objectif journalier
                </span>
                <span className="text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                  Actuel : {goals.k} kcal
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {targetSuggestions.map((item) => {
                  const isCurrent = goals.k === item.kcal;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleApply(item.kcal)}
                      className={`flex min-h-[48px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                        isCurrent
                          ? 'border-[#0D9464] bg-[#ECF8F1] dark:border-[#34D399] dark:bg-[#193528]'
                          : 'border-[#DCE5DF] bg-[#FAFDFB] hover:border-[#0D9464] hover:bg-[#F3FAF6] dark:border-[#2C3C32] dark:bg-[#111A15] dark:hover:border-[#34D399] dark:hover:bg-[#192820]'
                      }`}
                    >
                      <div>
                        <span className="block text-xs font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                          {item.label}
                        </span>
                        <span className="block text-[11px] text-[#5B6E64] dark:text-[#98ABA0]">
                          {item.delta}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-sm font-bold tabular-nums text-[#0D9464] dark:text-[#34D399]">
                          {item.kcal} kcal
                        </span>
                        {isCurrent && (
                          <Check
                            className="h-4 w-4 text-[#0D9464] dark:text-[#34D399]"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {appliedMsg && (
                <p
                  role="status"
                  className="mt-2.5 text-xs font-semibold text-[#0B7B54] dark:text-[#34D399]"
                >
                  {appliedMsg}
                </p>
              )}
            </div>
          )}

          {/* Method Disclosure */}
          <details className="group border-t border-[#EDF2EE] pt-3 dark:border-[#233229]">
            <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between text-xs font-medium text-[#5B6E64] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]">
              <span>Comment ce métabolisme est-il calculé ?</span>
              <ChevronDown
                className="h-4 w-4 transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-[#5B6E64] dark:text-[#98ABA0]">
              La pente réelle de votre poids est calculée par régression linéaire sur{' '}
              {windowDays === 'all'
                ? `l’ensemble de vos pesées (${pre.effectiveDays} jours)`
                : `toutes les pesées des ${windowDays} derniers jours`}{' '}
              afin d’absorber les fluctuations d’eau. Chaque kilogramme de tendance équivaut
              à environ{' '}
              <strong className="font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                7 700 kcal
              </strong>
              , soustraits (ou ajoutés) à votre moyenne calorique quotidienne sur les
              journées valides.
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
