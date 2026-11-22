import { useEffect, useState } from 'react';
import { AlimentsView } from './components/AlimentsView';
import {
  DayDetailModal,
  EntryEditModal,
  FoodActionModal,
  FoodFormModal,
  FoodPickerModal,
} from './components/Modals';
import { ParametresView } from './components/ParametresView';
import { PeseeView } from './components/PeseeView';
import { SuiviView } from './components/SuiviView';
import { TodayView } from './components/TodayView';
import { TopNav } from './components/TopNav';
import { OfflineIndicator } from './components/PWAInstallButton';
import type {
  AppState,
  AppTab,
  Food,
  Goals,
  LogEntry,
  MealId,
  ThemePreference,
} from './types/nutrition';
import { readFromIndexedDB } from './utils/db';
import {
  MEALS,
  capitalizeFoodName,
  defaultMealForHour,
  loadState,
  normText,
  normalizeAppState,
  round1,
  saveState,
  todayKey,
} from './utils/nutrition';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeTab, setActiveTab] = useState<AppTab>('today');
  const [currentDate, setCurrentDate] = useState<string>(() => todayKey());
  const [activeMeal, setActiveMeal] = useState<MealId>(() =>
    defaultMealForHour()
  );
  const [selectedFoodId, setSelectedFoodId] = useState<string>('');

  // Modal states
  const [pickerOpen, setPickerOpen] = useState(false);
  const [foodFormState, setFoodFormState] = useState<{
    open: boolean;
    editing: Food | null;
    autoFocusOff?: boolean;
    linkedEntry?: {
      date: string;
      entryId: string;
      grams: number;
      meal: MealId;
      returnEntry: LogEntry;
    } | null;
  }>({ open: false, editing: null, autoFocusOff: false, linkedEntry: null });
  const [actionFood, setActionFood] = useState<Food | null>(null);
  const [editingEntry, setEditingEntry] = useState<LogEntry | null>(null);
  const [detailDayKey, setDetailDayKey] = useState<string | null>(null);

  const theme: ThemePreference = state.theme ?? 'light';

  // Hydrate from IndexedDB if localStorage had no user log/weights yet
  useEffect(() => {
    let active = true;
    void readFromIndexedDB().then((idbState) => {
      if (!active || !idbState) return;
      setState((current) => {
        const currentHasUserData =
          Object.keys(current.log).length > 0 || current.weights.length > 0;
        const idbHasUserData =
          Object.keys(idbState.log).length > 0 || idbState.weights.length > 0;
        if (!currentHasUserData && idbHasUserData) {
          const normalized = normalizeAppState(idbState);
          saveState(normalized);
          return normalized;
        }
        return current;
      });
    });
    return () => {
      active = false;
    };
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    const apply = (mode: ThemePreference) => {
      if (mode === 'dark') {
        root.classList.add('dark');
      } else if (mode === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia(
          '(prefers-color-scheme: dark)'
        ).matches;
        root.classList.toggle('dark', prefersDark);
      }
    };

    apply(theme);

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => apply('system');
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
  }, [theme]);

  const updateState = (updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  };

  const handleSelectTab = (tab: AppTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddEntry = (food: Food, grams: number, meal: MealId) => {
    const ratio = grams / 100;
    const entry: LogEntry = {
      id: `e${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      foodId: food.id,
      n: food.n,
      g: grams,
      k: food.k * ratio,
      p: food.p * ratio,
      c: food.c * ratio,
      f: food.f * ratio,
      al: (food.a || 0) * ratio,
      m: meal,
    };

    updateState((prev) => ({
      ...prev,
      log: {
        ...prev.log,
        [currentDate]: [...(prev.log[currentDate] || []), entry],
      },
    }));
  };

  const handleUpdateEntry = (
    entryId: string,
    newGrams: number,
    newMeal: MealId
  ) => {
    updateState((prev) => {
      const dayList = prev.log[currentDate] || [];
      const updated = dayList.map((x) => {
        if (x.id !== entryId) return x;
        const r = newGrams / x.g;
        return {
          ...x,
          g: newGrams,
          k: x.k * r,
          p: x.p * r,
          c: x.c * r,
          f: x.f * r,
          al: (x.al || 0) * r,
          m: newMeal,
        };
      });
      return {
        ...prev,
        log: { ...prev.log, [currentDate]: updated },
      };
    });
    setEditingEntry(null);
  };

  const handleDeleteEntry = (entryId: string) => {
    updateState((prev) => ({
      ...prev,
      log: {
        ...prev.log,
        [currentDate]: (prev.log[currentDate] || []).filter(
          (x) => x.id !== entryId
        ),
      },
    }));
    setEditingEntry(null);
  };

  const handleEditFoodFromEntry = (
    entry: LogEntry,
    currentGrams: number,
    currentMeal: MealId
  ) => {
    const matched =
      (entry.foodId && state.foods.find((f) => f.id === entry.foodId)) ||
      state.foods.find((f) => normText(f.n) === normText(entry.n)) ||
      null;

    const factor = entry.g > 0 ? 100 / entry.g : 0;
    const prefillFood: Food = matched ?? {
      id: '',
      n: entry.n,
      k: Math.round(entry.k * factor),
      p: round1(entry.p * factor),
      c: round1(entry.c * factor),
      f: round1(entry.f * factor),
      ...(entry.al ? { a: round1(entry.al * factor) } : {}),
    };

    setEditingEntry(null);
    setFoodFormState({
      open: true,
      editing: prefillFood,
      linkedEntry: {
        date: currentDate,
        entryId: entry.id,
        grams: currentGrams,
        meal: currentMeal,
        returnEntry: entry,
      },
    });
  };

  const handleSaveFood = (data: Omit<Food, 'id'>, existingId?: string) => {
    const normalizedData: Omit<Food, 'id'> = {
      n: capitalizeFoodName(data.n),
      k: data.k,
      p: data.p,
      c: data.c,
      f: data.f,
      ...(data.a && data.a > 0 ? { a: data.a } : {}),
    };
    const linked = foodFormState.linkedEntry;
    const savedId = existingId || `f${Date.now()}`;
    const savedFood: Food = { id: savedId, ...normalizedData };

    updateState((prev) => {
      const nextFoods = existingId
        ? prev.foods.map((f) => (f.id === existingId ? savedFood : f))
        : [...prev.foods, savedFood];

      let nextLog = prev.log;
      if (linked) {
        const dayEntries = prev.log[linked.date] || [];
        const ratio = linked.grams / 100;
        nextLog = {
          ...prev.log,
          [linked.date]: dayEntries.map((x) =>
            x.id === linked.entryId
              ? {
                  ...x,
                  foodId: savedFood.id,
                  n: savedFood.n,
                  g: linked.grams,
                  k: savedFood.k * ratio,
                  p: savedFood.p * ratio,
                  c: savedFood.c * ratio,
                  f: savedFood.f * ratio,
                  al: (savedFood.a || 0) * ratio,
                  m: linked.meal,
                }
              : x
          ),
        };
      }

      return {
        ...prev,
        foods: nextFoods,
        log: nextLog,
      };
    });

    if (!existingId && !linked) {
      setSelectedFoodId(savedId);
    }
    setFoodFormState({ open: false, editing: null, linkedEntry: null });
  };

  const handleDeleteFood = (foodId: string) => {
    updateState((prev) => ({
      ...prev,
      foods: prev.foods.filter((f) => f.id !== foodId),
    }));
    if (selectedFoodId === foodId) {
      setSelectedFoodId('');
    }
    setActionFood(null);
  };

  const handleAddWeight = (date: string, weight: number) => {
    updateState((prev) => ({
      ...prev,
      weights: [
        ...prev.weights.filter((x) => x.d !== date),
        { d: date, w: weight },
      ],
    }));
  };

  const handleDeleteWeight = (date: string) => {
    updateState((prev) => ({
      ...prev,
      weights: prev.weights.filter((x) => x.d !== date),
    }));
  };

  const handleSaveGoals = (nextGoals: Goals) => {
    updateState((prev) => ({
      ...prev,
      goals: nextGoals,
    }));
  };

  const handleToggleMeal = (mealId: MealId, checked: boolean): string | null => {
    const nextMeals = { ...state.mealsOn, [mealId]: checked };
    if (!MEALS.some((m) => nextMeals[m.id])) {
      return 'Au moins un repas doit rester affiché.';
    }
    updateState((prev) => ({
      ...prev,
      mealsOn: nextMeals,
    }));
    return null;
  };

  const handleChangeTheme = (nextTheme: ThemePreference) => {
    updateState((prev) => ({
      ...prev,
      theme: nextTheme,
    }));
  };

  const handleImportState = (imported: AppState) => {
    const normalized = normalizeAppState(imported);
    saveState(normalized);
    setState(normalized);
  };

  const handleImportCsvFoods = (importedFoods: Food[]): number => {
    let added = 0;
    updateState((prev) => {
      const existingKeys = new Set(prev.foods.map((f) => normText(f.n)));
      const nextFoods = [...prev.foods];
      for (const f of importedFoods) {
        const name = capitalizeFoodName(f.n);
        if (!name) continue;
        const key = normText(name);
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          nextFoods.push({
            id: f.id,
            n: name,
            k: f.k,
            p: f.p,
            c: f.c,
            f: f.f,
            ...(f.a && f.a > 0 ? { a: f.a } : {}),
          });
          added += 1;
        }
      }
      return { ...prev, foods: nextFoods };
    });
    return added;
  };

  const currentEntries = state.log[currentDate] || [];

  return (
    <div className="min-h-screen bg-[#F6F9F7] text-[#14231C] dark:bg-[#0F1713] dark:text-[#EAF2ED]">
      <TopNav activeTab={activeTab} onSelectTab={handleSelectTab} />

      <main className="mx-auto max-w-6xl px-3.5 pb-24 pt-4 sm:px-6 md:pb-12 md:pt-7">
        {activeTab === 'today' && (
          <TodayView
            currentDate={currentDate}
            onChangeDate={setCurrentDate}
            entries={currentEntries}
            allLog={state.log}
            goals={state.goals}
            foods={state.foods}
            mealsOn={state.mealsOn}
            activeMeal={activeMeal}
            onSelectMeal={setActiveMeal}
            selectedFoodId={selectedFoodId}
            onOpenFoodPicker={() => setPickerOpen(true)}
            onOpenNewFood={() =>
              setFoodFormState({ open: true, editing: null })
            }
            onAddEntry={handleAddEntry}
            onOpenEntry={(entry) => setEditingEntry(entry)}
          />
        )}

        {activeTab === 'suivi' && (
          <SuiviView
            log={state.log}
            goals={state.goals}
            weights={state.weights}
            onOpenDay={(dk) => setDetailDayKey(dk)}
          />
        )}

        {activeTab === 'pesee' && (
          <PeseeView
            weights={state.weights}
            onAddWeight={handleAddWeight}
            onDeleteWeight={handleDeleteWeight}
          />
        )}

        {activeTab === 'alim' && (
          <AlimentsView
            foods={state.foods}
            onNewFood={() =>
              setFoodFormState({
                open: true,
                editing: null,
                autoFocusOff: false,
                linkedEntry: null,
              })
            }
            onSearchOnline={() =>
              setFoodFormState({
                open: true,
                editing: null,
                autoFocusOff: true,
                linkedEntry: null,
              })
            }
            onSelectFood={(food) => setActionFood(food)}
            onImportCsvFoods={handleImportCsvFoods}
          />
        )}

        {activeTab === 'profil' && (
          <ParametresView
            goals={state.goals}
            weights={state.weights}
            mealsOn={state.mealsOn}
            theme={theme}
            fullState={state}
            onSaveGoals={handleSaveGoals}
            onToggleMeal={handleToggleMeal}
            onChangeTheme={handleChangeTheme}
            onImportState={handleImportState}
          />
        )}
      </main>

      {/* Modals */}
      <FoodPickerModal
        open={pickerOpen}
        foods={state.foods}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => {
          setSelectedFoodId(id);
          setPickerOpen(false);
        }}
      />

      <FoodFormModal
        open={foodFormState.open}
        editingFood={foodFormState.editing}
        autoFocusOff={foodFormState.autoFocusOff}
        helperNotice={
          foodFormState.linkedEntry
            ? 'Les modifications mettent à jour la base d’aliments et cette saisie.'
            : undefined
        }
        onClose={() => {
          const returnEntry = foodFormState.linkedEntry?.returnEntry ?? null;
          setFoodFormState({
            open: false,
            editing: null,
            autoFocusOff: false,
            linkedEntry: null,
          });
          if (returnEntry) {
            setEditingEntry(returnEntry);
          }
        }}
        onSave={handleSaveFood}
      />

      <FoodActionModal
        food={actionFood}
        onClose={() => setActionFood(null)}
        onEdit={(food) => {
          setActionFood(null);
          setFoodFormState({
            open: true,
            editing: food,
            autoFocusOff: false,
            linkedEntry: null,
          });
        }}
        onDelete={handleDeleteFood}
      />

      <EntryEditModal
        entry={editingEntry}
        onClose={() => setEditingEntry(null)}
        onUpdate={handleUpdateEntry}
        onEditFood={handleEditFoodFromEntry}
        onDelete={handleDeleteEntry}
      />

      <DayDetailModal
        dateKeyStr={detailDayKey}
        entries={detailDayKey ? state.log[detailDayKey] || [] : []}
        onClose={() => setDetailDayKey(null)}
        onJumpToDay={(dk) => {
          setDetailDayKey(null);
          setCurrentDate(dk);
          setActiveTab('today');
        }}
      />

      <OfflineIndicator />
    </div>
  );
}
