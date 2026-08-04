// Kuvan pienennys ja pakkaus selaimessa ennen lähetystä.
//
// Puhelimen kamerasta tuleva kuva on tyypillisesti 3–8 Mt. Sellaisenaan tallennettuna
// muutama sata tuotetta veisi gigatavuja, joten kuva pienennetään aina asiakaspuolella:
//
//   • näyttökuva  — pitkä sivu enintään 1024 px, tavoite alle ~180 kt
//   • pikkukuva   — pitkä sivu 256 px, tavoite alle ~25 kt (listojen nopeaan lataukseen)
//
// Käytännössä tuotekuva vie ~80–150 kt, eli 500 tuotetta ≈ 70 Mt tietokannassa.
// Backend hylkää tätä isommat (routes/items.ts) — asiakaspuolen pakkaus ei ole suoja.
//
// Muoto: WebP jos selain osaa koodata sen (~30 % pienempi), muuten JPEG.

const MAIN_MAX_EDGE = 1024;
const MAIN_TARGET_BYTES = 180_000;
const THUMB_MAX_EDGE = 256;
const THUMB_TARGET_BYTES = 25_000;

// Laskeva sarja yrityksiä: löyhennetään ensin laatua, sitten resoluutiota.
const MAIN_ATTEMPTS = [
  { maxEdge: MAIN_MAX_EDGE, quality: 0.72 },
  { maxEdge: MAIN_MAX_EDGE, quality: 0.6 },
  { maxEdge: 800, quality: 0.6 },
  { maxEdge: 640, quality: 0.5 },
];

export interface PreparedPhoto {
  mime: string;
  data: string; // base64 ilman data:-etuliitettä
  thumb: string;
  width: number;
  height: number;
  bytes: number; // näyttökuvan koko tavuina (UI:n palautetta varten)
}

// Osaako selain koodata WebP:iä canvasista? Vastaus välimuistiin — testi on synkroninen.
let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport === null) {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpSupport;
}

// Dekoodaa tiedosto bittikartaksi. imageOrientation huolehtii siitä että puhelimen
// EXIF-kiertotieto otetaan huomioon — muuten kuva olisi kyljellään.
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Vanhempi selain: <img> soveltaa EXIF-kierron itse renderöidessään.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Kuvaa ei voitu lukea'));
        img.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function sizeOf(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return src instanceof HTMLImageElement
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height };
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Kuvan pakkaus epäonnistui'))),
      mime,
      quality
    );
  });
}

// Skaalaa kuva niin että pitkä sivu on enintään maxEdge, ja pakkaa se.
async function render(
  src: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  mime: string,
  quality: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const { w, h } = sizeOf(src);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const width = Math.max(1, Math.round(w * scale));
  const height = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas ei käytettävissä');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src as CanvasImageSource, 0, 0, width, height);

  return { blob: await toBlob(canvas, mime, quality), width, height };
}

// Blob → base64 (ilman "data:...;base64," -etuliitettä).
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Kuvan luku epäonnistui'));
    reader.readAsDataURL(blob);
  });
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Tiedosto ei ole kuva');

  const mime = supportsWebp() ? 'image/webp' : 'image/jpeg';
  const src = await decode(file);

  try {
    // Näyttökuva: kokeile laatuja kunnes tavoitekoko alittuu (tai vaihtoehdot loppuvat).
    let main = await render(src, MAIN_ATTEMPTS[0].maxEdge, mime, MAIN_ATTEMPTS[0].quality);
    for (let i = 1; i < MAIN_ATTEMPTS.length && main.blob.size > MAIN_TARGET_BYTES; i++) {
      main = await render(src, MAIN_ATTEMPTS[i].maxEdge, mime, MAIN_ATTEMPTS[i].quality);
    }

    let thumb = await render(src, THUMB_MAX_EDGE, mime, 0.6);
    if (thumb.blob.size > THUMB_TARGET_BYTES) {
      thumb = await render(src, THUMB_MAX_EDGE, mime, 0.45);
    }

    const [data, thumbData] = await Promise.all([toBase64(main.blob), toBase64(thumb.blob)]);
    return {
      mime,
      data,
      thumb: thumbData,
      width: main.width,
      height: main.height,
      bytes: main.blob.size,
    };
  } finally {
    if (!(src instanceof HTMLImageElement)) src.close();
  }
}

// "142 kt" — kuvan koon näyttö käyttäjälle.
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} t`;
  return `${Math.round(bytes / 1024)} kt`;
}
