import {
  clipPolygon,
  gradientDescent,
  linearProgramming,
  objectiveGradient,
  objectiveValue,
} from './optimization';

describe('programación lineal', () => {
  const constraints = [
    { a: 2, b: 1, c: 8 },
    { a: 1, b: 2, c: 8 },
    { a: 1, b: 1, c: 5 },
  ];

  it('construye la región factible y maximiza el objetivo', () => {
    const result = linearProgramming(constraints, 3, 2, 'max', 12, 12);
    expect(result.polygon.length).toBeGreaterThanOrEqual(4);
    expect(result.optimum?.x).toBeCloseTo(3);
    expect(result.optimum?.y).toBeCloseTo(2);
    expect(result.optimumValue).toBeCloseTo(13);
  });

  it('minimiza y detecta regiones vacías', () => {
    const minimum = linearProgramming(constraints, 1, 1, 'min', 12, 12);
    expect(minimum.optimumValue).toBeCloseTo(0);

    const empty = linearProgramming(
      [
        { a: 1, b: 0, c: -1 },
        { a: -1, b: 0, c: -1 },
      ],
      1,
      1,
      'max',
      12,
      12,
    );
    expect(empty.polygon).toHaveLength(0);
    expect(empty.optimum).toBeNull();
  });

  it('recorta un polígono por una recta', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const clipped = clipPolygon(square, 1, 1, 1);
    expect(clipped.length).toBeGreaterThanOrEqual(3);
    expect(clipped.every((point) => point.x + point.y <= 1 + 1e-9)).toBe(true);
  });
});

describe('descenso de gradiente', () => {
  it('converge al mínimo de una cuadrática', () => {
    const result = gradientDescent('quadratic', { x: 3, y: 3 }, 0.1, 60);
    expect(Math.hypot(result.final.x, result.final.y)).toBeLessThan(0.01);
    expect(result.finalValue).toBeLessThan(objectiveValue('quadratic', { x: 3, y: 3 }));
    expect(result.values[result.values.length - 1]).toBeLessThanOrEqual(result.values[0]);
  });

  it('calcula gradientes correctos', () => {
    expect(objectiveGradient('quadratic', { x: 2, y: 1 })).toEqual({ x: 4, y: 6 });
    expect(objectiveValue('quadratic', { x: 1, y: 2 })).toBeCloseTo(13);
  });

  it('mantiene la ruta finita', () => {
    const result = gradientDescent('rosenbrock', { x: -1.2, y: 1 }, 0.001, 60);
    expect(Number.isFinite(result.final.x)).toBe(true);
    expect(Number.isFinite(result.final.y)).toBe(true);
    expect(result.path.length).toBeGreaterThan(1);
  });
});
