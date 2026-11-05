export type Distribution = 'normal' | 'binomial' | 'poisson';
export type BaseDistribution = 'uniform' | 'exponential';

export interface CltResult {
  means: number[];
  theoreticalMean: number;
  theoreticalSd: number;
  observedMean: number;
  observedSd: number;
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function normalPdf(x: number, mean: number, sd: number): number {
  if (sd <= 0) {
    return Number.NaN;
  }
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * SQRT_2PI);
}

export function normalCdf(x: number, mean: number, sd: number): number {
  if (sd <= 0) {
    return Number.NaN;
  }
  return 0.5 * (1 + erf((x - mean) / (sd * Math.SQRT2)));
}

export function binomialPmf(n: number, k: number, p: number): number {
  if (!Number.isInteger(n) || n < 0 || !Number.isInteger(k) || k < 0 || k > n) {
    return 0;
  }
  if (p <= 0) {
    return k === 0 ? 1 : 0;
  }
  if (p >= 1) {
    return k === n ? 1 : 0;
  }

  const logProbability =
    logGamma(n + 1) -
    logGamma(k + 1) -
    logGamma(n - k + 1) +
    k * Math.log(p) +
    (n - k) * Math.log(1 - p);

  return Math.exp(logProbability);
}

export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0 || !Number.isInteger(k) || k < 0) {
    return 0;
  }
  return Math.exp(-lambda + k * Math.log(lambda) - logGamma(k + 1));
}

export function normalStats(
  mean: number,
  sd: number,
): {
  mean: number;
  variance: number;
  sd: number;
} {
  return { mean, variance: sd * sd, sd };
}

export function binomialStats(
  n: number,
  p: number,
): {
  mean: number;
  variance: number;
  sd: number;
} {
  const variance = n * p * (1 - p);
  return { mean: n * p, variance, sd: Math.sqrt(variance) };
}

export function poissonStats(lambda: number): {
  mean: number;
  variance: number;
  sd: number;
} {
  return { mean: lambda, variance: lambda, sd: Math.sqrt(lambda) };
}

export function simulateMeans(
  base: BaseDistribution,
  sampleSize: number,
  samples = 2000,
  seed = 1,
): CltResult {
  const random = mulberry32(seed);
  const size = Math.max(1, Math.floor(sampleSize));
  const means: number[] = [];

  for (let sample = 0; sample < samples; sample += 1) {
    let sum = 0;
    for (let index = 0; index < size; index += 1) {
      sum += base === 'uniform' ? random() : -Math.log(1 - random());
    }
    means.push(sum / size);
  }

  const observedMean = means.reduce((sum, value) => sum + value, 0) / means.length;
  const observedVariance =
    means.reduce((sum, value) => sum + (value - observedMean) ** 2, 0) / means.length;
  const theoreticalMean = base === 'uniform' ? 0.5 : 1;
  const theoreticalVariance = base === 'uniform' ? 1 / 12 : 1;

  return {
    means,
    theoreticalMean,
    theoreticalSd: Math.sqrt(theoreticalVariance / size),
    observedMean,
    observedSd: Math.sqrt(observedVariance),
  };
}

export function intervalProbability(
  distribution: Distribution,
  parameters: { mean: number; sd: number; n: number; p: number; lambda: number },
  lower: number,
  upper: number,
): number {
  const low = Math.min(lower, upper);
  const high = Math.max(lower, upper);

  if (distribution === 'normal') {
    return Math.max(
      0,
      normalCdf(high, parameters.mean, parameters.sd) -
        normalCdf(low, parameters.mean, parameters.sd),
    );
  }

  if (distribution === 'binomial') {
    let total = 0;
    const start = Math.max(0, Math.ceil(low));
    const end = Math.min(parameters.n, Math.floor(high));
    for (let k = start; k <= end; k += 1) {
      total += binomialPmf(parameters.n, k, parameters.p);
    }
    return Math.min(1, Math.max(0, total));
  }

  let total = 0;
  const start = Math.max(0, Math.ceil(low));
  for (let k = start; k <= Math.floor(high); k += 1) {
    total += poissonPmf(parameters.lambda, k);
  }
  return Math.min(1, Math.max(0, total));
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const value = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * value);
  const polynomial =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const result = 1 - polynomial * Math.exp(-value * value);
  return sign * result;
}

function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
    12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7,
  ];

  if (value < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  const z = value - 1;
  let x = 0.99999999999980993;
  for (let index = 0; index < coefficients.length; index += 1) {
    x += coefficients[index] / (z + index + 1);
  }
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
