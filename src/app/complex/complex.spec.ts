import {
  add,
  argument,
  conjugate,
  divide,
  formatAngle,
  formatComplex,
  formatPolar,
  modulus,
  multiply,
  nthRoots,
  parseComplex,
  power,
  subtract,
} from './complex';

describe('aritmética compleja', () => {
  const z1 = { re: 3, im: 4 };
  const z2 = { re: 1, im: 2 };

  it('suma, resta, producto y cociente', () => {
    expect(add(z1, z2)).toEqual({ re: 4, im: 6 });
    expect(subtract(z1, z2)).toEqual({ re: 2, im: 2 });

    const product = multiply(z1, z2);
    expect(product.re).toBeCloseTo(-5);
    expect(product.im).toBeCloseTo(10);

    const quotient = divide(z1, z2);
    expect(quotient.re).toBeCloseTo(2.2);
    expect(quotient.im).toBeCloseTo(-0.4);
  });

  it('calcula conjugado, módulo y argumento', () => {
    expect(conjugate(z1)).toEqual({ re: 3, im: -4 });
    expect(modulus(z1)).toBeCloseTo(5);
    expect(argument(z1)).toBeCloseTo(Math.atan2(4, 3));
  });

  it('calcula potencias y raíces n-ésimas', () => {
    const squared = power({ re: 1, im: 1 }, 2);
    expect(squared.re).toBeCloseTo(0);
    expect(squared.im).toBeCloseTo(2);

    const roots = nthRoots({ re: 1, im: 0 }, 4);
    expect(roots).toHaveLength(4);
    expect(roots.every((root) => Math.abs(modulus(root) - 1) < 1e-9)).toBe(true);
    expect(roots[1].re).toBeCloseTo(0);
    expect(roots[1].im).toBeCloseTo(1);
  });
});

describe('parser de números complejos', () => {
  it('parsea formas algebraicas habituales', () => {
    expect(parseComplex('3 + 4i').value).toEqual({ re: 3, im: 4 });
    expect(parseComplex('-3-4i').value).toEqual({ re: -3, im: -4 });
    expect(parseComplex('2i').value).toEqual({ re: 0, im: 2 });
    expect(parseComplex('i').value).toEqual({ re: 0, im: 1 });
    expect(parseComplex('-i').value).toEqual({ re: 0, im: -1 });
    expect(parseComplex('3 - i').value).toEqual({ re: 3, im: -1 });
    expect(parseComplex('1.5-2.5i').value).toEqual({ re: 1.5, im: -2.5 });
    expect(parseComplex('1e-3+2i').value).toEqual({ re: 0.001, im: 2 });
  });

  it('parsea formas polares en grados y radianes', () => {
    const degrees = parseComplex('2∠60', 'deg').value!;
    expect(degrees.re).toBeCloseTo(1);
    expect(degrees.im).toBeCloseTo(Math.sqrt(3));

    const radians = parseComplex('2∠pi/3', 'rad').value!;
    expect(radians.re).toBeCloseTo(1);
    expect(radians.im).toBeCloseTo(Math.sqrt(3));

    const explicitDegrees = parseComplex('2∠60°', 'rad').value!;
    expect(explicitDegrees.re).toBeCloseTo(1);
    expect(explicitDegrees.im).toBeCloseTo(Math.sqrt(3));
  });

  it('reporta errores', () => {
    expect(parseComplex('').error).toBeTruthy();
    expect(parseComplex('i3').error).toBeTruthy();
    expect(parseComplex('3 +').error).toBeTruthy();
    expect(parseComplex('3 + i').value).toEqual({ re: 3, im: 1 });
  });
});

describe('formato', () => {
  it('formatea formas algebraicas', () => {
    expect(formatComplex({ re: 3, im: 4 })).toBe('3 + 4i');
    expect(formatComplex({ re: 3, im: -4 })).toBe('3 − 4i');
    expect(formatComplex({ re: 0, im: -1 })).toBe('-i');
    expect(formatComplex({ re: 0, im: 0 })).toBe('0');
  });

  it('formatea forma polar en grados y radianes', () => {
    expect(formatPolar({ re: 1, im: 1 }, 'deg')).toContain('45°');
    expect(formatPolar({ re: 1, im: 1 }, 'rad')).toContain('π/4 rad');
    expect(formatAngle(Math.PI / 2, 'deg')).toBe('90°');
  });

  it('expresa resultados racionales como fracciones', () => {
    expect(formatComplex({ re: 0.5, im: -0.75 })).toBe('1/2 − (3/4)i');
    expect(formatAngle(Math.PI / 6, 'rad')).toBe('π/6 rad');
    expect(formatPolar({ re: 3, im: 4 }, 'rad')).toBe('5 ∠ 0.93 rad');
  });
});
