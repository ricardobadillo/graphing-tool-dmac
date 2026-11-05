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
import {
  CURVE_PALETTE,
  compileExpression,
  createPlotFunction,
  evaluateAt,
  type PlotFunction,
} from '../shared/expression';
import { CanvasKeyboard } from '../shared/canvas-keyboard';
import { CanvasSurface } from '../shared/canvas-surface';
import { clamp, niceStep } from '../shared/math-utils';
import { buildShareUrl, copyShareUrl, decodeShare } from '../share';
import { formatDecimal, formatExact, formatFraction } from '../shared/exact-number';
import {
  analyzeCurve,
  type CurveAnalysis,
  type ExtremaPoint,
  type HorizontalAsymptote,
  type MonotonicInterval,
} from './curve-analysis';
import type { EvalFunction } from 'mathjs/number';

const MIN_PIXELS_PER_UNIT = 0.0005;
const MAX_PIXELS_PER_UNIT = 200_000;
const GRID_TARGET_PX = 84;
const INITIAL_X_RANGE = 22;

type InequalityOperator = '>' | '>=' | '<' | '<=';

type ParameterKey = 'a' | 'b' | 'c' | 'd';

interface PlotParameters {
  a: number;
  b: number;
  c: number;
  d: number;
  [key: string]: number;
}

interface PlotInequality {
  id: number;
  expression: string;
  operator: InequalityOperator;
  color: string;
  visible: boolean;
  compiled: EvalFunction | null;
  error: string | null;
}

interface FunctionAnalysis {
  fn: PlotFunction & { compiled: EvalFunction };
  analysis: CurveAnalysis;
}

interface PlotShareData {
  functions: { expression: string; color: string; visible: boolean }[];
  centerX: number;
  centerY: number;
  pixelsPerUnit: number;
  parameters?: PlotParameters;
  inequalities?: {
    expression: string;
    operator: InequalityOperator;
    color: string;
    visible: boolean;
  }[];
}

/** Alinea una coordenada al píxel para que las líneas de 1px se vean nítidas. */
function snapToPixel(value: number): number {
  return Math.round(value) + 0.5;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((character) => character + character)
          .join('')
      : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

interface Viewport {
  x: number;
  y: number;
}

interface Size {
  w: number;
  h: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-function-plotter',
  imports: [CanvasKeyboard],
  templateUrl: './function-plotter.html',
  styleUrl: './function-plotter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FunctionPlotter {
  private readonly baseCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('baseCanvas');
  private readonly overlayCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('overlayCanvas');
  private readonly destroyRef = inject(DestroyRef);

  private nextId = 3;

  readonly functions = signal<PlotFunction[]>([
    createPlotFunction(1, 'sin(x)', CURVE_PALETTE[0]),
    createPlotFunction(2, 'x^2 / 4 - 2', CURVE_PALETTE[1]),
  ]);

  readonly parameters = signal<PlotParameters>({ a: 1, b: 1, c: 0, d: 0 });
  readonly parameterKeys: ParameterKey[] = ['a', 'b', 'c', 'd'];
  readonly animating = signal(false);
  readonly animationParameter = signal<ParameterKey>('c');
  private readonly animationBlocked = signal(false);
  private readonly analysisInput = signal<{
    range: { xMin: number; xMax: number };
    parameters: PlotParameters;
  }>({
    range: { xMin: -10, xMax: 10 },
    parameters: { a: 1, b: 1, c: 0, d: 0 },
  });
  private analysisTimer: ReturnType<typeof setTimeout> | null = null;
  readonly inequalities = signal<PlotInequality[]>([]);
  private nextInequalityId = 1;
  private animationTimer: ReturnType<typeof setInterval> | null = null;
  private animationStart = 0;
  private animationOrigin = 0;

  private readonly center = signal<Viewport>({ x: 0, y: 0 });
  readonly pixelsPerUnit = signal(48);
  readonly size = signal<Size>({ w: 0, h: 0 });

  readonly hover = signal<PointerPosition | null>(null);
  readonly dragging = signal(false);
  readonly toast = signal<string | null>(null);
  private toastTimer: number | null = null;

  readonly parameterUsers = computed<string[]>(() => {
    const key = this.animationParameter();
    const pattern = new RegExp(`\\b${key}\\b`);
    return this.functions()
      .filter((fn) => fn.visible && fn.compiled && pattern.test(fn.expression))
      .map((fn) => fn.expression);
  });

  readonly animationWarning = computed<string | null>(() => {
    if (!this.animationBlocked() || this.parameterUsers().length > 0) {
      return null;
    }
    return `Ninguna función visible usa "${this.animationParameter()}". Añade una expresión que lo incluya o usa la plantilla.`;
  });

  readonly presets = [
    'sin(x)',
    'x^2',
    '1 / x',
    'e^x',
    'ln(x)',
    'sqrt(x)',
    'a*sin(b*x + c) + d',
    'piecewise(x < 0, -x, x >= 0, x)',
  ];

  readonly visibleRange = computed(() => {
    const { w } = this.size();
    const pixelsPerUnit = this.pixelsPerUnit();
    const center = this.center();
    if (w <= 0 || pixelsPerUnit <= 0) {
      return { xMin: -10, xMax: 10 };
    }
    const half = w / (2 * pixelsPerUnit);
    return { xMin: center.x - half, xMax: center.x + half };
  });

  readonly analyses = computed<FunctionAnalysis[]>(() => {
    const { range, parameters } = this.analysisInput();
    return this.functions()
      .filter(
        (fn): fn is PlotFunction & { compiled: EvalFunction } => fn.visible && fn.compiled !== null,
      )
      .map((fn) => ({
        fn,
        analysis: analyzeCurve(
          (x) => evaluateAt(fn.compiled, x, parameters),
          range.xMin,
          range.xMax,
          760,
        ),
      }));
  });

  readonly hoverData = computed(() => {
    const hover = this.hover();
    const { w } = this.size();
    const pixelsPerUnit = this.pixelsPerUnit();
    if (!hover || w <= 0) {
      return null;
    }

    const worldX = this.center().x + (hover.x - w / 2) / pixelsPerUnit;
    const parameters = this.parameters();
    const values = this.functions()
      .filter((fn) => fn.visible && fn.compiled)
      .map((fn) => ({
        id: fn.id,
        color: fn.color,
        expression: fn.expression,
        value: evaluateAt(fn.compiled!, worldX, parameters),
      }));

    return { x: worldX, values };
  });

  readonly rangeLabel = computed(() => {
    const { w, h } = this.size();
    const pixelsPerUnit = this.pixelsPerUnit();
    if (w <= 0 || h <= 0) {
      return '';
    }

    const center = this.center();
    const halfWidth = w / (2 * pixelsPerUnit);
    const halfHeight = h / (2 * pixelsPerUnit);

    return [
      `x ∈ [${formatDecimal(center.x - halfWidth)}, ${formatDecimal(center.x + halfWidth)}]`,
      `y ∈ [${formatDecimal(center.y - halfHeight)}, ${formatDecimal(center.y + halfHeight)}]`,
    ].join('  ·  ');
  });

  private baseSurface: CanvasSurface | null = null;
  private overlaySurface: CanvasSurface | null = null;
  private viewInitialized = false;

  private get ctxBase(): CanvasRenderingContext2D | null {
    return this.baseSurface?.context ?? null;
  }
  private get ctxOverlay(): CanvasRenderingContext2D | null {
    return this.overlaySurface?.context ?? null;
  }
  private get width(): number {
    return this.baseSurface?.width ?? 0;
  }
  private get height(): number {
    return this.baseSurface?.height ?? 0;
  }
  private get pixelRatio(): number {
    return this.baseSurface?.pixelRatio ?? 1;
  }

  private readonly pointers = new Map<number, PointerPosition>();
  private lastPan: PointerPosition | null = null;
  private pinch: { distance: number; cx: number; cy: number } | null = null;

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const canvas = this.baseCanvas().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const deltaMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1;
    const factor = Math.exp(-event.deltaY * deltaMultiplier * 0.0015);

    this.zoomBy(clamp(factor, 0.4, 2.5), {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  constructor() {
    effect(() => {
      this.functions();
      this.parameters();
      this.inequalities();
      this.analyses();
      this.center();
      this.pixelsPerUnit();
      this.size();
      this.scheduleBaseDraw();
    });

    effect(() => {
      this.hover();
      this.functions();
      this.parameters();
      this.center();
      this.pixelsPerUnit();
      this.size();
      this.scheduleOverlayDraw();
    });

    effect(() => {
      const range = this.visibleRange();
      const parameters = this.parameters();
      if (this.analysisTimer !== null) {
        clearTimeout(this.analysisTimer);
      }
      this.analysisTimer = setTimeout(() => {
        this.analysisInput.set({ range, parameters: { ...parameters } });
        this.analysisTimer = null;
      }, 140);
    });

    afterNextRender(() => {
      // Evita inicializar el canvas en entornos sin implementación (por ejemplo, jsdom).
      if (typeof CanvasRenderingContext2D === 'undefined') {
        return;
      }

      const base = this.baseCanvas().nativeElement;
      const overlay = this.overlayCanvas().nativeElement;
      const container = base.parentElement;
      if (!container) {
        return;
      }

      this.baseSurface = new CanvasSurface({
        canvas: base,
        container,
        draw: () => this.drawBase(),
        onResize: (size) => {
          this.size.set(size);
          if (!this.viewInitialized && size.w > 20 && size.h > 20) {
            this.viewInitialized = true;
            this.resetView();
          }
        },
      });
      this.overlaySurface = new CanvasSurface({
        canvas: overlay,
        container,
        draw: () => this.drawOverlay(),
      });

      base.addEventListener('wheel', this.onWheel, { passive: false });
      this.baseSurface.resize();
      this.overlaySurface.resize();
      this.restoreFromShareLink();

      this.destroyRef.onDestroy(() => {
        base.removeEventListener('wheel', this.onWheel);
        this.baseSurface?.destroy();
        this.overlaySurface?.destroy();
        this.stopAnimation();
        if (this.analysisTimer !== null) {
          clearTimeout(this.analysisTimer);
        }
        if (this.toastTimer !== null) {
          clearTimeout(this.toastTimer);
        }
      });
    });
  }

  // ---------------------------------------------------------------- acciones

  addFunction(expression = ''): void {
    const usedColors = new Set(this.functions().map((fn) => fn.color));
    const color =
      CURVE_PALETTE.find((candidate) => !usedColors.has(candidate)) ??
      CURVE_PALETTE[this.functions().length % CURVE_PALETTE.length];

    const id = this.nextId++;
    this.functions.update((list) => [...list, createPlotFunction(id, expression, color)]);
  }

  removeFunction(id: number): void {
    this.functions.update((list) => list.filter((fn) => fn.id !== id));
  }

  updateExpression(id: number, expression: string): void {
    this.functions.update((list) =>
      list.map((fn) => (fn.id === id ? createPlotFunction(fn.id, expression, fn.color) : fn)),
    );
  }

  updateColor(id: number, color: string): void {
    this.functions.update((list) => list.map((fn) => (fn.id === id ? { ...fn, color } : fn)));
  }

  toggleVisibility(id: number): void {
    this.functions.update((list) =>
      list.map((fn) => (fn.id === id ? { ...fn, visible: !fn.visible } : fn)),
    );
  }

  onExpressionInput(id: number, event: Event): void {
    this.updateExpression(id, (event.target as HTMLInputElement).value);
  }

  onColorInput(id: number, event: Event): void {
    this.updateColor(id, (event.target as HTMLInputElement).value);
  }

  setParameter(key: ParameterKey, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) {
      return;
    }
    this.parameters.update((parameters) => ({ ...parameters, [key]: value }));
  }

  resetParameters(): void {
    this.stopAnimation();
    this.parameters.set({ a: 1, b: 1, c: 0, d: 0 });
  }

  useParameterTemplate(): void {
    this.addFunction('a*sin(b*x + c) + d');
  }

  setAnimationParameter(event: Event): void {
    this.stopAnimation();
    const key = (event.target as HTMLSelectElement).value as ParameterKey;
    if (this.parameterKeys.includes(key)) {
      this.animationParameter.set(key);
      this.animationBlocked.set(false);
    }
  }

  toggleAnimation(): void {
    if (this.animating()) {
      this.stopAnimation();
      return;
    }

    if (this.parameterUsers().length === 0) {
      this.animationBlocked.set(true);
      return;
    }

    this.animationBlocked.set(false);
    this.animationStart = performance.now();
    this.animationOrigin = this.parameters()[this.animationParameter()];
    this.animating.set(true);

    if (this.animationTimer !== null) {
      clearInterval(this.animationTimer);
    }
    this.animationTimer = setInterval(() => {
      const elapsed = (performance.now() - this.animationStart) / 1000;
      const key = this.animationParameter();
      this.parameters.update((parameters) => ({
        ...parameters,
        [key]: this.animationOrigin + elapsed * 1.4,
      }));
    }, 32);
  }

  private stopAnimation(): void {
    this.animating.set(false);
    if (this.animationTimer !== null) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  addInequality(expression = 'x^2', operator: InequalityOperator = '>'): void {
    const id = this.nextInequalityId++;
    const color =
      CURVE_PALETTE[(this.inequalities().length + 3) % CURVE_PALETTE.length] ?? CURVE_PALETTE[0];
    this.inequalities.update((list) => [
      ...list,
      this.createInequality(id, expression, operator, color),
    ]);
  }

  removeInequality(id: number): void {
    this.inequalities.update((list) => list.filter((inequality) => inequality.id !== id));
  }

  updateInequalityExpression(id: number, event: Event): void {
    const expression = (event.target as HTMLInputElement).value;
    this.inequalities.update((list) =>
      list.map((inequality) =>
        inequality.id === id
          ? this.createInequality(id, expression, inequality.operator, inequality.color)
          : inequality,
      ),
    );
  }

  updateInequalityOperator(id: number, event: Event): void {
    const operator = (event.target as HTMLSelectElement).value as InequalityOperator;
    this.inequalities.update((list) =>
      list.map((inequality) =>
        inequality.id === id
          ? this.createInequality(id, inequality.expression, operator, inequality.color)
          : inequality,
      ),
    );
  }

  updateInequalityColor(id: number, event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.inequalities.update((list) =>
      list.map((inequality) => (inequality.id === id ? { ...inequality, color } : inequality)),
    );
  }

  toggleInequalityVisibility(id: number): void {
    this.inequalities.update((list) =>
      list.map((inequality) =>
        inequality.id === id ? { ...inequality, visible: !inequality.visible } : inequality,
      ),
    );
  }

  private createInequality(
    id: number,
    expression: string,
    operator: InequalityOperator,
    color: string,
  ): PlotInequality {
    const result = compileExpression(expression, ['x']);
    return {
      id,
      expression,
      operator,
      color,
      visible: true,
      compiled: result.compiled,
      error: result.error,
    };
  }

  formatAnalysisX(value: number): string {
    return formatExact(value, { digits: 3 });
  }

  formatAnalysisY(value: number): string {
    return formatExact(value, { digits: 3 });
  }

  formatAnalysisInterval(from: number, to: number): string {
    return `${this.formatAnalysisX(from)} → ${this.formatAnalysisX(to)}`;
  }

  formatRoots(values: number[]): string {
    if (values.length === 0) {
      return '—';
    }
    const shown = values.slice(0, 6).map((value) => this.formatAnalysisX(value));
    const extra = values.length - shown.length;
    return extra > 0 ? `${shown.join(', ')} (+${extra})` : shown.join(', ');
  }

  formatExtremaPoints(points: ExtremaPoint[]): string {
    if (points.length === 0) {
      return '—';
    }
    const shown = points
      .slice(0, 5)
      .map((point) => `${this.formatAnalysisX(point.x)} → ${this.formatAnalysisY(point.y)}`);
    const extra = points.length - shown.length;
    return extra > 0 ? `${shown.join(', ')} (+${extra})` : shown.join(', ');
  }

  formatMonotonicIntervals(intervals: MonotonicInterval[]): string {
    if (intervals.length === 0) {
      return '—';
    }
    const shown = intervals
      .slice(0, 4)
      .map(
        (interval) =>
          `${this.formatAnalysisInterval(interval.from, interval.to)} ${
            interval.direction === 'increasing' ? '↗' : '↘'
          }`,
      );
    const extra = intervals.length - shown.length;
    return extra > 0 ? `${shown.join(' · ')} (+${extra})` : shown.join(' · ');
  }

  formatAsymptotes(values: number[]): string {
    if (values.length === 0) {
      return '—';
    }
    return values
      .slice(0, 5)
      .map((value) => this.formatAnalysisX(value))
      .join(', ');
  }

  formatHorizontalAsymptotes(values: HorizontalAsymptote[]): string {
    if (values.length === 0) {
      return '—';
    }
    return values
      .slice(0, 4)
      .map((value) => `y = ${this.formatAnalysisY(value.y)}`)
      .join(' · ');
  }

  zoomBy(factor: number, anchor?: PointerPosition): void {
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) {
      return;
    }

    const currentPixelsPerUnit = this.pixelsPerUnit();
    const nextPixelsPerUnit = clamp(
      currentPixelsPerUnit * factor,
      MIN_PIXELS_PER_UNIT,
      MAX_PIXELS_PER_UNIT,
    );

    const px = anchor?.x ?? w / 2;
    const py = anchor?.y ?? h / 2;

    // Punto del mundo que hay bajo el cursor antes del zoom.
    const center = this.center();
    const worldX = center.x + (px - w / 2) / currentPixelsPerUnit;
    const worldY = center.y + (h / 2 - py) / currentPixelsPerUnit;

    this.pixelsPerUnit.set(nextPixelsPerUnit);
    this.center.set({
      x: worldX - (px - w / 2) / nextPixelsPerUnit,
      y: worldY - (h / 2 - py) / nextPixelsPerUnit,
    });
  }

  resetView(): void {
    const { w } = this.size();
    this.center.set({ x: 0, y: 0 });
    this.pixelsPerUnit.set(
      w > 0 ? clamp(w / INITIAL_X_RANGE, MIN_PIXELS_PER_UNIT, MAX_PIXELS_PER_UNIT) : 48,
    );
  }

  copyShareLink(): void {
    const url = buildShareUrl('plot', this.buildShareData());
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', url);
    }
    void copyShareUrl(url).then((copied) => {
      if (copied) {
        this.showToast('Enlace copiado al portapapeles');
      } else if (typeof window !== 'undefined') {
        window.prompt('Copia el enlace para compartir:', url);
      }
    });
  }

  private buildShareData(): PlotShareData {
    return {
      functions: this.functions().map((fn) => ({
        expression: fn.expression,
        color: fn.color,
        visible: fn.visible,
      })),
      centerX: this.center().x,
      centerY: this.center().y,
      pixelsPerUnit: this.pixelsPerUnit(),
      parameters: this.parameters(),
      inequalities: this.inequalities().map((inequality) => ({
        expression: inequality.expression,
        operator: inequality.operator,
        color: inequality.color,
        visible: inequality.visible,
      })),
    };
  }

  private restoreFromShareLink(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const envelope = decodeShare<PlotShareData>(window.location.hash);
    if (!envelope || envelope.tool !== 'plot' || !envelope.data) {
      return;
    }

    const data = envelope.data;

    if (Array.isArray(data.functions)) {
      const restored = data.functions
        .filter(
          (item) =>
            item !== null &&
            typeof item === 'object' &&
            typeof item.expression === 'string' &&
            typeof item.color === 'string',
        )
        .map((item, index) => {
          const fn = createPlotFunction(index + 1, item.expression, item.color);
          fn.visible = typeof item.visible === 'boolean' ? item.visible : true;
          return fn;
        });
      this.functions.set(restored);
      this.nextId = restored.length + 1;
    }

    if (
      Number.isFinite(data.centerX) &&
      Number.isFinite(data.centerY) &&
      Number.isFinite(data.pixelsPerUnit) &&
      data.pixelsPerUnit > 0
    ) {
      this.center.set({ x: data.centerX, y: data.centerY });
      this.pixelsPerUnit.set(clamp(data.pixelsPerUnit, MIN_PIXELS_PER_UNIT, MAX_PIXELS_PER_UNIT));
    }

    if (data.parameters && typeof data.parameters === 'object') {
      const parameters = data.parameters;
      this.parameters.set({
        a: Number.isFinite(parameters.a) ? parameters.a : 1,
        b: Number.isFinite(parameters.b) ? parameters.b : 1,
        c: Number.isFinite(parameters.c) ? parameters.c : 0,
        d: Number.isFinite(parameters.d) ? parameters.d : 0,
      });
    }

    if (Array.isArray(data.inequalities)) {
      const restored = data.inequalities
        .filter(
          (item) =>
            item !== null &&
            typeof item === 'object' &&
            typeof item.expression === 'string' &&
            typeof item.color === 'string' &&
            ['>', '>=', '<', '<='].includes(item.operator),
        )
        .map((item) =>
          this.createInequality(
            this.nextInequalityId++,
            item.expression,
            item.operator,
            item.color,
          ),
        );
      this.inequalities.set(restored);
    }

    this.showToast('Estado restaurado desde el enlace');
  }

  private showToast(message: string): void {
    this.toast.set(message);
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2600);
  }

  // --------------------------------------------------------------- punteros

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const canvas = this.baseCanvas().nativeElement;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Algunos navegadores no permiten capturar el puntero; no es crítico.
    }

    const point = this.localPoint(event);
    this.pointers.set(event.pointerId, point);

    if (this.pointers.size === 1) {
      this.dragging.set(true);
      this.lastPan = point;
      this.hover.set(null);
    } else if (this.pointers.size === 2) {
      this.pinch = this.currentPinch();
      this.lastPan = null;
    }
  }

  onPointerMove(event: PointerEvent): void {
    const point = this.localPoint(event);

    if (this.pointers.has(event.pointerId)) {
      this.pointers.set(event.pointerId, point);

      if (this.pointers.size >= 2) {
        const nextPinch = this.currentPinch();
        if (nextPinch && this.pinch && this.pinch.distance > 0) {
          this.zoomBy(nextPinch.distance / this.pinch.distance, {
            x: nextPinch.cx,
            y: nextPinch.cy,
          });
          this.panBy(nextPinch.cx - this.pinch.cx, nextPinch.cy - this.pinch.cy);
          this.pinch = nextPinch;
        }
      } else if (this.lastPan) {
        this.panBy(point.x - this.lastPan.x, point.y - this.lastPan.y);
        this.lastPan = point;
      }
      return;
    }

    if (event.pointerType === 'mouse') {
      this.hover.set(point);
    }
  }

  onPointerUp(event: PointerEvent): void {
    const canvas = this.baseCanvas().nativeElement;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignorar: el puntero pudo haberse liberado automáticamente.
    }

    this.pointers.delete(event.pointerId);

    if (this.pointers.size === 0) {
      this.dragging.set(false);
      this.lastPan = null;
      this.pinch = null;
      if (event.pointerType === 'mouse') {
        this.hover.set(this.localPoint(event));
      }
    } else if (this.pointers.size === 1) {
      this.lastPan = [...this.pointers.values()][0] ?? null;
      this.pinch = null;
    }
  }

  onPointerLeave(): void {
    if (this.pointers.size === 0) {
      this.hover.set(null);
    }
  }

  // ------------------------------------------------------------- utilidades

  formatCoordinate(value: number): string {
    return formatExact(value, { digits: 3 });
  }

  formatCoord(value: number): string {
    return formatFraction(value, { digits: 3 });
  }

  private localPoint(event: PointerEvent): PointerPosition {
    const rect = this.baseCanvas().nativeElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  panBy(dx: number, dy: number): void {
    const pixelsPerUnit = this.pixelsPerUnit();
    this.center.update((center) => ({
      x: center.x - dx / pixelsPerUnit,
      y: center.y + dy / pixelsPerUnit,
    }));
  }

  private currentPinch(): { distance: number; cx: number; cy: number } | null {
    if (this.pointers.size < 2) {
      return null;
    }
    const [first, second] = [...this.pointers.values()];
    return {
      distance: Math.hypot(first.x - second.x, first.y - second.y),
      cx: (first.x + second.x) / 2,
      cy: (first.y + second.y) / 2,
    };
  }

  // --------------------------------------------------------------- canvas

  private resize(): void {
    this.baseSurface?.resize();
    this.overlaySurface?.resize();
  }

  private scheduleBaseDraw(): void {
    this.baseSurface?.requestDraw();
  }

  private scheduleOverlayDraw(): void {
    this.overlaySurface?.requestDraw();
  }

  private drawBase(): void {
    const ctx = this.ctxBase;
    if (!ctx) {
      return;
    }

    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    this.drawGrid(ctx);
    this.drawAxes(ctx);
    this.drawInequalities(ctx);
    this.drawCurves(ctx);
    this.drawAnalysisMarkers(ctx);
  }

  private drawInequalities(ctx: CanvasRenderingContext2D): void {
    const pixelsPerUnit = this.pixelsPerUnit();
    const center = this.center();
    const parameters = this.parameters();

    for (const inequality of this.inequalities()) {
      if (!inequality.visible || !inequality.compiled) {
        continue;
      }

      const fill = hexToRgba(inequality.color, 0.12);
      ctx.fillStyle = fill;

      for (let px = 0; px <= this.width; px += 1) {
        const worldX = center.x + (px - this.width / 2) / pixelsPerUnit;
        const value = evaluateAt(inequality.compiled, worldX, parameters);
        if (!Number.isFinite(value)) {
          continue;
        }

        const rawY = this.screenY(value);
        const py = clamp(rawY, 0, this.height);

        if (inequality.operator === '>' || inequality.operator === '>=') {
          if (rawY > 0) {
            ctx.fillRect(px, 0, 1, py);
          }
        } else if (rawY < this.height) {
          ctx.fillRect(px, py, 1, this.height - py);
        }
      }

      if (inequality.operator === '>' || inequality.operator === '<') {
        ctx.setLineDash([5, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.strokeStyle = inequality.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let previousY: number | null = null;
      const jumpLimit = Math.max(this.height * 1.25, 160);

      for (let px = 0; px <= this.width; px += 1.5) {
        const worldX = center.x + (px - this.width / 2) / pixelsPerUnit;
        const value = evaluateAt(inequality.compiled, worldX, parameters);
        if (!Number.isFinite(value)) {
          previousY = null;
          continue;
        }
        const py = this.screenY(value);
        if (previousY === null || Math.abs(py - previousY) > jumpLimit) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
        previousY = py;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawAnalysisMarkers(ctx: CanvasRenderingContext2D): void {
    for (const item of this.analyses()) {
      const color = item.fn.color;
      const analysis = item.analysis;

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1.2;

      for (const asymptote of analysis.verticalAsymptotes) {
        const x = this.screenX(asymptote);
        if (x < 0 || x > this.width) {
          continue;
        }
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(snapToPixel(x), 0);
        ctx.lineTo(snapToPixel(x), this.height);
        ctx.stroke();
      }

      for (const asymptote of analysis.horizontalAsymptotes) {
        const y = this.screenY(asymptote.y);
        if (y < 0 || y > this.height) {
          continue;
        }
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([7, 6]);
        ctx.beginPath();
        ctx.moveTo(0, snapToPixel(y));
        ctx.lineTo(this.width, snapToPixel(y));
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.setLineDash([]);

      for (const root of analysis.roots) {
        const x = this.screenX(root);
        if (x < -8 || x > this.width + 8) {
          continue;
        }
        ctx.beginPath();
        ctx.arc(x, this.screenY(0), 3.6, 0, Math.PI * 2);
        ctx.fillStyle = '#080d19';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.stroke();
      }

      for (const point of analysis.maxima) {
        this.drawMarker(ctx, point.x, point.y, 'max', color);
      }
      for (const point of analysis.minima) {
        this.drawMarker(ctx, point.x, point.y, 'min', color);
      }
      for (const point of analysis.inflections) {
        const value = evaluateAt(item.fn.compiled, point, this.parameters());
        if (Number.isFinite(value)) {
          this.drawMarker(ctx, point, value, 'inflection', color);
        }
      }

      ctx.restore();
    }
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    xValue: number,
    yValue: number,
    kind: 'max' | 'min' | 'inflection',
    color: string,
  ): void {
    const x = this.screenX(xValue);
    const y = this.screenY(yValue);
    if (x < -10 || x > this.width + 10 || y < -10 || y > this.height + 10) {
      return;
    }

    ctx.beginPath();
    if (kind === 'inflection') {
      ctx.rect(x - 3.2, y - 3.2, 6.4, 6.4);
    } else if (kind === 'max') {
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x + 5, y + 4);
      ctx.lineTo(x - 5, y + 4);
      ctx.closePath();
    } else {
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x + 5, y - 4);
      ctx.lineTo(x - 5, y - 4);
      ctx.closePath();
    }
    ctx.fillStyle = '#080d19';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const pixelsPerUnit = this.pixelsPerUnit();
    const center = this.center();
    const major = niceStep(GRID_TARGET_PX / pixelsPerUnit);
    const normalized = major / 10 ** Math.floor(Math.log10(major));
    const subdivisions = normalized === 2 ? 4 : 5;
    const minor = major / subdivisions;

    const worldLeft = center.x - this.width / (2 * pixelsPerUnit);
    const worldRight = center.x + this.width / (2 * pixelsPerUnit);
    const worldTop = center.y + this.height / (2 * pixelsPerUnit);
    const worldBottom = center.y - this.height / (2 * pixelsPerUnit);

    ctx.lineWidth = 1;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.beginPath();

    for (let i = Math.ceil(worldLeft / minor); i <= Math.floor(worldRight / minor); i += 1) {
      const value = i * minor;
      if (Math.abs(value / major - Math.round(value / major)) < 1e-9) {
        continue;
      }
      const x = snapToPixel(this.screenX(value));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }

    for (let i = Math.ceil(worldBottom / minor); i <= Math.floor(worldTop / minor); i += 1) {
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

    for (let i = Math.ceil(worldLeft / major); i <= Math.floor(worldRight / major); i += 1) {
      const x = snapToPixel(this.screenX(i * major));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }

    for (let i = Math.ceil(worldBottom / major); i <= Math.floor(worldTop / major); i += 1) {
      const y = snapToPixel(this.screenY(i * major));
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }

    ctx.stroke();
  }

  private drawAxes(ctx: CanvasRenderingContext2D): void {
    const pixelsPerUnit = this.pixelsPerUnit();
    const center = this.center();
    const axisX = this.screenX(0);
    const axisY = this.screenY(0);

    const showYAxis = axisX >= 0 && axisX <= this.width;
    const showXAxis = axisY >= 0 && axisY <= this.height;

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (showXAxis) {
      const y = snapToPixel(axisY);
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    if (showYAxis) {
      const x = snapToPixel(axisX);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    ctx.stroke();

    const major = niceStep(GRID_TARGET_PX / pixelsPerUnit);
    const worldLeft = center.x - this.width / (2 * pixelsPerUnit);
    const worldRight = center.x + this.width / (2 * pixelsPerUnit);
    const worldTop = center.y + this.height / (2 * pixelsPerUnit);
    const worldBottom = center.y - this.height / (2 * pixelsPerUnit);

    ctx.font = '500 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.82)';

    // Etiquetas del eje X.
    const xLabelsInside = axisY >= 18 && axisY <= this.height - 26;
    const xLabelY = xLabelsInside ? axisY + 16 : this.height - 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = xLabelsInside ? 'top' : 'bottom';

    for (let i = Math.ceil(worldLeft / major); i <= Math.floor(worldRight / major); i += 1) {
      if (i === 0) {
        continue;
      }
      const x = this.screenX(i * major);
      if (x < 18 || x > this.width - 18) {
        continue;
      }
      ctx.fillText(this.formatTick(i * major, major), x, xLabelY);
    }

    // Etiquetas del eje Y.
    const yLabelsInside = axisX >= 42 && axisX <= this.width - 14;
    const yLabelX = yLabelsInside ? axisX - 8 : 10;
    ctx.textAlign = yLabelsInside ? 'right' : 'left';
    ctx.textBaseline = 'middle';

    for (let i = Math.ceil(worldBottom / major); i <= Math.floor(worldTop / major); i += 1) {
      if (i === 0) {
        continue;
      }
      const y = this.screenY(i * major);
      if (y < 14 || y > this.height - 14) {
        continue;
      }
      ctx.fillText(this.formatTick(i * major, major), yLabelX, y);
    }

    // Origen y nombres de los ejes.
    if (showXAxis && showYAxis) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('0', axisX - 6, axisY + 6);
    }

    if (showXAxis) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('x', this.width - 8, axisY - 6);
    }

    if (showYAxis) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('y', axisX + 8, 8);
    }
  }

  private drawCurves(ctx: CanvasRenderingContext2D): void {
    const pixelsPerUnit = this.pixelsPerUnit();
    const center = this.center();
    const jumpLimit = Math.max(this.height * 1.25, 160);
    const sampleStep = this.pixelRatio > 1.5 ? 1 : 1.25;

    for (const fn of this.functions()) {
      if (!fn.visible || !fn.compiled) {
        continue;
      }

      ctx.save();
      ctx.strokeStyle = fn.color;
      ctx.lineWidth = 2.1;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      let previousY: number | null = null;

      for (let px = 0; px <= this.width + sampleStep; px += sampleStep) {
        const worldX = center.x + (px - this.width / 2) / pixelsPerUnit;
        const value = evaluateAt(fn.compiled, worldX, this.parameters());

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
          // Salto enorme entre muestras: probable asíntota o discontinuidad.
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }

        previousY = py;
      }

      ctx.stroke();
      ctx.restore();
    }
  }

  private drawOverlay(): void {
    const ctx = this.ctxOverlay;
    if (!ctx) {
      return;
    }

    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const hover = this.hover();
    if (!hover) {
      return;
    }

    const pixelsPerUnit = this.pixelsPerUnit();
    const center = this.center();
    const worldX = center.x + (hover.x - this.width / 2) / pixelsPerUnit;
    const parameters = this.parameters();

    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const x = snapToPixel(hover.x);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, this.height);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const fn of this.functions()) {
      if (!fn.visible || !fn.compiled) {
        continue;
      }

      const value = evaluateAt(fn.compiled, worldX, parameters);
      if (!Number.isFinite(value)) {
        continue;
      }

      const y = this.screenY(value);
      if (y < -12 || y > this.height + 12) {
        continue;
      }

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = fn.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(8, 13, 26, 0.95)';
      ctx.stroke();
    }

    ctx.restore();
  }

  // ------------------------------------------------------------- proyección

  private screenX(worldX: number): number {
    return this.width / 2 + (worldX - this.center().x) * this.pixelsPerUnit();
  }

  private screenY(worldY: number): number {
    return this.height / 2 - (worldY - this.center().y) * this.pixelsPerUnit();
  }

  private formatTick(value: number, step: number): string {
    if (Math.abs(value) < step * 1e-6) {
      return '0';
    }

    const decimals = clamp(-Math.floor(Math.log10(step)), 0, 8);
    return formatDecimal(value, decimals);
  }
}
