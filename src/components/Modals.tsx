import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Loader2, Pencil, Search, Trash2, X } from 'lucide-react';
import type { Food, LogEntry, MealId } from '../types/nutrition';
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
  searchOpenFoodFacts,
} from '../utils/openFoodFacts';

/* 1. Searchable Food Picker Modal */
interface FoodPickerModalProps {
  open: boolean;
  foods: Food[];
  onClose: () => void;
  onSelect: (foodId: string) => void;
}

export function FoodPickerModal({
  open,
  foods,
  onClose,
  onSelect,
}: FoodPickerModalProps) {
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlightIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = normText(query.trim());
    return [...foods]
      .sort((a, b) => a.n.localeCompare(b.n, 'fr'))
      .filter((f) => !q || normText(f.n).includes(q));
  }, [foods, query]);

  if (!open) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!filtered.length) return;
      setHighlightIdx(
        (prev) => (prev + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[highlightIdx > -1 ? highlightIdx : 0];
      if (target) onSelect(target.id);
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
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#5B6E64] dark:text-[#98ABA0]">
              Aucun résultat
            </li>
          ) : (
            filtered.map((f, idx) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onSelect(f.id)}
                  className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                    idx === highlightIdx
                      ? 'bg-[#ECF8F1] dark:bg-[#18382A]'
                      : 'hover:bg-[#F5F9F6] dark:hover:bg-[#1C2A22]'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                      {f.n}
                    </span>
                    <span className="block text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                      Prot. {f.p} · Glu. {f.c} · Lip. {f.f}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-[#0D9464] dark:text-[#34D399]">
                    {f.k} kcal
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

/* 2. Create / Edit Food Modal */
interface FoodFormModalProps {
  open: boolean;
  editingFood: Food | null;
  helperNotice?: string;
  autoFocusOff?: boolean;
  onClose: () => void;
  onSave: (data: Omit<Food, 'id'>, existingId?: string) => void;
}

export function FoodFormModal({
  open,
  editingFood,
  helperNotice,
  autoFocusOff,
  onClose,
  onSave,
}: FoodFormModalProps) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [alc, setAlc] = useState('');
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

  useEffect(() => {
    if (open) {
      setName(editingFood?.n ?? '');
      setKcal(editingFood ? String(editingFood.k) : '');
      setProt(editingFood && editingFood.p ? String(editingFood.p) : '');
      setCarbs(editingFood && editingFood.c ? String(editingFood.c) : '');
      setFat(editingFood && editingFood.f ? String(editingFood.f) : '');
      setAlc(editingFood && editingFood.a ? String(editingFood.a) : '');
      setError('');
      setOffQuery(editingFood?.n ?? '');
      setOffLoading(false);
      setOffError('');
      setOffResults([]);
      setOffInfo('');
      setTimeout(() => {
        if (autoFocusOff) {
          offRef.current?.focus();
        } else {
          nameRef.current?.focus();
        }
      }, 20);
    } else {
      abortRef.current?.abort();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [open, editingFood, autoFocusOff]);

  if (!open) return null;

  const parseOptional = (v: string) => (v.trim() === '' ? 0 : parseNum(v));

  const handleSearchOff = async () => {
    const q = offQuery.trim();
    if (!q) {
      setOffError('Entre un nom de produit ou un code-barres.');
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
        setOffError('Aucun produit trouvé sur Open Food Facts.');
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
    const displayName =
      item.brand && !normText(item.name).includes(normText(item.brand))
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
    setOffInfo('Valeurs importées depuis Open Food Facts — vérifie et enregistre.');
  };

  const handleSave = () => {
    const n = capitalizeFoodName(name);
    const k = parseNum(kcal);
    const p = parseOptional(prot);
    const c = parseOptional(carbs);
    const f = parseOptional(fat);
    const a = parseOptional(alc);

    if (!n || [k, p, c, f, a].some(Number.isNaN)) {
      setError('Renseigne au moins le nom et les kcal pour 100 g.');
      return;
    }
    onSave({ n, k, p, c, f, a }, editingFood?.id);
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <div className="flex items-center justify-between gap-2">
          <h3
            id="food-form-title"
            className="text-lg font-bold text-[#14231C] dark:text-[#EAF2ED]"
          >
            {editingFood ? 'Modifier l’aliment' : 'Nouvel aliment'}
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

        <p className="mt-1 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
          Valeurs pour 100 g (ou 100 ml). Seuls le nom et les kcal sont
          obligatoires.
        </p>
        {helperNotice && (
          <p className="mt-1.5 rounded-lg bg-[#ECF8F1] px-2.5 py-1.5 text-xs font-medium text-[#0B7B54] dark:bg-[#163627] dark:text-[#34D399]">
            {helperNotice}
          </p>
        )}

        {/* Open Food Facts Lookup */}
        <div className="mt-3.5 rounded-xl border border-[#DCE5DF] bg-[#F7FAF8] p-3 dark:border-[#25332B] dark:bg-[#121B16]">
          <label
            htmlFor="off-search-input"
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#14231C] dark:text-[#EAF2ED]"
          >
            <Globe
              className="h-3.5 w-3.5 text-[#0D9464] dark:text-[#34D399]"
              aria-hidden="true"
            />
            Rechercher sur Open Food Facts
          </label>
          <div className="flex gap-1.5">
            <input
              id="off-search-input"
              ref={offRef}
              type="text"
              value={offQuery}
              onChange={(e) => setOffQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSearchOff();
                }
              }}
              placeholder="Nom ou code-barres…"
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
          {food.k} kcal pour 100 g · Prot. {food.p} · Glu. {food.c} · Lip.{' '}
          {food.f}
          {food.a ? ` · Alc ${food.a}` : ''}
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

/* 4. Entry Edit / Remove Modal */
interface EntryEditModalProps {
  entry: LogEntry | null;
  onClose: () => void;
  onUpdate: (entryId: string, newGrams: number, newMeal: MealId) => void;
  onEditFood: (entry: LogEntry, currentGrams: number, currentMeal: MealId) => void;
  onDelete: (entryId: string) => void;
}

export function EntryEditModal({
  entry,
  onClose,
  onUpdate,
  onEditFood,
  onDelete,
}: EntryEditModalProps) {
  const [gramsStr, setGramsStr] = useState('');
  const [meal, setMeal] = useState<MealId>('o');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entry) {
      setGramsStr(String(round1(entry.g)));
      setMeal(mealOf(entry));
      setError('');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 20);
    }
  }, [entry]);

  if (!entry) return null;

  const parsed = parseNum(gramsStr);
  const ratio = parsed > 0 && entry.g > 0 ? parsed / entry.g : 0;

  const handleValidate = () => {
    if (!(parsed > 0)) {
      setError('Entre une quantité en grammes (ex : 100).');
      return;
    }
    onUpdate(entry.id, parsed, meal);
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
              {ratio > 0
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
          <div>
            <label
              htmlFor="edit-entry-grams"
              className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
            >
              Quantité (g)
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
          <button
            type="button"
            onClick={() =>
              onEditFood(entry, parsed > 0 ? parsed : entry.g, meal)
            }
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DCE5DF] bg-[#F7FAF8] px-4 text-sm font-semibold text-[#14231C] transition-colors hover:bg-[#EDF3EF] dark:border-[#2C3C32] dark:bg-[#1B2821] dark:text-[#EAF2ED] dark:hover:bg-[#223229] cursor-pointer"
          >
            <Pencil
              className="h-4 w-4 text-[#0D9464] dark:text-[#34D399]"
              aria-hidden="true"
            />
            Modifier l’aliment
          </button>
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
                          {formatDecimalFr(x.g)} g
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
