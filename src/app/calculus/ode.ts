export interface OdePoint {
  x: number;
  y: number;
}

export interface SlopeFieldPoint {
  x: number;
  y: number;
  slope: number;
}

export interface OdeResult {
  points: OdePoint[];
  error: string | null;
}

export type OdeDerivative = (x: number, y: number) => number;

export function rk4(
  derivative: OdeDerivative,
  xStart: number,
  yStart: number,
  xEnd: number,
  steps = 220,
): OdeResult {
  if (!Number.isFinite(xStart) || !Number.isFinite(yStart) || !Number.isFinite(xEnd)) {
    return { points: [], error: 'Las condiciones iniciales deben ser finitas.' };
  }
  if (!(xEnd > xStart)) {
    return { points: [], error: 'El extremo debe ser mayor que x₀.' };
  }

  const count = Math.max(1, Math.floor(steps));
  const h = (xEnd - xStart) / count;
  const points: OdePoint[] = [{ x: xStart, y: yStart }];
  let x = xStart;
  let y = yStart;

  for (let index = 0; index < count; index += 1) {
    const k1 = derivative(x, y);
    const k2 = derivative(x + h / 2, y + (h * k1) / 2);
    const k3 = derivative(x + h / 2, y + (h * k2) / 2);
    const k4 = derivative(x + h, y + h * k3);
    const next = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    if (!Number.isFinite(next)) {
      return { points, error: 'La solución dejó de ser finita.' };
    }

    x += h;
    y = next;
    points.push({ x, y });
  }

  return { points, error: null };
}

export function slopeField(
  derivative: OdeDerivative,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  columns = 20,
  rows = 14,
): SlopeFieldPoint[] {
  const points: SlopeFieldPoint[] = [];
  const xStep = (xMax - xMin) / columns;
  const yStep = (yMax - yMin) / rows;

  for (let column = 0; column <= columns; column += 1) {
    const x = xMin + column * xStep;
    for (let row = 0; row <= rows; row += 1) {
      const y = yMin + row * yStep;
      const slope = derivative(x, y);
      if (Number.isFinite(slope)) {
        points.push({ x, y, slope });
      }
    }
  }

  return points;
}

export function separableSolution(
  f: (x: number) => number,
  g: (y: number) => number,
  xStart: number,
  yStart: number,
  xEnd: number,
  steps = 220,
): OdeResult {
  return rk4((x, y) => f(x) * g(y), xStart, yStart, xEnd, steps);
}

export function linearSolution(
  p: (x: number) => number,
  q: (x: number) => number,
  xStart: number,
  yStart: number,
  xEnd: number,
  steps = 220,
): OdeResult {
  return rk4((x, y) => q(x) - p(x) * y, xStart, yStart, xEnd, steps);
}

export function integratingFactor(
  p: (x: number) => number,
  xStart: number,
  xEnd: number,
  steps = 220,
): OdePoint[] {
  const count = Math.max(1, Math.floor(steps));
  const h = (xEnd - xStart) / count;
  const points: OdePoint[] = [{ x: xStart, y: 1 }];
  let integral = 0;

  for (let index = 1; index <= count; index += 1) {
    const previous = xStart + (index - 1) * h;
    const current = xStart + index * h;
    integral += ((p(previous) + p(current)) / 2) * h;
    points.push({ x: current, y: Math.exp(integral) });
  }

  return points;
}

export function separatedForm(): string {
  return '∫ 1/g(y) dy = ∫ f(x) dx + C';
}

export function linearForm(): string {
  return "y' + P(x)y = Q(x) · μ(x) = e^(∫P dx)";
}
