import { evaluate } from 'mathjs/number';
import { toFraction } from '../number-format';

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

  const symbolic = symbolicEigen(m);
  return {
    real: true,
    discriminant,
    eigenvalues: [
      { re: first, im: 0 },
      { re: second, im: 0 },
    ],
    eigenvalueLabels: symbolic?.eigenvalues ?? [],
    vectors: [eigenvector(m, first), eigenvector(m, second)],
    vectorLabels: symbolic?.vectors ?? [],
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

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x || 1;
}

function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

// ------------------------------------------------------- radicales simbólicos

interface Rational {
  numerator: number;
  denominator: number;
}

/** Valor de la forma `racional + radical·√radicando`. */
interface Surd {
  rational: Rational;
  radical: Rational;
  radicand: number;
}

interface SymbolicEigen {
  eigenvalues: string[];
  vectors: string[];
}

/**
 * Construye etiquetas exactas para autovalores y autovectores con radicales.
 * Devuelve `null` cuando no hay radicales o las entradas no son racionales.
 */
function symbolicEigen(m: Mat2): SymbolicEigen | null {
  const a = toRational(m.a);
  const b = toRational(m.b);
  const c = toRational(m.c);
  const d = toRational(m.d);
  if (!a || !b || !c || !d) {
    return null;
  }

  const trace = addRational(a, d);
  const determinant = subtractRational(multiplyRational(a, d), multiplyRational(b, c));
  const discriminant = subtractRational(
    multiplyRational(trace, trace),
    multiplyRational(rational(4), determinant),
  );

  if (discriminant.numerator <= 0 || isPerfectSquareRational(discriminant)) {
    return null;
  }

  const root = squareRootOfRational(discriminant);
  if (!root) {
    return null;
  }

  const radicand = root.radicand;
  const rootSurd: Surd = {
    rational: rational(0),
    radical: root.coefficient,
    radicand,
  };
  const half = rational(1, 2);
  const lambdaPlus = scaleSurd(
    addSurd(rationalSurd(trace, radicand), rootSurd),
    half,
  );
  const lambdaMinus = scaleSurd(
    subtractSurd(rationalSurd(trace, radicand), rootSurd),
    half,
  );

  const vectors: string[] = [];
  for (const lambda of [lambdaPlus, lambdaMinus]) {
    const direction = directionForLambda(lambda, a, b, c, d, radicand);
    if (!direction) {
      return null;
    }
    vectors.push(formatSurdVector(direction.x, direction.y, radicand));
  }

  return {
    eigenvalues: [formatSurdScalar(lambdaPlus), formatSurdScalar(lambdaMinus)],
    vectors,
  };
}

function directionForLambda(
  lambda: Surd,
  a: Rational,
  b: Rational,
  c: Rational,
  d: Rational,
  radicand: number,
): { x: Surd; y: Surd } | null {
  if (!isZeroRational(b)) {
    return {
      x: rationalSurd(b, radicand),
      y: subtractSurd(lambda, rationalSurd(a, radicand)),
    };
  }
  if (!isZeroRational(c)) {
    return {
      x: subtractSurd(rationalSurd(d, radicand), lambda),
      y: negateSurd(rationalSurd(c, radicand)),
    };
  }
  return null;
}

function formatSurdScalar(value: Surd): string {
  const scale = lcm(value.rational.denominator, value.radical.denominator);
  let real = Math.round(value.rational.numerator * (scale / value.rational.denominator));
  let imaginary = Math.round(value.radical.numerator * (scale / value.radical.denominator));
  const divisor = gcd(gcd(Math.abs(real), Math.abs(imaginary)), scale);

  real /= divisor;
  imaginary /= divisor;
  const denominator = scale / divisor;
  const numerator = formatSurdComponent(real, imaginary, value.radicand);

  if (denominator === 1) {
    return numerator;
  }

  const needsParentheses = real !== 0 && imaginary !== 0;
  return needsParentheses ? `(${numerator})/${denominator}` : `${numerator}/${denominator}`;
}

function formatSurdVector(x: Surd, y: Surd, radicand: number): string {
  const scale = [
    x.rational.denominator,
    x.radical.denominator,
    y.rational.denominator,
    y.radical.denominator,
  ].reduce((accumulator, denominator) => lcm(accumulator, denominator), 1);

  let xr = Math.round(x.rational.numerator * (scale / x.rational.denominator));
  let xi = Math.round(x.radical.numerator * (scale / x.radical.denominator));
  let yr = Math.round(y.rational.numerator * (scale / y.rational.denominator));
  let yi = Math.round(y.radical.numerator * (scale / y.radical.denominator));

  const magnitudes = [xr, xi, yr, yi]
    .map((value) => Math.abs(value))
    .filter((value) => value !== 0);
  const divisor = magnitudes.reduce(
    (accumulator, value) => gcd(accumulator, value),
    magnitudes[0] ?? 1,
  );

  xr = Math.round(xr / divisor);
  xi = Math.round(xi / divisor);
  yr = Math.round(yr / divisor);
  yi = Math.round(yi / divisor);

  const xIsZero = xr === 0 && xi === 0;
  const negative = xIsZero
    ? yr < 0 || (yr === 0 && yi < 0)
    : xr < 0 || (xr === 0 && xi < 0);
  if (negative) {
    xr = -xr;
    xi = -xi;
    yr = -yr;
    yi = -yi;
  }

  return `(${formatSurdComponent(xr, xi, radicand)}, ${formatSurdComponent(yr, yi, radicand)})`;
}

function formatSurdComponent(real: number, imaginary: number, radicand: number): string {
  if (imaginary === 0) {
    return formatSignedInteger(real);
  }

  const radical = formatRadical(Math.abs(imaginary), radicand);
  if (real === 0) {
    return imaginary < 0 ? `−${radical}` : radical;
  }

  return `${formatSignedInteger(real)} ${imaginary < 0 ? '−' : '+'} ${radical}`;
}

function formatSignedInteger(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : String(value);
}

function formatRadical(coefficient: number, radicand: number): string {
  return coefficient === 1 ? `√${radicand}` : `${coefficient}√${radicand}`;
}

function toRational(value: number): Rational | null {
  const fraction = toFraction(value);
  return fraction
    ? { numerator: fraction.numerator, denominator: fraction.denominator }
    : null;
}

function rational(numerator: number, denominator = 1): Rational {
  if (denominator === 0) {
    return { numerator: 0, denominator: 1 };
  }
  const sign = denominator < 0 ? -1 : 1;
  const top = numerator * sign;
  const bottom = Math.abs(denominator);
  const divisor = gcd(Math.abs(top), bottom);
  return { numerator: top / divisor, denominator: bottom / divisor };
}

function addRational(a: Rational, b: Rational): Rational {
  return rational(
    a.numerator * b.denominator + b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

function subtractRational(a: Rational, b: Rational): Rational {
  return rational(
    a.numerator * b.denominator - b.numerator * a.denominator,
    a.denominator * b.denominator,
  );
}

function multiplyRational(a: Rational, b: Rational): Rational {
  return rational(a.numerator * b.numerator, a.denominator * b.denominator);
}

function isZeroRational(value: Rational): boolean {
  return value.numerator === 0;
}

function isPerfectSquareRational(value: Rational): boolean {
  return (
    value.numerator >= 0 &&
    isPerfectSquareInteger(value.numerator) &&
    isPerfectSquareInteger(value.denominator)
  );
}

function isPerfectSquareInteger(value: number): boolean {
  if (value < 0) {
    return false;
  }
  const root = Math.round(Math.sqrt(value));
  return root * root === value;
}

/** Descompone √(n/d) como `coeficiente·√radicando` con radicando libre de cuadrados. */
function squareRootOfRational(value: Rational): { coefficient: Rational; radicand: number } | null {
  if (value.numerator <= 0) {
    return null;
  }

  let remaining = value.numerator * value.denominator;
  let coefficient = 1;

  for (let factor = 2; factor * factor <= remaining; factor += 1) {
    const square = factor * factor;
    while (remaining % square === 0) {
      remaining /= square;
      coefficient *= factor;
    }
  }

  return {
    coefficient: rational(coefficient, value.denominator),
    radicand: remaining,
  };
}

function rationalSurd(value: Rational, radicand: number): Surd {
  return {
    rational: value,
    radical: { numerator: 0, denominator: 1 },
    radicand,
  };
}

function addSurd(a: Surd, b: Surd): Surd {
  return {
    rational: addRational(a.rational, b.rational),
    radical: addRational(a.radical, b.radical),
    radicand: a.radicand,
  };
}

function subtractSurd(a: Surd, b: Surd): Surd {
  return {
    rational: subtractRational(a.rational, b.rational),
    radical: subtractRational(a.radical, b.radical),
    radicand: a.radicand,
  };
}

function scaleSurd(value: Surd, factor: Rational): Surd {
  return {
    rational: multiplyRational(value.rational, factor),
    radical: multiplyRational(value.radical, factor),
    radicand: value.radicand,
  };
}

function negateSurd(value: Surd): Surd {
  return {
    rational: rational(-value.rational.numerator, value.rational.denominator),
    radical: rational(-value.radical.numerator, value.radical.denominator),
    radicand: value.radicand,
  };
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
