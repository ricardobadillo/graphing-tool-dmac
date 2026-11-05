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
import { clamp, niceStep } from '../shared/math-utils';
import { formatDecimal, formatExact } from '../shared/exact-number';
import {
  binomialPmf,
  binomialStats,
  intervalProbability,
  normalPdf,
  normalStats,
  poissonPmf,
  poissonStats,
  simulateMeans,
  type BaseDistribution,
  type Distribution,
} from './statistics';

type Mode = 'distribution' | 'clt';

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

interface BarPoint {
  x: number;
  value: number;
}

interface HistogramResult {
  bars: BarPoint[];
  binWidth: number;
  xMin: number;
  xMax: number;
  yMax: number;
  normal: { x: number; y: number }[];
}

const COLORS = {
  primary: '#38bdf8',
  normal: '#a78bfa',
  accent: '#fbbf24',
  muted: 'rgba(148, 163, 184, 0.75)',
  grid: 'rgba(148, 163, 184, 0.09)',
  axis: 'rgba(226, 232, 240, 0.5)',
  text: 'rgba(203, 213, 225, 0.82)',
};

@Component({
  selector: 'app-statistics-explorer',
  templateUrl: './statistics-explorer.html',
  styleUrl: './statistics-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>('distribution');
  readonly distribution = signal<Distribution>('normal');
  readonly modeInfo = computed(() =>
    this.mode() === 'distribution'
      ? {
          label: 'Distribuciones',
          title: 'Modelos de probabilidad',
          subtitle: 'Ajusta los parámetros y observa la función de masa o densidad.',
          expression: 'f(x) · P(a ≤ X ≤ b)',
        }
      : {
          label: 'Teorema central del límite',
          title: 'Medias muestrales',
          subtitle: 'Muchas muestras de tamaño n: las medias se aproximan a una normal.',
          expression: 'X̄ ≈ N(μ, σ/√n)',
        },
  );
  readonly normalMeanInput = signal('0');
  readonly normalSdInput = signal('1');
  readonly binomialNInput = signal('10');
  readonly binomialPInput = signal('0.4');
  readonly poissonLambdaInput = signal('3');
  readonly lowerInput = signal('-1');
  readonly upperInput = signal('1');

  readonly base = signal<BaseDistribution>('uniform');
  readonly sampleSize = signal(10);
  readonly seed = signal(1);

  readonly normalMean = computed(() => this.numberOr(this.normalMeanInput(), 0));
  readonly normalSd = computed(() => Math.max(0.01, this.numberOr(this.normalSdInput(), 1)));
  readonly binomialN = computed(() =>
    clamp(Math.round(this.numberOr(this.binomialNInput(), 10)), 1, 60),
  );
  readonly binomialP = computed(() =>
    clamp(this.numberOr(this.binomialPInput(), 0.4), 0.001, 0.999),
  );
  readonly poissonLambda = computed(() =>
    Math.max(0.05, this.numberOr(this.poissonLambdaInput(), 3)),
  );

  readonly distributionLabel = computed(() => {
    switch (this.distribution()) {
      case 'normal':
        return 'Normal';
      case 'binomial':
        return 'Binomial';
      case 'poisson':
        return 'Poisson';
    }
  });

  readonly stats = computed(() => {
    switch (this.distribution()) {
      case 'normal':
        return normalStats(this.normalMean(), this.normalSd());
      case 'binomial':
        return binomialStats(this.binomialN(), this.binomialP());
      case 'poisson':
        return poissonStats(this.poissonLambda());
    }
  });

  readonly intervalLabel = computed(() => {
    const lower = this.numberOr(this.lowerInput(), 0);
    const upper = this.numberOr(this.upperInput(), 0);
    return `P(${this.formatValue(lower)} ≤ X ≤ ${this.formatValue(upper)})`;
  });

  readonly intervalValue = computed(() => {
    const lower = this.numberOr(this.lowerInput(), 0);
    const upper = this.numberOr(this.upperInput(), 0);
    return intervalProbability(
      this.distribution(),
      {
        mean: this.normalMean(),
        sd: this.normalSd(),
        n: this.binomialN(),
        p: this.binomialP(),
        lambda: this.poissonLambda(),
      },
      lower,
      upper,
    );
  });

  readonly distributionRange = computed(() => {
    switch (this.distribution()) {
      case 'normal':
        return {
          xMin: this.normalMean() - 4 * this.normalSd(),
          xMax: this.normalMean() + 4 * this.normalSd(),
          yMax: normalPdf(this.normalMean(), this.normalMean(), this.normalSd()) * 1.2,
        };
      case 'binomial': {
        let max = 0;
        for (let k = 0; k <= this.binomialN(); k += 1) {
          max = Math.max(max, binomialPmf(this.binomialN(), k, this.binomialP()));
        }
        return { xMin: -0.5, xMax: this.binomialN() + 0.5, yMax: max * 1.25 };
      }
      case 'poisson': {
        const maxK = Math.max(
          8,
          Math.ceil(this.poissonLambda() + 4 * Math.sqrt(this.poissonLambda())),
        );
        let max = 0;
        for (let k = 0; k <= maxK; k += 1) {
          max = Math.max(max, poissonPmf(this.poissonLambda(), k));
        }
        return { xMin: -0.5, xMax: maxK + 0.5, yMax: max * 1.25 };
      }
    }
  });

  readonly normalCurve = computed(() => {
    if (this.distribution() !== 'normal') {
      return [];
    }
    const range = this.distributionRange();
    return Array.from({ length: 241 }, (_, index) => {
      const x = range.xMin + ((range.xMax - range.xMin) * index) / 240;
      return { x, y: normalPdf(x, this.normalMean(), this.normalSd()) };
    });
  });

  readonly discreteBars = computed<BarPoint[]>(() => {
    if (this.distribution() === 'binomial') {
      return Array.from({ length: this.binomialN() + 1 }, (_, k) => ({
        x: k,
        value: binomialPmf(this.binomialN(), k, this.binomialP()),
      }));
    }
    if (this.distribution() === 'poisson') {
      const maxK = Math.ceil(this.distributionRange().xMax);
      return Array.from({ length: Math.max(1, maxK + 1) }, (_, k) => ({
        x: k,
        value: poissonPmf(this.poissonLambda(), k),
      }));
    }
    return [];
  });

  readonly clt = computed(() => simulateMeans(this.base(), this.sampleSize(), 2000, this.seed()));

  readonly histogram = computed<HistogramResult>(() => {
    const result = this.clt();
    const means = result.means;
    let dataMin = Math.min(...means);
    let dataMax = Math.max(...means);
    if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax) || dataMax - dataMin < 1e-9) {
      dataMin -= 0.05;
      dataMax += 0.05;
    }
    const padding = (dataMax - dataMin) * 0.08;
    const xMin = dataMin - padding;
    const xMax = dataMax + padding;
    const bins = 34;
    const binWidth = (xMax - xMin) / bins;
    const bars: BarPoint[] = [];

    for (let index = 0; index < bins; index += 1) {
      const start = xMin + index * binWidth;
      const end = start + binWidth;
      const center = (start + end) / 2;
      const count = means.filter((value) => value >= start && value < end).length;
      bars.push({ x: center, value: count });
    }

    const yMax = Math.max(...bars.map((bar) => bar.value), 1);
    const normal = Array.from({ length: 161 }, (_, index) => {
      const x = xMin + ((xMax - xMin) * index) / 160;
      return {
        x,
        y: normalPdf(x, result.theoreticalMean, result.theoreticalSd) * means.length * binWidth,
      };
    });

    return { bars, binWidth, xMin, xMax, yMax: yMax * 1.2, normal };
  });

  readonly canvasSize = signal({ w: 0, h: 0 });

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
      this.distribution();
      this.distributionRange();
      this.normalCurve();
      this.discreteBars();
      this.histogram();
      this.canvasSize();
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
        onResize: (size) => this.canvasSize.set(size),
      });
      this.surface.resize();

      this.destroyRef.onDestroy(() => this.surface?.destroy());
    });
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  setDistribution(distribution: Distribution): void {
    this.distribution.set(distribution);
    if (distribution === 'normal') {
      this.lowerInput.set(formatDecimal(this.normalMean() - this.normalSd(), 2));
      this.upperInput.set(formatDecimal(this.normalMean() + this.normalSd(), 2));
    } else if (distribution === 'binomial') {
      this.lowerInput.set('0');
      this.upperInput.set(String(this.binomialN()));
    } else {
      this.lowerInput.set('0');
      this.upperInput.set(
        String(Math.ceil(this.poissonLambda() + Math.sqrt(this.poissonLambda()))),
      );
    }
  }

  setBase(base: BaseDistribution): void {
    this.base.set(base);
  }

  onNumberInput(
    target:
      'normalMean' | 'normalSd' | 'binomialN' | 'binomialP' | 'poissonLambda' | 'lower' | 'upper',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    switch (target) {
      case 'normalMean':
        this.normalMeanInput.set(value);
        break;
      case 'normalSd':
        this.normalSdInput.set(value);
        break;
      case 'binomialN':
        this.binomialNInput.set(value);
        break;
      case 'binomialP':
        this.binomialPInput.set(value);
        break;
      case 'poissonLambda':
        this.poissonLambdaInput.set(value);
        break;
      case 'lower':
        this.lowerInput.set(value);
        break;
      case 'upper':
        this.upperInput.set(value);
        break;
    }
  }

  onSampleSizeInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.sampleSize.set(clamp(Math.round(value), 1, 50));
    }
  }

  resample(): void {
    this.seed.update((value) => value + 1);
  }

  formatValue(value: number, digits = 3): string {
    return formatExact(value, { digits });
  }

  private numberOr(text: string, fallback: number): number {
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) ? value : fallback;
  }

  private resize(): void {
    this.surface?.resize();
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

    if (this.mode() === 'distribution') {
      this.drawDistribution(ctx);
    } else {
      this.drawHistogram(ctx);
    }
  }

  private drawDistribution(ctx: CanvasRenderingContext2D): void {
    const range = this.distributionRange();
    const bounds = this.bounds(range.xMin, range.xMax, 0, range.yMax);
    this.drawFrame(ctx, bounds, this.distribution() !== 'normal');

    const lower = this.numberOr(this.lowerInput(), 0);
    const upper = this.numberOr(this.upperInput(), 0);
    const low = Math.min(lower, upper);
    const high = Math.max(lower, upper);

    if (this.distribution() === 'normal') {
      this.fillNormalInterval(ctx, bounds, this.normalCurve(), low, high);
      this.drawCurve(ctx, bounds, this.normalCurve(), COLORS.normal);
      const meanX = this.px(bounds, this.normalMean());
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(meanX, bounds.top);
      ctx.lineTo(meanX, bounds.top + bounds.height);
      ctx.stroke();
      ctx.restore();
    } else {
      const bars = this.discreteBars();
      const slot = bounds.width / Math.max(1, range.xMax - range.xMin);
      const width = Math.max(2, slot * 0.62);
      for (const bar of bars) {
        const x = this.px(bounds, bar.x);
        const height = (bar.value / range.yMax) * bounds.height;
        const inInterval = bar.x >= low && bar.x <= high;
        ctx.fillStyle = inInterval ? 'rgba(56, 189, 248, 0.75)' : 'rgba(56, 189, 248, 0.25)';
        ctx.fillRect(x - width / 2, bounds.top + bounds.height - height, width, height);
      }
    }
  }

  private drawHistogram(ctx: CanvasRenderingContext2D): void {
    const histogram = this.histogram();
    const bounds = this.bounds(histogram.xMin, histogram.xMax, 0, histogram.yMax);
    this.drawFrame(ctx, bounds, false);

    const width = (bounds.width / histogram.bars.length) * 0.78;
    for (const bar of histogram.bars) {
      const x = this.px(bounds, bar.x);
      const height = (bar.value / histogram.yMax) * bounds.height;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.fillRect(x - width / 2, bounds.top + bounds.height - height, width, height);
    }

    this.drawCurve(ctx, bounds, histogram.normal, COLORS.accent);
  }

  private fillNormalInterval(
    ctx: CanvasRenderingContext2D,
    bounds: PlotBounds,
    curve: { x: number; y: number }[],
    low: number,
    high: number,
  ): void {
    const points = curve.filter((point) => point.x >= low && point.x <= high);
    if (points.length < 2) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(this.px(bounds, points[0].x), this.py(bounds, 0));
    for (const point of points) {
      ctx.lineTo(this.px(bounds, point.x), this.py(bounds, point.y));
    }
    ctx.lineTo(this.px(bounds, points[points.length - 1].x), this.py(bounds, 0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.fill();
    ctx.restore();
  }

  private bounds(xMin: number, xMax: number, yMin: number, yMax: number): PlotBounds {
    const left = 52;
    const right = 18;
    const top = 22;
    const bottom = 34;
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

  private drawFrame(ctx: CanvasRenderingContext2D, bounds: PlotBounds, integerX: boolean): void {
    const xStep = integerX
      ? Math.max(1, Math.ceil((bounds.xMax - bounds.xMin) / 10))
      : niceStep((bounds.xMax - bounds.xMin) / 8);
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

    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const axisY = this.py(bounds, 0);
    ctx.moveTo(bounds.left, axisY);
    ctx.lineTo(bounds.left + bounds.width, axisY);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let value = Math.ceil(bounds.xMin / xStep) * xStep; value <= bounds.xMax; value += xStep) {
      const x = this.px(bounds, value);
      if (x < bounds.left + 8 || x > bounds.left + bounds.width - 8) {
        continue;
      }
      ctx.fillText(this.tickLabel(value, xStep), x, bounds.top + bounds.height + 7);
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

  private drawCurve(
    ctx: CanvasRenderingContext2D,
    bounds: PlotBounds,
    points: { x: number; y: number }[],
    color: string,
  ): void {
    if (points.length === 0) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = this.px(bounds, point.x);
      const y = this.py(bounds, point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
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
