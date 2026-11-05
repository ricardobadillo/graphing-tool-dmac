import type { Type } from '@angular/core';

export type SectionKey = 'math' | 'programming';
export type Accent = 'sky' | 'emerald' | 'violet' | 'amber' | 'fuchsia' | 'teal';

export interface ToolDefinition {
  route: string;
  section: SectionKey;
  title: string;
  description: string;
  tag: string;
  monogram: string;
  accent: Accent;
  loadComponent: () => Promise<Type<unknown>>;
}

export interface SectionMeta {
  key: SectionKey;
  path: string;
  eyebrow: string;
  title: string;
  description: string;
}

export const SECTION_META: Record<SectionKey, SectionMeta> = {
  math: {
    key: 'math',
    path: '/matematicas',
    eyebrow: 'Matemáticas',
    title: 'Laboratorio de matemáticas',
    description:
      'Funciones, análisis, álgebra, probabilidad, optimización, geometría y números especiales. Elige una herramienta para explorar, manipular y visualizar.',
  },
  programming: {
    key: 'programming',
    path: '/programacion',
    eyebrow: 'Programación',
    title: 'Laboratorio de programación',
    description:
      'Estructuras de datos y algoritmos con visualizaciones interactivas, predicciones y análisis de complejidad.',
  },
};

export const MATH_TOOLS: ToolDefinition[] = [
  {
    route: '/',
    section: 'math',
    title: 'Graficador de funciones',
    description: 'Funciones, zoom, desplazamiento y varias curvas en el mismo plano.',
    tag: 'Funciones',
    monogram: 'ƒ',
    accent: 'sky',
    loadComponent: () =>
      import('./graphing/function-plotter').then((module) => module.FunctionPlotter),
  },
  {
    route: '/calculo',
    section: 'math',
    title: 'Cálculo: derivadas, áreas y curvas',
    description: 'Derivadas, áreas bajo la curva, coordenadas polares y paramétricas.',
    tag: 'Cálculo',
    monogram: '∫',
    accent: 'emerald',
    loadComponent: () =>
      import('./calculus/calculus-explorer').then((module) => module.CalculusExplorer),
  },
  {
    route: '/calculo-avanzado',
    section: 'math',
    title: 'Laboratorio de cálculo',
    description:
      'L’Hôpital, optimización 1D, integración, aplicaciones, EDOs y derivadas parciales.',
    tag: 'Cálculo',
    monogram: '∫',
    accent: 'emerald',
    loadComponent: () => import('./calculus/calculus-lab').then((module) => module.CalculusLab),
  },
  {
    route: '/limites',
    section: 'math',
    title: 'Límites y continuidad',
    description: 'Límites laterales, discontinuidades evitables, de salto e infinitas.',
    tag: 'Cálculo',
    monogram: 'lim',
    accent: 'emerald',
    loadComponent: () =>
      import('./calculus/limits-explorer').then((module) => module.LimitsExplorer),
  },
  {
    route: '/analisis',
    section: 'math',
    title: 'Cálculo y análisis: series',
    description: 'Series de Taylor y Fourier para aproximar funciones y ondas.',
    tag: 'Análisis',
    monogram: '∑',
    accent: 'emerald',
    loadComponent: () =>
      import('./analysis/analysis-explorer').then((module) => module.AnalysisExplorer),
  },
  {
    route: '/algebra',
    section: 'math',
    title: 'Álgebra lineal: vectores, matrices y sistemas',
    description: 'Vectores, matrices, autovalores, composición y sistemas lineales.',
    tag: 'Álgebra',
    monogram: 'A',
    accent: 'violet',
    loadComponent: () => import('./linear/linear-explorer').then((module) => module.LinearExplorer),
  },
  {
    route: '/conjuntos',
    section: 'math',
    title: 'Teoría de conjuntos',
    description: 'Diagramas de Venn, operaciones y leyes de la teoría de conjuntos.',
    tag: 'Discreta',
    monogram: '∩',
    accent: 'amber',
    loadComponent: () =>
      import('./sets/set-theory-explorer').then((module) => module.SetTheoryExplorer),
  },
  {
    route: '/relaciones',
    section: 'math',
    title: 'Relaciones y funciones',
    description: 'Propiedades de relaciones, clases de equivalencia y funciones biyectivas.',
    tag: 'Discreta',
    monogram: 'R',
    accent: 'amber',
    loadComponent: () =>
      import('./sets/relations-explorer').then((module) => module.RelationsExplorer),
  },
  {
    route: '/complejos',
    section: 'math',
    title: 'Números complejos',
    description: 'Plano de Argand, forma polar, operaciones, potencias y raíces.',
    tag: 'Complejos',
    monogram: 'ℂ',
    accent: 'fuchsia',
    loadComponent: () =>
      import('./complex/complex-explorer').then((module) => module.ComplexExplorer),
  },
  {
    route: '/gaussianos',
    section: 'math',
    title: 'Enteros gaussianos Z[i]',
    description: 'Retícula ℤ[i], norma, divisibilidad, primalidad y máximo común divisor.',
    tag: 'Números',
    monogram: 'ℤ[i]',
    accent: 'teal',
    loadComponent: () =>
      import('./gaussian/gaussian-explorer').then((module) => module.GaussianExplorer),
  },
  {
    route: '/estadistica',
    section: 'math',
    title: 'Probabilidad y estadística',
    description: 'Distribuciones, intervalos de probabilidad y teorema central del límite.',
    tag: 'Estadística',
    monogram: 'σ',
    accent: 'sky',
    loadComponent: () =>
      import('./statistics/statistics-explorer').then((module) => module.StatisticsExplorer),
  },
  {
    route: '/optimizacion',
    section: 'math',
    title: 'Optimización',
    description: 'Programación lineal, región factible y descenso de gradiente.',
    tag: 'Optimización',
    monogram: '∇',
    accent: 'amber',
    loadComponent: () =>
      import('./optimization/optimization-explorer').then((module) => module.OptimizationExplorer),
  },
  {
    route: '/geometria',
    section: 'math',
    title: 'Geometría y topología',
    description: 'Fractales, círculo trigonométrico y la banda de Möbius.',
    tag: 'Geometría',
    monogram: '△',
    accent: 'fuchsia',
    loadComponent: () =>
      import('./geometry/geometry-explorer').then((module) => module.GeometryExplorer),
  },
];

export const PROGRAMMING_TOOLS: ToolDefinition[] = [
  {
    route: '/estructuras',
    section: 'programming',
    title: 'Visualizador de estructuras de datos',
    description: 'Listas, pilas, colas, árboles, heaps, tablas hash y grafos interactivos.',
    tag: 'Estructuras',
    monogram: 'DS',
    accent: 'sky',
    loadComponent: () =>
      import('./structures/data-structures-explorer').then(
        (module) => module.DataStructuresExplorer,
      ),
  },
  {
    route: '/algoritmos',
    section: 'programming',
    title: 'Ordenamientos y complejidad',
    description: 'Ordenamientos animados y laboratorio de complejidad Big-O.',
    tag: 'Algoritmos',
    monogram: 'O(n)',
    accent: 'violet',
    loadComponent: () =>
      import('./algorithms/algorithms-explorer').then((module) => module.AlgorithmsExplorer),
  },
];

export const ALL_TOOLS = [...MATH_TOOLS, ...PROGRAMMING_TOOLS];

export function toolsForSection(section: SectionKey): ToolDefinition[] {
  return section === 'programming' ? PROGRAMMING_TOOLS : MATH_TOOLS;
}

/** Encuentra la sección activa a partir de la URL actual. */
export function sectionForPath(path: string): SectionKey | null {
  const normalized = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';

  if (normalized === SECTION_META.math.path) {
    return 'math';
  }
  if (normalized === SECTION_META.programming.path) {
    return 'programming';
  }

  const tool = ALL_TOOLS.find((candidate) =>
    candidate.route === '/'
      ? normalized === '/'
      : normalized === candidate.route || normalized.startsWith(`${candidate.route}/`),
  );

  return tool?.section ?? null;
}
