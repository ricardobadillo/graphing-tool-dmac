export type SortAlgorithm = 'bubble' | 'selection' | 'insertion' | 'merge' | 'quick' | 'heap';
export type SortDistribution = 'random' | 'nearly' | 'reversed' | 'fewUnique';
export type SortTone = 'compare' | 'swap' | 'sorted' | 'pivot' | 'active' | 'write';

export interface SortHighlight {
  index: number;
  tone: SortTone;
}

export interface SortFrame {
  array: number[];
  comparisons: number;
  writes: number;
  highlights: SortHighlight[];
  line: number;
  message: string;
}

export interface SortRun {
  frames: SortFrame[];
  result: number[];
  comparisons: number;
  writes: number;
}

export interface SortMeta {
  key: SortAlgorithm;
  name: string;
  tagline: string;
  best: string;
  average: string;
  worst: string;
  stable: boolean;
  inPlace: boolean;
  description: string;
}

export const SORT_META: SortMeta[] = [
  {
    key: 'bubble',
    name: 'Burbuja',
    tagline: 'Intercambia vecinos',
    best: 'O(n)',
    average: 'O(n²)',
    worst: 'O(n²)',
    stable: true,
    inPlace: true,
    description:
      'Recorre el arreglo comparando pares vecinos. En cada pasada, el mayor flota hasta el final.',
  },
  {
    key: 'selection',
    name: 'Selección',
    tagline: 'Busca el mínimo',
    best: 'O(n²)',
    average: 'O(n²)',
    worst: 'O(n²)',
    stable: false,
    inPlace: true,
    description: 'En cada posición busca el menor del resto y lo coloca en su lugar definitivo.',
  },
  {
    key: 'insertion',
    name: 'Inserción',
    tagline: 'Como ordenar cartas',
    best: 'O(n)',
    average: 'O(n²)',
    worst: 'O(n²)',
    stable: true,
    inPlace: true,
    description:
      'Toma el siguiente elemento y lo inserta en la posición correcta dentro del prefijo ya ordenado.',
  },
  {
    key: 'merge',
    name: 'Mezcla',
    tagline: 'Divide y combina',
    best: 'O(n log n)',
    average: 'O(n log n)',
    worst: 'O(n log n)',
    stable: true,
    inPlace: false,
    description:
      'Ordena por mitades y luego mezcla dos segmentos ordenados. Necesita espacio auxiliar O(n).',
  },
  {
    key: 'quick',
    name: 'Rápido',
    tagline: 'Particiona alrededor de un pivote',
    best: 'O(n log n)',
    average: 'O(n log n)',
    worst: 'O(n²)',
    stable: false,
    inPlace: true,
    description:
      'Elige un pivote, deja los menores a la izquierda y los mayores a la derecha, y repite.',
  },
  {
    key: 'heap',
    name: 'Montículo',
    tagline: 'Usa un max-heap',
    best: 'O(n log n)',
    average: 'O(n log n)',
    worst: 'O(n log n)',
    stable: false,
    inPlace: true,
    description:
      'Construye un max-heap y extrae el mayor repetidamente hacia el final del arreglo.',
  },
];

export const SORT_PSEUDOCODE: Record<SortAlgorithm, string[]> = {
  bubble: [
    'function bubbleSort(a) {',
    '  for (let i = 0; i < a.length - 1; i++) {',
    '    let swapped = false',
    '    for (let j = 0; j < a.length - 1 - i; j++) {',
    '      if (a[j] > a[j + 1]) {',
    '        [a[j], a[j + 1]] = [a[j + 1], a[j]]',
    '        swapped = true',
    '      }',
    '    }',
    '    if (!swapped) break',
    '  }',
    '}',
  ],
  selection: [
    'function selectionSort(a) {',
    '  for (let i = 0; i < a.length - 1; i++) {',
    '    let min = i',
    '    for (let j = i + 1; j < a.length; j++) {',
    '      if (a[j] < a[min]) min = j',
    '    }',
    '    if (min !== i) swap(a[i], a[min])',
    '    // a[i] queda en su posición final',
    '  }',
    '}',
  ],
  insertion: [
    'function insertionSort(a) {',
    '  for (let i = 1; i < a.length; i++) {',
    '    const key = a[i]',
    '    let j = i - 1',
    '    while (j >= 0 && a[j] > key) {',
    '      a[j + 1] = a[j]',
    '      j--',
    '    }',
    '    a[j + 1] = key',
    '  }',
    '}',
  ],
  merge: [
    'function mergeSort(a) {',
    '  for (let width = 1; width < a.length; width *= 2) {',
    '    for (let lo = 0; lo < a.length; lo += 2 * width) {',
    '      const mid = Math.min(lo + width - 1, a.length - 1)',
    '      const hi = Math.min(lo + 2 * width - 1, a.length - 1)',
    '      if (mid < hi) merge(a, lo, mid, hi)',
    '    }',
    '  }',
    '}',
    'function merge(a, lo, mid, hi) {',
    '  const temp = a.slice(lo, hi + 1)',
    '  let i = 0, j = mid - lo + 1, k = lo',
    '  while (i <= mid - lo && j <= hi - lo) {',
    '    if (temp[i] <= temp[j]) a[k++] = temp[i++]',
    '    else a[k++] = temp[j++]',
    '  }',
    '  while (i <= mid - lo) a[k++] = temp[i++]',
    '  while (j <= hi - lo) a[k++] = temp[j++]',
    '}',
  ],
  quick: [
    'function quickSort(a, lo = 0, hi = a.length - 1) {',
    '  if (lo >= hi) return',
    '  const p = partition(a, lo, hi)',
    '  quickSort(a, lo, p - 1)',
    '  quickSort(a, p + 1, hi)',
    '}',
    'function partition(a, lo, hi) {',
    '  const pivot = a[hi]',
    '  let i = lo',
    '  for (let j = lo; j < hi; j++) {',
    '    if (a[j] < pivot) {',
    '      swap(a[i], a[j])',
    '      i++',
    '    }',
    '  }',
    '  swap(a[i], a[hi])',
    '  return i',
    '}',
  ],
  heap: [
    'function heapSort(a) {',
    '  for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--)',
    '    siftDown(a, i, a.length)',
    '  for (let end = a.length - 1; end > 0; end--) {',
    '    swap(a[0], a[end])',
    '    siftDown(a, 0, end)',
    '  }',
    '}',
    'function siftDown(a, root, size) {',
    '  while (true) {',
    '    let largest = root',
    '    const left = 2 * root + 1',
    '    const right = 2 * root + 2',
    '    if (left < size && a[left] > a[largest]) largest = left',
    '    if (right < size && a[right] > a[largest]) largest = right',
    '    if (largest === root) break',
    '    swap(a[root], a[largest])',
    '    root = largest',
    '  }',
    '}',
  ],
};

class Recorder {
  readonly frames: SortFrame[] = [];
  comparisons = 0;
  writes = 0;

  constructor(private readonly recordFrames: boolean) {}

  compare(): void {
    this.comparisons += 1;
  }

  write(): void {
    this.writes += 1;
  }

  push(array: number[], line: number, message: string, highlights: () => SortHighlight[]): void {
    if (!this.recordFrames) {
      return;
    }
    this.frames.push({
      array: [...array],
      comparisons: this.comparisons,
      writes: this.writes,
      highlights: highlights(),
      line,
      message,
    });
  }
}

function sortedHighlights(
  sorted: Iterable<number>,
  overrides: SortHighlight[] = [],
): SortHighlight[] {
  const map = new Map<number, SortTone>();
  for (const index of sorted) {
    map.set(index, 'sorted');
  }
  for (const highlight of overrides) {
    map.set(highlight.index, highlight.tone);
  }
  return [...map].map(([index, tone]) => ({ index, tone }));
}

function rangeHighlights(lo: number, hi: number, tone: SortTone): SortHighlight[] {
  const highlights: SortHighlight[] = [];
  for (let index = lo; index <= hi; index += 1) {
    highlights.push({ index, tone });
  }
  return highlights;
}

function finish(r: Recorder, array: number[], line: number, message: string): SortRun {
  const all = new Set<number>(array.map((_, index) => index));
  r.push(array, line, message, () => sortedHighlights(all));
  return {
    frames: r.frames,
    result: [...array],
    comparisons: r.comparisons,
    writes: r.writes,
  };
}

function bubbleSort(input: number[], record: boolean): SortRun {
  const a = [...input];
  const n = a.length;
  const r = new Recorder(record);
  const sorted = new Set<number>();

  for (let i = 0; i < n - 1; i += 1) {
    let swapped = false;

    for (let j = 0; j < n - 1 - i; j += 1) {
      r.compare();
      r.push(a, 3, `Comparamos ${a[j]} y ${a[j + 1]}`, () =>
        sortedHighlights(sorted, [
          { index: j, tone: 'compare' },
          { index: j + 1, tone: 'compare' },
        ]),
      );

      if (a[j] > a[j + 1]) {
        const left = a[j];
        const right = a[j + 1];
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        r.write();
        r.push(a, 5, `Intercambiamos ${left} ↔ ${right}`, () =>
          sortedHighlights(sorted, [
            { index: j, tone: 'swap' },
            { index: j + 1, tone: 'swap' },
          ]),
        );
        swapped = true;
      }
    }

    sorted.add(n - 1 - i);
    r.push(a, 9, `El mayor de la pasada quedó en la posición ${n - 1 - i}`, () =>
      sortedHighlights(sorted),
    );

    if (!swapped) {
      for (let k = 0; k < n; k += 1) {
        sorted.add(k);
      }
      r.push(a, 9, 'No hubo intercambios: el arreglo ya estaba ordenado', () =>
        sortedHighlights(sorted),
      );
      break;
    }
  }

  for (let k = 0; k < n; k += 1) {
    sorted.add(k);
  }
  return finish(r, a, 11, 'Burbuja completado');
}

function selectionSort(input: number[], record: boolean): SortRun {
  const a = [...input];
  const n = a.length;
  const r = new Recorder(record);
  const sorted = new Set<number>();

  for (let i = 0; i < n - 1; i += 1) {
    let min = i;

    for (let j = i + 1; j < n; j += 1) {
      r.compare();
      r.push(a, 4, `¿${a[j]} < ${a[min]}?`, () =>
        sortedHighlights(sorted, [
          { index: min, tone: 'compare' },
          { index: j, tone: 'compare' },
        ]),
      );
      if (a[j] < a[min]) {
        min = j;
        r.push(a, 4, `Nuevo mínimo: ${a[min]}`, () =>
          sortedHighlights(sorted, [{ index: min, tone: 'active' }]),
        );
      }
    }

    if (min !== i) {
      const left = a[i];
      const right = a[min];
      [a[i], a[min]] = [a[min], a[i]];
      r.write();
      r.push(a, 6, `Colocamos ${left} ↔ ${right}`, () =>
        sortedHighlights(sorted, [
          { index: i, tone: 'swap' },
          { index: min, tone: 'swap' },
        ]),
      );
    }

    sorted.add(i);
    r.push(a, 7, `La posición ${i} ya tiene su valor definitivo`, () => sortedHighlights(sorted));
  }

  sorted.add(n - 1);
  return finish(r, a, 9, 'Selección completada');
}

function insertionSort(input: number[], record: boolean): SortRun {
  const a = [...input];
  const n = a.length;
  const r = new Recorder(record);
  const sorted = new Set<number>([0]);

  for (let i = 1; i < n; i += 1) {
    const key = a[i];
    let j = i - 1;

    r.push(a, 2, `Tomamos ${key} para insertarlo`, () =>
      sortedHighlights(sorted, [{ index: i, tone: 'pivot' }]),
    );

    while (j >= 0) {
      r.compare();
      r.push(a, 4, `Comparamos ${key} con ${a[j]}`, () =>
        sortedHighlights(sorted, [
          { index: j, tone: 'compare' },
          { index: j + 1, tone: 'active' },
        ]),
      );

      if (a[j] <= key) {
        break;
      }

      a[j + 1] = a[j];
      r.write();
      r.push(a, 5, `Desplazamos ${a[j]} a la derecha`, () =>
        sortedHighlights(sorted, [
          { index: j, tone: 'compare' },
          { index: j + 1, tone: 'write' },
        ]),
      );
      j -= 1;
    }

    a[j + 1] = key;
    r.write();
    for (let k = 0; k <= i; k += 1) {
      sorted.add(k);
    }
    r.push(a, 8, `Insertamos ${key} en la posición ${j + 1}`, () => sortedHighlights(sorted));
  }

  for (let k = 0; k < n; k += 1) {
    sorted.add(k);
  }
  return finish(r, a, 10, 'Inserción completada');
}

function mergeSort(input: number[], record: boolean): SortRun {
  const a = [...input];
  const n = a.length;
  const r = new Recorder(record);

  const merge = (lo: number, mid: number, hi: number): void => {
    const temp = a.slice(lo, hi + 1);
    const leftCount = mid - lo + 1;
    let i = 0;
    let j = leftCount;
    let k = lo;

    r.push(a, 10, `Mezclamos [${lo}…${mid}] y [${mid + 1}…${hi}]`, () =>
      rangeHighlights(lo, hi, 'active'),
    );

    while (i < leftCount && j < temp.length) {
      r.compare();
      const takeLeft = temp[i] <= temp[j];
      a[k] = takeLeft ? temp[i++] : temp[j++];
      r.write();
      r.push(a, takeLeft ? 13 : 14, `Escribimos ${a[k]} en la posición ${k}`, () => [
        ...rangeHighlights(lo, hi, 'active'),
        { index: k, tone: 'write' },
      ]);
      k += 1;
    }

    while (i < leftCount) {
      a[k] = temp[i++];
      r.write();
      r.push(a, 16, `Copiamos ${a[k]} en la posición ${k}`, () => [
        ...rangeHighlights(lo, hi, 'active'),
        { index: k, tone: 'write' },
      ]);
      k += 1;
    }

    while (j < temp.length) {
      a[k] = temp[j++];
      r.write();
      r.push(a, 17, `Copiamos ${a[k]} en la posición ${k}`, () => [
        ...rangeHighlights(lo, hi, 'active'),
        { index: k, tone: 'write' },
      ]);
      k += 1;
    }

    const window = new Set<number>();
    for (let index = lo; index <= hi; index += 1) {
      window.add(index);
    }
    r.push(a, 18, `Segmento [${lo}…${hi}] ordenado`, () => sortedHighlights(window));
  };

  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width - 1, n - 1);
      const hi = Math.min(lo + 2 * width - 1, n - 1);
      if (mid < hi) {
        merge(lo, mid, hi);
      }
    }
  }

  return finish(r, a, 8, 'Mezcla completada');
}

function quickSort(input: number[], record: boolean): SortRun {
  const a = [...input];
  const n = a.length;
  const r = new Recorder(record);
  const sorted = new Set<number>();

  const partition = (lo: number, hi: number): number => {
    const pivot = a[hi];
    let i = lo;

    r.push(a, 8, `Pivote: ${pivot}`, () =>
      sortedHighlights(sorted, [{ index: hi, tone: 'pivot' }]),
    );

    for (let j = lo; j < hi; j += 1) {
      r.compare();
      r.push(a, 10, `Comparamos ${a[j]} con el pivote ${pivot}`, () =>
        sortedHighlights(sorted, [
          { index: hi, tone: 'pivot' },
          { index: j, tone: 'compare' },
        ]),
      );

      if (a[j] < pivot) {
        if (i !== j) {
          const left = a[i];
          const right = a[j];
          [a[i], a[j]] = [a[j], a[i]];
          r.write();
          r.push(a, 11, `Intercambiamos ${left} ↔ ${right}`, () =>
            sortedHighlights(sorted, [
              { index: hi, tone: 'pivot' },
              { index: i, tone: 'swap' },
              { index: j, tone: 'swap' },
            ]),
          );
        }
        i += 1;
      }
    }

    if (i !== hi) {
      const left = a[i];
      const right = a[hi];
      [a[i], a[hi]] = [a[hi], a[i]];
      r.write();
      r.push(a, 15, `Pivote ${right} a su posición final`, () =>
        sortedHighlights(sorted, [
          { index: i, tone: 'swap' },
          { index: hi, tone: 'swap' },
        ]),
      );
    }

    sorted.add(i);
    r.push(a, 16, `El pivote ${pivot} quedó en la posición ${i}`, () => sortedHighlights(sorted));
    return i;
  };

  const sort = (lo: number, hi: number): void => {
    if (lo >= hi) {
      if (lo === hi) {
        sorted.add(lo);
      }
      return;
    }
    const pivotIndex = partition(lo, hi);
    sort(lo, pivotIndex - 1);
    sort(pivotIndex + 1, hi);
  };

  sort(0, n - 1);
  return finish(r, a, 17, 'Rápido completado');
}

function heapSort(input: number[], record: boolean): SortRun {
  const a = [...input];
  const n = a.length;
  const r = new Recorder(record);
  const sorted = new Set<number>();

  const siftDown = (root: number, size: number): void => {
    while (true) {
      const left = 2 * root + 1;
      const right = 2 * root + 2;
      let largest = root;

      if (left < size) {
        r.compare();
        r.push(a, 13, `Comparamos ${a[left]} con ${a[largest]}`, () =>
          sortedHighlights(sorted, [
            { index: root, tone: 'active' },
            { index: left, tone: 'compare' },
          ]),
        );
        if (a[left] > a[largest]) {
          largest = left;
        }
      }

      if (right < size) {
        r.compare();
        r.push(a, 14, `Comparamos ${a[right]} con ${a[largest]}`, () =>
          sortedHighlights(sorted, [
            { index: root, tone: 'active' },
            { index: right, tone: 'compare' },
          ]),
        );
        if (a[right] > a[largest]) {
          largest = right;
        }
      }

      if (largest === root) {
        r.push(a, 15, 'El montículo es válido en esta rama', () =>
          sortedHighlights(sorted, [{ index: root, tone: 'active' }]),
        );
        break;
      }

      const leftValue = a[root];
      const rightValue = a[largest];
      [a[root], a[largest]] = [a[largest], a[root]];
      r.write();
      r.push(a, 16, `Intercambiamos ${leftValue} ↔ ${rightValue}`, () =>
        sortedHighlights(sorted, [
          { index: root, tone: 'swap' },
          { index: largest, tone: 'swap' },
        ]),
      );
      root = largest;
    }
  };

  for (let i = Math.floor(n / 2) - 1; i >= 0; i -= 1) {
    siftDown(i, n);
  }
  r.push(a, 2, 'Max-heap construido', () => sortedHighlights(sorted));

  for (let end = n - 1; end > 0; end -= 1) {
    const max = a[0];
    [a[0], a[end]] = [a[end], a[0]];
    r.write();
    sorted.add(end);
    r.push(a, 4, `Extraemos el máximo ${max} al final`, () =>
      sortedHighlights(sorted, [{ index: end, tone: 'swap' }]),
    );
    siftDown(0, end);
    r.push(a, 6, `Sufijo ordenado desde ${end}`, () => sortedHighlights(sorted));
  }

  sorted.add(0);
  return finish(r, a, 7, 'Montículo completado');
}

export function runSort(algorithm: SortAlgorithm, input: number[], recordFrames = true): SortRun {
  switch (algorithm) {
    case 'bubble':
      return bubbleSort(input, recordFrames);
    case 'selection':
      return selectionSort(input, recordFrames);
    case 'insertion':
      return insertionSort(input, recordFrames);
    case 'merge':
      return mergeSort(input, recordFrames);
    case 'quick':
      return quickSort(input, recordFrames);
    case 'heap':
      return heapSort(input, recordFrames);
  }
}

/** PRNG determinista para reproducir arreglos entre servidor y cliente. */
export function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateArray(
  size: number,
  distribution: SortDistribution,
  random: () => number = Math.random,
): number[] {
  const values = Array.from({ length: size }, (_, index) => index + 1);

  if (distribution === 'reversed') {
    return values.reverse();
  }

  if (distribution === 'nearly') {
    if (size < 2) {
      return values;
    }
    const swaps = Math.max(1, Math.floor(size * 0.12));
    for (let count = 0; count < swaps; count += 1) {
      const index = Math.floor(random() * Math.max(1, size - 1));
      [values[index], values[index + 1]] = [values[index + 1], values[index]];
    }
    return values;
  }

  if (distribution === 'fewUnique') {
    const distinct = Math.max(2, Math.floor(size / 5));
    return values.map(() => 1 + Math.floor(random() * distinct));
  }

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
}
