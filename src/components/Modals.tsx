import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import type {
  DrinkCategory,
  Food,
  LogEntry,
  MealId,
  TempMeal,
} from '../types/nutrition';
import {
  MEALS,
  capitalizeFoodName,
  dayTotals,
  formatDayLabel,
  formatDecimalFr,
  mealOf,
  normText,
  parseNum,
  round1,
} from '../utils/nutrition';
import {
  type OpenFoodFactsProduct,
  searchCiqualFoods,
  searchOpenFoodFacts,
} from '../utils/openFoodFacts';
import { TempMealBuilder } from './TempMealModal';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

/* 1. Searchable Food Picker Modal */
interface FoodPickerModalProps {
  open: boolean;
  foods: Food[];
  tempMeals?: TempMeal[];
  onClose: () => void;
  onSelect: (foodId: string) => void;
  onSelectTempMeal?: (tempMealId: string) => void;
}

export function FoodPickerModal({
  open,
  foods,
  tempMeals = [],
  onClose,
  onSelect,
  onSelectTempMeal,
}: FoodPickerModalProps) {
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useModalBackHandler(open, onClose);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlightIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const filteredTempMeals = useMemo(() => {
    const q = normText(query.trim());
    return tempMeals.filter((t) => !q || normText(t.n).includes(q));
  }, [tempMeals, query]);

  const filtered = useMemo(() => {
    const q = normText(query.trim());
    return [...foods]
      .sort((a, b) => a.n.localeCompare(b.n, 'fr'))
      .filter((f) => !q || normText(f.n).includes(q));
  }, [foods, query]);

  const totalCount = filteredTempMeals.length + filtered.length;

  if (!open) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!totalCount) return;
      setHighlightIdx(
        (prev) =>
          (prev + (e.key === 'ArrowDown' ? 1 : -1) + totalCount) % totalCount
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = highlightIdx > -1 ? highlightIdx : 0;
      if (idx < filteredTempMeals.length) {
        const tm = filteredTempMeals[idx];
        if (tm && onSelectTempMeal) onSelectTempMeal(tm.id);
      } else {
        const target = filtered[idx - filteredTempMeals.length];
        if (target) onSelect(target.id);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12 backdrop-blur-xs sm:pt-20"
      role="dialog"
      aria-modal="true"
      aria-label="Choisir un aliment"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E2EAE5] bg-white shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <div className="flex items-center gap-2 border-b border-[#EDF2EE] p-3 dark:border-[#233229]">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIdx(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher un aliment…"
              className="min-h-[42px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] pl-9 pr-3 text-sm text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl border border-[#DCE5DF] px-3.5 text-xs font-semibold text-[#3C5045] transition-colors hover:bg-[#F1F6F3] dark:border-[#2C3C32] dark:text-[#B9CBC0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            Fermer
          </button>
        </div>

        <ul className="max-h-[340px] divide-y divide-[#EDF2EE] overflow-y-auto p-1.5 dark:divide-[#233229]">
          {totalCount === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#5B6E64] dark:text-[#98ABA0]">
              Aucun résultat
            </li>
          ) : (
            <>
              {filteredTempMeals.length > 0 && (
                <li className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0B7B54] dark:text-[#34D399]">
                  Plats temporaires
                </li>
              )}
              {filteredTempMeals.map((tm, idx) => (
                <li key={`tm-${tm.id}`}>
                  <button
                    type="button"
                    onClick={() => onSelectTempMeal?.(tm.id)}
                    className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                      idx === highlightIdx
                        ? 'bg-[#ECF8F1] dark:bg-[#18382A]'
                        : 'bg-[#F7FCF9] hover:bg-[#ECF8F1] dark:bg-[#13241C] dark:hover:bg-[#18382A]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                          {tm.n}
                        </span>
                        <span className="shrink-0 rounded bg-[#ECF8F1] px-1.5 py-0.5 text-[10px] font-semibold text-[#0B7B54] dark:bg-[#18382A] dark:text-[#34D399]">
                          % du plat
                        </span>
                      </div>
                      <span className="block text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                        Plat entier · Prot. {formatDecimalFr(tm.totalP)} · Glu.{' '}
                        {formatDecimalFr(tm.totalC)} · Lip.{' '}
                        {formatDecimalFr(tm.totalF)}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[#0D9464] dark:text-[#34D399]">
                      {tm.totalK} kcal
                    </span>
                  </button>
                </li>
              ))}

              {filteredTempMeals.length > 0 && filtered.length > 0 && (
                <li className="px-2.5 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-[#5B6E64] dark:text-[#98ABA0]">
                  Aliments classiques (100 g)
                </li>
              )}

              {filtered.map((f, idx) => {
                const overallIdx = filteredTempMeals.length + idx;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(f.id)}
                      className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                        overallIdx === highlightIdx
                          ? 'bg-[#ECF8F1] dark:bg-[#18382A]'
                          : 'hover:bg-[#F5F9F6] dark:hover:bg-[#1C2A22]'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                          {f.n}
                        </span>
                        <span className="block text-[11px] sm:text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                          Prot. {f.p} · Glu. {f.c} · Lip. {f.f}
                          {f.b
                            ? ' · en cL'
                            : f.u
                              ? ` · 1 u = ${formatDecimalFr(f.u)} g`
                              : ''}
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-[#0D9464] dark:text-[#34D399]">
                        {f.k} kcal
                      </span>
                    </button>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

/* 2. Create / Edit Food Modal (with Aliment temporaire tab) */
interface FoodFormModalProps {
  open: boolean;
  editingFood: Food | null;
  editingTempMeal?: TempMeal | null;
  initialFormTab?: 'food' | 'temp';
  foods?: Food[];
  helperNotice?: string;
  autoFocusOff?: boolean;
  onClose: () => void;
  onSave: (data: Omit<Food, 'id'>, existingId?: string) => void;
  onSaveTempMeal?: (
    dish: Omit<TempMeal, 'id' | 'createdAt'>,
    existingId?: string
  ) => void;
}

export function FoodFormModal({
  open,
  editingFood,
  editingTempMeal = null,
  initialFormTab = 'food',
  foods = [],
  helperNotice,
  autoFocusOff,
  onClose,
  onSave,
  onSaveTempMeal,
}: FoodFormModalProps) {
  const [formTab, setFormTab] = useState<'food' | 'temp'>('food');
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [alc, setAlc] = useState('');
  const [unitGrams, setUnitGrams] = useState('');
  const [drinkCat, setDrinkCat] = useState<DrinkCategory | ''>('');
  const [error, setError] = useState('');

  // Open Food Facts search state
  const [offQuery, setOffQuery] = useState('');
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState('');
  const [offResults, setOffResults] = useState<OpenFoodFactsProduct[]>([]);
  const [offInfo, setOffInfo] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);
  const offRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useModalBackHandler(open, onClose);

  useEffect(() => {
    if (open) {
      const nextTab = editingTempMeal
        ? 'temp'
        : editingFood
          ? 'food'
          : initialFormTab;
      setFormTab(nextTab);
      setName(editingFood?.n ?? '');
      setKcal(editingFood ? String(editingFood.k) : '');
      setProt(editingFood && editingFood.p ? String(editingFood.p) : '');
      setCarbs(editingFood && editingFood.c ? String(editingFood.c) : '');
      setFat(editingFood && editingFood.f ? String(editingFood.f) : '');
      setAlc(editingFood && editingFood.a ? String(editingFood.a) : '');
      setUnitGrams(editingFood && editingFood.u ? String(editingFood.u) : '');
      setDrinkCat(editingFood?.b ?? '');
      setError('');
      setOffQuery(editingFood?.n ?? '');
      setOffLoading(false);
      setOffError('');
      setOffResults([]);
      setOffInfo('');
      if (nextTab === 'food') {
        setTimeout(() => {
          if (autoFocusOff) {
            offRef.current?.focus();
          } else {
            nameRef.current?.focus();
          }
        }, 20);
      }
    } else {
      abortRef.current?.abort();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [open, editingFood, editingTempMeal, initialFormTab, autoFocusOff]);

  if (!open) return null;

  const canSwitchToTemp =
    !editingFood && !editingTempMeal && !helperNotice && Boolean(onSaveTempMeal);

  const parseOptional = (v: string) => (v.trim() === '' ? 0 : parseNum(v));

  const handleLiveCiqualSearch = async (rawValue: string) => {
    setOffQuery(rawValue);
    setOffError('');
    setOffInfo('');
    const trimmed = rawValue.trim();
    if (trimmed.length < 2 || /^\d+$/.test(trimmed)) {
      setOffResults([]);
      return;
    }
    const matches = await searchCiqualFoods(trimmed);
    setOffResults(matches);
  };

  const handleSearchOff = async () => {
    const q = offQuery.trim();
    if (!q) {
      setOffError('Entre un nom d’aliment ou un code-barres.');
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setOffLoading(true);
    setOffError('');
    setOffInfo('');
    try {
      const results = await searchOpenFoodFacts(q, ctrl.signal);
      setOffResults(results);
      if (results.length === 0) {
        setOffError('Aucun aliment trouvé dans Ciqual ni sur Open Food Facts.');
      }
    } catch (err) {
      if (err instanceof Error) {
        setOffError(err.message);
      } else {
        setOffError('Erreur lors de la recherche en ligne.');
      }
      setOffResults([]);
    } finally {
      setOffLoading(false);
    }
  };

  const handleApplyOffProduct = (item: OpenFoodFactsProduct) => {
    const isCiqual = item.source === 'ciqual';
    const displayName =
      !isCiqual &&
      item.brand &&
      !normText(item.name).includes(normText(item.brand))
        ? `${item.name} (${item.brand})`
        : item.name;
    setName(capitalizeFoodName(displayName));
    setKcal(String(item.k));
    setProt(item.p ? String(item.p) : '0');
    setCarbs(item.c ? String(item.c) : '0');
    setFat(item.f ? String(item.f) : '0');
    setAlc(item.a ? String(item.a) : '');
    setError('');
    setOffResults([]);
    setOffError('');
    setOffInfo(
      isCiqual
        ? 'Valeurs importées depuis la table Ciqual (ANSES) — vérifie et enregistre.'
        : 'Valeurs importées depuis Open Food Facts — vérifie et enregistre.'
    );
  };

  const handleSave = () => {
    const n = capitalizeFoodName(name);
    const k = parseNum(kcal);
    const p = parseOptional(prot);
    const c = parseOptional(carbs);
    const f = parseOptional(fat);
    const a = parseOptional(alc);
    const u = drinkCat ? 0 : parseOptional(unitGrams);

    if (!n || [k, p, c, f, a, u].some(Number.isNaN)) {
      setError('Renseigne au moins le nom et les kcal pour 100 g.');
      return;
    }
    onSave(
      {
        n,
        k,
        p,
        c,
        f,
        a,
        ...(drinkCat ? { b: drinkCat } : u > 0 ? { u: round1(u) } : {}),
      },
      editingFood?.id
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <div className="flex items-center justify-between gap-2">
          <h3
            id="food-form-title"
            className="text-lg font-bold text-[#14231C] dark:text-[#EAF2ED]"
          >
            {editingFood
              ? 'Modifier l’aliment'
              : editingTempMeal
                ? 'Modifier le plat temporaire'
                : formTab === 'temp'
                  ? 'Aliment temporaire'
                  : 'Nouvel aliment'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5B6E64] hover:bg-[#F1F6F3] dark:text-[#98ABA0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {canSwitchToTemp && (
          <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-[#EEF3F0] p-1 dark:bg-[#111A15]">
            <button
              type="button"
              onClick={() => setFormTab('food')}
              className={`min-h-[36px] rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                formTab === 'food'
                  ? 'bg-white text-[#14231C] shadow-xs dark:bg-[#1C2A22] dark:text-[#EAF2ED]'
                  : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
              }`}
            >
              Aliment (100 g)
            </button>
            <button
              type="button"
              onClick={() => setFormTab('temp')}
              className={`min-h-[36px] rounded-lg px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                formTab === 'temp'
                  ? 'bg-white text-[#14231C] shadow-xs dark:bg-[#1C2A22] dark:text-[#EAF2ED]'
                  : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
              }`}
            >
              Aliment temporaire
            </button>
          </div>
        )}

        {formTab === 'temp' && onSaveTempMeal ? (
          <TempMealBuilder
            editingMeal={editingTempMeal ?? null}
            foods={foods}
            onCancel={onClose}
            onSave={onSaveTempMeal}
          />
        ) : (
          <>
            <p className="mt-2 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
              Valeurs pour 100 g (ou 100 ml). Seuls le nom et les kcal sont
              obligatoires.
            </p>
            {helperNotice && (
              <p className="mt-1.5 rounded-lg bg-[#ECF8F1] px-2.5 py-1.5 text-xs font-medium text-[#0B7B54] dark:bg-[#163627] dark:text-[#34D399]">
                {helperNotice}
              </p>
            )}

            {/* Ciqual ANSES + Barcode Lookup */}
            <div className="mt-3.5 rounded-xl border border-[#DCE5DF] bg-[#F7FAF8] p-3 dark:border-[#25332B] dark:bg-[#121B16]">
          <label
            htmlFor="off-search-input"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#14231C] dark:text-[#EAF2ED]"
          >
            <Globe
              className="h-3.5 w-3.5 text-[#0D9464] dark:text-[#34D399]"
              aria-hidden="true"
            />
            Base Ciqual (ANSES) &amp; code-barres
          </label>
          <div className="flex gap-1.5">
            <input
              id="off-search-input"
              ref={offRef}
              type="text"
              value={offQuery}
              onChange={(e) => void handleLiveCiqualSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearchOff();
                }
              }}
              placeholder="Ex : morue, yaourt grec, ou code-barres…"
              className="min-h-[38px] flex-1 rounded-lg border border-[#D4DFD8] bg-white px-2.5 text-xs text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
            />
            <button
              type="button"
              disabled={offLoading}
              onClick={() => void handleSearchOff()}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-[#0D9464] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0A7A52] disabled:opacity-60 dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer shrink-0"
            >
              {offLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>Chercher</span>
            </button>
          </div>

          {offError && (
            <p className="mt-2 text-[11px] font-medium text-[#C63B31] dark:text-[#FCA5A5]">
              {offError}
            </p>
          )}
          {offInfo && (
            <p className="mt-2 text-[11px] font-medium text-[#0B7B54] dark:text-[#34D399]">
              {offInfo}
            </p>
          )}

          {offResults.length > 0 && (
            <ul className="mt-2 max-h-44 divide-y divide-[#E3ECE6] overflow-y-auto rounded-lg border border-[#DCE5DF] bg-white dark:divide-[#233229] dark:border-[#27362D] dark:bg-[#16211B]">
              {offResults.map((item) => (
                <li key={item.code}>
                  <button
                    type="button"
                    onClick={() => handleApplyOffProduct(item)}
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-[#ECF8F1] dark:hover:bg-[#193528] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                        {item.name}
                        {item.brand ? ` · ${item.brand}` : ''}
                      </span>
                      <span className="block text-[11px] tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                        Prot. {item.p} · Glu. {item.c} · Lip. {item.f}
                        {item.a ? ` · Alc ${item.a}` : ''}
                        {item.quantity ? ` · ${item.quantity}` : ''}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-[#0D9464] dark:text-[#34D399]">
                      {item.k} kcal
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="fn-input"
              className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
            >
              Nom
            </label>
            <input
              id="fn-input"
              ref={nameRef}
              type="text"
              placeholder="Ex : Lentilles cuites"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 text-sm text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
            />
          </div>

          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'fk', label: 'kcal', val: kcal, set: setKcal },
              { id: 'fp', label: 'Prot.', val: prot, set: setProt },
              { id: 'fc', label: 'Glu.', val: carbs, set: setCarbs },
              { id: 'ff', label: 'Lip.', val: fat, set: setFat },
              { id: 'fa', label: 'Alc.', val: alc, set: setAlc },
            ].map((field) => (
              <div key={field.id}>
                <label
                  htmlFor={field.id}
                  className="mb-1 block text-[11px] font-medium text-[#52655B] dark:text-[#98ABA0]"
                >
                  {field.label}
                </label>
                <input
                  id={field.id}
                  type="text"
                  inputMode="decimal"
                  value={field.val}
                  onChange={(e) => field.set(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  className="min-h-[42px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-2 text-center text-sm tabular-nums text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="fb-select"
                className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Boisson (saisie en cL)
              </label>
              <select
                id="fb-select"
                value={drinkCat}
                onChange={(e) => setDrinkCat(e.target.value as DrinkCategory | '')}
                className="min-h-[42px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 text-sm text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              >
                <option value="">Non (aliment solide)</option>
                <option value="beer">Bière / Cidre (0,25 L – 1 L)</option>
                <option value="wine">Vin / Champagne (12 – 50 cL)</option>
                <option value="soda">Soda / Jus (25 – 33 cL)</option>
                <option value="spirit">Spiritueux / Sirop (2 – 10 cL)</option>
                <option value="other">Autre boisson (lait, café, thé…)</option>
              </select>
            </div>

            {!drinkCat && (
              <div>
                <label
                  htmlFor="fu-input"
                  className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
                >
                  Poids d’une unité (g) — facultatif
                </label>
                <input
                  id="fu-input"
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex : 60 (œuf), 35 (sushi)…"
                  value={unitGrams}
                  onChange={(e) => setUnitGrams(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  className="min-h-[42px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 text-sm tabular-nums text-[#14231C] placeholder:text-[#8A9B91] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:placeholder:text-[#6B7E73] dark:focus:border-[#34D399]"
                />
              </div>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-[#C63B31]">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] flex-1 rounded-xl bg-[#0D9464] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-xl border border-[#DCE5DF] px-4 text-sm font-semibold text-[#3C5045] transition-colors hover:bg-[#F1F6F3] dark:border-[#2C3C32] dark:text-[#B9CBC0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            Annuler
          </button>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

/* 3. Food Detail Action Modal */
interface FoodActionModalProps {
  food: Food | null;
  onClose: () => void;
  onEdit: (food: Food) => void;
  onDelete: (foodId: string) => void;
}

export function FoodActionModal({
  food,
  onClose,
  onEdit,
  onDelete,
}: FoodActionModalProps) {
  useModalBackHandler(Boolean(food), onClose);

  if (!food) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="food-action-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <h3
          id="food-action-title"
          className="text-lg font-bold text-[#14231C] dark:text-[#EAF2ED]"
        >
          {food.n}
        </h3>
        <p className="mt-1 text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
          {food.k} kcal pour {food.b ? '100 ml (10 cL)' : '100 g'} · Prot.{' '}
          {food.p} · Glu. {food.c} · Lip. {food.f}
          {food.a ? ` · Alc ${food.a}` : ''}
          {food.b
            ? ' · Saisie en cL'
            : food.u
              ? ` · 1 unité ≈ ${formatDecimalFr(food.u)} g (${Math.round(
                  (food.k * food.u) / 100
                )} kcal)`
              : ''}
        </p>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => onEdit(food)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0D9464] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Modifier
          </button>
          <button
            type="button"
            onClick={() => onDelete(food.id)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#F5CECB] bg-[#FEF5F4] px-4 text-sm font-semibold text-[#C63B31] transition-colors hover:bg-[#FCE8E6] dark:border-[#4B2220] dark:bg-[#2A1514] dark:text-[#FCA5A5] dark:hover:bg-[#381B1A] cursor-pointer"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Supprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl text-sm font-medium text-[#5B6E64] transition-colors hover:bg-[#F1F6F3] dark:text-[#98ABA0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* 3b. Temporary Dish Detail Action Modal */
interface TempMealActionModalProps {
  dish: TempMeal | null;
  onClose: () => void;
  onUseInMeals: (dish: TempMeal) => void;
  onEdit: (dish: TempMeal) => void;
  onDelete: (id: string) => void;
}

export function TempMealActionModal({
  dish,
  onClose,
  onUseInMeals,
  onEdit,
  onDelete,
}: TempMealActionModalProps) {
  useModalBackHandler(Boolean(dish), onClose);

  if (!dish) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="temp-action-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <h3
          id="temp-action-title"
          className="text-lg font-bold text-[#14231C] dark:text-[#EAF2ED]"
        >
          {dish.n}
        </h3>
        <p className="mt-1 text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
          Plat entier : {dish.totalK} kcal
          {dish.totalG > 0 ? ` (${formatDecimalFr(dish.totalG)} g)` : ''} ·
          Prot. {formatDecimalFr(dish.totalP)} · Glu.{' '}
          {formatDecimalFr(dish.totalC)} · Lip. {formatDecimalFr(dish.totalF)}
        </p>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => onUseInMeals(dish)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0D9464] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            Doser une part dans Repas (%)
          </button>
          <button
            type="button"
            onClick={() => onEdit(dish)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE5DF] bg-[#F7FAF8] px-4 text-sm font-semibold text-[#14231C] transition-colors hover:bg-[#EDF3EF] dark:border-[#2C3C32] dark:bg-[#1B2821] dark:text-[#EAF2ED] dark:hover:bg-[#223229] cursor-pointer"
          >
            <Pencil
              className="h-4 w-4 text-[#0D9464] dark:text-[#34D399]"
              aria-hidden="true"
            />
            Modifier le plat
          </button>
          <button
            type="button"
            onClick={() => onDelete(dish.id)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#F5CECB] bg-[#FEF5F4] px-4 text-sm font-semibold text-[#C63B31] transition-colors hover:bg-[#FCE8E6] dark:border-[#4B2220] dark:bg-[#2A1514] dark:text-[#FCA5A5] dark:hover:bg-[#381B1A] cursor-pointer"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Supprimer
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] rounded-xl text-sm font-medium text-[#5B6E64] transition-colors hover:bg-[#F1F6F3] dark:text-[#98ABA0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

/* 4. Entry Edit / Remove Modal */
interface EntryEditModalProps {
  entry: LogEntry | null;
  foods?: Food[];
  onClose: () => void;
  onUpdate: (
    entryId: string,
    newAmount: number,
    newMeal: MealId,
    options?: { units?: number; cl?: number }
  ) => void;
  onEditFood: (entry: LogEntry, currentGrams: number, currentMeal: MealId) => void;
  onDelete: (entryId: string) => void;
}

export function EntryEditModal({
  entry,
  foods = [],
  onClose,
  onUpdate,
  onEditFood,
  onDelete,
}: EntryEditModalProps) {
  const [gramsStr, setGramsStr] = useState('');
  const [editMode, setEditMode] = useState<'g' | 'unit'>('g');
  const [meal, setMeal] = useState<MealId>('o');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useModalBackHandler(Boolean(entry), onClose);

  const matchedFood = useMemo(() => {
    if (!entry) return null;
    return (
      (entry.foodId && foods.find((f) => f.id === entry.foodId)) ||
      foods.find((f) => normText(f.n) === normText(entry.n)) ||
      null
    );
  }, [entry, foods]);

  const unitWeight = useMemo(() => {
    if (!entry || (entry.cl && entry.cl > 0)) return 0;
    if (entry.u && entry.u > 0 && entry.g > 0) {
      return round1(entry.g / entry.u);
    }
    if (matchedFood?.u && matchedFood.u > 0) {
      return matchedFood.u;
    }
    return 0;
  }, [entry, matchedFood]);

  useEffect(() => {
    if (entry) {
      const isPct = Boolean(entry.pct && entry.pct > 0);
      const isCl = Boolean(!isPct && entry.cl && entry.cl > 0);
      const hasUnits = Boolean(!isPct && !isCl && entry.u && entry.u > 0);
      setEditMode(hasUnits ? 'unit' : 'g');
      setGramsStr(
        String(
          round1(
            isPct
              ? entry.pct!
              : isCl
                ? entry.cl!
                : hasUnits
                  ? entry.u!
                  : entry.g
          )
        )
      );
      setMeal(mealOf(entry));
      setError('');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [entry]);

  if (!entry) return null;

  const isPctEntry = Boolean(entry.pct && entry.pct > 0);
  const isClEntry = Boolean(!isPctEntry && entry.cl && entry.cl > 0);
  const effectiveMode: 'g' | 'unit' | 'cl' = isClEntry
    ? 'cl'
    : !isPctEntry && editMode === 'unit' && unitWeight > 0
      ? 'unit'
      : 'g';

  const parsed = parseNum(gramsStr);
  const candidateGrams =
    effectiveMode === 'cl' && parsed > 0
      ? round1(parsed * 10)
      : effectiveMode === 'unit' && parsed > 0
        ? round1(parsed * unitWeight)
        : parsed;
  const baseAmount = isPctEntry ? entry.pct! : entry.g;
  const ratio = isPctEntry
    ? parsed > 0 && baseAmount > 0
      ? parsed / baseAmount
      : 0
    : candidateGrams > 0 && entry.g > 0
      ? candidateGrams / entry.g
      : 0;

  const handleToggleMode = (nextMode: 'g' | 'unit') => {
    if (nextMode === effectiveMode || !(unitWeight > 0)) return;
    if (parsed > 0) {
      const converted =
        nextMode === 'unit'
          ? round1(parsed / unitWeight)
          : round1(parsed * unitWeight);
      setGramsStr(String(converted));
    }
    setEditMode(nextMode);
    setError('');
  };

  const handleValidate = () => {
    if (!(parsed > 0)) {
      setError(
        isPctEntry
          ? 'Entre une part en pourcentage (ex : 25).'
          : effectiveMode === 'cl'
            ? 'Entre un volume en cL (ex : 25).'
            : effectiveMode === 'unit'
              ? 'Entre un nombre d’unités (ex : 2).'
              : 'Entre une quantité en grammes (ex : 100).'
      );
      return;
    }
    if (isPctEntry && parsed > 100) {
      setError('Le pourcentage doit être compris entre 1 et 100.');
      return;
    }
    if (isPctEntry) {
      onUpdate(entry.id, parsed, meal);
    } else if (effectiveMode === 'cl') {
      onUpdate(entry.id, round1(parsed * 10), meal, { cl: round1(parsed) });
    } else if (effectiveMode === 'unit' && unitWeight > 0) {
      onUpdate(entry.id, round1(parsed * unitWeight), meal, {
        units: round1(parsed),
      });
    } else {
      onUpdate(entry.id, round1(parsed), meal, { units: 0 });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-edit-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3
              id="entry-edit-title"
              className="text-lg font-bold text-[#14231C] dark:text-[#EAF2ED]"
            >
              {entry.n}
            </h3>
            <p className="mt-0.5 text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
              {isPctEntry
                ? `${formatDecimalFr(parsed > 0 ? parsed : entry.pct!)} % du plat · ${Math.round(
                    entry.k * (ratio > 0 ? ratio : 1)
                  )} kcal`
                : effectiveMode === 'cl'
                  ? `${formatDecimalFr(parsed > 0 ? parsed : entry.cl!)} cL · ${Math.round(
                      entry.k * (ratio > 0 ? ratio : 1)
                    )} kcal`
                  : effectiveMode === 'unit' && unitWeight > 0
                    ? `${formatDecimalFr(
                        parsed > 0 ? parsed : entry.u || entry.g / unitWeight
                      )} ${
                        (parsed > 0 ? parsed : entry.u || entry.g / unitWeight) < 2
                          ? 'unité'
                          : 'unités'
                      } (${formatDecimalFr(
                        candidateGrams > 0 ? candidateGrams : entry.g
                      )} g) · ${Math.round(
                        entry.k * (ratio > 0 ? ratio : 1)
                      )} kcal`
                    : ratio > 0
                      ? `${formatDecimalFr(parsed)} g · ${Math.round(
                          entry.k * ratio
                        )} kcal`
                      : `${formatDecimalFr(entry.g)} g · ${Math.round(
                          entry.k
                        )} kcal`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5B6E64] hover:bg-[#F1F6F3] dark:text-[#98ABA0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {!isPctEntry && !isClEntry && unitWeight > 0 && (
            <div
              role="group"
              aria-label="Mode d’édition"
              className="grid grid-cols-2 gap-1 rounded-xl bg-[#ECF2EE] p-1 dark:bg-[#111A15]"
            >
              <button
                type="button"
                onClick={() => handleToggleMode('unit')}
                className={`min-h-[34px] rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer ${
                  effectiveMode === 'unit'
                    ? 'bg-white text-[#0B7B54] shadow-xs dark:bg-[#1D2B23] dark:text-[#34D399]'
                    : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0]'
                }`}
              >
                Unités ({formatDecimalFr(unitWeight)} g)
              </button>
              <button
                type="button"
                onClick={() => handleToggleMode('g')}
                className={`min-h-[34px] rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer ${
                  effectiveMode === 'g'
                    ? 'bg-white text-[#0B7B54] shadow-xs dark:bg-[#1D2B23] dark:text-[#34D399]'
                    : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0]'
                }`}
              >
                Grammes
              </button>
            </div>
          )}

          <div>
            <label
              htmlFor="edit-entry-grams"
              className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
            >
              {isPctEntry
                ? 'Part du plat (%)'
                : effectiveMode === 'cl'
                  ? 'Volume (cL)'
                  : effectiveMode === 'unit'
                    ? 'Quantité (unités)'
                    : 'Quantité (g)'}
            </label>
            <input
              id="edit-entry-grams"
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={gramsStr}
              onChange={(e) => setGramsStr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleValidate();
              }}
              className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 text-sm font-medium tabular-nums text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
            />
          </div>

          <div>
            <label
              htmlFor="edit-entry-meal"
              className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
            >
              Repas
            </label>
            <select
              id="edit-entry-meal"
              value={meal}
              onChange={(e) => setMeal(e.target.value as MealId)}
              className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 text-sm text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
            >
              {MEALS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-[#C63B31]">
            {error}
          </p>
        )}

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={handleValidate}
            className="min-h-[44px] rounded-xl bg-[#0D9464] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            Valider
          </button>
          {!isPctEntry && (
            <button
              type="button"
              onClick={() =>
                onEditFood(
                  entry,
                  candidateGrams > 0 ? candidateGrams : entry.g,
                  meal
                )
              }
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE5DF] bg-[#F7FAF8] px-4 text-sm font-semibold text-[#14231C] transition-colors hover:bg-[#EDF3EF] dark:border-[#2C3C32] dark:bg-[#1B2821] dark:text-[#EAF2ED] dark:hover:bg-[#223229] cursor-pointer"
            >
              <Pencil
                className="h-4 w-4 text-[#0D9464] dark:text-[#34D399]"
                aria-hidden="true"
              />
              Modifier l’aliment
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(entry.id)}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#F5CECB] bg-[#FEF5F4] px-4 text-sm font-semibold text-[#C63B31] transition-colors hover:bg-[#FCE8E6] dark:border-[#4B2220] dark:bg-[#2A1514] dark:text-[#FCA5A5] dark:hover:bg-[#381B1A] cursor-pointer"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Retirer du repas
          </button>
        </div>
      </div>
    </div>
  );
}

/* 5. Historical Day Detail Modal */
interface DayDetailModalProps {
  dateKeyStr: string | null;
  entries: LogEntry[];
  onClose: () => void;
  onJumpToDay: (dk: string) => void;
}

export function DayDetailModal({
  dateKeyStr,
  entries,
  onClose,
  onJumpToDay,
}: DayDetailModalProps) {
  useModalBackHandler(Boolean(dateKeyStr), onClose);

  if (!dateKeyStr) return null;

  const totals = dayTotals(entries);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3
              id="day-detail-title"
              className="text-lg font-bold text-[#14231C] dark:text-[#EAF2ED]"
            >
              {formatDayLabel(dateKeyStr)}
            </h3>
            <p className="mt-0.5 text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
              {Math.round(totals.k)} kcal · Prot. {formatDecimalFr(totals.p)} ·
              Glu. {formatDecimalFr(totals.c)} · Lip. {formatDecimalFr(totals.f)}
              {totals.al
                ? ` · Alc ${formatDecimalFr(totals.al / 10)} d (${Math.round(
                    totals.al * 7
                  )} kcal)`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5B6E64] hover:bg-[#F1F6F3] dark:text-[#98ABA0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {MEALS.map((m) => {
            const list = entries.filter((x) => mealOf(x) === m.id);
            if (!list.length) return null;
            const mealKcal = list.reduce((acc, x) => acc + x.k, 0);
            return (
              <div key={m.id}>
                <div className="mb-1 flex items-center justify-between text-sm font-bold text-[#14231C] dark:text-[#EAF2ED]">
                  <span>{m.name}</span>
                  <span className="tabular-nums">{Math.round(mealKcal)} kcal</span>
                </div>
                <ul className="divide-y divide-[#EDF2EE] rounded-xl border border-[#EDF2EE] bg-[#FAFDFB] px-3 dark:divide-[#233229] dark:border-[#233229] dark:bg-[#121B16]">
                  {list.map((x) => (
                    <li
                      key={x.id}
                      className="flex items-center justify-between gap-2 py-2 text-xs"
                    >
                      <div>
                        <span className="block font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                          {x.n}
                        </span>
                        <span className="tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
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
                                : `${formatDecimalFr(x.g)} g`}
                        </span>
                      </div>
                      <span className="font-semibold tabular-nums text-[#3C5045] dark:text-[#B9CBC0]">
                        {Math.round(x.k)} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onJumpToDay(dateKeyStr)}
            className="min-h-[42px] rounded-xl bg-[#0D9464] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            Ouvrir ce jour
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-xl border border-[#DCE5DF] px-3 text-xs font-semibold text-[#3C5045] transition-colors hover:bg-[#F1F6F3] dark:border-[#2C3C32] dark:text-[#B9CBC0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
