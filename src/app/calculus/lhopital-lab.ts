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
  drawDashedLine,
  drawGrid,
  sampleFunction,
} from '../shared/plot-utils';
import { analyzeLHopital, lhopitalFormLabel } from './lhopital';

interface Preset {
  label: string;
  numerator: string;
  denominator: string;
  point: string;
}

@Component({
  selector: 'app-lhopital-lab',
  templateUrl: './lhopital-lab.html',
  styleUrls: ['./lab-shared.css', './lhopital-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LHopitalLab {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly numerator = signal('sin(x)');
  readonly denominator = signal('x');
  readonly pointInput = signal('0');
  readonly presets: Preset[] = [
    { label: 'sin(x)/x', numerator: 'sin(x)', denominator: 'x', point: '0' },
    { label: '(1−cos x)/x²', numerator: '1 - cos(x)', denominator: 'x^2', point: '0' },
    { label: '(eˣ−1)/x', numerator: 'e^x - 1', denominator: 'x', point: '0' },
    { label: 'ln(x)/(x−1)', numerator: 'ln(x)', denominator: 'x - 1', point: '1' },
  ];

  readonly point = computed(() => {
    const value = Number(this.pointInput().replace(',', '.'));
    return Number.isFinite(value) ? value : Number.NaN;
  });
  readonly pointValid = computed(() => Number.isFinite(this.point()));
  readonly result = computed(() =>
    analyzeLHopital(this.numerator(), this.denominator(), this.point()),
  );
  readonly formLabel = lhopitalFormLabel;

  readonly ratioPoints = computed(() => {
    const point = this.point();
    const center = Number.isFinite(point) ? point : 0;
    const compiled = compileExpression(`(${this.numerator()}) / (${this.denominator()})`, ['x']);
    if (!compiled.compiled) {
      return [];
    }
    return sampleFunction((x) => evaluateAt(compiled.compiled!, x), center - 3, center + 3, 500);
  });
  readonly bounds = computed(() =>
    autoBounds(this.ratioPoints(), {
      xMin: -3,
      xMax: 3,
      yMin: -5,
      yMax: 5,
    }),
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
      this.ratioPoints();
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

  onNumeratorInput(event: Event): void {
    this.numerator.set((event.target as HTMLInputElement).value);
  }

  onDenominatorInput(event: Event): void {
    this.denominator.set((event.target as HTMLInputElement).value);
  }

  onPointInput(event: Event): void {
    this.pointInput.set((event.target as HTMLInputElement).value);
  }

  applyPreset(preset: Preset): void {
    this.numerator.set(preset.numerator);
    this.denominator.set(preset.denominator);
    this.pointInput.set(preset.point);
  }

  format(value: number | null): string {
    return value === null ? '—' : formatExact(value, { digits: 4 });
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
    drawCurve(ctx, this.width, this.height, bounds, this.ratioPoints(), '#38bdf8');

    if (Number.isFinite(this.point())) {
      const x = ((this.point() - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
      drawDashedLine(ctx, x, 0, x, this.height, 'rgba(251, 191, 36, 0.45)');
    }
  }
}
