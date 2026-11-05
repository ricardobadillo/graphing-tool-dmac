import {
  factorial,
  fourierPartial,
  fourierTerms,
  sampleCurve,
  taylorSeries,
  taylorValue,
  waveTarget,
} from './analysis';

describe('serie de Taylor', () => {
  it('calcula los coeficientes de sin(x) en 0', () => {
    const result = taylorSeries('sin(x)', 0, 5);
    expect(result.error).toBeNull();
    const coefficients = result.coefficients!;
    expect(coefficients[0]).toBeCloseTo(0);
    expect(coefficients[1]).toBeCloseTo(1);
    expect(coefficients[2]).toBeCloseTo(0);
    expect(coefficients[3]).toBeCloseTo(-1 / 6);
    expect(coefficients[4]).toBeCloseTo(0);
    expect(coefficients[5]).toBeCloseTo(1 / 120);
  });

  it('evalúa el polinomio cerca del centro', () => {
    const result = taylorSeries('sin(x)', 0, 7);
    const value = taylorValue(result.coefficients!, 0, 0.5);
    expect(value).toBeCloseTo(Math.sin(0.5), 5);
  });

  it('reporta errores de expresión y centro', () => {
    expect(taylorSeries('sin(', 0, 3).error).toBeTruthy();
    expect(taylorSeries('sin(x)', 0, 20).error).toBeTruthy();
  });
});

describe('serie de Fourier', () => {
  it('genera los términos correctos para cada onda', () => {
    expect(fourierTerms('square', 3).map((term) => term.k)).toEqual([1, 3, 5]);
    expect(fourierTerms('sawtooth', 3).map((term) => term.k)).toEqual([1, 2, 3]);
    expect(fourierTerms('triangle', 2).map((term) => term.k)).toEqual([1, 3]);
  });

  it('aproxima la onda cuadrada y la triangular', () => {
    expect(fourierPartial('square', 20, Math.PI / 2)).toBeGreaterThan(0.97);
    expect(fourierPartial('square', 20, Math.PI / 2)).toBeLessThan(1.03);
    expect(fourierPartial('triangle', 10, Math.PI / 2)).toBeGreaterThan(0.97);
    expect(fourierPartial('triangle', 10, Math.PI / 2)).toBeLessThan(1.03);
    expect(waveTarget('square', Math.PI / 2)).toBe(1);
    expect(waveTarget('triangle', Math.PI / 2)).toBeCloseTo(1);
  });
});

describe('utilidades de análisis', () => {
  it('calcula factoriales y muestrea curvas', () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(5)).toBe(120);
    const curve = sampleCurve('x^2', -1, 1, 4);
    expect(curve.error).toBeNull();
    expect(curve.points).toHaveLength(5);
    expect(curve.points[0].y).toBeCloseTo(1);
    expect(curve.points[4].y).toBeCloseTo(1);
  });

  it('maneja expresiones inválidas', () => {
    const curve = sampleCurve('x +', -1, 1, 10);
    expect(curve.error).toBeTruthy();
  });
});
