export interface ExtremaPoint {
  x: number;
  y: number;
  kind: 'max' | 'min';
}

export interface MonotonicInterval {
  from: number;
  to: number;
  direction: 'increasing' | 'decreasing';
}

export interface HorizontalAsymptote {
  side: 'left' | 'right';
  y: number;
}

export interface CurveAnalysis {
  roots: number[];
  maxima: ExtremaPoint[];
  minima: ExtremaPoint[];
  inflections: number[];
  monotonic: MonotonicInterval[];
  verticalAsymptotes: number[];
  horizontalAsymptotes: HorizontalAsymptote[];
  sampled: boolean;
}

type Evaluator = (x: number) => number;

const MAX_RESULTS = 24;
const HUGE = 1e6;

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function bisect(fn: Evaluator, left: number, right: number): number | null {
  let a = left;
  let b = right;
  let fa = fn(a);
  const fb = fn(b);

  if (!finite(fa) || !finite(fb)) {
    return null;
  }
  if (fa === 0) {
    return a;
  }
  if (fb === 0) {
    return b;
  }
  if (fa * fb > 0) {
    return null;
  }

  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middle = (a + b) / 2;
    const value = fn(middle);
    if (!finite(value)) {
      return middle;
    }
    if (Math.abs(value) < 1e-10 || Math.abs(b - a) < 1e-10) {
      return middle;
    }
    if (fa * value <= 0) {
      b = middle;
    } else {
      a = middle;
      fa = value;
    }
  }

  return (a + b) / 2;
}

function unique(values: number[], tolerance: number): number[] {
  const sorted = [...values].sort((left, right) => left - right);
  const result: number[] = [];
  for (const value of sorted) {
    if (!finite(value)) {
      continue;
    }
    const previous = result[result.length - 1];
    if (previous === undefined || Math.abs(value - previous) > tolerance) {
      result.push(value);
    }
  }
  return result;
}

function dedupeExtrema(points: ExtremaPoint[], tolerance: number): ExtremaPoint[] {
  const result: ExtremaPoint[] = [];
  for (const point of [...points].sort((left, right) => left.x - right.x)) {
    const previous = result[result.length - 1];
    if (previous === undefined || Math.abs(point.x - previous.x) > tolerance) {
      result.push(point);
    }
  }
  return result;
}

function cluster(values: number[], tolerance: number): number[] {
  const result: number[] = [];
  for (const value of [...values].sort((left, right) => left - right)) {
    const previous = result[result.length - 1];
    if (previous === undefined || value - previous > tolerance) {
      result.push(value);
    }
  }
  return result;
}

function derivative(evaluate: Evaluator, x: number, h: number): number {
  const left = evaluate(x - h);
  const right = evaluate(x + h);
  if (finite(left) && finite(right)) {
    return (right - left) / (2 * h);
  }
  return Number.NaN;
}

function secondDerivative(evaluate: Evaluator, x: number, h: number): number {
  const center = evaluate(x);
  const left = evaluate(x - h);
  const right = evaluate(x + h);
  if (finite(center) && finite(left) && finite(right)) {
    return (right - 2 * center + left) / (h * h);
  }
  return Number.NaN;
}

export function analyzeCurve(
  evaluate: Evaluator,
  xMin: number,
  xMax: number,
  samples = 1200,
): CurveAnalysis {
  const empty: CurveAnalysis = {
    roots: [],
    maxima: [],
    minima: [],
    inflections: [],
    monotonic: [],
    verticalAsymptotes: [],
    horizontalAsymptotes: [],
    sampled: false,
  };

  if (!(xMax > xMin) || samples < 8) {
    return empty;
  }

  const step = (xMax - xMin) / samples;
  const tolerance = step * 0.75;
  const xs: number[] = [];
  const ys: number[] = [];
  const slopes: number[] = [];
  const curvatures: number[] = [];
  const derivativeStep = Math.max(Math.abs(xMax - xMin) * 1e-5, 1e-7);
  const curvatureStep = Math.max(step * 2, 1e-4);

  for (let index = 0; index <= samples; index += 1) {
    const x = xMin + step * index;
    xs.push(x);
    ys.push(evaluate(x));
    slopes.push(derivative(evaluate, x, derivativeStep));
    curvatures.push(secondDerivative(evaluate, x, curvatureStep));
  }

  const roots: number[] = [];
  for (let index = 1; index < xs.length; index += 1) {
    const previous = ys[index - 1];
    const current = ys[index];
    if (!finite(previous) || !finite(current)) {
      continue;
    }
    if (previous === 0) {
      roots.push(xs[index - 1]);
    } else if (previous * current < 0) {
      const root = bisect(evaluate, xs[index - 1], xs[index]);
      if (root !== null) {
        roots.push(root);
      }
    } else if (Math.abs(current) < 1e-10) {
      roots.push(xs[index]);
    }
  }

  const maxima: ExtremaPoint[] = [];
  const minima: ExtremaPoint[] = [];

  for (let index = 1; index < xs.length - 1; index += 1) {
    const left = slopes[index - 1];
    const right = slopes[index + 1];
    if (!finite(left) || !finite(right)) {
      continue;
    }
    if (left > 0 && right < 0) {
      const x = bisect(
        (value) => derivative(evaluate, value, derivativeStep),
        xs[index - 1],
        xs[index + 1],
      );
      if (x !== null) {
        const y = evaluate(x);
        if (finite(y)) {
          maxima.push({ x, y, kind: 'max' });
        }
      }
    } else if (left < 0 && right > 0) {
      const x = bisect(
        (value) => derivative(evaluate, value, derivativeStep),
        xs[index - 1],
        xs[index + 1],
      );
      if (x !== null) {
        const y = evaluate(x);
        if (finite(y)) {
          minima.push({ x, y, kind: 'min' });
        }
      }
    }
  }

  const inflections: number[] = [];
  for (let index = 1; index < xs.length - 1; index += 1) {
    const left = curvatures[index - 1];
    const right = curvatures[index + 1];
    if (!finite(left) || !finite(right) || left * right >= 0) {
      continue;
    }
    const x = bisect(
      (value) => secondDerivative(evaluate, value, curvatureStep),
      xs[index - 1],
      xs[index + 1],
    );
    if (x !== null) {
      inflections.push(x);
    }
  }

  const verticalCandidates: number[] = [];
  for (let index = 1; index < xs.length; index += 1) {
    const previous = ys[index - 1];
    const current = ys[index];
    if (!finite(current) || Math.abs(current) > HUGE) {
      verticalCandidates.push(xs[index]);
    }
    if (
      finite(previous) &&
      finite(current) &&
      Math.abs(previous) > 1e4 &&
      Math.abs(current) > 1e4 &&
      Math.sign(previous) !== Math.sign(current)
    ) {
      verticalCandidates.push((xs[index - 1] + xs[index]) / 2);
    }
  }

  const verticalAsymptotes = cluster(verticalCandidates, tolerance).slice(0, MAX_RESULTS);
  const nearAsymptote = (value: number): boolean =>
    verticalAsymptotes.some((asymptote) => Math.abs(asymptote - value) < tolerance * 3);

  const validMaxima = dedupeExtrema(
    maxima.filter((point) => !nearAsymptote(point.x) && Math.abs(point.y) < 1e4),
    tolerance * 2,
  );
  const validMinima = dedupeExtrema(
    minima.filter((point) => !nearAsymptote(point.x) && Math.abs(point.y) < 1e4),
    tolerance * 2,
  );
  const validInflections = unique(
    inflections.filter((value) => !nearAsymptote(value) && Math.abs(evaluate(value)) < 1e4),
    tolerance * 2,
  );
  const critical = [...validMaxima, ...validMinima].map((point) => point.x);

  const horizontalAsymptotes: HorizontalAsymptote[] = [];
  const span = xMax - xMin;
  for (const side of ['left', 'right'] as const) {
    const far1 = side === 'right' ? xMax + span * 100 : xMin - span * 100;
    const far2 = side === 'right' ? far1 + span * 1000 : far1 - span * 1000;
    const value1 = evaluate(far1);
    const value2 = evaluate(far2);
    if (!finite(value1) || !finite(value2)) {
      continue;
    }
    const scale = Math.max(1, Math.abs(value2));
    if (Math.abs(value1 - value2) < scale * 1e-3) {
      const y = Math.abs(value2) < 1e-3 ? 0 : value2;
      if (!horizontalAsymptotes.some((asymptote) => Math.abs(asymptote.y - y) < 1e-6)) {
        horizontalAsymptotes.push({ side, y });
      }
    }
  }

  const boundaries = unique([xMin, xMax, ...critical, ...verticalAsymptotes], tolerance * 2).filter(
    (value) => value >= xMin && value <= xMax,
  );
  const monotonic: MonotonicInterval[] = [];
  for (let index = 1; index < boundaries.length; index += 1) {
    const from = boundaries[index - 1];
    const to = boundaries[index];
    if (!(to > from)) {
      continue;
    }
    const middle = (from + to) / 2;
    const slope = derivative(evaluate, middle, derivativeStep);
    if (!finite(slope) || Math.abs(slope) < 1e-7) {
      continue;
    }
    const direction = slope > 0 ? 'increasing' : 'decreasing';
    const previous = monotonic[monotonic.length - 1];
    if (
      previous &&
      previous.direction === direction &&
      Math.abs(previous.to - from) < tolerance * 2 &&
      !nearAsymptote(from)
    ) {
      previous.to = to;
    } else {
      monotonic.push({ from, to, direction });
    }
  }

  return {
    roots: unique(roots, tolerance).slice(0, MAX_RESULTS),
    maxima: validMaxima.slice(0, MAX_RESULTS),
    minima: validMinima.slice(0, MAX_RESULTS),
    inflections: validInflections.slice(0, MAX_RESULTS),
    monotonic: monotonic.slice(0, MAX_RESULTS),
    verticalAsymptotes,
    horizontalAsymptotes,
    sampled: true,
  };
}
