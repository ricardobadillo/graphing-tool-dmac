import { compileExpression, evaluateAt } from '../shared/expression';
import { analyzeCurve } from '../graphing/curve-analysis';

export interface OptimizationPoint {
  x: number;
  y: number;
  kind: 'max' | 'min';
  secondDerivative: number | null;
}

export interface ConcavityInterval {
  from: number;
  to: number;
  direction: 'up' | 'down';
}

export interface Optimization1DResult {
  maxima: OptimizationPoint[];
  minima: OptimizationPoint[];
  inflections: number[];
  concavity: ConcavityInterval[];
  globalMax: { x: number; y: number } | null;
  globalMin: { x: number; y: number } | null;
  error: string | null;
}

function secondDerivativeAt(evaluate: (x: number) => number, x: number, h: number): number | null {
  const value = (evaluate(x + h) - 2 * evaluate(x) + evaluate(x - h)) / (h * h);
  return Number.isFinite(value) ? value : null;
}

function buildConcavity(
  evaluate: (x: number) => number,
  a: number,
  b: number,
  inflections: number[],
): ConcavityInterval[] {
  const boundaries = [a, ...inflections.filter((value) => value > a && value < b), b].sort(
    (left, right) => left - right,
  );
  const intervals: ConcavityInterval[] = [];
  const h = Math.max((b - a) * 1e-4, 1e-5);

  for (let index = 1; index < boundaries.length; index += 1) {
    const from = boundaries[index - 1];
    const to = boundaries[index];
    if (!(to > from)) {
      continue;
    }
    const curvature = secondDerivativeAt(evaluate, (from + to) / 2, h);
    if (curvature === null || Math.abs(curvature) < 1e-8) {
      continue;
    }
    intervals.push({
      from,
      to,
      direction: curvature > 0 ? 'up' : 'down',
    });
  }

  return intervals;
}

export function analyzeOptimization1D(
  expression: string,
  a: number,
  b: number,
): Optimization1DResult {
  const empty: Optimization1DResult = {
    maxima: [],
    minima: [],
    inflections: [],
    concavity: [],
    globalMax: null,
    globalMin: null,
    error: null,
  };

  if (!Number.isFinite(a) || !Number.isFinite(b) || !(b > a)) {
    return { ...empty, error: 'El intervalo debe cumplir a < b.' };
  }

  const compiled = compileExpression(expression, ['x']);
  if (compiled.error || !compiled.compiled) {
    return { ...empty, error: compiled.error ?? 'Función no válida.' };
  }

  const evaluate = (x: number): number => evaluateAt(compiled.compiled!, x);
  const analysis = analyzeCurve(evaluate, a, b, 900);
  const h = Math.max((b - a) * 1e-4, 1e-5);

  const maxima: OptimizationPoint[] = analysis.maxima.map((point) => ({
    ...point,
    secondDerivative: secondDerivativeAt(evaluate, point.x, h),
  }));
  const minima: OptimizationPoint[] = analysis.minima.map((point) => ({
    ...point,
    secondDerivative: secondDerivativeAt(evaluate, point.x, h),
  }));

  const candidates = [
    { x: a, y: evaluate(a) },
    { x: b, y: evaluate(b) },
    ...maxima.map((point) => ({ x: point.x, y: point.y })),
    ...minima.map((point) => ({ x: point.x, y: point.y })),
  ].filter((point) => Number.isFinite(point.y));

  let globalMax: { x: number; y: number } | null = null;
  let globalMin: { x: number; y: number } | null = null;
  for (const point of candidates) {
    if (globalMax === null || point.y > globalMax.y) {
      globalMax = point;
    }
    if (globalMin === null || point.y < globalMin.y) {
      globalMin = point;
    }
  }

  return {
    maxima,
    minima,
    inflections: analysis.inflections,
    concavity: buildConcavity(evaluate, a, b, analysis.inflections),
    globalMax,
    globalMin,
    error: null,
  };
}
