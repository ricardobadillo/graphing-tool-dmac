import { parseComplex } from '../complex/complex';

/** Entero gaussiano a + bi, con a, b ∈ ℤ. */
export interface GaussianInteger {
  re: number;
  im: number;
}

export interface ParsedGaussian {
  value: GaussianInteger | null;
  error: string | null;
}

export type GaussianKind = 'zero' | 'unit' | 'prime' | 'composite';

export interface GaussianQuotient {
  /** Cociente exacto cuando w divide a z dentro de ℤ[i]. */
  value: GaussianInteger | null;
  exact: boolean;
  numeratorRe: number;
  numeratorIm: number;
  denominator: number;
}

export interface GcdStep {
  dividend: GaussianInteger;
  divisor: GaussianInteger;
  quotient: GaussianInteger;
  remainder: GaussianInteger;
}

export interface GcdResult {
  gcd: GaussianInteger;
  steps: GcdStep[];
}

export interface Associate {
  label: string;
  value: GaussianInteger;
}

const MAX_COORDINATE = 100_000;
const EPS = 1e-9;

export const GAUSSIAN_UNITS: Associate[] = [
  { label: '1', value: { re: 1, im: 0 } },
  { label: 'i', value: { re: 0, im: 1 } },
  { label: '−1', value: { re: -1, im: 0 } },
  { label: '−i', value: { re: 0, im: -1 } },
];

export function isZero(value: GaussianInteger): boolean {
  return value.re === 0 && value.im === 0;
}

export function isUnit(value: GaussianInteger): boolean {
  return norm(value) === 1;
}

export function isSafe(value: GaussianInteger): boolean {
  return Number.isSafeInteger(value.re) && Number.isSafeInteger(value.im);
}

export function addGaussian(a: GaussianInteger, b: GaussianInteger): GaussianInteger {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function subtractGaussian(a: GaussianInteger, b: GaussianInteger): GaussianInteger {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function multiplyGaussian(a: GaussianInteger, b: GaussianInteger): GaussianInteger {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function conjugateGaussian(value: GaussianInteger): GaussianInteger {
  return { re: value.re, im: -value.im };
}

/** Multiplica por i: rotación de 90°. */
export function rotateGaussian(value: GaussianInteger): GaussianInteger {
  return { re: -value.im, im: value.re };
}

export function negateGaussian(value: GaussianInteger): GaussianInteger {
  return { re: -value.re, im: -value.im };
}

/** Norma N(a + bi) = a² + b². */
export function norm(value: GaussianInteger): number {
  return value.re * value.re + value.im * value.im;
}

export function parseGaussian(text: string): ParsedGaussian {
  const parsed = parseComplex(text);

  if (parsed.error || !parsed.value) {
    return {
      value: null,
      error: 'Escribe un entero gaussiano, por ejemplo 3 + 4i o −2 + i.',
    };
  }

  const re = Math.round(parsed.value.re);
  const im = Math.round(parsed.value.im);

  if (Math.abs(parsed.value.re - re) > EPS || Math.abs(parsed.value.im - im) > EPS) {
    return {
      value: null,
      error: 'No pertenece a ℤ[i]: las partes real e imaginaria deben ser enteras.',
    };
  }

  if (
    !Number.isSafeInteger(re) ||
    !Number.isSafeInteger(im) ||
    Math.abs(re) > MAX_COORDINATE ||
    Math.abs(im) > MAX_COORDINATE
  ) {
    return {
      value: null,
      error: `Usa coordenadas enteras entre −${MAX_COORDINATE} y ${MAX_COORDINATE}.`,
    };
  }

  return { value: { re, im }, error: null };
}

export function powerGaussian(value: GaussianInteger, exponent: number): GaussianInteger | null {
  const n = Math.floor(exponent);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }

  let result: GaussianInteger = { re: 1, im: 0 };
  for (let index = 0; index < n; index += 1) {
    result = multiplyGaussian(result, value);
    if (!isSafe(result)) {
      return null;
    }
  }
  return result;
}

/**
 * Cociente en ℚ[i]: z / w = z·conj(w) / N(w).
 * Es exacto en ℤ[i] cuando N(w) divide a ambas componentes del numerador.
 */
export function divideGaussian(a: GaussianInteger, b: GaussianInteger): GaussianQuotient {
  const denominator = norm(b);
  if (denominator === 0) {
    return {
      value: null,
      exact: false,
      numeratorRe: Number.NaN,
      numeratorIm: Number.NaN,
      denominator: 0,
    };
  }

  const numeratorRe = a.re * b.re + a.im * b.im;
  const numeratorIm = a.im * b.re - a.re * b.im;
  const exact = numeratorRe % denominator === 0 && numeratorIm % denominator === 0;

  return {
    value: exact ? { re: numeratorRe / denominator, im: numeratorIm / denominator } : null,
    exact,
    numeratorRe,
    numeratorIm,
    denominator,
  };
}

export function isRationalPrime(value: number): boolean {
  if (!Number.isInteger(value) || value < 2) {
    return false;
  }
  if (value === 2) {
    return true;
  }
  if (value % 2 === 0) {
    return false;
  }
  for (let divisor = 3; divisor * divisor <= value; divisor += 2) {
    if (value % divisor === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Primalidad gaussiana:
 * - si a = 0 o b = 0, |a + bi| debe ser primo y ≡ 3 (mod 4);
 * - si a y b no son cero, N(z) debe ser primo.
 */
export function isGaussianPrime(value: GaussianInteger): boolean {
  if (isZero(value) || isUnit(value)) {
    return false;
  }

  if (value.re === 0 || value.im === 0) {
    const magnitude = Math.abs(value.re === 0 ? value.im : value.re);
    return magnitude % 4 === 3 && isRationalPrime(magnitude);
  }

  return isRationalPrime(norm(value));
}

export function gaussianKind(value: GaussianInteger): GaussianKind {
  if (isZero(value)) {
    return 'zero';
  }
  if (isUnit(value)) {
    return 'unit';
  }
  return isGaussianPrime(value) ? 'prime' : 'composite';
}

export function describeGaussianKind(value: GaussianInteger): string {
  switch (gaussianKind(value)) {
    case 'zero':
      return 'Cero';
    case 'unit':
      return 'Unidad';
    case 'prime':
      return 'Primo';
    case 'composite':
      return 'Compuesto';
  }
}

/** Asociados de z: z, iz, −z, −iz (se omiten duplicados, como en z = 0). */
export function associatesOf(value: GaussianInteger): Associate[] {
  const candidates: Associate[] = [
    { label: 'z', value },
    { label: 'iz', value: rotateGaussian(value) },
    { label: '−z', value: negateGaussian(value) },
    { label: '−iz', value: negateGaussian(rotateGaussian(value)) },
  ];

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.value.re},${candidate.value.im}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Algoritmo de Euclides en ℤ[i] usando la norma como función euclídea.
 * El cociente se redondea componente a componente al entero gaussiano más cercano.
 */
export function gcdGaussian(a: GaussianInteger, b: GaussianInteger): GcdResult {
  let dividend = a;
  let divisor = b;
  const steps: GcdStep[] = [];

  for (let guard = 0; guard < 128 && !isZero(divisor); guard += 1) {
    const quotient = nearestQuotient(dividend, divisor);
    const remainder = subtractGaussian(dividend, multiplyGaussian(quotient, divisor));
    steps.push({ dividend, divisor, quotient, remainder });
    dividend = divisor;
    divisor = remainder;
  }

  return {
    gcd: normalizeAssociate(dividend),
    steps,
  };
}

function nearestQuotient(a: GaussianInteger, b: GaussianInteger): GaussianInteger {
  const denominator = norm(b);
  if (denominator === 0) {
    return { re: 0, im: 0 };
  }
  return {
    re: Math.round((a.re * b.re + a.im * b.im) / denominator),
    im: Math.round((a.im * b.re - a.re * b.im) / denominator),
  };
}

/** Elige el asociado con parte real positiva y parte imaginaria no negativa. */
function normalizeAssociate(value: GaussianInteger): GaussianInteger {
  if (isZero(value)) {
    return { re: 0, im: 0 };
  }

  const candidates = [
    value,
    rotateGaussian(value),
    negateGaussian(value),
    negateGaussian(rotateGaussian(value)),
  ];

  return (
    candidates.find((candidate) => candidate.re > 0 && candidate.im >= 0) ??
    candidates.find((candidate) => candidate.re > 0) ??
    value
  );
}

export function formatGaussian(value: GaussianInteger): string {
  const real = value.re;
  const imaginary = value.im;

  if (imaginary === 0) {
    return withUnicodeMinus(String(real));
  }

  if (real === 0) {
    if (imaginary === 1) {
      return 'i';
    }
    if (imaginary === -1) {
      return '−i';
    }
    return `${withUnicodeMinus(String(imaginary))}i`;
  }

  const sign = imaginary < 0 ? '−' : '+';
  const magnitude = Math.abs(imaginary);
  return `${withUnicodeMinus(String(real))} ${sign} ${magnitude === 1 ? 'i' : `${magnitude}i`}`;
}

/** Cociente racional z/w en forma de fracciones reducidas. */
export function formatRationalQuotient(quotient: GaussianQuotient): string {
  if (!Number.isFinite(quotient.numeratorRe) || quotient.denominator === 0) {
    return '—';
  }

  const real = fraction(quotient.numeratorRe, quotient.denominator);
  const imaginary = fraction(quotient.numeratorIm, quotient.denominator);

  if (quotient.numeratorIm === 0) {
    return real;
  }
  if (quotient.numeratorRe === 0) {
    return imaginary === '1' ? 'i' : imaginary === '−1' ? '−i' : `${imaginary}i`;
  }

  const negative = quotient.numeratorIm < 0;
  const magnitude = negative ? imaginary.slice(1) : imaginary;
  return `${real} ${negative ? '−' : '+'} ${magnitude === '1' ? 'i' : `${magnitude}i`}`;
}

function fraction(numerator: number, denominator: number): string {
  if (numerator === 0) {
    return '0';
  }
  const sign = numerator < 0 ? '−' : '';
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
  const top = Math.abs(numerator) / divisor;
  const bottom = Math.abs(denominator) / divisor;
  return bottom === 1 ? `${sign}${top}` : `${sign}${top}/${bottom}`;
}

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x || 1;
}

function withUnicodeMinus(text: string): string {
  return text.replace(/-/g, '−');
}
