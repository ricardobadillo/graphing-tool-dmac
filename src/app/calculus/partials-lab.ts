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
import { compileExpression, evaluateExpression } from '../shared/expression';
import { formatExact } from '../shared/exact-number';
import { drawArrow, drawAxes, drawGrid, screenX, screenY } from '../shared/plot-utils';
import { analyzePartials, directionalDerivative, tangentPlane } from './partials';

interface Preset {
  label: string;
  expression: string;
  x: string;
  y: string;
}

@Component({
  selector: 'app-partials-lab',
  templateUrl: './partials-lab.html',
  styleUrls: ['./lab-shared.css', './partials-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartialsLab {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly expression = signal('x^2 + y^2');
  readonly xInput = signal('1');
  readonly yInput = signal('2');
  readonly angleInput = signal('0');
  readonly presets: Preset[] = [
    { label: 'x² + y²', expression: 'x^2 + y^2', x: '1', y: '2' },
    { label: 'x² − y²', expression: 'x^2 - y^2', x: '1', y: '1' },
    { label: 'sin(x)·cos(y)', expression: 'sin(x)*cos(y)', x: '0', y: '0' },
    { label: 'e^−(x²+y²)', expression: 'e^(-(x^2 + y^2))', x: '1', y: '0' },
  ];

  readonly x = computed(() => Number(this.xInput().replace(',', '.')));
  readonly y = computed(() => Number(this.yInput().replace(',', '.')));
  readonly angleDegrees = computed(() => Number(this.angleInput().replace(',', '.')));
  readonly angleRadians = computed(() => (this.angleDegrees() * Math.PI) / 180);
  readonly valid = computed(
    () =>
      Number.isFinite(this.x()) &&
      Number.isFinite(this.y()) &&
      Number.isFinite(this.angleDegrees()),
  );

  readonly analysis = computed(() => analyzePartials(this.expression(), this.x(), this.y()));
  readonly directional = computed(() => {
    const gradient = this.analysis().gradient;
    if (!gradient || !Number.isFinite(this.angleRadians())) {
      return null;
    }
    return directionalDerivative(gradient.x, gradient.y, this.angleRadians());
  });
  readonly plane = computed(() => {
    const gradient = this.analysis().gradient;
    if (!gradient) {
      return null;
    }
    return tangentPlane(this.expression(), this.x(), this.y(), gradient.x, gradient.y);
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
      this.analysis();
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

  onXInput(event: Event): void {
    this.xInput.set((event.target as HTMLInputElement).value);
  }

  onYInput(event: Event): void {
    this.yInput.set((event.target as HTMLInputElement).value);
  }

  onAngleInput(event: Event): void {
    this.angleInput.set((event.target as HTMLInputElement).value);
  }

  applyPreset(preset: Preset): void {
    this.expression.set(preset.expression);
    this.xInput.set(preset.x);
    this.yInput.set(preset.y);
  }

  format(value: number | null): string {
    if (value === null) {
      return '—';
    }
    const cleaned =
      Math.abs(value) < 1e-6
        ? 0
        : Math.abs(value - Math.round(value)) < 1e-6
          ? Math.round(value)
          : value;
    return formatExact(cleaned, { digits: 4 });
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const compiled = compileExpression(this.expression(), ['x', 'y']).compiled;
    if (!compiled) {
      return;
    }

    const centerX = Number.isFinite(this.x()) ? this.x() : 0;
    const centerY = Number.isFinite(this.y()) ? this.y() : 0;
    const bounds = {
      xMin: centerX - 3,
      xMax: centerX + 3,
      yMin: centerY - 3,
      yMax: centerY + 3,
    };

    const columns = 58;
    const rows = 42;
    const values: number[][] = [];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let row = 0; row <= rows; row += 1) {
      const line: number[] = [];
      for (let column = 0; column <= columns; column += 1) {
        const x = bounds.xMin + ((bounds.xMax - bounds.xMin) * column) / columns;
        const y = bounds.yMin + ((bounds.yMax - bounds.yMin) * row) / rows;
        const value = evaluateExpression(compiled, { x, y });
        line.push(Number.isFinite(value) ? value : Number.NaN);
        if (Number.isFinite(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
      values.push(line);
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return;
    }

    const cellWidth = this.width / columns;
    const cellHeight = this.height / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = values[row][column];
        if (!Number.isFinite(value)) {
          continue;
        }
        const normalized = (value - min) / Math.max(1e-9, max - min);
        const hue = 220 - normalized * 220;
        ctx.fillStyle = `hsl(${hue} 75% ${18 + normalized * 32}% / 0.75)`;
        ctx.fillRect(column * cellWidth, row * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
      }
    }

    drawAxes(ctx, this.width, this.height, bounds);
    drawGrid(ctx, this.width, this.height, bounds);

    const pointX = screenX(centerX, bounds, this.width);
    const pointY = screenY(centerY, bounds, this.height);
    ctx.beginPath();
    ctx.arc(pointX, pointY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    const gradient = this.analysis().gradient;
    if (gradient) {
      const scale = 34 / Math.max(1e-6, Math.hypot(gradient.x, gradient.y));
      drawArrow(
        ctx,
        pointX,
        pointY,
        pointX + gradient.x * scale,
        pointY - gradient.y * scale,
        '#fbbf24',
        2.4,
      );
    }

    if (Number.isFinite(this.angleRadians())) {
      drawArrow(
        ctx,
        pointX,
        pointY,
        pointX + Math.cos(this.angleRadians()) * 58,
        pointY - Math.sin(this.angleRadians()) * 58,
        '#f472b6',
        1.8,
      );
    }
  }
}
