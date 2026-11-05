import {
  buildBalancedTree,
  insert as insertTree,
  remove as removeTree,
  search as searchTree,
  traverse,
  type TreeState,
} from './bst';
import { buildBalancedAvl, insert as insertAvl, remove as removeAvl, type AvlState } from './avl';
import { buildHeap, extractMin, insert as insertHeap } from './heap';
import {
  createTable,
  get as getHash,
  hashIndex,
  remove as removeHash,
  set as setHash,
} from './hash-table';
import { bfs, createGraph, dfs, dijkstra } from './graph';
import { createList, insertAt, insertHead, removeAt, search } from './linked-list';
import { INITIAL_STACK, clear, peek, pop, push } from './stack';
import { enqueue, dequeue } from './queue';

function treeValues(state: TreeState): number[] {
  const values: number[] = [];
  const walk = (id: string | null): void => {
    if (id === null) {
      return;
    }
    const node = state.nodes[id];
    walk(node.left);
    values.push(node.value);
    walk(node.right);
  };
  walk(state.root);
  return values;
}

describe('pila', () => {
  it('apila y desapila en orden LIFO', () => {
    const pushed = push([1, 2], 3);

    expect(pushed.result).toEqual([1, 2, 3]);
    expect(pushed.frames.at(-1)?.highlights).toEqual([{ id: '2', tone: 'insert' }]);
    expect(pop(pushed.result).result).toEqual([1, 2]);
  });

  it('avisa cuando está vacía', () => {
    expect(pop([]).frames.at(-1)?.message).toContain('vacía');
    expect(peek([]).frames.at(-1)?.message).toContain('vacía');
    expect(clear(INITIAL_STACK).result).toEqual([]);
  });
});

describe('cola', () => {
  it('encola al final y desencola al frente', () => {
    const queued = enqueue([4, 9], 15);

    expect(queued.result).toEqual([4, 9, 15]);
    expect(dequeue(queued.result).result).toEqual([9, 15]);
    expect(dequeue([]).frames.at(-1)?.message).toContain('vacía');
  });
});

describe('lista enlazada', () => {
  it('inserta en cabeza y en una posición intermedia', () => {
    const list = createList([7, 13]);

    expect(insertHead(list, 3).result.map((node) => node.value)).toEqual([3, 7, 13]);
    expect(insertAt(list, 1, 9).result.map((node) => node.value)).toEqual([7, 9, 13]);
  });

  it('elimina y busca valores', () => {
    const list = createList([7, 13, 21]);

    expect(removeAt(list, 1).result.map((node) => node.value)).toEqual([7, 21]);
    expect(search(list, 13).frames.at(-1)?.message).toContain('encontrado');
    expect(search(list, 99).frames.at(-1)?.message).toContain('no se encontró');
  });

  it('rechaza índices fuera de rango', () => {
    const list = createList([7, 13]);

    expect(insertAt(list, 9, 5).result).toBe(list);
    expect(insertAt(list, 9, 5).frames[0].message).toContain('fuera de rango');
  });
});

describe('árbol binario de búsqueda', () => {
  it('construye un árbol balanceado y mantiene el orden', () => {
    const tree = buildBalancedTree([40, 20, 60, 10, 30, 50, 70]);

    expect(treeValues(tree)).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it('inserta y busca valores', () => {
    const tree = buildBalancedTree([10, 5, 15]);
    const inserted = insertTree(tree, 7);

    expect(treeValues(inserted.result)).toEqual([5, 7, 10, 15]);
    expect(searchTree(inserted.result, 7).frames.at(-1)?.message).toContain('encontrado');
    expect(searchTree(inserted.result, 99).frames.at(-1)?.message).toContain('no está');
  });

  it('elimina hojas y nodos con dos hijos', () => {
    const tree = buildBalancedTree([10, 5, 15, 3, 7, 12, 20]);

    expect(treeValues(removeTree(tree, 3).result)).toEqual([5, 7, 10, 12, 15, 20]);
    expect(treeValues(removeTree(tree, 10).result)).toEqual([3, 5, 7, 12, 15, 20]);
  });

  it('recorre en inorden', () => {
    const tree = buildBalancedTree([10, 5, 15]);
    const frames = traverse(tree, 'inorder').frames;

    expect(frames).toHaveLength(3);
    expect(frames.at(-1)?.message).toContain('5 → 10 → 15');
  });
});

function assertAvl(state: AvlState): number {
  const walk = (id: string | null): number => {
    if (id === null) {
      return 0;
    }
    const node = state.nodes[id];
    const left = walk(node.left);
    const right = walk(node.right);

    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    expect(node.height).toBe(1 + Math.max(left, right));

    return node.height;
  };

  return walk(state.root);
}

function assertTreeIntegrity(state: TreeState): void {
  if (state.root !== null) {
    expect(state.nodes[state.root]).toBeDefined();
  }
  for (const node of Object.values(state.nodes)) {
    if (node.left !== null) {
      expect(state.nodes[node.left]).toBeDefined();
    }
    if (node.right !== null) {
      expect(state.nodes[node.right]).toBeDefined();
    }
  }
}

function expectMinHeap(heap: number[]): void {
  for (let index = 1; index < heap.length; index += 1) {
    const parent = Math.floor((index - 1) / 2);
    expect(heap[parent]).toBeLessThanOrEqual(heap[index]);
  }
}

describe('árbol AVL', () => {
  it('rota al insertar en orden y mantiene el balance', () => {
    let tree = buildBalancedAvl([]);

    for (const value of [10, 20, 30]) {
      tree = insertAvl(tree, value).result;
    }

    expect(treeValues(tree)).toEqual([10, 20, 30]);
    expect(tree.nodes[tree.root!].value).toBe(20);
    expect(assertAvl(tree)).toBeGreaterThan(0);
    expect(searchTree(tree, 20).frames.at(-1)?.message).toContain('encontrado');
    expect(traverse(tree, 'inorder').frames.at(-1)?.message).toContain('10 → 20 → 30');
  });

  it('elimina con dos hijos y se rebalancea', () => {
    const tree = buildBalancedAvl([30, 20, 40, 10, 25, 35, 50]);
    const operation = removeAvl(tree, 20);

    for (const frame of operation.frames) {
      assertTreeIntegrity(frame.state);
    }
    assertTreeIntegrity(operation.result);

    expect(treeValues(operation.result)).toEqual([10, 25, 30, 35, 40, 50]);
    assertAvl(operation.result);
  });
});

describe('min-heap', () => {
  it('burbujea al insertar y mantiene el orden de montículo', () => {
    const result = insertHeap([3, 8, 5], 2).result;

    expect(result).toEqual([2, 3, 5, 8]);
    expectMinHeap(result);
  });

  it('extrae el mínimo y hunde la raíz', () => {
    const result = extractMin([3, 8, 5, 15, 10, 9, 7]);

    expect(result.result).toEqual([5, 8, 7, 15, 10, 9]);
    expectMinHeap(result.result);
    expect(buildHeap([9, 3, 7, 1, 8])[0]).toBe(1);
  });
});

describe('tabla hash', () => {
  it('agrupa colisiones en el mismo bucket', () => {
    const table = createTable([
      { key: 5, value: 50 },
      { key: 12, value: 120 },
      { key: 19, value: 190 },
    ]);

    expect(hashIndex(12)).toBe(5);
    expect(table[5].map((entry) => entry.key)).toEqual([5, 12, 19]);
  });

  it('busca, actualiza y elimina claves', () => {
    const table = createTable([
      { key: 5, value: 50 },
      { key: 12, value: 120 },
      { key: 19, value: 190 },
    ]);

    expect(getHash(table, 12).frames.at(-1)?.message).toContain('valor 120');

    const updated = setHash(table, 12, 999).result;
    expect(updated[5].find((entry) => entry.key === 12)?.value).toBe(999);

    const removed = removeHash(updated, 12).result;
    expect(removed[5].map((entry) => entry.key)).toEqual([5, 19]);
  });
});

describe('grafo', () => {
  it('recorre en anchura y profundidad', () => {
    const graph = createGraph();

    expect(bfs(graph, 'A').frames.at(-1)?.message).toContain('A → B → C → D → E → F → G');
    expect(dfs(graph, 'A').frames.at(-1)?.message).toContain('A → B → C → D → E → F → G');
  });

  it('calcula las distancias mínimas con Dijkstra', () => {
    const final = dijkstra(createGraph(), 'A').frames.at(-1)?.message ?? '';

    expect(final).toContain('A=0');
    expect(final).toContain('B=3');
    expect(final).toContain('C=2');
    expect(final).toContain('D=8');
    expect(final).toContain('E=10');
    expect(final).toContain('F=13');
    expect(final).toContain('G=14');
  });
});
