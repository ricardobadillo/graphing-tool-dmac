import {
  compileCurve,
  evaluateCurve,
  normalizeCurveExpression,
  sampleParametric,
  samplePolar,
} from './curves';

describe('curvas polares y paramétricas', () => {
  it('normaliza prefijos y símbolos', () => {
    expect(normalizeCurveExpression('r = 1 + cos(θ)')).toBe('1 + cos(theta)');
    expect(normalizeCurveExpression('r(θ) = 2 * sin(3θ)')).toBe('2 * sin(3theta)');
    expect(normalizeCurveExpression('x(t) = 3 * cos(t)')).toBe('3 * cos(t)');
    expect(normalizeCurveExpression('π * t')).toBe('pi * t');
  });

  it('compila y evalúa una función polar', () => {
    const curve = compileCurve('1 + cos(theta)', 'theta');

    expect(curve.error).toBeNull();
    expect(curve.compiled).not.toBeNull();
    expect(evaluateCurve(curve.compiled!, 'theta', 0)).toBeCloseTo(2);
    expect(evaluateCurve(curve.compiled!, 'theta', Math.PI)).toBeCloseTo(0);
  });

  it('muestrea una cardioide', () => {
    const curve = compileCurve('1 + cos(theta)', 'theta');
    const points = samplePolar(curve.compiled!, 0, 2 * Math.PI, 400);

    expect(points.length).toBeGreaterThan(300);
    expect(Math.max(...points.map((point) => point.x))).toBeCloseTo(2, 2);
    expect(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(
      true,
    );
  });

  it('muestrea una curva paramétrica', () => {
    const xCurve = compileCurve('3 * cos(t)', 't');
    const yCurve = compileCurve('2 * sin(2 * t)', 't');
    const points = sampleParametric(xCurve.compiled!, yCurve.compiled!, 0, 2 * Math.PI);

    expect(points.length).toBeGreaterThan(800);
    expect(Math.max(...points.map((point) => Math.abs(point.x)))).toBeCloseTo(3, 2);
    expect(Math.max(...points.map((point) => Math.abs(point.y)))).toBeCloseTo(2, 2);
  });

  it('reporta errores y rangos inválidos', () => {
    const invalid = compileCurve('foo(theta)', 'theta');
    const valid = compileCurve('1 + cos(theta)', 'theta');

    expect(invalid.error).toContain('foo');
    expect(samplePolar(valid.compiled!, 2, 1)).toEqual([]);
  });
});
