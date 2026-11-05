import type { EvalFunction } from 'mathjs/number';
import { compileExpression, evaluateExpression } from '../shared/expression';

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
  const result = compileExpression(normalized, [variable]);

  return {
    expression,
    normalized: result.normalized,
    compiled: result.compiled,
    error: result.error,
  };
}

export function evaluateCurve(
  compiled: EvalFunction,
  variable: 'theta' | 't',
  value: number,
): number {
  return evaluateExpression(compiled, { [variable]: value });
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
