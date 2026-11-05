import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

type SectionKey = 'math' | 'programming';
type Accent = 'sky' | 'emerald' | 'violet' | 'amber' | 'fuchsia' | 'teal';

interface ToolCard {
  title: string;
  route: string;
  description: string;
  tag: string;
  monogram: string;
  accent: Accent;
}

interface SectionContent {
  key: SectionKey;
  eyebrow: string;
  title: string;
  description: string;
  tools: ToolCard[];
}

const MATHEMATICS: SectionContent = {
  key: 'math',
  eyebrow: 'Matemáticas',
  title: 'Laboratorio de matemáticas',
  description:
    'Funciones, análisis, álgebra, probabilidad, optimización, geometría y números especiales. Elige una herramienta para explorar, manipular y visualizar.',
  tools: [
    {
      title: 'Graficador de funciones',
      route: '/',
      description: 'Funciones, zoom, desplazamiento y varias curvas en el mismo plano.',
      tag: 'Funciones',
      monogram: 'ƒ',
      accent: 'sky',
    },
    {
      title: 'Cálculo',
      route: '/calculo',
      description: 'Derivadas, áreas bajo la curva, coordenadas polares y paramétricas.',
      tag: 'Cálculo',
      monogram: '∫',
      accent: 'emerald',
    },
    {
      title: 'Cálculo y análisis',
      route: '/analisis',
      description: 'Series de Taylor y Fourier para aproximar funciones y ondas.',
      tag: 'Análisis',
      monogram: '∑',
      accent: 'emerald',
    },
    {
      title: 'Álgebra lineal',
      route: '/algebra',
      description: 'Vectores, matrices, autovalores, composición y sistemas lineales.',
      tag: 'Álgebra',
      monogram: 'A',
      accent: 'violet',
    },
    {
      title: 'Teoría de conjuntos',
      route: '/conjuntos',
      description: 'Diagramas de Venn, operaciones y leyes de la teoría de conjuntos.',
      tag: 'Discreta',
      monogram: '∩',
      accent: 'amber',
    },
    {
      title: 'Números complejos',
      route: '/complejos',
      description: 'Plano de Argand, forma polar, operaciones, potencias y raíces.',
      tag: 'Complejos',
      monogram: 'ℂ',
      accent: 'fuchsia',
    },
    {
      title: 'Enteros gaussianos',
      route: '/gaussianos',
      description: 'Retícula ℤ[i], norma, divisibilidad, primalidad y máximo común divisor.',
      tag: 'Números',
      monogram: 'ℤ[i]',
      accent: 'teal',
    },
    {
      title: 'Probabilidad y estadística',
      route: '/estadistica',
      description: 'Distribuciones, intervalos de probabilidad y teorema central del límite.',
      tag: 'Estadística',
      monogram: 'σ',
      accent: 'sky',
    },
    {
      title: 'Optimización',
      route: '/optimizacion',
      description: 'Programación lineal, región factible y descenso de gradiente.',
      tag: 'Optimización',
      monogram: '∇',
      accent: 'amber',
    },
    {
      title: 'Geometría y topología',
      route: '/geometria',
      description: 'Fractales, círculo trigonométrico y la banda de Möbius.',
      tag: 'Geometría',
      monogram: '△',
      accent: 'fuchsia',
    },
  ],
};

const PROGRAMMING: SectionContent = {
  key: 'programming',
  eyebrow: 'Programación',
  title: 'Laboratorio de programación',
  description:
    'Estructuras de datos y algoritmos con visualizaciones interactivas, predicciones y análisis de complejidad.',
  tools: [
    {
      title: 'Estructuras de datos',
      route: '/estructuras',
      description: 'Listas, pilas, colas, árboles, heaps, tablas hash y grafos interactivos.',
      tag: 'Estructuras',
      monogram: 'DS',
      accent: 'sky',
    },
    {
      title: 'Algoritmos',
      route: '/algoritmos',
      description: 'Ordenamientos animados y laboratorio de complejidad Big-O.',
      tag: 'Algoritmos',
      monogram: 'O(n)',
      accent: 'violet',
    },
  ],
};

@Component({
  selector: 'app-section-hub',
  imports: [RouterLink],
  templateUrl: './section-hub.html',
  styleUrl: './section-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHub {
  private readonly route = inject(ActivatedRoute);
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });

  readonly section = computed<SectionKey>(() =>
    this.routeData()['section'] === 'programming' ? 'programming' : 'math',
  );

  readonly content = computed<SectionContent>(() =>
    this.section() === 'programming' ? PROGRAMMING : MATHEMATICS,
  );
}
