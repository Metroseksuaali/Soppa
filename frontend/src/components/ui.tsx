import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { t } from '../i18n';

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-7 w-7 rounded-full border-[3px] border-line border-t-brand animate-spin" />
    </div>
  );
}

export function ErrorMsg({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : t.app.unknownError;
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
      {msg}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full sm:max-w-md bg-surface border-t sm:border border-line rounded-t-2xl sm:rounded-xl p-4 pb-safe sm:pb-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-bold text-fg">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t.common.close}
            className="-mr-1 inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Kirjaustyypin väri — yksi lähde, jotta sama kirjaustyyppi on samanvärinen
// joka näkymässä. Väri kertoo mitä kirjaus tekee saldolle; ks. DESIGN.md
// "Värin merkitys". Käyttäjä nyt: Kirjaa-sivun toimintovalitsin ja otsikko.
export const movementStyle: Record<string, { bg: string; ink: string }> = {
  lisays: { bg: 'bg-emerald-500/10', ink: 'text-emerald-700 dark:text-emerald-300' },
  vienti: { bg: 'bg-sky-500/10', ink: 'text-sky-700 dark:text-sky-300' },
  palautus: { bg: 'bg-indigo-500/10', ink: 'text-indigo-700 dark:text-indigo-300' },
  kulutus: { bg: 'bg-rose-500/10', ink: 'text-rose-700 dark:text-rose-300' },
  inventointi: { bg: 'bg-amber-500/10', ink: 'text-amber-700 dark:text-amber-300' },
};

export function CategoryChip({ category }: { category: string }) {
  const styles: Record<string, string> = {
    ruoka: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    tavara: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    kaluste: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  };
  return (
    <span className={`chip ${styles[category] ?? 'bg-surface-2 text-fg-muted'}`}>
      {t.categoriesShort[category]}
    </span>
  );
}
