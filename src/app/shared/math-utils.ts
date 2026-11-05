/** Utilidades numéricas compartidas por los exploradores. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Devuelve un paso "bonito" (1, 2 o 5 × 10^n) cercano al objetivo. */
export function niceStep(target: number): number {
  const raw = Math.max(target, Number.MIN_VALUE);
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const factor = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return factor * power;
}

/** Generador pseudoaleatorio determinista (mulberry32). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Formatea un número con un número fijo de decimales y notación científica compacta. */
export function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const cleaned = Math.abs(value) < 1e-9 ? 0 : value;
  if (cleaned !== 0 && (Math.abs(cleaned) >= 100_000 || Math.abs(cleaned) < 0.0001)) {
    return cleaned.toExponential(2).replace('e+', 'e');
  }
  let text = cleaned.toFixed(digits);
  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return text === '' || text === '-0' ? '0' : text;
}

/** Variante para resultados de cálculo: más decimales y guion largo para NaN. */
export function formatCalc(value: number, digits = 4): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (value !== 0 && (Math.abs(value) >= 100_000 || Math.abs(value) < 0.0001)) {
    return value.toExponential(2).replace('e+', 'e');
  }
  let text = value.toFixed(digits);
  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return text === '' || text === '-0' ? '0' : text;
}
