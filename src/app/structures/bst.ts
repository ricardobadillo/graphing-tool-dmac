import { nextNodeId, randomInt, randomUniqueValues, type Frame, type Operation } from './models';

export interface TreeNode {
  id: string;
  value: number;
  left: string | null;
  right: string | null;
}

export interface TreeState {
  root: string | null;
  nodes: Record<string, TreeNode>;
}

export type TraversalOrder = 'inorder' | 'preorder' | 'postorder';

function emptyTree(): TreeState {
  return { root: null, nodes: {} };
}

export function cloneTree(state: TreeState): TreeState {
  const nodes: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(state.nodes)) {
    nodes[id] = { ...node };
  }
  return { root: state.root, nodes };
}

function createNode(value: number): TreeNode {
  return { id: nextNodeId('t'), value, left: null, right: null };
}

export function buildBalancedTree(values: number[]): TreeState {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  const state = emptyTree();

  const build = (items: number[]): string | null => {
    if (items.length === 0) {
      return null;
    }
    const middle = Math.floor(items.length / 2);
    const node = createNode(items[middle]);
    state.nodes[node.id] = node;
    node.left = build(items.slice(0, middle));
    node.right = build(items.slice(middle + 1));
    return node.id;
  };

  state.root = build(unique);
  return state;
}

export function insert(state: TreeState, value: number): Operation<TreeState> {
  const frames: Frame<TreeState>[] = [];

  if (state.root === null) {
    const node = createNode(value);
    const result = cloneTree(state);
    result.root = node.id;
    result.nodes[node.id] = node;

    frames.push({
      state: cloneTree(state),
      highlights: [],
      operation: 'insert',
      line: 1,
      message: `insert(${value}): el árbol está vacío; será la raíz`,
    });
    frames.push({
      state: cloneTree(result),
      highlights: [{ id: node.id, tone: 'insert' }],
      operation: 'insert',
      line: 1,
      message: `insert(${value}): insertado como raíz`,
    });
    return { result: cloneTree(result), frames };
  }

  const result = cloneTree(state);
  let currentId: string | null = result.root;
  let parentId: string | null = null;
  let goesLeft = false;

  while (currentId !== null) {
    const current = result.nodes[currentId];

    if (value === current.value) {
      frames.push({
        state: cloneTree(result),
        highlights: [{ id: current.id, tone: 'found' }],
        operation: 'insert',
        line: 1,
        message: `insert(${value}): ya existe; no se inserta`,
      });
      return { result: cloneTree(result), frames };
    }

    parentId = current.id;
    if (value < current.value) {
      frames.push({
        state: cloneTree(result),
        highlights: [{ id: current.id, tone: 'compare' }],
        operation: 'insert',
        line: 2,
        message: `${value} < ${current.value}: vamos a la izquierda`,
      });
      goesLeft = true;
      currentId = current.left;
    } else {
      frames.push({
        state: cloneTree(result),
        highlights: [{ id: current.id, tone: 'compare' }],
        operation: 'insert',
        line: 4,
        message: `${value} > ${current.value}: vamos a la derecha`,
      });
      goesLeft = false;
      currentId = current.right;
    }
  }

  const node = createNode(value);
  result.nodes[node.id] = node;
  const parent = result.nodes[parentId!];
  if (goesLeft) {
    parent.left = node.id;
  } else {
    parent.right = node.id;
  }

  frames.push({
    state: cloneTree(result),
    highlights: [{ id: node.id, tone: 'insert' }],
    operation: 'insert',
    line: 1,
    message: `insert(${value}): insertado como hijo ${goesLeft ? 'izquierdo' : 'derecho'} de ${parent.value}`,
  });

  return { result: cloneTree(result), frames };
}

export function search<S extends TreeState>(state: S, value: number): Operation<S> {
  const frames: Frame<S>[] = [];

  if (state.root === null) {
    frames.push({
      state,
      highlights: [],
      operation: 'search',
      line: 1,
      message: 'search(): el árbol está vacío',
    });
    return { result: state, frames };
  }

  let currentId: string | null = state.root;

  while (currentId !== null) {
    const current: TreeNode = state.nodes[currentId];

    if (value === current.value) {
      frames.push({
        state,
        highlights: [{ id: current.id, tone: 'found' }],
        operation: 'search',
        line: 1,
        message: `search(${value}): encontrado`,
      });
      return { result: state, frames };
    }

    if (value < current.value) {
      frames.push({
        state,
        highlights: [{ id: current.id, tone: 'compare' }],
        operation: 'search',
        line: 2,
        message: `${value} < ${current.value}: buscamos a la izquierda`,
      });
      currentId = current.left;
    } else {
      frames.push({
        state,
        highlights: [{ id: current.id, tone: 'compare' }],
        operation: 'search',
        line: 3,
        message: `${value} > ${current.value}: buscamos a la derecha`,
      });
      currentId = current.right;
    }
  }

  frames.push({
    state,
    highlights: [],
    operation: 'search',
    line: 1,
    message: `search(${value}): no está en el árbol`,
  });

  return { result: state, frames };
}

export function remove(state: TreeState, value: number): Operation<TreeState> {
  const frames: Frame<TreeState>[] = [];

  if (state.root === null) {
    frames.push({
      state,
      highlights: [],
      operation: 'remove',
      line: 1,
      message: 'remove(): el árbol está vacío',
    });
    return { result: state, frames };
  }

  const result = cloneTree(state);
  let currentId: string | null = result.root;
  let parentId: string | null = null;

  while (currentId !== null) {
    const current: TreeNode = result.nodes[currentId];

    if (value === current.value) {
      break;
    }

    const goesLeft = value < current.value;
    frames.push({
      state: cloneTree(result),
      highlights: [{ id: current.id, tone: 'compare' }],
      operation: 'remove',
      line: goesLeft ? 2 : 3,
      message: `remove(${value}): ${value} ${goesLeft ? '<' : '>'} ${current.value}; vamos a la ${goesLeft ? 'izquierda' : 'derecha'}`,
    });

    parentId = current.id;
    currentId = goesLeft ? current.left : current.right;
  }

  if (currentId === null) {
    frames.push({
      state: cloneTree(result),
      highlights: [],
      operation: 'remove',
      line: 1,
      message: `remove(${value}): no está en el árbol`,
    });
    return { result: cloneTree(result), frames };
  }

  const target = result.nodes[currentId];
  frames.push({
    state: cloneTree(result),
    highlights: [{ id: target.id, tone: 'remove' }],
    operation: 'remove',
    line: 4,
    message: `remove(${value}): encontrado; elegimos el caso de eliminación`,
  });

  if (target.left === null || target.right === null) {
    const childId = target.left ?? target.right;
    const child = childId ? result.nodes[childId] : null;
    const childLine = target.left === null ? 5 : 6;

    if (parentId === null) {
      result.root = childId;
    } else {
      const parent = result.nodes[parentId];
      if (parent.left === target.id) {
        parent.left = childId;
      } else {
        parent.right = childId;
      }
    }

    delete result.nodes[target.id];

    frames.push({
      state: cloneTree(result),
      highlights: child ? [{ id: child.id, tone: 'active' }] : [],
      operation: 'remove',
      line: childLine,
      message: child
        ? `remove(${value}): sustituido por su hijo ${child.value}`
        : `remove(${value}): era hoja; eliminado`,
    });

    return { result: cloneTree(result), frames };
  }

  // Dos hijos: buscamos el sucesor (el menor del subárbol derecho).
  let successorParentId = target.id;
  let successorId = target.right;

  frames.push({
    state: cloneTree(result),
    highlights: [
      { id: target.id, tone: 'remove' },
      { id: successorId, tone: 'compare' },
    ],
    operation: 'remove',
    line: 7,
    message: `remove(${value}): buscamos el sucesor en el subárbol derecho`,
  });

  while (result.nodes[successorId].left !== null) {
    successorParentId = successorId;
    successorId = result.nodes[successorId].left!;
    frames.push({
      state: cloneTree(result),
      highlights: [
        { id: target.id, tone: 'remove' },
        { id: successorId, tone: 'compare' },
      ],
      operation: 'remove',
      line: 8,
      message: `remove(${value}): el menor encontrado es ${result.nodes[successorId].value}`,
    });
  }

  const successor = result.nodes[successorId];
  frames.push({
    state: cloneTree(result),
    highlights: [
      { id: target.id, tone: 'remove' },
      { id: successor.id, tone: 'found' },
    ],
    operation: 'remove',
    line: 9,
    message: `remove(${value}): copiamos el valor ${successor.value}`,
  });

  target.value = successor.value;
  const successorChild = successor.right;

  if (successorParentId === target.id) {
    target.right = successorChild;
  } else {
    result.nodes[successorParentId].left = successorChild;
  }

  delete result.nodes[successor.id];

  frames.push({
    state: cloneTree(result),
    highlights: [{ id: target.id, tone: 'found' }],
    operation: 'remove',
    line: 10,
    message: `remove(${value}): eliminado; el nodo ahora vale ${successor.value}`,
  });

  return { result: cloneTree(result), frames };
}

export function traverse<S extends TreeState>(state: S, order: TraversalOrder): Operation<S> {
  const frames: Frame<S>[] = [];
  const labels: Record<TraversalOrder, string> = {
    inorder: 'Inorden',
    preorder: 'Preorden',
    postorder: 'Postorden',
  };

  if (state.root === null) {
    frames.push({
      state,
      highlights: [],
      operation: order,
      line: 1,
      message: `${labels[order]}: el árbol está vacío`,
    });
    return { result: state, frames };
  }

  const sequence: number[] = [];
  const visited: string[] = [];
  const lines: Record<TraversalOrder, number> = {
    inorder: 3,
    preorder: 2,
    postorder: 4,
  };

  const visit = (id: string | null): void => {
    if (id === null) {
      return;
    }
    const node = state.nodes[id];

    if (order === 'preorder') {
      record(node);
    }
    visit(node.left);
    if (order === 'inorder') {
      record(node);
    }
    visit(node.right);
    if (order === 'postorder') {
      record(node);
    }
  };

  const record = (node: TreeNode): void => {
    sequence.push(node.value);
    visited.push(node.id);
    frames.push({
      state,
      highlights: [
        ...visited.slice(0, -1).map((id) => ({ id, tone: 'visited' as const })),
        { id: node.id, tone: 'active' as const },
      ],
      operation: order,
      line: lines[order],
      message: `${labels[order]}: ${sequence.join(' → ')}`,
    });
  };

  visit(state.root);
  return { result: state, frames };
}

export function clear(state: TreeState): Operation<TreeState> {
  return {
    result: emptyTree(),
    frames: [
      {
        state: cloneTree(state),
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): vaciamos el árbol',
      },
      {
        state: emptyTree(),
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): el árbol quedó vacío',
      },
    ],
  };
}

export const INITIAL_TREE_VALUES = [40, 20, 60, 10, 30, 50, 70];

export function randomTree(): TreeState {
  return buildBalancedTree(randomUniqueValues(randomInt(7, 9)));
}
