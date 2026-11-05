export type SetName = 'A' | 'B' | 'C' | 'U';

export type SetNode =
  | { kind: 'set'; name: SetName }
  | { kind: 'empty' }
  | { kind: 'union'; left: SetNode; right: SetNode }
  | { kind: 'intersection'; left: SetNode; right: SetNode }
  | { kind: 'difference'; left: SetNode; right: SetNode }
  | { kind: 'symdiff'; left: SetNode; right: SetNode }
  | { kind: 'complement'; operand: SetNode };

export interface ParsedExpression {
  ast: SetNode | null;
  error: string | null;
}

export interface ParsedSet {
  elements: Set<string>;
  error: string | null;
}

export interface SetContext {
  A: Set<string>;
  B: Set<string>;
  C: Set<string>;
  U: Set<string>;
  useC: boolean;
}

export interface RegionInfo {
  key: number;
  label: string;
  elements: string[];
}

export interface SetLaw {
  id: string;
  name: string;
  left: string;
  right: string;
  note: string;
  usesC: boolean;
}

export interface LawVerification {
  left: ParsedExpression;
  right: ParsedExpression;
  leftResult: string[];
  rightResult: string[];
  leftRegions: boolean[];
  rightRegions: boolean[];
  equal: boolean;
}

export const SET_LAWS: SetLaw[] = [
  {
    id: 'de-morgan-1',
    name: 'De Morgan (unión)',
    left: '(A ∪ B)ᶜ',
    right: 'Aᶜ ∩ Bᶜ',
    note: 'El complemento de una unión es la intersección de los complementos.',
    usesC: false,
  },
  {
    id: 'de-morgan-2',
    name: 'De Morgan (intersección)',
    left: '(A ∩ B)ᶜ',
    right: 'Aᶜ ∪ Bᶜ',
    note: 'El complemento de una intersección es la unión de los complementos.',
    usesC: false,
  },
  {
    id: 'distributive-1',
    name: 'Distributiva (∩ sobre ∪)',
    left: 'A ∩ (B ∪ C)',
    right: '(A ∩ B) ∪ (A ∩ C)',
    note: 'La intersección se distribuye sobre la unión.',
    usesC: true,
  },
  {
    id: 'distributive-2',
    name: 'Distributiva (∪ sobre ∩)',
    left: 'A ∪ (B ∩ C)',
    right: '(A ∪ B) ∩ (A ∪ C)',
    note: 'La unión se distribuye sobre la intersección.',
    usesC: true,
  },
  {
    id: 'associative',
    name: 'Asociativa',
    left: '(A ∪ B) ∪ C',
    right: 'A ∪ (B ∪ C)',
    note: 'La agrupación no cambia el resultado de la unión.',
    usesC: true,
  },
  {
    id: 'difference',
    name: 'Diferencia como intersección',
    left: 'A \\ B',
    right: 'A ∩ Bᶜ',
    note: 'Quitar B es lo mismo que quedarse con A y el complemento de B.',
    usesC: false,
  },
  {
    id: 'absorption',
    name: 'Absorción',
    left: 'A ∪ (A ∩ B)',
    right: 'A',
    note: 'A absorbe a su intersección con B.',
    usesC: false,
  },
  {
    id: 'complement',
    name: 'Ley del complemento',
    left: 'A ∪ Aᶜ',
    right: 'U',
    note: 'Un conjunto y su complemento cubren todo el universo.',
    usesC: false,
  },
  {
    id: 'identity',
    name: 'Identidad',
    left: 'A ∪ ∅',
    right: 'A',
    note: 'La unión con el vacío no cambia el conjunto.',
    usesC: false,
  },
];

export function parseSetInput(text: string): ParsedSet {
  let value = text.trim();

  if (!value || value === '∅' || value === '{}') {
    return { elements: new Set(), error: null };
  }

  if (value.startsWith('{') && !value.endsWith('}')) {
    return { elements: new Set(), error: 'Falta la llave de cierre.' };
  }
  if (!value.startsWith('{') && value.endsWith('}')) {
    return { elements: new Set(), error: 'Falta la llave de apertura.' };
  }

  if (value.startsWith('{') && value.endsWith('}')) {
    value = value.slice(1, -1).trim();
  }

  const parts = /[,;]/.test(value) ? value.split(/[,;]/) : value.split(/\s+/);
  const elements = new Set<string>();
  for (const part of parts) {
    const element = part.trim();
    if (element) {
      elements.add(element);
    }
  }

  return { elements, error: null };
}

export function buildContext(
  uText: string,
  aText: string,
  bText: string,
  cText: string,
  useC: boolean,
): SetContext {
  const A = parseSetInput(aText).elements;
  const B = parseSetInput(bText).elements;
  const C = useC ? parseSetInput(cText).elements : new Set<string>();
  const baseU = parseSetInput(uText).elements;
  const U = new Set<string>([...baseU, ...A, ...B, ...C]);

  return { A, B, C, U, useC };
}

export function sortElements(elements: Iterable<string>): string[] {
  return [...elements].sort(naturalCompare);
}

export function naturalCompare(a: string, b: string): number {
  const numberA = Number(a);
  const numberB = Number(b);
  if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
    return numberA - numberB;
  }
  return a.localeCompare(b, 'es');
}

export function formatSet(elements: Iterable<string>, empty = '∅'): string {
  const list = sortElements(elements);
  return list.length === 0 ? empty : `{${list.join(', ')}}`;
}

export function regionKey(element: string, context: SetContext): number {
  let key = 0;
  if (context.A.has(element)) {
    key |= 1;
  }
  if (context.B.has(element)) {
    key |= 2;
  }
  if (context.useC && context.C.has(element)) {
    key |= 4;
  }
  return key;
}

export function regionLabel(key: number, useC: boolean): string {
  const parts: string[] = [];
  if (key & 1) {
    parts.push('A');
  }
  if (key & 2) {
    parts.push('B');
  }
  if (useC && key & 4) {
    parts.push('C');
  }

  if (parts.length === 0) {
    return useC ? 'Fuera de A, B y C' : 'Fuera de A y B';
  }

  const inside = parts.join(' ∩ ');
  const missing: string[] = [];
  if (!(key & 1)) {
    missing.push('A');
  }
  if (!(key & 2)) {
    missing.push('B');
  }
  if (useC && !(key & 4)) {
    missing.push('C');
  }

  return missing.length === 0 ? inside : `${inside} (fuera de ${missing.join(', ')})`;
}

export function regionInfos(context: SetContext): RegionInfo[] {
  const keys = context.useC ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3];
  const byKey = new Map<number, string[]>();

  for (const key of keys) {
    byKey.set(key, []);
  }

  for (const element of context.U) {
    const key = regionKey(element, context);
    byKey.get(key)?.push(element);
  }

  return keys.map((key) => ({
    key,
    label: regionLabel(key, context.useC),
    elements: sortElements(byKey.get(key) ?? []),
  }));
}

export function parseSetExpression(text: string): ParsedExpression {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ast: null, error: 'Escribe una expresión de conjuntos.' };
  }

  try {
    const parser = new SetParser(trimmed);
    return { ast: parser.parse(), error: null };
  } catch (error) {
    return {
      ast: null,
      error: error instanceof Error ? error.message : 'Expresión no válida.',
    };
  }
}

class SetParser {
  private index = 0;

  constructor(private readonly text: string) {}

  parse(): SetNode {
    const node = this.parseUnion();
    this.skip();
    if (this.index < this.text.length) {
      throw new Error(`Sobra "${this.text.slice(this.index)}".`);
    }
    return node;
  }

  private parseUnion(): SetNode {
    let left = this.parseDifference();
    while (true) {
      if (
        this.matchChar('∪') ||
        this.matchChar('|') ||
        this.matchWord('union') ||
        this.matchWord('or')
      ) {
        left = { kind: 'union', left, right: this.parseDifference() };
      } else if (this.matchChar('△') || this.matchChar('⊕') || this.matchWord('xor')) {
        left = { kind: 'symdiff', left, right: this.parseDifference() };
      } else {
        break;
      }
    }
    return left;
  }

  private parseDifference(): SetNode {
    let left = this.parseIntersection();
    while (true) {
      if (this.matchChar('\\') || this.matchChar('-') || this.matchWord('minus')) {
        left = { kind: 'difference', left, right: this.parseIntersection() };
      } else {
        break;
      }
    }
    return left;
  }

  private parseIntersection(): SetNode {
    let left = this.parseUnary();
    while (true) {
      if (
        this.matchChar('∩') ||
        this.matchChar('&') ||
        this.matchWord('intersection') ||
        this.matchWord('and')
      ) {
        left = { kind: 'intersection', left, right: this.parseUnary() };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): SetNode {
    if (this.matchChar('¬') || this.matchChar('~') || this.matchWord('not')) {
      return { kind: 'complement', operand: this.parseUnary() };
    }

    let node = this.parsePrimary();

    while (true) {
      if (this.matchChar("'") || this.matchChar('ᶜ')) {
        node = { kind: 'complement', operand: node };
      } else if (this.matchExact('^c') || this.matchExact('^C')) {
        node = { kind: 'complement', operand: node };
      } else {
        break;
      }
    }

    return node;
  }

  private parsePrimary(): SetNode {
    this.skip();

    if (this.matchChar('(')) {
      const node = this.parseUnion();
      if (!this.matchChar(')')) {
        throw new Error("Falta el paréntesis ')'.");
      }
      return node;
    }

    if (this.matchChar('∅') || this.matchExact('{}') || this.matchWord('empty')) {
      return { kind: 'empty' };
    }

    const current = this.text[this.index];
    const upper = current?.toUpperCase();
    if (upper && 'ABCU'.includes(upper) && !/[A-Za-z0-9_]/.test(this.text[this.index + 1] ?? '')) {
      this.index += 1;
      return { kind: 'set', name: upper as SetName };
    }

    throw new Error(`Se esperaba un conjunto, '(' o '∅' en la posición ${this.index + 1}.`);
  }

  private skip(): void {
    while (/\s/.test(this.text[this.index] ?? '')) {
      this.index += 1;
    }
  }

  private matchChar(char: string): boolean {
    this.skip();
    if (this.text[this.index] === char) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private matchExact(token: string): boolean {
    this.skip();
    if (
      this.text.slice(this.index, this.index + token.length).toLowerCase() === token.toLowerCase()
    ) {
      this.index += token.length;
      return true;
    }
    return false;
  }

  private matchWord(word: string): boolean {
    this.skip();
    const end = this.index + word.length;
    if (
      this.text.slice(this.index, end).toLowerCase() === word &&
      !/[A-Za-z0-9_]/.test(this.text[end] ?? '')
    ) {
      this.index = end;
      return true;
    }
    return false;
  }
}

export function evaluateExpression(node: SetNode, contains: (name: SetName) => boolean): boolean {
  switch (node.kind) {
    case 'set':
      return contains(node.name);
    case 'empty':
      return false;
    case 'union':
      return evaluateExpression(node.left, contains) || evaluateExpression(node.right, contains);
    case 'intersection':
      return evaluateExpression(node.left, contains) && evaluateExpression(node.right, contains);
    case 'difference':
      return evaluateExpression(node.left, contains) && !evaluateExpression(node.right, contains);
    case 'symdiff':
      return evaluateExpression(node.left, contains) !== evaluateExpression(node.right, contains);
    case 'complement':
      return !evaluateExpression(node.operand, contains);
  }
}

export function resultElements(ast: SetNode, context: SetContext): string[] {
  return sortElements(
    [...context.U].filter((element) =>
      evaluateExpression(ast, (name) => {
        if (name === 'U') {
          return true;
        }
        if (name === 'A') {
          return context.A.has(element);
        }
        if (name === 'B') {
          return context.B.has(element);
        }
        return context.useC && context.C.has(element);
      }),
    ),
  );
}

export function regionResults(ast: SetNode, useC: boolean): boolean[] {
  const keys = useC ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3];
  return keys.map((key) =>
    evaluateExpression(ast, (name) => {
      if (name === 'U') {
        return true;
      }
      if (name === 'A') {
        return (key & 1) !== 0;
      }
      if (name === 'B') {
        return (key & 2) !== 0;
      }
      return useC && (key & 4) !== 0;
    }),
  );
}

export function verifyLaw(law: SetLaw, context: SetContext): LawVerification {
  const left = parseSetExpression(law.left);
  const right = parseSetExpression(law.right);
  const leftResult = left.ast ? resultElements(left.ast, context) : [];
  const rightResult = right.ast ? resultElements(right.ast, context) : [];
  const leftRegions = left.ast ? regionResults(left.ast, context.useC) : [];
  const rightRegions = right.ast ? regionResults(right.ast, context.useC) : [];
  const equal =
    left.ast !== null &&
    right.ast !== null &&
    leftResult.length === rightResult.length &&
    leftResult.every((element, index) => element === rightResult[index]) &&
    leftRegions.length === rightRegions.length &&
    leftRegions.every((value, index) => value === rightRegions[index]);

  return {
    left,
    right,
    leftResult,
    rightResult,
    leftRegions,
    rightRegions,
    equal,
  };
}

export function setSize(set: Set<string>): number {
  return set.size;
}

export function intersectionSize(...sets: Set<string>[]): number {
  if (sets.length === 0) {
    return 0;
  }
  let result = 0;
  for (const element of sets[0]) {
    if (sets.every((set) => set.has(element))) {
      result += 1;
    }
  }
  return result;
}

export function unionSize(context: SetContext): number {
  return context.U.size - 0;
}

export function inclusionExclusion(context: SetContext): {
  a: number;
  b: number;
  c: number;
  ab: number;
  ac: number;
  bc: number;
  abc: number;
  total: number;
} {
  const a = context.A.size;
  const b = context.B.size;
  const c = context.useC ? context.C.size : 0;
  const ab = intersectionSize(context.A, context.B);
  const ac = context.useC ? intersectionSize(context.A, context.C) : 0;
  const bc = context.useC ? intersectionSize(context.B, context.C) : 0;
  const abc = context.useC ? intersectionSize(context.A, context.B, context.C) : 0;
  const total = context.useC ? a + b + c - ab - ac - bc + abc : a + b - ab;

  return { a, b, c, ab, ac, bc, abc, total };
}

export function powerSetSize(n: number): number {
  return 2 ** Math.max(0, Math.floor(n));
}

export function cartesianSize(a: Set<string>, b: Set<string>): number {
  return a.size * b.size;
}
