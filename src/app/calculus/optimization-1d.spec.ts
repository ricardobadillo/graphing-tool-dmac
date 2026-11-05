import { analyzeOptimization1D } from './optimization-1d';

describe('optimización 1D', () => {
  it('encuentra el mínimo de x^2 y los extremos globales', () => {
    const result = analyzeOptimization1D('x^2', -2, 2);

    expect(result.error).toBeNull();
    expect(result.minima).toHaveLength(1);
    expect(result.minima[0].x).toBeCloseTo(0, 3);
    expect(result.minima[0].y).toBeCloseTo(0, 5);
    expect(result.minima[0].secondDerivative).toBeGreaterThan(0);
    expect(result.maxima).toHaveLength(0);
    expect(result.globalMin?.x).toBeCloseTo(0, 3);
    expect(result.globalMax?.y).toBeCloseTo(4, 3);
  });

  it('detecta concavidad e inflexión en x^3', () => {
    const result = analyzeOptimization1D('x^3', -2, 2);

    expect(result.inflections.some((value) => Math.abs(value) < 0.1)).toBe(true);
    expect(result.concavity.some((interval) => interval.direction === 'down')).toBe(true);
    expect(result.concavity.some((interval) => interval.direction === 'up')).toBe(true);
    expect(result.globalMax?.y).toBeCloseTo(8, 3);
    expect(result.globalMin?.y).toBeCloseTo(-8, 3);
  });

  it('encuentra máximo y mínimo de sin(x) en [0, 2π]', () => {
    const result = analyzeOptimization1D('sin(x)', 0, 2 * Math.PI);

    expect(result.maxima.some((point) => Math.abs(point.x - Math.PI / 2) < 0.1)).toBe(true);
    expect(result.minima.some((point) => Math.abs(point.x - (3 * Math.PI) / 2) < 0.1)).toBe(true);
    expect(result.maxima[0].secondDerivative).toBeLessThan(0);
    expect(result.minima[0].secondDerivative).toBeGreaterThan(0);
  });

  it('rechaza intervalos inválidos y funciones inválidas', () => {
    expect(analyzeOptimization1D('x^2', 2, 2).error).toBeTruthy();
    expect(analyzeOptimization1D('sin(', -1, 1).error).toBeTruthy();
  });
});
