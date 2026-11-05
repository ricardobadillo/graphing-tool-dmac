import { nextNodeId, randomInt, randomNumbers, type Frame, type Operation } from './models';

export interface ListNode {
  id: string;
  value: number;
}

export type ListState = ListNode[];

function clone(state: ListState): ListState {
  return state.map((node) => ({ ...node }));
}

export function createList(values: number[]): ListState {
  return values.map((value) => ({ id: nextNodeId('n'), value }));
}

export function insertHead(state: ListState, value: number): Operation<ListState> {
  const node: ListNode = { id: nextNodeId('n'), value };

  return {
    result: [node, ...state],
    frames: [
      {
        state: clone(state),
        highlights: [],
        operation: 'insertHead',
        line: 1,
        message: `insertHead(${value}): creamos el nodo`,
      },
      {
        state: [node, ...state],
        highlights: [{ id: node.id, tone: 'insert' }],
        operation: 'insertHead',
        line: 3,
        message: `insertHead(${value}): el nuevo nodo es la cabeza`,
      },
    ],
  };
}

export function insertTail(state: ListState, value: number): Operation<ListState> {
  const node: ListNode = { id: nextNodeId('n'), value };
  const frames: Frame<ListState>[] = [];

  if (state.length === 0) {
    frames.push({
      state: [],
      highlights: [],
      operation: 'insertTail',
      line: 1,
      message: `insertTail(${value}): creamos el nodo`,
    });
    frames.push({
      state: [node],
      highlights: [{ id: node.id, tone: 'insert' }],
      operation: 'insertTail',
      line: 2,
      message: `insertTail(${value}): la lista estaba vacía; es la cabeza`,
    });
    return { result: [node], frames };
  }

  for (let i = 0; i < state.length; i += 1) {
    frames.push({
      state: clone(state),
      highlights: [{ id: state[i].id, tone: 'compare' }],
      operation: 'insertTail',
      line: 4,
      message: `insertTail(${value}): avanzamos al nodo ${i + 1}`,
    });
  }

  frames.push({
    state: [...state, node],
    highlights: [{ id: node.id, tone: 'insert' }],
    operation: 'insertTail',
    line: 5,
    message: `insertTail(${value}): enlazado al final`,
  });

  return { result: [...state, node], frames };
}

export function insertAt(state: ListState, index: number, value: number): Operation<ListState> {
  if (!Number.isInteger(index) || index < 0 || index > state.length) {
    return invalidIndex(state, 'insertAt', index, state.length);
  }

  const node: ListNode = { id: nextNodeId('n'), value };
  const result = [...state.slice(0, index), node, ...state.slice(index)];
  const frames: Frame<ListState>[] = [];

  if (index === 0) {
    frames.push({
      state: clone(state),
      highlights: [],
      operation: 'insertAt',
      line: 1,
      message: `insertAt(0, ${value}): insertamos en la cabeza`,
    });
    frames.push({
      state: result,
      highlights: [{ id: node.id, tone: 'insert' }],
      operation: 'insertAt',
      line: 1,
      message: `insertAt(0, ${value}): el nuevo nodo es la cabeza`,
    });
    return { result, frames };
  }

  for (let i = 0; i < index; i += 1) {
    frames.push({
      state: clone(state),
      highlights: [{ id: state[i].id, tone: 'compare' }],
      operation: 'insertAt',
      line: 4,
      message: `insertAt(${index}, ${value}): avanzamos al nodo ${i + 1}`,
    });
  }

  frames.push({
    state: result,
    highlights: [{ id: node.id, tone: 'insert' }],
    operation: 'insertAt',
    line: 7,
    message: `insertAt(${index}, ${value}): nodo enlazado en la posición ${index}`,
  });

  return { result, frames };
}

export function removeAt(state: ListState, index: number): Operation<ListState> {
  if (!Number.isInteger(index) || index < 0 || index >= state.length) {
    return invalidIndex(state, 'removeAt', index, state.length - 1);
  }

  const target = state[index];
  const result = state.filter((_, i) => i !== index);
  const frames: Frame<ListState>[] = [];

  if (index === 0) {
    frames.push({
      state: clone(state),
      highlights: [{ id: target.id, tone: 'remove' }],
      operation: 'removeAt',
      line: 1,
      message: `removeAt(0): eliminamos la cabeza (${target.value})`,
    });
    frames.push({
      state: result,
      highlights: [],
      operation: 'removeAt',
      line: 1,
      message: `removeAt(0): ${target.value} eliminado`,
    });
    return { result, frames };
  }

  for (let i = 0; i < index; i += 1) {
    frames.push({
      state: clone(state),
      highlights: [{ id: state[i].id, tone: 'compare' }],
      operation: 'removeAt',
      line: 4,
      message: `removeAt(${index}): avanzamos al nodo ${i + 1}`,
    });
  }

  frames.push({
    state: clone(state),
    highlights: [{ id: target.id, tone: 'remove' }],
    operation: 'removeAt',
    line: 5,
    message: `removeAt(${index}): desconectamos ${target.value}`,
  });
  frames.push({
    state: result,
    highlights: [],
    operation: 'removeAt',
    line: 5,
    message: `removeAt(${index}): ${target.value} eliminado`,
  });

  return { result, frames };
}

export function search(state: ListState, value: number): Operation<ListState> {
  const frames: Frame<ListState>[] = [];

  if (state.length === 0) {
    frames.push({
      state: clone(state),
      highlights: [],
      operation: 'search',
      line: 1,
      message: 'search(): la lista está vacía',
    });
    return { result: state, frames };
  }

  for (const node of state) {
    frames.push({
      state: clone(state),
      highlights: [{ id: node.id, tone: 'compare' }],
      operation: 'search',
      line: 3,
      message: `search(${value}): comparamos con ${node.value}`,
    });

    if (node.value === value) {
      frames.push({
        state: clone(state),
        highlights: [{ id: node.id, tone: 'found' }],
        operation: 'search',
        line: 3,
        message: `search(${value}): encontrado`,
      });
      return { result: state, frames };
    }
  }

  frames.push({
    state: clone(state),
    highlights: [],
    operation: 'search',
    line: 6,
    message: `search(${value}): no se encontró`,
  });

  return { result: state, frames };
}

export function clear(state: ListState): Operation<ListState> {
  return {
    result: [],
    frames: [
      {
        state: clone(state),
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): desconectamos todos los nodos',
      },
      {
        state: [],
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): la lista quedó vacía',
      },
    ],
  };
}

export const INITIAL_LIST_VALUES = [7, 13, 21];

export function randomList(): ListState {
  return createList(randomNumbers(randomInt(3, 6)));
}

function invalidIndex(
  state: ListState,
  operation: string,
  index: number,
  max: number,
): Operation<ListState> {
  const message =
    state.length === 0
      ? 'La lista está vacía: no hay índices válidos'
      : `Índice ${index} fuera de rango (0…${max})`;

  return {
    result: state,
    frames: [
      {
        state: clone(state),
        highlights: [],
        operation,
        line: 0,
        message,
      },
    ],
  };
}
