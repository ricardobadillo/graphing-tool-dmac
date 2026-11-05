import { nextNodeId, randomInt, randomUniqueValues, type Frame, type Operation } from './models';
import type { TreeNode } from './bst';

export interface AvlNode extends TreeNode {
  height: number;
}

export interface AvlState {
  root: string | null;
  nodes: Record<string, AvlNode>;
}

function emptyState(): AvlState {
  return { root: null, nodes: {} };
}

function createNode(value: number): AvlNode {
  return {
    id: nextNodeId('a'),
    value,
    left: null,
    right: null,
    height: 1,
  };
}

function clone(state: AvlState): AvlState {
  const nodes: Record<string, AvlNode> = {};
  for (const [id, node] of Object.entries(state.nodes)) {
    nodes[id] = { ...node };
  }
  return { root: state.root, nodes };
}

function heightOf(state: AvlState, id: string | null): number {
  return id === null ? 0 : state.nodes[id].height;
}

function refreshHeight(state: AvlState, node: AvlNode): void {
  node.height = 1 + Math.max(heightOf(state, node.left), heightOf(state, node.right));
}

export function balanceFactor(state: AvlState, id: string | null): number {
  if (id === null) {
    return 0;
  }
  const node = state.nodes[id];
  return heightOf(state, node.left) - heightOf(state, node.right);
}

function rotateRight(state: AvlState, id: string): string {
  const pivot = state.nodes[id];
  const next = state.nodes[pivot.left!];

  pivot.left = next.right;
  next.right = pivot.id;

  refreshHeight(state, pivot);
  refreshHeight(state, next);

  return next.id;
}

function rotateLeft(state: AvlState, id: string): string {
  const pivot = state.nodes[id];
  const next = state.nodes[pivot.right!];

  pivot.right = next.left;
  next.left = pivot.id;

  refreshHeight(state, pivot);
  refreshHeight(state, next);

  return next.id;
}

export function buildBalancedAvl(values: number[]): AvlState {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  const state = emptyState();

  const build = (items: number[]): string | null => {
    if (items.length === 0) {
      return null;
    }
    const middle = Math.floor(items.length / 2);
    const node = createNode(items[middle]);
    state.nodes[node.id] = node;
    node.left = build(items.slice(0, middle));
    node.right = build(items.slice(middle + 1));
    refreshHeight(state, node);
    return node.id;
  };

  state.root = build(unique);
  return state;
}

export function insert(state: AvlState, value: number): Operation<AvlState> {
  const frames: Frame<AvlState>[] = [];
  const result = clone(state);

  const insertNode = (id: string | null): string => {
    if (id === null) {
      const node = createNode(value);
      result.nodes[node.id] = node;
      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'insert' }],
        operation: 'insert',
        line: 1,
        message: `insert(${value}): nuevo nodo hoja`,
      });
      return node.id;
    }

    const node = result.nodes[id];

    if (value === node.value) {
      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'found' }],
        operation: 'insert',
        line: 4,
        message: `insert(${value}): ya existe; no se inserta`,
      });
      return node.id;
    }

    const goesLeft = value < node.value;
    frames.push({
      state: clone(result),
      highlights: [{ id: node.id, tone: 'compare' }],
      operation: 'insert',
      line: goesLeft ? 2 : 3,
      message: `insert(${value}): ${value} ${goesLeft ? '<' : '>'} ${node.value}; vamos a la ${goesLeft ? 'izquierda' : 'derecha'}`,
    });

    if (goesLeft) {
      node.left = insertNode(node.left);
    } else {
      node.right = insertNode(node.right);
    }

    refreshHeight(result, node);
    const balance = balanceFactor(result, node.id);

    frames.push({
      state: clone(result),
      highlights: [{ id: node.id, tone: 'compare' }],
      operation: 'insert',
      line: 6,
      message: `insert(${value}): altura actualizada; balance(${node.value}) = ${balance}`,
    });

    if (balance > 1) {
      const left = result.nodes[node.left!];
      if (value < left.value) {
        frames.push({
          state: clone(result),
          highlights: [
            { id: node.id, tone: 'active' },
            { id: left.id, tone: 'compare' },
          ],
          operation: 'insert',
          line: 7,
          message: `Rotación simple a la derecha en ${node.value}`,
        });
        return rotateRight(result, node.id);
      }

      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'active' }],
        operation: 'insert',
        line: 9,
        message: `Rotación doble izquierda-derecha en ${node.value}`,
      });
      node.left = rotateLeft(result, node.left!);
      return rotateRight(result, node.id);
    }

    if (balance < -1) {
      const right = result.nodes[node.right!];
      if (value > right.value) {
        frames.push({
          state: clone(result),
          highlights: [
            { id: node.id, tone: 'active' },
            { id: right.id, tone: 'compare' },
          ],
          operation: 'insert',
          line: 8,
          message: `Rotación simple a la izquierda en ${node.value}`,
        });
        return rotateLeft(result, node.id);
      }

      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'active' }],
        operation: 'insert',
        line: 10,
        message: `Rotación doble derecha-izquierda en ${node.value}`,
      });
      node.right = rotateRight(result, node.right!);
      return rotateLeft(result, node.id);
    }

    return node.id;
  };

  result.root = insertNode(result.root);

  frames.push({
    state: clone(result),
    highlights: [],
    operation: 'insert',
    line: 11,
    message: `insert(${value}): árbol AVL balanceado`,
  });

  return { result: clone(result), frames };
}

export function remove(state: AvlState, value: number): Operation<AvlState> {
  const frames: Frame<AvlState>[] = [];
  const result = clone(state);
  let removed = false;

  const removeNode = (
    id: string | null,
    target: number,
    parentId: string | null,
  ): string | null => {
    if (id === null) {
      return null;
    }

    const node = result.nodes[id];

    if (target < node.value) {
      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'compare' }],
        operation: 'remove',
        line: 2,
        message: `remove(${target}): ${target} < ${node.value}; vamos a la izquierda`,
      });
      node.left = removeNode(node.left, target, node.id);
    } else if (target > node.value) {
      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'compare' }],
        operation: 'remove',
        line: 3,
        message: `remove(${target}): ${target} > ${node.value}; vamos a la derecha`,
      });
      node.right = removeNode(node.right, target, node.id);
    } else {
      removed = true;
      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'remove' }],
        operation: 'remove',
        line: 4,
        message: `remove(${target}): encontrado; elegimos el caso`,
      });

      if (node.left === null || node.right === null) {
        const childId = node.left ?? node.right;

        // Actualizamos el enlace del padre antes de capturar el frame para
        // que el snapshot nunca contenga una referencia colgante.
        if (parentId === null) {
          result.root = childId;
        } else {
          const parent = result.nodes[parentId];
          if (parent.left === node.id) {
            parent.left = childId;
          } else {
            parent.right = childId;
          }
        }

        delete result.nodes[node.id];
        frames.push({
          state: clone(result),
          highlights: childId ? [{ id: childId, tone: 'active' }] : [],
          operation: 'remove',
          line: 5,
          message: childId
            ? `remove(${target}): sustituido por su hijo`
            : `remove(${target}): era hoja; eliminado`,
        });
        return childId;
      }

      let successorId = node.right;
      frames.push({
        state: clone(result),
        highlights: [
          { id: node.id, tone: 'remove' },
          { id: successorId, tone: 'compare' },
        ],
        operation: 'remove',
        line: 6,
        message: `remove(${target}): buscamos el sucesor en el subárbol derecho`,
      });

      while (result.nodes[successorId].left !== null) {
        successorId = result.nodes[successorId].left!;
        frames.push({
          state: clone(result),
          highlights: [
            { id: node.id, tone: 'remove' },
            { id: successorId, tone: 'compare' },
          ],
          operation: 'remove',
          line: 6,
          message: `remove(${target}): el menor es ${result.nodes[successorId].value}`,
        });
      }

      const successor = result.nodes[successorId];
      node.value = successor.value;
      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'found' }],
        operation: 'remove',
        line: 7,
        message: `remove(${target}): copiamos el valor ${successor.value}`,
      });

      node.right = removeNode(node.right, successor.value, node.id);
    }

    refreshHeight(result, node);
    const balance = balanceFactor(result, node.id);

    frames.push({
      state: clone(result),
      highlights: [{ id: node.id, tone: 'compare' }],
      operation: 'remove',
      line: 10,
      message: `remove(${target}): altura actualizada; balance(${node.value}) = ${balance}`,
    });

    if (balance > 1) {
      const left = result.nodes[node.left!];
      if (balanceFactor(result, left.id) >= 0) {
        frames.push({
          state: clone(result),
          highlights: [
            { id: node.id, tone: 'active' },
            { id: left.id, tone: 'compare' },
          ],
          operation: 'remove',
          line: 14,
          message: `Rotación simple a la derecha en ${node.value}`,
        });
        return rotateRight(result, node.id);
      }

      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'active' }],
        operation: 'remove',
        line: 15,
        message: `Rotación doble izquierda-derecha en ${node.value}`,
      });
      node.left = rotateLeft(result, node.left!);
      return rotateRight(result, node.id);
    }

    if (balance < -1) {
      const right = result.nodes[node.right!];
      if (balanceFactor(result, right.id) <= 0) {
        frames.push({
          state: clone(result),
          highlights: [
            { id: node.id, tone: 'active' },
            { id: right.id, tone: 'compare' },
          ],
          operation: 'remove',
          line: 16,
          message: `Rotación simple a la izquierda en ${node.value}`,
        });
        return rotateLeft(result, node.id);
      }

      frames.push({
        state: clone(result),
        highlights: [{ id: node.id, tone: 'active' }],
        operation: 'remove',
        line: 17,
        message: `Rotación doble derecha-izquierda en ${node.value}`,
      });
      node.right = rotateRight(result, node.right!);
      return rotateLeft(result, node.id);
    }

    return node.id;
  };

  result.root = removeNode(result.root, value, null);

  frames.push({
    state: clone(result),
    highlights: [],
    operation: 'remove',
    line: 11,
    message: removed
      ? `remove(${value}): árbol actualizado y balanceado`
      : `remove(${value}): no está en el árbol`,
  });

  return { result: clone(result), frames };
}

export function clear(state: AvlState): Operation<AvlState> {
  return {
    result: emptyState(),
    frames: [
      {
        state: clone(state),
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): vaciamos el árbol AVL',
      },
      {
        state: emptyState(),
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): el árbol quedó vacío',
      },
    ],
  };
}

export const INITIAL_AVL_VALUES = [30, 20, 40, 10, 25, 35, 50];

export function randomAvl(): AvlState {
  return buildBalancedAvl(randomUniqueValues(randomInt(7, 9)));
}
