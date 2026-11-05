import { nextNodeId } from './models';
import type { TreeNode, TreeState } from './bst';
import type { AvlNode, AvlState } from './avl';
import type { StructureKey } from './models';
import type { HashState } from './hash-table';

export interface SerializedTreeNode {
  v: number;
  l: SerializedTreeNode | null;
  r: SerializedTreeNode | null;
}

export interface StructuresShareData {
  structure: StructureKey;
  stack: number[];
  queue: number[];
  list: number[];
  bst: SerializedTreeNode | null;
  avl: SerializedTreeNode | null;
  heap: number[];
  hash: { key: number; value: number }[];
  startNode: string;
}

function isSerializedTreeNode(value: unknown): value is SerializedTreeNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { v?: unknown }).v === 'number' &&
    Number.isFinite((value as { v: number }).v)
  );
}

export function serializeTree(state: TreeState): SerializedTreeNode | null {
  const build = (id: string | null): SerializedTreeNode | null => {
    if (id === null) {
      return null;
    }
    const node = state.nodes[id];
    if (!node) {
      return null;
    }
    return {
      v: node.value,
      l: build(node.left),
      r: build(node.right),
    };
  };

  return build(state.root);
}

export function deserializeTree(data: SerializedTreeNode | null): TreeState {
  const nodes: Record<string, TreeNode> = {};

  const build = (item: SerializedTreeNode | null): string | null => {
    if (!isSerializedTreeNode(item)) {
      return null;
    }
    const node: TreeNode = {
      id: nextNodeId('tree'),
      value: item.v,
      left: null,
      right: null,
    };
    nodes[node.id] = node;
    node.left = build(item.l);
    node.right = build(item.r);
    return node.id;
  };

  return { root: build(data), nodes };
}

export function deserializeAvl(data: SerializedTreeNode | null): AvlState {
  const nodes: Record<string, AvlNode> = {};

  const build = (item: SerializedTreeNode | null): string | null => {
    if (!isSerializedTreeNode(item)) {
      return null;
    }
    const node: AvlNode = {
      id: nextNodeId('avl'),
      value: item.v,
      left: null,
      right: null,
      height: 1,
    };
    nodes[node.id] = node;
    node.left = build(item.l);
    node.right = build(item.r);
    node.height =
      1 +
      Math.max(node.left ? nodes[node.left].height : 0, node.right ? nodes[node.right].height : 0);
    return node.id;
  };

  return { root: build(data), nodes };
}

export function serializeHash(state: HashState): { key: number; value: number }[] {
  return state.flatMap((bucket) => bucket.map((entry) => ({ key: entry.key, value: entry.value })));
}
