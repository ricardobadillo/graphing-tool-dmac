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
import { formatNumber } from '../complex/complex';
import { formatDecimal } from '../number-format';
import {
  fourierPartial,
  fourierTerms,
  sampleCurve,
  taylorSeries,
  taylorValue,
  waveFormula,
  waveLabel,
  waveTarget,
  type CurvePoint,
  type Wave,
} from './analysis';

type Mode = 'taylor' | 'fourier';

interface PlotBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

const COLORS = {
  original: '#38bdf8',
  approximation: '#a78bfa',
  target: 'rgba(148, 163, 184, 0.75)',
  grid: 'rgba(148, 163, 184, 0.09)',
  axis: 'rgba(226, 232, 240, 0.5)',
  text: 'rgba(203, 213, 225, 0.82)',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function niceStep(target: number): number {
  const raw = Math.max(target, Number.MIN_VALUE);
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const factor = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return factor * power;
}

@Component({
  selector: 'app-analysis-explorer',
  templateUrl: './analysis-explorer.html',
  styleUrl: './analysis-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>('taylor');
  readonly expression = signal('sin(x)');
  readonly centerInput = signal('0');
  readonly degree = signal(5);
  readonly wave = signal<Wave>('square');
  readonly harmonics = signal(8);

  readonly presets = ['sin(x)', 'e^x', 'ln(1+x)', '1/(1-x)'];

  readonly modeInfo = computed(() =>
    this.mode() === 'taylor'
      ? {
          label: 'Serie de Taylor',
          title: 'Aproximaciones locales',
          subtitle: 'La curva azul es f(x); la violeta es el polinomio de Taylor.',
          expression: 'Tₙ(x) = Σ f⁽ᵏ⁾(a)(x − a)ᵏ/k!',
        }
      : {
          label: 'Serie de Fourier',
          title: 'Ondas como suma de senos',
          subtitle: 'La curva gris es la onda objetivo; la violeta es la suma parcial.',
          expression: 'f(x) ≈ Σ aₖ sen(kx)',
        },
  );

  readonly taylorResult = computed(() => {
    const center = Number(this.centerInput());
    if (!Number.isFinite(center)) {
      return { coefficients: null, error: 'El centro debe ser un número.' };
    }
    return taylorSeries(this.expression(), center, this.degree());
  });

  readonly centerValue = computed(() => Number(this.centerInput()));

  readonly taylorRange = computed(() => {
    const center = this.centerValue();
    if (!Number.isFinite(center)) {
      return { xMin: -5, xMax: 5 };
    }
    return { xMin: center - 5, xMax: center + 5 };
  });

  readonly originalCurve = computed(() => {
    const range = this.taylorRange();
    return sampleCurve(this.expression(), range.xMin, range.xMax, 360);
  });

  readonly taylorCurve = computed(() => {
    const result = this.taylorResult();
    const coefficients = result.coefficients;
    if (!coefficients) {
      return [] as CurvePoint[];
    }
    const range = this.taylorRange();
    const center = this.centerValue();
    return Array.from({ length: 361 }, (_, index) => {
      const x = range.xMin + ((range.xMax - range.xMin) * index) / 360;
      const y = taylorValue(coefficients, center, x);
      return { x, y: Number.isFinite(y) ? y : null };
    });
  });

  readonly taylorBounds = computed(() => {
    const values: number[] = [];
    for (const point of this.originalCurve().points) {
      if (point.y !== null && Number.isFinite(point.y)) {
        values.push(Math.abs(point.y));
      }
    }
    for (const point of this.taylorCurve()) {
      if (point.y !== null && Number.isFinite(point.y)) {
        values.push(Math.abs(point.y));
      }
    }
    values.sort((left, right) => left - right);
    const percentile = values[Math.min(values.length - 1, Math.floor(values.length * 0.94))] ?? 1.5;
    const limit = clamp(percentile * 1.15, 1.5, 30);
    return { yMin: -limit, yMax: limit };
  });

  readonly taylorPolynomial = computed(() => {
    const result = this.taylorResult();
    const coefficients = result.coefficients;
    if (!coefficients) {
      return '—';
    }
    const center = this.centerValue();
    const terms: string[] = [];

    coefficients.forEach((coefficient, index) => {
      if (Math.abs(coefficient) < 1e-9) {
        return;
      }
      const value = this.formatValue(Math.abs(coefficient), 4);
      const sign = coefficient < 0 ? '−' : terms.length === 0 ? '' : '+';
      let factor: string;
      if (index === 0) {
        factor = '';
      } else if (index === 1) {
        factor =
          center === 0
            ? 'x'
            : `(x ${center > 0 ? '−' : '+'} ${this.formatValue(Math.abs(center))})`;
      } else {
        factor =
          center === 0
            ? `x^${index}`
            : `(x ${center > 0 ? '−' : '+'} ${this.formatValue(Math.abs(center))})^${index}`;
      }

      if (index === 0) {
        terms.push(`${sign}${value}`);
      } else if (Math.abs(Math.abs(coefficient) - 1) < 1e-9) {
        terms.push(`${sign}${factor}`);
      } else {
        terms.push(`${sign}${value}·${factor}`);
      }
    });

    return terms.length > 0 ? terms.join(' ') : '0';
  });

  readonly taylorRow = computed(() => {
    const result = this.taylorResult();
    if (!result.coefficients) {
      return [];
    }
    return result.coefficients.map((value, index) => ({
      order: index,
      value: this.formatValue(value, 5),
    }));
  });

  readonly fourierTermsList = computed(() => fourierTerms(this.wave(), this.harmonics()));

  readonly fourierFormula = computed(() => waveFormula(this.wave()));
  readonly waveName = computed(() => waveLabel(this.wave()));

  readonly canvasSize = signal({ w: 0, h: 0 });
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private fallback = 0;

  constructor() {
    effect(() => {
      this.mode();
      this.expression();
      this.centerInput();
      this.degree();
      this.wave();
      this.harmonics();
      this.canvasSize();
      this.scheduleDraw();
    });

    afterNextRender(() => {
      if (typeof CanvasRenderingContext2D === 'undefined') {
        return;
      }

      const canvas = this.canvasRef().nativeElement;
      const container = canvas.parentElement;
      this.ctx = canvas.getContext('2d');

      if (container && typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(container);
      }

      this.resize();

      this.destroyRef.onDestroy(() => {
        this.resizeObserver?.disconnect();
        cancelAnimationFrame(this.frame);
        cancelAnimationFrame(this.fallback);
      });
    });
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  onExpressionInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
  }

  applyPreset(value: string): void {
    this.expression.set(value);
  }

  onCenterInput(event: Event): void {
    this.centerInput.set((event.target as HTMLInputElement).value);
  }

  onDegreeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.degree.set(clamp(Math.round(value), 0, 10));
    }
  }

  setWave(wave: Wave): void {
    this.wave.set(wave);
  }

  onHarmonicsInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.harmonics.set(clamp(Math.round(value), 1, 20));
    }
  }

  formatValue(value: number, digits = 2): string {
    return formatNumber(value, digits).replace(/-/g, '−');
  }

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    const container = canvas.parentElement;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

    if (width === this.width && height === this.height && dpr === this.dpr) {
      return;
    }

    this.width = width;
    this.height = height;
    this.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    this.canvasSize.set({ w: width, h: height });
    this.scheduleDraw();
  }

  private scheduleDraw(): void {
    if (!this.ctx || this.frame) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      cancelAnimationFrame(this.frame);
      clearTimeout(this.fallback);
      this.frame = 0;
      this.fallback = 0;
      this.draw();
    });
    this.fallback = window.setTimeout(() => {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.fallback = 0;
      this.draw();
    }, 90);
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    if (this.mode() === 'taylor') {
      this.drawTaylor(ctx);
    } else {
      this.drawFourier(ctx);
    }
  }

  private drawTaylor(ctx: CanvasRenderingContext2D): void {
    const range = this.taylorRange();
    const vertical = this.taylorBounds();
    const bounds = this.bounds(range.xMin, range.xMax, vertical.yMin, vertical.yMax);
    this.drawGrid(ctx, bounds);
    this.drawAxes(ctx, bounds);

    const center = this.centerValue();
    if (Number.isFinite(center) && center > bounds.xMin && center < bounds.xMax) {
      const x = this.px(bounds, center);
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, bounds.top);
      ctx.lineTo(x, bounds.top + bounds.height);
      ctx.stroke();
      ctx.restore();
    }

    this.drawCurve(ctx, bounds, this.originalCurve().points, COLORS.original, []);
    this.drawCurve(ctx, bounds, this.taylorCurve(), COLORS.approximation, []);
  }

  private drawFourier(ctx: CanvasRenderingContext2D): void {
    const xMin = -2 * Math.PI;
    const xMax = 2 * Math.PI;
    const bounds = this.bounds(xMin, xMax, -1.7, 1.7);
    this.drawGrid(ctx, bounds);
    this.drawAxes(ctx, bounds);

    const target: CurvePoint[] = [];
    const partial: CurvePoint[] = [];
    for (let index = 0; index <= 640; index += 1) {
      const x = xMin + ((xMax - xMin) * index) / 640;
      target.push({ x, y: waveTarget(this.wave(), x) });
      partial.push({ x, y: fourierPartial(this.wave(), this.harmonics(), x) });
    }

    this.drawCurve(ctx, bounds, target, COLORS.target, [5, 5]);
    this.drawCurve(ctx, bounds, partial, COLORS.approximation, []);
  }

  private bounds(xMin: number, xMax: number, yMin: number, yMax: number): PlotBounds {
    const left = 48;
    const right = 16;
    const top = 20;
    const bottom = 32;
    return {
      xMin,
      xMax,
      yMin,
      yMax,
      left,
      top,
      width: Math.max(1, this.width - left - right),
      height: Math.max(1, this.height - top - bottom),
    };
  }

  private drawGrid(ctx: CanvasRenderingContext2D, bounds: PlotBounds): void {
    const xStep = niceStep((bounds.xMax - bounds.xMin) / 8);
    const yStep = niceStep((bounds.yMax - bounds.yMin) / 6);

    ctx.save();
    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = COLORS.text;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let value = Math.ceil(bounds.xMin / xStep) * xStep; value <= bounds.xMax; value += xStep) {
      const x = this.px(bounds, value);
      ctx.moveTo(x, bounds.top);
      ctx.lineTo(x, bounds.top + bounds.height);
    }
    for (let value = Math.ceil(bounds.yMin / yStep) * yStep; value <= bounds.yMax; value += yStep) {
      const y = this.py(bounds, value);
      ctx.moveTo(bounds.left, y);
      ctx.lineTo(bounds.left + bounds.width, y);
    }
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let value = Math.ceil(bounds.xMin / xStep) * xStep; value <= bounds.xMax; value += xStep) {
      if (Math.abs(value) < 1e-9) {
        continue;
      }
      const x = this.px(bounds, value);
      if (x < bounds.left + 10 || x > bounds.left + bounds.width - 10) {
        continue;
      }
      ctx.fillText(this.tickLabel(value, xStep), x, bounds.top + bounds.height + 6);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let value = Math.ceil(bounds.yMin / yStep) * yStep; value <= bounds.yMax; value += yStep) {
      if (Math.abs(value) < 1e-9) {
        continue;
      }
      const y = this.py(bounds, value);
      if (y < bounds.top + 8 || y > bounds.top + bounds.height - 8) {
        continue;
      }
      ctx.fillText(this.tickLabel(value, yStep), bounds.left - 7, y);
    }
    ctx.restore();
  }

  private drawAxes(ctx: CanvasRenderingContext2D, bounds: PlotBounds): void {
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (bounds.yMin <= 0 && bounds.yMax >= 0) {
      const y = this.py(bounds, 0);
      ctx.moveTo(bounds.left, y);
      ctx.lineTo(bounds.left + bounds.width, y);
    }
    if (bounds.xMin <= 0 && bounds.xMax >= 0) {
      const x = this.px(bounds, 0);
      ctx.moveTo(x, bounds.top);
      ctx.lineTo(x, bounds.top + bounds.height);
    }
    ctx.stroke();

    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (bounds.yMin <= 0 && bounds.yMax >= 0) {
      const y = this.py(bounds, 0);
      ctx.fillText('0', this.px(bounds, 0) - 8, y + 5);
      ctx.textAlign = 'right';
      ctx.fillText('x', bounds.left + bounds.width - 6, y - 14);
    }
    if (bounds.xMin <= 0 && bounds.xMax >= 0) {
      const x = this.px(bounds, 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('y', x + 7, bounds.top + 4);
    }
    ctx.restore();
  }

  private drawCurve(
    ctx: CanvasRenderingContext2D,
    bounds: PlotBounds,
    points: CurvePoint[],
    color: string,
    dash: number[],
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let drawing = false;

    for (const point of points) {
      if (point.y === null || !Number.isFinite(point.y)) {
        drawing = false;
        continue;
      }
      const x = this.px(bounds, point.x);
      const y = this.py(bounds, point.y);
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private px(bounds: PlotBounds, value: number): number {
    return bounds.left + ((value - bounds.xMin) / (bounds.xMax - bounds.xMin)) * bounds.width;
  }

  private py(bounds: PlotBounds, value: number): number {
    return bounds.top + ((bounds.yMax - value) / (bounds.yMax - bounds.yMin)) * bounds.height;
  }

  private tickLabel(value: number, step: number): string {
    if (Math.abs(value) < 1e-9) {
      return '0';
    }
    if (Math.abs(value) >= 1000 || Math.abs(value) < 0.001) {
      return value.toExponential(1);
    }
    return formatDecimal(value, step < 1 ? 2 : 1);
  }
}
