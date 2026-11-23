import { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl bg-[#0D9464] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Installer</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-xl border border-[#CBE4D6] bg-[#ECF8F1] px-2.5 py-1 text-xs font-semibold text-[#0B7B54] transition-colors hover:bg-[#DDF3E6] dark:border-[#214B39] dark:bg-[#153125] dark:text-[#34D399] cursor-pointer whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Installer</span>
        </button>

        {showIOSGuide && (
          <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
        )}
      </>
    );
  }

  return null;
}

function IOSInstallModal({ onClose }: { onClose: () => void }) {
  useModalBackHandler(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#E2EAE5] bg-white p-5 shadow-xl dark:border-[#25332B] dark:bg-[#16211B]">
        <div className="flex items-start justify-between gap-2">
          <h3
            id="ios-install-title"
            className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]"
          >
            Installer sur iPhone / iPad
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5B6E64] hover:bg-[#F1F6F3] dark:text-[#98ABA0] dark:hover:bg-[#1E2B24] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="mt-3 space-y-2 text-xs leading-relaxed text-[#3C5045] dark:text-[#B9CBC0]">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ECF8F1] font-bold text-[#0D9464] dark:bg-[#163627] dark:text-[#34D399]">
              1
            </span>
            <span>
              Appuyez sur le bouton{' '}
              <strong className="inline-flex items-center gap-1 text-[#14231C] dark:text-[#EAF2ED]">
                Partager <Share className="h-3.5 w-3.5" aria-hidden="true" />
              </strong>{' '}
              dans la barre de Safari.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ECF8F1] font-bold text-[#0D9464] dark:bg-[#163627] dark:text-[#34D399]">
              2
            </span>
            <span>
              Faites défiler et choisissez{' '}
              <strong className="text-[#14231C] dark:text-[#EAF2ED]">
                Sur l’écran d’accueil
              </strong>
              .
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ECF8F1] font-bold text-[#0D9464] dark:bg-[#163627] dark:text-[#34D399]">
              3
            </span>
            <span>
              Validez avec{' '}
              <strong className="text-[#14231C] dark:text-[#EAF2ED]">
                Ajouter
              </strong>
              . L’appli fonctionnera en plein écran et hors ligne.
            </span>
          </li>
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[40px] w-full rounded-xl bg-[#0D9464] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] cursor-pointer"
        >
          Compris
        </button>
      </div>
    </div>
  );
}

export function PWASettingsSection() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <section className="rounded-2xl border border-[#E2EAE5] bg-white p-5 sm:p-6 shadow-[0_1px_3px_rgba(16,40,28,0.04)] dark:border-[#25332B] dark:bg-[#16211B] dark:shadow-none">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#14231C] dark:text-[#EAF2ED]">
          Application mobile (PWA)
        </h2>
        {isInstalled && (
          <span className="rounded-lg bg-[#ECF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#0B7B54] dark:bg-[#163627] dark:text-[#34D399]">
            Installée
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-[#5B6E64] dark:text-[#98ABA0]">
        {isInstalled
          ? 'L’application est installée sur cet appareil et reste utilisable hors ligne. Vos suivis restent stockés sur votre téléphone.'
          : 'Installez Suivi Calories sur votre smartphone pour y accéder en plein écran et hors ligne, sans passer par un store. Chaque téléphone conserve ses propres repas, pesées et objectifs.'}
      </p>

      {!isInstalled && isInstallable && (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-3.5 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D9464] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0A7A52] dark:bg-[#10B981] dark:text-[#072216] dark:hover:bg-[#34D399] cursor-pointer"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Installer sur l’écran d’accueil
        </button>
      )}

      {!isInstalled && !isInstallable && isIOS && (
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="mt-3.5 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#CBE4D6] bg-[#ECF8F1] px-4 text-sm font-semibold text-[#0B7B54] transition-colors hover:bg-[#DDF3E6] dark:border-[#214B39] dark:bg-[#153125] dark:text-[#34D399] cursor-pointer"
        >
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          Voir comment installer sur iPhone
        </button>
      )}

      {!isInstalled && !isInstallable && !isIOS && (
        <p className="mt-2.5 text-xs text-[#5B6E64] dark:text-[#98ABA0]">
          Astuce : dans le menu de Chrome / Edge (⋮), touchez{' '}
          <strong className="text-[#14231C] dark:text-[#EAF2ED]">
            Installer l’application
          </strong>{' '}
          ou{' '}
          <strong className="text-[#14231C] dark:text-[#EAF2ED]">
            Ajouter à l’écran d’accueil
          </strong>
          .
        </p>
      )}

      {showIOSGuide && (
        <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
      )}
    </section>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-3.5 z-40 flex items-center gap-2 rounded-xl border border-[#F5D08A] bg-[#FEF7E6] px-3 py-2 text-xs font-semibold text-[#8A5300] shadow-md md:bottom-4 md:left-4 dark:border-[#5C3F14] dark:bg-[#2B1F0D] dark:text-[#FCD34D]"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Hors ligne — Données locales actives</span>
    </div>
  );
}
