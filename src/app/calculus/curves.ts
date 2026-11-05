import { compile, type EvalFunction } from 'mathjs/number';
import { describeExpressionError } from '../graphing/expression';

const scope: Record<string, unknown> = {
  x: 0,
  theta: 0,
  t: 0,
  ln: Math.log,
  log: (value: number, base?: number) =>
    base === undefined ? Math.log10(value) : Math.log(value) / Math.log(base),
  sec: (value: number) => 1 / Math.cos(value),
  csc: (value: number) => 1 / Math.sin(value),
  cot: (value: number) => 1 / Math.tan(value),
};

export interface CurveFunction {
  expression: string;
  normalized: string;
  compiled: EvalFunction | null;
  error: string | null;
}

export function normalizeCurveExpression(expression: string): string {
  return expression
    .replace(/π/g, 'pi')
    .replace(/τ/g, 'tau')
    .replace(/θ/g, 'theta')
    .replace(/^\s*r\s*(?:\(\s*theta\s*\))?\s*=\s*/i, '')
    .replace(/^\s*[xy]\s*(?:\(\s*t\s*\))?\s*=\s*/i, '')
    .trim();
}

export function compileCurve(expression: string, variable: 'theta' | 't'): CurveFunction {
  const normalized = normalizeCurveExpression(expression);

  if (!normalized) {
    return { expression, normalized, compiled: null, error: null };
  }

  try {
    const compiled = compile(normalized);
    scope[variable] = 1.234;
    const probe = compiled.evaluate(scope);

    if (typeof probe !== 'number') {
      return {
        expression,
        normalized,
        compiled: null,
        error: 'La expresión debe devolver un número.',
      };
    }

    return { expression, normalized, compiled, error: null };
  } catch (error) {
    return {
      expression,
      normalized,
      compiled: null,
      error: describeExpressionError(error),
    };
  }
}

export function evaluateCurve(
  compiled: EvalFunction,
  variable: 'theta' | 't',
  value: number,
): number {
  scope[variable] = value;
  try {
    const result = compiled.evaluate(scope);
    return typeof result === 'number' ? result : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

export interface CurvePoint {
  x: number;
  y: number;
}

export function samplePolar(
  compiled: EvalFunction,
  thetaMin: number,
  thetaMax: number,
  steps = 900,
): CurvePoint[] {
  const points: CurvePoint[] = [];
  if (!(thetaMax > thetaMin)) {
    return points;
  }

  for (let index = 0; index <= steps; index += 1) {
    const theta = thetaMin + ((thetaMax - thetaMin) * index) / steps;
    const radius = evaluateCurve(compiled, 'theta', theta);
    if (!Number.isFinite(radius)) {
      continue;
    }
    points.push({
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta),
    });
  }

  return points;
}

export function sampleParametric(
  xFunction: EvalFunction,
  yFunction: EvalFunction,
  tMin: number,
  tMax: number,
  steps = 900,
): CurvePoint[] {
  const points: CurvePoint[] = [];
  if (!(tMax > tMin)) {
    return points;
  }

  for (let index = 0; index <= steps; index += 1) {
    const t = tMin + ((tMax - tMin) * index) / steps;
    const x = evaluateCurve(xFunction, 't', t);
    const y = evaluateCurve(yFunction, 't', t);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    points.push({ x, y });
  }

  return points;
}
