import { randomInt, randomNumbers, type Operation } from './models';

export type StackState = number[];

export function push(state: StackState, value: number): Operation<StackState> {
  const result = [...state, value];

  return {
    result,
    frames: [
      {
        state: [...state],
        highlights: [],
        operation: 'push',
        line: 0,
        message: `push(${value}): preparamos el nuevo valor`,
      },
      {
        state: result,
        highlights: [{ id: String(result.length - 1), tone: 'insert' }],
        operation: 'push',
        line: 1,
        message: `push(${value}): insertado en el tope`,
      },
    ],
  };
}

export function pop(state: StackState): Operation<StackState> {
  if (state.length === 0) {
    return {
      result: state,
      frames: [
        {
          state: [...state],
          highlights: [],
          operation: 'pop',
          line: 1,
          message: 'pop(): la pila está vacía',
        },
      ],
    };
  }

  const top = state[state.length - 1];
  const result = state.slice(0, -1);

  return {
    result,
    frames: [
      {
        state: [...state],
        highlights: [{ id: String(state.length - 1), tone: 'active' }],
        operation: 'pop',
        line: 1,
        message: `pop(): el tope es ${top}`,
      },
      {
        state: result,
        highlights: [],
        operation: 'pop',
        line: 2,
        message: `pop(): extraído ${top}`,
      },
    ],
  };
}

export function peek(state: StackState): Operation<StackState> {
  if (state.length === 0) {
    return {
      result: state,
      frames: [
        {
          state: [...state],
          highlights: [],
          operation: 'peek',
          line: 1,
          message: 'peek(): la pila está vacía',
        },
      ],
    };
  }

  return {
    result: state,
    frames: [
      {
        state: [...state],
        highlights: [{ id: String(state.length - 1), tone: 'active' }],
        operation: 'peek',
        line: 2,
        message: `peek(): el tope es ${state[state.length - 1]}`,
      },
    ],
  };
}

export function clear(state: StackState): Operation<StackState> {
  return {
    result: [],
    frames: [
      {
        state: [...state],
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): vaciamos la pila',
      },
      {
        state: [],
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): la pila quedó vacía',
      },
    ],
  };
}

export const INITIAL_STACK: StackState = [8, 3, 12];

export function randomStack(): StackState {
  return randomNumbers(randomInt(3, 6));
}
