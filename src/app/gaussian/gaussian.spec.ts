import {
  addGaussian,
  associatesOf,
  conjugateGaussian,
  divideGaussian,
  formatGaussian,
  formatRationalQuotient,
  gcdGaussian,
  isGaussianPrime,
  isRationalPrime,
  multiplyGaussian,
  norm,
  parseGaussian,
  powerGaussian,
  subtractGaussian,
} from './gaussian';

describe('aritmética en ℤ[i]', () => {
  const z = { re: 3, im: 4 };
  const w = { re: 2, im: 1 };

  it('suma, resta, producto y conjugado', () => {
    expect(addGaussian(z, w)).toEqual({ re: 5, im: 5 });
    expect(subtractGaussian(z, w)).toEqual({ re: 1, im: 3 });
    expect(multiplyGaussian(z, w)).toEqual({ re: 2, im: 11 });
    expect(conjugateGaussian(z)).toEqual({ re: 3, im: -4 });
  });

  it('calcula la norma y potencias', () => {
    expect(norm(z)).toBe(25);
    expect(powerGaussian(w, 2)).toEqual({ re: 3, im: 4 });
    expect(powerGaussian(z, 0)).toEqual({ re: 1, im: 0 });
  });

  it('detecta cocientes exactos y no exactos', () => {
    const exact = divideGaussian({ re: 5, im: 0 }, w);
    expect(exact.exact).toBe(true);
    expect(exact.value).toEqual({ re: 2, im: -1 });

    const inexact = divideGaussian(z, { re: 1, im: 2 });
    expect(inexact.exact).toBe(false);
    expect(inexact.value).toBeNull();
    expect(inexact.denominator).toBe(5);
    expect(formatRationalQuotient(inexact)).toBe('11/5 − 2/5i');
  });
});

describe('primalidad gaussiana', () => {
  it('reconoce primos y compuestos', () => {
    expect(isRationalPrime(7)).toBe(true);
    expect(isRationalPrime(9)).toBe(false);

    expect(isGaussianPrime({ re: 1, im: 1 })).toBe(true);
    expect(isGaussianPrime({ re: 2, im: 1 })).toBe(true);
    expect(isGaussianPrime({ re: 3, im: 0 })).toBe(true);
    expect(isGaussianPrime({ re: 7, im: 0 })).toBe(true);
    expect(isGaussianPrime({ re: 2, im: 0 })).toBe(false);
    expect(isGaussianPrime({ re: 5, im: 0 })).toBe(false);
    expect(isGaussianPrime({ re: 3, im: 4 })).toBe(false);
    expect(isGaussianPrime({ re: 1, im: 0 })).toBe(false);
    expect(isGaussianPrime({ re: 0, im: 0 })).toBe(false);
  });

  it('lista asociados sin duplicados', () => {
    expect(associatesOf({ re: 2, im: 1 })).toEqual([
      { label: 'z', value: { re: 2, im: 1 } },
      { label: 'iz', value: { re: -1, im: 2 } },
      { label: '−z', value: { re: -2, im: -1 } },
      { label: '−iz', value: { re: 1, im: -2 } },
    ]);
    expect(associatesOf({ re: 0, im: 0 })).toHaveLength(1);
  });
});

describe('algoritmo de Euclides en ℤ[i]', () => {
  it('calcula el mcd y termina en resto cero', () => {
    const result = gcdGaussian({ re: 3, im: 4 }, { re: 2, im: 1 });
    expect(result.gcd).toEqual({ re: 2, im: 1 });
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.at(-1)?.remainder).toEqual({ re: 0, im: 0 });
  });

  it('normaliza el mcd salvo unidades y maneja el cero', () => {
    expect(gcdGaussian({ re: 0, im: -3 }, { re: 0, im: 0 }).gcd).toEqual({
      re: 3,
      im: 0,
    });
    expect(gcdGaussian({ re: 0, im: 0 }, { re: 0, im: 0 }).gcd).toEqual({
      re: 0,
      im: 0,
    });
  });

  it('es consistente con la divisibilidad', () => {
    const result = gcdGaussian({ re: 5, im: 0 }, { re: 2, im: 1 });
    expect(result.gcd).toEqual({ re: 2, im: 1 });
    expect(result.steps.at(-1)?.remainder).toEqual({ re: 0, im: 0 });
  });
});

describe('parser y formato de enteros gaussianos', () => {
  it('acepta enteros en forma algebraica', () => {
    expect(parseGaussian('3 + 4i').value).toEqual({ re: 3, im: 4 });
    expect(parseGaussian('−2 + i').value).toEqual({ re: -2, im: 1 });
    expect(parseGaussian('5').value).toEqual({ re: 5, im: 0 });
    expect(parseGaussian('i').value).toEqual({ re: 0, im: 1 });
    expect(parseGaussian('-i').value).toEqual({ re: 0, im: -1 });
  });

  it('rechaza valores que no son enteros gaussianos', () => {
    expect(parseGaussian('').error).toBeTruthy();
    expect(parseGaussian('1.5 + 2i').error).toBeTruthy();
    expect(parseGaussian('2∠60°').error).toBeTruthy();
    expect(parseGaussian('1000000 + i').error).toBeTruthy();
  });

  it('formatea con signo unicode', () => {
    expect(formatGaussian({ re: 3, im: 4 })).toBe('3 + 4i');
    expect(formatGaussian({ re: 3, im: -4 })).toBe('3 − 4i');
    expect(formatGaussian({ re: 0, im: -1 })).toBe('−i');
    expect(formatGaussian({ re: -2, im: 0 })).toBe('−2');
  });
});
