import type { TreeNode, TreeState } from './bst';

export interface PositionedNode {
  id: string;
  node: TreeNode;
  x: number;
  y: number;
}

export interface PositionedEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TreeLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

const X_GAP = 72;
const Y_GAP = 84;
const MARGIN = 36;

/**
 * Layout in-order: la posición horizontal sigue el recorrido inorden y la
 * vertical la profundidad. Es determinista y produce árboles legibles.
 */
export function layoutTree(state: TreeState): TreeLayout {
  const positions = new Map<string, { x: number; y: number }>();
  let inOrderIndex = 0;
  let maxDepth = 0;

  const visit = (id: string | null, depth: number): void => {
    if (id === null) {
      return;
    }
    const node = state.nodes[id];
    if (!node) {
      return;
    }

    visit(node.left, depth + 1);

    positions.set(id, {
      x: MARGIN + inOrderIndex * X_GAP,
      y: MARGIN + depth * Y_GAP,
    });
    inOrderIndex += 1;
    maxDepth = Math.max(maxDepth, depth);

    visit(node.right, depth + 1);
  };

  visit(state.root, 0);

  const nodes: PositionedNode[] = [];
  for (const [id, position] of positions) {
    nodes.push({
      id,
      node: state.nodes[id],
      x: position.x,
      y: position.y,
    });
  }

  const edges: PositionedEdge[] = [];
  for (const [id, node] of Object.entries(state.nodes)) {
    const from = positions.get(id);
    if (!from) {
      continue;
    }

    for (const childId of [node.left, node.right]) {
      if (childId === null) {
        continue;
      }
      const to = positions.get(childId);
      if (!to) {
        continue;
      }
      edges.push({
        id: `${id}-${childId}`,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      });
    }
  }

  return {
    nodes,
    edges,
    width: Math.max(300, MARGIN * 2 + Math.max(0, inOrderIndex - 1) * X_GAP),
    height: Math.max(190, MARGIN * 2 + maxDepth * Y_GAP),
  };
}
