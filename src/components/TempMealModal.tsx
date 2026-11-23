import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { Food, TempMeal, TempMealItem } from '../types/nutrition';
import {
  capitalizeFoodName,
  computeTempMealTotals,
  formatDecimalFr,
  normText,
  parseNum,
  round1,
} from '../utils/nutrition';

interface TempMealBuilderProps {
  editingMeal: TempMeal | null;
  foods: Food[];
  onCancel: () => void;
  onSave: (
    dish: Omit<TempMeal, 'id' | 'createdAt'>,
    existingId?: string
  ) => void;
}

type AddItemMode = 'food' | 'custom';

export function TempMealBuilder({
  editingMeal,
  foods,
  onCancel,
  onSave,
}: TempMealBuilderProps) {
  const [dishName, setDishName] = useState('');
  const [items, setItems] = useState<TempMealItem[]>([]);
  const [addMode, setAddMode] = useState<AddItemMode>('food');

  // Ingredient picker state
  const [foodQuery, setFoodQuery] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [ingGrams, setIngGrams] = useState('');
  const [ingUnitMode, setIngUnitMode] = useState<'g' | 'unit'>('g');

  // Custom / free macros state
  const [customLabel, setCustomLabel] = useState('');
  const [customKcal, setCustomKcal] = useState('');
  const [customProt, setCustomProt] = useState('');
  const [customCarb, setCustomCarb] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customGrams, setCustomGrams] = useState('');

  const [error, setError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDishName(editingMeal ? editingMeal.n : '');
    setItems(editingMeal ? editingMeal.items.map((it) => ({ ...it })) : []);
    setAddMode('food');
    setFoodQuery('');
    setSelectedFoodId('');
    setDropdownOpen(false);
    setIngGrams('');
    setIngUnitMode('g');
    setCustomLabel('');
    setCustomKcal('');
    setCustomProt('');
    setCustomCarb('');
    setCustomFat('');
    setCustomGrams('');
    setError('');
    setTimeout(() => nameInputRef.current?.focus(), 20);
  }, [editingMeal]);

  const sortedFoods = useMemo(
    () => [...foods].sort((a, b) => a.n.localeCompare(b.n, 'fr')),
    [foods]
  );

  const filteredFoods = useMemo(() => {
    const q = normText(foodQuery.trim());
    const list = q
      ? sortedFoods.filter((f) => normText(f.n).includes(q))
      : sortedFoods;
    return list.slice(0, 40);
  }, [sortedFoods, foodQuery]);

  const selectedFood = useMemo(
    () => foods.find((f) => f.id === selectedFoodId) ?? null,
    [foods, selectedFoodId]
  );

  const totals = useMemo(() => computeTempMealTotals(items), [items]);

  const isDrinkIng = Boolean(selectedFood?.b);
  const effectiveIngUnitMode: 'g' | 'unit' | 'cl' = isDrinkIng
    ? 'cl'
    : ingUnitMode === 'unit' && selectedFood?.u && selectedFood.u > 0
      ? 'unit'
      : 'g';

  const handleAddFoodItem = () => {
    setError('');
    if (!selectedFood) {
      setError('Sélectionne un ingrédient dans la liste.');
      return;
    }
    const amt = parseNum(ingGrams);
    if (!(amt > 0)) {
      setError(
        effectiveIngUnitMode === 'cl'
          ? 'Entre un volume en cL pour cette boisson.'
          : effectiveIngUnitMode === 'unit'
            ? 'Entre un nombre d’unités pour cet ingrédient.'
            : 'Entre un poids en grammes pour cet ingrédient.'
      );
      return;
    }
    const g =
      effectiveIngUnitMode === 'cl'
        ? round1(amt * 10)
        : effectiveIngUnitMode === 'unit' && selectedFood.u
          ? round1(amt * selectedFood.u)
          : amt;
    const ratio = g / 100;
    const labelSuffix =
      effectiveIngUnitMode === 'cl'
        ? ` (${formatDecimalFr(amt)} cL)`
        : effectiveIngUnitMode === 'unit'
          ? ` (${formatDecimalFr(amt)} ${amt < 2 ? 'unité' : 'unités'})`
          : '';
    const newItem: TempMealItem = {
      id: `tmi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'food',
      foodId: selectedFood.id,
      n: `${selectedFood.n}${labelSuffix}`,
      g: round1(g),
      k: Math.round(selectedFood.k * ratio),
      p: round1(selectedFood.p * ratio),
      c: round1(selectedFood.c * ratio),
      f: round1(selectedFood.f * ratio),
      ...(selectedFood.a ? { al: round1(selectedFood.a * ratio) } : {}),
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedFoodId('');
    setFoodQuery('');
    setIngGrams('');
    setIngUnitMode('g');
    setDropdownOpen(false);
  };

  const buildPendingCustomItem = (): TempMealItem | null => {
    const p = Math.max(0, parseNum(customProt));
    const c = Math.max(0, parseNum(customCarb));
    const f = Math.max(0, parseNum(customFat));
    const rawK = parseNum(customKcal);
    const hasKInput = customKcal.trim() !== '' && rawK >= 0;
    const k = hasKInput
      ? Math.round(rawK)
      : Math.round(p * 4 + c * 4 + f * 9);
    const g = Math.max(0, parseNum(customGrams));

    if (k <= 0 && p <= 0 && c <= 0 && f <= 0) {
      return null;
    }

    return {
      id: `tmi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'custom',
      n: capitalizeFoodName(customLabel) || 'Macros libres',
      g: round1(g),
      k,
      p: round1(p),
      c: round1(c),
      f: round1(f),
    };
  };

  const handleAddCustomItem = () => {
    setError('');
    const item = buildPendingCustomItem();
    if (!item) {
      setError('Entre au moins les calories ou une valeur de macros (P, G, L).');
      return;
    }
    setItems((prev) => [...prev, item]);
    setCustomLabel('');
    setCustomKcal('');
    setCustomProt('');
    setCustomCarb('');
    setCustomFat('');
    setCustomGrams('');
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveDish = () => {
    setError('');
    const cleanName = capitalizeFoodName(dishName);
    if (!cleanName) {
      setError('Donne un nom à ce plat temporaire.');
      nameInputRef.current?.focus();
      return;
    }

    let finalItems = items;
    if (finalItems.length === 0 && addMode === 'custom') {
      const pendingCustom = buildPendingCustomItem();
      if (pendingCustom) {
        finalItems = [pendingCustom];
      }
    }

    if (finalItems.length === 0) {
      setError(
        'Ajoute au moins un ingrédient ou des macros libres à ce plat.'
      );
      return;
    }

    const finalTotals = computeTempMealTotals(finalItems);
    onSave(
      {
        n: cleanName,
        items: finalItems,
        totalG: finalTotals.totalG,
        totalK: finalTotals.totalK,
        totalP: finalTotals.totalP,
        totalC: finalTotals.totalC,
        totalF: finalTotals.totalF,
        ...(finalTotals.totalAl > 0 ? { totalAl: finalTotals.totalAl } : {}),
      },
      editingMeal?.id
    );
  };

  return (
    <div>
      <p className="mt-1 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
        Assemble tes ingrédients et/ou des macros libres sans encombrer ta base
        d’aliments. Tu pourras ensuite saisir tes parts en %.
      </p>

      {/* Dish Name */}
      <div className="mt-3.5">
          <label
            htmlFor="temp-meal-name"
            className="mb-1 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
          >
            Nom du plat
          </label>
          <input
            id="temp-meal-name"
            ref={nameInputRef}
            type="text"
            value={dishName}
            onChange={(e) => setDishName(e.target.value)}
            placeholder="Ex : Gratin de morue, Chili maison…"
            className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 text-sm font-medium text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
          />
        </div>

        {/* Add item section */}
        <div className="mt-4 rounded-xl border border-[#E2EAE5] bg-[#F7FAF8] p-3 dark:border-[#25332B] dark:bg-[#121B16]">
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-[#E9F0EC] p-1 dark:bg-[#1C2821]">
            <button
              type="button"
              onClick={() => {
                setAddMode('food');
                setError('');
              }}
              className={`min-h-[34px] rounded-md px-2 text-xs font-semibold transition-colors cursor-pointer ${
                addMode === 'food'
                  ? 'bg-white text-[#14231C] shadow-xs dark:bg-[#16211B] dark:text-[#EAF2ED]'
                  : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0]'
              }`}
            >
              Ingrédient (base)
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('custom');
                setError('');
              }}
              className={`min-h-[34px] rounded-md px-2 text-xs font-semibold transition-colors cursor-pointer ${
                addMode === 'custom'
                  ? 'bg-white text-[#14231C] shadow-xs dark:bg-[#16211B] dark:text-[#EAF2ED]'
                  : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0]'
              }`}
            >
              Macros libres
            </button>
          </div>

          {addMode === 'food' ? (
            <div className="mt-3 space-y-2.5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={foodQuery}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    setFoodQuery(e.target.value);
                    setSelectedFoodId('');
                    setDropdownOpen(true);
                  }}
                  placeholder="Rechercher un ingrédient…"
                  className="min-h-[42px] w-full rounded-xl border border-[#D4DFD8] bg-white pl-9 pr-3 text-sm text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                />

                {dropdownOpen && (
                  <ul className="mt-1.5 max-h-44 divide-y divide-[#EDF2EE] overflow-y-auto rounded-xl border border-[#DCE5DF] bg-white p-1 shadow-md dark:divide-[#233229] dark:border-[#2C3C32] dark:bg-[#16211B]">
                    {filteredFoods.length === 0 ? (
                      <li className="px-3 py-2.5 text-center text-xs text-[#5B6E64] dark:text-[#98ABA0]">
                        Aucun ingrédient trouvé
                      </li>
                    ) : (
                      filteredFoods.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFoodId(f.id);
                              setFoodQuery(f.n);
                              setIngUnitMode(f.u && f.u > 0 ? 'unit' : 'g');
                              setDropdownOpen(false);
                              setError('');
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[#ECF8F1] dark:hover:bg-[#18382A] cursor-pointer"
                          >
                            <span className="truncate font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                              {f.n}
                              {f.b
                                ? ' (en cL)'
                                : f.u
                                  ? ` (1 u = ${formatDecimalFr(f.u)} g)`
                                  : ''}
                            </span>
                            <span className="shrink-0 tabular-nums text-[#0D9464] dark:text-[#34D399]">
                              {f.k} kcal/{f.b ? '100ml' : '100g'}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {!selectedFood?.b && selectedFood?.u && selectedFood.u > 0 && (
                <div className="inline-flex rounded-lg border border-[#DCE5DF] bg-[#E9F0EC] p-0.5 dark:border-[#25332B] dark:bg-[#1C2821]">
                  <button
                    type="button"
                    onClick={() => setIngUnitMode('unit')}
                    className={`min-h-[28px] rounded-md px-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                      effectiveIngUnitMode === 'unit'
                        ? 'bg-white text-[#0B7B54] shadow-xs dark:bg-[#16211B] dark:text-[#34D399]'
                        : 'text-[#55685E] dark:text-[#98ABA0]'
                    }`}
                  >
                    Unités ({formatDecimalFr(selectedFood.u)} g)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngUnitMode('g')}
                    className={`min-h-[28px] rounded-md px-2 text-[11px] font-semibold transition-colors cursor-pointer ${
                      effectiveIngUnitMode === 'g'
                        ? 'bg-white text-[#0B7B54] shadow-xs dark:bg-[#16211B] dark:text-[#34D399]'
                        : 'text-[#55685E] dark:text-[#98ABA0]'
                    }`}
                  >
                    Grammes
                  </button>
                </div>
              )}

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={ingGrams}
                  onChange={(e) => setIngGrams(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddFoodItem();
                  }}
                  placeholder={
                    effectiveIngUnitMode === 'cl'
                      ? 'Volume (cL), ex : 25'
                      : effectiveIngUnitMode === 'unit'
                        ? 'Nombre d’unités, ex : 2'
                        : 'Poids (g), ex : 250'
                  }
                  aria-label={
                    effectiveIngUnitMode === 'cl'
                      ? 'Volume de la boisson en cL'
                      : effectiveIngUnitMode === 'unit'
                        ? 'Nombre d’unités de l’ingrédient'
                        : 'Poids de l’ingrédient en grammes'
                  }
                  className="min-h-[42px] w-full min-w-0 rounded-xl border border-[#D4DFD8] bg-white px-3 text-sm tabular-nums text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                />
                <button
                  type="button"
                  onClick={handleAddFoodItem}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl bg-[#0D9464] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] cursor-pointer whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Ajouter
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Libellé (ex : Sauce, Plat entier…)"
                  className="min-h-[40px] w-full rounded-xl border border-[#D4DFD8] bg-white px-3 text-sm text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={customGrams}
                  onChange={(e) => setCustomGrams(e.target.value)}
                  placeholder="Poids (g) — facultatif"
                  className="min-h-[40px] w-full rounded-xl border border-[#D4DFD8] bg-white px-3 text-sm tabular-nums text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52655B] dark:text-[#98ABA0]">
                    Calories (kcal)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customKcal}
                    onChange={(e) => setCustomKcal(e.target.value)}
                    placeholder="Auto"
                    className="min-h-[40px] w-full rounded-xl border border-[#D4DFD8] bg-white px-2.5 text-sm tabular-nums text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52655B] dark:text-[#98ABA0]">
                    Protéines (g)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customProt}
                    onChange={(e) => setCustomProt(e.target.value)}
                    placeholder="0"
                    className="min-h-[40px] w-full rounded-xl border border-[#D4DFD8] bg-white px-2.5 text-sm tabular-nums text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52655B] dark:text-[#98ABA0]">
                    Glucides (g)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customCarb}
                    onChange={(e) => setCustomCarb(e.target.value)}
                    placeholder="0"
                    className="min-h-[40px] w-full rounded-xl border border-[#D4DFD8] bg-white px-2.5 text-sm tabular-nums text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-[#52655B] dark:text-[#98ABA0]">
                    Lipides (g)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customFat}
                    onChange={(e) => setCustomFat(e.target.value)}
                    placeholder="0"
                    className="min-h-[40px] w-full rounded-xl border border-[#D4DFD8] bg-white px-2.5 text-sm tabular-nums text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddCustomItem}
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#0D9464] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Ajouter ces macros au plat
              </button>
            </div>
          )}
        </div>

        {/* Dish ingredients & custom lines list */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#3C5045] dark:text-[#B9CBC0]">
            <span>Contenu du plat ({items.length})</span>
            {items.length > 0 && (
              <span className="tabular-nums text-[#0D9464] dark:text-[#34D399]">
                Total 100 % : {totals.totalK} kcal
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DCE5DF] bg-[#FAFDFB] px-3 py-4 text-center text-xs text-[#687A70] dark:border-[#28372E] dark:bg-[#121B16] dark:text-[#98ABA0]">
              Aucun élément ajouté pour l’instant.
            </div>
          ) : (
            <ul className="max-h-48 divide-y divide-[#EDF2EE] overflow-y-auto rounded-xl border border-[#E2EAE5] bg-white px-3 dark:divide-[#233229] dark:border-[#25332B] dark:bg-[#121B16]">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-2 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                        {it.n}
                      </span>
                      {it.kind === 'custom' && (
                        <span className="shrink-0 rounded bg-[#ECF8F1] px-1.5 py-0.5 text-[10px] font-semibold text-[#0B7B54] dark:bg-[#18382A] dark:text-[#34D399]">
                          Libre
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 block tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                      {it.g > 0 ? `${formatDecimalFr(it.g)} g · ` : ''}
                      {it.k} kcal · P {formatDecimalFr(it.p)} · G{' '}
                      {formatDecimalFr(it.c)} · L {formatDecimalFr(it.f)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(it.id)}
                    aria-label={`Retirer ${it.n}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#C63B31] hover:bg-[#FEF5F4] dark:text-[#FCA5A5] dark:hover:bg-[#2A1514] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <div className="mt-2.5 rounded-xl bg-[#ECF8F1] px-3.5 py-2.5 text-xs dark:bg-[#153125]">
              <div className="flex items-center justify-between font-bold text-[#0B7B54] dark:text-[#34D399]">
                <span>Total du plat (100 %)</span>
                <span className="tabular-nums">{totals.totalK} kcal</span>
              </div>
              <div className="mt-0.5 tabular-nums text-[#3C5045] dark:text-[#B9CBC0]">
                {totals.totalG > 0
                  ? `${formatDecimalFr(totals.totalG)} g · `
                  : ''}
                Prot. {formatDecimalFr(totals.totalP)} g · Glu.{' '}
                {formatDecimalFr(totals.totalC)} g · Lip.{' '}
                {formatDecimalFr(totals.totalF)} g
              </div>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-[#C63B31] dark:text-[#FCA5A5]">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSaveDish}
            className="min-h-[44px] flex-1 rounded-xl bg-[#0D9464] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            Enregistrer le plat temporaire
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-xl border border-[#DCE5DF] px-4 text-sm font-semibold text-[#3C5045] hover:bg-[#F1F6F3] dark:border-[#2C3C32] dark:text-[#B9CBC0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            Annuler
          </button>
        </div>
    </div>
  );
}
