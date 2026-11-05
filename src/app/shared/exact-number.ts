/**
 * Formato y representación de números exactos.
 *
 * Regla de la aplicación: mostrar primero una forma exacta (entero, fracción,
 * múltiplo de π o radical) y usar el decimal únicamente como último recurso,
 * marcándolo con ≈ para dejar claro que es una aproximación.
 */

export interface Rational {
  numerator: number;
  denominator: number;
}

export interface ExactFormatOptions {
  /** Dígitos del decimal de respaldo. */
  digits?: number;
  /** Mayor denominador aceptado al buscar una fracción. */
  maxDenominator?: number;
  /** Mayor radicando aceptado al buscar una raíz. */
  maxRadicand?: number;
  /** Añadir ≈ cuando no exista una forma exacta. */
  approximate?: boolean;
}

export interface SquareRoot {
  coefficient: Rational;
  radicand: number;
}

const ZERO_EPS = 1e-9;
const DEFAULT_DIGITS = 3;
const DEFAULT_MAX_DENOMINATOR = 1000;
const DEFAULT_MAX_RADICAND = 1000;

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function rational(numerator: number, denominator = 1): Rational {
  if (denominator === 0) {
    return { numerator: 0, denominator: 1 };
  }
  const sign = denominator < 0 ? -1 : 1;
  const top = numerator * sign;
  const bottom = Math.abs(denominator);
  const divisor = gcd(Math.abs(top), bottom);
  return { numerator: top / divisor, denominator: bottom / divisor };
}

/** Busca una fracción exacta (o indistinguible en coma flotante). */
export function toFraction(
  value: number,
  maxDenominator = DEFAULT_MAX_DENOMINATOR,
  tolerance?: number,
): Rational | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (Number.isInteger(value)) {
    return { numerator: value, denominator: 1 };
  }

  const sign = value < 0 ? -1 : 1;
  const target = Math.abs(value);
  const allowed = tolerance ?? Math.max(ZERO_EPS, target * 1e-12);

  let previousNumerator = 0;
  let numerator = 1;
  let previousDenominator = 1;
  let denominator = 0;
  let remainder = target;

  for (let step = 0; step < 48; step += 1) {
    const whole = Math.floor(remainder);
    const nextNumerator = whole * numerator + previousNumerator;
    const nextDenominator = whole * denominator + previousDenominator;

    if (nextDenominator > maxDenominator) {
      break;
    }

    previousNumerator = numerator;
    numerator = nextNumerator;
    previousDenominator = denominator;
    denominator = nextDenominator;

    if (Math.abs(target - numerator / denominator) <= allowed) {
      const divisor = gcd(numerator, denominator);
      return {
        numerator: sign * (numerator / divisor),
        denominator: denominator / divisor,
      };
    }

    const fractionPart = remainder - whole;
    if (fractionPart < Number.EPSILON) {
      break;
    }
    remainder = 1 / fractionPart;
  }

  return null;
}

/** Formatea un racional como entero o fracción. */
export function formatRational(value: Rational): string {
  if (value.denominator === 1) {
    return String(value.numerator);
  }
  const sign = value.numerator < 0 ? '-' : '';
  return `${sign}${Math.abs(value.numerator)}/${value.denominator}`;
}

/** Decimal de respaldo, sin marca de aproximación. */
export function formatDecimal(value: number, digits = DEFAULT_DIGITS): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const cleaned = Math.abs(value) < ZERO_EPS ? 0 : value;
  if (cleaned !== 0 && (Math.abs(cleaned) >= 100_000 || Math.abs(cleaned) < 0.0001)) {
    return cleaned.toExponential(2).replace('e+', 'e');
  }

  let text = cleaned.toFixed(digits);
  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '');
  }
  return text === '' || text === '-0' ? '0' : text;
}

/** Decimal marcado como aproximación. */
export function formatApprox(value: number, digits = DEFAULT_DIGITS): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return `≈ ${formatDecimal(value, digits)}`;
}

export function toPiFraction(value: number, maxDenominator = 12): Rational | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  return toFraction(value / Math.PI, maxDenominator, 1e-10);
}

/** Formatea un múltiplo de π: `π`, `π/4`, `3π/2`, `-π/3`. */
export function formatPiFraction(value: number, maxDenominator = 12): string | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value === 0) {
    return '0';
  }

  const fraction = toPiFraction(value, maxDenominator);
  if (!fraction) {
    return null;
  }

  const sign = fraction.numerator < 0 ? '-' : '';
  const magnitude = Math.abs(fraction.numerator);
  const numerator = magnitude === 1 ? 'π' : `${magnitude}π`;
  return fraction.denominator === 1
    ? `${sign}${numerator}`
    : `${sign}${numerator}/${fraction.denominator}`;
}

/**
 * Detecta `coeficiente · √radicando` a partir de un valor decimal.
 * Por ejemplo, √8 se devuelve como 2√2 y 1/√2 como √2/2.
 */
export function toSquareRoot(
  value: number,
  maxDenominator = DEFAULT_MAX_DENOMINATOR,
  maxRadicand = DEFAULT_MAX_RADICAND,
): SquareRoot | null {
  if (!Number.isFinite(value) || value === 0) {
    return null;
  }

  const sign = value < 0 ? -1 : 1;
  const square = value * value;
  const fraction = toFraction(square, maxDenominator);
  if (!fraction || fraction.numerator <= 0) {
    return null;
  }

  let remaining = fraction.numerator * fraction.denominator;
  let outside = 1;

  for (let factor = 2; factor * factor <= remaining; factor += 1) {
    const squareFactor = factor * factor;
    while (remaining % squareFactor === 0) {
      remaining /= squareFactor;
      outside *= factor;
    }
  }

  if (remaining === 1 || remaining > maxRadicand) {
    return null;
  }

  return {
    coefficient: rational(sign * outside, fraction.denominator),
    radicand: remaining,
  };
}

/** Formatea `coeficiente · √radicando`, por ejemplo `2√2` o `3√5/2`. */
export function formatSquareRoot(value: SquareRoot): string {
  const sign = value.coefficient.numerator < 0 ? '-' : '';
  const magnitude = Math.abs(value.coefficient.numerator);
  const radical = value.radicand === 1 ? '' : `√${value.radicand}`;
  const numerator = magnitude === 1 ? radical : `${magnitude}${radical}`;

  return value.coefficient.denominator === 1
    ? `${sign}${numerator}`
    : `${sign}${numerator}/${value.coefficient.denominator}`;
}

/**
 * Formato exacto principal:
 * racional → múltiplo de π → raíz → decimal aproximado.
 */
export function formatExact(value: number, options: ExactFormatOptions = {}): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const digits = options.digits ?? DEFAULT_DIGITS;
  const maxDenominator = options.maxDenominator ?? DEFAULT_MAX_DENOMINATOR;
  const maxRadicand = options.maxRadicand ?? DEFAULT_MAX_RADICAND;
  const approximate = options.approximate ?? true;
  const cleaned = Math.abs(value) < ZERO_EPS ? 0 : value;

  if (cleaned === 0) {
    return '0';
  }

  const fraction = toFraction(cleaned, maxDenominator);
  if (fraction) {
    return formatRational(fraction);
  }

  const pi = formatPiFraction(cleaned);
  if (pi) {
    return pi;
  }

  const root = toSquareRoot(cleaned, maxDenominator, maxRadicand);
  if (root) {
    return formatSquareRoot(root);
  }

  const decimal = formatDecimal(cleaned, digits);
  return approximate ? `≈ ${decimal}` : decimal;
}

/** Compatibilidad con el nombre anterior. */
export const formatFraction = formatExact;

const DECIMAL_LITERAL = /(?<![\w.])-?\d*\.\d+(?:e[+-]?\d+)?/gi;

/**
 * Convierte los literales decimales de una expresión simbólica en fracciones.
 * Los paréntesis conservan la precedencia: `x ^ 0.5` pasa a `x ^ (1/2)`.
 */
export function formatExpressionFractions(expression: string): string {
  return expression.replace(DECIMAL_LITERAL, (literal) => {
    const value = Number(literal);
    const fraction = toFraction(value);
    if (!fraction || fraction.denominator === 1) {
      return literal;
    }
    const numerator = Math.abs(fraction.numerator);
    return fraction.numerator < 0
      ? `(-${numerator}/${fraction.denominator})`
      : `(${numerator}/${fraction.denominator})`;
  });
}

// ---------------------------------------------------- autovalores exactos 2×2

interface Surd {
  rational: Rational;
  radical: Rational;
  radicand: number;
}

export interface ExactEigenLabels {
  eigenvalueLabels: string[];
  vectorLabels: string[];
}

/**
 * Construye etiquetas exactas para autovalores y autovectores con radicales.
 * Devuelve `null` cuando los autovalores no son irracionales cuadráticos.
 */
export function exactEigen2x2(
  aValue: number,
  bValue: number,
  cValue: number,
  dValue: number,
): ExactEigenLabels | null {
  const a = toFraction(aValue);
  const b = toFraction(bValue);
  const c = toFraction(cValue);
  const d = toFraction(dValue);
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
  const lambdaPlus = scaleSurd(addSurd(rationalSurd(trace, radicand), rootSurd), half);
  const lambdaMinus = scaleSurd(subtractSurd(rationalSurd(trace, radicand), rootSurd), half);

  const vectors: string[] = [];
  for (const lambda of [lambdaPlus, lambdaMinus]) {
    const direction = directionForLambda(lambda, a, b, c, d, radicand);
    if (!direction) {
      return null;
    }
    vectors.push(formatSurdVector(direction.x, direction.y, radicand));
  }

  return {
    eigenvalueLabels: [formatSurdScalar(lambdaPlus), formatSurdScalar(lambdaMinus)],
    vectorLabels: vectors,
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
  const negative = xIsZero ? yr < 0 || (yr === 0 && yi < 0) : xr < 0 || (xr === 0 && xi < 0);
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
