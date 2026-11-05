import { derivative, type EvalFunction } from 'mathjs/number';
import {
  compileExpression,
  evaluateAt,
  normalizeExpression,
  toSymbolicExpression,
} from '../shared/expression';
import { formatExpressionFractions } from '../shared/exact-number';
import { analyzeLimit } from './limits';

export type LHopitalForm = '0/0' | '∞/∞' | 'direct' | 'other';

export interface LHopitalStep {
  order: number;
  numerator: string;
  denominator: string;
  numeratorValue: number | null;
  denominatorValue: number | null;
  form: LHopitalForm;
  limit: number | null;
}

export interface LHopitalResult {
  form: LHopitalForm;
  directValue: number | null;
  numericLeft: number | null;
  numericRight: number | null;
  numericLimit: number | null;
  steps: LHopitalStep[];
  limit: number | null;
  error: string | null;
}

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function classifyForm(numerator: number | null, denominator: number | null): LHopitalForm {
  if (numerator === null || denominator === null) {
    return 'other';
  }
  if (Math.abs(numerator) < 1e-9 && Math.abs(denominator) < 1e-9) {
    return '0/0';
  }
  if (Math.abs(numerator) > 1e6 && Math.abs(denominator) > 1e6) {
    return '∞/∞';
  }
  return 'direct';
}

function compileValue(expression: string): EvalFunction | null {
  const result = compileExpression(expression, ['x']);
  return result.compiled;
}

export function analyzeLHopital(
  numeratorExpression: string,
  denominatorExpression: string,
  point: number,
): LHopitalResult {
  const empty: LHopitalResult = {
    form: 'other',
    directValue: null,
    numericLeft: null,
    numericRight: null,
    numericLimit: null,
    steps: [],
    limit: null,
    error: null,
  };

  if (!Number.isFinite(point)) {
    return { ...empty, error: 'El punto debe ser un número finito.' };
  }

  const numerator = compileExpression(numeratorExpression, ['x']);
  const denominator = compileExpression(denominatorExpression, ['x']);

  if (numerator.error || !numerator.compiled) {
    return { ...empty, error: numerator.error ?? 'Función del numerador no válida.' };
  }
  if (denominator.error || !denominator.compiled) {
    return { ...empty, error: denominator.error ?? 'Función del denominador no válida.' };
  }

  const numeratorAtPoint = finite(evaluateAt(numerator.compiled, point));
  const denominatorAtPoint = finite(evaluateAt(denominator.compiled, point));
  const form = classifyForm(numeratorAtPoint, denominatorAtPoint);
  const directValue =
    numeratorAtPoint !== null && denominatorAtPoint !== null && Math.abs(denominatorAtPoint) > 1e-12
      ? numeratorAtPoint / denominatorAtPoint
      : null;

  const ratio = compileExpression(
    `(${normalizeExpression(numeratorExpression)}) / (${normalizeExpression(
      denominatorExpression,
    )})`,
    ['x'],
  );
  const numeric = ratio.compiled ? analyzeLimit(ratio.compiled, point) : null;

  const steps: LHopitalStep[] = [];
  let currentNumerator = toSymbolicExpression(numeratorExpression);
  let currentDenominator = toSymbolicExpression(denominatorExpression);
  let limit: number | null = form === 'direct' ? directValue : null;

  if (form === '0/0' || form === '∞/∞') {
    for (let order = 1; order <= 4; order += 1) {
      if (!currentNumerator || !currentDenominator) {
        break;
      }

      let numeratorDerivative: string;
      let denominatorDerivative: string;
      try {
        numeratorDerivative = derivative(currentNumerator, 'x').toString();
        denominatorDerivative = derivative(currentDenominator, 'x').toString();
      } catch {
        break;
      }

      const numeratorFn = compileValue(numeratorDerivative);
      const denominatorFn = compileValue(denominatorDerivative);
      if (!numeratorFn || !denominatorFn) {
        break;
      }

      const numeratorValue = finite(evaluateAt(numeratorFn, point));
      const denominatorValue = finite(evaluateAt(denominatorFn, point));
      const stepForm = classifyForm(numeratorValue, denominatorValue);
      const stepLimit =
        numeratorValue !== null &&
        denominatorValue !== null &&
        Math.abs(denominatorValue) > 1e-12 &&
        stepForm === 'direct'
          ? numeratorValue / denominatorValue
          : null;

      steps.push({
        order,
        numerator: formatExpressionFractions(numeratorDerivative),
        denominator: formatExpressionFractions(denominatorDerivative),
        numeratorValue,
        denominatorValue,
        form: stepForm,
        limit: stepLimit,
      });

      currentNumerator = numeratorDerivative;
      currentDenominator = denominatorDerivative;

      if (stepLimit !== null) {
        limit = stepLimit;
        break;
      }
    }
  }

  if (limit === null) {
    limit = numeric?.twoSidedLimit ?? null;
  }

  return {
    form,
    directValue,
    numericLeft: numeric?.leftLimit ?? null,
    numericRight: numeric?.rightLimit ?? null,
    numericLimit: numeric?.twoSidedLimit ?? null,
    steps,
    limit,
    error: null,
  };
}

export function lhopitalFormLabel(form: LHopitalForm): string {
  switch (form) {
    case '0/0':
      return 'Indeterminación 0/0';
    case '∞/∞':
      return 'Indeterminación ∞/∞';
    case 'direct':
      return 'Sustitución directa';
    case 'other':
      return 'Forma no indeterminada o no finita';
  }
}
