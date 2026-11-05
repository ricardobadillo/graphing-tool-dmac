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
import { compileExpression, evaluateAt, evaluateExpression } from '../shared/expression';
import { formatExact } from '../shared/exact-number';
import {
  autoBounds,
  drawArrow,
  drawAxes,
  drawCurve,
  drawGrid,
  screenX,
  screenY,
} from '../shared/plot-utils';
import { linearSolution, separableSolution, slopeField } from './ode';

type OdeMode = 'separable' | 'linear';

@Component({
  selector: 'app-ode-lab',
  templateUrl: './ode-lab.html',
  styleUrls: ['./lab-shared.css', './ode-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OdeLab {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<OdeMode>('separable');
  readonly fInput = signal('x');
  readonly gInput = signal('y');
  readonly pInput = signal('1');
  readonly qInput = signal('0');
  readonly x0Input = signal('0');
  readonly y0Input = signal('1');
  readonly xEndInput = signal('2');

  readonly x0 = computed(() => Number(this.x0Input().replace(',', '.')));
  readonly y0 = computed(() => Number(this.y0Input().replace(',', '.')));
  readonly xEnd = computed(() => Number(this.xEndInput().replace(',', '.')));
  readonly valid = computed(
    () =>
      Number.isFinite(this.x0()) &&
      Number.isFinite(this.y0()) &&
      Number.isFinite(this.xEnd()) &&
      this.xEnd() > this.x0(),
  );

  readonly derivative = computed<((x: number, y: number) => number) | null>(() => {
    if (this.mode() === 'separable') {
      const f = compileExpression(this.fInput(), ['x']).compiled;
      const g = compileExpression(this.gInput(), ['y']).compiled;
      if (!f || !g) {
        return null;
      }
      return (x, y) => evaluateAt(f, x) * evaluateExpression(g, { y });
    }

    const p = compileExpression(this.pInput(), ['x']).compiled;
    const q = compileExpression(this.qInput(), ['x']).compiled;
    if (!p || !q) {
      return null;
    }
    return (x, y) => evaluateAt(q, x) - evaluateAt(p, x) * y;
  });

  readonly result = computed(() => {
    if (!this.valid()) {
      return { points: [], error: 'Revisa las condiciones iniciales.' };
    }
    if (this.mode() === 'separable') {
      const f = compileExpression(this.fInput(), ['x']).compiled;
      const g = compileExpression(this.gInput(), ['y']).compiled;
      if (!f || !g) {
        return { points: [], error: 'Función no válida.' };
      }
      return separableSolution(
        (x) => evaluateAt(f, x),
        (y) => evaluateExpression(g, { y }),
        this.x0(),
        this.y0(),
        this.xEnd(),
      );
    }

    const p = compileExpression(this.pInput(), ['x']).compiled;
    const q = compileExpression(this.qInput(), ['x']).compiled;
    if (!p || !q) {
      return { points: [], error: 'Función no válida.' };
    }
    return linearSolution(
      (x) => evaluateAt(p, x),
      (x) => evaluateAt(q, x),
      this.x0(),
      this.y0(),
      this.xEnd(),
    );
  });

  readonly fieldPoints = computed(() => {
    const derivative = this.derivative();
    if (!derivative || !this.valid()) {
      return [];
    }
    const points = this.result().points;
    const ys = points.map((point) => point.y).filter(Number.isFinite);
    const minY = Math.min(...ys, this.y0());
    const maxY = Math.max(...ys, this.y0());
    const padding = Math.max((maxY - minY) * 0.35, 1);
    return slopeField(derivative, this.x0(), this.xEnd(), minY - padding, maxY + padding, 22, 14);
  });

  readonly bounds = computed(() => {
    const points = this.result().points;
    const field = this.fieldPoints();
    if (points.length === 0 && field.length === 0) {
      return { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };
    }
    const xs = [...points.map((point) => point.x), ...field.map((point) => point.x)];
    const ys = [...points.map((point) => point.y), ...field.map((point) => point.y)];
    return autoBounds(
      xs.map((x, index) => ({ x, y: ys[index] ?? null })),
      { xMin: this.x0(), xMax: this.xEnd(), yMin: -2, yMax: 2 },
    );
  });

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
      this.result();
      this.fieldPoints();
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

  setMode(mode: OdeMode): void {
    this.mode.set(mode);
  }

  onInput(
    target: 'fInput' | 'gInput' | 'pInput' | 'qInput' | 'x0Input' | 'y0Input' | 'xEndInput',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    switch (target) {
      case 'fInput':
        this.fInput.set(value);
        break;
      case 'gInput':
        this.gInput.set(value);
        break;
      case 'pInput':
        this.pInput.set(value);
        break;
      case 'qInput':
        this.qInput.set(value);
        break;
      case 'x0Input':
        this.x0Input.set(value);
        break;
      case 'y0Input':
        this.y0Input.set(value);
        break;
      case 'xEndInput':
        this.xEndInput.set(value);
        break;
    }
  }

  applyPreset(
    mode: OdeMode,
    f: string,
    g: string,
    p: string,
    q: string,
    x0: string,
    y0: string,
    xEnd: string,
  ): void {
    this.mode.set(mode);
    this.fInput.set(f);
    this.gInput.set(g);
    this.pInput.set(p);
    this.qInput.set(q);
    this.x0Input.set(x0);
    this.y0Input.set(y0);
    this.xEndInput.set(xEnd);
  }

  format(value: number | null): string {
    return value === null ? '—' : formatExact(value, { digits: 5 });
  }

  formatPlain(value: number | null): string {
    return value === null ? '—' : formatExact(value, { digits: 5, approximate: false });
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

    for (const point of this.fieldPoints()) {
      const x = screenX(point.x, bounds, this.width);
      const y = screenY(point.y, bounds, this.height);
      const angle = Math.atan2(point.slope, 1);
      const dx = Math.cos(angle) * 9;
      const dy = -Math.sin(angle) * 9;
      drawArrow(ctx, x - dx, y - dy, x + dx, y + dy, 'rgba(148, 163, 184, 0.45)', 1);
    }

    const points = this.result().points.map((point) => ({ x: point.x, y: point.y }));
    drawCurve(ctx, this.width, this.height, bounds, points, '#38bdf8', 2.4);
  }
}
