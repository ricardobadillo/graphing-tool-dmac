import { compileExpression } from '../shared/expression';
import { analyzeLimit, continuityLabel, formatLimit } from './limits';

function compile(expression: string) {
  const result = compileExpression(expression, ['x']);
  expect(result.error).toBeNull();
  return result.compiled!;
}

describe('límites y continuidad', () => {
  it('detecta una función continua', () => {
    const analysis = analyzeLimit(compile('x^2'), 2);

    expect(analysis?.kind).toBe('continuous');
    expect(analysis?.twoSidedLimit).toBeCloseTo(4, 3);
    expect(analysis?.valueAtPoint).toBeCloseTo(4, 6);
  });

  it('detecta una discontinuidad evitable', () => {
    const analysis = analyzeLimit(compile('(x^2 - 1) / (x - 1)'), 1);

    expect(analysis?.kind).toBe('removable');
    expect(analysis?.twoSidedLimit).toBeCloseTo(2, 3);
    expect(analysis?.valueAtPoint).toBeNull();
  });

  it('detecta un salto', () => {
    const analysis = analyzeLimit(compile('abs(x) / x'), 0);

    expect(analysis?.kind).toBe('jump');
    expect(analysis?.leftLimit).toBeCloseTo(-1, 6);
    expect(analysis?.rightLimit).toBeCloseTo(1, 6);
  });

  it('detecta una asíntota vertical', () => {
    const analysis = analyzeLimit(compile('1 / x'), 0);

    expect(analysis?.kind).toBe('infinite');
    expect(analysis?.twoSidedLimit).toBeNull();
  });

  it('estima el límite notable sin(x)/x', () => {
    const analysis = analyzeLimit(compile('sin(x) / x'), 0);

    expect(analysis?.kind).toBe('removable');
    expect(analysis?.twoSidedLimit).toBeCloseTo(1, 5);
  });

  it('rechaza puntos no finitos', () => {
    expect(analyzeLimit(compile('x'), Number.NaN)).toBeNull();
  });

  it('formatea etiquetas y valores', () => {
    expect(continuityLabel('removable')).toContain('evitable');
    expect(formatLimit(null)).toBe('no existe');
    expect(formatLimit(1 / 3)).toBe('0.3333');
  });
});
