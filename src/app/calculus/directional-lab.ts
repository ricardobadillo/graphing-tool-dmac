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
import {
  drawArrow,
  drawAxes,
  drawDashedLine,
  drawGrid,
  drawHeatmap,
  screenX,
  screenY,
} from '../shared/plot-utils';
import {
  analyzePartials,
  directionalDerivative,
  gradientAngle,
  gradientMagnitude,
  unitDirection,
} from './partials';

interface Preset {
  label: string;
  expression: string;
  x: string;
  y: string;
  angle: string;
}

@Component({
  selector: 'app-directional-lab',
  templateUrl: './directional-lab.html',
  styleUrls: ['./lab-shared.css', './directional-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectionalLab {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly expression = signal('x^2 + y^2');
  readonly xInput = signal('1');
  readonly yInput = signal('2');
  readonly angleInput = signal('45');
  readonly presets: Preset[] = [
    { label: 'x² + y²', expression: 'x^2 + y^2', x: '1', y: '2', angle: '45' },
    { label: 'x² − y²', expression: 'x^2 - y^2', x: '1', y: '1', angle: '0' },
    { label: 'sin(x)·cos(y)', expression: 'sin(x)*cos(y)', x: '0', y: '0', angle: '90' },
    { label: 'e^−(x²+y²)', expression: 'e^(-(x^2 + y^2))', x: '1', y: '0', angle: '180' },
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
  readonly gradient = computed(() => this.analysis().gradient);
  readonly direction = computed(() => unitDirection(this.angleRadians()));
  readonly directional = computed(() => {
    const gradient = this.gradient();
    if (!gradient || !Number.isFinite(this.angleRadians())) {
      return null;
    }
    return directionalDerivative(gradient.x, gradient.y, this.angleRadians());
  });
  readonly magnitude = computed(() => {
    const gradient = this.gradient();
    return gradient ? gradientMagnitude(gradient.x, gradient.y) : null;
  });
  readonly gradientDegrees = computed(() => {
    const gradient = this.gradient();
    if (!gradient) {
      return null;
    }
    return (gradientAngle(gradient.x, gradient.y) * 180) / Math.PI;
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
      this.angleRadians();
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
    this.angleInput.set(preset.angle);
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

    drawHeatmap(ctx, this.width, this.height, bounds, (x, y) =>
      evaluateExpression(compiled, { x, y }),
    );
    drawAxes(ctx, this.width, this.height, bounds);
    drawGrid(ctx, this.width, this.height, bounds);

    const pointX = screenX(centerX, bounds, this.width);
    const pointY = screenY(centerY, bounds, this.height);

    const gradient = this.gradient();
    if (gradient) {
      const norm = Math.max(1e-9, gradientMagnitude(gradient.x, gradient.y));
      const gradientEndX = screenX(centerX + (gradient.x / norm) * 0.9, bounds, this.width);
      const gradientEndY = screenY(centerY + (gradient.y / norm) * 0.9, bounds, this.height);
      drawArrow(ctx, pointX, pointY, gradientEndX, gradientEndY, '#fbbf24', 2.6);

      const tangent = { x: -gradient.y / norm, y: gradient.x / norm };
      drawDashedLine(
        ctx,
        screenX(centerX - tangent.x * 1.3, bounds, this.width),
        screenY(centerY - tangent.y * 1.3, bounds, this.height),
        screenX(centerX + tangent.x * 1.3, bounds, this.width),
        screenY(centerY + tangent.y * 1.3, bounds, this.height),
        'rgba(148, 163, 184, 0.55)',
      );
    }

    if (Number.isFinite(this.angleRadians())) {
      const directionEndX = screenX(
        centerX + Math.cos(this.angleRadians()) * 1.15,
        bounds,
        this.width,
      );
      const directionEndY = screenY(
        centerY + Math.sin(this.angleRadians()) * 1.15,
        bounds,
        this.height,
      );
      drawArrow(ctx, pointX, pointY, directionEndX, directionEndY, '#f472b6', 1.9);
    }

    ctx.beginPath();
    ctx.arc(pointX, pointY, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
  }
}
