export interface FractalEscape {
  iterations: number;
  smooth: number;
}

/** Devuelve iteraciones hasta escapar y un valor suavizado para colorear. */
export function mandelbrot(cx: number, cy: number, maxIterations = 100): FractalEscape {
  let x = 0;
  let y = 0;
  let iteration = 0;

  while (x * x + y * y <= 4 && iteration < maxIterations) {
    const nextX = x * x - y * y + cx;
    const nextY = 2 * x * y + cy;
    x = nextX;
    y = nextY;
    iteration += 1;
  }

  if (iteration >= maxIterations) {
    return { iterations: maxIterations, smooth: maxIterations };
  }

  const magnitude = Math.hypot(x, y);
  const smooth = iteration + 1 - Math.log2(Math.log2(Math.max(magnitude, 1.000001)));
  return { iterations: iteration, smooth: Math.max(0, smooth) };
}

export function julia(
  zx: number,
  zy: number,
  cx: number,
  cy: number,
  maxIterations = 100,
): FractalEscape {
  let x = zx;
  let y = zy;
  let iteration = 0;

  while (x * x + y * y <= 4 && iteration < maxIterations) {
    const nextX = x * x - y * y + cx;
    const nextY = 2 * x * y + cy;
    x = nextX;
    y = nextY;
    iteration += 1;
  }

  if (iteration >= maxIterations) {
    return { iterations: maxIterations, smooth: maxIterations };
  }

  const magnitude = Math.hypot(x, y);
  const smooth = iteration + 1 - Math.log2(Math.log2(Math.max(magnitude, 1.000001)));
  return { iterations: iteration, smooth: Math.max(0, smooth) };
}
