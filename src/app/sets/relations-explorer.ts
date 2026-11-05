import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CanvasSurface } from '../shared/canvas-surface';
import {
  analyzeRelation,
  formatPair,
  parseElements,
  parsePairs,
  togglePair,
  type RelationPair,
} from './relations';

interface Preset {
  label: string;
  elements: string;
  pairs: string;
}

interface PropertyRow {
  label: string;
  value: boolean;
  description: string;
}

const CLASS_COLORS = [
  '#38bdf8',
  '#f472b6',
  '#a78bfa',
  '#fbbf24',
  '#34d399',
  '#fb7185',
  '#22d3ee',
  '#c084fc',
];

@Component({
  selector: 'app-relations-explorer',
  templateUrl: './relations-explorer.html',
  styleUrl: './relations-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelationsExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly elementsInput = signal('1,2,3');
  readonly pairsInput = signal('(1,1), (1,2), (1,3), (2,2), (2,3), (3,3)');
  readonly size = signal({ w: 0, h: 0 });
  private surface: CanvasSurface | null = null;

  readonly presets: Preset[] = [
    {
      label: 'Igualdad',
      elements: '1,2,3',
      pairs: '(1,1), (2,2), (3,3)',
    },
    {
      label: 'Orden ≤',
      elements: '1,2,3',
      pairs: '(1,1), (1,2), (1,3), (2,2), (2,3), (3,3)',
    },
    {
      label: 'Equivalencia mod 3',
      elements: '0,1,2,3,4,5',
      pairs: '(0,0), (0,3), (1,1), (1,4), (2,2), (2,5), (3,0), (3,3), (4,1), (4,4), (5,2), (5,5)',
    },
    {
      label: 'Función biyectiva',
      elements: '1,2,3',
      pairs: '(1,2), (2,3), (3,1)',
    },
    {
      label: 'No transitiva',
      elements: '1,2,3',
      pairs: '(1,2), (2,3)',
    },
  ];

  private get ctx(): CanvasRenderingContext2D | null {
    return this.surface?.context ?? null;
  }
  private get width(): number {
    return this.surface?.width ?? 0;
  }
  private get height(): number {
    return this.surface?.height ?? 0;
  }
  private get dpr(): number {
    return this.surface?.pixelRatio ?? 1;
  }

  readonly elements = computed(() => parseElements(this.elementsInput()));
  readonly parsed = computed(() => parsePairs(this.pairsInput(), this.elements()));
  readonly pairs = computed<RelationPair[]>(() => this.parsed().pairs);
  readonly analysis = computed(() => analyzeRelation(this.elements(), this.pairs()));
  readonly matrix = computed(() => this.analysis().matrix);

  readonly properties = computed<PropertyRow[]>(() => {
    const analysis = this.analysis();
    return [
      {
        label: 'Reflexiva',
        value: analysis.reflexive,
        description: 'Todo elemento se relaciona consigo mismo.',
      },
      {
        label: 'Irreflexiva',
        value: analysis.irreflexive,
        description: 'Ningún elemento se relaciona consigo mismo.',
      },
      {
        label: 'Simétrica',
        value: analysis.symmetric,
        description: 'Si a R b, entonces b R a.',
      },
      {
        label: 'Antisimétrica',
        value: analysis.antisymmetric,
        description: 'Si a R b y b R a, entonces a = b.',
      },
      {
        label: 'Transitiva',
        value: analysis.transitive,
        description: 'Si a R b y b R c, entonces a R c.',
      },
      {
        label: 'Equivalencia',
        value: analysis.equivalence,
        description: 'Reflexiva, simétrica y transitiva.',
      },
      {
        label: 'Orden parcial',
        value: analysis.partialOrder,
        description: 'Reflexiva, antisimétrica y transitiva.',
      },
    ];
  });

  readonly functionProperties = computed(() => {
    const analysis = this.analysis();
    return [
      { label: 'Es función', value: analysis.functionLike },
      { label: 'Inyectiva', value: analysis.injective },
      { label: 'Sobreyectiva', value: analysis.surjective },
      { label: 'Biyectiva', value: analysis.bijective },
    ];
  });

  readonly classes = computed(() => this.analysis().equivalenceClasses);
  readonly classColor = computed(() => {
    const map = new Map<string, string>();
    this.classes().forEach((group, index) => {
      const color = CLASS_COLORS[index % CLASS_COLORS.length];
      for (const element of group) {
        map.set(element, color);
      }
    });
    return map;
  });

  constructor() {
    effect(() => {
      this.elementsInput();
      this.pairsInput();
      this.size();
      this.scheduleDraw();
    });

    afterNextRender(() => {
      if (typeof CanvasRenderingContext2D === 'undefined') {
        return;
      }

      const canvas = this.canvasRef().nativeElement;
      const container = canvas.parentElement;
      if (!container) {
        return;
      }

      this.surface = new CanvasSurface({
        canvas,
        container,
        draw: () => this.draw(),
        onResize: (size) => this.size.set(size),
      });
      this.surface.resize();

      this.destroyRef.onDestroy(() => this.surface?.destroy());
    });
  }

  onElementsInput(event: Event): void {
    this.elementsInput.set((event.target as HTMLInputElement).value);
  }

  onPairsInput(event: Event): void {
    this.pairsInput.set((event.target as HTMLInputElement).value);
  }

  applyPreset(preset: Preset): void {
    this.elementsInput.set(preset.elements);
    this.pairsInput.set(preset.pairs);
  }

  toggleCell(row: number, column: number): void {
    const from = this.elements()[row];
    const to = this.elements()[column];
    if (from === undefined || to === undefined) {
      return;
    }

    const next = togglePair(this.pairs(), from, to);
    this.pairsInput.set(next.map(formatPair).join(', '));
  }

  isPairActive(row: number, column: number): boolean {
    return this.matrix()[row]?.[column] ?? false;
  }

  private scheduleDraw(): void {
    this.surface?.requestDraw();
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const elements = this.elements();
    if (elements.length === 0) {
      return;
    }

    const center = { x: this.width / 2, y: this.height / 2 };
    const radius = Math.max(30, Math.min(this.width, this.height) * 0.32);
    const positions = elements.map((_, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / elements.length;
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });

    this.drawEdges(ctx, elements, positions);
    this.drawNodes(ctx, elements, positions);
  }

  private drawEdges(
    ctx: CanvasRenderingContext2D,
    elements: string[],
    positions: { x: number; y: number }[],
  ): void {
    const index = new Map(elements.map((element, position) => [element, position]));
    const seen = new Set<string>();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
    ctx.lineWidth = 1.4;

    for (const pair of this.pairs()) {
      const fromIndex = index.get(pair.from);
      const toIndex = index.get(pair.to);
      if (fromIndex === undefined || toIndex === undefined) {
        continue;
      }

      const key = `${fromIndex}-${toIndex}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (fromIndex === toIndex) {
        this.drawLoop(ctx, positions[fromIndex]);
        continue;
      }

      const hasReverse = this.pairs().some(
        (candidate) => candidate.from === pair.to && candidate.to === pair.from,
      );

      if (hasReverse) {
        this.drawCurvedEdge(ctx, positions[fromIndex], positions[toIndex], 1);
        this.drawCurvedEdge(ctx, positions[toIndex], positions[fromIndex], -1);
      } else {
        this.drawStraightEdge(ctx, positions[fromIndex], positions[toIndex]);
      }
    }
  }

  private drawStraightEdge(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const start = { x: from.x + Math.cos(angle) * 18, y: from.y + Math.sin(angle) * 18 };
    const end = { x: to.x - Math.cos(angle) * 20, y: to.y - Math.sin(angle) * 20 };

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    this.drawArrow(ctx, end, angle);
  }

  private drawCurvedEdge(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    side: 1 | -1,
  ): void {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const offset = 32 * side;
    const control = { x: mx + (-dy / length) * offset, y: my + (dx / length) * offset };

    const angle = Math.atan2(to.y - control.y, to.x - control.x);
    const end = { x: to.x - Math.cos(angle) * 20, y: to.y - Math.sin(angle) * 20 };

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
    ctx.stroke();
    this.drawArrow(ctx, end, angle);
  }

  private drawLoop(ctx: CanvasRenderingContext2D, point: { x: number; y: number }): void {
    ctx.beginPath();
    ctx.arc(point.x, point.y - 26, 14, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.stroke();

    const angle = -Math.PI / 2 + 0.85 * Math.PI;
    const end = {
      x: point.x + 14 * Math.cos(angle),
      y: point.y - 26 + 14 * Math.sin(angle),
    };
    this.drawArrow(ctx, end, angle + Math.PI / 2);
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    point: { x: number; y: number },
    angle: number,
  ): void {
    const size = 6;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(
      point.x - size * Math.cos(angle - Math.PI / 6),
      point.y - size * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      point.x - size * Math.cos(angle + Math.PI / 6),
      point.y - size * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  }

  private drawNodes(
    ctx: CanvasRenderingContext2D,
    elements: string[],
    positions: { x: number; y: number }[],
  ): void {
    const colors = this.classColor();

    elements.forEach((element, index) => {
      const position = positions[index];
      const color = colors.get(element) ?? '#64748b';

      ctx.beginPath();
      ctx.arc(position.x, position.y, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1224';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(element, position.x, position.y);
    });
  }
}
