// Numeroiden ja kaksoisyksikön muotoilu suomeksi.

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  // Näytä enintään 3 desimaalia, poista turhat nollat, pilkku desimaalierottimena.
  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toLocaleString('fi-FI', { maximumFractionDigits: 3 });
}

// "12 pkt (2,0 kg)" jos pack_size, muuten "12 pkt".
export function fmtQty(
  qty: number,
  unit: string,
  packSize?: number | null,
  packUnit?: string | null
): string {
  const base = `${fmtNum(qty)} ${unit}`;
  if (packSize && packUnit) {
    return `${base} (${fmtNum(qty * packSize)} ${packUnit})`;
  }
  return base;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fi-FI', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fi-FI', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Etumerkki lokinäkymään.
export function typeSign(type: string): '+' | '−' | '' {
  if (type === 'lisays' || type === 'palautus') return '+';
  if (type === 'vienti' || type === 'kulutus') return '−';
  return '';
}
