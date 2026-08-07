/** @type {import('tailwindcss').Config} */

// Semanttiset värit tulevat CSS-muuttujista (ks. src/index.css). Muuttujat
// sisältävät RGB-kanavat ilman rgb()-kääreen, jotta Tailwindin
// läpinäkyvyysmerkintä (esim. bg-brand/20) toimii myös näillä väreillä.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Pinnat ja tekstit — vaihtuvat teeman mukana, älä käytä slate-*-värejä
        // uudessa koodissa. Ks. DESIGN.md.
        app: token('--c-bg'),
        surface: {
          DEFAULT: token('--c-surface'),
          2: token('--c-surface-2'),
        },
        line: {
          DEFAULT: token('--c-line'),
          strong: token('--c-line-strong'),
        },
        fg: {
          DEFAULT: token('--c-fg'),
          muted: token('--c-fg-muted'),
          subtle: token('--c-fg-subtle'),
        },
        brand: {
          DEFAULT: token('--c-brand'),
          // Teksti/ikoni brand-täytön päällä (valkoinen molemmissa teemoissa).
          fg: token('--c-brand-fg'),
          // Brandin värinen teksti/ikoni tavallisella pinnalla.
          ink: token('--c-brand-ink'),
          dark: token('--c-brand-hover'),
          // Sävypinta (aktiivinen navilinkki, merkit). Valmiiksi sekoitettu
          // väri, ei /10-läpinäkyvyys: tumma violetti katoaa lähes mustaan.
          soft: token('--c-brand-soft'),
        },
        // Teal-tehoste (Assemblyn liukuvärin toinen pää).
        accent: {
          DEFAULT: token('--c-accent'),
          ink: token('--c-accent-ink'),
          soft: token('--c-accent-soft'),
        },
      },
      fontSize: {
        // Tiheämpi perusrivi listoille ja lomakkeille.
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        // Vähimmäiskosketusala mobiilissa (44px) ilman leveää paddingia.
        touch: '2.75rem',
      },
    },
  },
  plugins: [],
};
