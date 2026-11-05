import { buildBalancedAvl, insert as insertAvl } from './avl';
import { createGraph, dijkstra } from './graph';
import { createTable, get as getHash } from './hash-table';
import { buildPrediction } from './predictions';
import { push } from './stack';

function specFor(input: Parameters<typeof buildPrediction>[0]) {
  const spec = buildPrediction(input);
  expect(spec).not.toBeNull();
  return {
    question: spec!.question,
    correct: spec!.options[spec!.correctIndex],
  };
}

describe('predicciones', () => {
  it('predice el nuevo tope de la pila', () => {
    const before = [3, 8];
    const operation = push(before, 5);

    expect(
      specFor({
        structure: 'stack',
        operation: 'push',
        label: 'push(5)',
        before,
        after: operation.result,
        frames: operation.frames,
      }).correct,
    ).toBe('5');
  });

  it('predice una rotación simple en AVL', () => {
    let tree = buildBalancedAvl([]);
    tree = insertAvl(tree, 10).result;
    tree = insertAvl(tree, 20).result;
    const operation = insertAvl(tree, 30);

    const prediction = specFor({
      structure: 'avl',
      operation: 'insert',
      label: 'insert(30)',
      before: tree,
      after: operation.result,
      frames: operation.frames,
    });

    expect(prediction.question).toContain('insertar 30');
    expect(prediction.correct).toBe('Rotación simple');
  });

  it('predice el bucket de una clave hash', () => {
    const table = createTable([{ key: 5, value: 50 }]);
    const operation = getHash(table, 19);

    expect(
      specFor({
        structure: 'hash',
        operation: 'get',
        label: 'get(19)',
        before: table,
        after: operation.result,
        frames: operation.frames,
      }).correct,
    ).toBe('5');
  });

  it('predice la distancia de Dijkstra', () => {
    const graph = createGraph();
    const operation = dijkstra(graph, 'A');

    expect(
      specFor({
        structure: 'graph',
        operation: 'dijkstra',
        label: 'Dijkstra(A)',
        before: graph,
        after: operation.result,
        frames: operation.frames,
        graph,
        startNode: 'A',
      }).correct,
    ).toBe('14');
  });
});
