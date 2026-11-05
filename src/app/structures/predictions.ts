import type { Frame, StructureKey } from './models';
import type { ListState } from './linked-list';
import type { TreeState } from './bst';
import type { AvlState } from './avl';
import { HASH_SIZE, hashIndex } from './hash-table';
import type { GraphState } from './graph';

export interface PredictionSpec {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface PredictionInput {
  structure: StructureKey;
  operation: string;
  label: string;
  before: unknown;
  after: unknown;
  frames: Frame<unknown>[];
  graph?: GraphState;
  startNode?: string;
}

export function buildPrediction(input: PredictionInput): PredictionSpec | null {
  const { structure, operation, label, before, after, frames } = input;

  switch (structure) {
    case 'stack':
      return stackPrediction(operation, before as number[], after as number[]);
    case 'queue':
      return queuePrediction(operation, before as number[], after as number[]);
    case 'list':
      return listPrediction(operation, before as ListState, after as ListState, label);
    case 'bst':
      return treePrediction(operation, before as TreeState, label, frames, false);
    case 'avl':
      return treePrediction(operation, before as AvlState, label, frames, true);
    case 'heap':
      return heapPrediction(operation, before as number[], after as number[]);
    case 'hash':
      return hashPrediction(operation, label);
    case 'graph':
      return graphPrediction(operation, frames, input.graph, input.startNode);
  }
}

function makeSpec(
  question: string,
  correct: string | number,
  distractors: (string | number | null | undefined)[],
  explanation: string,
): PredictionSpec | null {
  const correctText = String(correct);
  const options = [
    ...new Set(
      [
        correctText,
        ...distractors.map((value) => (value === null || value === undefined ? '' : String(value))),
      ].filter((value) => value !== ''),
    ),
  ];

  if (options.length < 2) {
    return null;
  }

  for (let index = options.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [options[index], options[swap]] = [options[swap], options[index]];
  }

  return {
    question,
    options,
    correctIndex: options.indexOf(correctText),
    explanation,
  };
}

function numbersFrom(label: string): number[] {
  return (label.match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .filter((value) => Number.isFinite(value));
}

function stackPrediction(
  operation: string,
  before: number[],
  after: number[],
): PredictionSpec | null {
  if (operation === 'push') {
    const correct = after[after.length - 1];
    return makeSpec(
      '¿Qué valor quedará en el tope?',
      correct,
      [before[before.length - 1], before[0], 'No cambia'],
      `El último valor insertado queda en el tope: ${correct}.`,
    );
  }

  if (operation === 'pop') {
    if (before.length === 0) {
      return makeSpec(
        '¿Qué ocurrirá al hacer pop?',
        'La pila está vacía',
        ['Se elimina 0', 'No cambia', 'La pila queda con un elemento'],
        'La pila no tiene elementos que extraer.',
      );
    }
    const correct = before[before.length - 1];
    return makeSpec(
      '¿Qué valor saldrá de la pila?',
      correct,
      [before[0], after[after.length - 1] ?? 'La pila queda vacía', 'No cambia'],
      'En una pila sale el último valor que entró (LIFO).',
    );
  }

  if (operation === 'peek') {
    const correct = before.length > 0 ? before[before.length - 1] : 'La pila está vacía';
    return makeSpec(
      '¿Qué valor está en el tope?',
      correct,
      [before[0], 'No cambia', 'La pila está vacía'],
      'peek consulta el último elemento sin extraerlo.',
    );
  }

  return null;
}

function queuePrediction(
  operation: string,
  before: number[],
  after: number[],
): PredictionSpec | null {
  if (operation === 'enqueue') {
    const correct = after[after.length - 1];
    return makeSpec(
      '¿Qué valor quedará al final de la cola?',
      correct,
      [before[0], after[0], 'No cambia'],
      `El nuevo valor se agrega al final: ${correct}.`,
    );
  }

  if (operation === 'dequeue') {
    if (before.length === 0) {
      return makeSpec(
        '¿Qué ocurrirá al desencolar?',
        'La cola está vacía',
        ['Se elimina 0', 'No cambia', 'La cola queda con un elemento'],
        'La cola no tiene elementos que extraer.',
      );
    }
    const correct = before[0];
    return makeSpec(
      '¿Qué valor saldrá de la cola?',
      correct,
      [before[before.length - 1], after[0] ?? 'La cola queda vacía', 'No cambia'],
      'En una cola sale el primero que entró (FIFO).',
    );
  }

  if (operation === 'peek') {
    const correct = before.length > 0 ? before[0] : 'La cola está vacía';
    return makeSpec(
      '¿Qué valor está al frente?',
      correct,
      [before[before.length - 1], 'No cambia', 'La cola está vacía'],
      'peek consulta el frente sin extraerlo.',
    );
  }

  return null;
}

function listPrediction(
  operation: string,
  before: ListState,
  after: ListState,
  label: string,
): PredictionSpec | null {
  const numbers = numbersFrom(label);

  if (operation === 'insertHead') {
    const correct = after[0]?.value;
    return makeSpec(
      '¿Qué valor quedará en la cabeza?',
      correct ?? 'La lista queda vacía',
      [before[0]?.value, after[after.length - 1]?.value, 'No cambia'],
      `El nuevo nodo se convierte en la cabeza: ${correct}.`,
    );
  }

  if (operation === 'insertTail') {
    const correct = after[after.length - 1]?.value;
    return makeSpec(
      '¿Qué valor quedará al final?',
      correct ?? 'La lista queda vacía',
      [before[before.length - 1]?.value, after[0]?.value, 'No cambia'],
      `El nuevo nodo queda al final: ${correct}.`,
    );
  }

  if (operation === 'insertAt') {
    const index = numbers[0];
    const value = numbers[1];
    if (index === undefined || value === undefined || after[index]?.value !== value) {
      return null;
    }
    return makeSpec(
      `¿Qué valor quedará en la posición ${index}?`,
      value,
      [before[0]?.value, after[after.length - 1]?.value, 'No cambia'],
      `El nodo ${value} se enlaza en la posición ${index}.`,
    );
  }

  if (operation === 'removeAt') {
    const removed = before.find((node) => !after.some((item) => item.id === node.id));
    if (!removed) {
      return null;
    }
    return makeSpec(
      '¿Qué valor se eliminará?',
      removed.value,
      [before[0]?.value, after[0]?.value, 'No cambia'],
      `Se desconecta el nodo con valor ${removed.value}.`,
    );
  }

  if (operation === 'search') {
    const value = numbers[0];
    if (value === undefined) {
      return null;
    }
    const found = before.some((node) => node.value === value);
    return makeSpec(
      `¿El valor ${value} está en la lista?`,
      found ? 'Sí' : 'No',
      [found ? 'No' : 'Sí', 'Solo si es la cabeza', 'No se puede saber'],
      found
        ? `El valor ${value} aparece en la lista.`
        : `El valor ${value} no aparece en la lista.`,
    );
  }

  return null;
}

function treePrediction(
  operation: string,
  state: TreeState,
  label: string,
  frames: Frame<unknown>[],
  avl: boolean,
): PredictionSpec | null {
  const value = numbersFrom(label)[0];
  const exists = value !== undefined && treeHasValue(state, value);

  if (operation === 'search') {
    if (value === undefined) {
      return null;
    }
    return makeSpec(
      `¿El valor ${value} está en el árbol?`,
      exists ? 'Sí' : 'No',
      [exists ? 'No' : 'Sí', 'Solo en la raíz', 'No se puede saber'],
      exists
        ? `El valor ${value} se encuentra en el árbol.`
        : `El valor ${value} no está en el árbol.`,
    );
  }

  if (operation === 'insert') {
    if (value === undefined) {
      return null;
    }
    if (exists) {
      return makeSpec(
        `¿Qué ocurrirá al insertar ${value}?`,
        'El valor ya existe',
        ['Se inserta como hoja', 'Se convierte en la raíz', 'Se elimina un nodo'],
        'Los árboles de búsqueda de esta implementación no permiten duplicados.',
      );
    }
    if (avl) {
      const rotation = rotationFromFrames(frames);
      const correct = rotation
        ? rotation === 'doble'
          ? 'Rotación doble'
          : 'Rotación simple'
        : 'No habrá rotación';
      return makeSpec(
        `¿Qué ocurrirá al insertar ${value}?`,
        correct,
        ['No habrá rotación', 'Rotación simple', 'Rotación doble'],
        rotation
          ? `El árbol se desbalancea y aplica una ${correct.toLowerCase()}.`
          : 'El árbol queda balanceado sin rotaciones.',
      );
    }
    return makeSpec(
      `¿Qué ocurrirá al insertar ${value}?`,
      'Se inserta un nodo nuevo',
      ['El valor ya existe', 'Se convierte en la raíz', 'Se elimina un nodo'],
      'El valor no estaba en el árbol.',
    );
  }

  if (operation === 'remove') {
    if (value === undefined) {
      return null;
    }
    if (!exists) {
      return makeSpec(
        `¿Qué ocurrirá al eliminar ${value}?`,
        'El valor no está',
        ['Se elimina una hoja', 'Se elimina la raíz', 'Se aplica una rotación'],
        'La búsqueda no encuentra el valor.',
      );
    }
    if (avl) {
      const rotation = rotationFromFrames(frames);
      const correct = rotation
        ? rotation === 'doble'
          ? 'Rotación doble'
          : 'Rotación simple'
        : 'No habrá rotación';
      return makeSpec(
        `¿Qué ocurrirá al eliminar ${value}?`,
        correct,
        ['No habrá rotación', 'Rotación simple', 'Rotación doble'],
        rotation
          ? `La eliminación provoca una ${correct.toLowerCase()}.`
          : 'La eliminación no requiere rotaciones.',
      );
    }
    return makeSpec(
      `¿Qué ocurrirá al eliminar ${value}?`,
      'Se elimina un nodo',
      ['El valor no está', 'Se inserta un nodo', 'Se convierte en la raíz'],
      'El valor está en el árbol y se aplica el caso de eliminación.',
    );
  }

  if (operation === 'inorder' || operation === 'preorder' || operation === 'postorder') {
    const first = firstVisited(state, operation);
    if (first === null) {
      return null;
    }
    const firstIn = firstInOrder(state);
    const lastIn = lastInOrder(state);
    const root = state.root ? state.nodes[state.root].value : null;
    return makeSpec(
      '¿Qué nodo se visitará primero?',
      first,
      [root, firstIn, lastIn],
      `El primer nodo del recorrido es ${first}.`,
    );
  }

  return null;
}

function heapPrediction(
  operation: string,
  before: number[],
  after: number[],
): PredictionSpec | null {
  if (operation === 'insert') {
    const correct = after[0];
    return makeSpec(
      '¿Qué valor quedará en la raíz?',
      correct ?? 'El heap está vacío',
      [before[0], after[after.length - 1], 'No cambia'],
      `El burbujeo hacia arriba deja ${correct} en la raíz.`,
    );
  }

  if (operation === 'extractMin') {
    if (before.length === 0) {
      return makeSpec(
        '¿Qué ocurrirá al extraer el mínimo?',
        'El heap está vacío',
        ['Se extrae 0', 'No cambia', 'Se extrae la raíz'],
        'No hay valores en el heap.',
      );
    }
    return makeSpec(
      '¿Qué valor saldrá del heap?',
      before[0],
      [after[0], before[before.length - 1], 'El heap queda vacío'],
      'En un min-heap el menor siempre está en la raíz.',
    );
  }

  if (operation === 'peek') {
    return makeSpec(
      '¿Qué valor está en la raíz?',
      before[0] ?? 'El heap está vacío',
      [before[before.length - 1], 'No cambia', 'El heap está vacío'],
      'peek consulta la raíz sin extraerla.',
    );
  }

  return null;
}

function hashPrediction(operation: string, label: string): PredictionSpec | null {
  if (operation !== 'set' && operation !== 'get' && operation !== 'remove') {
    return null;
  }
  const key = numbersFrom(label)[0];
  if (key === undefined) {
    return null;
  }
  const correct = hashIndex(key);
  return makeSpec(
    `¿En qué bucket se buscará la clave ${key}?`,
    correct,
    [(correct + 1) % HASH_SIZE, (correct + 3) % HASH_SIZE, (correct + 5) % HASH_SIZE],
    `hash(${key}) = ${key} % ${HASH_SIZE} = ${correct}.`,
  );
}

function graphPrediction(
  operation: string,
  frames: Frame<unknown>[],
  graph: GraphState | undefined,
  startNode: string | undefined,
): PredictionSpec | null {
  if (!graph) {
    return null;
  }

  if (operation === 'bfs' || operation === 'dfs') {
    const final = frames.at(-1)?.message ?? '';
    const order = final.split(': ').at(-1) ?? '';
    const visited = order
      .split(' → ')
      .map((item) => item.trim())
      .filter(Boolean);
    const last = visited.at(-1);
    if (!last) {
      return null;
    }
    return makeSpec(
      '¿Cuál será el último nodo visitado?',
      last,
      [startNode, graph.nodes[0]?.id, graph.nodes[graph.nodes.length - 1]?.id, visited[1]],
      `El recorrido termina en ${last}: ${order}.`,
    );
  }

  if (operation === 'dijkstra') {
    const start = startNode ?? graph.nodes[0]?.id;
    const target = graph.nodes.filter((node) => node.id !== start).at(-1)?.id;
    if (!start || !target) {
      return null;
    }

    const final = frames.at(-1)?.message ?? '';
    const summary = final.split(': ').at(-1) ?? '';
    const part = summary.split(' · ').find((item) => item.startsWith(`${target}=`));
    if (!part) {
      return null;
    }

    const correct = part.split('=')[1];
    if (correct === undefined) {
      return null;
    }
    const numeric = Number(correct);
    return makeSpec(
      `¿Cuál será la distancia desde ${start} hasta ${target}?`,
      correct,
      Number.isFinite(numeric) ? [String(numeric + 1), String(numeric + 2), '∞'] : ['0', '1', '2'],
      `Distancias finales: ${summary}.`,
    );
  }

  return null;
}

function rotationFromFrames(frames: Frame<unknown>[]): 'simple' | 'doble' | null {
  for (const frame of frames) {
    if (frame.message.includes('Rotación doble')) {
      return 'doble';
    }
  }
  for (const frame of frames) {
    if (frame.message.includes('Rotación simple')) {
      return 'simple';
    }
  }
  return null;
}

function treeHasValue(state: TreeState, value: number): boolean {
  const walk = (id: string | null): boolean => {
    if (id === null) {
      return false;
    }
    const node = state.nodes[id];
    if (value === node.value) {
      return true;
    }
    return value < node.value ? walk(node.left) : walk(node.right);
  };
  return walk(state.root);
}

function firstInOrder(state: TreeState): number | null {
  const root = state.root;
  if (root === null) {
    return null;
  }
  let current: string = root;
  while (true) {
    const next: string | null = state.nodes[current].left;
    if (next === null) {
      break;
    }
    current = next;
  }
  return state.nodes[current].value;
}

function lastInOrder(state: TreeState): number | null {
  const root = state.root;
  if (root === null) {
    return null;
  }
  let current: string = root;
  while (true) {
    const next: string | null = state.nodes[current].right;
    if (next === null) {
      break;
    }
    current = next;
  }
  return state.nodes[current].value;
}

function firstVisited(
  state: TreeState,
  operation: 'inorder' | 'preorder' | 'postorder',
): number | null {
  if (state.root === null) {
    return null;
  }
  if (operation === 'preorder') {
    return state.nodes[state.root].value;
  }
  if (operation === 'inorder') {
    return firstInOrder(state);
  }

  const walk = (id: string): number => {
    const node = state.nodes[id];
    if (node.left !== null) {
      return walk(node.left);
    }
    if (node.right !== null) {
      return walk(node.right);
    }
    return node.value;
  };
  return walk(state.root);
}
