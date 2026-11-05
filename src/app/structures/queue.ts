import { randomInt, randomNumbers, type Operation } from './models';

export type QueueState = number[];

export function enqueue(state: QueueState, value: number): Operation<QueueState> {
  const result = [...state, value];

  return {
    result,
    frames: [
      {
        state: [...state],
        highlights: [],
        operation: 'enqueue',
        line: 0,
        message: `enqueue(${value}): preparamos el nuevo valor`,
      },
      {
        state: result,
        highlights: [{ id: String(result.length - 1), tone: 'insert' }],
        operation: 'enqueue',
        line: 1,
        message: `enqueue(${value}): agregado al final`,
      },
    ],
  };
}

export function dequeue(state: QueueState): Operation<QueueState> {
  if (state.length === 0) {
    return {
      result: state,
      frames: [
        {
          state: [...state],
          highlights: [],
          operation: 'dequeue',
          line: 1,
          message: 'dequeue(): la cola está vacía',
        },
      ],
    };
  }

  const front = state[0];
  const result = state.slice(1);

  return {
    result,
    frames: [
      {
        state: [...state],
        highlights: [{ id: '0', tone: 'active' }],
        operation: 'dequeue',
        line: 1,
        message: `dequeue(): el frente es ${front}`,
      },
      {
        state: result,
        highlights: [],
        operation: 'dequeue',
        line: 2,
        message: `dequeue(): extraído ${front}`,
      },
    ],
  };
}

export function peek(state: QueueState): Operation<QueueState> {
  if (state.length === 0) {
    return {
      result: state,
      frames: [
        {
          state: [...state],
          highlights: [],
          operation: 'peek',
          line: 1,
          message: 'peek(): la cola está vacía',
        },
      ],
    };
  }

  return {
    result: state,
    frames: [
      {
        state: [...state],
        highlights: [{ id: '0', tone: 'active' }],
        operation: 'peek',
        line: 2,
        message: `peek(): el frente es ${state[0]}`,
      },
    ],
  };
}

export function clear(state: QueueState): Operation<QueueState> {
  return {
    result: [],
    frames: [
      {
        state: [...state],
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): vaciamos la cola',
      },
      {
        state: [],
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): la cola quedó vacía',
      },
    ],
  };
}

export const INITIAL_QUEUE: QueueState = [4, 9, 15];

export function randomQueue(): QueueState {
  return randomNumbers(randomInt(3, 6));
}
