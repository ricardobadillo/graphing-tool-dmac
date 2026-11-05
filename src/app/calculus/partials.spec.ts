import { analyzePartials, directionalDerivative, tangentPlane } from './partials';

describe('derivadas parciales y gradiente', () => {
  it('calcula derivadas parciales de x^2 + y^2', () => {
    const result = analyzePartials('x^2 + y^2', 1, 2);

    expect(result.error).toBeNull();
    expect(result.numeric?.fx).toBeCloseTo(2, 5);
    expect(result.numeric?.fy).toBeCloseTo(4, 5);
    expect(result.gradient?.x).toBeCloseTo(2, 5);
    expect(result.gradient?.y).toBeCloseTo(4, 5);
    expect(result.symbolic.fx).toContain('2');
    expect(result.symbolic.fy).toContain('2');
  });

  it('calcula derivada direccional', () => {
    expect(directionalDerivative(2, 4, 0)).toBeCloseTo(2);
    expect(directionalDerivative(2, 4, Math.PI / 2)).toBeCloseTo(4);
  });

  it('construye el plano tangente', () => {
    const plane = tangentPlane('x^2 + y^2', 1, 2, 2, 4);

    expect(plane?.z).toBeCloseTo(5);
    expect(plane?.equation).toContain('5');
  });

  it('reporta funciones inválidas', () => {
    expect(analyzePartials('sin(', 0, 0).error).toBeTruthy();
  });
});
