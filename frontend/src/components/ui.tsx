import { ReactNode } from 'react';
import { t } from '../i18n';

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-8 w-8 rounded-full border-4 border-slate-300 border-t-brand animate-spin" />
    </div>
  );
}

export function ErrorMsg({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : t.app.unknownError;
  return <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{msg}</div>;
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 text-2xl leading-none px-2">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CategoryChip({ category }: { category: string }) {
  const styles: Record<string, string> = {
    ruoka: 'bg-amber-100 text-amber-800',
    tavara: 'bg-sky-100 text-sky-800',
    kaluste: 'bg-violet-100 text-violet-800',
  };
  return (
    <span className={`chip ${styles[category] ?? 'bg-slate-100 text-slate-700'}`}>
      {t.categoriesShort[category]}
    </span>
  );
}
