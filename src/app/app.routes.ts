import { Routes } from '@angular/router';
import { FunctionPlotter } from './graphing/function-plotter';
import { DataStructuresExplorer } from './structures/data-structures-explorer';

export const routes: Routes = [
  { path: '', component: FunctionPlotter, title: 'Graficador de funciones' },
  {
    path: 'matematicas',
    loadComponent: () => import('./section-hub').then((module) => module.SectionHub),
    data: { section: 'math' },
    title: 'Matemáticas',
  },
  {
    path: 'programacion',
    loadComponent: () => import('./section-hub').then((module) => module.SectionHub),
    data: { section: 'programming' },
    title: 'Programación',
  },
  {
    path: 'estructuras',
    component: DataStructuresExplorer,
    title: 'Visualizador de estructuras de datos',
  },
  {
    path: 'algoritmos',
    loadComponent: () =>
      import('./algorithms/algorithms-explorer').then((module) => module.AlgorithmsExplorer),
    title: 'Ordenamientos y complejidad',
  },
  {
    path: 'calculo',
    loadComponent: () =>
      import('./calculus/calculus-explorer').then((module) => module.CalculusExplorer),
    title: 'Cálculo: derivadas, áreas y curvas',
  },
  {
    path: 'analisis',
    loadComponent: () =>
      import('./analysis/analysis-explorer').then((module) => module.AnalysisExplorer),
    title: 'Cálculo y análisis: series',
  },
  {
    path: 'estadistica',
    loadComponent: () =>
      import('./statistics/statistics-explorer').then((module) => module.StatisticsExplorer),
    title: 'Probabilidad y estadística',
  },
  {
    path: 'optimizacion',
    loadComponent: () =>
      import('./optimization/optimization-explorer').then((module) => module.OptimizationExplorer),
    title: 'Optimización',
  },
  {
    path: 'geometria',
    loadComponent: () =>
      import('./geometry/geometry-explorer').then((module) => module.GeometryExplorer),
    title: 'Geometría y topología',
  },
  {
    path: 'algebra',
    loadComponent: () => import('./linear/linear-explorer').then((module) => module.LinearExplorer),
    title: 'Álgebra lineal: vectores, matrices y sistemas',
  },
  {
    path: 'conjuntos',
    loadComponent: () =>
      import('./sets/set-theory-explorer').then((module) => module.SetTheoryExplorer),
    title: 'Teoría de conjuntos',
  },
  {
    path: 'complejos',
    loadComponent: () =>
      import('./complex/complex-explorer').then((module) => module.ComplexExplorer),
    title: 'Números complejos',
  },
  {
    path: 'gaussianos',
    loadComponent: () =>
      import('./gaussian/gaussian-explorer').then((module) => module.GaussianExplorer),
    title: 'Enteros gaussianos Z[i]',
  },
  { path: '**', redirectTo: '' },
];
