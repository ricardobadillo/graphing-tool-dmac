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
import type { Vec2 } from '../linear/linear';
import {
  gradientDescent,
  linearProgramming,
  objectiveValue,
  type Constraint,
  type ObjectiveKey,
  type OptimizationSense,
} from './optimization';

type Mode = 'linear' | 'gradient';

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
  grid: 'rgba(148, 163, 184, 0.12)',
  axis: 'rgba(226, 232, 240, 0.6)',
  text: 'rgba(203, 213, 225, 0.85)',
  feasible: 'rgba(56, 189, 248, 0.13)',
  feasibleStroke: 'rgba(56, 189, 248, 0.75)',
  objective: '#fbbf24',
  optimum: '#a78bfa',
  path: '#fbbf24',
};

const CONSTRAINT_COLORS = ['#38bdf8', '#f472b6', '#34d399'];

@Component({
  selector: 'app-optimization-explorer',
  templateUrl: './optimization-explorer.html',
  styleUrl: './optimization-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptimizationExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>('linear');
  readonly objectiveXInput = signal('3');
  readonly objectiveYInput = signal('2');
  readonly sense = signal<OptimizationSense>('max');
  readonly constraintsInput = signal<string[][]>([
    ['2', '1', '8'],
    ['1', '2', '8'],
    ['1', '1', '5'],
  ]);
  readonly objectiveKey = signal<ObjectiveKey>('quadratic');
  readonly learningRateInput = signal('0.08');
  readonly startXInput = signal('-3');
  readonly startYInput = signal('3');

  readonly presets = [
    {
      label: 'Clásico',
      objective: ['3', '2'],
      constraints: [
        ['2', '1', '8'],
        ['1', '2', '8'],
        ['1', '1', '5'],
      ],
    },
    {
      label: 'Fábrica',
      objective: ['5', '4'],
      constraints: [
        ['1', '0', '4'],
        ['0', '1', '3'],
        ['1', '1', '5'],
      ],
    },
    {
      label: 'Vértice',
      objective: ['1', '1'],
      constraints: [
        ['1', '2', '6'],
        ['2', '1', '6'],
        ['1', '1', '4'],
      ],
    },
  ];

  readonly modeInfo = computed(() =>
    this.mode() === 'linear'
      ? {
          label: 'Programación lineal',
          title: 'Región factible y objetivo',
          subtitle: 'Las restricciones recortan el plano; el óptimo está en un vértice.',
          expression: 'max c·x sujeto a A·x ≤ b',
        }
      : {
          label: 'Descenso de gradiente',
          title: 'Buscar el mínimo paso a paso',
          subtitle:
            'El gradiente indica la dirección de máximo crecimiento; bajamos en sentido contrario.',
          expression: 'xₖ₊₁ = xₖ − α∇f(xₖ)',
        },
  );

  readonly parsedConstraints = computed<Constraint[] | null>(() => {
    const constraints: Constraint[] = [];
    for (const row of this.constraintsInput()) {
      const values = row.map((cell) => Number(cell.replace(',', '.')));
      if (values.some((value) => !Number.isFinite(value))) {
        return null;
      }
      constraints.push({ a: values[0], b: values[1], c: values[2] });
    }
    return constraints;
  });

  readonly linearResult = computed(() => {
    const constraints = this.parsedConstraints();
    if (!constraints) {
      return null;
    }
    const objectiveX = Number(this.objectiveXInput().replace(',', '.'));
    const objectiveY = Number(this.objectiveYInput().replace(',', '.'));
    if (!Number.isFinite(objectiveX) || !Number.isFinite(objectiveY)) {
      return null;
    }
    return linearProgramming(constraints, objectiveX, objectiveY, this.sense(), 12, 12);
  });

  readonly linearStats = computed(() => {
    const result = this.linearResult();
    if (!result) {
      return null;
    }
    return {
      feasible: result.polygon.length > 0,
      vertices: result.polygon.length,
      optimum: result.optimum ? this.formatVec(result.optimum) : null,
      value: result.optimumValue === null ? null : this.formatValue(result.optimumValue),
      sense: this.sense() === 'max' ? 'Máximo' : 'Mínimo',
    };
  });

  readonly startPoint = computed<Vec2>(() => ({
    x: Number(this.startXInput().replace(',', '.')),
    y: Number(this.startYInput().replace(',', '.')),
  }));

  readonly learningRate = computed(() =>
    Math.max(0.001, Number(this.learningRateInput().replace(',', '.')) || 0.08),
  );

  readonly descent = computed(() => {
    const start = this.startPoint();
    if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) {
      return null;
    }
    return gradientDescent(this.objectiveKey(), start, this.learningRate(), 60);
  });

  readonly gradientStats = computed(() => {
    const result = this.descent();
    if (!result) {
      return null;
    }
    return {
      final: this.formatVec(result.final),
      value: this.formatValue(result.finalValue),
      gradient: this.formatValue(result.gradientNorm),
      iterations: result.iterations,
    };
  });

  readonly objectiveLabel = computed(() => {
    switch (this.objectiveKey()) {
      case 'quadratic':
        return 'x² + 3y²';
      case 'rotated':
        return '(x + y)² + 0.4(x − y)²';
      case 'rosenbrock':
        return '(1 − x)² + 100(y − x²)²';
    }
  });

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
      this.linearResult();
      this.descent();
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

  setSense(sense: OptimizationSense): void {
    this.sense.set(sense);
  }

  onObjectiveInput(axis: 'x' | 'y', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (axis === 'x') {
      this.objectiveXInput.set(value);
    } else {
      this.objectiveYInput.set(value);
    }
  }

  onConstraintCell(event: Event, row: number, column: number): void {
    const value = (event.target as HTMLInputElement).value;
    const next = this.constraintsInput().map((cells) => cells.slice());
    next[row][column] = value;
    this.constraintsInput.set(next);
  }

  applyPreset(preset: (typeof this.presets)[number]): void {
    this.objectiveXInput.set(preset.objective[0]);
    this.objectiveYInput.set(preset.objective[1]);
    this.constraintsInput.set(preset.constraints.map((row) => row.slice()));
  }

  setObjectiveKey(key: ObjectiveKey): void {
    this.objectiveKey.set(key);
  }

  onLearningRateInput(event: Event): void {
    this.learningRateInput.set((event.target as HTMLInputElement).value);
  }

  onStartInput(axis: 'x' | 'y', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (axis === 'x') {
      this.startXInput.set(value);
    } else {
      this.startYInput.set(value);
    }
  }

  formatValue(value: number, digits = 3): string {
    return formatNumber(value, digits).replace(/-/g, '−');
  }

  formatVec(value: Vec2): string {
    return `(${this.formatValue(value.x)}, ${this.formatValue(value.y)})`;
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

    if (this.mode() === 'linear') {
      this.drawLinear(ctx);
    } else {
      this.drawGradient(ctx);
    }
  }

  private drawLinear(ctx: CanvasRenderingContext2D): void {
    const bounds = this.bounds(0, 12, 0, 12);
    this.drawFrame(ctx, bounds, 2);

    const result = this.linearResult();
    const constraints = this.parsedConstraints();
    if (!result || !constraints) {
      return;
    }

    if (result.polygon.length > 2) {
      ctx.save();
      ctx.beginPath();
      result.polygon.forEach((point, index) => {
        const x = this.px(bounds, point.x);
        const y = this.py(bounds, point.y);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.closePath();
      ctx.fillStyle = COLORS.feasible;
      ctx.fill();
      ctx.strokeStyle = COLORS.feasibleStroke;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }

    constraints.forEach((constraint, index) => {
      this.drawConstraintLine(
        ctx,
        bounds,
        constraint,
        CONSTRAINT_COLORS[index] ?? '#a78bfa',
        `R${index + 1}`,
      );
    });

    const objectiveX = Number(this.objectiveXInput().replace(',', '.'));
    const objectiveY = Number(this.objectiveYInput().replace(',', '.'));
    if (
      result.optimumValue !== null &&
      Number.isFinite(objectiveX) &&
      Number.isFinite(objectiveY)
    ) {
      this.drawObjectiveLine(ctx, bounds, objectiveX, objectiveY, result.optimumValue);
    }

    for (const vertex of result.vertices) {
      this.drawPoint(ctx, bounds, vertex, 'rgba(56, 189, 248, 0.8)', 3);
    }

    if (result.optimum) {
      this.drawPoint(ctx, bounds, result.optimum, COLORS.optimum, 5);
      this.drawLabel(
        ctx,
        bounds,
        result.optimum,
        `óptimo (${this.formatValue(result.optimumValue ?? 0)})`,
        '#c4b5fd',
      );
    }
  }

  private drawConstraintLine(
    ctx: CanvasRenderingContext2D,
    bounds: PlotBounds,
    constraint: Constraint,
    color: string,
    label: string,
  ): void {
    const { a, b, c } = constraint;
    let first: Vec2 | null = null;
    let second: Vec2 | null = null;

    if (Math.abs(b) > 1e-9) {
      first = { x: bounds.xMin, y: (c - a * bounds.xMin) / b };
      second = { x: bounds.xMax, y: (c - a * bounds.xMax) / b };
    } else if (Math.abs(a) > 1e-9) {
      const x = c / a;
      first = { x, y: bounds.yMin };
      second = { x, y: bounds.yMax };
    }

    if (!first || !second) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(this.px(bounds, first.x), this.py(bounds, first.y));
    ctx.lineTo(this.px(bounds, second.x), this.py(bounds, second.y));
    ctx.stroke();
    ctx.restore();

    const labelPoint = {
      x: first.x + (second.x - first.x) * 0.63,
      y: first.y + (second.y - first.y) * 0.63,
    };
    if (this.inside(bounds, labelPoint)) {
      this.drawLabel(ctx, bounds, labelPoint, label, color);
    }
  }

  private drawObjectiveLine(
    ctx: CanvasRenderingContext2D,
    bounds: PlotBounds,
    objectiveX: number,
    objectiveY: number,
    value: number,
  ): void {
    let first: Vec2 | null = null;
    let second: Vec2 | null = null;

    if (Math.abs(objectiveY) > 1e-9) {
      first = { x: bounds.xMin, y: (value - objectiveX * bounds.xMin) / objectiveY };
      second = { x: bounds.xMax, y: (value - objectiveX * bounds.xMax) / objectiveY };
    } else if (Math.abs(objectiveX) > 1e-9) {
      const x = value / objectiveX;
      first = { x, y: bounds.yMin };
      second = { x, y: bounds.yMax };
    }

    if (!first || !second) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(this.px(bounds, first.x), this.py(bounds, first.y));
    ctx.lineTo(this.px(bounds, second.x), this.py(bounds, second.y));
    ctx.stroke();
    ctx.restore();
  }

  private drawGradient(ctx: CanvasRenderingContext2D): void {
    const bounds = this.bounds(-4.5, 4.5, -4.5, 4.5);
    this.drawHeatmap(ctx, bounds);
    this.drawFrame(ctx, bounds, 1);

    const result = this.descent();
    if (!result) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    ctx.clip();
    ctx.strokeStyle = COLORS.path;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    result.path.forEach((point, index) => {
      const x = this.px(bounds, point.x);
      const y = this.py(bounds, point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    ctx.restore();

    this.drawPoint(ctx, bounds, result.path[0], '#f472b6', 4.5);
    this.drawLabel(ctx, bounds, result.path[0], 'inicio', '#f9a8d4');
    this.drawPoint(ctx, bounds, result.final, '#34d399', 5);
    this.drawLabel(
      ctx,
      bounds,
      result.final,
      `mínimo (${this.formatValue(result.finalValue)})`,
      '#6ee7b7',
    );
  }

  private drawHeatmap(ctx: CanvasRenderingContext2D, bounds: PlotBounds): void {
    const columns = 96;
    const rows = 68;
    const values: number[][] = [];
    let maximum = 0;

    for (let row = 0; row < rows; row += 1) {
      values[row] = [];
      for (let column = 0; column < columns; column += 1) {
        const x = bounds.xMin + ((column + 0.5) / columns) * (bounds.xMax - bounds.xMin);
        const y = bounds.yMax - ((row + 0.5) / rows) * (bounds.yMax - bounds.yMin);
        const value = objectiveValue(this.objectiveKey(), { x, y });
        values[row][column] = Number.isFinite(value) ? value : Number.MAX_VALUE;
        if (values[row][column] < Number.MAX_VALUE) {
          maximum = Math.max(maximum, values[row][column]);
        }
      }
    }

    const cellWidth = bounds.width / columns;
    const cellHeight = bounds.height / rows;
    const scale = Math.log1p(Math.max(maximum, 1));

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = values[row][column];
        const normalized = value >= Number.MAX_VALUE ? 1 : Math.log1p(Math.max(0, value)) / scale;
        ctx.fillStyle = `hsl(${255 - 190 * normalized} 72% ${7 + 38 * normalized}%)`;
        ctx.fillRect(
          bounds.left + column * cellWidth,
          bounds.top + row * cellHeight,
          cellWidth + 0.5,
          cellHeight + 0.5,
        );
      }
    }
  }

  private drawFrame(ctx: CanvasRenderingContext2D, bounds: PlotBounds, step: number): void {
    ctx.save();
    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = COLORS.text;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let value = Math.ceil(bounds.xMin / step) * step; value <= bounds.xMax; value += step) {
      const x = this.px(bounds, value);
      ctx.moveTo(x, bounds.top);
      ctx.lineTo(x, bounds.top + bounds.height);
    }
    for (let value = Math.ceil(bounds.yMin / step) * step; value <= bounds.yMax; value += step) {
      const y = this.py(bounds, value);
      ctx.moveTo(bounds.left, y);
      ctx.lineTo(bounds.left + bounds.width, y);
    }
    ctx.stroke();

    if (bounds.xMin <= 0 && bounds.xMax >= 0 && bounds.yMin <= 0 && bounds.yMax >= 0) {
      ctx.strokeStyle = COLORS.axis;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(this.px(bounds, 0), bounds.top);
      ctx.lineTo(this.px(bounds, 0), bounds.top + bounds.height);
      ctx.moveTo(bounds.left, this.py(bounds, 0));
      ctx.lineTo(bounds.left + bounds.width, this.py(bounds, 0));
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let value = Math.ceil(bounds.xMin / step) * step; value <= bounds.xMax; value += step) {
      if (Math.abs(value) < 1e-9) {
        continue;
      }
      const x = this.px(bounds, value);
      if (x < bounds.left + 8 || x > bounds.left + bounds.width - 8) {
        continue;
      }
      ctx.fillText(this.tickLabel(value, step), x, bounds.top + bounds.height + 7);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let value = Math.ceil(bounds.yMin / step) * step; value <= bounds.yMax; value += step) {
      if (Math.abs(value) < 1e-9) {
        continue;
      }
      const y = this.py(bounds, value);
      if (y < bounds.top + 8 || y > bounds.top + bounds.height - 8) {
        continue;
      }
      ctx.fillText(this.tickLabel(value, step), bounds.left - 7, y);
    }
    ctx.restore();
  }

  private drawPoint(
    ctx: CanvasRenderingContext2D,
    bounds: PlotBounds,
    point: Vec2,
    color: string,
    radius: number,
  ): void {
    const x = this.px(bounds, point.x);
    const y = this.py(bounds, point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(8, 13, 25, 0.95)';
    ctx.stroke();
    ctx.restore();
  }

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    bounds: PlotBounds,
    point: Vec2,
    label: string,
    color: string,
  ): void {
    const x = this.px(bounds, point.x);
    const y = this.py(bounds, point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    if (x < bounds.left || x > bounds.left + bounds.width) {
      return;
    }
    if (y < bounds.top || y > bounds.top + bounds.height) {
      return;
    }
    ctx.save();
    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8, 13, 25, 0.9)';
    ctx.strokeText(label, x + 8, y - 8);
    ctx.fillStyle = color;
    ctx.fillText(label, x + 8, y - 8);
    ctx.restore();
  }

  private inside(bounds: PlotBounds, point: Vec2): boolean {
    return (
      point.x >= bounds.xMin &&
      point.x <= bounds.xMax &&
      point.y >= bounds.yMin &&
      point.y <= bounds.yMax
    );
  }

  private bounds(xMin: number, xMax: number, yMin: number, yMax: number): PlotBounds {
    const left = 48;
    const right = 18;
    const top = 20;
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
    return formatDecimal(value, step < 1 ? 2 : 1);
  }
}
