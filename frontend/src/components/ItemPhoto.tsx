// Tuotekuvan näyttö ja ottaminen.
//
// Kuva pienennetään aina selaimessa ennen lähetystä (lib/image.ts), joten
// puhelimen 5 Mt:n kamerakuvasta tallentuu ~100 kt.

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, photoUrl, Item } from '../api';
import { preparePhoto, fmtBytes } from '../lib/image';
import { ErrorMsg } from './ui';
import { Camera, ImagePlus, ImageOff, Trash2, X } from 'lucide-react';
import { t } from '../i18n';

interface Props {
  itemId: number;
  itemName: string;
  hasPhoto: boolean;
  photoUpdatedAt: string | null;
}

export function ItemPhoto({ itemId, itemName, hasPhoto, photoUpdatedAt }: Props) {
  const qc = useQueryClient();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<'processing' | 'uploading' | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['item', String(itemId)] });
    qc.invalidateQueries({ queryKey: ['items'] });
  }

  const upload = useMutation({
    mutationFn: async (file: File) => {
      setSaved(null);
      setPhase('processing');
      try {
        const photo = await preparePhoto(file);
        setPhase('uploading');
        await api.put(`/items/${itemId}/photo`, {
          data: photo.data,
          thumb: photo.thumb,
          width: photo.width,
          height: photo.height,
        });
        return photo;
      } finally {
        setPhase(null);
      }
    },
    onSuccess: (photo) => {
      setSaved(t.photo.saved(fmtBytes(photo.bytes)));
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.del(`/items/${itemId}/photo`),
    onSuccess: () => {
      setSaved(null);
      invalidate();
    },
  });

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Tyhjennä input, jotta saman tiedoston voi valita uudelleen.
    e.target.value = '';
    if (file) upload.mutate(file);
  }

  const busy = phase !== null || upload.isPending || remove.isPending;

  return (
    <div className="card p-4">
      <h2 className="font-semibold mb-2">{t.photo.title}</h2>

      {hasPhoto ? (
        <button
          type="button"
          className="block w-full"
          onClick={() => setZoom(true)}
          aria-label={t.photo.open}
        >
          <img
            src={photoUrl(itemId, photoUpdatedAt)}
            alt={t.photo.alt(itemName)}
            className="w-full max-h-72 object-contain rounded-xl bg-surface-2"
          />
        </button>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-line-strong py-8 px-4 text-center">
          <ImageOff className="w-8 h-8 mx-auto text-fg-subtle" />
          <div className="text-sm text-fg-muted mt-2">{t.photo.none}</div>
          <p className="text-xs text-fg-subtle mt-1">{t.photo.hint}</p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {/* capture="environment" avaa suoraan takakameran puhelimessa. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPick}
        />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

        <button
          className="btn-primary flex-1 py-2 text-sm"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="w-4 h-4" />
          {hasPhoto ? t.photo.replace : t.photo.take}
        </button>
        <button
          className="btn-secondary py-2 px-3 text-sm"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          aria-label={t.photo.gallery}
          title={t.photo.gallery}
        >
          <ImagePlus className="w-4 h-4" />
        </button>
        {hasPhoto && (
          <button
            className="btn-secondary py-2 px-3 text-sm text-red-600 dark:text-red-400"
            disabled={busy}
            onClick={() => {
              if (confirm(t.photo.removeConfirm)) remove.mutate();
            }}
            aria-label={t.photo.remove}
            title={t.photo.remove}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {phase && (
        <div className="mt-2 text-sm text-fg-muted">
          {phase === 'processing' ? t.photo.processing : t.photo.uploading}
        </div>
      )}
      {saved && !busy && <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{saved}</div>}
      {upload.error && <div className="mt-2"><ErrorMsg error={upload.error} /></div>}
      {remove.error && <div className="mt-2"><ErrorMsg error={remove.error} /></div>}

      {zoom && hasPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2"
          onClick={() => setZoom(false)}
        >
          <img
            src={photoUrl(itemId, photoUpdatedAt)}
            alt={t.photo.alt(itemName)}
            className="max-h-full max-w-full object-contain"
          />
          <button
            className="absolute top-3 right-3 text-white p-2"
            aria-label={t.photo.close}
            onClick={() => setZoom(false)}
          >
            <X className="w-7 h-7" />
          </button>
        </div>
      )}
    </div>
  );
}

// Listojen pikkukuva (256 px, ~15 kt). Ilman kuvaa näytetään hillitty paikanpitäjä,
// jotta rivien korkeus pysyy samana.
export function ItemThumb({
  item,
  size = 'md',
}: {
  item: Pick<Item, 'id' | 'name' | 'has_photo' | 'photo_updated_at'>;
  size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'h-9 w-9' : 'h-12 w-12';
  if (!item.has_photo) {
    return (
      <div className={`${box} shrink-0 rounded-lg bg-surface-2 flex items-center justify-center`}>
        <ImageOff className={size === 'sm' ? 'w-4 h-4 text-fg-subtle' : 'w-5 h-5 text-fg-subtle'} />
      </div>
    );
  }
  return (
    <img
      src={photoUrl(item.id, item.photo_updated_at, 'thumb')}
      alt=""
      loading="lazy"
      className={`${box} shrink-0 rounded-lg object-cover bg-surface-2`}
    />
  );
}
