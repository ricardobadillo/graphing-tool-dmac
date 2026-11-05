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
import { clamp, formatNumber, niceStep } from '../shared/math-utils';
import {
  analyzeLimit,
  continuityLabel,
  formatLimit,
  type ContinuityKind,
  type LimitAnalysis,
} from './limits';

interface CurvePoint {
  x: number;
  y: number | null;
}

interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface Preset {
  label: string;
  expression: string;
  point: string;
}

const COLORS = {
  curve: '#38bdf8',
  left: '#fbbf24',
  right: '#f472b6',
  point: '#a78bfa',
  grid: 'rgba(148, 163, 184, 0.09)',
  axis: 'rgba(226, 232, 240, 0.5)',
  text: 'rgba(203, 213, 225, 0.82)',
};

function snap(value: number): number {
  return Math.round(value) + 0.5;
}

@Component({
  selector: 'app-limits-explorer',
  templateUrl: './limits-explorer.html',
  styleUrl: './limits-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LimitsExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly expression = signal('(x^2 - 1) / (x - 1)');
  readonly pointInput = signal('1');
  readonly spanInput = signal('4');
  readonly presets: Preset[] = [
    { label: 'Continua', expression: 'x^2', point: '2' },
    { label: 'Evitable', expression: '(x^2 - 1) / (x - 1)', point: '1' },
    { label: 'Salto', expression: 'abs(x) / x', point: '0' },
    { label: 'Infinita', expression: '1 / x', point: '0' },
    { label: 'Notable', expression: 'sin(x) / x', point: '0' },
    { label: 'Asíntota', expression: '1 / (x - 2)', point: '2' },
  ];

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

  readonly compiled = computed(() => compileExpression(this.expression(), ['x']));
  readonly point = computed(() => {
    const value = Number(this.pointInput().replace(',', '.'));
    return Number.isFinite(value) ? value : Number.NaN;
  });
  readonly pointValid = computed(() => Number.isFinite(this.point()));
  readonly span = computed(() => {
    const value = Number(this.spanInput().replace(',', '.'));
    return Number.isFinite(value) ? clamp(value, 0.05, 1000) : 4;
  });

  readonly analysis = computed<LimitAnalysis | null>(() => {
    const compiled = this.compiled();
    if (!compiled.compiled || !Number.isFinite(this.point())) {
      return null;
    }
    return analyzeLimit(compiled.compiled, this.point());
  });

  readonly curve = computed<CurvePoint[]>(() => {
    const compiled = this.compiled();
    if (!compiled.compiled) {
      return [];
    }

    const point = this.point();
    const center = Number.isFinite(point) ? point : 0;
    const span = this.span();
    const count = 520;
    return Array.from({ length: count + 1 }, (_, index) => {
      const x = center - span + (2 * span * index) / count;
      const y = evaluateAt(compiled.compiled!, x);
      return { x, y: Number.isFinite(y) ? y : null };
    });
  });

  readonly bounds = computed<Bounds>(() => {
    const point = this.point();
    const center = Number.isFinite(point) ? point : 0;
    const span = this.span();
    const values = this.curve()
      .map((entry) => entry.y)
      .filter((value): value is number => value !== null && Math.abs(value) < 1e6)
      .map((value) => Math.abs(value))
      .sort((left, right) => left - right);

    const percentile = values[Math.min(values.length - 1, Math.floor(values.length * 0.9))] ?? 4;
    const limit = clamp(percentile * 1.25, 0.5, 1000);

    return {
      xMin: center - span,
      xMax: center + span,
      yMin: -limit,
      yMax: limit,
    };
  });

  readonly kind = computed<ContinuityKind>(() => this.analysis()?.kind ?? 'unknown');
  readonly kindLabel = computed(() => continuityLabel(this.kind()));
  readonly kindTone = computed(() => {
    switch (this.kind()) {
      case 'continuous':
        return 'text-emerald-300';
      case 'removable':
        return 'text-sky-300';
      case 'jump':
        return 'text-amber-300';
      case 'infinite':
        return 'text-rose-300';
      default:
        return 'text-slate-300';
    }
  });

  constructor() {
    effect(() => {
      this.expression();
      this.pointInput();
      this.spanInput();
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

  onExpressionInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
  }

  onPointInput(event: Event): void {
    this.pointInput.set((event.target as HTMLInputElement).value);
  }

  onSpanInput(event: Event): void {
    this.spanInput.set((event.target as HTMLInputElement).value);
  }

  applyPreset(preset: Preset): void {
    this.expression.set(preset.expression);
    this.pointInput.set(preset.point);
  }

  format(value: number | null, digits = 3): string {
    return formatLimit(value, digits).replace(/-/g, '−');
  }

  formatValue(value: number | null, digits = 3): string {
    if (value === null) {
      return '—';
    }
    return formatNumber(value, digits).replace(/-/g, '−');
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

    const bounds = this.bounds();
    this.drawGrid(ctx, bounds);
    this.drawAxes(ctx, bounds);
    this.drawCurve(ctx, bounds);
    this.drawFocus(ctx, bounds);
  }

  private px(bounds: Bounds, x: number): number {
    return ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
  }

  private py(bounds: Bounds, y: number): number {
    return this.height - ((y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
  }

  private drawGrid(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    const step = niceStep((bounds.xMax - bounds.xMin) / 10);
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let value = Math.ceil(bounds.xMin / step) * step; value <= bounds.xMax; value += step) {
      const x = snap(this.px(bounds, value));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let value = Math.ceil(bounds.yMin / step) * step; value <= bounds.yMax; value += step) {
      const y = snap(this.py(bounds, value));
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
  }

  private drawAxes(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    const axisX = this.px(bounds, 0);
    const axisY = this.py(bounds, 0);
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (axisY >= 0 && axisY <= this.height) {
      const y = snap(axisY);
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    if (axisX >= 0 && axisX <= this.width) {
      const x = snap(axisX);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    ctx.stroke();

    const step = niceStep((bounds.xMax - bounds.xMin) / 10);
    ctx.fillStyle = COLORS.text;
    ctx.font = '500 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let value = Math.ceil(bounds.xMin / step) * step; value <= bounds.xMax; value += step) {
      if (Math.abs(value) < step * 1e-6) {
        continue;
      }
      const x = this.px(bounds, value);
      if (x < 20 || x > this.width - 20) {
        continue;
      }
      ctx.fillText(formatNumber(value, 2), x, clamp(axisY + 6, 4, this.height - 18));
    }
  }

  private drawCurve(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    const points = this.curve();
    if (points.length === 0) {
      return;
    }

    const jumpLimit = this.height * 1.2;
    ctx.save();
    ctx.strokeStyle = COLORS.curve;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    let previousY: number | null = null;
    for (const point of points) {
      if (point.y === null) {
        previousY = null;
        continue;
      }

      const x = this.px(bounds, point.x);
      const y = this.py(bounds, point.y);
      if (previousY === null || Math.abs(y - previousY) > jumpLimit) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      previousY = y;
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawFocus(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    const point = this.point();
    if (!Number.isFinite(point)) {
      return;
    }

    const x = this.px(bounds, point);
    ctx.save();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(snap(x), 0);
    ctx.lineTo(snap(x), this.height);
    ctx.stroke();
    ctx.setLineDash([]);

    const analysis = this.analysis();
    const offset = Math.max(this.span() / 900, 1e-7);
    const markers: { value: number | null; color: string; dx: number }[] = [
      { value: analysis?.leftLimit ?? null, color: COLORS.left, dx: point - offset },
      { value: analysis?.rightLimit ?? null, color: COLORS.right, dx: point + offset },
    ];

    for (const marker of markers) {
      if (marker.value === null || !Number.isFinite(marker.value)) {
        continue;
      }
      const markerX = this.px(bounds, marker.dx);
      const markerY = this.py(bounds, marker.value);
      if (markerY < -20 || markerY > this.height + 20) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(markerX, markerY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = marker.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(8, 13, 26, 0.95)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (analysis?.valueAtPoint !== null && analysis?.valueAtPoint !== undefined) {
      const y = this.py(bounds, analysis.valueAtPoint);
      if (y >= -20 && y <= this.height + 20) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.point;
        ctx.fill();
        ctx.strokeStyle = 'rgba(8, 13, 26, 0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (analysis?.twoSidedLimit !== null && analysis?.twoSidedLimit !== undefined) {
      ctx.beginPath();
      ctx.arc(x, this.py(bounds, analysis.twoSidedLimit), 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#080d19';
      ctx.fill();
      ctx.strokeStyle = COLORS.point;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }
}
