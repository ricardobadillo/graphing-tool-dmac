import {
  SORT_META,
  generateArray,
  mulberry32,
  runSort,
  type SortAlgorithm,
  type SortDistribution,
} from './sorting';

export type SearchAlgorithm = 'linear-search' | 'binary-search';
export type LabAlgorithm = SortAlgorithm | SearchAlgorithm;

export interface LabMeasurement {
  n: number;
  comparisons: number;
  writes: number;
  total: number;
  ratio: number | null;
}

export interface LabAlgorithmMeta {
  key: LabAlgorithm;
  name: string;
  group: 'Ordenamientos' | 'Búsquedas';
  best: string;
  average: string;
  worst: string;
  description: string;
}

export interface BigOFamily {
  id: string;
  label: string;
  name: string;
  color: string;
  fn: (n: number) => number;
  description: string;
}

export interface BigOTableRow {
  label: string;
  name: string;
  example: string;
  value: (n: number) => number;
}

export const LAB_SIZES = [16, 32, 64, 128, 256, 512];

export const LAB_DISTRIBUTIONS: { key: SortDistribution; label: string }[] = [
  { key: 'random', label: 'Aleatorio' },
  { key: 'nearly', label: 'Casi ordenado' },
  { key: 'reversed', label: 'Invertido' },
  { key: 'fewUnique', label: 'Pocos valores' },
];

const SEARCH_META: LabAlgorithmMeta[] = [
  {
    key: 'linear-search',
    name: 'Búsqueda lineal',
    group: 'Búsquedas',
    best: 'O(1)',
    average: 'O(n)',
    worst: 'O(n)',
    description: 'Recorre el arreglo desde el inicio hasta encontrar el valor.',
  },
  {
    key: 'binary-search',
    name: 'Búsqueda binaria',
    group: 'Búsquedas',
    best: 'O(1)',
    average: 'O(log n)',
    worst: 'O(log n)',
    description: 'Divide el intervalo a la mitad en cada comparación; requiere datos ordenados.',
  },
];

export const LAB_ALGORITHMS: LabAlgorithmMeta[] = [
  ...SORT_META.map((meta) => ({
    key: meta.key,
    name: meta.name,
    group: 'Ordenamientos' as const,
    best: meta.best,
    average: meta.average,
    worst: meta.worst,
    description: meta.description,
  })),
  ...SEARCH_META,
];

export const BIG_O_FAMILIES: BigOFamily[] = [
  {
    id: 'constant',
    label: 'O(1)',
    name: 'Constante',
    color: '#64748b',
    fn: () => 1,
    description: 'El costo no depende de n.',
  },
  {
    id: 'log',
    label: 'O(log n)',
    name: 'Logarítmica',
    color: '#a78bfa',
    fn: (n) => Math.log2(n) + 1,
    description: 'Cada paso descarta una fracción constante del problema.',
  },
  {
    id: 'linear',
    label: 'O(n)',
    name: 'Lineal',
    color: '#34d399',
    fn: (n) => n,
    description: 'El costo crece en proporción directa a n.',
  },
  {
    id: 'nlog',
    label: 'O(n log n)',
    name: 'Lineal-logarítmica',
    color: '#fbbf24',
    fn: (n) => n * Math.log2(n),
    description: 'Divide el problema y procesa cada nivel en tiempo lineal.',
  },
  {
    id: 'quadratic',
    label: 'O(n²)',
    name: 'Cuadrática',
    color: '#fb7185',
    fn: (n) => n * n,
    description: 'El costo crece con el cuadrado de n; aparece en dobles bucles.',
  },
];

export const BIG_O_TABLE: BigOTableRow[] = [
  { label: 'O(1)', name: 'Constante', example: 'acceder a un índice', value: () => 1 },
  {
    label: 'O(log n)',
    name: 'Logarítmica',
    example: 'búsqueda binaria',
    value: (n) => Math.log2(n) + 1,
  },
  { label: 'O(n)', name: 'Lineal', example: 'búsqueda lineal', value: (n) => n },
  {
    label: 'O(n log n)',
    name: 'Lineal-logarítmica',
    example: 'merge sort',
    value: (n) => n * Math.log2(n),
  },
  { label: 'O(n²)', name: 'Cuadrática', example: 'burbuja', value: (n) => n * n },
  {
    label: 'O(2ⁿ)',
    name: 'Exponencial',
    example: 'subconjuntos',
    value: (n) => 2 ** n,
  },
];

export const BIG_O_DEFINITION =
  'f(n) = O(g(n)) si existen constantes c > 0 y n₀ tales que f(n) ≤ c · g(n) para todo n ≥ n₀.';

export function runLab(
  algorithm: LabAlgorithm,
  distribution: SortDistribution,
  seed = 1,
): LabMeasurement[] {
  let previousTotal = 0;

  return LAB_SIZES.map((n) => {
    const random = mulberry32(seed * 7919 + n * 104729);
    let comparisons = 0;
    let writes = 0;

    if (algorithm === 'linear-search') {
      const values = generateArray(n, 'random', random);
      const target = n + 1;
      for (const value of values) {
        comparisons += 1;
        if (value === target) {
          break;
        }
      }
    } else if (algorithm === 'binary-search') {
      const values = Array.from({ length: n }, (_, index) => index);
      const target = n;
      let lo = 0;
      let hi = n - 1;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        comparisons += 1;
        if (values[mid] === target) {
          break;
        }
        if (values[mid] < target) {
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
    } else {
      const values = generateArray(n, distribution, random);
      const run = runSort(algorithm, values, false);
      comparisons = run.comparisons;
      writes = run.writes;
    }

    const total = comparisons + writes;
    const ratio = previousTotal > 0 ? total / previousTotal : null;
    previousTotal = total;

    return { n, comparisons, writes, total, ratio };
  });
}

export function formatOperations(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  if (value >= 1e9) {
    return value.toExponential(1).replace('e+', 'e');
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}k`;
  }
  return String(Math.round(value));
}

export function formatRatio(value: number): string {
  return `×${value.toFixed(1)}`;
}

export function labMeta(algorithm: LabAlgorithm): LabAlgorithmMeta {
  return LAB_ALGORITHMS.find((item) => item.key === algorithm) ?? LAB_ALGORITHMS[0];
}

export function isSearchAlgorithm(algorithm: LabAlgorithm): boolean {
  return algorithm === 'linear-search' || algorithm === 'binary-search';
}

export function estimateGrowth(ratio: number | null): {
  factor: string;
  family: string;
  text: string;
} | null {
  if (ratio === null) {
    return null;
  }

  let family: string;
  if (ratio < 1.4) {
    family = 'crecimiento sublineal, compatible con O(log n)';
  } else if (ratio < 2.15) {
    family = 'crecimiento lineal, compatible con O(n)';
  } else if (ratio < 2.65) {
    family = 'crecimiento n log n';
  } else if (ratio < 5) {
    family = 'crecimiento cuadrático, compatible con O(n²)';
  } else {
    family = 'crecimiento mayor que cuadrático';
  }

  return {
    factor: formatRatio(ratio),
    family,
    text: `Al duplicar n, las operaciones se multiplican por aproximadamente ${ratio.toFixed(1)}.`,
  };
}
