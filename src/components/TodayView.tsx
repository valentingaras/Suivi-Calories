import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Moon,
  Plus,
  RotateCcw,
  Sunrise,
  Utensils,
} from 'lucide-react';
import type {
  DrinkCategory,
  Food,
  Goals,
  LogEntry,
  MealId,
  MealsOn,
  TempMeal,
} from '../types/nutrition';
import {
  dayTotals,
  dosesForDay,
  formatDecimalFr,
  formatLongDayLabel,
  mealOf,
  parseNum,
  recommendedMacros,
  rolling7DayAlcoholDoses,
  round1,
  shiftDateKey,
  todayKey,
  visibleMealsForEntries,
} from '../utils/nutrition';
import { CalorieRing } from './CalorieRing';

interface TodayViewProps {
  currentDate: string;
  onChangeDate: (date: string) => void;
  entries: LogEntry[];
  allLog: Record<string, LogEntry[]>;
  goals: Goals;
  foods: Food[];
  tempMeals: TempMeal[];
  mealsOn: MealsOn;
  activeMeal: MealId;
  onSelectMeal: (meal: MealId) => void;
  selectedFoodId: string;
  selectedTempMealId: string;
  activeInputKind: 'food' | 'temp';
  onOpenFoodPicker: () => void;
  onOpenNewFood: () => void;
  onAddEntry: (
    food: Food,
    grams: number,
    meal: MealId,
    options?: { units?: number; cl?: number }
  ) => void;
  onAddTempMealPortion: (dish: TempMeal, percent: number, meal: MealId) => void;
  onOpenEntry: (entry: LogEntry) => void;
}

const MEAL_ICONS: Record<MealId, typeof Sunrise> = {
  b: Sunrise,
  l: Utensils,
  d: Moon,
  o: Apple,
};

const QUICK_GRAMS = [50, 100, 150, 200];
const QUICK_UNITS = [1, 2, 3, 4, 6];
const QUICK_PERCENTS = [20, 25, 33, 50, 100];

const DRINK_QUICK_PRESETS: Record<
  DrinkCategory,
  Array<{ cl: number; label: string }>
> = {
  beer: [
    { cl: 25, label: '0,25 L' },
    { cl: 33, label: '0,33 L' },
    { cl: 50, label: '0,5 L' },
    { cl: 100, label: '1 L' },
  ],
  wine: [
    { cl: 12, label: '12 cL' },
    { cl: 25, label: '25 cL' },
    { cl: 50, label: '50 cL' },
  ],
  soda: [
    { cl: 25, label: '25 cL' },
    { cl: 33, label: '33 cL' },
  ],
  spirit: [
    { cl: 2, label: '2 cL' },
    { cl: 4, label: '4 cL' },
    { cl: 6, label: '6 cL' },
    { cl: 10, label: '10 cL' },
  ],
  other: [
    { cl: 10, label: '10 cL' },
    { cl: 20, label: '20 cL' },
    { cl: 25, label: '25 cL' },
    { cl: 33, label: '33 cL' },
  ],
};

export function TodayView({
  currentDate,
  onChangeDate,
  entries,
  allLog,
  goals,
  foods,
  tempMeals,
  mealsOn,
  activeMeal,
  onSelectMeal,
  selectedFoodId,
  selectedTempMealId,
  activeInputKind,
  onOpenFoodPicker,
  onOpenNewFood,
  onAddEntry,
  onAddTempMealPortion,
  onOpenEntry,
}: TodayViewProps) {
  const [gramsInput, setGramsInput] = useState('');
  const [unitMode, setUnitMode] = useState<'g' | 'unit'>('g');
  const [pctInput, setPctInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [tempErrorMsg, setTempErrorMsg] = useState('');
  const gramsInputRef = useRef<HTMLInputElement>(null);
  const pctInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const prevSelectedFoodIdRef = useRef<string>(selectedFoodId);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.focus();
        input.click();
      }
    } catch {
      input.focus();
    }
  };

  const today = todayKey();
  const isToday = currentDate === today;

  const visibleMeals = useMemo(
    () => visibleMealsForEntries(mealsOn, entries),
    [mealsOn, entries]
  );

  const effectiveMeal: MealId = visibleMeals.some((m) => m.id === activeMeal)
    ? activeMeal
    : visibleMeals[0].id;

  const effectiveMealMeta =
    visibleMeals.find((m) => m.id === effectiveMeal) ?? visibleMeals[0];

  const totals = useMemo(() => dayTotals(entries), [entries]);
  const rc = useMemo(() => recommendedMacros(goals), [goals]);

  const todayDoses = useMemo(() => dosesForDay(entries), [entries]);
  const weekDoses = useMemo(
    () => rolling7DayAlcoholDoses(allLog, currentDate),
    [allLog, currentDate]
  );

  const selectedFood = useMemo(
    () => foods.find((f) => f.id === selectedFoodId) ?? null,
    [foods, selectedFoodId]
  );

  useEffect(() => {
    if (prevSelectedFoodIdRef.current !== selectedFoodId) {
      prevSelectedFoodIdRef.current = selectedFoodId;
      setUnitMode(selectedFood?.u && selectedFood.u > 0 ? 'unit' : 'g');
      setGramsInput('');
      setErrorMsg('');
    }
  }, [selectedFoodId, selectedFood]);

  const effectiveInputMode: 'g' | 'unit' | 'cl' = selectedFood?.b
    ? 'cl'
    : unitMode === 'unit' && selectedFood?.u && selectedFood.u > 0
      ? 'unit'
      : 'g';

  const selectedTempMeal = useMemo(
    () =>
      tempMeals.find((m) => m.id === selectedTempMealId) ??
      tempMeals[0] ??
      null,
    [tempMeals, selectedTempMealId]
  );

  const parsedAmount = parseNum(gramsInput);
  const effectiveGrams = useMemo(() => {
    if (!(parsedAmount > 0)) return NaN;
    if (effectiveInputMode === 'cl') {
      return round1(parsedAmount * 10);
    }
    if (effectiveInputMode === 'unit' && selectedFood?.u) {
      return round1(parsedAmount * selectedFood.u);
    }
    return parsedAmount;
  }, [parsedAmount, effectiveInputMode, selectedFood]);

  const livePreview = useMemo(() => {
    if (!selectedFood || !(effectiveGrams > 0)) return null;
    const ratio = effectiveGrams / 100;
    return {
      g: effectiveGrams,
      k: Math.round(selectedFood.k * ratio),
      p: round1(selectedFood.p * ratio),
      c: round1(selectedFood.c * ratio),
      f: round1(selectedFood.f * ratio),
      al: round1((selectedFood.a || 0) * ratio),
    };
  }, [selectedFood, effectiveGrams]);

  const parsedPct = parseNum(pctInput);
  const tempLivePreview = useMemo(() => {
    if (!selectedTempMeal || !(parsedPct > 0)) return null;
    const ratio = parsedPct / 100;
    return {
      g: round1(selectedTempMeal.totalG * ratio),
      k: Math.round(selectedTempMeal.totalK * ratio),
      p: round1(selectedTempMeal.totalP * ratio),
      c: round1(selectedTempMeal.totalC * ratio),
      f: round1(selectedTempMeal.totalF * ratio),
    };
  }, [selectedTempMeal, parsedPct]);

  const mealEntries = useMemo(
    () => entries.filter((x) => mealOf(x) === effectiveMeal),
    [entries, effectiveMeal]
  );

  const mealKcalMap = useMemo(() => {
    const map: Record<MealId, number> = { b: 0, l: 0, d: 0, o: 0 };
    for (const x of entries) {
      map[mealOf(x)] += x.k;
    }
    return map;
  }, [entries]);

  const handleSwitchUnitMode = (nextMode: 'g' | 'unit') => {
    if (nextMode === effectiveInputMode || !selectedFood?.u) return;
    const current = parseNum(gramsInput);
    if (current > 0) {
      const converted =
        nextMode === 'unit'
          ? round1(current / selectedFood.u)
          : round1(current * selectedFood.u);
      setGramsInput(String(converted));
    }
    setUnitMode(nextMode);
    setErrorMsg('');
  };

  const handleSubmit = () => {
    if (!selectedFood) {
      setErrorMsg(
        'Choisis un aliment dans la liste (ou crée-le avec « + Nouvel aliment »).'
      );
      return;
    }
    const amt = parseNum(gramsInput);
    if (!(amt > 0)) {
      setErrorMsg(
        effectiveInputMode === 'cl'
          ? 'Entre un volume en cL (ex : 25).'
          : effectiveInputMode === 'unit'
            ? 'Entre un nombre d’unités (ex : 2).'
            : 'Entre une quantité en grammes (ex : 100).'
      );
      gramsInputRef.current?.focus();
      return;
    }
    setErrorMsg('');
    if (effectiveInputMode === 'cl') {
      onAddEntry(selectedFood, round1(amt * 10), effectiveMeal, { cl: amt });
    } else if (effectiveInputMode === 'unit' && selectedFood.u) {
      onAddEntry(selectedFood, round1(amt * selectedFood.u), effectiveMeal, {
        units: amt,
      });
    } else {
      onAddEntry(selectedFood, amt, effectiveMeal);
    }
    setGramsInput('');
  };

  const handleGramsKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTempSubmit = () => {
    if (!selectedTempMeal) {
      setTempErrorMsg('Crée d’abord un plat temporaire ci-dessus.');
      return;
    }
    const pct = parseNum(pctInput);
    if (!(pct > 0)) {
      setTempErrorMsg('Entre un pourcentage supérieur à 0 (ex : 25, 100, 150).');
      pctInputRef.current?.focus();
      return;
    }
    setTempErrorMsg('');
    onAddTempMealPortion(selectedTempMeal, pct, effectiveMeal);
    setPctInput('');
  };

  const handlePctKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTempSubmit();
    }
  };

  const macroRows = [
    {
      label: 'Prot.',
      val: totals.p,
      target: goals.p,
      barClass: 'bg-[#DC2626] dark:bg-[#F87171]',
      dotClass: 'bg-[#DC2626] dark:bg-[#F87171]',
    },
    {
      label: 'Gluc.',
      val: totals.c,
      target: rc ? rc.c : 0,
      barClass: 'bg-[#2563EB] dark:bg-[#60A5FA]',
      dotClass: 'bg-[#2563EB] dark:bg-[#60A5FA]',
    },
    {
      label: 'Lip.',
      val: totals.f,
      target: rc ? rc.f : 0,
      barClass: 'bg-[#CA8A04] dark:bg-[#EAB308]',
      dotClass: 'bg-[#CA8A04] dark:bg-[#EAB308]',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Date Navigation Strip at top of Repas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-1.5 sm:flex-initial">
          <button
            type="button"
            onClick={() => onChangeDate(shiftDateKey(currentDate, -1))}
            aria-label="Jour précédent"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DCE5DF] bg-white text-[#3F5247] transition-colors hover:bg-[#F1F6F3] hover:text-[#14231C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:border-[#27362D] dark:bg-[#17231C] dark:text-[#A9BCB0] dark:hover:bg-[#1F2E25] dark:hover:text-[#EAF2ED] cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <label
            onClick={openDatePicker}
            className={`relative flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors sm:min-w-[210px] sm:flex-initial ${
              isToday
                ? 'border-[#DCE5DF] bg-white text-[#14231C] hover:bg-[#F1F6F3] dark:border-[#27362D] dark:bg-[#17231C] dark:text-[#EAF2ED] dark:hover:bg-[#1F2E25]'
                : 'border-[#A7DEC1] bg-[#ECF8F1] text-[#0B7B54] hover:bg-[#DDF3E6] dark:border-[#245A41] dark:bg-[#163627] dark:text-[#34D399]'
            }`}
          >
            <Calendar
              className="h-4 w-4 shrink-0 text-[#0D9464] dark:text-[#34D399]"
              aria-hidden="true"
            />
            <span className="truncate">{formatLongDayLabel(currentDate)}</span>
            <input
              ref={dateInputRef}
              type="date"
              max={today}
              value={currentDate}
              onChange={(e) => {
                const v = e.target.value;
                if (v && v <= today) {
                  onChangeDate(v);
                }
              }}
              aria-label="Choisir une date"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>

          <button
            type="button"
            disabled={isToday}
            onClick={() => onChangeDate(shiftDateKey(currentDate, 1))}
            aria-label="Jour suivant"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#DCE5DF] bg-white text-[#3F5247] transition-colors hover:bg-[#F1F6F3] hover:text-[#14231C] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:border-[#27362D] dark:bg-[#17231C] dark:text-[#A9BCB0] dark:hover:bg-[#1F2E25] dark:hover:text-[#EAF2ED] cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {!isToday && (
          <button
            type="button"
            onClick={() => onChangeDate(today)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#CBE4D6] bg-[#ECF8F1] px-3 py-1.5 text-xs font-semibold text-[#0B7B54] transition-colors hover:bg-[#DDF3E6] dark:border-[#214B39] dark:bg-[#153125] dark:text-[#34D399] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Aujourd’hui
          </button>
        )}
      </div>

      {/* Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Compact Daily Summary (Calories on left | 4 Macros on right) */}
        <section
          aria-label="Consommation du jour"
          className="rounded-2xl border border-[#E2EAE5] bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(16,40,28,0.04)] lg:col-span-5 dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none"
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:gap-5">
            {/* Left Side: Circular Calories Gauge */}
            <div className="flex items-center justify-center">
              <CalorieRing consumed={totals.k} goal={goals.k} />
            </div>

            {/* Right Side: Prot / Glucides / Lipides / Alcool */}
            <div className="min-w-0 space-y-2 border-l border-[#EDF2EE] pl-3.5 sm:pl-5 dark:border-[#233229]">
              {macroRows.map((m) => {
                const widthPct = m.target
                  ? Math.min(100, (m.val / m.target) * 100)
                  : 0;
                return (
                  <div key={m.label}>
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-[#32433A] dark:text-[#D1DFD6]">
                        <span
                          aria-hidden="true"
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${m.dotClass}`}
                        />
                        {m.label}
                      </span>
                      <span className="tabular-nums font-semibold text-[#14231C] dark:text-[#EAF2ED] whitespace-nowrap">
                        {formatDecimalFr(m.val)} g
                      </span>
                    </div>
                    {m.target > 0 && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#EAF0EC] dark:bg-[#233229]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ease-out ${m.barClass}`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Compact Alcohol Row */}
              <div className="pt-0.5 text-xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1.5 font-medium text-[#32433A] dark:text-[#D1DFD6]">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 shrink-0 rounded-full bg-[#7C3AED] dark:bg-[#A78BFA]"
                    />
                    Alcool
                  </span>
                  <span className="tabular-nums font-semibold text-[#14231C] dark:text-[#EAF2ED] whitespace-nowrap">
                    {formatDecimalFr(todayDoses)} d{' '}
                    <span className="font-normal text-[#5B6E64] dark:text-[#98ABA0]">
                      · {Math.round(totals.al * 7)} kcal
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 text-right text-[11px] tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                  7 j : {formatDecimalFr(weekDoses)} d ·{' '}
                  {Math.round(weekDoses * 70)} kcal
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Meal Tabs, Quick Add & Meal Log */}
        <div className="space-y-4 sm:space-y-5 lg:col-span-7">
          {/* Meal Segmented Control */}
          {visibleMeals.length >= 2 && (
            <div
              role="tablist"
              aria-label="Choisir un repas"
              className="grid gap-1 rounded-2xl border border-[#E2EAE5] bg-[#ECF2EE] p-1 dark:border-[#25332B] dark:bg-[#131D17]"
              style={{
                gridTemplateColumns: `repeat(${visibleMeals.length}, minmax(0, 1fr))`,
              }}
            >
              {visibleMeals.map((m) => {
                const Icon = MEAL_ICONS[m.id];
                const selected = m.id === effectiveMeal;
                const kcal = Math.round(mealKcalMap[m.id]);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => onSelectMeal(m.id)}
                    className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] ${
                      selected
                        ? 'bg-white text-[#14231C] shadow-xs dark:bg-[#1D2B23] dark:text-[#EAF2ED]'
                        : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          selected
                            ? 'text-[#0D9464] dark:text-[#34D399]'
                            : 'text-[#6B7E73] dark:text-[#86998E]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="hidden sm:inline text-xs font-semibold whitespace-nowrap">
                        {m.name}
                      </span>
                      <span className="sm:hidden text-xs font-semibold whitespace-nowrap">
                        {m.shortName}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium tabular-nums text-[#5E7066] dark:text-[#98ABA0]">
                      {kcal} kcal
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Add Food Card */}
          <section className="rounded-2xl border border-[#E2EAE5] bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
                Ajouter à « {effectiveMealMeta.name} »
              </h2>
              <button
                type="button"
                onClick={onOpenNewFood}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0D9464] transition-colors hover:bg-[#ECF8F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:text-[#34D399] dark:hover:bg-[#193528] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Nouvel aliment
              </button>
            </div>

            {/* Input Section: classic food (g) or temporary dish (%) */}
            {activeInputKind === 'temp' && selectedTempMeal ? (
              <>
                <div className="grid grid-cols-[1fr_96px] gap-2.5 sm:grid-cols-12 sm:gap-3 min-w-0">
                  <div className="min-w-0 sm:col-span-8">
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-[#52655B] dark:text-[#98ABA0]">
                      <label htmlFor="food-picker-trigger">Plat temporaire</label>
                      <span className="tabular-nums font-semibold text-[#0D9464] dark:text-[#34D399]">
                        {selectedTempMeal.totalK} kcal (100 %)
                      </span>
                    </div>
                    <button
                      id="food-picker-trigger"
                      type="button"
                      onClick={onOpenFoodPicker}
                      aria-haspopup="dialog"
                      className="flex min-h-[44px] w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 py-2 text-left text-sm transition-colors hover:border-[#0D9464] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:border-[#2C3C32] dark:bg-[#111A15] dark:hover:border-[#34D399] cursor-pointer"
                    >
                      <span className="truncate font-medium text-[#14231C] dark:text-[#EAF2ED]">
                        {selectedTempMeal.n}
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-[#687A70] dark:text-[#98ABA0]"
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="min-w-0 sm:col-span-4">
                    <label
                      htmlFor="temp-pct-input"
                      className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
                    >
                      Part (%)
                    </label>
                    <input
                      id="temp-pct-input"
                      ref={pctInputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder="25"
                      value={pctInput}
                      onChange={(e) => setPctInput(e.target.value)}
                      onKeyDown={handlePctKeyDown}
                      className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 py-2 text-sm font-medium tabular-nums text-[#14231C] placeholder:text-[#8A9B91] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:placeholder:text-[#6B7E73] dark:focus:border-[#34D399]"
                    />
                  </div>
                </div>

                {/* Quick % Buttons + Live Preview */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {QUICK_PERCENTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setPctInput(String(q));
                          setTempErrorMsg('');
                        }}
                        className={`min-h-[30px] rounded-lg border px-2.5 py-0.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                          pctInput === String(q)
                            ? 'border-[#0D9464] bg-[#ECF8F1] text-[#0B7B54] dark:border-[#34D399] dark:bg-[#18382A] dark:text-[#34D399]'
                            : 'border-[#DCE5DF] bg-[#F7FAF8] text-[#4C5F54] hover:bg-[#EDF3EF] dark:border-[#27362D] dark:bg-[#1B2821] dark:text-[#A9BCB0] dark:hover:bg-[#223229]'
                        }`}
                      >
                        {q} %
                      </button>
                    ))}
                  </div>

                  {tempLivePreview && (
                    <p className="text-xs font-medium tabular-nums text-[#52655B] dark:text-[#98ABA0]">
                      <strong className="text-[#14231C] dark:text-[#EAF2ED]">
                        {tempLivePreview.k} kcal
                      </strong>
                      {tempLivePreview.g > 0
                        ? ` (~${formatDecimalFr(tempLivePreview.g)} g)`
                        : ''}{' '}
                      · P {formatDecimalFr(tempLivePreview.p)} · G{' '}
                      {formatDecimalFr(tempLivePreview.c)} · L{' '}
                      {formatDecimalFr(tempLivePreview.f)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTempSubmit}
                  className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D9464] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0A7A52] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Ajouter au repas
                </button>

                {tempErrorMsg && (
                  <p
                    role="alert"
                    className="mt-2 text-xs font-medium text-[#C63B31] dark:text-[#FCA5A5]"
                  >
                    {tempErrorMsg}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_104px] gap-2.5 sm:grid-cols-12 sm:gap-3 min-w-0">
                  <div className="min-w-0 sm:col-span-8">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-[#52655B] dark:text-[#98ABA0]">
                      <label htmlFor="food-picker-trigger">Aliment</label>
                      {selectedFood && (
                        <span className="truncate tabular-nums font-semibold text-[#0D9464] dark:text-[#34D399]">
                          {effectiveInputMode === 'cl'
                            ? `${selectedFood.k} kcal / 100 ml`
                            : effectiveInputMode === 'unit' && selectedFood.u
                              ? `${Math.round((selectedFood.k * selectedFood.u) / 100)} kcal / unité (${formatDecimalFr(selectedFood.u)} g)`
                              : `${selectedFood.k} kcal / 100g`}
                        </span>
                      )}
                    </div>
                    <button
                      id="food-picker-trigger"
                      type="button"
                      onClick={onOpenFoodPicker}
                      aria-haspopup="dialog"
                      className="flex min-h-[44px] w-full min-w-0 items-center justify-between gap-1.5 rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 py-2 text-left text-sm transition-colors hover:border-[#0D9464] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:border-[#2C3C32] dark:bg-[#111A15] dark:hover:border-[#34D399] cursor-pointer"
                    >
                      <span
                        className={`truncate ${
                          selectedFood
                            ? 'font-medium text-[#14231C] dark:text-[#EAF2ED]'
                            : 'text-[#75887D] dark:text-[#7D9186]'
                        }`}
                      >
                        {selectedFood ? selectedFood.n : 'Choisir…'}
                      </span>
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-[#687A70] dark:text-[#98ABA0]"
                        aria-hidden="true"
                      />
                    </button>
                  </div>

                  <div className="min-w-0 sm:col-span-4">
                    <label
                      htmlFor="grams-input"
                      className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
                    >
                      {effectiveInputMode === 'cl'
                        ? 'Volume (cL)'
                        : effectiveInputMode === 'unit'
                          ? 'Unités'
                          : 'Grammes'}
                    </label>
                    <input
                      id="grams-input"
                      ref={gramsInputRef}
                      type="text"
                      inputMode="decimal"
                      placeholder={
                        effectiveInputMode === 'cl'
                          ? selectedFood?.b === 'wine'
                            ? '12'
                            : selectedFood?.b === 'spirit'
                              ? '4'
                              : '25'
                          : effectiveInputMode === 'unit'
                            ? '1'
                            : '100'
                      }
                      value={gramsInput}
                      onChange={(e) => setGramsInput(e.target.value)}
                      onKeyDown={handleGramsKeyDown}
                      className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 py-2 text-sm font-medium tabular-nums text-[#14231C] placeholder:text-[#8A9B91] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:placeholder:text-[#6B7E73] dark:focus:border-[#34D399]"
                    />
                  </div>
                </div>

                {/* Unit Mode Switcher (when solid food has average unit weight) */}
                {!selectedFood?.b && selectedFood?.u && selectedFood.u > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div
                      role="group"
                      aria-label="Mode de saisie"
                      className="inline-flex rounded-xl border border-[#DCE5DF] bg-[#ECF2EE] p-0.5 dark:border-[#25332B] dark:bg-[#131D17]"
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchUnitMode('unit')}
                        className={`min-h-[30px] rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                          effectiveInputMode === 'unit'
                            ? 'bg-white text-[#0B7B54] shadow-xs dark:bg-[#1D2B23] dark:text-[#34D399]'
                            : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
                        }`}
                      >
                        Unités ({formatDecimalFr(selectedFood.u)} g)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchUnitMode('g')}
                        className={`min-h-[30px] rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                          effectiveInputMode === 'g'
                            ? 'bg-white text-[#0B7B54] shadow-xs dark:bg-[#1D2B23] dark:text-[#34D399]'
                            : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
                        }`}
                      >
                        Grammes
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Portion Buttons + Live Preview */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {effectiveInputMode === 'cl' && selectedFood?.b
                      ? DRINK_QUICK_PRESETS[selectedFood.b].map((preset) => (
                          <button
                            key={preset.cl}
                            type="button"
                            onClick={() => {
                              setGramsInput(String(preset.cl));
                              setErrorMsg('');
                            }}
                            className={`min-h-[30px] rounded-lg border px-2.5 py-0.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                              gramsInput === String(preset.cl)
                                ? 'border-[#0D9464] bg-[#ECF8F1] text-[#0B7B54] dark:border-[#34D399] dark:bg-[#18382A] dark:text-[#34D399]'
                                : 'border-[#DCE5DF] bg-[#F7FAF8] text-[#4C5F54] hover:bg-[#EDF3EF] dark:border-[#27362D] dark:bg-[#1B2821] dark:text-[#A9BCB0] dark:hover:bg-[#223229]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))
                      : (effectiveInputMode === 'unit' ? QUICK_UNITS : QUICK_GRAMS).map(
                          (q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => {
                                setGramsInput(String(q));
                                setErrorMsg('');
                              }}
                              className={`min-h-[30px] rounded-lg border px-2.5 py-0.5 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                                gramsInput === String(q)
                                  ? 'border-[#0D9464] bg-[#ECF8F1] text-[#0B7B54] dark:border-[#34D399] dark:bg-[#18382A] dark:text-[#34D399]'
                                  : 'border-[#DCE5DF] bg-[#F7FAF8] text-[#4C5F54] hover:bg-[#EDF3EF] dark:border-[#27362D] dark:bg-[#1B2821] dark:text-[#A9BCB0] dark:hover:bg-[#223229]'
                              }`}
                            >
                              {effectiveInputMode === 'unit' ? `${q} u` : `${q} g`}
                            </button>
                          )
                        )}
                  </div>

                  {livePreview && (
                    <p className="text-xs font-medium tabular-nums text-[#52655B] dark:text-[#98ABA0]">
                      <strong className="text-[#14231C] dark:text-[#EAF2ED]">
                        {livePreview.k} kcal
                      </strong>
                      {effectiveInputMode === 'unit'
                        ? ` (${formatDecimalFr(livePreview.g)} g)`
                        : ''}{' '}
                      · P {formatDecimalFr(livePreview.p)} · G{' '}
                      {formatDecimalFr(livePreview.c)} · L{' '}
                      {formatDecimalFr(livePreview.f)}
                      {livePreview.al > 0
                        ? ` · Alc ${formatDecimalFr(livePreview.al / 10)} d`
                        : ''}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="mt-3.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D9464] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0A7A52] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Ajouter au repas
                </button>

                {errorMsg && (
                  <p
                    role="alert"
                    className="mt-2 text-xs font-medium text-[#C63B31] dark:text-[#FCA5A5]"
                  >
                    {errorMsg}
                  </p>
                )}
              </>
            )}
          </section>

          {/* Current Meal Log List */}
          <section className="rounded-2xl border border-[#E2EAE5] bg-white p-4 sm:p-5 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
                {effectiveMealMeta.name}
              </h2>
              <span className="text-xs sm:text-sm font-semibold tabular-nums text-[#52655B] dark:text-[#98ABA0]">
                {Math.round(mealKcalMap[effectiveMeal])} kcal
              </span>
            </div>

            {mealEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#DCE5DF] bg-[#FAFDFB] px-4 py-5 text-center dark:border-[#28372E] dark:bg-[#121B16]">
                <p className="text-xs sm:text-sm text-[#5B6E64] dark:text-[#98ABA0]">
                  Rien pour l’instant. Choisis un aliment et une quantité ci-dessus.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#EDF2EE] dark:divide-[#233229]">
                {mealEntries.map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => onOpenEntry(x)}
                      aria-haspopup="dialog"
                      className="flex min-h-[54px] w-full items-center justify-between gap-3 rounded-xl px-1.5 py-2.5 text-left transition-colors hover:bg-[#F5F9F6] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0D9464] dark:hover:bg-[#1C2A22] cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                          {x.n}
                        </span>
                        <span className="mt-0.5 block text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                          {x.pct && x.pct > 0
                            ? `${formatDecimalFr(x.pct)} % du plat${
                                x.g > 0 ? ` (${formatDecimalFr(x.g)} g)` : ''
                              }`
                            : x.cl && x.cl > 0
                              ? `${formatDecimalFr(x.cl)} cL`
                              : x.u && x.u > 0
                                ? `${formatDecimalFr(x.u)} ${
                                    x.u < 2 ? 'unité' : 'unités'
                                  } (${formatDecimalFr(x.g)} g)`
                                : `${formatDecimalFr(x.g)} g`}{' '}
                          · Prot. {formatDecimalFr(x.p)} · Glu.{' '}
                          {formatDecimalFr(x.c)} · Lip. {formatDecimalFr(x.f)}
                          {x.al
                            ? ` · Alc ${formatDecimalFr(x.al / 10)} d (${Math.round(
                                x.al * 7
                              )} kcal)`
                            : ''}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED]">
                        {Math.round(x.k)} kcal
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
