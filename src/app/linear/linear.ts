import { evaluate } from 'mathjs/number';
import { exactEigen2x2, gcd, lcm, toFraction } from '../shared/exact-number';

export interface Vec2 {
  x: number;
  y: number;
}

/** Matriz 2×2 [[a, b], [c, d]]. */
export interface Mat2 {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface ParsedScalar {
  value: number | null;
  error: string | null;
}

export interface Eigenvalue {
  re: number;
  im: number;
}

export interface EigenResult {
  real: boolean;
  discriminant: number;
  eigenvalues: Eigenvalue[];
  /** Etiquetas simbólicas de los autovalores, por ejemplo `(1 + √5)/2`. */
  eigenvalueLabels: string[];
  /** Representantes simples de las direcciones propias. */
  vectors: Vec2[];
  /** Etiquetas simbólicas con radicales, por ejemplo `(2, −1 + √5)`. */
  vectorLabels: string[];
  repeated: boolean;
}

export type SystemKind = 'unique' | 'infinite' | 'none';

export interface SystemResult {
  kind: SystemKind;
  solution: Vec2 | null;
  determinant: number;
  rankCoefficients: number;
  rankAugmented: number;
}

export const IDENTITY: Mat2 = { a: 1, b: 0, c: 0, d: 1 };

const EPS = 1e-9;
const MAX_SCALAR = 1_000_000;

export function parseScalar(text: string): ParsedScalar {
  const source = text
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/π/g, 'pi')
    .replace(/τ/g, 'tau');

  if (!source) {
    return { value: null, error: 'Escribe un número.' };
  }

  try {
    const value = evaluate(source);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { value: null, error: 'El valor debe ser un número real.' };
    }
    if (Math.abs(value) > MAX_SCALAR) {
      return { value: null, error: `Usa valores entre −${MAX_SCALAR} y ${MAX_SCALAR}.` };
    }
    return { value, error: null };
  } catch {
    return { value: null, error: 'Número no válido. Prueba con 2, 1/2 o sqrt(3).' };
  }
}

// ------------------------------------------------------------------- vectores

export function addVec(u: Vec2, v: Vec2): Vec2 {
  return { x: u.x + v.x, y: u.y + v.y };
}

export function subtractVec(u: Vec2, v: Vec2): Vec2 {
  return { x: u.x - v.x, y: u.y - v.y };
}

export function scaleVec(v: Vec2, factor: number): Vec2 {
  return { x: v.x * factor, y: v.y * factor };
}

export function dot(u: Vec2, v: Vec2): number {
  return u.x * v.x + u.y * v.y;
}

/** Producto cruz 2D con signo: área orientada del paralelogramo. */
export function cross(u: Vec2, v: Vec2): number {
  return u.x * v.y - u.y * v.x;
}

export function norm(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function unit(v: Vec2): Vec2 | null {
  const length = norm(v);
  if (length < EPS) {
    return null;
  }
  return { x: v.x / length, y: v.y / length };
}

/** Ángulo entre u y v en [0, π]. */
export function angleBetween(u: Vec2, v: Vec2): number {
  const lengths = norm(u) * norm(v);
  if (lengths < EPS) {
    return 0;
  }
  return Math.atan2(Math.abs(cross(u, v)), dot(u, v));
}

/** Proyección de v sobre u. */
export function projectVec(v: Vec2, u: Vec2): Vec2 | null {
  const denominator = dot(u, u);
  if (denominator < EPS) {
    return null;
  }
  return scaleVec(u, dot(v, u) / denominator);
}

// ------------------------------------------------------------------- matrices

export function matApply(m: Mat2, v: Vec2): Vec2 {
  return {
    x: m.a * v.x + m.b * v.y,
    y: m.c * v.x + m.d * v.y,
  };
}

export function matMultiply(left: Mat2, right: Mat2): Mat2 {
  return {
    a: left.a * right.a + left.b * right.c,
    b: left.a * right.b + left.b * right.d,
    c: left.c * right.a + left.d * right.c,
    d: left.c * right.b + left.d * right.d,
  };
}

export function matDeterminant(m: Mat2): number {
  return m.a * m.d - m.b * m.c;
}

export function matTrace(m: Mat2): number {
  return m.a + m.d;
}

export function matTranspose(m: Mat2): Mat2 {
  return { a: m.a, b: m.c, c: m.b, d: m.d };
}

export function matInverse(m: Mat2): Mat2 | null {
  const determinant = matDeterminant(m);
  if (Math.abs(determinant) < EPS) {
    return null;
  }
  return {
    a: m.d / determinant,
    b: -m.b / determinant,
    c: -m.c / determinant,
    d: m.a / determinant,
  };
}

export function matRank(m: Mat2): number {
  if (Math.abs(matDeterminant(m)) > EPS) {
    return 2;
  }
  if (Math.abs(m.a) > EPS || Math.abs(m.b) > EPS || Math.abs(m.c) > EPS || Math.abs(m.d) > EPS) {
    return 1;
  }
  return 0;
}

export function matEquals(left: Mat2, right: Mat2): boolean {
  const tolerance = 1e-4;
  return (
    Math.abs(left.a - right.a) < tolerance &&
    Math.abs(left.b - right.b) < tolerance &&
    Math.abs(left.c - right.c) < tolerance &&
    Math.abs(left.d - right.d) < tolerance
  );
}

export function eigenvalues(m: Mat2): EigenResult {
  const trace = matTrace(m);
  const determinant = matDeterminant(m);
  const discriminant = trace * trace - 4 * determinant;

  if (discriminant < -EPS) {
    const re = trace / 2;
    const im = Math.sqrt(-discriminant) / 2;
    return {
      real: false,
      discriminant,
      eigenvalues: [
        { re, im },
        { re, im: -im },
      ],
      eigenvalueLabels: [],
      vectors: [],
      vectorLabels: [],
      repeated: false,
    };
  }

  const root = Math.sqrt(Math.max(0, discriminant));
  const first = (trace + root) / 2;
  const second = (trace - root) / 2;
  const repeated = Math.abs(first - second) < EPS;

  if (repeated) {
    const scalarMatrix = Math.abs(m.b) < EPS && Math.abs(m.c) < EPS && Math.abs(m.a - m.d) < EPS;
    return {
      real: true,
      discriminant,
      eigenvalues: [
        { re: first, im: 0 },
        { re: first, im: 0 },
      ],
      eigenvalueLabels: [],
      vectors: scalarMatrix
        ? [
            { x: 1, y: 0 },
            { x: 0, y: 1 },
          ]
        : [eigenvector(m, first)],
      vectorLabels: [],
      repeated: true,
    };
  }

  const symbolic = exactEigen2x2(m.a, m.b, m.c, m.d);
  return {
    real: true,
    discriminant,
    eigenvalues: [
      { re: first, im: 0 },
      { re: second, im: 0 },
    ],
    eigenvalueLabels: symbolic?.eigenvalueLabels ?? [],
    vectors: [eigenvector(m, first), eigenvector(m, second)],
    vectorLabels: symbolic?.vectorLabels ?? [],
    repeated: false,
  };
}

function eigenvector(m: Mat2, lambda: number): Vec2 {
  const shiftedA = m.a - lambda;
  const shiftedD = m.d - lambda;

  let candidate: Vec2;
  if (Math.abs(m.b) > EPS) {
    candidate = { x: m.b, y: -shiftedA };
  } else if (Math.abs(m.c) > EPS) {
    candidate = { x: shiftedD, y: -m.c };
  } else if (Math.abs(shiftedA) < EPS) {
    candidate = { x: 1, y: 0 };
  } else if (Math.abs(shiftedD) < EPS) {
    candidate = { x: 0, y: 1 };
  } else {
    candidate = { x: 1, y: 0 };
  }

  return simplifyDirection(candidate);
}

/**
 * Reduce una dirección a su representante entero más simple. Por ejemplo,
 * (0.5, 0.5) se convierte en (1, 1) y (0.5, -0.5) en (1, -1).
 */
function simplifyDirection(vector: Vec2): Vec2 {
  if (norm(vector) < EPS) {
    return { x: 0, y: 0 };
  }

  const fractionX = toFraction(vector.x);
  const fractionY = toFraction(vector.y);
  if (!fractionX || !fractionY) {
    return unit(vector) ?? { x: 1, y: 0 };
  }

  const commonDenominator = lcm(fractionX.denominator, fractionY.denominator);
  let x = fractionX.numerator * (commonDenominator / fractionX.denominator);
  let y = fractionY.numerator * (commonDenominator / fractionY.denominator);
  const divisor = gcd(Math.abs(x), Math.abs(y));

  x /= divisor;
  y /= divisor;

  // Se elige el signo con la primera componente no nula positiva.
  if (x < 0 || (x === 0 && y < 0)) {
    x = -x;
    y = -y;
  }

  return { x, y };
}

export function matrixKind(m: Mat2): string {
  const zero =
    Math.abs(m.a) < EPS && Math.abs(m.b) < EPS && Math.abs(m.c) < EPS && Math.abs(m.d) < EPS;
  if (zero) {
    return 'Cero';
  }

  if (matEquals(m, IDENTITY)) {
    return 'Identidad';
  }

  const singular = Math.abs(matDeterminant(m)) < EPS;
  if (singular) {
    return matEquals(matMultiply(m, m), m) ? 'Proyección' : 'Singular';
  }

  const orthogonal = matEquals(matMultiply(matTranspose(m), m), IDENTITY);
  if (orthogonal) {
    return matDeterminant(m) > 0 ? 'Rotación' : 'Reflexión';
  }

  if (Math.abs(m.b) < EPS && Math.abs(m.c) < EPS) {
    return Math.abs(m.a - m.d) < EPS ? 'Escala uniforme' : 'Escala';
  }

  if (
    Math.abs(m.a - 1) < EPS &&
    Math.abs(m.d - 1) < EPS &&
    Math.abs(m.b) > EPS &&
    Math.abs(m.c) < EPS
  ) {
    return 'Cizalla horizontal';
  }

  if (
    Math.abs(m.a - 1) < EPS &&
    Math.abs(m.d - 1) < EPS &&
    Math.abs(m.b) < EPS &&
    Math.abs(m.c) > EPS
  ) {
    return 'Cizalla vertical';
  }

  return 'Transformación general';
}

// ------------------------------------------------------------------- sistemas

export function solveSystem(
  a1: number,
  b1: number,
  c1: number,
  a2: number,
  b2: number,
  c2: number,
): SystemResult {
  const determinant = a1 * b2 - a2 * b1;
  const rankCoefficients = rank2x2(a1, b1, a2, b2);
  const rankAugmented = rank2x3(a1, b1, c1, a2, b2, c2);

  if (rankCoefficients === 2) {
    return {
      kind: 'unique',
      solution: {
        x: (c1 * b2 - c2 * b1) / determinant,
        y: (a1 * c2 - a2 * c1) / determinant,
      },
      determinant,
      rankCoefficients,
      rankAugmented,
    };
  }

  return {
    kind: rankAugmented > rankCoefficients ? 'none' : 'infinite',
    solution: null,
    determinant,
    rankCoefficients,
    rankAugmented,
  };
}

function rank2x2(a: number, b: number, c: number, d: number): number {
  if (Math.abs(a * d - b * c) > EPS) {
    return 2;
  }
  if (Math.abs(a) > EPS || Math.abs(b) > EPS || Math.abs(c) > EPS || Math.abs(d) > EPS) {
    return 1;
  }
  return 0;
}

function rank2x3(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number): number {
  const minors = [a1 * b2 - a2 * b1, a1 * c2 - a2 * c1, b1 * c2 - b2 * c1];
  if (minors.some((minor) => Math.abs(minor) > EPS)) {
    return 2;
  }
  if (
    Math.abs(a1) > EPS ||
    Math.abs(b1) > EPS ||
    Math.abs(c1) > EPS ||
    Math.abs(a2) > EPS ||
    Math.abs(b2) > EPS ||
    Math.abs(c2) > EPS
  ) {
    return 1;
  }
  return 0;
}
