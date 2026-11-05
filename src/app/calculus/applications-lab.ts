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
import { compileExpression, evaluateAt } from '../shared/expression';
import { formatExact } from '../shared/exact-number';
import { autoBounds, drawAxes, drawCurve, drawGrid, sampleFunction } from '../shared/plot-utils';
import { arcLength, areaBetween, volumeRevolution } from './integration';

type ApplicationMode = 'area' | 'arc' | 'volume';

@Component({
  selector: 'app-applications-lab',
  templateUrl: './applications-lab.html',
  styleUrls: ['./lab-shared.css', './applications-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationsLab {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<ApplicationMode>('area');
  readonly expression = signal('x');
  readonly secondExpression = signal('x^2');
  readonly aInput = signal('0');
  readonly bInput = signal('1');

  readonly modes: { key: ApplicationMode; label: string }[] = [
    { key: 'area', label: 'Área entre curvas' },
    { key: 'arc', label: 'Longitud de arco' },
    { key: 'volume', label: 'Sólido de revolución' },
  ];

  readonly a = computed(() => Number(this.aInput().replace(',', '.')));
  readonly b = computed(() => Number(this.bInput().replace(',', '.')));
  readonly intervalValid = computed(
    () => Number.isFinite(this.a()) && Number.isFinite(this.b()) && this.b() > this.a(),
  );

  readonly firstFunction = computed(() => this.compile(this.expression()));
  readonly secondFunction = computed(() => this.compile(this.secondExpression()));

  readonly areaResult = computed(() => {
    const f = this.firstFunction();
    const g = this.secondFunction();
    if (!f || !g || !this.intervalValid()) {
      return null;
    }
    return areaBetween(
      (x) => evaluateAt(f, x),
      (x) => evaluateAt(g, x),
      this.a(),
      this.b(),
    );
  });

  readonly arcResult = computed(() => {
    const f = this.firstFunction();
    if (!f || !this.intervalValid()) {
      return null;
    }
    return arcLength((x) => evaluateAt(f, x), this.a(), this.b());
  });

  readonly volumeResult = computed(() => {
    const f = this.firstFunction();
    if (!f || !this.intervalValid()) {
      return null;
    }
    return volumeRevolution((x) => evaluateAt(f, x), this.a(), this.b());
  });

  readonly points = computed(() => {
    const f = this.firstFunction();
    if (!f || !this.intervalValid()) {
      return [];
    }
    return sampleFunction((x) => evaluateAt(f, x), this.a(), this.b(), 500);
  });

  readonly secondPoints = computed(() => {
    const g = this.secondFunction();
    if (!g || !this.intervalValid()) {
      return [];
    }
    return sampleFunction((x) => evaluateAt(g, x), this.a(), this.b(), 500);
  });

  readonly bounds = computed(() =>
    this.mode() === 'area'
      ? autoBounds([...this.points(), ...this.secondPoints()])
      : autoBounds(this.points()),
  );

  readonly size = signal({ w: 0, h: 0 });
  private surface: CanvasSurface | null = null;

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

  constructor() {
    effect(() => {
      this.mode();
      this.points();
      this.secondPoints();
      this.size();
      this.surface?.requestDraw();
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

  setMode(mode: ApplicationMode): void {
    this.mode.set(mode);
  }

  onExpressionInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
  }

  onSecondExpressionInput(event: Event): void {
    this.secondExpression.set((event.target as HTMLInputElement).value);
  }

  onAInput(event: Event): void {
    this.aInput.set((event.target as HTMLInputElement).value);
  }

  onBInput(event: Event): void {
    this.bInput.set((event.target as HTMLInputElement).value);
  }

  applyPreset(expression: string, second: string, a: string, b: string): void {
    this.expression.set(expression);
    this.secondExpression.set(second);
    this.aInput.set(a);
    this.bInput.set(b);
  }

  format(value: number | null): string {
    return value === null ? '—' : formatExact(value, { digits: 6 });
  }

  formatList(values: number[]): string {
    return values.length === 0 ? '—' : values.map((value) => this.format(value)).join(', ');
  }

  private compile(expression: string) {
    return compileExpression(expression, ['x']).compiled;
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const bounds = this.bounds();
    drawGrid(ctx, this.width, this.height, bounds);
    drawAxes(ctx, this.width, this.height, bounds);

    if (this.mode() === 'area') {
      const f = this.firstFunction();
      const g = this.secondFunction();
      if (f && g && this.intervalValid()) {
        ctx.beginPath();
        const aX = ((this.a() - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
        const bX = ((this.b() - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;

        for (let px = aX; px <= bX; px += 2) {
          const worldX = bounds.xMin + (px / this.width) * (bounds.xMax - bounds.xMin);
          const value = evaluateAt(f, worldX);
          const y =
            this.height - ((value - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
          if (px === aX) {
            ctx.moveTo(px, y);
          } else {
            ctx.lineTo(px, y);
          }
        }
        for (let px = bX; px >= aX; px -= 2) {
          const worldX = bounds.xMin + (px / this.width) * (bounds.xMax - bounds.xMin);
          const value = evaluateAt(g, worldX);
          const y =
            this.height - ((value - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
          ctx.lineTo(px, y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        ctx.fill();
      }
    }

    drawCurve(ctx, this.width, this.height, bounds, this.points(), '#38bdf8');
    if (this.mode() === 'area') {
      drawCurve(ctx, this.width, this.height, bounds, this.secondPoints(), '#f472b6');
    }
  }
}
