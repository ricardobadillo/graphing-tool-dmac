import { randomInt, randomNumbers, type Frame, type Operation } from './models';

export type HeapState = number[];

function parent(index: number): number {
  return Math.floor((index - 1) / 2);
}

function leftChild(index: number): number {
  return index * 2 + 1;
}

function rightChild(index: number): number {
  return index * 2 + 2;
}

export function insert(state: HeapState, value: number): Operation<HeapState> {
  const result = [...state, value];
  const frames: Frame<HeapState>[] = [];
  let index = result.length - 1;

  frames.push({
    state: [...state],
    highlights: [],
    operation: 'insert',
    line: 1,
    message: `insert(${value}): se agrega al final del arreglo`,
  });

  frames.push({
    state: [...result],
    highlights: [{ id: String(index), tone: 'insert' }],
    operation: 'insert',
    line: 2,
    message: `insert(${value}): posición ${index}; burbujeamos hacia arriba`,
  });

  while (index > 0) {
    const parentIndex = parent(index);
    const shouldSwap = result[parentIndex] > result[index];

    frames.push({
      state: [...result],
      highlights: [
        { id: String(index), tone: 'active' },
        { id: String(parentIndex), tone: 'compare' },
      ],
      operation: 'insert',
      line: 3,
      message: `Comparando ${result[index]} con su padre ${result[parentIndex]}`,
    });

    if (!shouldSwap) {
      break;
    }

    [result[parentIndex], result[index]] = [result[index], result[parentIndex]];
    frames.push({
      state: [...result],
      highlights: [
        { id: String(parentIndex), tone: 'insert' },
        { id: String(index), tone: 'compare' },
      ],
      operation: 'insert',
      line: 4,
      message: `Intercambio: ${result[parentIndex]} sube a la posición ${parentIndex}`,
    });
    index = parentIndex;
  }

  frames.push({
    state: [...result],
    highlights: [{ id: String(index), tone: 'insert' }],
    operation: 'insert',
    line: 6,
    message: `insert(${value}): min-heap válido`,
  });

  return { result, frames };
}

export function extractMin(state: HeapState): Operation<HeapState> {
  if (state.length === 0) {
    return {
      result: state,
      frames: [
        {
          state: [],
          highlights: [],
          operation: 'extractMin',
          line: 1,
          message: 'extractMin(): el heap está vacío',
        },
      ],
    };
  }

  const minimum = state[0];
  const result = [...state];
  const frames: Frame<HeapState>[] = [
    {
      state: [...state],
      highlights: [{ id: '0', tone: 'active' }],
      operation: 'extractMin',
      line: 2,
      message: `extractMin(): el mínimo es ${minimum}`,
    },
  ];

  const last = result.pop()!;

  if (result.length > 0) {
    result[0] = last;
    frames.push({
      state: [...result],
      highlights: [{ id: '0', tone: 'active' }],
      operation: 'extractMin',
      line: 5,
      message: `Movemos el último valor (${last}) a la raíz`,
    });

    let index = 0;
    while (true) {
      const left = leftChild(index);
      const right = rightChild(index);
      let smallest = index;

      if (left < result.length && result[left] < result[smallest]) {
        smallest = left;
      }
      if (right < result.length && result[right] < result[smallest]) {
        smallest = right;
      }

      if (smallest === index) {
        break;
      }

      frames.push({
        state: [...result],
        highlights: [
          { id: String(index), tone: 'active' },
          { id: String(smallest), tone: 'compare' },
        ],
        operation: 'extractMin',
        line: 6,
        message: `Hundimos ${result[index]}: su hijo menor es ${result[smallest]}`,
      });

      [result[index], result[smallest]] = [result[smallest], result[index]];
      frames.push({
        state: [...result],
        highlights: [
          { id: String(smallest), tone: 'compare' },
          { id: String(index), tone: 'insert' },
        ],
        operation: 'extractMin',
        line: 6,
        message: `Intercambio en las posiciones ${index} y ${smallest}`,
      });

      index = smallest;
    }
  }

  frames.push({
    state: [...result],
    highlights: [],
    operation: 'extractMin',
    line: 8,
    message: `extractMin(): ${minimum} extraído del heap`,
  });

  return { result, frames };
}

export function peek(state: HeapState): Operation<HeapState> {
  if (state.length === 0) {
    return {
      result: state,
      frames: [
        {
          state: [],
          highlights: [],
          operation: 'peek',
          line: 1,
          message: 'peek(): el heap está vacío',
        },
      ],
    };
  }

  return {
    result: state,
    frames: [
      {
        state: [...state],
        highlights: [{ id: '0', tone: 'found' }],
        operation: 'peek',
        line: 1,
        message: `peek(): el mínimo es ${state[0]}`,
      },
    ],
  };
}

export function clear(state: HeapState): Operation<HeapState> {
  return {
    result: [],
    frames: [
      {
        state: [...state],
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): vaciamos el heap',
      },
      {
        state: [],
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): el heap quedó vacío',
      },
    ],
  };
}

export function buildHeap(values: number[]): HeapState {
  const heap = [...values];

  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) {
    let current = index;

    while (true) {
      const left = leftChild(current);
      const right = rightChild(current);
      let smallest = current;

      if (left < heap.length && heap[left] < heap[smallest]) {
        smallest = left;
      }
      if (right < heap.length && heap[right] < heap[smallest]) {
        smallest = right;
      }
      if (smallest === current) {
        break;
      }

      [heap[current], heap[smallest]] = [heap[smallest], heap[current]];
      current = smallest;
    }
  }

  return heap;
}

export const INITIAL_HEAP: HeapState = [3, 8, 5, 15, 10, 9, 7];

export function randomHeap(): HeapState {
  return buildHeap(randomNumbers(randomInt(5, 9)));
}
