export type StructureKey = 'stack' | 'queue' | 'list' | 'bst' | 'avl' | 'heap' | 'hash' | 'graph';

export type HighlightTone = 'active' | 'compare' | 'insert' | 'remove' | 'found' | 'visited';

export interface Highlight {
  id: string;
  tone: HighlightTone;
}

export interface Frame<S> {
  state: S;
  highlights: Highlight[];
  operation: string;
  line: number;
  message: string;
}

export interface Operation<S> {
  frames: Frame<S>[];
  result: S;
}

let nodeCounter = 0;

export function nextNodeId(prefix: string): string {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}`;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Valores con posibles repeticiones (pila, cola, lista). */
export function randomNumbers(count: number): number[] {
  return Array.from({ length: count }, () => randomInt(1, 99));
}

/** Valores únicos (árbol binario de búsqueda). */
export function randomUniqueValues(count: number): number[] {
  const values = new Set<number>();
  while (values.size < count) {
    values.add(randomInt(1, 99));
  }
  return [...values];
}
