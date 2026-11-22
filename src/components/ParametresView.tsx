import { useRef, useState } from 'react';
import { Download, Monitor, Moon, Sun, Upload } from 'lucide-react';
import type {
  ActivityFactor,
  AppState,
  Goals,
  MealId,
  MealsOn,
  MorphologyCode,
  SexCode,
  ThemePreference,
  WeightEntry,
} from '../types/nutrition';
import {
  MEALS,
  ageOf,
  formatDecimalFr,
  parseNum,
  recommendedMacros,
  round1,
  suggestIdealWeight,
  suggestedGoals,
} from '../utils/nutrition';
import { PWASettingsSection } from './PWAInstallButton';

interface ParametresViewProps {
  goals: Goals;
  weights: WeightEntry[];
  mealsOn: MealsOn;
  theme: ThemePreference;
  fullState: AppState;
  onSaveGoals: (nextGoals: Goals) => void;
  onToggleMeal: (mealId: MealId, checked: boolean) => string | null;
  onChangeTheme: (theme: ThemePreference) => void;
  onImportState: (imported: AppState) => void;
}

export function ParametresView({
  goals,
  weights,
  mealsOn,
  theme,
  fullState,
  onSaveGoals,
  onToggleMeal,
  onChangeTheme,
  onImportState,
}: ParametresViewProps) {
  const [kcalStr, setKcalStr] = useState(String(goals.k));
  const [protStr, setProtStr] = useState(String(goals.p));
  const [heightStr, setHeightStr] = useState(goals.h ? String(goals.h) : '');
  const [sex, setSex] = useState<SexCode>(goals.s || '');
  const [birthDate, setBirthDate] = useState(goals.b || '');
  const [morphology, setMorphology] = useState<MorphologyCode>(goals.m || 'N');
  const [targetWeightStr, setTargetWeightStr] = useState(
    goals.w ? String(goals.w) : ''
  );
  const [activity, setActivity] = useState<string>(goals.a || '1.55');

  const [goalStatus, setGoalStatus] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [bodyStatus, setBodyStatus] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [mealNote, setMealNote] = useState(
    'Un repas masqué reste visible pour un jour où il contient déjà des aliments.'
  );
  const [backupStatus, setBackupStatus] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live calculated guidance based on current saved goals
  const sg = suggestIdealWeight(goals);
  const rc = recommendedMacros(goals);
  const ob = suggestedGoals(goals, weights);

  const saveAll = (target: 'goal' | 'body', overrideK?: number, overrideP?: number) => {
    setGoalStatus(null);
    setBodyStatus(null);

    const k = overrideK ?? parseNum(kcalStr);
    const p = overrideP ?? parseNum(protStr);
    const hv = heightStr.trim();
    const h = hv === '' ? 0 : parseNum(hv);

    const setTargetMsg = target === 'goal' ? setGoalStatus : setBodyStatus;

    if ([k, p, h].some(Number.isNaN) || (h && (h < 140 || h > 220))) {
      setTargetMsg({
        text: 'Vérifie les valeurs saisies (taille entre 140 et 220 cm).',
        isError: true,
      });
      return;
    }

    if (birthDate && ageOf(birthDate) === null) {
      setTargetMsg({
        text: 'Date de naissance non valide (âge entre 18 et 100 ans).',
        isError: true,
      });
      return;
    }

    const wv = targetWeightStr.trim();
    const wf = wv === '' ? 0 : parseNum(wv);
    if (Number.isNaN(wf) || (wf && (wf < 40 || wf > 200))) {
      setTargetMsg({
        text: 'Poids de forme non valide (entre 40 et 200 kg).',
        isError: true,
      });
      return;
    }

    onSaveGoals({
      ...goals,
      k,
      p,
      h,
      s: sex,
      b: birthDate,
      m: morphology,
      w: wf,
      a: activity as ActivityFactor,
    });
    setTargetMsg({ text: 'Enregistré.', isError: false });
  };

  const handleApplySuggestion = () => {
    if (!ob) return;
    setKcalStr(String(ob.k));
    setProtStr(String(ob.p));
    saveAll('goal', ob.k, ob.p);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(fullState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suivi-calories-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus({ text: 'Sauvegarde téléchargée.', isError: false });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppState>;
      if (!parsed || !Array.isArray(parsed.foods) || !parsed.goals || !parsed.log) {
        setBackupStatus({
          text: 'Fichier invalide : format non reconnu.',
          isError: true,
        });
        return;
      }
      onImportState({
        foods: parsed.foods,
        goals: parsed.goals,
        log: parsed.log,
        weights: Array.isArray(parsed.weights) ? parsed.weights : [],
        alc: parsed.alc ?? 1,
        mealsOn: parsed.mealsOn ?? { b: true, l: true, d: true, o: true },
        theme: parsed.theme ?? theme,
      });
      setKcalStr(String(parsed.goals.k));
      setProtStr(String(parsed.goals.p));
      setHeightStr(parsed.goals.h ? String(parsed.goals.h) : '');
      setSex(parsed.goals.s || '');
      setBirthDate(parsed.goals.b || '');
      setMorphology(parsed.goals.m || 'N');
      setTargetWeightStr(parsed.goals.w ? String(parsed.goals.w) : '');
      setActivity(parsed.goals.a || '1.55');
      setBackupStatus({ text: 'Données importées avec succès.', isError: false });
    } catch {
      setBackupStatus({
        text: 'Impossible de lire ce fichier JSON.',
        isError: true,
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      {/* Left Column: Goals & Body Data */}
      <div className="space-y-6 lg:col-span-7">
        {/* Objectifs moyens */}
        <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Objectifs moyens
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ok-input"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Calories (kcal)
              </label>
              <input
                id="ok-input"
                type="text"
                inputMode="decimal"
                value={kcalStr}
                onChange={(e) => setKcalStr(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 py-2.5 text-sm font-medium tabular-nums text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              />
            </div>
            <div>
              <label
                htmlFor="op-input"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Protéines (g)
              </label>
              <input
                id="op-input"
                type="text"
                inputMode="decimal"
                value={protStr}
                onChange={(e) => setProtStr(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 py-2.5 text-sm font-medium tabular-nums text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              />
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-[#5B6E64] dark:text-[#98ABA0]">
            {ob
              ? `Entretien estimé : ${ob.e} kcal${
                  ob.loss
                    ? ` ; pour te rapprocher de ton poids objectif : ${ob.k} kcal (déficit d’environ 12 %)`
                    : ''
                }. Protéines : ${ob.p} g (1,6 g/kg). Basé sur ${
                  ob.cw ? 'ta dernière pesée' : 'ton poids de référence'
                } (${formatDecimalFr(ob.w)} kg).`
              : 'Renseigne taille, date de naissance et sexe dans Données corporelles pour obtenir une suggestion.'}
          </p>

          {ob && (
            <button
              type="button"
              onClick={handleApplySuggestion}
              className="mt-2 inline-flex min-h-[36px] items-center rounded-lg px-2.5 py-1 text-xs font-semibold text-[#0D9464] transition-colors hover:bg-[#ECF8F1] dark:text-[#34D399] dark:hover:bg-[#193528] cursor-pointer"
            >
              Appliquer la suggestion ({ob.k} kcal · {ob.p} g prot.)
            </button>
          )}

          <button
            type="button"
            onClick={() => saveAll('goal')}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#0D9464] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0A7A52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            Enregistrer les objectifs
          </button>

          {goalStatus && (
            <p
              role="status"
              className={`mt-2.5 text-sm font-medium ${
                goalStatus.isError
                  ? 'text-[#C63B31] dark:text-[#FCA5A5]'
                  : 'text-[#0B7B54] dark:text-[#34D399]'
              }`}
            >
              {goalStatus.text}
            </p>
          )}
        </section>

        {/* Données corporelles */}
        <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Données corporelles
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="oh-input"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Taille (cm)
              </label>
              <input
                id="oh-input"
                type="text"
                inputMode="decimal"
                placeholder="175"
                value={heightStr}
                onChange={(e) => setHeightStr(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 py-2.5 text-sm tabular-nums text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              />
            </div>

            <div>
              <label
                htmlFor="os-select"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Sexe
              </label>
              <select
                id="os-select"
                value={sex}
                onChange={(e) => setSex(e.target.value as SexCode)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 py-2.5 text-sm text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              >
                <option value="">Non renseigné</option>
                <option value="F">Femme</option>
                <option value="H">Homme</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="on-input"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Date de naissance
              </label>
              <input
                id="on-input"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 py-2.5 text-sm text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              />
            </div>

            <div>
              <label
                htmlFor="om-select"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Morphologie
              </label>
              <select
                id="om-select"
                value={morphology}
                onChange={(e) => setMorphology(e.target.value as MorphologyCode)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 py-2.5 text-sm text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              >
                <option value="N">Normale</option>
                <option value="M">Fine</option>
                <option value="L">Large</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="ow-input"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Poids de forme / objectif (kg)
              </label>
              <input
                id="ow-input"
                type="text"
                inputMode="decimal"
                placeholder={sg ? formatDecimalFr(sg.w) : 'Ex : 72'}
                value={targetWeightStr}
                onChange={(e) => setTargetWeightStr(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 py-2.5 text-sm tabular-nums text-[#14231C] placeholder:text-[#8A9B91] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              />
            </div>

            <div>
              <label
                htmlFor="oa-select"
                className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
              >
                Activité physique
              </label>
              <select
                id="oa-select"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3 py-2.5 text-sm text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
              >
                <option value="1.2">Sédentaire</option>
                <option value="1.375">Légère (1-3 séances/sem.)</option>
                <option value="1.55">Modérée (3-5 séances/sem.)</option>
                <option value="1.725">Intense (6-7 séances/sem.)</option>
              </select>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-xs leading-relaxed text-[#5B6E64] dark:text-[#98ABA0]">
            <p>
              {sg
                ? `Suggestion : ${formatDecimalFr(sg.w)} kg (${sg.m}). Laisse le champ vide pour l’utiliser.`
                : 'Renseigne ta taille pour obtenir une suggestion de poids de forme.'}
            </p>
            <p>
              {rc
                ? `Repères : lipides ${rc.f} g, glucides ${rc.c} g (poids de référence ${round1(
                    rc.w
                  )} kg, ${rc.m}). Estimation indicative.`
                : 'Renseigne ta taille pour obtenir des repères glucides et lipides.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => saveAll('body')}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#0D9464] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0A7A52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
          >
            Enregistrer les données
          </button>

          {bodyStatus && (
            <p
              role="status"
              className={`mt-2.5 text-sm font-medium ${
                bodyStatus.isError
                  ? 'text-[#C63B31] dark:text-[#FCA5A5]'
                  : 'text-[#0B7B54] dark:text-[#34D399]'
              }`}
            >
              {bodyStatus.text}
            </p>
          )}
        </section>
      </div>

      {/* Right Column: PWA, Theme, Meals & Backup */}
      <div className="space-y-6 lg:col-span-5">
        <PWASettingsSection />

        {/* Apparence */}
        <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Apparence
          </h2>
          <p className="mt-1 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
            Thème clair lumineux par défaut, ou mode sombre pour le soir.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-[#ECF2EE] p-1 dark:bg-[#111A15]">
            {(
              [
                { id: 'light', label: 'Clair', Icon: Sun },
                { id: 'dark', label: 'Sombre', Icon: Moon },
                { id: 'system', label: 'Auto', Icon: Monitor },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeTheme(id)}
                  className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-[#14231C] shadow-xs dark:bg-[#1D2B23] dark:text-[#EAF2ED]'
                      : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Repas affichés */}
        <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Repas affichés
          </h2>

          <div className="mt-3 divide-y divide-[#EDF2EE] dark:divide-[#233229]">
            {MEALS.map((m) => (
              <label
                key={m.id}
                className="flex min-h-[46px] cursor-pointer items-center gap-3 py-2 text-sm font-medium text-[#14231C] dark:text-[#EAF2ED]"
              >
                <input
                  type="checkbox"
                  checked={Boolean(mealsOn[m.id])}
                  onChange={(e) => {
                    const err = onToggleMeal(m.id, e.target.checked);
                    setMealNote(
                      err ||
                        'Un repas masqué reste visible pour un jour où il contient déjà des aliments.'
                    );
                  }}
                  className="h-5 w-5 rounded border-[#C6D5CC] accent-[#0D9464] cursor-pointer"
                />
                <span>{m.name}</span>
              </label>
            ))}
          </div>

          <p
            role="status"
            className="mt-2 text-xs text-[#5B6E64] dark:text-[#98ABA0]"
          >
            {mealNote}
          </p>
        </section>

        {/* Base de données locale */}
        <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Base de données locale
          </h2>
          <p className="mt-1 text-xs font-medium tabular-nums text-[#0D9464] dark:text-[#34D399]">
            {fullState.foods.length} aliments ·{' '}
            {
              Object.values(fullState.log).filter((arr) => arr && arr.length > 0)
                .length
            }{' '}
            jour(s) de repas · {weights.length} pesée(s)
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#5B6E64] dark:text-[#98ABA0]">
            Tes aliments, repas et pesées sont enregistrés dans la base locale
            du navigateur (IndexedDB + stockage local). Exporte un fichier JSON
            pour les sauvegarder ou les transférer.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE5DF] bg-[#FAFDFB] px-3 py-2 text-xs font-semibold text-[#14231C] transition-colors hover:bg-[#EDF3EF] dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:hover:bg-[#1D2B23] cursor-pointer"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Exporter
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE5DF] bg-[#FAFDFB] px-3 py-2 text-xs font-semibold text-[#14231C] transition-colors hover:bg-[#EDF3EF] dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:hover:bg-[#1D2B23] cursor-pointer"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Importer
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </div>

          {backupStatus && (
            <p
              role="status"
              className={`mt-2.5 text-xs font-medium ${
                backupStatus.isError
                  ? 'text-[#C63B31] dark:text-[#FCA5A5]'
                  : 'text-[#0B7B54] dark:text-[#34D399]'
              }`}
            >
              {backupStatus.text}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
