import {
  compileCalculusFunction,
  formatCalc,
  numericDerivative,
  riemannConvergence,
  riemannSum,
  simpsonReference,
} from './calculus';

describe('motor de cálculo', () => {
  it('compila funciones y calcula derivadas simbólicas', () => {
    const quadratic = compileCalculusFunction('x^2 / 4');
    const sine = compileCalculusFunction('sin(x)');
    const naturalLog = compileCalculusFunction('ln(x)');

    expect(quadratic.error).toBeNull();
    expect(quadratic.compiled).not.toBeNull();
    expect(quadratic.symbolicDerivative).toContain('1/2');
    expect(sine.symbolicDerivative).toBe('cos(x)');
    expect(naturalLog.symbolicDerivative).toBe('1 / x');
  });

  it('usa derivada numérica compatible con el graficador', () => {
    const quadratic = compileCalculusFunction('x^2 / 4');

    expect(numericDerivative(quadratic.compiled!, 2)).toBeCloseTo(1, 5);
  });

  it('calcula una referencia de integral con Simpson', () => {
    const quadratic = compileCalculusFunction('x^2 / 4');

    expect(simpsonReference(quadratic.compiled!, 0, 4)).toBeCloseTo(64 / 12, 6);
  });

  it('aplica los cuatro métodos de Riemann', () => {
    const line = compileCalculusFunction('2x');
    const left = riemannSum(line.compiled!, 0, 3, 3, 'left');
    const right = riemannSum(line.compiled!, 0, 3, 3, 'right');
    const midpoint = riemannSum(line.compiled!, 0, 3, 3, 'midpoint');
    const trapezoid = riemannSum(line.compiled!, 0, 3, 3, 'trapezoid');

    expect(left.sum).toBeCloseTo(6);
    expect(right.sum).toBeCloseTo(12);
    expect(midpoint.sum).toBeCloseTo(9);
    expect(trapezoid.sum).toBeCloseTo(9);
    expect(left.bars).toHaveLength(3);
    expect(left.bars[0].sampleX).toBe(0);
  });

  it('genera la tabla de convergencia', () => {
    const quadratic = compileCalculusFunction('x^2 / 4');
    const rows = riemannConvergence(quadratic.compiled!, 0, 4, 'midpoint');

    expect(rows).toHaveLength(8);
    expect(rows[0].n).toBe(1);
    expect(rows.at(-1)?.error).toBeLessThan(rows[0].error);
  });

  it('formatea números para la interfaz', () => {
    expect(formatCalc(1 / 3)).toBe('1/3');
    expect(formatCalc(0.25)).toBe('1/4');
    expect(formatCalc(2)).toBe('2');
    expect(formatCalc(Math.PI)).toBe('3.1416');
    expect(formatCalc(Number.NaN)).toBe('—');
  });
});
