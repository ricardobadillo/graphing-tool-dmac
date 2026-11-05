import { compile, type EvalFunction } from 'mathjs/number';

export const CURVE_PALETTE = [
  '#38bdf8',
  '#f472b6',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#22d3ee',
  '#c084fc',
] as const;

export interface PlotFunction {
  id: number;
  /** Texto tal como lo escribió el usuario. */
  expression: string;
  color: string;
  visible: boolean;
  compiled: EvalFunction | null;
  error: string | null;
}

export interface CompiledExpression {
  normalized: string;
  compiled: EvalFunction | null;
  error: string | null;
}

/**
 * mathjs usa `log` como logaritmo natural, pero en la mayoría de las
 * calculadoras `log` es base 10 y `ln` es natural. El ámbito compartido añade
 * alias y funciones trigonométricas inversas habituales.
 */
const scope: Record<string, unknown> = {
  x: 0,
  t: 0,
  theta: 0,
  a: 1,
  b: 1,
  c: 0,
  d: 0,
  piecewise: (...args: unknown[]) => {
    for (let index = 0; index + 1 < args.length; index += 2) {
      if (args[index]) {
        return args[index + 1];
      }
    }
    return Number.NaN;
  },
  ln: Math.log,
  log: (value: number, base?: number) =>
    base === undefined ? Math.log10(value) : Math.log(value) / Math.log(base),
  log10: Math.log10,
  sec: (value: number) => 1 / Math.cos(value),
  csc: (value: number) => 1 / Math.sin(value),
  cot: (value: number) => 1 / Math.tan(value),
};

/** Normaliza símbolos y prefijos como `y =`, `f(x) =`, `π` o `τ`. */
export function normalizeExpression(expression: string): string {
  return expression
    .replace(/[−–—]/g, '-')
    .replace(/π(?=[a-zA-Z0-9(])/g, 'pi*')
    .replace(/π/g, 'pi')
    .replace(/τ(?=[a-zA-Z0-9(])/g, 'tau*')
    .replace(/τ/g, 'tau')
    .replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '')
    .trim();
}

/**
 * Compila una expresión y verifica que devuelva un número para valores de
 * prueba. Las variables permitidas se declaran explícitamente.
 */
export function compileExpression(
  expression: string,
  variables: readonly string[] = ['x'],
): CompiledExpression {
  const normalized = normalizeExpression(expression);

  if (!normalized) {
    return { normalized, compiled: null, error: null };
  }

  try {
    const compiled = compile(normalized);
    for (const variable of variables) {
      scope[variable] = 1.234567;
    }

    const probe = compiled.evaluate(scope);
    if (typeof probe !== 'number') {
      return {
        normalized,
        compiled: null,
        error: 'La expresión debe devolver un número.',
      };
    }

    return { normalized, compiled, error: null };
  } catch (error) {
    return { normalized, compiled: null, error: describeExpressionError(error) };
  }
}

/** Evalúa una expresión compilada con los valores de sus variables. */
export function evaluateExpression(
  compiled: EvalFunction,
  values: Readonly<Record<string, number>>,
): number {
  for (const [name, value] of Object.entries(values)) {
    scope[name] = value;
  }

  try {
    const value = compiled.evaluate(scope);
    return typeof value === 'number' ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

/** Evalúa una expresión compilada de una sola variable `x`. */
export function evaluateAt(
  compiled: EvalFunction,
  x: number,
  values: Readonly<Record<string, number>> = {},
): number {
  return evaluateExpression(compiled, { ...values, x });
}

export function createPlotFunction(id: number, expression: string, color: string): PlotFunction {
  const result = compileExpression(expression, ['x']);

  return {
    id,
    expression,
    color,
    visible: true,
    compiled: result.compiled,
    error: result.error,
  };
}

/**
 * Convierte una expresión a la sintaxis que entiende `mathjs.derivative`.
 * `ln` se convierte en `log` y `log` (base 10) en `log10`.
 */
export function toSymbolicExpression(expression: string): string | null {
  const normalized = normalizeExpression(expression);
  if (!normalized) {
    return null;
  }

  // `derivative` no soporta logaritmos de dos argumentos.
  if (/\blog\s*\([^()]*,[^()]*\)/.test(normalized)) {
    return null;
  }

  return normalized.replace(/\blog\s*\(/g, 'log10(').replace(/\bln\s*\(/g, 'log(');
}

export function describeExpressionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.split('\n')[0]?.trim() ?? '';

  const unknownSymbol = message.match(/Undefined symbol\s+(\S+)/i);
  if (unknownSymbol) {
    return `Símbolo no reconocido: ${unknownSymbol[1]}`;
  }

  const unknownFunction = message.match(/Undefined function\s+(\S+)/i);
  if (unknownFunction) {
    return `Función no reconocida: ${unknownFunction[1]}`;
  }

  if (/Unexpected end/i.test(message)) {
    return 'La expresión está incompleta.';
  }

  if (/Parenthesis/i.test(message)) {
    return 'Revisa los paréntesis.';
  }

  if (/Unexpected character|Unexpected type|Value expected/i.test(message)) {
    return 'La expresión no es válida.';
  }

  return message || 'Expresión no válida.';
}
