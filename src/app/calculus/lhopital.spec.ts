import { analyzeLHopital, lhopitalFormLabel } from './lhopital';

describe('regla de L’Hôpital', () => {
  it('resuelve sin(x)/x en 0', () => {
    const result = analyzeLHopital('sin(x)', 'x', 0);

    expect(result.error).toBeNull();
    expect(result.form).toBe('0/0');
    expect(result.limit).toBeCloseTo(1, 6);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps[0].limit).toBeCloseTo(1, 6);
  });

  it('resuelve (1 - cos(x)) / x^2 en 0 con dos derivadas', () => {
    const result = analyzeLHopital('1 - cos(x)', 'x^2', 0);

    expect(result.form).toBe('0/0');
    expect(result.limit).toBeCloseTo(0.5, 5);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('resuelve (e^x - 1) / x en 0', () => {
    const result = analyzeLHopital('e^x - 1', 'x', 0);

    expect(result.form).toBe('0/0');
    expect(result.limit).toBeCloseTo(1, 6);
  });

  it('detecta una sustitución directa', () => {
    const result = analyzeLHopital('x^2', 'x + 1', 2);

    expect(result.form).toBe('direct');
    expect(result.limit).toBeCloseTo(4 / 3, 6);
    expect(result.steps).toHaveLength(0);
  });

  it('reporta expresiones inválidas', () => {
    expect(analyzeLHopital('sin(', 'x', 0).error).toBeTruthy();
    expect(analyzeLHopital('x', 'x', Number.NaN).error).toBeTruthy();
  });

  it('etiqueta las formas', () => {
    expect(lhopitalFormLabel('0/0')).toContain('0/0');
    expect(lhopitalFormLabel('∞/∞')).toContain('∞/∞');
  });
});
