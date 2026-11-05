import {
  SET_LAWS,
  buildContext,
  cartesianSize,
  formatSet,
  inclusionExclusion,
  parseSetExpression,
  parseSetInput,
  powerSetSize,
  regionInfos,
  regionKey,
  regionResults,
  resultElements,
  verifyLaw,
} from './sets';

const context = buildContext('1,2,3,4,5,6,7,8,9,10', '1,2,3,4', '3,4,5,6', '4,6,7,8', true);

function values(expression: string): string[] {
  const parsed = parseSetExpression(expression);
  expect(parsed.error).toBeNull();
  return resultElements(parsed.ast!, context);
}

describe('definiciones de conjuntos', () => {
  it('parsea listas, llaves, vacío y duplicados', () => {
    expect([...parseSetInput('{1, 2, 2, 3}').elements]).toEqual(['1', '2', '3']);
    expect([...parseSetInput('rojo, azul').elements]).toEqual(['rojo', 'azul']);
    expect(parseSetInput('∅').elements.size).toBe(0);
    expect(parseSetInput('{1,2').error).toContain('cierre');
  });

  it('construye un universo efectivo con todos los conjuntos', () => {
    const contextWithoutU = buildContext('', '1,2', '2,3', '3,4', true);

    expect(contextWithoutU.U.size).toBe(4);
    expect(formatSet(contextWithoutU.U)).toBe('{1, 2, 3, 4}');
  });
});

describe('parser de expresiones', () => {
  it('evalúa unión, intersección, diferencia y diferencia simétrica', () => {
    expect(values('(A ∩ B) ∪ C')).toEqual(['3', '4', '6', '7', '8']);
    expect(values('A \\ B')).toEqual(['1', '2']);
    expect(values('A △ B')).toEqual(['1', '2', '5', '6']);
    expect(values('A | B ∩ C')).toEqual(['1', '2', '3', '4', '6']);
  });

  it('admite complementos con varias notaciones', () => {
    expect(values("A'")).toEqual(['5', '6', '7', '8', '9', '10']);
    expect(values('Aᶜ')).toEqual(values("A'"));
    expect(values('A^c')).toEqual(values("A'"));
    expect(values('¬A')).toEqual(values("A'"));
  });

  it('respeta la precedencia y reporta errores', () => {
    expect(values('A \\ B ∩ C')).toEqual(values('A \\ (B ∩ C)'));
    expect(parseSetExpression('A ∪').error).toBeTruthy();
    expect(parseSetExpression('(A ∪ B').error).toContain('paréntesis');
    expect(parseSetExpression('foo').error).toBeTruthy();
  });
});

describe('regiones y leyes', () => {
  it('clasifica elementos por región', () => {
    expect(regionKey('4', context)).toBe(7);
    expect(regionKey('3', context)).toBe(3);
    expect(regionKey('9', context)).toBe(0);

    const infos = regionInfos(context);
    expect(infos).toHaveLength(8);
    expect(infos.find((region) => region.key === 7)?.elements).toEqual(['4']);
  });

  it('calcula los resultados por región', () => {
    const parsed = parseSetExpression('(A ∩ B) ∪ C');
    const results = regionResults(parsed.ast!, true);

    expect(results).toHaveLength(8);
    expect(results[7]).toBe(true);
    expect(results[0]).toBe(false);
  });

  it('verifica todas las leyes sobre el universo actual', () => {
    for (const law of SET_LAWS) {
      const verification = verifyLaw(law, context);
      expect(verification.left.error, law.name).toBeNull();
      expect(verification.right.error, law.name).toBeNull();
      expect(verification.equal, law.name).toBe(true);
    }
  });

  it('comprueba De Morgan explícitamente', () => {
    const law = SET_LAWS.find((item) => item.id === 'de-morgan-1')!;
    const verification = verifyLaw(law, context);

    expect(verification.leftResult).toEqual(['7', '8', '9', '10']);
    expect(verification.rightResult).toEqual(verification.leftResult);
    expect(verification.equal).toBe(true);
  });
});

describe('cardinalidades', () => {
  it('calcula inclusión-exclusión', () => {
    const counts = inclusionExclusion(context);

    expect(counts.total).toBe(8);
    expect(powerSetSize(context.A.size)).toBe(16);
    expect(cartesianSize(context.A, context.B)).toBe(16);
  });
});
