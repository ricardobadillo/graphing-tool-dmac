import {
  analyzeRelation,
  buildMatrix,
  parseElements,
  parsePairs,
  togglePair,
  type RelationPair,
} from './relations';

const ELEMENTS = ['1', '2', '3'];

function pairs(values: [string, string][]): RelationPair[] {
  return values.map(([from, to]) => ({ from, to }));
}

describe('relaciones', () => {
  it('parsea elementos y pares en varios formatos', () => {
    expect(parseElements('3, 1, 2, 1')).toEqual(['1', '2', '3']);
    expect(parsePairs('(1,2), (2,3)', ELEMENTS).pairs).toEqual(
      pairs([
        ['1', '2'],
        ['2', '3'],
      ]),
    );
    expect(parsePairs('1 -> 2; 2 -> 3', ELEMENTS).pairs).toEqual(
      pairs([
        ['1', '2'],
        ['2', '3'],
      ]),
    );
    expect(parsePairs('(1,1), (1,1)', ELEMENTS).pairs).toHaveLength(1);
  });

  it('rechaza pares con elementos ajenos al conjunto', () => {
    expect(parsePairs('(1,4)', ELEMENTS).error).toContain('4');
    expect(parsePairs('texto', ELEMENTS).error).toBeTruthy();
  });

  it('construye la matriz de la relación', () => {
    const matrix = buildMatrix(
      ELEMENTS,
      pairs([
        ['1', '2'],
        ['3', '1'],
      ]),
    );

    expect(matrix[0][1]).toBe(true);
    expect(matrix[2][0]).toBe(true);
    expect(matrix[1][1]).toBe(false);
  });

  it('reconoce una relación de equivalencia', () => {
    const analysis = analyzeRelation(
      ELEMENTS,
      pairs([
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
        ['1', '2'],
        ['2', '1'],
      ]),
    );

    expect(analysis.reflexive).toBe(true);
    expect(analysis.symmetric).toBe(true);
    expect(analysis.transitive).toBe(true);
    expect(analysis.equivalence).toBe(true);
    expect(analysis.equivalenceClasses).toEqual([['1', '2'], ['3']]);
  });

  it('agrupa clases módulo 3', () => {
    const elements = ['0', '1', '2', '3', '4', '5'];
    const values: [string, string][] = [];
    for (const left of elements) {
      for (const right of elements) {
        if (Number(left) % 3 === Number(right) % 3) {
          values.push([left, right]);
        }
      }
    }

    const analysis = analyzeRelation(elements, pairs(values));
    expect(analysis.equivalence).toBe(true);
    expect(analysis.equivalenceClasses).toEqual([
      ['0', '3'],
      ['1', '4'],
      ['2', '5'],
    ]);
  });

  it('reconoce un orden parcial y descarta simetría', () => {
    const analysis = analyzeRelation(
      ELEMENTS,
      pairs([
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
        ['1', '2'],
        ['2', '3'],
        ['1', '3'],
      ]),
    );

    expect(analysis.partialOrder).toBe(true);
    expect(analysis.symmetric).toBe(false);
    expect(analysis.equivalence).toBe(false);
  });

  it('detecta falta de transitividad', () => {
    const analysis = analyzeRelation(
      ELEMENTS,
      pairs([
        ['1', '2'],
        ['2', '3'],
      ]),
    );

    expect(analysis.transitive).toBe(false);
    expect(analysis.reflexive).toBe(false);
    expect(analysis.irreflexive).toBe(true);
  });

  it('analiza funciones inyectivas, sobreyectivas y biyectivas', () => {
    const bijection = analyzeRelation(
      ELEMENTS,
      pairs([
        ['1', '2'],
        ['2', '3'],
        ['3', '1'],
      ]),
    );
    const notInjective = analyzeRelation(
      ELEMENTS,
      pairs([
        ['1', '1'],
        ['2', '1'],
        ['3', '2'],
      ]),
    );

    expect(bijection.functionLike).toBe(true);
    expect(bijection.injective).toBe(true);
    expect(bijection.surjective).toBe(true);
    expect(bijection.bijective).toBe(true);

    expect(notInjective.functionLike).toBe(true);
    expect(notInjective.injective).toBe(false);
    expect(notInjective.surjective).toBe(false);
  });

  it('alterna pares existentes', () => {
    const initial = pairs([['1', '2']]);

    expect(togglePair(initial, '2', '3')).toEqual(
      pairs([
        ['1', '2'],
        ['2', '3'],
      ]),
    );
    expect(togglePair(initial, '1', '2')).toEqual([]);
  });
});
