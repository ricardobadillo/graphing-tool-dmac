import { Routes } from '@angular/router';
import { ALL_TOOLS, SECTION_META } from './tools';

const toolRoutes: Routes = ALL_TOOLS.map((tool) => ({
  path: tool.route === '/' ? '' : tool.route.replace(/^\//, ''),
  loadComponent: tool.loadComponent,
  title: tool.title,
  data: { description: tool.description, section: tool.section },
}));

export const routes: Routes = [
  ...toolRoutes,
  {
    path: 'matematicas',
    loadComponent: () => import('./section-hub').then((module) => module.SectionHub),
    data: {
      section: 'math',
      description: SECTION_META.math.description,
    },
    title: SECTION_META.math.title,
  },
  {
    path: 'programacion',
    loadComponent: () => import('./section-hub').then((module) => module.SectionHub),
    data: {
      section: 'programming',
      description: SECTION_META.programming.description,
    },
    title: SECTION_META.programming.title,
  },
  { path: '**', redirectTo: '' },
];
