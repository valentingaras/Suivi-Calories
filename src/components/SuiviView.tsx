import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Goals, LogEntry, WeightEntry } from '../types/nutrition';
import {
  dateKey,
  dayTotals,
  formatDayLabel,
  formatDecimalFr,
  formatShortDate,
  round1,
} from '../utils/nutrition';
import { MetabolismCard } from './MetabolismCard';

interface SuiviViewProps {
  log: Record<string, LogEntry[]>;
  goals: Goals;
  weights: WeightEntry[];
  onOpenDay: (dk: string) => void;
  onApplyGoalKcal?: (nextKcal: number) => void;
}

export function SuiviView({
  log,
  goals,
  weights,
  onOpenDay,
  onApplyGoalKcal,
}: SuiviViewProps) {
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
  const [hoveredWeightIdx, setHoveredWeightIdx] = useState<number | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const days14 = useMemo(() => {
    const now = new Date();
    const list: Array<{ dk: string; dt: Date; totals: ReturnType<typeof dayTotals> }> = [];
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dk = dateKey(dt);
      list.push({ dk, dt, totals: dayTotals(log[dk]) });
    }
    return list;
  }, [log]);

  const averages = useMemo(() => {
    const last7 = days14.slice(7);
    const active = last7.filter((d) => d.totals.n > 0);
    const n = active.length;
    let al = 0;
    for (const d of last7) al += d.totals.al;
    if (!n) return { n: 0, k: 0, p: 0, c: 0, f: 0, al };
    const sum = active.reduce(
      (acc, d) => ({
        k: acc.k + d.totals.k,
        p: acc.p + d.totals.p,
        c: acc.c + d.totals.c,
        f: acc.f + d.totals.f,
      }),
      { k: 0, p: 0, c: 0, f: 0 }
    );
    return {
      n,
      k: Math.round(sum.k / n),
      p: round1(sum.p / n),
      c: round1(sum.c / n),
      f: round1(sum.f / n),
      al,
    };
  }, [days14]);

  const sortedWeights = useMemo(
    () => [...weights].sort((a, b) => (a.d < b.d ? -1 : 1)),
    [weights]
  );

  const historyKeys = useMemo(
    () =>
      Object.keys(log)
        .filter((k) => log[k] && log[k].length > 0)
        .sort()
        .reverse(),
    [log]
  );

  // 14-day bar chart math
  const chartW = 560;
  const chartH = 190;
  const padTop = 18;
  const padBottom = 28;
  const maxKcal = Math.max(
    goals.k || 0,
    ...days14.map((d) => d.totals.k)
  ) * 1.12;
  const barSlotW = chartW / 14;
  const hoveredDay = hoveredDayIdx !== null ? days14[hoveredDayIdx] : null;

  // Weight line chart math
  const wChartW = 560;
  const wChartH = 190;
  const wPadL = 44;
  const wPadR = 16;
  const wPadT = 18;
  const wPadB = 28;
  const weightStats = useMemo(() => {
    if (sortedWeights.length < 2) return null;
    const ys = sortedWeights.map((x) => x.w);
    const hi = Math.max(...ys);
    const lo = Math.min(...ys);
    const pad = Math.max(0.3, (hi - lo) * 0.15);
    const mx = hi + pad;
    const mn = lo - pad;
    const toTime = (d: string) => new Date(`${d}T00:00:00`).getTime();
    const t0 = toTime(sortedWeights[0].d);
    const tLast = toTime(sortedWeights[sortedWeights.length - 1].d);
    const span = tLast - t0 || 1;
    const px = (d: string) =>
      wPadL + ((toTime(d) - t0) / span) * (wChartW - wPadL - wPadR);
    const py = (v: number) =>
      wPadT + ((mx - v) / (mx - mn)) * (wChartH - wPadT - wPadB);
    return { hi, lo, px, py };
  }, [sortedWeights]);

  const weightSummary = useMemo(() => {
    if (!sortedWeights.length) return 'Aucune pesée pour l’instant.';
    const first = sortedWeights[0];
    const last = sortedWeights[sortedWeights.length - 1];
    const delta = last.w - first.w;
    const deltaText =
      sortedWeights.length > 1
        ? ` Depuis le ${formatShortDate(first.d)} : ${
            delta > 0 ? '+' : delta < 0 ? '−' : ''
          }${formatDecimalFr(Math.abs(delta))} kg.`
        : '';
    return `Dernière pesée : ${formatDecimalFr(last.w)} kg (${formatShortDate(
      last.d
    )}).${deltaText}`;
  }, [sortedWeights]);

  return (
    <div className="space-y-6">
      {/* 7-day Averages */}
      <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Moyennes sur 7 jours
          </h2>
          {averages.n > 0 && (
            <span className="text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
              Sur {averages.n} jour{averages.n > 1 ? 's' : ''} renseigné
              {averages.n > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {averages.n === 0 ? (
          <p className="mt-3 text-sm text-[#5B6E64] dark:text-[#98ABA0]">
            Aucune donnée enregistrée sur les 7 derniers jours.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-xl bg-[#F6FAF7] p-3.5 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                Calories
              </span>
              <strong className="mt-1 block text-xl font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                {averages.k}{' '}
                <span className="text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                  kcal
                </span>
              </strong>
            </div>
            <div className="rounded-xl bg-[#F6FAF7] p-3.5 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#DC2626] dark:text-[#F87171]">
                Protéines
              </span>
              <strong className="mt-1 block text-xl font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                {formatDecimalFr(averages.p)} g
              </strong>
            </div>
            <div className="rounded-xl bg-[#F6FAF7] p-3.5 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
                Glucides
              </span>
              <strong className="mt-1 block text-xl font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                {formatDecimalFr(averages.c)} g
              </strong>
            </div>
            <div className="rounded-xl bg-[#F6FAF7] p-3.5 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#CA8A04] dark:text-[#EAB308]">
                Lipides
              </span>
              <strong className="mt-1 block text-xl font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                {formatDecimalFr(averages.f)} g
              </strong>
            </div>
            <div className="col-span-2 rounded-xl bg-[#F6FAF7] p-3.5 sm:col-span-1 dark:bg-[#1C2A22]">
              <span className="block text-xs font-medium text-[#6D28D9] dark:text-[#A78BFA]">
                Alcool (7 j)
              </span>
              <strong className="mt-1 block text-xl font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED] font-display">
                {formatDecimalFr(averages.al / 10)}{' '}
                <span className="text-xs font-medium text-[#5B6E64] dark:text-[#98ABA0]">
                  dose{averages.al >= 20 ? 's' : ''}
                </span>
              </strong>
              <span className="mt-0.5 block text-xs font-medium tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                {Math.round(averages.al * 7)} kcal
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 14-day Calorie Bar Chart */}
        <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
              Calories par jour
            </h2>
            <span className="text-xs font-medium tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
              {hoveredDay
                ? `${formatDayLabel(hoveredDay.dk)} : ${Math.round(
                    hoveredDay.totals.k
                  )} kcal`
                : `14 derniers jours · Objectif ${goals.k} kcal`}
            </span>
          </div>

          {!(maxKcal > 0) ? (
            <p className="py-8 text-center text-sm text-[#5B6E64] dark:text-[#98ABA0]">
              Rien à afficher pour l’instant.
            </p>
          ) : (
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              role="img"
              aria-label="Calories par jour sur les 14 derniers jours"
              className="block h-auto w-full select-none"
            >
              {goals.k > 0 && (
                <line
                  x1={0}
                  x2={chartW}
                  y1={chartH - padBottom - (goals.k / maxKcal) * (chartH - padTop - padBottom)}
                  y2={chartH - padBottom - (goals.k / maxKcal) * (chartH - padTop - padBottom)}
                  strokeDasharray="5 4"
                  className="stroke-[#8BA094] dark:stroke-[#5E7367]"
                  strokeWidth={1.5}
                />
              )}
              {days14.map((d, idx) => {
                const barH = (d.totals.k / maxKcal) * (chartH - padTop - padBottom);
                const over = goals.k > 0 && d.totals.k > goals.k;
                const isHovered = hoveredDayIdx === idx;
                return (
                  <g
                    key={d.dk}
                    onMouseEnter={() => setHoveredDayIdx(idx)}
                    onMouseLeave={() => setHoveredDayIdx(null)}
                    onClick={() => {
                      if (d.totals.n > 0) onOpenDay(d.dk);
                    }}
                    className={d.totals.n > 0 ? 'cursor-pointer' : ''}
                  >
                    <rect
                      x={idx * barSlotW}
                      y={0}
                      width={barSlotW}
                      height={chartH}
                      fill="transparent"
                    />
                    <rect
                      x={idx * barSlotW + 5}
                      y={chartH - padBottom - Math.max(barH, d.totals.k > 0 ? 3 : 0)}
                      width={barSlotW - 10}
                      height={Math.max(barH, d.totals.k > 0 ? 3 : 0)}
                      rx={4}
                      className={`transition-opacity ${
                        over
                          ? 'fill-[#E04F44] dark:fill-[#F87171]'
                          : 'fill-[#0D9464] dark:fill-[#34D399]'
                      } ${isHovered ? 'opacity-100' : 'opacity-90'}`}
                    />
                    <text
                      x={idx * barSlotW + barSlotW / 2}
                      y={chartH - 8}
                      textAnchor="middle"
                      className="fill-[#62756A] text-[11px] font-medium tabular-nums dark:fill-[#98ABA0]"
                    >
                      {d.dt.getDate()}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#0D9464] dark:bg-[#34D399]" />
              Dans l’objectif
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#E04F44] dark:bg-[#F87171]" />
              Objectif dépassé
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-[#8BA094]" />
              Objectif ({goals.k} kcal)
            </span>
          </div>
        </section>

        {/* Weight Evolution Chart */}
        <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
              Évolution du poids
            </h2>
            {hoveredWeightIdx !== null && sortedWeights[hoveredWeightIdx] && (
              <span className="text-xs font-semibold tabular-nums text-[#0D9464] dark:text-[#34D399]">
                {formatShortDate(sortedWeights[hoveredWeightIdx].d)} :{' '}
                {formatDecimalFr(sortedWeights[hoveredWeightIdx].w)} kg
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
            {weightSummary}
          </p>

          {!weightStats ? (
            <div className="rounded-xl border border-dashed border-[#DCE5DF] bg-[#FAFDFB] px-4 py-8 text-center dark:border-[#28372E] dark:bg-[#121B16]">
              <p className="text-sm text-[#5B6E64] dark:text-[#98ABA0]">
                {sortedWeights.length === 1
                  ? 'Ajoute une deuxième pesée pour afficher la courbe.'
                  : 'Enregistre tes pesées dans l’onglet Poids pour suivre ton évolution.'}
              </p>
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${wChartW} ${wChartH}`}
              role="img"
              aria-label="Courbe d’évolution du poids"
              className="block h-auto w-full select-none"
            >
              <line
                x1={wPadL}
                y1={wChartH - wPadB}
                x2={wChartW - wPadR}
                y2={wChartH - wPadB}
                className="stroke-[#DCE5DF] dark:stroke-[#2A3930]"
                strokeWidth={1}
              />
              <text
                x={wPadL - 8}
                y={weightStats.py(weightStats.hi) + 4}
                textAnchor="end"
                className="fill-[#62756A] text-[11px] tabular-nums dark:fill-[#98ABA0]"
              >
                {formatDecimalFr(weightStats.hi)}
              </text>
              {weightStats.hi - weightStats.lo > 0.2 && (
                <text
                  x={wPadL - 8}
                  y={weightStats.py(weightStats.lo) + 4}
                  textAnchor="end"
                  className="fill-[#62756A] text-[11px] tabular-nums dark:fill-[#98ABA0]"
                >
                  {formatDecimalFr(weightStats.lo)}
                </text>
              )}
              <text
                x={wPadL}
                y={wChartH - 8}
                className="fill-[#62756A] text-[11px] dark:fill-[#98ABA0]"
              >
                {formatShortDate(sortedWeights[0].d)}
              </text>
              <text
                x={wChartW - wPadR}
                y={wChartH - 8}
                textAnchor="end"
                className="fill-[#62756A] text-[11px] dark:fill-[#98ABA0]"
              >
                {formatShortDate(sortedWeights[sortedWeights.length - 1].d)}
              </text>
              <polyline
                fill="none"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="stroke-[#0D9464] dark:stroke-[#34D399]"
                points={sortedWeights
                  .map(
                    (pt) =>
                      `${weightStats.px(pt.d).toFixed(1)},${weightStats
                        .py(pt.w)
                        .toFixed(1)}`
                  )
                  .join(' ')}
              />
              {sortedWeights.map((pt, idx) => (
                <circle
                  key={pt.d}
                  cx={weightStats.px(pt.d)}
                  cy={weightStats.py(pt.w)}
                  r={hoveredWeightIdx === idx ? 6 : 4}
                  onMouseEnter={() => setHoveredWeightIdx(idx)}
                  onMouseLeave={() => setHoveredWeightIdx(null)}
                  className="cursor-pointer fill-[#0D9464] stroke-white stroke-2 transition-all dark:fill-[#34D399] dark:stroke-[#16211B]"
                />
              ))}
            </svg>
          )}
        </section>
      </div>

      {/* Real Metabolism Estimate */}
      <MetabolismCard
        log={log}
        goals={goals}
        weights={weights}
        onApplyGoalKcal={onApplyGoalKcal}
      />

      {/* Meal History */}
      <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Historique des repas
          </h2>
          {historyKeys.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllHistory((prev) => !prev)}
              aria-expanded={showAllHistory}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0D9464] transition-colors hover:bg-[#ECF8F1] dark:text-[#34D399] dark:hover:bg-[#193528] cursor-pointer"
            >
              <span>
                {showAllHistory
                  ? 'Réduire'
                  : `Tout voir (${historyKeys.length})`}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  showAllHistory ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {historyKeys.length === 0 ? (
          <p className="text-sm text-[#5B6E64] dark:text-[#98ABA0]">
            Aucun historique pour l’instant.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-[#EDF2EE] dark:divide-[#233229]">
              {(showAllHistory ? historyKeys : historyKeys.slice(0, 3)).map((dk) => {
                const t = dayTotals(log[dk]);
                return (
                  <li key={dk}>
                    <button
                      type="button"
                      onClick={() => onOpenDay(dk)}
                      aria-haspopup="dialog"
                      className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#F5F9F6] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0D9464] dark:hover:bg-[#1C2A22] cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="block text-sm font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                          {formatDayLabel(dk)}
                        </span>
                        <span className="mt-0.5 block text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                          Prot. {formatDecimalFr(t.p)} · Glu. {formatDecimalFr(t.c)} ·
                          Lip. {formatDecimalFr(t.f)}
                          {t.al
                            ? ` · Alc ${formatDecimalFr(t.al / 10)} d (${Math.round(
                                t.al * 7
                              )} kcal)`
                            : ''}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED]">
                          {Math.round(t.k)} kcal
                        </span>
                        <ChevronRight
                          className="h-4 w-4 text-[#7D9186]"
                          aria-hidden="true"
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {historyKeys.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                aria-expanded={showAllHistory}
                className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#DCE5DF] bg-[#FAFDFB] px-4 py-2 text-xs font-semibold text-[#394B42] transition-colors hover:bg-[#EDF3EF] dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#C5D4CB] dark:hover:bg-[#1D2B23] cursor-pointer"
              >
                <span>
                  {showAllHistory
                    ? 'Afficher uniquement les 3 derniers'
                    : `Voir les ${historyKeys.length - 3} autres jours`}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showAllHistory ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
