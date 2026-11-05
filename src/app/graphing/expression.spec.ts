import { createPlotFunction, evaluateAt, normalizeExpression } from './expression';

describe('expression engine', () => {
  it('normaliza prefijos como y = o f(x) =', () => {
    expect(normalizeExpression('  y = sin(x) ')).toBe('sin(x)');
    expect(normalizeExpression('f(x) = x^2')).toBe('x^2');
    expect(normalizeExpression('2x')).toBe('2x');
  });

  it('soporta multiplicación implícita y constantes', () => {
    const fn = createPlotFunction(1, '2x + sin(pi / 2)', '#38bdf8');

    expect(fn.error).toBeNull();
    expect(fn.compiled).not.toBeNull();
    expect(evaluateAt(fn.compiled!, 3)).toBeCloseTo(7);
  });

  it('usa log como base 10 y ln como logaritmo natural', () => {
    const base10 = createPlotFunction(1, 'log(100)', '#38bdf8');
    const natural = createPlotFunction(2, 'ln(e)', '#38bdf8');

    expect(evaluateAt(base10.compiled!, 0)).toBeCloseTo(2);
    expect(evaluateAt(natural.compiled!, 0)).toBeCloseTo(1);
  });

  it('reporta funciones desconocidas', () => {
    const fn = createPlotFunction(1, 'foo(x)', '#38bdf8');

    expect(fn.compiled).toBeNull();
    expect(fn.error).toContain('foo');
  });

  it('trata una expresión vacía como un hueco válido', () => {
    const fn = createPlotFunction(1, '   ', '#38bdf8');

    expect(fn.compiled).toBeNull();
    expect(fn.error).toBeNull();
  });
});
