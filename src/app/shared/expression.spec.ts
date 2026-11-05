import {
  createPlotFunction,
  evaluateAt,
  normalizeExpression,
  toSymbolicExpression,
} from './expression';

describe('motor de expresiones compartido', () => {
  it('normaliza prefijos y símbolos matemáticos', () => {
    expect(normalizeExpression(' y = sin(πx) ')).toBe('sin(pi*x)');
    expect(normalizeExpression('f(x) = 2τ')).toBe('2tau');
  });

  it('mantiene log base 10 y ln natural', () => {
    const base10 = createPlotFunction(1, 'log(100)', '#38bdf8');
    const natural = createPlotFunction(2, 'ln(e)', '#38bdf8');

    expect(evaluateAt(base10.compiled!, 0)).toBeCloseTo(2);
    expect(evaluateAt(natural.compiled!, 0)).toBeCloseTo(1);
  });

  it('prepara expresiones para la derivada simbólica', () => {
    expect(toSymbolicExpression('ln(x)')).toBe('log(x)');
    expect(toSymbolicExpression('log(x)')).toBe('log10(x)');
    expect(toSymbolicExpression('log(x, 2)')).toBeNull();
  });

  it('evalúa expresiones con π y prefijos', () => {
    const fn = createPlotFunction(1, 'f(x) = sin(π / 2)', '#38bdf8');

    expect(fn.error).toBeNull();
    expect(evaluateAt(fn.compiled!, 0)).toBeCloseTo(1);
  });

  it('evalúa funciones definidas por tramos', () => {
    const fn = createPlotFunction(1, 'piecewise(x < 0, -x, x >= 0, x)', '#38bdf8');

    expect(fn.error).toBeNull();
    expect(evaluateAt(fn.compiled!, -2)).toBeCloseTo(2);
    expect(evaluateAt(fn.compiled!, 3)).toBeCloseTo(3);
  });

  it('no confunde la constante pi con palabras que empiezan por pi', () => {
    const fn = createPlotFunction(1, 'piecewise(x < 0, -x, x >= 0, x)', '#38bdf8');

    expect(fn.error).toBeNull();
  });
});
