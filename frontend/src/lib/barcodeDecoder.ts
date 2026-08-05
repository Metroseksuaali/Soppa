// Viivakoodin purku selaimissa joissa ei ole omaa BarcodeDetectoria (iOS-Safari, Firefox).
//
// zxing-wasm on ZXing-kirjasto WebAssemblyna: se ei nojaa selaimen tai käyttöjärjestelmän
// tukeen lainkaan, joten sama koodi luetaan iPhonessa kuin Androidissa. Hinta on ~1 Mt
// wasm-tiedostoa, joten:
//
//   1. Moduuli ladataan **dynaamisesti** vasta kun skanneri avataan selaimessa jossa
//      natiivilukijaa ei ole. Android-käyttäjä ei lataa tästä tavuakaan.
//   2. Wasm tarjoillaan **omasta palvelimesta** (Vite emittoi sen assetiksi) — ei CDN:ää.
//      Sovellus on kirjautumisen takana eikä siitä saa syntyä ulkoista riippuvuutta.

import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

type ReaderModule = typeof import('zxing-wasm/reader');

// Kaupan pakkauksissa käytetyt muodot; sama lista kuin natiivilukijalla.
const FORMATS = ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128', 'Code39', 'ITF'] as const;

let readerPromise: Promise<ReaderModule> | null = null;

function loadReader(): Promise<ReaderModule> {
  if (!readerPromise) {
    readerPromise = import('zxing-wasm/reader').then((mod) => {
      mod.prepareZXingModule({
        overrides: {
          locateFile: (path: string, prefix: string) =>
            path.endsWith('.wasm') ? wasmUrl : prefix + path,
        },
      });
      return mod;
    });
    // Epäonnistunutta latausta ei jätetä välimuistiin — seuraava yritys saa yrittää uudelleen.
    readerPromise.catch(() => {
      readerPromise = null;
    });
  }
  return readerPromise;
}

/** Lataa lukijan etukäteen (kutsutaan kun skanneri avataan), jotta ensimmäinen ruutu ei odota. */
export async function prewarmDecoder(): Promise<void> {
  await loadReader();
}

/**
 * Etsi viivakoodi yhdestä kuvaruudusta. Palauttaa koodin tai null.
 * tryHarder = false pitää yhden ruudun käsittelyn kymmenissä millisekunneissa, mikä riittää
 * kun ruutuja tulee neljä sekunnissa — tarkkuus tulee toistoista, ei yhdestä yrityksestä.
 */
export async function decodeImageData(image: ImageData): Promise<string | null> {
  const { readBarcodes } = await loadReader();
  const results = await readBarcodes(image, {
    formats: [...FORMATS],
    tryHarder: false,
    maxNumberOfSymbols: 1,
  });
  const hit = results.find((r) => r.text);
  return hit?.text.trim() || null;
}
