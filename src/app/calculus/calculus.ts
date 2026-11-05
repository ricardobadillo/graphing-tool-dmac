import { derivative, type EvalFunction } from 'mathjs/number';
import {
  createPlotFunction,
  evaluateAt,
  normalizeExpression,
  toSymbolicExpression,
} from '../shared/expression';
import { formatExpressionFractions, formatFraction } from '../shared/exact-number';

export type RiemannMethod = 'left' | 'right' | 'midpoint' | 'trapezoid';

export interface RiemannMethodInfo {
  key: RiemannMethod;
  label: string;
  formula: string;
}

export const RIEMANN_METHODS: RiemannMethodInfo[] = [
  { key: 'left', label: 'Izquierda', formula: 'Σ f(xᵢ) · Δx' },
  { key: 'right', label: 'Derecha', formula: 'Σ f(xᵢ₊₁) · Δx' },
  { key: 'midpoint', label: 'Punto medio', formula: 'Σ f((xᵢ+xᵢ₊₁)/2) · Δx' },
  { key: 'trapezoid', label: 'Trapecio', formula: 'Σ (f(xᵢ)+f(xᵢ₊₁))/2 · Δx' },
];

export interface CalculusFunction {
  normalized: string;
  compiled: EvalFunction | null;
  error: string | null;
  symbolicDerivative: string | null;
}

export interface RiemannBar {
  x0: number;
  x1: number;
  sampleX: number | null;
  y0: number;
  y1: number;
  value: number;
}

export interface RiemannResult {
  bars: RiemannBar[];
  sum: number;
  delta: number;
  lo: number;
  hi: number;
  reference: number;
  error: number;
}

export const CONVERGENCE_N = [1, 2, 4, 8, 16, 32, 64, 128];

export function compileCalculusFunction(expression: string): CalculusFunction {
  const normalized = normalizeExpression(expression);
  const entry = createPlotFunction(1, expression, '#38bdf8');

  let symbolicDerivative: string | null = null;

  if (!entry.error && normalized) {
    const symbolic = toSymbolicExpression(expression);
    if (symbolic) {
      try {
        symbolicDerivative = formatExpressionFractions(derivative(symbolic, 'x').toString());
      } catch {
        symbolicDerivative = null;
      }
    }
  }

  return {
    normalized,
    compiled: entry.compiled,
    error: entry.error,
    symbolicDerivative,
  };
}

/** Derivada numérica central; compatible con ln, log base 10, abs, etc. */
export function numericDerivative(fn: EvalFunction, x: number): number {
  const step = Math.max(1e-5, Math.abs(x) * 1e-6);
  const left = evaluateAt(fn, x - step);
  const right = evaluateAt(fn, x + step);

  if (Number.isFinite(left) && Number.isFinite(right)) {
    return (right - left) / (2 * step);
  }

  const value = evaluateAt(fn, x);
  const forward = evaluateAt(fn, x + 1e-4);
  return (forward - value) / 1e-4;
}

/** Referencia numérica de la integral con Simpson compuesto. */
export function simpsonReference(fn: EvalFunction, a: number, b: number, intervals = 2000): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const evenIntervals = intervals % 2 === 0 ? intervals : intervals + 1;
  const step = (hi - lo) / evenIntervals;

  let sum = evaluateAt(fn, lo) + evaluateAt(fn, hi);

  for (let index = 1; index < evenIntervals; index += 1) {
    const value = evaluateAt(fn, lo + index * step);
    sum += (index % 2 === 0 ? 2 : 4) * value;
  }

  return (step / 3) * sum;
}

export function riemannSum(
  fn: EvalFunction,
  a: number,
  b: number,
  n: number,
  method: RiemannMethod,
): RiemannResult {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const intervals = Math.max(1, Math.floor(n));
  const delta = (hi - lo) / intervals;
  const bars: RiemannBar[] = [];
  let sum = 0;

  for (let index = 0; index < intervals; index += 1) {
    const x0 = lo + index * delta;
    const x1 = index === intervals - 1 ? hi : x0 + delta;

    let y0: number;
    let y1: number;
    let value: number;
    let sampleX: number | null = null;

    if (method === 'left') {
      sampleX = x0;
      y0 = evaluateAt(fn, x0);
      y1 = y0;
      value = y0 * delta;
    } else if (method === 'right') {
      sampleX = x1;
      y0 = evaluateAt(fn, x1);
      y1 = y0;
      value = y0 * delta;
    } else if (method === 'midpoint') {
      sampleX = (x0 + x1) / 2;
      y0 = evaluateAt(fn, (x0 + x1) / 2);
      y1 = y0;
      value = y0 * delta;
    } else {
      y0 = evaluateAt(fn, x0);
      y1 = evaluateAt(fn, x1);
      value = ((y0 + y1) / 2) * delta;
    }

    bars.push({ x0, x1, sampleX, y0, y1, value });
    sum += value;
  }

  const reference = simpsonReference(fn, lo, hi);
  const error =
    Number.isFinite(sum) && Number.isFinite(reference) ? Math.abs(sum - reference) : Number.NaN;

  return { bars, sum, delta, lo, hi, reference, error };
}

export function riemannConvergence(
  fn: EvalFunction,
  a: number,
  b: number,
  method: RiemannMethod,
): { n: number; sum: number; error: number }[] {
  const reference = simpsonReference(fn, a, b);

  return CONVERGENCE_N.map((n) => {
    const result = riemannSum(fn, a, b, n, method);
    return {
      n,
      sum: result.sum,
      error:
        Number.isFinite(result.sum) && Number.isFinite(reference)
          ? Math.abs(result.sum - reference)
          : Number.NaN,
    };
  });
}

export function formatCalc(value: number, digits = 4): string {
  return formatFraction(value, { digits });
}

export function methodInfo(method: RiemannMethod): RiemannMethodInfo {
  return RIEMANN_METHODS.find((item) => item.key === method) ?? RIEMANN_METHODS[0];
}
