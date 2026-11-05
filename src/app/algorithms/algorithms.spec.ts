import { BIG_O_TABLE, estimateGrowth, formatOperations, runLab } from './complexity';
import { buildComplexityChart } from './complexity-chart';
import { SORT_META, generateArray, mulberry32, runSort } from './sorting';

const INPUT = [5, 2, 9, 1, 7, 3, 8, 4, 6];
const EXPECTED = [...INPUT].sort((a, b) => a - b);

describe('ordenamientos', () => {
  for (const meta of SORT_META) {
    it(`ordena con ${meta.name}`, () => {
      const run = runSort(meta.key, INPUT);

      expect(run.result).toEqual(EXPECTED);
      expect(run.comparisons).toBeGreaterThan(0);
      expect(run.frames.length).toBeGreaterThan(0);

      const finalFrame = run.frames.at(-1)!;
      expect(finalFrame.array).toEqual(EXPECTED);
      expect(finalFrame.highlights).toHaveLength(EXPECTED.length);
      expect(finalFrame.highlights.every((highlight) => highlight.tone === 'sorted')).toBe(true);
    });

    it(`puede contar ${meta.name} sin grabar frames`, () => {
      const run = runSort(meta.key, INPUT, false);

      expect(run.result).toEqual(EXPECTED);
      expect(run.frames).toHaveLength(0);
      expect(run.comparisons).toBeGreaterThan(0);
    });
  }

  it('genera distribuciones deterministas', () => {
    const first = generateArray(12, 'random', mulberry32(5));
    const second = generateArray(12, 'random', mulberry32(5));

    expect(first).toEqual(second);
    expect(generateArray(8, 'reversed')).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    expect(new Set(generateArray(10, 'fewUnique', mulberry32(3))).size).toBeLessThanOrEqual(2);
  });
});

describe('laboratorio Big-O', () => {
  it('detecta comportamiento cuadrático en burbuja invertido', () => {
    const measurements = runLab('bubble', 'reversed', 2);
    const summary = estimateGrowth(measurements.at(-1)?.ratio ?? null);

    expect(measurements).toHaveLength(6);
    expect(summary?.family).toContain('cuadrático');
  });

  it('detecta comportamiento n log n en merge sort', () => {
    const measurements = runLab('merge', 'random', 2);
    const summary = estimateGrowth(measurements.at(-1)?.ratio ?? null);

    expect(summary?.family).toContain('n log n');
  });

  it('distingue búsqueda lineal y binaria', () => {
    const linear = runLab('linear-search', 'random', 2);
    const binary = runLab('binary-search', 'random', 2);

    expect(estimateGrowth(linear.at(-1)?.ratio ?? null)?.family).toContain('lineal');
    expect(estimateGrowth(binary.at(-1)?.ratio ?? null)?.family).toContain('log n');
  });

  it('construye una gráfica y curvas de referencia finitas', () => {
    const measurements = runLab('heap', 'random', 2);
    const chart = buildComplexityChart(measurements, false, true);
    const logChart = buildComplexityChart(measurements, true, true);

    expect(chart.hasData).toBe(true);
    expect(chart.measured?.points).toHaveLength(6);
    expect(chart.references).toHaveLength(5);
    expect(chart.xTicks).toHaveLength(6);

    for (const point of chart.measured?.points ?? []) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    for (const reference of logChart.references) {
      expect(reference.points.every((point) => Number.isFinite(point.y))).toBe(true);
    }
  });

  it('formatea operaciones y mantiene la tabla de referencia', () => {
    expect(formatOperations(1500)).toBe('1.5k');
    expect(formatOperations(2_000_000)).toBe('2.0M');
    expect(BIG_O_TABLE).toHaveLength(6);
  });
});
