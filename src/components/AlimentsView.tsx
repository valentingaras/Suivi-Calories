import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Globe, Plus, Search, Upload } from 'lucide-react';
import type { Food } from '../types/nutrition';
import { normText, parseFoodsCsv } from '../utils/nutrition';

interface AlimentsViewProps {
  foods: Food[];
  onNewFood: () => void;
  onSearchOnline: () => void;
  onSelectFood: (food: Food) => void;
  onImportCsvFoods: (importedFoods: Food[]) => number;
}

export function AlimentsView({
  foods,
  onNewFood,
  onSearchOnline,
  onSelectFood,
  onImportCsvFoods,
}: AlimentsViewProps) {
  const [query, setQuery] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = normText(query.trim());
    return [...foods]
      .sort((a, b) => a.n.localeCompare(b.n, 'fr'))
      .filter((f) => !q || normText(f.n).includes(q));
  }, [foods, query]);

  const handleCsvFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseFoodsCsv(text);
      if (parsed.length === 0) {
        setImportStatus('Aucun aliment valide trouvé dans ce fichier CSV.');
      } else {
        const addedCount = onImportCsvFoods(parsed);
        setImportStatus(
          addedCount > 0
            ? `${addedCount} nouvel${addedCount > 1 ? 's' : ''} aliment${
                addedCount > 1 ? 's' : ''
              } ajouté${addedCount > 1 ? 's' : ''} (${parsed.length} lu${
                parsed.length > 1 ? 's' : ''
              }).`
            : `Tous les aliments de ce fichier (${parsed.length}) étaient déjà présents.`
        );
      }
    } catch {
      setImportStatus('Impossible de lire ce fichier CSV.');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7E73]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer les aliments…"
            aria-label="Filtrer les aliments"
            className="min-h-[44px] w-full rounded-xl border border-[#D4DFD8] bg-white pl-10 pr-4 text-sm text-[#14231C] placeholder:text-[#7D9186] focus:border-[#0D9464] focus:outline-none dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#EAF2ED] dark:placeholder:text-[#6B7E73] dark:focus:border-[#34D399]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSearchOnline}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#CBE4D6] bg-[#ECF8F1] px-3.5 py-2.5 text-sm font-semibold text-[#0B7B54] transition-colors hover:bg-[#DDF3E6] dark:border-[#214B39] dark:bg-[#153125] dark:text-[#34D399] dark:hover:bg-[#1B3D2E] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            En ligne
          </button>

          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#DCE5DF] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#3C5045] transition-colors hover:bg-[#F1F6F3] dark:border-[#2C3C32] dark:bg-[#16211B] dark:text-[#B9CBC0] dark:hover:bg-[#1E2B24] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => handleCsvFile(e.target.files?.[0])}
          />

          <button
            type="button"
            onClick={onNewFood}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#0D9464] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#0A7A52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9464] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] whitespace-nowrap shrink-0 sm:flex-initial cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouvel aliment
          </button>
        </div>
      </div>

      {importStatus && (
        <p
          role="status"
          className="text-xs font-medium text-[#0B7B54] dark:text-[#34D399]"
        >
          {importStatus}
        </p>
      )}

      <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
            Répertoire ({filtered.length})
          </h2>
          <span className="text-xs text-[#5B6E64] dark:text-[#98ABA0]">
            Valeurs pour 100 g / 100 ml
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#5B6E64] dark:text-[#98ABA0]">
            Aucun aliment ne correspond à votre recherche.
          </p>
        ) : (
          <ul className="divide-y divide-[#EDF2EE] dark:divide-[#233229]">
            {filtered.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onSelectFood(f)}
                  aria-haspopup="dialog"
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-[#F5F9F6] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0D9464] dark:hover:bg-[#1C2A22] cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#14231C] dark:text-[#EAF2ED]">
                      {f.n}
                    </span>
                    <span className="mt-0.5 block text-xs tabular-nums text-[#5B6E64] dark:text-[#98ABA0]">
                      Prot. {f.p} · Glu. {f.c} · Lip. {f.f}
                      {f.a ? ` · Alc ${f.a}` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-[#14231C] dark:text-[#EAF2ED]">
                      {f.k} kcal
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-[#7D9186]"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 border-t border-[#EDF2EE] pt-4 text-xs leading-relaxed text-[#5B6E64] dark:border-[#233229] dark:text-[#98ABA0]">
          Touche un aliment pour le modifier ou le supprimer. Valeurs pour 100 g.
          Les valeurs de départ sont indicatives : vérifie-les sur les étiquettes
          de tes produits. Alcool : grammes d’alcool pur pour 100 g (1 dose = 10 g)
          ; pour une boisson, saisis les ml comme des grammes.
        </p>
      </section>
    </div>
  );
}
