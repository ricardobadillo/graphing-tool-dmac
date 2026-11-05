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
import { CURVE_PALETTE, createPlotFunction, evaluateAt, type PlotFunction } from './expression';
import { buildShareUrl, copyShareUrl, decodeShare } from '../share';
import { formatDecimal, formatFraction } from '../number-format';

const MIN_PIXELS_PER_UNIT = 0.0005;
const MAX_PIXELS_PER_UNIT = 200_000;
const GRID_TARGET_PX = 84;
const INITIAL_X_RANGE = 22;

interface PlotShareData {
  functions: { expression: string; color: string; visible: boolean }[];
  centerX: number;
  centerY: number;
  pixelsPerUnit: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Alinea una coordenada al píxel para que las líneas de 1px se vean nítidas. */
function snapToPixel(value: number): number {
  return Math.round(value) + 0.5;
}

/** Devuelve un paso "bonito" (1, 2 o 5 × 10^n) cercano al objetivo. */
function niceStep(target: number): number {
  const raw = Math.max(target, Number.MIN_VALUE);
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const factor = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return factor * power;
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

  private readonly center = signal<Viewport>({ x: 0, y: 0 });
  readonly pixelsPerUnit = signal(48);
  readonly size = signal<Size>({ w: 0, h: 0 });

  readonly hover = signal<PointerPosition | null>(null);
  readonly dragging = signal(false);
  readonly toast = signal<string | null>(null);
  private toastTimer: number | null = null;

  readonly presets = ['sin(x)', 'x^2', '1 / x', 'e^x', 'ln(x)', 'sqrt(x)'];

  readonly hoverData = computed(() => {
    const hover = this.hover();
    const { w } = this.size();
    const pixelsPerUnit = this.pixelsPerUnit();
    if (!hover || w <= 0) {
      return null;
    }

    const worldX = this.center().x + (hover.x - w / 2) / pixelsPerUnit;
    const values = this.functions()
      .filter((fn) => fn.visible && fn.compiled)
      .map((fn) => ({
        id: fn.id,
        color: fn.color,
        expression: fn.expression,
        value: evaluateAt(fn.compiled!, worldX),
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

  private ctxBase: CanvasRenderingContext2D | null = null;
  private ctxOverlay: CanvasRenderingContext2D | null = null;

  private width = 0;
  private height = 0;
  private pixelRatio = 1;

  private resizeObserver: ResizeObserver | null = null;
  private baseFrame = 0;
  private overlayFrame = 0;
  private baseFallback = 0;
  private overlayFallback = 0;
  private viewInitialized = false;

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
      this.center();
      this.pixelsPerUnit();
      this.size();
      this.scheduleBaseDraw();
    });

    effect(() => {
      this.hover();
      this.functions();
      this.center();
      this.pixelsPerUnit();
      this.size();
      this.scheduleOverlayDraw();
    });

    afterNextRender(() => {
      // Evita inicializar el canvas en entornos sin implementación (por ejemplo, jsdom).
      if (typeof CanvasRenderingContext2D === 'undefined') {
        return;
      }

      const base = this.baseCanvas().nativeElement;
      const container = base.parentElement;

      this.ctxBase = base.getContext('2d');
      this.ctxOverlay = this.overlayCanvas().nativeElement.getContext('2d');

      if (container && typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(container);
      }

      base.addEventListener('wheel', this.onWheel, { passive: false });
      this.resize();
      this.restoreFromShareLink();

      this.destroyRef.onDestroy(() => {
        this.resizeObserver?.disconnect();
        base.removeEventListener('wheel', this.onWheel);
        cancelAnimationFrame(this.baseFrame);
        cancelAnimationFrame(this.overlayFrame);
        clearTimeout(this.baseFallback);
        clearTimeout(this.overlayFallback);
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
    return formatDecimal(value, 3);
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

  private panBy(dx: number, dy: number): void {
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
    const base = this.baseCanvas().nativeElement;
    const overlay = this.overlayCanvas().nativeElement;
    const container = base.parentElement;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2.5);

    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) {
      return;
    }

    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;

    for (const canvas of [base, overlay]) {
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
    }

    this.size.set({ w: width, h: height });

    if (!this.viewInitialized && width > 20 && height > 20) {
      this.viewInitialized = true;
      this.resetView();
    }

    this.scheduleBaseDraw();
    this.scheduleOverlayDraw();
  }

  private scheduleBaseDraw(): void {
    if (!this.ctxBase || this.baseFrame) {
      return;
    }

    this.baseFrame = requestAnimationFrame(() => {
      cancelAnimationFrame(this.baseFrame);
      clearTimeout(this.baseFallback);
      this.baseFrame = 0;
      this.baseFallback = 0;
      this.drawBase();
    });

    // Respaldo para pestañas o entornos donde rAF está limitado.
    this.baseFallback = window.setTimeout(() => {
      cancelAnimationFrame(this.baseFrame);
      this.baseFrame = 0;
      this.baseFallback = 0;
      this.drawBase();
    }, 90);
  }

  private scheduleOverlayDraw(): void {
    if (!this.ctxOverlay || this.overlayFrame) {
      return;
    }

    this.overlayFrame = requestAnimationFrame(() => {
      cancelAnimationFrame(this.overlayFrame);
      clearTimeout(this.overlayFallback);
      this.overlayFrame = 0;
      this.overlayFallback = 0;
      this.drawOverlay();
    });

    this.overlayFallback = window.setTimeout(() => {
      cancelAnimationFrame(this.overlayFrame);
      this.overlayFrame = 0;
      this.overlayFallback = 0;
      this.drawOverlay();
    }, 90);
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
    this.drawCurves(ctx);
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
        const value = evaluateAt(fn.compiled, worldX);

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

      const value = evaluateAt(fn.compiled, worldX);
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
