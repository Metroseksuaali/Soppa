// Viivakoodin luku puhelimen kameralla + käsin syöttö.
//
// Kaksi lukumoottoria, sama käyttöliittymä:
//
//   1. Selaimen oma `BarcodeDetector` (Android Chrome). Nopea, ei latauksia — käytetään
//      aina kun se löytyy.
//   2. zxing-wasm ([lib/barcodeDecoder.ts]) niissä selaimissa joissa sitä ei ole:
//      iOS:n Safari ja Firefox. iPhonessa *kaikki* selaimet ovat WebKitiä, joten tämä on
//      ainoa tapa saada kameraluku toimimaan siellä. Lataus (~1 Mt) tapahtuu vasta kun
//      skanneri avataan tällaisessa selaimessa.
//
// Käsin syöttö on aina näkyvissä: se on nopein tapa kun koodi on kulunut tai valo on huono,
// ja se kattaa myös näppäimistöä matkivat käsiskannerit (Enter lähettää).
//
// Skanneri ei kirjaa mitään: se palauttaa luetun koodin, ja kutsuja päättää mitä tehdään.

import { useEffect, useRef, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import { Modal } from './ui';
import { decodeImageData, prewarmDecoder } from '../lib/barcodeDecoder';
import { t } from '../i18n';

// BarcodeDetector puuttuu TypeScriptin DOM-tyypeistä — minimimääritys tähän käyttöön.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
}

// Kaupan pakkauksissa käytetyt muodot. Rajaus nopeuttaa tunnistusta ja vähentää vääriä
// osumia (esim. QR-koodi julisteessa kameran taustalla).
const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

// Wasm-purkuun riittää ~800 px leveä ruutu: pienempi olisi nopeampi mutta kapeat viivat
// alkavat sekoittua, isompi maksaa aikaa antamatta tarkkuutta.
const DECODE_WIDTH = 800;

function detectorCtor(): BarcodeDetectorCtor | null {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

/** Onko kameralukua ylipäätään saatavilla? Wasm-varalukija toimii kaikkialla, joten
 *  ratkaisevaa on vain pääseekö kameraan käsiksi. */
export function barcodeCameraSupported(): boolean {
  return !!navigator.mediaDevices?.getUserMedia;
}

/** Skannausnappi, joka avaa lukijan. onDetect saa luetun koodin ja ikkuna sulkeutuu. */
export function ScanButton({
  onDetect,
  className = 'btn-secondary px-3',
  label,
}: {
  onDetect: (code: string) => void;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        aria-label={t.barcode.scan}
        title={t.barcode.scan}
      >
        <ScanBarcode className="w-5 h-5" />
        {label && <span className="ml-1 text-sm">{label}</span>}
      </button>
      <BarcodeScanner
        open={open}
        onClose={() => setOpen(false)}
        onDetect={(code) => {
          setOpen(false);
          onDetect(code);
        }}
      />
    </>
  );
}

export function BarcodeScanner({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'live'>('idle');
  const [manual, setManual] = useState('');

  const cameraSupported = barcodeCameraSupported();

  // Skannaussilmukka elää yli renderöintien, joten kutsutaan aina tuoreinta callbackia
  // (esim. Kirjaa-näkymän käsittelijä tuntee juuri ladatun tuotelistan).
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  useEffect(() => {
    if (!open || !cameraSupported) return;

    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let cancelled = false;
    let canvas: HTMLCanvasElement | null = null;

    // Palauttaa funktion joka etsii koodin yhdestä videoruudusta.
    async function buildDetector(): Promise<(v: HTMLVideoElement) => Promise<string | null>> {
      const Ctor = detectorCtor();
      if (Ctor) {
        // Pyydä vain ne muodot jotka selain oikeasti tukee — tuntematon muoto heittää.
        const supported = (await Ctor.getSupportedFormats?.()) ?? [];
        const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
        const detector = new Ctor(formats.length ? { formats } : undefined);
        return async (v) => {
          const found = await detector.detect(v);
          return found.find((b) => b.rawValue)?.rawValue?.trim() ?? null;
        };
      }

      // Ei natiivilukijaa (iOS-Safari, Firefox) → ladataan wasm-lukija.
      setPhase('loading');
      await prewarmDecoder();
      return async (v) => {
        const scale = Math.min(1, DECODE_WIDTH / v.videoWidth);
        const w = Math.round(v.videoWidth * scale);
        const h = Math.round(v.videoHeight * scale);
        if (!canvas) canvas = document.createElement('canvas');
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(v, 0, 0, w, h);
        return decodeImageData(ctx.getImageData(0, 0, w, h));
      };
    }

    async function start() {
      try {
        if (!window.isSecureContext) {
          setError(t.barcode.insecure);
          return;
        }

        let detect: (v: HTMLVideoElement) => Promise<string | null>;
        try {
          detect = await buildDetector();
        } catch {
          setError(t.barcode.decoderFailed);
          return;
        }
        if (cancelled) return;

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        const video = videoRef.current;
        if (cancelled || !video) return;
        video.srcObject = stream;
        await video.play();
        setPhase('live');

        // Neljä ruutua sekunnissa riittää hyvin; tiheämpi vain kuumentaa puhelinta.
        let busy = false;
        timer = window.setInterval(async () => {
          if (busy || cancelled) return;
          const v = videoRef.current;
          if (!v || v.readyState < 2 || !v.videoWidth) return;
          busy = true;
          try {
            const code = await detect(v);
            if (code && !cancelled) {
              navigator.vibrate?.(60);
              onDetectRef.current(code);
            }
          } catch {
            // Yksittäinen ruutu voi epäonnistua (kamera kesken vaihdon) — jatketaan.
          } finally {
            busy = false;
          }
        }, 250);
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (name === 'NotFoundError' || name === 'OverconstrainedError') setError(t.barcode.noCamera);
        else setError(t.barcode.denied);
      }
    }
    start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      setPhase('idle');
      setError(null);
    };
  }, [open, cameraSupported]);

  if (!open) return null;

  function submitManual() {
    const code = manual.trim();
    if (!code) return;
    setManual('');
    onDetectRef.current(code);
  }

  return (
    <Modal open={open} onClose={onClose} title={t.barcode.scanTitle}>
      <div className="space-y-3">
        {cameraSupported ? (
          <>
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
              {/* Kohdistusviiva: kertoo mihin koodi asetetaan. */}
              {phase === 'live' && (
                <div className="absolute inset-x-6 top-1/2 h-0.5 bg-red-500/80 rounded-full" />
              )}
              {phase !== 'live' && !error && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm px-6 text-center">
                  {phase === 'loading' ? t.barcode.loadingDecoder : t.barcode.starting}
                </div>
              )}
            </div>
            {!error && <p className="text-xs text-fg-subtle">{t.barcode.aim}</p>}
          </>
        ) : (
          <p className="text-sm text-fg-muted">{t.barcode.noCameraApi}</p>
        )}

        {error && (
          <div className="rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm">{error}</div>
        )}

        <div>
          <label className="label">{t.barcode.manualLabel}</label>
          <div className="flex gap-2">
            <input
              className="input"
              inputMode="numeric"
              autoFocus={!cameraSupported}
              placeholder={t.barcode.manualPlaceholder}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                // Enter kattaa myös näppäimistöä matkivat käsiskannerit.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitManual();
                }
              }}
            />
            <button className="btn-primary px-4" disabled={!manual.trim()} onClick={submitManual}>
              {t.barcode.manualSubmit}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
