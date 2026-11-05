import { ALL_TOOLS, MATH_TOOLS, PROGRAMMING_TOOLS, sectionForPath, toolsForSection } from './tools';

describe('registro de herramientas', () => {
  it('no repite rutas ni títulos', () => {
    const routes = ALL_TOOLS.map((tool) => tool.route);
    const titles = ALL_TOOLS.map((tool) => tool.title);

    expect(new Set(routes).size).toBe(routes.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('agrupa las herramientas por sección', () => {
    expect(toolsForSection('math')).toBe(MATH_TOOLS);
    expect(toolsForSection('programming')).toBe(PROGRAMMING_TOOLS);
    expect(MATH_TOOLS.every((tool) => tool.section === 'math')).toBe(true);
    expect(PROGRAMMING_TOOLS.every((tool) => tool.section === 'programming')).toBe(true);
  });

  it('resuelve la sección activa a partir de la URL', () => {
    expect(sectionForPath('/')).toBe('math');
    expect(sectionForPath('/calculo')).toBe('math');
    expect(sectionForPath('/calculo?mode=riemann')).toBe('math');
    expect(sectionForPath('/estructuras/')).toBe('programming');
    expect(sectionForPath('/matematicas')).toBe('math');
    expect(sectionForPath('/programacion')).toBe('programming');
    expect(sectionForPath('/desconocida')).toBeNull();
  });

  it('todas las herramientas declaran un cargador diferido', () => {
    expect(ALL_TOOLS.every((tool) => typeof tool.loadComponent === 'function')).toBe(true);
  });
});
