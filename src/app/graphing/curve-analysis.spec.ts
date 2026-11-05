import { analyzeCurve } from './curve-analysis';

describe('análisis de curvas', () => {
  it('encuentra raíz, mínimo y monotonía de una parábola', () => {
    const analysis = analyzeCurve((x) => x * x, -2, 2, 600);

    expect(analysis.roots).toHaveLength(1);
    expect(analysis.roots[0]).toBeCloseTo(0, 3);
    expect(analysis.minima).toHaveLength(1);
    expect(analysis.minima[0].x).toBeCloseTo(0, 2);
    expect(analysis.maxima).toHaveLength(0);
    expect(analysis.monotonic.some((interval) => interval.direction === 'decreasing')).toBe(true);
    expect(analysis.monotonic.some((interval) => interval.direction === 'increasing')).toBe(true);
  });

  it('encuentra raíces y extremos de sin(x)', () => {
    const analysis = analyzeCurve((x) => Math.sin(x), -Math.PI, Math.PI, 600);

    expect(analysis.roots.length).toBeGreaterThanOrEqual(2);
    expect(analysis.maxima.length).toBeGreaterThanOrEqual(1);
    expect(analysis.minima.length).toBeGreaterThanOrEqual(1);
    expect(analysis.inflections.length).toBeGreaterThanOrEqual(1);
  });

  it('detecta asíntota vertical y horizontal en 1/x', () => {
    const analysis = analyzeCurve((x) => (x === 0 ? Number.POSITIVE_INFINITY : 1 / x), -5, 5, 600);

    expect(analysis.verticalAsymptotes.some((value) => Math.abs(value) < 0.1)).toBe(true);
    expect(analysis.horizontalAsymptotes.some((value) => Math.abs(value.y) < 0.01)).toBe(true);
    expect(analysis.maxima).toHaveLength(0);
    expect(analysis.minima).toHaveLength(0);
    expect(analysis.monotonic.length).toBeGreaterThanOrEqual(2);
  });

  it('detecta un punto de inflexión en x^3', () => {
    const analysis = analyzeCurve((x) => x ** 3, -2, 2, 600);

    expect(analysis.inflections.some((value) => Math.abs(value) < 0.1)).toBe(true);
  });

  it('devuelve un análisis vacío para rangos inválidos', () => {
    const analysis = analyzeCurve((x) => x, 1, 1);

    expect(analysis.sampled).toBe(false);
    expect(analysis.roots).toEqual([]);
  });
});
