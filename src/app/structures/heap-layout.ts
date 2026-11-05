import type { HeapState } from './heap';

export interface HeapNodeView {
  index: number;
  value: number;
  x: number;
  y: number;
}

export interface HeapEdgeView {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface HeapLayout {
  nodes: HeapNodeView[];
  edges: HeapEdgeView[];
  width: number;
  height: number;
}

/** Layout de un árbol binario completo a partir del arreglo del heap. */
export function layoutHeap(values: HeapState): HeapLayout {
  if (values.length === 0) {
    return { nodes: [], edges: [], width: 340, height: 200 };
  }

  const maxDepth = Math.floor(Math.log2(values.length));
  const width = Math.max(340, 2 ** maxDepth * 84);
  const height = 40 + (maxDepth + 1) * 78;

  const nodes: HeapNodeView[] = values.map((value, index) => {
    const depth = Math.floor(Math.log2(index + 1));
    const levelStart = 2 ** depth - 1;
    const position = index - levelStart;
    const levelCount = 2 ** depth;

    return {
      index,
      value,
      x: (width * (position + 0.5)) / levelCount,
      y: 30 + depth * 78,
    };
  });

  const edges: HeapEdgeView[] = [];
  for (let index = 1; index < nodes.length; index += 1) {
    const parentIndex = Math.floor((index - 1) / 2);
    edges.push({
      id: `heap-${parentIndex}-${index}`,
      x1: nodes[parentIndex].x,
      y1: nodes[parentIndex].y,
      x2: nodes[index].x,
      y2: nodes[index].y,
    });
  }

  return { nodes, edges, width, height };
}
