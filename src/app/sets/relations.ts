import { naturalCompare } from './sets';

export interface RelationPair {
  from: string;
  to: string;
}

export interface RelationAnalysis {
  elements: string[];
  pairs: RelationPair[];
  matrix: boolean[][];
  reflexive: boolean;
  irreflexive: boolean;
  symmetric: boolean;
  antisymmetric: boolean;
  transitive: boolean;
  equivalence: boolean;
  partialOrder: boolean;
  functionLike: boolean;
  injective: boolean;
  surjective: boolean;
  bijective: boolean;
  equivalenceClasses: string[][];
}

export interface ParsedRelation {
  pairs: RelationPair[];
  error: string | null;
}

export function parseElements(text: string): string[] {
  const parts = text.trim().split(/[,;]/);
  const values = parts.map((part) => part.trim()).filter(Boolean);
  return [...new Set(values)].sort(naturalCompare);
}

export function parsePairs(text: string, elements: string[]): ParsedRelation {
  const source = text.trim();
  if (!source) {
    return { pairs: [], error: null };
  }

  const known = new Set(elements);
  const pairs: RelationPair[] = [];
  const parenthesized = [...source.matchAll(/\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g)];
  const arrowed = [...source.matchAll(/([^\s,;()]+)\s*(?:->|→|⟶|⇒)\s*([^\s,;()]+)/g)];
  const matches = parenthesized.length > 0 ? parenthesized : arrowed;

  if (matches.length === 0) {
    return {
      pairs: [],
      error: 'Escribe pares como (1,2), (2,3) o 1 -> 2.',
    };
  }

  for (const match of matches) {
    const from = match[1]?.trim();
    const to = match[2]?.trim();
    if (!from || !to) {
      return { pairs: [], error: 'Hay un par incompleto.' };
    }
    if (!known.has(from)) {
      return { pairs: [], error: `El elemento "${from}" no pertenece al conjunto.` };
    }
    if (!known.has(to)) {
      return { pairs: [], error: `El elemento "${to}" no pertenece al conjunto.` };
    }
    pairs.push({ from, to });
  }

  const unique = new Map<string, RelationPair>();
  for (const pair of pairs) {
    unique.set(`${pair.from}\u0000${pair.to}`, pair);
  }

  return { pairs: [...unique.values()], error: null };
}

export function buildMatrix(elements: string[], pairs: RelationPair[]): boolean[][] {
  const index = new Map(elements.map((element, position) => [element, position]));
  const matrix = elements.map(() => elements.map(() => false));

  for (const pair of pairs) {
    const row = index.get(pair.from);
    const column = index.get(pair.to);
    if (row !== undefined && column !== undefined) {
      matrix[row][column] = true;
    }
  }

  return matrix;
}

export function analyzeRelation(elements: string[], pairs: RelationPair[]): RelationAnalysis {
  const matrix = buildMatrix(elements, pairs);
  const size = elements.length;

  let reflexive = true;
  let irreflexive = true;
  for (let index = 0; index < size; index += 1) {
    if (matrix[index][index]) {
      irreflexive = false;
    } else {
      reflexive = false;
    }
  }

  let symmetric = true;
  let antisymmetric = true;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (matrix[row][column] !== matrix[column][row]) {
        symmetric = false;
      }
      if (row !== column && matrix[row][column] && matrix[column][row]) {
        antisymmetric = false;
      }
    }
  }

  let transitive = true;
  for (let first = 0; first < size && transitive; first += 1) {
    for (let second = 0; second < size && transitive; second += 1) {
      if (!matrix[first][second]) {
        continue;
      }
      for (let third = 0; third < size; third += 1) {
        if (matrix[second][third] && !matrix[first][third]) {
          transitive = false;
          break;
        }
      }
    }
  }

  const rowCounts = matrix.map((row) => row.filter(Boolean).length);
  const columnCounts = elements.map((_, column) =>
    matrix.reduce((count, row) => count + (row[column] ? 1 : 0), 0),
  );

  const functionLike = rowCounts.every((count) => count === 1);
  const injective = functionLike && columnCounts.every((count) => count <= 1);
  const surjective = functionLike && columnCounts.every((count) => count >= 1);
  const equivalence = reflexive && symmetric && transitive;
  const partialOrder = reflexive && antisymmetric && transitive;
  const equivalenceClasses = equivalence ? buildClasses(elements, matrix) : [];

  return {
    elements,
    pairs,
    matrix,
    reflexive,
    irreflexive,
    symmetric,
    antisymmetric,
    transitive,
    equivalence,
    partialOrder,
    functionLike,
    injective,
    surjective,
    bijective: injective && surjective,
    equivalenceClasses,
  };
}

function buildClasses(elements: string[], matrix: boolean[][]): string[][] {
  const remaining = new Set(elements.map((_, index) => index));
  const classes: string[][] = [];

  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    if (first === undefined) {
      break;
    }

    const group = elements.filter(
      (_, index) =>
        remaining.has(index) && (index === first || (matrix[first][index] && matrix[index][first])),
    );
    const groupIndexes = group.map((element) => elements.indexOf(element));
    for (const index of groupIndexes) {
      remaining.delete(index);
    }
    classes.push(group);
  }

  return classes.sort((left, right) => naturalCompare(left[0] ?? '', right[0] ?? ''));
}

export function formatPair(pair: RelationPair): string {
  return `(${pair.from}, ${pair.to})`;
}

export function togglePair(pairs: RelationPair[], from: string, to: string): RelationPair[] {
  const exists = pairs.some((pair) => pair.from === from && pair.to === to);
  if (exists) {
    return pairs.filter((pair) => !(pair.from === from && pair.to === to));
  }
  return [...pairs, { from, to }];
}
