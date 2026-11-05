import type { Frame, Operation } from './models';

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
}

export interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Neighbor {
  to: string;
  weight: number;
  edgeId: string;
}

export function createGraph(): GraphState {
  return {
    nodes: [
      { id: 'A', label: 'A', x: 80, y: 90 },
      { id: 'B', label: 'B', x: 80, y: 260 },
      { id: 'C', label: 'C', x: 240, y: 60 },
      { id: 'D', label: 'D', x: 250, y: 230 },
      { id: 'E', label: 'E', x: 410, y: 130 },
      { id: 'F', label: 'F', x: 400, y: 300 },
      { id: 'G', label: 'G', x: 570, y: 200 },
    ],
    edges: [
      { id: 'e-A-B', from: 'A', to: 'B', weight: 4 },
      { id: 'e-A-C', from: 'A', to: 'C', weight: 2 },
      { id: 'e-B-C', from: 'B', to: 'C', weight: 1 },
      { id: 'e-B-D', from: 'B', to: 'D', weight: 5 },
      { id: 'e-C-D', from: 'C', to: 'D', weight: 8 },
      { id: 'e-C-E', from: 'C', to: 'E', weight: 10 },
      { id: 'e-D-E', from: 'D', to: 'E', weight: 2 },
      { id: 'e-D-F', from: 'D', to: 'F', weight: 6 },
      { id: 'e-E-F', from: 'E', to: 'F', weight: 3 },
      { id: 'e-E-G', from: 'E', to: 'G', weight: 5 },
      { id: 'e-F-G', from: 'F', to: 'G', weight: 1 },
    ],
  };
}

export function buildAdjacency(graph: GraphState): Map<string, Neighbor[]> {
  const adjacency = new Map<string, Neighbor[]>(graph.nodes.map((node) => [node.id, []]));

  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push({
      to: edge.to,
      weight: edge.weight,
      edgeId: edge.id,
    });
    adjacency.get(edge.to)?.push({
      to: edge.from,
      weight: edge.weight,
      edgeId: edge.id,
    });
  }

  for (const neighbors of adjacency.values()) {
    neighbors.sort((a, b) => a.to.localeCompare(b.to));
  }

  return adjacency;
}

function visitedHighlights(
  visited: Set<string>,
  currentId: string | null = null,
): { id: string; tone: 'visited' | 'active' }[] {
  return [...visited].map((id) => ({
    id,
    tone: id === currentId ? 'active' : 'visited',
  }));
}

export function bfs(graph: GraphState, start: string): Operation<GraphState> {
  const adjacency = buildAdjacency(graph);
  const frames: Frame<GraphState>[] = [];
  const visited = new Set<string>();
  const queue: string[] = [start];
  const queued = new Set<string>([start]);
  const order: string[] = [];

  frames.push({
    state: graph,
    highlights: [{ id: start, tone: 'active' }],
    operation: 'bfs',
    line: 1,
    message: `BFS desde ${start}: encolamos ${start}`,
  });

  while (queue.length > 0) {
    const current = queue.shift()!;
    queued.delete(current);

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);
    order.push(current);

    frames.push({
      state: graph,
      highlights: visitedHighlights(visited, current),
      operation: 'bfs',
      line: 5,
      message: `BFS: visitamos ${current}; orden ${order.join(' → ')}`,
    });

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.to) || queued.has(neighbor.to)) {
        continue;
      }
      queue.push(neighbor.to);
      queued.add(neighbor.to);
      frames.push({
        state: graph,
        highlights: [
          ...visitedHighlights(visited, current),
          { id: neighbor.to, tone: 'compare' },
          { id: neighbor.edgeId, tone: 'compare' },
        ],
        operation: 'bfs',
        line: 7,
        message: `BFS: desde ${current} encolamos ${neighbor.to}`,
      });
    }
  }

  frames.push({
    state: graph,
    highlights: visitedHighlights(visited),
    operation: 'bfs',
    line: 10,
    message: `BFS desde ${start}: ${order.join(' → ')}`,
  });

  return { result: graph, frames };
}

export function dfs(graph: GraphState, start: string): Operation<GraphState> {
  const adjacency = buildAdjacency(graph);
  const frames: Frame<GraphState>[] = [];
  const visited = new Set<string>();
  const order: string[] = [];

  frames.push({
    state: graph,
    highlights: [{ id: start, tone: 'active' }],
    operation: 'dfs',
    line: 0,
    message: `DFS desde ${start}`,
  });

  const visit = (current: string): void => {
    if (visited.has(current)) {
      return;
    }

    visited.add(current);
    order.push(current);

    frames.push({
      state: graph,
      highlights: visitedHighlights(visited, current),
      operation: 'dfs',
      line: 2,
      message: `DFS: visitamos ${current}; orden ${order.join(' → ')}`,
    });

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.to)) {
        continue;
      }
      frames.push({
        state: graph,
        highlights: [
          ...visitedHighlights(visited, current),
          { id: neighbor.to, tone: 'compare' },
          { id: neighbor.edgeId, tone: 'compare' },
        ],
        operation: 'dfs',
        line: 4,
        message: `DFS: desde ${current} exploramos ${neighbor.to}`,
      });
      visit(neighbor.to);
    }
  };

  visit(start);

  frames.push({
    state: graph,
    highlights: visitedHighlights(visited),
    operation: 'dfs',
    line: 6,
    message: `DFS desde ${start}: ${order.join(' → ')}`,
  });

  return { result: graph, frames };
}

export function dijkstra(graph: GraphState, start: string): Operation<GraphState> {
  const adjacency = buildAdjacency(graph);
  const frames: Frame<GraphState>[] = [];
  const distances = new Map<string, number>(
    graph.nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]),
  );
  const visited = new Set<string>();

  distances.set(start, 0);

  frames.push({
    state: graph,
    highlights: [{ id: start, tone: 'active' }],
    operation: 'dijkstra',
    line: 1,
    message: `Dijkstra desde ${start}: dist(${start}) = 0`,
  });

  while (visited.size < graph.nodes.length) {
    let current: string | null = null;
    let best = Number.POSITIVE_INFINITY;

    for (const node of graph.nodes) {
      if (!visited.has(node.id) && distances.get(node.id)! < best) {
        best = distances.get(node.id)!;
        current = node.id;
      }
    }

    if (current === null) {
      break;
    }

    visited.add(current);

    frames.push({
      state: graph,
      highlights: visitedHighlights(visited, current),
      operation: 'dijkstra',
      line: 4,
      message: `Dijkstra: extraemos ${current} con distancia ${formatDistance(best)}`,
    });

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.to)) {
        continue;
      }

      const candidate = best + neighbor.weight;
      const previous = distances.get(neighbor.to)!;
      const improves = candidate < previous;

      if (improves) {
        distances.set(neighbor.to, candidate);
      }

      frames.push({
        state: graph,
        highlights: [
          ...visitedHighlights(visited, current),
          { id: neighbor.to, tone: 'compare' },
          { id: neighbor.edgeId, tone: improves ? 'active' : 'compare' },
        ],
        operation: 'dijkstra',
        line: improves ? 7 : 6,
        message: improves
          ? `Dijkstra: relajamos ${neighbor.to}: ${formatDistance(previous)} → ${candidate}`
          : `Dijkstra: ${neighbor.to} conserva ${formatDistance(previous)} (${candidate} no mejora)`,
      });
    }
  }

  const summary = graph.nodes
    .map((node) => `${node.label}=${formatDistance(distances.get(node.id)!)}`)
    .join(' · ');

  frames.push({
    state: graph,
    highlights: visitedHighlights(visited),
    operation: 'dijkstra',
    line: 11,
    message: `Distancias desde ${start}: ${summary}`,
  });

  return { result: graph, frames };
}

function formatDistance(value: number): string {
  return Number.isFinite(value) ? String(value) : '∞';
}
