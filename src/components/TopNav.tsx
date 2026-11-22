import {
  BarChart3,
  BookOpen,
  Scale,
  SlidersHorizontal,
  UtensilsCrossed,
} from 'lucide-react';
import type { AppTab } from '../types/nutrition';
import { PWAInstallButton } from './PWAInstallButton';

interface TopNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  mobileLabel: string;
  Icon: typeof UtensilsCrossed;
}> = [
  { id: 'today', label: 'Repas', mobileLabel: 'Repas', Icon: UtensilsCrossed },
  { id: 'suivi', label: 'Suivi', mobileLabel: 'Suivi', Icon: BarChart3 },
  { id: 'pesee', label: 'Poids', mobileLabel: 'Poids', Icon: Scale },
  { id: 'alim', label: 'Aliments', mobileLabel: 'Aliments', Icon: BookOpen },
  { id: 'profil', label: 'Paramètres', mobileLabel: 'Param.', Icon: SlidersHorizontal },
];

export function TopNav({ activeTab, onSelectTab }: TopNavProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#E3EAE5] bg-white/95 backdrop-blur-md dark:border-[#24322A] dark:bg-[#141F19]/95">
        <div className="mx-auto flex h-13 max-w-6xl items-center justify-between gap-8 px-4 sm:h-14 sm:px-6">
          {/* Brand wordmark */}
          <button
            type="button"
            onClick={() => onSelectTab('today')}
            className="flex items-center gap-2 text-left text-base sm:text-lg font-bold tracking-tight text-[#14231C] transition-colors hover:text-[#0D9464] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0D9464] dark:text-[#EAF2ED] dark:hover:text-[#34D399] whitespace-nowrap shrink-0 font-display cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#0D9464] dark:bg-[#141F19] dark:text-[#34D399]">
              <svg
                viewBox="0 0 32 32"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  strokeWidth="1.8"
                  d="M 4.0 19.7 A 8.4 2.35 0 0 0 20.8 19.7"
                />
                <path
                  strokeWidth="1.8"
                  d="M 4.0 19.7 C 4.0 23.4 6.0 25.9 8.9 26.2 H 15.9 C 18.8 25.9 20.8 23.4 20.8 19.7"
                />
                <path
                  strokeWidth="1.65"
                  d="M 4.0 19.7 C 4.8 18.4 6.9 17.7 9.9 17.5"
                />
                <path
                  strokeWidth="1.65"
                  d="M 20.8 19.7 C 20.2 18.6 19.0 18.0 17.8 17.8"
                />
                <path strokeWidth="2.0" d="M 20.7 19.7 L 28.2 17.0" />
                <g transform="rotate(14 12.2 19.9)">
                  <path
                    strokeWidth="1.9"
                    d="M 12.3 20.0 C 12.3 20.0 5.4 15.8 5.4 11.1 A 3.65 3.65 0 0 1 12.3 8.9 A 3.65 3.65 0 0 1 19.2 11.1 C 19.2 15.8 12.3 20.0 12.3 20.0 Z"
                  />
                </g>
              </svg>
            </span>
            <span>Suivi Calories</span>
          </button>

          {/* Right side: Desktop nav + PWA install */}
          <div className="flex items-center gap-4">
            <nav
              aria-label="Navigation principale"
              className="hidden md:flex items-center gap-6 text-sm font-medium"
            >
              {NAV_ITEMS.map(({ id, label }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTab(id)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative py-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0D9464] ${
                      active
                        ? 'font-semibold text-[#0D9464] dark:text-[#34D399]'
                        : 'text-[#55685E] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
                    }`}
                  >
                    {label}
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 -bottom-[11px] h-0.5 rounded-full bg-[#0D9464] dark:bg-[#34D399]"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb-Zone Navigation */}
      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E3EAE5] bg-white/95 backdrop-blur-md md:hidden dark:border-[#24322A] dark:bg-[#141F19]/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid h-15 grid-cols-5 items-center">
          {NAV_ITEMS.map(({ id, mobileLabel, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0D9464] ${
                  active
                    ? 'text-[#0D9464] dark:text-[#34D399]'
                    : 'text-[#62756A] hover:text-[#14231C] dark:text-[#98ABA0] dark:hover:text-[#EAF2ED]'
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.8}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                  {mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
