import {
  formatDecimal,
  formatExpressionFractions,
  formatFraction,
  formatPiFraction,
  toFraction,
} from './number-format';

describe('formato de fracciones', () => {
  it('encuentra fracciones exactas reducidas', () => {
    expect(toFraction(0.5)).toEqual({ numerator: 1, denominator: 2 });
    expect(toFraction(-3 / 4)).toEqual({ numerator: -3, denominator: 4 });
    expect(toFraction(1 / 3)).toEqual({ numerator: 1, denominator: 3 });
    expect(toFraction(2)).toEqual({ numerator: 2, denominator: 1 });
  });

  it('rechaza aproximaciones con denominadores grandes', () => {
    expect(toFraction(Math.PI)).toBeNull();
    expect(toFraction(Math.SQRT2)).toBeNull();
  });

  it('formatea resultados racionales como fracciones', () => {
    expect(formatFraction(0.5)).toBe('1/2');
    expect(formatFraction(-1.25)).toBe('-5/4');
    expect(formatFraction(0)).toBe('0');
    expect(formatFraction(3)).toBe('3');
  });

  it('mantiene el decimal para valores sin fracción exacta', () => {
    expect(formatFraction(Math.PI, { digits: 3 })).toBe('3.142');
    expect(formatFraction(1 / 6, { digits: 3 })).toBe('1/6');
    expect(formatFraction(Number.NaN)).toBe('—');
  });

  it('expresa ángulos como fracciones de π', () => {
    expect(formatPiFraction(Math.PI / 4)).toBe('π/4');
    expect(formatPiFraction((3 * Math.PI) / 2)).toBe('3π/2');
    expect(formatPiFraction(0)).toBe('0');
    expect(formatPiFraction(0.9272952180016122)).toBeNull();
  });

  it('convierte literales decimales dentro de expresiones', () => {
    expect(formatExpressionFractions('0.5 * x')).toBe('(1/2) * x');
    expect(formatExpressionFractions('x ^ 0.5')).toBe('x ^ (1/2)');
    expect(formatExpressionFractions('x - -0.25')).toBe('x - (-1/4)');
    expect(formatExpressionFractions('cos(x) + 3')).toBe('cos(x) + 3');
  });

  it('conserva el formato decimal de respaldo', () => {
    expect(formatDecimal(1 / 3, 4)).toBe('0.3333');
    expect(formatDecimal(0.00001)).toBe('1.00e-5');
    expect(formatDecimal(Number.NaN)).toBe('—');
  });
});
