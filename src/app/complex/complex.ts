import { evaluate } from 'mathjs/number';
import { formatFraction, formatPiFraction } from '../shared/exact-number';

export type AngleUnit = 'deg' | 'rad';

export interface Complex {
  re: number;
  im: number;
}

export interface ParsedComplex {
  value: Complex | null;
  error: string | null;
}

const EPS = 1e-9;

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function subtract(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function multiply(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function divide(a: Complex, b: Complex): Complex {
  const denominator = b.re * b.re + b.im * b.im;
  if (denominator < EPS) {
    return { re: Number.NaN, im: Number.NaN };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denominator,
    im: (a.im * b.re - a.re * b.im) / denominator,
  };
}

export function conjugate(value: Complex): Complex {
  return { re: value.re, im: -value.im };
}

export function modulus(value: Complex): number {
  return Math.hypot(value.re, value.im);
}

export function argument(value: Complex): number {
  return Math.atan2(value.im, value.re);
}

export function polarToComplex(radius: number, angle: number): Complex {
  return {
    re: radius * Math.cos(angle),
    im: radius * Math.sin(angle),
  };
}

export function power(value: Complex, exponent: number): Complex {
  if (!Number.isFinite(exponent)) {
    return { re: Number.NaN, im: Number.NaN };
  }
  if (exponent === 0) {
    return { re: 1, im: 0 };
  }
  const radius = modulus(value);
  if (radius < EPS) {
    return { re: 0, im: 0 };
  }
  return polarToComplex(radius ** exponent, argument(value) * exponent);
}

export function nthRoots(value: Complex, n: number): Complex[] {
  const count = Math.floor(n);
  if (!Number.isFinite(count) || count < 1) {
    return [];
  }

  const radius = modulus(value);
  if (radius < EPS) {
    return Array.from({ length: count }, () => ({ re: 0, im: 0 }));
  }

  const rootRadius = radius ** (1 / count);
  const base = argument(value);

  return Array.from({ length: count }, (_, index) =>
    polarToComplex(rootRadius, (base + 2 * Math.PI * index) / count),
  );
}

/** Ángulo en [0, 2π) para la forma polar. */
export function positiveAngle(angle: number): number {
  const tau = 2 * Math.PI;
  return ((angle % tau) + tau) % tau;
}

export function parseComplex(text: string, unit: AngleUnit = 'deg'): ParsedComplex {
  const source = text
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/π/g, 'pi')
    .replace(/τ/g, 'tau')
    .replace(/I/g, 'i');

  if (!source) {
    return { value: null, error: 'Escribe un número complejo.' };
  }

  try {
    const polarMatch = source.match(/^(.+?)(?:∠|cis)(.+)$/i);
    if (polarMatch) {
      let angleText = polarMatch[2];
      let angleUnit = unit;

      if (angleText.endsWith('°') || /deg$/i.test(angleText)) {
        angleUnit = 'deg';
        angleText = angleText.replace(/°$/g, '').replace(/deg$/gi, '');
      } else if (/rad$/i.test(angleText)) {
        angleUnit = 'rad';
        angleText = angleText.replace(/rad$/gi, '');
      } else if (/pi|tau/.test(angleText)) {
        angleUnit = 'rad';
      }

      let radius = evaluateNumber(polarMatch[1]);
      let angle = evaluateNumber(angleText);

      if (angleUnit === 'deg') {
        angle = (angle * Math.PI) / 180;
      }

      if (radius < 0) {
        radius = Math.abs(radius);
        angle += Math.PI;
      }

      return { value: polarToComplex(radius, angle), error: null };
    }

    if (source.endsWith('i')) {
      const body = source.slice(0, -1);

      if (body === '' || body === '+') {
        return { value: { re: 0, im: 1 }, error: null };
      }
      if (body === '-') {
        return { value: { re: 0, im: -1 }, error: null };
      }

      let split = -1;
      for (let index = body.length - 1; index > 0; index -= 1) {
        const character = body[index];
        if (
          (character === '+' || character === '-') &&
          body[index - 1] !== 'e' &&
          body[index - 1] !== 'E'
        ) {
          split = index;
          break;
        }
      }

      if (split === -1) {
        return {
          value: { re: 0, im: evaluateNumber(body) },
          error: null,
        };
      }

      const realText = body.slice(0, split);
      const imaginaryText = body.slice(split);
      const real = evaluateNumber(realText);
      const imaginary =
        imaginaryText === '+' ? 1 : imaginaryText === '-' ? -1 : evaluateNumber(imaginaryText);

      return { value: { re: real, im: imaginary }, error: null };
    }

    if (/[i]/i.test(source)) {
      return {
        value: null,
        error: 'Usa la forma a + bi, por ejemplo 3 + 4i.',
      };
    }

    return { value: { re: evaluateNumber(source), im: 0 }, error: null };
  } catch {
    return {
      value: null,
      error: 'Número complejo no válido. Prueba con 3 + 4i o 5∠60°.',
    };
  }
}

function evaluateNumber(text: string): number {
  if (!text) {
    throw new Error('empty');
  }
  const value = evaluate(text);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('not a finite number');
  }
  return value;
}

export function formatNumber(value: number, digits = 3): string {
  return formatFraction(value, { digits });
}

export function formatComplex(value: Complex, digits = 3): string {
  const real = Math.abs(value.re) < EPS ? 0 : value.re;
  const imaginary = Math.abs(value.im) < EPS ? 0 : value.im;

  if (real === 0 && imaginary === 0) {
    return '0';
  }
  if (imaginary === 0) {
    return formatNumber(real, digits);
  }
  if (real === 0) {
    return formatImaginary(imaginary, digits);
  }
  return `${formatNumber(real, digits)} ${imaginary < 0 ? '−' : '+'} ${formatImaginary(Math.abs(imaginary), digits)}`;
}

function formatImaginary(value: number, digits: number): string {
  if (Math.abs(value - 1) < EPS) {
    return 'i';
  }
  if (Math.abs(value + 1) < EPS) {
    return '-i';
  }
  const text = formatNumber(value, digits);
  const needsParentheses =
    text.includes('/') || text.includes('√') || text.includes('π') || text.includes('≈');
  return needsParentheses ? `(${text})i` : `${text}i`;
}

export function formatAngle(angleRadians: number, unit: AngleUnit, digits = 2): string {
  const angle = positiveAngle(angleRadians);
  if (unit === 'deg') {
    return `${formatNumber((angle * 180) / Math.PI, digits)}°`;
  }
  return `${formatPiFraction(angle) ?? formatNumber(angle, digits)} rad`;
}

export function formatPolar(value: Complex, unit: AngleUnit, digits = 3): string {
  const radius = modulus(value);
  const angle = argument(value);
  return `${formatNumber(radius, digits)} ∠ ${formatAngle(angle, unit)}`;
}

export function displayNumber(value: number, digits = 3): string {
  return formatNumber(value, digits);
}
