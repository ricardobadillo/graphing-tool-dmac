import type { Vec2 } from '../linear/linear';

export type OptimizationSense = 'max' | 'min';
export type ObjectiveKey = 'quadratic' | 'rotated' | 'rosenbrock';

export interface Constraint {
  a: number;
  b: number;
  c: number;
}

export interface LinearProgramResult {
  polygon: Vec2[];
  vertices: Vec2[];
  optimum: Vec2 | null;
  optimumValue: number | null;
}

export interface DescentResult {
  path: Vec2[];
  values: number[];
  final: Vec2;
  finalValue: number;
  gradientNorm: number;
  iterations: number;
}

const EPS = 1e-9;

/** Recorta un polígono convexo por la mitad a·x + b·y ≤ c. */
export function clipPolygon(polygon: Vec2[], a: number, b: number, c: number): Vec2[] {
  if (polygon.length === 0) {
    return polygon;
  }

  const result: Vec2[] = [];
  const inside = (point: Vec2): boolean => a * point.x + b * point.y <= c + EPS;

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const currentInside = inside(current);
    const previousInside = inside(previous);

    if (currentInside !== previousInside) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const denominator = a * dx + b * dy;
      if (Math.abs(denominator) > EPS) {
        const t = (c - a * previous.x - b * previous.y) / denominator;
        result.push({ x: previous.x + t * dx, y: previous.y + t * dy });
      }
    }
    if (currentInside) {
      result.push(current);
    }
  }

  return dedupe(result);
}

function dedupe(points: Vec2[]): Vec2[] {
  const result: Vec2[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-8) {
      result.push(point);
    }
  }
  if (
    result.length > 1 &&
    Math.hypot(
      result[0].x - result[result.length - 1].x,
      result[0].y - result[result.length - 1].y,
    ) < 1e-8
  ) {
    result.pop();
  }
  return result;
}

export function linearProgramming(
  constraints: Constraint[],
  objectiveX: number,
  objectiveY: number,
  sense: OptimizationSense,
  xMax = 12,
  yMax = 12,
): LinearProgramResult {
  let polygon: Vec2[] = [
    { x: 0, y: 0 },
    { x: xMax, y: 0 },
    { x: xMax, y: yMax },
    { x: 0, y: yMax },
  ];

  for (const constraint of constraints) {
    polygon = clipPolygon(polygon, constraint.a, constraint.b, constraint.c);
  }

  if (polygon.length === 0) {
    return { polygon: [], vertices: [], optimum: null, optimumValue: null };
  }

  let optimum: Vec2 | null = null;
  let optimumValue: number | null = null;

  for (const vertex of polygon) {
    const value = objectiveX * vertex.x + objectiveY * vertex.y;
    if (optimumValue === null || (sense === 'max' ? value > optimumValue : value < optimumValue)) {
      optimum = vertex;
      optimumValue = value;
    }
  }

  return { polygon, vertices: polygon, optimum, optimumValue };
}

export function objectiveValue(key: ObjectiveKey, point: Vec2): number {
  switch (key) {
    case 'quadratic':
      return point.x * point.x + 3 * point.y * point.y;
    case 'rotated':
      return (point.x + point.y) ** 2 + 0.4 * (point.x - point.y) ** 2;
    case 'rosenbrock':
      return (1 - point.x) ** 2 + 100 * (point.y - point.x ** 2) ** 2;
  }
}

export function objectiveGradient(key: ObjectiveKey, point: Vec2): Vec2 {
  switch (key) {
    case 'quadratic':
      return { x: 2 * point.x, y: 6 * point.y };
    case 'rotated':
      return {
        x: 2 * point.x + 0.4 * point.y,
        y: 2 * point.y + 0.4 * point.x,
      };
    case 'rosenbrock':
      return {
        x: -2 * (1 - point.x) - 400 * point.x * (point.y - point.x * point.x),
        y: 200 * (point.y - point.x * point.x),
      };
  }
}

export function gradientDescent(
  key: ObjectiveKey,
  start: Vec2,
  learningRate: number,
  steps: number,
): DescentResult {
  let current = { ...start };
  let currentValue = objectiveValue(key, current);
  const path: Vec2[] = [current];
  const values: number[] = [currentValue];
  let iterations = 0;

  for (let index = 0; index < steps; index += 1) {
    const gradient = objectiveGradient(key, current);
    const next = {
      x: current.x - learningRate * gradient.x,
      y: current.y - learningRate * gradient.y,
    };

    if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || Math.hypot(next.x, next.y) > 1e6) {
      break;
    }

    const nextValue = objectiveValue(key, next);
    if (!Number.isFinite(nextValue)) {
      break;
    }

    current = next;
    currentValue = nextValue;
    path.push(current);
    values.push(currentValue);
    iterations += 1;

    if (Math.hypot(gradient.x, gradient.y) < 1e-7) {
      break;
    }
  }

  const gradient = objectiveGradient(key, current);
  return {
    path,
    values,
    final: current,
    finalValue: currentValue,
    gradientNorm: Math.hypot(gradient.x, gradient.y),
    iterations,
  };
}
