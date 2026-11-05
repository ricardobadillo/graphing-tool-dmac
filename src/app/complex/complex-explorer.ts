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
  add,
  argument,
  conjugate,
  divide,
  formatAngle,
  formatComplex,
  formatPolar,
  modulus,
  multiply,
  nthRoots,
  parseComplex,
  power,
  subtract,
  type AngleUnit,
  type Complex,
} from './complex';
import { CanvasKeyboard } from '../shared/canvas-keyboard';
import { CanvasSurface } from '../shared/canvas-surface';
import { clamp, niceStep } from '../shared/math-utils';
import { formatDecimal, formatExact } from '../shared/exact-number';

type Operation = 'add' | 'subtract' | 'multiply' | 'divide' | 'conjugate' | 'power' | 'roots';

interface OperationInfo {
  key: Operation;
  label: string;
  expression: string;
  description: string;
}

interface InfoRow {
  label: string;
  algebraic: string;
  polar: string;
  modulus: string;
  argument: string;
}

interface PlotPoint {
  id: string;
  value: Complex;
  color: string;
  label: string;
  kind: 'input' | 'result' | 'root';
}

const MIN_PIXELS_PER_UNIT = 0.001;
const MAX_PIXELS_PER_UNIT = 200_000;
const GRID_TARGET_PX = 84;

function snap(value: number): number {
  return Math.round(value) + 0.5;
}

function subscript(index: number): string {
  return String(index)
    .split('')
    .map((digit) => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)] ?? digit)
    .join('');
}

function superscript(index: number): string {
  return String(index)
    .split('')
    .map((digit) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)] ?? digit)
    .join('');
}

@Component({
  selector: 'app-complex-explorer',
  imports: [CanvasKeyboard],
  templateUrl: './complex-explorer.html',
  styleUrl: './complex-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComplexExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly operations: OperationInfo[] = [
    {
      key: 'add',
      label: 'Suma',
      expression: 'z₁ + z₂',
      description:
        'La suma es la diagonal del paralelogramo formado por z₁ y z₂. Se suman parte real e imaginaria.',
    },
    {
      key: 'subtract',
      label: 'Resta',
      expression: 'z₁ − z₂',
      description:
        'La resta es el vector que va del punto z₂ al punto z₁. Se restan parte real e imaginaria.',
    },
    {
      key: 'multiply',
      label: 'Producto',
      expression: 'z₁ · z₂',
      description:
        'Los módulos se multiplican y los argumentos se suman: |z₁z₂| = |z₁||z₂| y arg(z₁z₂) = θ₁ + θ₂.',
    },
    {
      key: 'divide',
      label: 'Cociente',
      expression: 'z₁ / z₂',
      description:
        'Los módulos se dividen y los argumentos se restan: |z₁/z₂| = |z₁|/|z₂| y arg(z₁/z₂) = θ₁ − θ₂.',
    },
    {
      key: 'conjugate',
      label: 'Conjugado',
      expression: 'z̄₁',
      description:
        'El conjugado cambia el signo de la parte imaginaria: es un reflejo respecto al eje real.',
    },
    {
      key: 'power',
      label: 'Potencia',
      expression: 'z₁ⁿ',
      description:
        'De Moivre: zⁿ = rⁿ ∠ nθ. El módulo se eleva a n y el argumento se multiplica por n.',
    },
    {
      key: 'roots',
      label: 'Raíces',
      expression: 'z₁^(1/n)',
      description:
        'Las n raíces se reparten cada 2π/n sobre una circunferencia de radio |z₁|^(1/n).',
    },
  ];

  readonly z1Presets = ['3 + 4i', '-2 + i', '1 - i', '2∠60°'];
  readonly z2Presets = ['1 + 2i', '-1 + 3i', '2∠45°', '-i'];

  readonly z1Input = signal('3 + 4i');
  readonly z2Input = signal('1 + 2i');
  readonly angleUnit = signal<AngleUnit>('deg');
  readonly operation = signal<Operation>('add');
  readonly n = signal(3);

  readonly parsedZ1 = computed(() => parseComplex(this.z1Input(), this.angleUnit()));
  readonly parsedZ2 = computed(() => parseComplex(this.z2Input(), this.angleUnit()));
  readonly z1 = computed(() => this.parsedZ1().value);
  readonly z2 = computed(() => this.parsedZ2().value);
  readonly operationInfo = computed(
    () => this.operations.find((item) => item.key === this.operation()) ?? this.operations[0],
  );
  readonly needsN = computed(() => this.operation() === 'power' || this.operation() === 'roots');

  readonly result = computed<Complex | null>(() => {
    const z1 = this.z1();
    const z2 = this.z2();
    const operation = this.operation();

    if (!z1) {
      return null;
    }

    if (operation === 'conjugate') {
      return conjugate(z1);
    }
    if (operation === 'power') {
      return power(z1, this.n());
    }
    if (operation === 'roots') {
      return null;
    }

    if (!z2) {
      return null;
    }

    switch (operation) {
      case 'add':
        return add(z1, z2);
      case 'subtract':
        return subtract(z1, z2);
      case 'multiply':
        return multiply(z1, z2);
      case 'divide': {
        const value = divide(z1, z2);
        return Number.isFinite(value.re) && Number.isFinite(value.im) ? value : null;
      }
      default:
        return null;
    }
  });

  readonly roots = computed<Complex[]>(() => {
    const z1 = this.z1();
    return z1 && this.operation() === 'roots' ? nthRoots(z1, this.n()) : [];
  });

  readonly resultLabel = computed(() => {
    switch (this.operation()) {
      case 'add':
        return 'z₁ + z₂';
      case 'subtract':
        return 'z₁ − z₂';
      case 'multiply':
        return 'z₁ · z₂';
      case 'divide':
        return 'z₁ / z₂';
      case 'conjugate':
        return 'z̄₁';
      case 'power':
        return `z₁${superscript(this.n())}`;
      case 'roots':
        return 'raíces';
    }
  });

  readonly plotPoints = computed<PlotPoint[]>(() => {
    const points: PlotPoint[] = [];
    const z1 = this.z1();
    const z2 = this.z2();
    const operation = this.operation();

    if (z1) {
      points.push({
        id: 'z1',
        value: z1,
        color: '#38bdf8',
        label: 'z₁',
        kind: 'input',
      });
    }

    if (z2) {
      points.push({
        id: 'z2',
        value: z2,
        color: '#f472b6',
        label: 'z₂',
        kind: 'input',
      });
    }

    if (operation === 'roots') {
      this.roots().forEach((value, index) => {
        points.push({
          id: `root-${index}`,
          value,
          color: '#34d399',
          label: this.n() <= 6 ? `w${subscript(index)}` : '',
          kind: 'root',
        });
      });
    } else {
      const result = this.result();
      if (result) {
        points.push({
          id: 'result',
          value: result,
          color: operation === 'conjugate' ? '#34d399' : '#a78bfa',
          label: this.resultLabel(),
          kind: 'result',
        });
      }
    }

    return points;
  });

  readonly z1Info = computed(() => this.infoFor('z₁', this.z1()));
  readonly z2Info = computed(() => this.infoFor('z₂', this.z2()));
  readonly resultInfo = computed(() => this.infoFor(this.resultLabel(), this.result()));
  readonly rootsInfo = computed<InfoRow[]>(() =>
    this.roots()
      .map((value, index) => this.infoFor(`w${subscript(index)}`, value))
      .filter((row): row is InfoRow => row !== null),
  );

  readonly valuesRows = computed<InfoRow[]>(() => {
    const rows: InfoRow[] = [];
    if (this.z1Info()) {
      rows.push(this.z1Info()!);
    }
    if (this.z2Info()) {
      rows.push(this.z2Info()!);
    }
    if (this.operation() === 'roots') {
      rows.push(...this.rootsInfo());
    } else if (this.resultInfo()) {
      rows.push(this.resultInfo()!);
    }
    return rows;
  });

  readonly errors = computed(() => {
    const errors: string[] = [];
    if (this.parsedZ1().error) {
      errors.push(`z₁: ${this.parsedZ1().error}`);
    }
    if (
      this.parsedZ2().error &&
      this.operation() !== 'conjugate' &&
      this.operation() !== 'power' &&
      this.operation() !== 'roots'
    ) {
      errors.push(`z₂: ${this.parsedZ2().error}`);
    }
    return errors;
  });

  readonly formulaHint = computed(() => {
    switch (this.operation()) {
      case 'add':
        return '(a + bi) + (c + di) = (a + c) + (b + d)i';
      case 'subtract':
        return '(a + bi) − (c + di) = (a − c) + (b − d)i';
      case 'multiply':
        return '(a + bi)(c + di) = (ac − bd) + (ad + bc)i';
      case 'divide':
        return 'z₁/z₂ = z₁·z̄₂ / |z₂|²';
      case 'conjugate':
        return 'a + bi → a − bi';
      case 'power':
        return 'zⁿ = rⁿ ∠ nθ';
      case 'roots':
        return `wₖ = r^(1/n) ∠ (θ + 2πk)/n, k = 0…n−1`;
    }
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
    return `Re ∈ [${formatDecimal(center.x - halfW, 2)}, ${formatDecimal(center.x + halfW, 2)}] · Im ∈ [${formatDecimal(center.y - halfH, 2)}, ${formatDecimal(center.y + halfH, 2)}]`;
  });

  readonly center = signal({ x: 0, y: 0 });
  readonly pixelsPerUnit = signal(48);
  readonly size = signal({ w: 0, h: 0 });
  readonly dragging = signal(false);

  private surface: CanvasSurface | null = null;
  private viewInitialized = false;

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
  private dragPointId: 'z1' | 'z2' | null = null;
  private panStart: { px: number; py: number; cx: number; cy: number; moved: boolean } | null =
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
      this.z1Input();
      this.z2Input();
      this.angleUnit();
      this.operation();
      this.n();
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
      if (!container) {
        return;
      }

      this.surface = new CanvasSurface({
        canvas,
        container,
        draw: () => this.draw(),
        onResize: (size) => {
          this.size.set(size);
          if (!this.viewInitialized && size.w > 20 && size.h > 20) {
            this.viewInitialized = true;
            this.fitView();
          }
        },
      });
      canvas.addEventListener('wheel', this.onWheel, { passive: false });
      this.surface.resize();

      this.destroyRef.onDestroy(() => {
        canvas.removeEventListener('wheel', this.onWheel);
        this.surface?.destroy();
      });
    });
  }

  // ------------------------------------------------------------------ acciones

  onZ1Input(event: Event): void {
    this.z1Input.set((event.target as HTMLInputElement).value);
  }

  onZ2Input(event: Event): void {
    this.z2Input.set((event.target as HTMLInputElement).value);
  }

  setAngleUnit(unit: AngleUnit): void {
    this.angleUnit.set(unit);
  }

  setOperation(operation: Operation): void {
    this.operation.set(operation);
    this.fitView();
  }

  onNInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.n.set(clamp(Math.round(value), 2, 16));
      this.fitView();
    }
  }

  applyZ1Preset(value: string): void {
    this.z1Input.set(value);
  }

  applyZ2Preset(value: string): void {
    this.z2Input.set(value);
  }

  panBy(dx: number, dy: number): void {
    const ppu = this.pixelsPerUnit();
    this.center.update((center) => ({ x: center.x - dx / ppu, y: center.y + dy / ppu }));
  }

  zoomBy(factor: number, anchor?: { x: number; y: number }): void {
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

  fitView(): void {
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) {
      return;
    }

    const points = this.plotPoints().map((point) => point.value);
    let xMin = 0;
    let xMax = 0;
    let yMin = 0;
    let yMax = 0;

    for (const point of points) {
      if (!Number.isFinite(point.re) || !Number.isFinite(point.im)) {
        continue;
      }
      xMin = Math.min(xMin, point.re);
      xMax = Math.max(xMax, point.re);
      yMin = Math.min(yMin, point.im);
      yMax = Math.max(yMax, point.im);
    }

    const xSpan = Math.max(2, xMax - xMin);
    const ySpan = Math.max(2, yMax - yMin);
    const padding = 0.18;
    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;
    const ppu = clamp(
      Math.min(w / (xSpan * (1 + padding * 2)), h / (ySpan * (1 + padding * 2))) * 0.9,
      MIN_PIXELS_PER_UNIT,
      MAX_PIXELS_PER_UNIT,
    );

    this.pixelsPerUnit.set(ppu);
    this.center.set({ x: centerX, y: centerY });
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
      // Ignorar.
    }

    const point = this.localPoint(event);
    const hit = this.hitTest(point);
    if (hit) {
      this.dragPointId = hit;
      this.dragging.set(true);
      return;
    }

    const center = this.center();
    this.panStart = {
      px: point.x,
      py: point.y,
      cx: center.x,
      cy: center.y,
      moved: false,
    };
  }

  onPointerMove(event: PointerEvent): void {
    const point = this.localPoint(event);

    if (this.dragPointId) {
      const world = this.screenToWorld(point);
      const value = formatComplex(
        { re: Math.round(world.x * 100) / 100, im: Math.round(world.y * 100) / 100 },
        2,
      );
      if (this.dragPointId === 'z1') {
        this.z1Input.set(value);
      } else {
        this.z2Input.set(value);
      }
      return;
    }

    if (!this.panStart) {
      return;
    }

    const dx = point.x - this.panStart.px;
    const dy = point.y - this.panStart.py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      this.panStart.moved = true;
    }
    if (this.panStart.moved) {
      const ppu = this.pixelsPerUnit();
      this.center.set({
        x: this.panStart.cx - dx / ppu,
        y: this.panStart.cy + dy / ppu,
      });
      this.dragging.set(true);
    }
  }

  onPointerUp(event: PointerEvent): void {
    const canvas = this.canvasRef().nativeElement;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignorar.
    }
    this.dragPointId = null;
    this.panStart = null;
    this.dragging.set(false);
  }

  onPointerLeave(): void {
    if (!this.dragPointId && !this.panStart) {
      this.dragging.set(false);
    }
  }

  private hitTest(point: { x: number; y: number }): 'z1' | 'z2' | null {
    const candidates: { id: 'z1' | 'z2'; value: Complex | null }[] = [
      { id: 'z1', value: this.z1() },
      { id: 'z2', value: this.z2() },
    ];

    for (const candidate of candidates) {
      if (!candidate.value) {
        continue;
      }
      const px = this.screenX(candidate.value.re);
      const py = this.screenY(candidate.value.im);
      if (Math.hypot(point.x - px, point.y - py) <= 14) {
        return candidate.id;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------- canvas

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

    this.drawGrid(ctx);
    this.drawAxes(ctx);
    this.drawOperationHelpers(ctx);
    this.drawPoints(ctx);
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
      const x = snap(this.screenX(value));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let i = Math.ceil(yMin / minor); i <= Math.floor(yMax / minor); i += 1) {
      const value = i * minor;
      if (Math.abs(value / major - Math.round(value / major)) < 1e-9) {
        continue;
      }
      const y = snap(this.screenY(value));
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.beginPath();
    for (let i = Math.ceil(xMin / major); i <= Math.floor(xMax / major); i += 1) {
      const x = snap(this.screenX(i * major));
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let i = Math.ceil(yMin / major); i <= Math.floor(yMax / major); i += 1) {
      const y = snap(this.screenY(i * major));
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
      const y = snap(axisY);
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    if (showY) {
      const x = snap(axisX);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    ctx.stroke();

    const major = niceStep(GRID_TARGET_PX / ppu);
    const xMin = center.x - this.width / (2 * ppu);
    const xMax = center.x + this.width / (2 * ppu);
    const yMin = center.y - this.height / (2 * ppu);
    const yMax = center.y + this.height / (2 * ppu);

    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(203, 213, 225, 0.82)';

    const xLabelsInside = axisY >= 16 && axisY <= this.height - 22;
    const xLabelY = xLabelsInside ? axisY + 15 : this.height - 7;
    ctx.textAlign = 'center';
    ctx.textBaseline = xLabelsInside ? 'top' : 'bottom';
    for (let i = Math.ceil(xMin / major); i <= Math.floor(xMax / major); i += 1) {
      if (i === 0) {
        continue;
      }
      const x = this.screenX(i * major);
      if (x < 16 || x > this.width - 16) {
        continue;
      }
      ctx.fillText(formatDecimal(i * major, 2), x, xLabelY);
    }

    const yLabelsInside = axisX >= 34 && axisX <= this.width - 10;
    const yLabelX = yLabelsInside ? axisX - 7 : 8;
    ctx.textAlign = yLabelsInside ? 'right' : 'left';
    ctx.textBaseline = 'middle';
    for (let i = Math.ceil(yMin / major); i <= Math.floor(yMax / major); i += 1) {
      if (i === 0) {
        continue;
      }
      const y = this.screenY(i * major);
      if (y < 12 || y > this.height - 12) {
        continue;
      }
      ctx.fillText(formatDecimal(i * major, 2), yLabelX, y);
    }

    if (showX && showY) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('0', axisX - 5, axisY + 5);
    }
    if (showX) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Re', this.width - 8, axisY - 5);
    }
    if (showY) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Im', axisX + 7, 7);
    }
  }

  private drawOperationHelpers(ctx: CanvasRenderingContext2D): void {
    const z1 = this.z1();
    const z2 = this.z2();
    const result = this.result();
    const operation = this.operation();

    if (!z1) {
      return;
    }

    if (operation === 'roots') {
      const roots = this.roots();
      if (roots.length === 0) {
        return;
      }
      const radius = modulus(roots[0]);
      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(this.screenX(0), this.screenY(0), radius * this.pixelsPerUnit(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (roots.length > 2) {
        ctx.save();
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        roots.forEach((root, index) => {
          const x = this.screenX(root.re);
          const y = this.screenY(root.im);
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    if (!result) {
      return;
    }

    if (operation === 'conjugate') {
      this.drawDashedSegment(ctx, z1, result, 'rgba(52, 211, 153, 0.45)');
      return;
    }

    if (operation === 'power') {
      this.drawAngleArc(ctx, argument(result), 'rgba(167, 139, 250, 0.7)', this.resultLabel());
      return;
    }

    if (!z2) {
      return;
    }

    if (operation === 'add') {
      this.drawDashedSegment(ctx, z1, result, 'rgba(167, 139, 250, 0.45)');
      this.drawDashedSegment(ctx, z2, result, 'rgba(167, 139, 250, 0.45)');
    } else if (operation === 'subtract') {
      this.drawDashedSegment(ctx, z2, z1, 'rgba(167, 139, 250, 0.45)');
    } else if (operation === 'multiply' || operation === 'divide') {
      const angle = argument(result);
      this.drawAngleArc(ctx, angle, 'rgba(167, 139, 250, 0.7)', this.resultLabel());
    }
  }

  private drawDashedSegment(
    ctx: CanvasRenderingContext2D,
    a: Complex,
    b: Complex,
    color: string,
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(this.screenX(a.re), this.screenY(a.im));
    ctx.lineTo(this.screenX(b.re), this.screenY(b.im));
    ctx.stroke();
    ctx.restore();
  }

  private drawAngleArc(
    ctx: CanvasRenderingContext2D,
    angle: number,
    color: string,
    label: string,
  ): void {
    if (!Number.isFinite(angle) || Math.abs(angle) < 1e-4) {
      return;
    }

    const cx = this.screenX(0);
    const cy = this.screenY(0);
    const radius = 52;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, -angle, angle > 0);
    ctx.stroke();

    const mid = angle / 2;
    const lx = cx + (radius + 14) * Math.cos(mid);
    const ly = cy - (radius + 14) * Math.sin(mid);
    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8, 13, 25, 0.88)';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = 'rgba(221, 214, 254, 0.95)';
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }

  private drawPoints(ctx: CanvasRenderingContext2D): void {
    const points = this.plotPoints();
    const roots = this.operation() === 'roots';

    for (const point of points) {
      if (point.kind === 'input' && !roots) {
        this.drawVector(ctx, point);
      }
    }

    if (this.operation() !== 'roots' && this.result()) {
      const resultPoint = points.find((point) => point.id === 'result');
      if (resultPoint) {
        this.drawVector(ctx, resultPoint);
      }
    }

    if (this.operation() === 'conjugate') {
      const z1 = this.z1();
      const result = this.result();
      if (z1 && result) {
        this.drawPoint(ctx, z1, '#38bdf8');
        this.drawPoint(ctx, result, '#34d399');
        this.drawPointLabel(ctx, 'z₁', this.screenX(z1.re), this.screenY(z1.im), '#7dd3fc');
        this.drawPointLabel(ctx, 'z̄₁', this.screenX(result.re), this.screenY(result.im), '#6ee7b7');
      }
      return;
    }

    if (this.operation() === 'roots') {
      const z1 = this.z1();
      if (z1) {
        this.drawVector(ctx, {
          id: 'z1',
          value: z1,
          color: '#38bdf8',
          label: 'z₁',
          kind: 'input',
        });
      }
      for (const point of points.filter((item) => item.kind === 'root')) {
        this.drawPoint(ctx, point.value, point.color);
        if (point.label) {
          this.drawPointLabel(
            ctx,
            point.label,
            this.screenX(point.value.re),
            this.screenY(point.value.im),
            '#6ee7b7',
          );
        }
      }
      return;
    }

    for (const point of points.filter((item) => item.kind === 'input')) {
      this.drawPoint(ctx, point.value, point.color);
      this.drawPointLabel(
        ctx,
        point.label,
        this.screenX(point.value.re),
        this.screenY(point.value.im),
        point.color,
      );
    }

    const result = this.result();
    if (result) {
      this.drawPoint(ctx, result, '#a78bfa');
      this.drawPointLabel(
        ctx,
        this.resultLabel(),
        this.screenX(result.re),
        this.screenY(result.im),
        '#c4b5fd',
      );
    }
  }

  private drawVector(ctx: CanvasRenderingContext2D, point: PlotPoint): void {
    const ox = this.screenX(0);
    const oy = this.screenY(0);
    const px = this.screenX(point.value.re);
    const py = this.screenY(point.value.im);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = point.color;
    ctx.fillStyle = point.color;
    ctx.lineWidth = 1.9;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(px, py);
    ctx.stroke();

    const angle = Math.atan2(py - oy, px - ox);
    const head = 8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - head * Math.cos(angle - 0.42), py - head * Math.sin(angle - 0.42));
    ctx.lineTo(px - head * Math.cos(angle + 0.42), py - head * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawPoint(ctx: CanvasRenderingContext2D, point: Complex, color: string): void {
    const x = this.screenX(point.re);
    const y = this.screenY(point.im);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    if (x < -30 || x > this.width + 30 || y < -30 || y > this.height + 30) {
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(8, 13, 25, 0.95)';
    ctx.stroke();
    ctx.restore();
  }

  private drawPointLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    y: number,
    color: string,
  ): void {
    if (!label) {
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

  private infoFor(label: string, value: Complex | null): InfoRow | null {
    if (!value || !Number.isFinite(value.re) || !Number.isFinite(value.im)) {
      return null;
    }
    return {
      label,
      algebraic: formatComplex(value),
      polar: formatPolar(value, this.angleUnit()),
      modulus: formatExact(modulus(value)),
      argument: formatAngle(argument(value), this.angleUnit()),
    };
  }

  // -------------------------------------------------------------- proyección

  private localPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private screenToWorld(point: { x: number; y: number }): { x: number; y: number } {
    const ppu = this.pixelsPerUnit();
    const center = this.center();
    return {
      x: center.x + (point.x - this.width / 2) / ppu,
      y: center.y + (this.height / 2 - point.y) / ppu,
    };
  }

  private screenX(value: number): number {
    return this.width / 2 + (value - this.center().x) * this.pixelsPerUnit();
  }

  private screenY(value: number): number {
    return this.height / 2 - (value - this.center().y) * this.pixelsPerUnit();
  }
}
