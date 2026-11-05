import {
  exactEigen2x2,
  formatApprox,
  formatDecimal,
  formatExact,
  formatExpressionFractions,
  formatPiFraction,
  toFraction,
  toSquareRoot,
} from './exact-number';

describe('números exactos', () => {
  it('encuentra fracciones exactas reducidas', () => {
    expect(toFraction(0.5)).toEqual({ numerator: 1, denominator: 2 });
    expect(toFraction(-3 / 4)).toEqual({ numerator: -3, denominator: 4 });
    expect(toFraction(1 / 3)).toEqual({ numerator: 1, denominator: 3 });
    expect(toFraction(2)).toEqual({ numerator: 2, denominator: 1 });
  });

  it('formatea racionales como fracciones, no como decimales', () => {
    expect(formatExact(0.5)).toBe('1/2');
    expect(formatExact(-1.25)).toBe('-5/4');
    expect(formatExact(0)).toBe('0');
    expect(formatExact(3)).toBe('3');
    expect(formatExact(1 / 3)).toBe('1/3');
  });

  it('reconoce múltiplos de π', () => {
    expect(formatPiFraction(Math.PI)).toBe('π');
    expect(formatPiFraction(Math.PI / 4)).toBe('π/4');
    expect(formatPiFraction((3 * Math.PI) / 2)).toBe('3π/2');
    expect(formatPiFraction(-Math.PI / 3)).toBe('-π/3');
    expect(formatExact(Math.PI / 2)).toBe('π/2');
  });

  it('reconoce raíces cuadradas y las simplifica', () => {
    expect(toSquareRoot(Math.SQRT2)).toEqual({
      coefficient: { numerator: 1, denominator: 1 },
      radicand: 2,
    });
    expect(formatExact(Math.SQRT2)).toBe('√2');
    expect(formatExact(2 * Math.SQRT2)).toBe('2√2');
    expect(formatExact(Math.sqrt(5))).toBe('√5');
    expect(formatExact(1 / Math.SQRT2)).toBe('√2/2');
  });

  it('usa ≈ solo cuando no hay forma exacta', () => {
    expect(formatExact(Math.E, { digits: 3 })).toBe('≈ 2.718');
    expect(formatApprox(1 / 3, 4)).toBe('≈ 0.3333');
    expect(formatDecimal(1 / 3, 4)).toBe('0.3333');
    expect(formatExact(Number.NaN)).toBe('—');
  });

  it('convierte literales decimales dentro de expresiones', () => {
    expect(formatExpressionFractions('0.5 * x')).toBe('(1/2) * x');
    expect(formatExpressionFractions('x ^ 0.5')).toBe('x ^ (1/2)');
    expect(formatExpressionFractions('x - -0.25')).toBe('x - (-1/4)');
    expect(formatExpressionFractions('cos(x) + 3')).toBe('cos(x) + 3');
  });

  it('calcula etiquetas exactas para autovalores irracionales', () => {
    const golden = exactEigen2x2(1, 1, 1, 0);

    expect(golden?.eigenvalueLabels).toEqual(['(1 + √5)/2', '(1 − √5)/2']);
    expect(golden?.vectorLabels).toEqual(['(2, −1 + √5)', '(2, −1 − √5)']);
    expect(exactEigen2x2(2, 0, 0, 1)).toBeNull();
  });
});
