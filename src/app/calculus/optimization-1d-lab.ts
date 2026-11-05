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
import {
  autoBounds,
  drawAxes,
  drawCurve,
  drawGrid,
  drawPoint,
  sampleFunction,
} from '../shared/plot-utils';
import { analyzeOptimization1D } from './optimization-1d';

interface Preset {
  label: string;
  expression: string;
  a: string;
  b: string;
}

@Component({
  selector: 'app-optimization-1d-lab',
  templateUrl: './optimization-1d-lab.html',
  styleUrls: ['./lab-shared.css', './optimization-1d-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Optimization1DLab {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly expression = signal('x^3 - 3*x');
  readonly aInput = signal('-2');
  readonly bInput = signal('2');
  readonly presets: Preset[] = [
    { label: 'x²', expression: 'x^2', a: '-2', b: '2' },
    { label: 'x³−3x', expression: 'x^3 - 3*x', a: '-2', b: '2' },
    { label: 'sin(x)', expression: 'sin(x)', a: '0', b: '6.283185' },
    { label: 'x⁴−2x²', expression: 'x^4 - 2*x^2', a: '-2', b: '2' },
  ];

  readonly a = computed(() => Number(this.aInput().replace(',', '.')));
  readonly b = computed(() => Number(this.bInput().replace(',', '.')));
  readonly intervalValid = computed(
    () => Number.isFinite(this.a()) && Number.isFinite(this.b()) && this.b() > this.a(),
  );
  readonly result = computed(() => analyzeOptimization1D(this.expression(), this.a(), this.b()));

  readonly points = computed(() => {
    const compiled = compileExpression(this.expression(), ['x']);
    if (!compiled.compiled || !this.intervalValid()) {
      return [];
    }
    return sampleFunction((x) => evaluateAt(compiled.compiled!, x), this.a(), this.b(), 600);
  });
  readonly bounds = computed(() => autoBounds(this.points()));

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
      this.points();
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

  onExpressionInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
  }

  onAInput(event: Event): void {
    this.aInput.set((event.target as HTMLInputElement).value);
  }

  onBInput(event: Event): void {
    this.bInput.set((event.target as HTMLInputElement).value);
  }

  applyPreset(preset: Preset): void {
    this.expression.set(preset.expression);
    this.aInput.set(preset.a);
    this.bInput.set(preset.b);
  }

  format(value: number | null): string {
    return value === null ? '—' : formatExact(value, { digits: 4 });
  }

  formatInflections(values: number[]): string {
    return values.length === 0 ? '—' : values.map((value) => this.format(value)).join(', ');
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
    drawCurve(ctx, this.width, this.height, bounds, this.points(), '#38bdf8');

    for (const point of this.result().maxima) {
      const x = ((point.x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
      const y = this.height - ((point.y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
      drawPoint(ctx, x, y, '#34d399', 'max');
    }
    for (const point of this.result().minima) {
      const x = ((point.x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
      const y = this.height - ((point.y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
      drawPoint(ctx, x, y, '#fb7185', 'min');
    }
    for (const inflection of this.result().inflections) {
      const compiled = compileExpression(this.expression(), ['x']);
      if (!compiled.compiled) {
        continue;
      }
      const value = evaluateAt(compiled.compiled, inflection);
      if (!Number.isFinite(value)) {
        continue;
      }
      const x = ((inflection - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
      const y = this.height - ((value - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
      drawPoint(ctx, x, y, '#fbbf24', 'square');
    }
  }
}
