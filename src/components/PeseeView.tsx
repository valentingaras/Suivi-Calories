import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { WeightEntry } from '../types/nutrition';
import {
  formatDecimalFr,
  formatShortDate,
  parseNum,
  todayKey,
} from '../utils/nutrition';

interface PeseeViewProps {
  weights: WeightEntry[];
  onAddWeight: (date: string, weight: number) => void;
  onDeleteWeight: (date: string) => void;
}

export function PeseeView({
  weights,
  onAddWeight,
  onDeleteWeight,
}: PeseeViewProps) {
  const today = todayKey();
  const [weightInput, setWeightInput] = useState('');
  const [dateInput, setDateInput] = useState(today);
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const sorted = useMemo(
    () => [...weights].sort((a, b) => (a.d < b.d ? -1 : 1)),
    [weights]
  );

  const reversed = useMemo(() => [...sorted].reverse(), [sorted]);

  const handleAdd = () => {
    const w = parseNum(weightInput);
    const d = dateInput || today;
    if (!(w >= 30 && w <= 300)) {
      setStatusMsg({
        text: 'Entre un poids en kg (entre 30 et 300).',
        isError: true,
      });
      return;
    }
    if (d > today) {
      setStatusMsg({
        text: 'La date ne peut pas être dans le futur.',
        isError: true,
      });
      return;
    }
    onAddWeight(d, w);
    setWeightInput('');
    setStatusMsg({ text: 'Pesée enregistrée.', isError: false });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] lg:col-span-5 dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
        <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
          Nouvelle pesée
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="weight-input"
              className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
            >
              Poids (kg)
            </label>
            <input
              id="weight-input"
              type="text"
              inputMode="decimal"
              placeholder="75,0"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 py-2.5 text-sm font-medium tabular-nums text-[#14231C] placeholder:text-[#8A9B91] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:placeholder:text-[#6B7E73] dark:focus:border-[#34D399]"
            />
          </div>
          <div>
            <label
              htmlFor="weight-date"
              className="mb-1.5 block text-xs font-medium text-[#52655B] dark:text-[#98ABA0]"
            >
              Date
            </label>
            <input
              id="weight-date"
              type="date"
              max={today}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-[#FAFDFB] px-3.5 py-2.5 text-sm font-medium text-[#14231C] focus:border-[#0D9464] focus:bg-white focus:outline-none dark:border-[#2C3C32] dark:bg-[#111A15] dark:text-[#EAF2ED] dark:focus:border-[#34D399]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D9464] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0A7A52] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Enregistrer la pesée
        </button>

        {statusMsg && (
          <p
            role="status"
            className={`mt-2.5 text-sm font-medium ${
              statusMsg.isError
                ? 'text-[#C63B31] dark:text-[#FCA5A5]'
                : 'text-[#0B7B54] dark:text-[#34D399]'
            }`}
          >
            {statusMsg.text}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] lg:col-span-7 dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
        <h2 className="mb-3 text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
          Historique des pesées
        </h2>

        {reversed.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#DCE5DF] bg-[#FAFDFB] px-4 py-8 text-center dark:border-[#28372E] dark:bg-[#121B16]">
            <p className="text-sm text-[#5B6E64] dark:text-[#98ABA0]">
              Aucune pesée pour l’instant.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#EDF2EE] dark:divide-[#233229]">
            {reversed.map((x) => (
              <li
                key={x.d}
                className="flex min-h-[56px] items-center justify-between gap-3 py-2.5"
              >
                <div>
                  <span className="block text-sm font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED]">
                    {formatDecimalFr(x.w)} kg
                  </span>
                  <span className="block text-xs text-[#5B6E64] dark:text-[#98ABA0]">
                    {formatShortDate(x.d)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteWeight(x.d)}
                  aria-label={`Supprimer la pesée du ${formatShortDate(x.d)}`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#5B6E64] transition-colors hover:bg-[#FEECEC] hover:text-[#C63B31] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:text-[#98ABA0] dark:hover:bg-[#3A1B1A] dark:hover:text-[#FCA5A5] cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Supprimer</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
