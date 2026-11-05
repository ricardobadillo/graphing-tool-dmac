/**
 * Formato numérico común de la aplicación.
 *
 * Todas las cantidades que se muestran al usuario pasan por aquí para que los
 * resultados exactos se expresen como fracciones en lugar de decimales.
 * Cuando un valor no tiene una fracción exacta (π, √2, resultados de
 * probabilidad, etc.) se conserva el decimal como respaldo.
 */

export interface Fraction {
  numerator: number;
  denominator: number;
}

export interface FractionFormatOptions {
  /** Mayor denominador que se acepta al buscar una fracción exacta. */
  maxDenominator?: number;
  /** Dígitos decimales del respaldo cuando no hay fracción exacta. */
  digits?: number;
  /** Tolerancia para considerar que la fracción representa el valor. */
  tolerance?: number;
}

const DEFAULT_MAX_DENOMINATOR = 1000;
const DEFAULT_DIGITS = 3;
const ZERO_EPS = 1e-9;

/**
 * Busca una fracción exacta (o indistinguible en coma flotante) para `value`.
 * Devuelve `null` si no existe una con denominador suficientemente pequeño.
 */
export function toFraction(
  value: number,
  maxDenominator = DEFAULT_MAX_DENOMINATOR,
  tolerance?: number,
): Fraction | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (Number.isInteger(value)) {
    return { numerator: value, denominator: 1 };
  }

  const sign = value < 0 ? -1 : 1;
  const target = Math.abs(value);
  const allowed = tolerance ?? Math.max(ZERO_EPS, target * 1e-12);

  // Fracciones continuas: generan las mejores aproximaciones con el menor
  // denominador posible.
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

/**
 * Formatea un número como fracción cuando es exacto; si no, usa el formato
 * decimal habitual. El signo se devuelve con el guion ASCII para que cada
 * pantalla pueda sustituirlo por el signo menos tipográfico si lo necesita.
 */
export function formatFraction(value: number, options: FractionFormatOptions = {}): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const digits = options.digits ?? DEFAULT_DIGITS;
  const maxDenominator = options.maxDenominator ?? DEFAULT_MAX_DENOMINATOR;
  const cleaned = Math.abs(value) < ZERO_EPS ? 0 : value;

  if (cleaned === 0) {
    return '0';
  }

  const fraction = toFraction(cleaned, maxDenominator, options.tolerance);
  if (fraction) {
    if (fraction.denominator === 1) {
      return String(fraction.numerator);
    }
    return `${fraction.numerator < 0 ? '-' : ''}${Math.abs(fraction.numerator)}/${fraction.denominator}`;
  }

  return formatDecimal(cleaned, digits);
}

/** Formato decimal de respaldo, idéntico al que usaba la aplicación. */
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

/** Fracción de π exacta, por ejemplo `π/4` o `3π/2`. */
export function formatPiFraction(value: number, maxDenominator = 12): string | null {
  if (!Number.isFinite(value) || value === 0) {
    return value === 0 ? '0' : null;
  }

  const fraction = toFraction(value / Math.PI, maxDenominator, 1e-10);
  if (!fraction) {
    return null;
  }

  const sign = fraction.numerator < 0 ? '-' : '';
  const magnitude = Math.abs(fraction.numerator);
  const numerator = magnitude === 1 ? 'π' : `${magnitude}π`;

  return fraction.denominator === 1 ? `${sign}${numerator}` : `${sign}${numerator}/${fraction.denominator}`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x || 1;
}
