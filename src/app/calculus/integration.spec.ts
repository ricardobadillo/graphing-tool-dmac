import {
  analyzeImproper,
  arcLength,
  areaBetween,
  integrate,
  partialFractions,
  verifyParts,
  verifySubstitution,
  volumeRevolution,
} from './integration';

describe('integración', () => {
  it('integra polinomios con Simpson', () => {
    expect(integrate((x) => x * x, 0, 1)).toBeCloseTo(1 / 3, 6);
  });

  it('detecta una integral impropia convergente', () => {
    const result = analyzeImproper((x) => 1 / Math.sqrt(x), 0, 1);

    expect(result.convergent).toBe(true);
    expect(result.value).toBeCloseTo(2, 1);
    expect(result.singularities).toContain(0);
  });

  it('detecta una integral impropia divergente', () => {
    const result = analyzeImproper((x) => 1 / x, -1, 1);

    expect(result.convergent).toBe(false);
    expect(result.singularities.some((value) => Math.abs(value) < 1e-6)).toBe(true);
  });

  it('calcula el área entre dos curvas', () => {
    const result = areaBetween(
      (x) => x,
      (x) => x * x,
      0,
      1,
    );

    expect(result.area).toBeCloseTo(1 / 6, 5);
    expect(result.intersections.length).toBeGreaterThanOrEqual(2);
  });

  it('calcula longitud de arco y volumen de revolución', () => {
    expect(arcLength((x) => x, 0, 1)).toBeCloseTo(Math.SQRT2, 5);
    expect(volumeRevolution((x) => Math.sqrt(x), 0, 1)).toBeCloseTo(Math.PI / 2, 3);
  });

  it('verifica una sustitución', () => {
    const result = verifySubstitution(
      (x) => 2 * x * Math.cos(x * x),
      (x) => x * x,
      (u) => Math.cos(u),
      0,
      1,
    );

    expect(result.difference).toBeLessThan(1e-4);
    expect(result.ua).toBe(0);
    expect(result.ub).toBe(1);
  });

  it('verifica integración por partes', () => {
    const result = verifyParts(
      (x) => x,
      (x) => Math.exp(x),
      0,
      1,
    );

    expect(result.left).toBeCloseTo(1, 4);
    expect(result.difference).toBeLessThan(1e-3);
  });

  it('descompone una fracción con raíces simples', () => {
    const result = partialFractions(() => 1, [1, 2], 3, 4);

    expect(result.error).toBeNull();
    expect(result.coefficients[0]).toBeCloseTo(-1);
    expect(result.coefficients[1]).toBeCloseTo(1);
    expect(result.integral).toBeCloseTo(Math.log(4 / 3), 5);
  });

  it('rechaza raíces inválidas', () => {
    expect(partialFractions(() => 1, [], 0, 1).error).toBeTruthy();
    expect(partialFractions(() => 1, [1, Number.NaN], 0, 1).error).toBeTruthy();
  });
});
