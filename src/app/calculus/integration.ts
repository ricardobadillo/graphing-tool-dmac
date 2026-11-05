import type { EvalFunction } from 'mathjs/number';
import { compileExpression, evaluateAt } from '../shared/expression';
import { formatExact } from '../shared/exact-number';

export type QuadratureMethod = 'simpson' | 'trapezoid';

export interface ImproperResult {
  value: number | null;
  convergent: boolean;
  singularities: number[];
  message: string;
}

export interface IntersectionResult {
  area: number;
  intersections: number[];
}

export interface SubstitutionCheck {
  original: number;
  transformed: number;
  difference: number;
  ua: number;
  ub: number;
}

export interface PartsCheck {
  left: number;
  right: number;
  difference: number;
}

export interface PartialFractionResult {
  decomposition: string;
  integral: number | null;
  coefficients: number[];
  error: string | null;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : Number.NaN;
}

export function integrate(
  fn: (x: number) => number,
  a: number,
  b: number,
  intervals = 2000,
  method: QuadratureMethod = 'simpson',
): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const count = Math.max(2, Math.floor(intervals));
  const even = count % 2 === 0 ? count : count + 1;
  const step = (hi - lo) / even;
  let sum = fn(lo) + fn(hi);

  if (method === 'trapezoid') {
    for (let index = 1; index < even; index += 1) {
      sum += 2 * fn(lo + index * step);
    }
    return (step / 2) * sum;
  }

  for (let index = 1; index < even; index += 1) {
    sum += (index % 2 === 0 ? 2 : 4) * fn(lo + index * step);
  }
  return (step / 3) * sum;
}

export function analyzeImproper(fn: (x: number) => number, a: number, b: number): ImproperResult {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (!(hi > lo)) {
    return {
      value: null,
      convergent: false,
      singularities: [],
      message: 'El intervalo debe cumplir a < b.',
    };
  }

  const singularities: number[] = [];
  for (let index = 0; index <= 240; index += 1) {
    const x = lo + ((hi - lo) * index) / 240;
    let value: number;
    try {
      value = fn(x);
    } catch {
      value = Number.NaN;
    }
    if (!Number.isFinite(value) || Math.abs(value) > 1e8) {
      singularities.push(x);
    }
  }

  const uniqueSingularities = [...new Set(singularities.map((value) => Number(value.toFixed(8))))]
    .sort((left, right) => left - right)
    .filter((value, index, list) => index === 0 || Math.abs(value - list[index - 1]) > 1e-5);

  if (uniqueSingularities.length === 0) {
    const value = integrate(fn, lo, hi, 3000);
    return {
      value: Number.isFinite(value) ? value : null,
      convergent: Number.isFinite(value),
      singularities: [],
      message: Number.isFinite(value)
        ? 'La integral es propia y converge numéricamente.'
        : 'No se pudo calcular la integral.',
    };
  }

  const boundaries = [lo, ...uniqueSingularities, hi];
  let total = 0;
  let convergent = true;

  for (let index = 1; index < boundaries.length; index += 1) {
    const from = boundaries[index - 1];
    const to = boundaries[index];
    if (!(to > from)) {
      continue;
    }

    const coarse = integrate(fn, from + 1e-4, to - 1e-4, 1200);
    const fine = integrate(fn, from + 1e-5, to - 1e-5, 2000);

    if (!Number.isFinite(coarse) || !Number.isFinite(fine) || Math.abs(fine) > 1e8) {
      convergent = false;
      break;
    }

    const scale = Math.max(1, Math.abs(fine));
    if (Math.abs(fine - coarse) > scale * 0.05) {
      convergent = false;
      break;
    }

    total += fine;
  }

  return {
    value: convergent ? total : null,
    convergent,
    singularities: uniqueSingularities,
    message: convergent
      ? 'La integral impropia converge numéricamente (aproximación truncada).'
      : 'La integral impropia parece divergir o no se pudo estabilizar.',
  };
}

function findIntersections(
  f: (x: number) => number,
  g: (x: number) => number,
  a: number,
  b: number,
): number[] {
  const samples = 600;
  const step = (b - a) / samples;
  const roots: number[] = [];

  const difference = (x: number): number => f(x) - g(x);
  if (Math.abs(difference(a)) < 1e-10) {
    roots.push(a);
  }
  if (Math.abs(difference(b)) < 1e-10) {
    roots.push(b);
  }

  let previousX = a;
  let previous = difference(a);

  for (let index = 1; index <= samples; index += 1) {
    const x = a + step * index;
    const current = difference(x);
    if (Number.isFinite(previous) && Number.isFinite(current) && previous * current < 0) {
      let left = previousX;
      let right = x;
      for (let iteration = 0; iteration < 40; iteration += 1) {
        const middle = (left + right) / 2;
        const value = difference(middle);
        if (Number.isFinite(value) && Math.abs(value) < 1e-10) {
          break;
        }
        if (previous * value <= 0) {
          right = middle;
        } else {
          left = middle;
        }
      }
      roots.push((left + right) / 2);
    }
    previousX = x;
    previous = current;
  }

  return roots.filter(
    (value, index, list) => index === 0 || Math.abs(value - list[index - 1]) > 1e-5,
  );
}

export function areaBetween(
  f: (x: number) => number,
  g: (x: number) => number,
  a: number,
  b: number,
): IntersectionResult {
  const intersections = findIntersections(f, g, a, b);
  const points = [a, ...intersections.filter((value) => value > a && value < b), b].sort(
    (left, right) => left - right,
  );
  let area = 0;

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (!(to > from)) {
      continue;
    }
    area += integrate((x) => Math.abs(f(x) - g(x)), from, to, 1200);
  }

  return { area, intersections };
}

export function arcLength(fn: (x: number) => number, a: number, b: number): number {
  const h = Math.max((Math.abs(b - a) || 1) * 1e-5, 1e-6);
  const derivative = (x: number): number => {
    const left = fn(x - h);
    const right = fn(x + h);
    return (right - left) / (2 * h);
  };
  return integrate((x) => Math.sqrt(1 + derivative(x) ** 2), a, b, 2400);
}

export function volumeRevolution(fn: (x: number) => number, a: number, b: number): number {
  return Math.PI * integrate((x) => fn(x) ** 2, a, b, 2400);
}

export function verifySubstitution(
  f: (x: number) => number,
  g: (x: number) => number,
  h: (u: number) => number,
  a: number,
  b: number,
): SubstitutionCheck {
  const original = integrate(f, a, b, 2400);
  const ua = g(a);
  const ub = g(b);
  const transformed = integrate(h, ua, ub, 2400);
  return {
    original,
    transformed,
    difference: Math.abs(original - transformed),
    ua,
    ub,
  };
}

export function verifyParts(
  u: (x: number) => number,
  dv: (x: number) => number,
  a: number,
  b: number,
): PartsCheck {
  const vAt = (x: number): number => {
    if (x <= a) {
      return 0;
    }
    let total = 0;
    const count = 200;
    const h = (x - a) / count;
    for (let index = 1; index <= count; index += 1) {
      total += ((dv(a + h * (index - 1)) + dv(a + h * index)) / 2) * h;
    }
    return total;
  };

  const left = integrate((x) => u(x) * dv(x), a, b, 1600);
  const boundary = u(b) * vAt(b) - u(a) * vAt(a);
  const h = Math.max((b - a) * 1e-5, 1e-6);
  const du = (x: number): number => (u(x + h) - u(x - h)) / (2 * h);
  const right = boundary - integrate((x) => du(x) * vAt(x), a, b, 1200);

  return {
    left,
    right,
    difference: Math.abs(left - right),
  };
}

export function partialFractions(
  numerator: (x: number) => number,
  roots: number[],
  a: number,
  b: number,
): PartialFractionResult {
  if (!roots.every((value) => Number.isFinite(value))) {
    return {
      decomposition: '—',
      integral: null,
      coefficients: [],
      error: 'Las raíces deben ser números finitos.',
    };
  }

  const uniqueRoots = [...new Set(roots)].sort((left, right) => left - right);
  if (uniqueRoots.length === 0) {
    return {
      decomposition: '—',
      integral: null,
      coefficients: [],
      error: 'Añade al menos una raíz real distinta.',
    };
  }

  const coefficients = uniqueRoots.map((root) => {
    let denominator = 1;
    for (const other of uniqueRoots) {
      if (other !== root) {
        denominator *= root - other;
      }
    }
    const value = numerator(root) / denominator;
    return Number.isFinite(value) ? value : 0;
  });

  const terms = uniqueRoots.map((root, index) => {
    const coefficient = coefficients[index];
    const sign = root < 0 ? '+' : '-';
    const coefficientText = formatExact(coefficient);
    const denominatorText = root === 0 ? 'x' : `(x ${sign} ${formatExact(Math.abs(root))})`;
    return `${coefficientText}/${denominatorText}`;
  });

  const crossesRoot = uniqueRoots.some((root) => (a < root && root < b) || (b < root && root < a));
  const touchesRoot = uniqueRoots.some(
    (root) => Math.abs(root - a) < 1e-9 || Math.abs(root - b) < 1e-9,
  );
  if (crossesRoot || touchesRoot) {
    return {
      decomposition: terms.join(' + ').replace(/\+ -/g, '- '),
      integral: null,
      coefficients,
      error: crossesRoot
        ? 'El intervalo cruza una singularidad; la integral impropia requiere otro análisis.'
        : 'El intervalo toca una singularidad en un extremo; la integral no es propia.',
    };
  }

  const integral = uniqueRoots.reduce(
    (sum, root, index) =>
      sum + coefficients[index] * (Math.log(Math.abs(b - root)) - Math.log(Math.abs(a - root))),
    0,
  );

  return {
    decomposition: terms.join(' + ').replace(/\+ -/g, '- '),
    integral: Number.isFinite(integral) ? integral : null,
    coefficients,
    error: null,
  };
}

export function compileFunction(expression: string): EvalFunction | null {
  const result = compileExpression(expression, ['x']);
  return result.compiled;
}

export function evaluateFunction(fn: EvalFunction, x: number): number {
  return evaluateAt(fn, x);
}

export function isFiniteValue(value: number): boolean {
  return Number.isFinite(value);
}

export { finite };
