import { compile, derivative } from 'mathjs/number';

export type Wave = 'square' | 'sawtooth' | 'triangle';

export interface CurvePoint {
  x: number;
  y: number | null;
}

export interface TaylorResult {
  coefficients: number[] | null;
  error: string | null;
}

export interface FourierTerm {
  k: number;
  coefficient: number;
}

const EPS = 1e-9;
const TAU = Math.PI * 2;

export function factorial(value: number): number {
  let result = 1;
  for (let index = 2; index <= value; index += 1) {
    result *= index;
  }
  return result;
}

export function sampleCurve(
  expression: string,
  xMin: number,
  xMax: number,
  count = 360,
): { points: CurvePoint[]; error: string | null } {
  try {
    const compiled = compile(expression);
    const points: CurvePoint[] = [];

    for (let index = 0; index <= count; index += 1) {
      const x = xMin + ((xMax - xMin) * index) / count;
      try {
        const value = compiled.evaluate({ x });
        points.push({
          x,
          y: typeof value === 'number' && Number.isFinite(value) ? value : null,
        });
      } catch {
        points.push({ x, y: null });
      }
    }

    return { points, error: null };
  } catch {
    return { points: [], error: 'Expresión no válida. Prueba con sin(x), e^x o x^2.' };
  }
}

export function taylorSeries(expression: string, center: number, degree: number): TaylorResult {
  if (!Number.isFinite(center)) {
    return { coefficients: null, error: 'El centro debe ser un número finito.' };
  }
  if (degree < 0 || degree > 10) {
    return { coefficients: null, error: 'El grado debe estar entre 0 y 10.' };
  }

  try {
    const coefficients: number[] = [];
    let current = expression;

    for (let order = 0; order <= degree; order += 1) {
      const compiled = compile(current);
      const value = compiled.evaluate({ x: center });
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error('not finite');
      }
      coefficients.push(value / factorial(order));
      if (order < degree) {
        current = derivative(current, 'x').toString();
      }
    }

    return { coefficients, error: null };
  } catch {
    return {
      coefficients: null,
      error: 'No se pudo calcular la serie. Revisa la función o el centro.',
    };
  }
}

export function taylorValue(coefficients: number[], center: number, x: number): number {
  let result = 0;
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    result = result * (x - center) + coefficients[index];
  }
  return result;
}

export function waveTarget(wave: Wave, x: number): number {
  switch (wave) {
    case 'square':
      return Math.abs(Math.sin(x)) < EPS ? 0 : Math.sign(Math.sin(x));
    case 'sawtooth': {
      const normalized = ((((x + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      return normalized / Math.PI;
    }
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(x));
  }
}

export function fourierTerms(wave: Wave, terms: number): FourierTerm[] {
  const count = Math.max(1, Math.floor(terms));
  const result: FourierTerm[] = [];

  if (wave === 'sawtooth') {
    for (let k = 1; k <= count; k += 1) {
      result.push({ k, coefficient: ((2 / Math.PI) * (k % 2 === 1 ? 1 : -1)) / k });
    }
    return result;
  }

  for (let index = 0; index < count; index += 1) {
    const k = 2 * index + 1;
    if (wave === 'square') {
      result.push({ k, coefficient: 4 / (Math.PI * k) });
    } else {
      result.push({
        k,
        coefficient: ((8 / (Math.PI * Math.PI)) * (index % 2 === 0 ? 1 : -1)) / (k * k),
      });
    }
  }
  return result;
}

export function fourierPartial(wave: Wave, terms: number, x: number): number {
  return fourierTerms(wave, terms).reduce(
    (sum, term) => sum + term.coefficient * Math.sin(term.k * x),
    0,
  );
}

export function waveFormula(wave: Wave): string {
  switch (wave) {
    case 'square':
      return 'f(x) ≈ (4/π) Σ sen((2k−1)x)/(2k−1)';
    case 'sawtooth':
      return 'f(x) ≈ (2/π) Σ (−1)^(k+1) sen(kx)/k';
    case 'triangle':
      return 'f(x) ≈ (8/π²) Σ (−1)^k sen((2k+1)x)/(2k+1)²';
  }
}

export function waveLabel(wave: Wave): string {
  switch (wave) {
    case 'square':
      return 'Onda cuadrada';
    case 'sawtooth':
      return 'Diente de sierra';
    case 'triangle':
      return 'Onda triangular';
  }
}
