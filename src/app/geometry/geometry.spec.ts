import { julia, mandelbrot } from './geometry';

describe('conjunto de Mandelbrot', () => {
  it('mantiene los puntos interiores y descarta los exteriores', () => {
    expect(mandelbrot(0, 0, 80).iterations).toBe(80);
    expect(mandelbrot(-1, 0, 80).iterations).toBe(80);
    expect(mandelbrot(2, 0, 80).iterations).toBeLessThan(10);
    expect(mandelbrot(0.5, 0.5, 80).iterations).toBeLessThan(80);
  });

  it('produce un valor suavizado finito', () => {
    const result = mandelbrot(0.3, 0.5, 100);
    expect(Number.isFinite(result.smooth)).toBe(true);
    expect(result.smooth).toBeGreaterThanOrEqual(0);
  });
});

describe('conjunto de Julia', () => {
  it('distingue puntos acotados y no acotados', () => {
    expect(julia(0, 0, 0, 0, 80).iterations).toBe(80);
    expect(julia(2, 0, 0, 0, 80).iterations).toBeLessThan(10);
    expect(julia(-0.5, 0.5, -0.8, 0.156, 120).iterations).toBeGreaterThan(0);
  });
});
