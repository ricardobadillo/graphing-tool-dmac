import { nextNodeId, randomInt, type Frame, type Operation } from './models';

export interface HashEntry {
  id: string;
  key: number;
  value: number;
}

export type HashState = HashEntry[][];

export const HASH_SIZE = 7;

export function hashIndex(key: number): number {
  return ((key % HASH_SIZE) + HASH_SIZE) % HASH_SIZE;
}

function emptyState(): HashState {
  return Array.from({ length: HASH_SIZE }, () => []);
}

function clone(state: HashState): HashState {
  return state.map((bucket) => bucket.map((entry) => ({ ...entry })));
}

function createEntry(key: number, value: number): HashEntry {
  return { id: nextNodeId('h'), key, value };
}

export function createTable(entries: { key: number; value: number }[]): HashState {
  const state = emptyState();
  for (const entry of entries) {
    state[hashIndex(entry.key)].push(createEntry(entry.key, entry.value));
  }
  return state;
}

export function set(state: HashState, key: number, value: number): Operation<HashState> {
  const index = hashIndex(key);
  const result = clone(state);
  const bucket = result[index];
  const frames: Frame<HashState>[] = [
    {
      state: clone(state),
      highlights: [{ id: `bucket-${index}`, tone: 'active' }],
      operation: 'set',
      line: 1,
      message: `set(${key}, ${value}): hash(${key}) = ${key} % ${HASH_SIZE} = ${index}`,
    },
  ];

  for (const entry of bucket) {
    frames.push({
      state: clone(result),
      highlights: [
        { id: `bucket-${index}`, tone: 'active' },
        { id: entry.id, tone: 'compare' },
      ],
      operation: 'set',
      line: 4,
      message: `set(${key}, ${value}): comparamos con la clave ${entry.key}`,
    });

    if (entry.key === key) {
      const previous = entry.value;
      entry.value = value;
      frames.push({
        state: clone(result),
        highlights: [{ id: entry.id, tone: 'insert' }],
        operation: 'set',
        line: 5,
        message: `set(${key}, ${value}): la clave existía; ${previous} → ${value}`,
      });
      return { result: clone(result), frames };
    }
  }

  const entry = createEntry(key, value);
  bucket.push(entry);
  frames.push({
    state: clone(result),
    highlights: [{ id: entry.id, tone: 'insert' }],
    operation: 'set',
    line: 10,
    message: `set(${key}, ${value}): insertado en el bucket ${index}`,
  });

  return { result: clone(result), frames };
}

export function get(state: HashState, key: number): Operation<HashState> {
  const index = hashIndex(key);
  const frames: Frame<HashState>[] = [
    {
      state,
      highlights: [{ id: `bucket-${index}`, tone: 'active' }],
      operation: 'get',
      line: 1,
      message: `get(${key}): hash(${key}) = ${key} % ${HASH_SIZE} = ${index}`,
    },
  ];

  for (const entry of state[index]) {
    frames.push({
      state,
      highlights: [
        { id: `bucket-${index}`, tone: 'active' },
        { id: entry.id, tone: 'compare' },
      ],
      operation: 'get',
      line: 4,
      message: `get(${key}): comparamos con la clave ${entry.key}`,
    });

    if (entry.key === key) {
      frames.push({
        state,
        highlights: [{ id: entry.id, tone: 'found' }],
        operation: 'get',
        line: 4,
        message: `get(${key}): encontrado; valor ${entry.value}`,
      });
      return { result: state, frames };
    }
  }

  frames.push({
    state,
    highlights: [{ id: `bucket-${index}`, tone: 'remove' }],
    operation: 'get',
    line: 7,
    message: `get(${key}): la clave no está en el bucket ${index}`,
  });

  return { result: state, frames };
}

export function remove(state: HashState, key: number): Operation<HashState> {
  const index = hashIndex(key);
  const result = clone(state);
  const bucket = result[index];
  const frames: Frame<HashState>[] = [
    {
      state: clone(state),
      highlights: [{ id: `bucket-${index}`, tone: 'active' }],
      operation: 'remove',
      line: 1,
      message: `remove(${key}): hash(${key}) = ${key} % ${HASH_SIZE} = ${index}`,
    },
  ];

  for (let i = 0; i < bucket.length; i += 1) {
    frames.push({
      state: clone(result),
      highlights: [
        { id: `bucket-${index}`, tone: 'active' },
        { id: bucket[i].id, tone: 'compare' },
      ],
      operation: 'remove',
      line: 4,
      message: `remove(${key}): comparamos con la clave ${bucket[i].key}`,
    });

    if (bucket[i].key === key) {
      const [removed] = bucket.splice(i, 1);
      frames.push({
        state: clone(result),
        highlights: [{ id: `bucket-${index}`, tone: 'found' }],
        operation: 'remove',
        line: 5,
        message: `remove(${key}): clave ${removed.key} eliminada`,
      });
      return { result: clone(result), frames };
    }
  }

  frames.push({
    state: clone(result),
    highlights: [{ id: `bucket-${index}`, tone: 'remove' }],
    operation: 'remove',
    line: 9,
    message: `remove(${key}): la clave no existe`,
  });

  return { result: clone(result), frames };
}

export function clear(state: HashState): Operation<HashState> {
  return {
    result: emptyState(),
    frames: [
      {
        state: clone(state),
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): vaciamos los buckets',
      },
      {
        state: emptyState(),
        highlights: [],
        operation: 'clear',
        line: 1,
        message: 'clear(): la tabla quedó vacía',
      },
    ],
  };
}

export const INITIAL_HASH_ENTRIES = [
  { key: 5, value: 50 },
  { key: 12, value: 120 },
  { key: 19, value: 190 },
  { key: 3, value: 30 },
  { key: 8, value: 80 },
  { key: 10, value: 100 },
];

export function randomTable(): HashState {
  const keys = new Set<number>();
  while (keys.size < randomInt(6, 9)) {
    keys.add(randomInt(0, 99));
  }
  return createTable([...keys].map((key) => ({ key, value: randomInt(1, 99) })));
}
