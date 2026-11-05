import type { EvalFunction } from 'mathjs/number';
import { evaluateAt } from '../shared/expression';

export type ContinuityKind =
  'continuous' | 'removable' | 'jump' | 'infinite' | 'undefined' | 'unknown';

export interface LimitProbe {
  offset: number;
  leftX: number;
  leftValue: number | null;
  rightX: number;
  rightValue: number | null;
}

export interface LimitAnalysis {
  point: number;
  valueAtPoint: number | null;
  leftLimit: number | null;
  rightLimit: number | null;
  twoSidedLimit: number | null;
  kind: ContinuityKind;
  message: string;
  probes: LimitProbe[];
}

const EPSILONS = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6];
const INFINITE_THRESHOLD = 1e6;

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

/**
 * Estima el límite lateral con una sucesión de aproximaciones.
 * Devuelve `null` cuando no hay valores finitos o cuando la magnitud
 * crece sin cota (candidato a asíntota vertical).
 */
function estimateSide(fn: EvalFunction, point: number, direction: -1 | 1): number | null {
  const values = EPSILONS.map((epsilon) => evaluateAt(fn, point + direction * epsilon));
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return null;
  }

  const last = finiteValues[finiteValues.length - 1];
  if (Math.abs(last) >= INFINITE_THRESHOLD) {
    return null;
  }

  return last;
}

function isInfiniteSide(fn: EvalFunction, point: number, direction: -1 | 1): boolean {
  const values = EPSILONS.map((epsilon) => evaluateAt(fn, point + direction * epsilon));
  if (values.some((value) => value === Infinity || value === -Infinity)) {
    return true;
  }

  const finiteValues = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(value));

  if (finiteValues.length === 0) {
    return false;
  }
  return Math.max(...finiteValues) >= INFINITE_THRESHOLD;
}

function equalLimits(left: number, right: number): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= scale * 1e-3;
}

function classify(
  valueAtPoint: number | null,
  leftLimit: number | null,
  rightLimit: number | null,
  leftInfinite: boolean,
  rightInfinite: boolean,
): { kind: ContinuityKind; message: string; twoSided: number | null } {
  if (leftInfinite || rightInfinite) {
    return {
      kind: 'infinite',
      message: 'La función presenta una asíntota vertical o un crecimiento sin cota en el punto.',
      twoSided: null,
    };
  }

  if (leftLimit === null && rightLimit === null) {
    return {
      kind: 'undefined',
      message: 'No se pudo estimar el límite con valores finitos cerca del punto.',
      twoSided: null,
    };
  }

  if (leftLimit !== null && rightLimit !== null) {
    if (!equalLimits(leftLimit, rightLimit)) {
      return {
        kind: 'jump',
        message: 'Los límites laterales son distintos: la función tiene un salto.',
        twoSided: null,
      };
    }

    const limit = (leftLimit + rightLimit) / 2;
    if (valueAtPoint !== null && equalLimits(limit, valueAtPoint)) {
      return {
        kind: 'continuous',
        message: 'Los límites laterales coinciden con f(a): la función es continua en el punto.',
        twoSided: limit,
      };
    }

    return {
      kind: 'removable',
      message: 'Los límites laterales coinciden, pero f(a) no existe o no coincide con el límite.',
      twoSided: limit,
    };
  }

  return {
    kind: 'unknown',
    message: 'Solo se pudo estimar uno de los límites laterales.',
    twoSided: null,
  };
}

export function analyzeLimit(fn: EvalFunction, point: number): LimitAnalysis | null {
  if (!Number.isFinite(point)) {
    return null;
  }

  const valueAtPoint = finite(evaluateAt(fn, point));
  const leftLimit = estimateSide(fn, point, -1);
  const rightLimit = estimateSide(fn, point, 1);
  const leftInfinite = isInfiniteSide(fn, point, -1);
  const rightInfinite = isInfiniteSide(fn, point, 1);
  const result = classify(valueAtPoint, leftLimit, rightLimit, leftInfinite, rightInfinite);

  const probes: LimitProbe[] = [0.1, 0.01, 0.001, 0.0001].map((value) => ({
    offset: value,
    leftX: point - value,
    leftValue: finite(evaluateAt(fn, point - value)),
    rightX: point + value,
    rightValue: finite(evaluateAt(fn, point + value)),
  }));

  return {
    point,
    valueAtPoint,
    leftLimit,
    rightLimit,
    twoSidedLimit: result.twoSided,
    kind: result.kind,
    message: result.message,
    probes,
  };
}

export function continuityLabel(kind: ContinuityKind): string {
  switch (kind) {
    case 'continuous':
      return 'Continua';
    case 'removable':
      return 'Discontinuidad evitable';
    case 'jump':
      return 'Discontinuidad de salto';
    case 'infinite':
      return 'Discontinuidad infinita';
    case 'undefined':
      return 'Sin límite finito';
    case 'unknown':
      return 'Indeterminada';
  }
}

export function formatLimit(value: number | null, digits = 4): string {
  if (value === null || !Number.isFinite(value)) {
    return 'no existe';
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
