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
import { evaluateAt } from '../graphing/expression';
import { formatDecimal } from '../number-format';
import {
  CONVERGENCE_N,
  RIEMANN_METHODS,
  compileCalculusFunction,
  formatCalc,
  methodInfo as getMethodInfo,
  numericDerivative,
  riemannConvergence,
  riemannSum,
  type RiemannMethod,
} from './calculus';
import { compileCurve, sampleParametric, samplePolar, type CurvePoint } from './curves';

type Mode = 'derivative' | 'riemann' | 'polar' | 'parametric';

const MIN_PIXELS_PER_UNIT = 0.001;
const MAX_PIXELS_PER_UNIT = 200_000;
const GRID_TARGET_PX = 84;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapToPixel(value: number): number {
  return Math.round(value) + 0.5;
}

function niceStep(target: number): number {
  const raw = Math.max(target, Number.MIN_VALUE);
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const factor = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return factor * power;
}

interface Point {
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

@Component({
  selector: 'app-calculus-explorer',
  templateUrl: './calculus-explorer.html',
  styleUrl: './calculus-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalculusExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>('derivative');
  readonly expression = signal('x^2 / 4');
  readonly calculus = computed(() => compileCalculusFunction(this.expression()));

  readonly x0 = signal(2);
  readonly h = signal(1);
  readonly showTangent = signal(true);
  readonly showSecant = signal(true);
  readonly showDerivativeCurve = signal(false);

  readonly a = signal(0);
  readonly b = signal(4);
  readonly n = signal(8);
  readonly method = signal<RiemannMethod>('midpoint');
  readonly methods = RIEMANN_METHODS;
  readonly convergenceSteps = CONVERGENCE_N;

  readonly polarExpression = signal('1 + cos(theta)');
  readonly thetaMin = signal(0);
  readonly thetaMax = signal(2 * Math.PI);
  readonly paramXExpression = signal('3 * cos(t)');
  readonly paramYExpression = signal('2 * sin(2 * t)');
  readonly tMin = signal(0);
  readonly tMax = signal(2 * Math.PI);

  readonly polar = computed(() => compileCurve(this.polarExpression(), 'theta'));
  readonly paramX = computed(() => compileCurve(this.paramXExpression(), 't'));
  readonly paramY = computed(() => compileCurve(this.paramYExpression(), 't'));

  readonly curveError = computed(() => {
    switch (this.mode()) {
      case 'derivative':
      case 'riemann':
        return this.calculus().error;
      case 'polar':
        return this.polar().error;
      case 'parametric':
        return this.paramX().error ?? this.paramY().error;
    }
  });

  readonly polarRangeValid = computed(() => this.thetaMax() > this.thetaMin());
  readonly parametricRangeValid = computed(() => this.tMax() > this.tMin());

  readonly center = signal<Point>({ x: 2, y: 2 });
  readonly pixelsPerUnit = signal(50);
  readonly size = signal<Size>({ w: 0, h: 0 });
  readonly dragging = signal(false);

  readonly fValue = computed(() => {
    const fn = this.calculus().compiled;
    return fn ? evaluateAt(fn, this.x0()) : Number.NaN;
  });

  readonly slope = computed(() => {
    const fn = this.calculus().compiled;
    return fn ? numericDerivative(fn, this.x0()) : Number.NaN;
  });

  readonly secantSlope = computed(() => {
    const fn = this.calculus().compiled;
    if (!fn) {
      return Number.NaN;
    }
    const x1 = this.x0() + this.h();
    const y0 = evaluateAt(fn, this.x0());
    const y1 = evaluateAt(fn, x1);
    return (y1 - y0) / (x1 - this.x0());
  });

  readonly tangentEquation = computed(() => {
    const slope = this.slope();
    const value = this.fValue();
    if (!Number.isFinite(slope) || !Number.isFinite(value)) {
      return '—';
    }
    const sign = slope >= 0 ? '+' : '−';
    return `y = ${formatCalc(value, 3)} ${sign} ${formatCalc(Math.abs(slope), 3)}·(x − ${formatCalc(this.x0(), 2)})`;
  });

  readonly x0Range = computed(() => {
    const { w } = this.size();
    const ppu = this.pixelsPerUnit();
    const center = this.center().x;
    const half = w > 0 ? w / (2 * ppu) : 8;
    return { min: center - half, max: center + half };
  });

  readonly riemannResult = computed(() => {
    const fn = this.calculus().compiled;
    return fn ? riemannSum(fn, this.a(), this.b(), this.n(), this.method()) : null;
  });

  readonly intervalReversed = computed(() => this.a() > this.b());

  readonly convergence = computed(() => {
    const fn = this.calculus().compiled;
    return fn ? riemannConvergence(fn, this.a(), this.b(), this.method()) : [];
  });

  readonly rangeLabel = computed(() => {
    const { w, h } = this.size();
    const ppu = this.pixelsPerUnit();
    if (w <= 0 || h <= 0) {
      return '';
    }
    const center = this.center();
    const halfW = w / (2 * ppu);
    const halfH = h / (2 * ppu);
    return `x ∈ [${formatDecimal(center.x - halfW, 2)}, ${formatDecimal(center.x + halfW, 2)}] · y ∈ [${formatDecimal(center.y - halfH, 2)}, ${formatDecimal(center.y + halfH, 2)}]`;
  });

  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private fallback = 0;
  private viewInitialized = false;
  private dragStart: { px: number; py: number; cx: number; cy: number; moved: boolean } | null =
    null;

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    const factor = Math.exp(-event.deltaY * multiplier * 0.0015);
    this.zoomBy(clamp(factor, 0.4, 2.5), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  constructor() {
    effect(() => {
      this.mode();
      this.calculus();
      this.x0();
      this.h();
      this.showTangent();
      this.showSecant();
      this.showDerivativeCurve();
      this.a();
      this.b();
      this.n();
      this.method();
      this.polarExpression();
      this.thetaMin();
      this.thetaMax();
      this.paramXExpression();
      this.paramYExpression();
      this.tMin();
      this.tMax();
      this.center();
      this.pixelsPerUnit();
      this.size();
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

      canvas.addEventListener('wheel', this.onWheel, { passive: false });
      this.resize();
      this.fitView();

      this.destroyRef.onDestroy(() => {
        this.resizeObserver?.disconnect();
        canvas.removeEventListener('wheel', this.onWheel);
        cancelAnimationFrame(this.frame);
        cancelAnimationFrame(this.fallback);
      });
    });
  }

  // ------------------------------------------------------------------ acciones

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.fitView();
  }

  onExpressionInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
  }

  onPolarExpressionInput(event: Event): void {
    this.polarExpression.set((event.target as HTMLInputElement).value);
  }

  onParamXInput(event: Event): void {
    this.paramXExpression.set((event.target as HTMLInputElement).value);
  }

  onParamYInput(event: Event): void {
    this.paramYExpression.set((event.target as HTMLInputElement).value);
  }

  onThetaMinInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.thetaMin.set(value);
    }
  }

  onThetaMaxInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.thetaMax.set(value);
    }
  }

  onTMinInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.tMin.set(value);
    }
  }

  onTMaxInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.tMax.set(value);
    }
  }

  setThetaRange(min: number, max: number): void {
    this.thetaMin.set(min);
    this.thetaMax.set(max);
    this.fitView();
  }

  setTRange(min: number, max: number): void {
    this.tMin.set(min);
    this.tMax.set(max);
    this.fitView();
  }

  setThetaPreset(turns: number): void {
    this.setThetaRange(0, turns * Math.PI * 2);
  }

  setParamPreset(preset: 'full' | 'half' | 'symmetric'): void {
    if (preset === 'half') {
      this.setTRange(0, Math.PI);
    } else if (preset === 'symmetric') {
      this.setTRange(-Math.PI, Math.PI);
    } else {
      this.setTRange(0, Math.PI * 2);
    }
  }

  onX0Input(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.x0.set(value);
    }
  }

  onHInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.h.set(Math.max(0.01, value));
    }
  }

  approachH(): void {
    this.h.update((value) => Math.max(0.01, value / 2));
  }

  toggleTangent(): void {
    this.showTangent.update((value) => !value);
  }

  toggleSecant(): void {
    this.showSecant.update((value) => !value);
  }

  toggleDerivativeCurve(): void {
    this.showDerivativeCurve.update((value) => !value);
  }

  onAInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.a.set(value);
    }
  }

  onBInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.b.set(value);
    }
  }

  onNInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.n.set(clamp(Math.round(value), 1, 200));
    }
  }

  doubleN(): void {
    this.n.update((value) => Math.min(200, value * 2));
  }

  setMethod(method: RiemannMethod): void {
    this.method.set(method);
  }

  format(value: number, digits = 4): string {
    return formatCalc(value, digits);
  }

  methodInfo() {
    return getMethodInfo(this.method());
  }

  fitView(): void {
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) {
      return;
    }

    if (this.mode() === 'polar') {
      const fn = this.polar().compiled;
      const points =
        fn && this.polarRangeValid() ? samplePolar(fn, this.thetaMin(), this.thetaMax(), 700) : [];
      this.fitPoints(points);
      return;
    }

    if (this.mode() === 'parametric') {
      const xFunction = this.paramX().compiled;
      const yFunction = this.paramY().compiled;
      const points =
        xFunction && yFunction && this.parametricRangeValid()
          ? sampleParametric(xFunction, yFunction, this.tMin(), this.tMax(), 700)
          : [];
      this.fitPoints(points);
      return;
    }

    let xMin: number;
    let xMax: number;

    if (this.mode() === 'derivative') {
      xMin = this.x0() - 6;
      xMax = this.x0() + 6;
    } else {
      const lo = Math.min(this.a(), this.b());
      const hi = Math.max(this.a(), this.b());
      xMin = lo - 1;
      xMax = hi + 1;
    }

    if (!(xMax > xMin)) {
      xMin -= 1;
      xMax += 1;
    }

    const fn = this.calculus().compiled;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;

    if (fn) {
      const samples = 240;
      for (let index = 0; index <= samples; index += 1) {
        const x = xMin + ((xMax - xMin) * index) / samples;
        const y = evaluateAt(fn, x);
        if (Number.isFinite(y)) {
          yMin = Math.min(yMin, y);
          yMax = Math.max(yMax, y);
        }
      }
    }

    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -4;
      yMax = 4;
    }

    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);

    let ySpan = yMax - yMin;
    if (ySpan < 0.5) {
      const middle = (yMin + yMax) / 2;
      yMin = middle - 0.25;
      yMax = middle + 0.25;
      ySpan = 0.5;
    }

    const padding = ySpan * 0.15;
    yMin -= padding;
    yMax += padding;

    const ppu = clamp(
      Math.min(w / (xMax - xMin), h / (yMax - yMin)) * 0.88,
      MIN_PIXELS_PER_UNIT,
      MAX_PIXELS_PER_UNIT,
    );

    this.pixelsPerUnit.set(ppu);
    this.center.set({
      x: (xMin + xMax) / 2,
      y: (yMin + yMax) / 2,
    });
  }

  private fitPoints(points: CurvePoint[]): void {
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) {
      return;
    }

    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;

    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        continue;
      }
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
      yMin = Math.min(yMin, point.y);
      yMax = Math.max(yMax, point.y);
    }

    if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) {
      xMin = -4;
      xMax = 4;
      yMin = -4;
      yMax = 4;
    }

    let xSpan = xMax - xMin;
    let ySpan = yMax - yMin;
    if (xSpan < 0.5) {
      const middle = (xMin + xMax) / 2;
      xMin = middle - 0.25;
      xMax = middle + 0.25;
      xSpan = 0.5;
    }
    if (ySpan < 0.5) {
      const middle = (yMin + yMax) / 2;
      yMin = middle - 0.25;
      yMax = middle + 0.25;
      ySpan = 0.5;
    }

    xMin -= xSpan * 0.1;
    xMax += xSpan * 0.1;
    yMin -= ySpan * 0.1;
    yMax += ySpan * 0.1;

    const ppu = clamp(
      Math.min(w / (xMax - xMin), h / (yMax - yMin)) * 0.88,
      MIN_PIXELS_PER_UNIT,
      MAX_PIXELS_PER_UNIT,
    );

    this.pixelsPerUnit.set(ppu);
    this.center.set({
      x: (xMin + xMax) / 2,
      y: (yMin + yMax) / 2,
    });
  }

  // ---------------------------------------------------------------- punteros

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const canvas = this.canvasRef().nativeElement;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Ignorar si el navegador no permite capturar el puntero.
    }

    const point = this.localPoint(event);
    const center = this.center();
    this.dragStart = {
      px: point.x,
      py: point.y,
      cx: center.x,
      cy: center.y,
      moved: false,
    };
    this.dragging.set(true);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragStart) {
      return;
    }

    const point = this.localPoint(event);
    const dx = point.x - this.dragStart.px;
    const dy = point.y - this.dragStart.py;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.dragStart.moved = true;
    }

    if (this.dragStart.moved) {
      const ppu = this.pixelsPerUnit();
      this.center.set({
        x: this.dragStart.cx - dx / ppu,
        y: this.dragStart.cy + dy / ppu,
      });
    }
  }

  onPointerUp(event: PointerEvent): void {
    const canvas = this.canvasRef().nativeElement;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignorar.
    }

    if (this.dragStart && !this.dragStart.moved && this.mode() === 'derivative') {
      const point = this.localPoint(event);
      const worldX = this.worldX(point.x);
      if (Number.isFinite(worldX)) {
        this.x0.set(clamp(worldX, -1000, 1000));
      }
    }

    this.dragStart = null;
    this.dragging.set(false);
  }

  onPointerLeave(): void {
    if (!this.dragStart) {
      this.dragging.set(false);
    }
  }

  zoomBy(factor: number, anchor?: Point): void {
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) {
      return;
    }

    const current = this.pixelsPerUnit();
    const next = clamp(current * factor, MIN_PIXELS_PER_UNIT, MAX_PIXELS_PER_UNIT);
    const px = anchor?.x ?? w / 2;
    const py = anchor?.y ?? h / 2;
    const center = this.center();
    const worldX = center.x + (px - w / 2) / current;
    const worldY = center.y + (h / 2 - py) / current;

    this.pixelsPerUnit.set(next);
    this.center.set({
      x: worldX - (px - w / 2) / next,
      y: worldY - (h / 2 - py) / next,
    });
  }

  // ------------------------------------------------------------------- canvas

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
    this.size.set({ w: width, h: height });

    if (!this.viewInitialized && width > 20 && height > 20) {
      this.viewInitialized = true;
      this.fitView();
    }

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

    this.drawGrid(ctx);
    this.drawAxes(ctx);

    if (this.mode() === 'riemann') {
      this.drawRiemannBars(ctx);
    }

    if (this.mode() === 'derivative' || this.mode() === 'riemann') {
      this.drawFunction(ctx);
    } else if (this.mode() === 'polar') {
      this.drawPolar(ctx);
    } else {
      this.drawParametric(ctx);
    }

    if (this.mode() === 'derivative') {
      if (this.showDerivativeCurve()) {
        this.drawDerivativeCurve(ctx);
      }
      if (this.showSecant()) {
        this.drawSecant(ctx);
      }
      if (this.showTangent()) {
        this.drawTangent(ctx);
      }
      this.drawDerivativePoint(ctx);
    } else if (this.mode() === 'riemann') {
      this.drawIntervalLabels(ctx);
    }
  }

  private drawPolar(ctx: CanvasRenderingContext2D): void {
    const fn = this.polar().compiled;
    if (!fn || !this.polarRangeValid()) {
      return;
    }
    const points = samplePolar(
      fn,
      this.thetaMin(),
      this.thetaMax(),
      Math.max(700, Math.round(this.width * 2)),
    );
    this.drawPolyline(ctx, points, '#38bdf8', 2.3);
  }

  private drawParametric(ctx: CanvasRenderingContext2D): void {
    const xFunction = this.paramX().compiled;
    const yFunction = this.paramY().compiled;
    if (!xFunction || !yFunction || !this.parametricRangeValid()) {
      return;
    }
    const points = sampleParametric(
      xFunction,
      yFunction,
      this.tMin(),
      this.tMax(),
      Math.max(700, Math.round(this.width * 2)),
    );
    this.drawPolyline(ctx, points, '#38bdf8', 2.3);
  }

  private drawPolyline(
    ctx: CanvasRenderingContext2D,
    points: CurvePoint[],
    color: string,
    width: number,
  ): void {
    if (points.length === 0) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    let started = false;
    let previousX = 0;
    let previousY = 0;
    const jumpLimit = Math.max(this.width, this.height) * 3;

    for (const point of points) {
      const px = this.screenX(point.x);
      const py = this.screenY(point.y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) {
        started = false;
        continue;
      }

      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else if (Math.hypot(px - previousX, py - previousY) > jumpLimit) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }

      previousX = px;
      previousY = py;
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const ppu = this.pixelsPerUnit();
    const center = this.center();
    const major = niceStep(GRID_TARGET_PX / ppu);
    const normalized = major / 10 ** Math.floor(Math.log10(major));
    const subdivisions = normalized === 2 ? 4 : 5;
    const minor = major / subdivisions;

    const xMin = center.x - this.width / (2 * ppu);
    const xMax = center.x + this.width / (2 * ppu);
    const yMin = center.y - this.height / (2 * ppu);
    const yMax = center.y + this.height / (2 * ppu);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.beginPath();

    for (let i = Math.ceil(xMin / minor); i <= Math.floor(xMax / minor); i += 1) {
      const value = i * minor;
      if (Math.abs(value / major - Math.round(value / major)) < 1e-9) {
        continue;
      }
      const x = snapToPixel(this.screenX(value));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }

    for (let i = Math.ceil(yMin / minor); i <= Math.floor(yMax / minor); i += 1) {
      const value = i * minor;
      if (Math.abs(value / major - Math.round(value / major)) < 1e-9) {
        continue;
      }
      const y = snapToPixel(this.screenY(value));
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.beginPath();
    for (let i = Math.ceil(xMin / major); i <= Math.floor(xMax / major); i += 1) {
      const x = snapToPixel(this.screenX(i * major));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let i = Math.ceil(yMin / major); i <= Math.floor(yMax / major); i += 1) {
      const y = snapToPixel(this.screenY(i * major));
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
  }

  private drawAxes(ctx: CanvasRenderingContext2D): void {
    const ppu = this.pixelsPerUnit();
    const center = this.center();
    const axisX = this.screenX(0);
    const axisY = this.screenY(0);
    const showX = axisY >= 0 && axisY <= this.height;
    const showY = axisX >= 0 && axisX <= this.width;

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (showX) {
      const y = snapToPixel(axisY);
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    if (showY) {
      const x = snapToPixel(axisX);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    ctx.stroke();

    const major = niceStep(GRID_TARGET_PX / ppu);
    const xMin = center.x - this.width / (2 * ppu);
    const xMax = center.x + this.width / (2 * ppu);
    const yMin = center.y - this.height / (2 * ppu);
    const yMax = center.y + this.height / (2 * ppu);

    ctx.font = '500 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.82)';

    const xLabelsInside = axisY >= 18 && axisY <= this.height - 26;
    const xLabelY = xLabelsInside ? axisY + 16 : this.height - 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = xLabelsInside ? 'top' : 'bottom';
    for (let i = Math.ceil(xMin / major); i <= Math.floor(xMax / major); i += 1) {
      if (i === 0) {
        continue;
      }
      const x = this.screenX(i * major);
      if (x < 18 || x > this.width - 18) {
        continue;
      }
      ctx.fillText(this.formatTick(i * major, major), x, xLabelY);
    }

    const yLabelsInside = axisX >= 42 && axisX <= this.width - 14;
    const yLabelX = yLabelsInside ? axisX - 8 : 10;
    ctx.textAlign = yLabelsInside ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    for (let i = Math.ceil(yMin / major); i <= Math.floor(yMax / major); i += 1) {
      if (i === 0) {
        continue;
      }
      const y = this.screenY(i * major);
      if (y < 14 || y > this.height - 14) {
        continue;
      }
      ctx.fillText(this.formatTick(i * major, major), yLabelX, y);
    }

    if (showX && showY) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('0', axisX - 6, axisY + 6);
    }
    if (showX) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('x', this.width - 8, axisY - 6);
    }
    if (showY) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('y', axisX + 8, 8);
    }
  }

  private drawFunction(ctx: CanvasRenderingContext2D): void {
    const fn = this.calculus().compiled;
    if (!fn) {
      return;
    }

    const ppu = this.pixelsPerUnit();
    const center = this.center();
    const jumpLimit = Math.max(this.height * 1.25, 160);

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    let previousY: number | null = null;

    for (let px = 0; px <= this.width; px += 1) {
      const worldX = center.x + (px - this.width / 2) / ppu;
      const value = evaluateAt(fn, worldX);
      if (!Number.isFinite(value)) {
        previousY = null;
        continue;
      }

      let py = this.screenY(value);
      if (py < -this.height * 4) {
        py = -this.height * 4;
      } else if (py > this.height * 5) {
        py = this.height * 5;
      }

      if (previousY === null) {
        ctx.moveTo(px, py);
      } else if (Math.abs(py - previousY) > jumpLimit) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
      previousY = py;
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawDerivativeCurve(ctx: CanvasRenderingContext2D): void {
    const fn = this.calculus().compiled;
    if (!fn) {
      return;
    }

    const ppu = this.pixelsPerUnit();
    const center = this.center();

    ctx.save();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)';
    ctx.lineWidth = 1.7;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    let previousY: number | null = null;

    for (let px = 0; px <= this.width; px += 2) {
      const worldX = center.x + (px - this.width / 2) / ppu;
      const value = numericDerivative(fn, worldX);
      if (!Number.isFinite(value)) {
        previousY = null;
        continue;
      }
      const py = this.screenY(value);
      if (previousY === null) {
        ctx.moveTo(px, py);
      } else if (Math.abs(py - previousY) > this.height * 1.5) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
      previousY = py;
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawSecant(ctx: CanvasRenderingContext2D): void {
    const fn = this.calculus().compiled;
    if (!fn) {
      return;
    }

    const x0 = this.x0();
    const x1 = x0 + this.h();
    const y0 = evaluateAt(fn, x0);
    const y1 = evaluateAt(fn, x1);
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || x1 === x0) {
      return;
    }

    const slope = (y1 - y0) / (x1 - x0);
    this.drawLineThrough(ctx, x0, y0, slope, 'rgba(251, 191, 36, 0.95)', [6, 5], 1.7);

    this.drawPoint(ctx, x0, y0, '#fbbf24');
    this.drawPoint(ctx, x1, y1, '#fbbf24');
  }

  private drawTangent(ctx: CanvasRenderingContext2D): void {
    const value = this.fValue();
    const slope = this.slope();
    if (!Number.isFinite(value) || !Number.isFinite(slope)) {
      return;
    }

    this.drawLineThrough(ctx, this.x0(), value, slope, '#34d399', [], 2.1);
  }

  private drawDerivativePoint(ctx: CanvasRenderingContext2D): void {
    const x = this.x0();
    const value = this.fValue();
    if (!Number.isFinite(value)) {
      return;
    }

    const px = this.screenX(x);
    const py = this.screenY(value);

    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#34d399';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(8, 13, 25, 0.95)';
    ctx.stroke();

    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.95)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`x₀ = ${formatCalc(x, 3)}`, px + 9, py - 6);
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(110, 231, 183, 0.95)';
    ctx.fillText(`m = ${formatCalc(this.slope(), 3)}`, px + 9, py + 6);
    ctx.restore();
  }

  private drawLineThrough(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    slope: number,
    color: string,
    dash: number[],
    width: number,
  ): void {
    const xMin = this.worldX(0);
    const xMax = this.worldX(this.width);
    const yLeft = y + slope * (xMin - x);
    const yRight = y + slope * (xMax - x);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(0, clamp(this.screenY(yLeft), -this.height * 4, this.height * 5));
    ctx.lineTo(this.width, clamp(this.screenY(yRight), -this.height * 4, this.height * 5));
    ctx.stroke();
    ctx.restore();
  }

  private drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    const px = this.screenX(x);
    const py = this.screenY(y);
    if (px < -20 || px > this.width + 20 || py < -20 || py > this.height + 20) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(8, 13, 25, 0.9)';
    ctx.stroke();
    ctx.restore();
  }

  private drawRiemannBars(ctx: CanvasRenderingContext2D): void {
    const result = this.riemannResult();
    if (!result) {
      return;
    }

    const zeroY = this.screenY(0);
    const isTrapezoid = this.method() === 'trapezoid';

    for (const bar of result.bars) {
      if (!Number.isFinite(bar.y0) || !Number.isFinite(bar.y1)) {
        continue;
      }

      const x0 = this.screenX(bar.x0);
      const x1 = this.screenX(bar.x1);
      const y0 = clamp(this.screenY(bar.y0), -this.height * 4, this.height * 5);
      const y1 = clamp(this.screenY(bar.y1), -this.height * 4, this.height * 5);
      const positive = (bar.y0 + bar.y1) / 2 >= 0;

      ctx.save();
      ctx.beginPath();
      if (isTrapezoid) {
        ctx.moveTo(x0, zeroY);
        ctx.lineTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1, zeroY);
        ctx.closePath();
      } else {
        const top = Math.min(y0, zeroY);
        const height = Math.abs(zeroY - y0);
        ctx.rect(x0, top, Math.max(0, x1 - x0), Math.max(1, height));
      }
      ctx.fillStyle = positive ? 'rgba(52, 211, 153, 0.22)' : 'rgba(251, 113, 133, 0.22)';
      ctx.strokeStyle = positive ? 'rgba(52, 211, 153, 0.6)' : 'rgba(251, 113, 133, 0.6)';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      if (!isTrapezoid && bar.sampleX !== null && result.bars.length <= 60) {
        this.drawPoint(ctx, bar.sampleX, bar.y0, '#34d399');
      }
    }
  }

  private drawIntervalLabels(ctx: CanvasRenderingContext2D): void {
    const result = this.riemannResult();
    if (!result) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    for (const value of [result.lo, result.hi]) {
      const x = snapToPixel(this.screenX(value));
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  private formatTick(value: number, step: number): string {
    if (Math.abs(value) < step * 1e-6) {
      return '0';
    }
    const decimals = clamp(-Math.floor(Math.log10(step)), 0, 8);
    return formatDecimal(value, decimals);
  }

  private localPoint(event: PointerEvent): Point {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private worldX(px: number): number {
    return this.center().x + (px - this.width / 2) / this.pixelsPerUnit();
  }

  private screenX(x: number): number {
    return this.width / 2 + (x - this.center().x) * this.pixelsPerUnit();
  }

  private screenY(y: number): number {
    return this.height / 2 - (y - this.center().y) * this.pixelsPerUnit();
  }
}
