import { derivative, type EvalFunction } from 'mathjs/number';
import { compileExpression, evaluateExpression, toSymbolicExpression } from '../shared/expression';
import { formatExact, formatExpressionFractions } from '../shared/exact-number';

export interface PartialDerivatives {
  fx: number | null;
  fy: number | null;
  fxx: number | null;
  fyy: number | null;
  fxy: number | null;
}

export interface SymbolicPartials {
  fx: string | null;
  fy: string | null;
  error: string | null;
}

export interface TangentPlane {
  z: number;
  fx: number;
  fy: number;
  equation: string;
}

export interface PartialAnalysis {
  numeric: PartialDerivatives | null;
  symbolic: SymbolicPartials;
  gradient: { x: number; y: number } | null;
  error: string | null;
}

function numericPartial(
  fn: (x: number, y: number) => number,
  x: number,
  y: number,
  h: number,
  variable: 'x' | 'y',
): number | null {
  const left = variable === 'x' ? fn(x - h, y) : fn(x, y - h);
  const right = variable === 'x' ? fn(x + h, y) : fn(x, y + h);
  const value = (right - left) / (2 * h);
  return Number.isFinite(value) ? value : null;
}

function numericSecond(
  fn: (x: number, y: number) => number,
  x: number,
  y: number,
  h: number,
  variable: 'x' | 'y',
): number | null {
  const center = fn(x, y);
  const left = variable === 'x' ? fn(x - h, y) : fn(x, y - h);
  const right = variable === 'x' ? fn(x + h, y) : fn(x, y + h);
  const value = (right - 2 * center + left) / (h * h);
  return Number.isFinite(value) ? value : null;
}

export function analyzePartials(expression: string, x: number, y: number): PartialAnalysis {
  const compiled = compileExpression(expression, ['x', 'y']);
  if (compiled.error || !compiled.compiled) {
    return {
      numeric: null,
      symbolic: { fx: null, fy: null, error: compiled.error },
      gradient: null,
      error: compiled.error ?? 'Función no válida.',
    };
  }

  const evaluate = (px: number, py: number): number =>
    evaluateExpression(compiled.compiled!, { x: px, y: py });
  const h = Math.max(1e-5, Math.max(Math.abs(x), Math.abs(y), 1) * 1e-5);

  const numeric: PartialDerivatives = {
    fx: numericPartial(evaluate, x, y, h, 'x'),
    fy: numericPartial(evaluate, x, y, h, 'y'),
    fxx: numericSecond(evaluate, x, y, h, 'x'),
    fyy: numericSecond(evaluate, x, y, h, 'y'),
    fxy: null,
  };

  if (numeric.fx !== null && numeric.fy !== null) {
    const fx = (px: number, py: number): number => {
      const value = numericPartial(evaluate, px, py, h, 'x');
      return value ?? Number.NaN;
    };
    numeric.fxy = numericPartial(fx, x, y, h, 'y');
  }

  const symbolic: SymbolicPartials = { fx: null, fy: null, error: null };
  const symbolicExpression = toSymbolicExpression(expression);
  if (symbolicExpression) {
    try {
      symbolic.fx = formatExpressionFractions(derivative(symbolicExpression, 'x').toString());
      symbolic.fy = formatExpressionFractions(derivative(symbolicExpression, 'y').toString());
    } catch {
      symbolic.error = 'No se pudieron calcular las derivadas simbólicas.';
    }
  }

  const gradient =
    numeric.fx !== null && numeric.fy !== null ? { x: numeric.fx, y: numeric.fy } : null;

  return {
    numeric,
    symbolic,
    gradient,
    error: null,
  };
}

export function directionalDerivative(fx: number, fy: number, angle: number): number {
  return fx * Math.cos(angle) + fy * Math.sin(angle);
}

export function unitDirection(angle: number): { x: number; y: number } {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function gradientMagnitude(fx: number, fy: number): number {
  return Math.hypot(fx, fy);
}

export function gradientAngle(fx: number, fy: number): number {
  return Math.atan2(fy, fx);
}

export function maximumDirectionalDerivative(fx: number, fy: number): number {
  return gradientMagnitude(fx, fy);
}

export function tangentPlane(
  expression: string,
  x: number,
  y: number,
  fx: number,
  fy: number,
): TangentPlane | null {
  const compiled = compileExpression(expression, ['x', 'y']);
  if (!compiled.compiled) {
    return null;
  }
  const z = evaluateExpression(compiled.compiled, { x, y });
  if (!Number.isFinite(z)) {
    return null;
  }
  const offset = (value: number): string =>
    value < 0
      ? `+ ${formatExact(-value, { digits: 4 })}`
      : `− ${formatExact(value, { digits: 4 })}`;
  const term = (coefficient: number, variable: string, center: number): string => {
    const sign = coefficient < 0 ? '−' : '+';
    return `${sign} ${formatExact(Math.abs(coefficient), { digits: 4 })}(${variable} ${offset(center)})`;
  };

  return {
    z,
    fx,
    fy,
    equation: `z = ${formatExact(z, { digits: 4 })} ${term(fx, 'x', x)} ${term(fy, 'y', y)}`,
  };
}

export function compilePartialFunction(expression: string): EvalFunction | null {
  const result = compileExpression(expression, ['x', 'y']);
  return result.compiled;
}
