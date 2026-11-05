import { integratingFactor, linearSolution, rk4, separableSolution, slopeField } from './ode';

describe('EDOs de primer orden', () => {
  it("resuelve y' = y con RK4", () => {
    const result = rk4((_x, y) => y, 0, 1, 1, 300);

    expect(result.error).toBeNull();
    expect(result.points.at(-1)?.y).toBeCloseTo(Math.E, 4);
  });

  it('resuelve una separable dy/dx = x·y', () => {
    const result = separableSolution(
      (x) => x,
      (y) => y,
      0,
      1,
      1,
      300,
    );

    expect(result.error).toBeNull();
    expect(result.points.at(-1)?.y).toBeCloseTo(Math.exp(0.5), 3);
  });

  it("resuelve una lineal y' + y = 0", () => {
    const result = linearSolution(
      () => 1,
      () => 0,
      0,
      1,
      1,
      300,
    );

    expect(result.error).toBeNull();
    expect(result.points.at(-1)?.y).toBeCloseTo(Math.exp(-1), 4);
  });

  it('calcula el factor integrante', () => {
    const points = integratingFactor(() => 1, 0, 1, 100);

    expect(points[0].y).toBe(1);
    expect(points.at(-1)?.y).toBeCloseTo(Math.E, 3);
  });

  it('genera un campo de pendientes', () => {
    const field = slopeField((x, y) => x + y, -1, 1, -1, 1, 5, 4);

    expect(field.length).toBeGreaterThan(20);
    expect(field.every((point) => Number.isFinite(point.slope))).toBe(true);
  });

  it('rechaza condiciones iniciales inválidas', () => {
    expect(rk4((_x, y) => y, 1, 0, 0).error).toBeTruthy();
    expect(rk4((_x, y) => y, Number.NaN, 0, 1).error).toBeTruthy();
  });
});
