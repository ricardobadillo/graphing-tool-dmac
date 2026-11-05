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

/**
 * mathjs usa `log` como logaritmo natural, pero en la mayoría de las
 * calculadoras `log` es base 10 y `ln` es natural. Añadimos alias y
 * funciones trigonométricas inversas habituales al ámbito de evaluación.
 */
const scope: Record<string, unknown> = {
  x: 0,
  ln: Math.log,
  log: (value: number, base?: number) =>
    base === undefined ? Math.log10(value) : Math.log(value) / Math.log(base),
  sec: (value: number) => 1 / Math.cos(value),
  csc: (value: number) => 1 / Math.sin(value),
  cot: (value: number) => 1 / Math.tan(value),
};

/** Permite escribir `y = sin(x)` o `f(x) = sin(x)` además de `sin(x)`. */
export function normalizeExpression(expression: string): string {
  return expression.replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '').trim();
}

/** Evalúa una expresión compilada. Devuelve NaN si el punto no es real o falla. */
export function evaluateAt(compiled: EvalFunction, x: number): number {
  scope['x'] = x;
  try {
    const value = compiled.evaluate(scope);
    return typeof value === 'number' ? value : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

export function createPlotFunction(id: number, expression: string, color: string): PlotFunction {
  const normalized = normalizeExpression(expression);

  if (!normalized) {
    return {
      id,
      expression,
      color,
      visible: true,
      compiled: null,
      error: null,
    };
  }

  try {
    const compiled = compile(normalized);

    // Una evaluación de prueba detecta símbolos y funciones desconocidas
    // antes de intentar dibujar la curva.
    scope['x'] = 1.234567;
    const probe = compiled.evaluate(scope);

    if (typeof probe !== 'number') {
      return {
        id,
        expression,
        color,
        visible: true,
        compiled: null,
        error: 'La expresión debe devolver un número.',
      };
    }

    return {
      id,
      expression,
      color,
      visible: true,
      compiled,
      error: null,
    };
  } catch (error) {
    return {
      id,
      expression,
      color,
      visible: true,
      compiled: null,
      error: describeExpressionError(error),
    };
  }
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
