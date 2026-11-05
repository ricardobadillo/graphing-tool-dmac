import {
  IDENTITY,
  addVec,
  angleBetween,
  cross,
  dot,
  eigenvalues,
  matApply,
  matDeterminant,
  matInverse,
  matMultiply,
  matRank,
  matTrace,
  matTranspose,
  matrixKind,
  norm,
  parseScalar,
  projectVec,
  solveSystem,
  subtractVec,
  unit,
} from './linear';

describe('vectores', () => {
  const u = { x: 3, y: 1 };
  const v = { x: 1, y: 3 };

  it('suma, resta, escala y normas', () => {
    expect(addVec(u, v)).toEqual({ x: 4, y: 4 });
    expect(subtractVec(u, v)).toEqual({ x: 2, y: -2 });
    expect(norm({ x: 3, y: 4 })).toBeCloseTo(5);
    expect(dot(u, v)).toBeCloseTo(6);
    expect(cross(u, v)).toBeCloseTo(8);
  });

  it('calcula ángulos, unitarios y proyecciones', () => {
    const angle = angleBetween({ x: 1, y: 0 }, { x: 0, y: 1 });
    expect(angle).toBeCloseTo(Math.PI / 2);
    expect(unit({ x: 0, y: 5 })).toEqual({ x: 0, y: 1 });
    expect(projectVec({ x: 2, y: 3 }, { x: 1, y: 0 })).toEqual({ x: 2, y: 0 });
    expect(projectVec({ x: 1, y: 1 }, { x: 0, y: 0 })).toBeNull();
  });
});

describe('matrices 2×2', () => {
  const symmetric = { a: 1.5, b: 0.5, c: 0.5, d: 1.5 };

  it('aplica matrices y calcula traza y determinante', () => {
    expect(matApply(symmetric, { x: 1, y: 0 })).toEqual({ x: 1.5, y: 0.5 });
    expect(matTrace(symmetric)).toBeCloseTo(3);
    expect(matDeterminant(symmetric)).toBeCloseTo(2);
  });

  it('compone y transpone matrices', () => {
    expect(matTranspose(symmetric)).toEqual(symmetric);
    const rotation = { a: 0, b: -1, c: 1, d: 0 };
    const composed = matMultiply(rotation, IDENTITY);
    expect(composed).toEqual(rotation);
  });

  it('calcula inversas y rangos', () => {
    const inverse = matInverse(symmetric);
    expect(inverse).not.toBeNull();
    expect(matEqualsApprox(matMultiply(symmetric, inverse!), IDENTITY)).toBe(true);

    expect(matInverse({ a: 1, b: 1, c: 1, d: 1 })).toBeNull();
    expect(matRank({ a: 1, b: 1, c: 1, d: 1 })).toBe(1);
    expect(matRank(symmetric)).toBe(2);
    expect(matRank({ a: 0, b: 0, c: 0, d: 0 })).toBe(0);
  });
});

describe('autovalores y clasificación', () => {
  it('calcula autovalores y autovectores reales', () => {
    const result = eigenvalues({ a: 1.5, b: 0.5, c: 0.5, d: 1.5 });
    expect(result.real).toBe(true);
    expect(result.eigenvalues[0].re).toBeCloseTo(2);
    expect(result.eigenvalues[1].re).toBeCloseTo(1);
    expect(result.vectors).toHaveLength(2);
    expect(result.vectors[0]).toEqual({ x: 1, y: 1 });
    expect(result.vectors[1]).toEqual({ x: 1, y: -1 });
  });

  it('reduce los autovectores a una dirección entera simple', () => {
    const result = eigenvalues({ a: 2, b: 1, c: 1, d: 2 });
    expect(result.vectors[0]).toEqual({ x: 1, y: 1 });
    expect(result.vectors[1]).toEqual({ x: 1, y: -1 });

    const diagonal = eigenvalues({ a: 2, b: 0, c: 0, d: 1 });
    expect(diagonal.vectors[0]).toEqual({ x: 1, y: 0 });
    expect(diagonal.vectors[1]).toEqual({ x: 0, y: 1 });
  });

  it('conserva las raíces en las etiquetas de autovectores irracionales', () => {
    const golden = eigenvalues({ a: 1, b: 1, c: 1, d: 0 });
    expect(golden.eigenvalueLabels).toEqual(['(1 + √5)/2', '(1 − √5)/2']);
    expect(golden.vectorLabels).toEqual(['(2, −1 + √5)', '(2, −1 − √5)']);

    const fibonacci = eigenvalues({ a: 0, b: 1, c: 1, d: 1 });
    expect(fibonacci.eigenvalueLabels).toEqual(['(1 + √5)/2', '(1 − √5)/2']);
    expect(fibonacci.vectorLabels).toEqual(['(2, 1 + √5)', '(2, 1 − √5)']);

    const rational = eigenvalues({ a: 2, b: 1, c: 1, d: 2 });
    expect(rational.eigenvalueLabels).toEqual([]);
    expect(rational.vectorLabels).toEqual([]);
  });

  it('detecta autovalores complejos', () => {
    const result = eigenvalues({ a: 0, b: -1, c: 1, d: 0 });
    expect(result.real).toBe(false);
    expect(result.eigenvalues[0].re).toBeCloseTo(0);
    expect(result.eigenvalues[0].im).toBeCloseTo(1);
    expect(result.eigenvalues[1].im).toBeCloseTo(-1);
    expect(result.vectors).toHaveLength(0);
  });

  it('clasifica transformaciones habituales', () => {
    expect(matrixKind(IDENTITY)).toBe('Identidad');
    expect(matrixKind({ a: 0, b: -1, c: 1, d: 0 })).toBe('Rotación');
    expect(matrixKind({ a: 0.7071, b: -0.7071, c: 0.7071, d: 0.7071 })).toBe('Rotación');
    expect(matrixKind({ a: 1, b: 0, c: 0, d: -1 })).toBe('Reflexión');
    expect(matrixKind({ a: 1, b: 1, c: 0, d: 1 })).toBe('Cizalla horizontal');
    expect(matrixKind({ a: 1, b: 0, c: 0, d: 0 })).toBe('Proyección');
    expect(matrixKind({ a: 1, b: 2, c: 2, d: 4 })).toBe('Singular');
    expect(matrixKind({ a: 2, b: 0, c: 0, d: 0.5 })).toBe('Escala');
  });
});

describe('sistemas lineales 2×2', () => {
  it('resuelve un sistema con solución única', () => {
    const result = solveSystem(1, 1, 4, 1, -1, 0);
    expect(result.kind).toBe('unique');
    expect(result.solution?.x).toBeCloseTo(2);
    expect(result.solution?.y).toBeCloseTo(2);
    expect(result.determinant).toBeCloseTo(-2);
  });

  it('detecta sistemas sin solución y con infinitas soluciones', () => {
    expect(solveSystem(1, 1, 1, 1, 1, 2).kind).toBe('none');
    expect(solveSystem(1, 1, 2, 2, 2, 4).kind).toBe('infinite');
    expect(solveSystem(0, 0, 0, 0, 0, 0).kind).toBe('infinite');
    expect(solveSystem(0, 0, 1, 1, 1, 2).kind).toBe('none');
  });
});

describe('parser de escalares', () => {
  it('acepta números, fracciones y expresiones', () => {
    expect(parseScalar('2').value).toBe(2);
    expect(parseScalar('−1/2').value).toBe(-0.5);
    expect(parseScalar('sqrt(3)').value).toBeCloseTo(Math.sqrt(3));
    expect(parseScalar('π').value).toBeCloseTo(Math.PI);
  });

  it('rechaza entradas inválidas', () => {
    expect(parseScalar('').error).toBeTruthy();
    expect(parseScalar('abc').error).toBeTruthy();
    expect(parseScalar('10000000').error).toBeTruthy();
  });
});

function matEqualsApprox(
  left: { a: number; b: number; c: number; d: number },
  right: { a: number; b: number; c: number; d: number },
): boolean {
  return (
    Math.abs(left.a - right.a) < 1e-9 &&
    Math.abs(left.b - right.b) < 1e-9 &&
    Math.abs(left.c - right.c) < 1e-9 &&
    Math.abs(left.d - right.d) < 1e-9
  );
}
