import {
  binomialPmf,
  binomialStats,
  intervalProbability,
  normalCdf,
  normalPdf,
  normalStats,
  poissonPmf,
  poissonStats,
  simulateMeans,
} from './statistics';

describe('distribuciones', () => {
  it('calcula densidad y acumulada normal', () => {
    expect(normalPdf(0, 0, 1)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI));
    expect(normalCdf(0, 0, 1)).toBeCloseTo(0.5, 5);
    expect(normalCdf(1.96, 0, 1)).toBeCloseTo(0.975, 3);
    expect(normalStats(2, 3)).toEqual({ mean: 2, variance: 9, sd: 3 });
  });

  it('calcula masa binomial y sus momentos', () => {
    let total = 0;
    for (let k = 0; k <= 10; k += 1) {
      total += binomialPmf(10, k, 0.3);
    }
    expect(total).toBeCloseTo(1, 10);
    expect(binomialPmf(10, 3, 0.3)).toBeGreaterThan(0);
    expect(binomialStats(10, 0.3).mean).toBeCloseTo(3);
    expect(binomialStats(10, 0.3).variance).toBeCloseTo(2.1);
  });

  it('calcula masa Poisson y sus momentos', () => {
    let total = 0;
    for (let k = 0; k <= 50; k += 1) {
      total += poissonPmf(3, k);
    }
    expect(total).toBeCloseTo(1, 8);
    expect(poissonStats(3)).toEqual({ mean: 3, variance: 3, sd: Math.sqrt(3) });
  });
});

describe('probabilidad por intervalos', () => {
  const parameters = { mean: 0, sd: 1, n: 10, p: 0.3, lambda: 3 };

  it('integra la normal en una desviación típica', () => {
    expect(intervalProbability('normal', parameters, -1, 1)).toBeCloseTo(0.6827, 3);
  });

  it('suma probabilidades discretas', () => {
    expect(intervalProbability('binomial', parameters, 0, 10)).toBeCloseTo(1, 10);
    expect(intervalProbability('poisson', parameters, 0, 100)).toBeCloseTo(1, 8);
  });
});

describe('teorema central del límite', () => {
  it('genera medias con la media y dispersión esperadas', () => {
    const result = simulateMeans('uniform', 10, 2000, 1);
    expect(result.means).toHaveLength(2000);
    expect(result.theoreticalMean).toBeCloseTo(0.5);
    expect(result.observedMean).toBeCloseTo(0.5, 2);
    expect(result.observedSd).toBeCloseTo(Math.sqrt(1 / 12 / 10), 2);
  });

  it('es determinista para la misma semilla', () => {
    const first = simulateMeans('exponential', 8, 100, 42);
    const second = simulateMeans('exponential', 8, 100, 42);
    expect(first.means[0]).toBe(second.means[0]);
    expect(first.observedMean).toBe(second.observedMean);
  });
});
