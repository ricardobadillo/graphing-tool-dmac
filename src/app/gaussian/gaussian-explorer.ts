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
import { CanvasKeyboard } from '../shared/canvas-keyboard';
import { CanvasSurface } from '../shared/canvas-surface';
import { clamp, niceStep } from '../shared/math-utils';
import { formatDecimal, formatExact } from '../shared/exact-number';
import {
  GAUSSIAN_UNITS,
  associatesOf,
  conjugateGaussian,
  describeGaussianKind,
  divideGaussian,
  formatGaussian,
  formatRationalQuotient,
  gcdGaussian,
  isGaussianPrime,
  isUnit,
  multiplyGaussian,
  norm,
  parseGaussian,
  powerGaussian,
  subtractGaussian,
  addGaussian,
  type GaussianInteger,
  type GaussianQuotient,
  type GcdResult,
} from './gaussian';

type Operation =
  'add' | 'subtract' | 'multiply' | 'divide' | 'conjugate' | 'power' | 'associates' | 'gcd';

interface OperationInfo {
  key: Operation;
  label: string;
  expression: string;
  description: string;
}

interface InfoRow {
  label: string;
  algebraic: string;
  real: string;
  imaginary: string;
  norm: string;
  modulus: string;
  kind: string;
}

interface PlotPoint {
  id: string;
  value: GaussianInteger;
  color: string;
  label: string;
  kind: 'input' | 'result' | 'associate';
}

const MIN_PIXELS_PER_UNIT = 0.001;
const MAX_PIXELS_PER_UNIT = 4_000;
const GRID_TARGET_PX = 80;
const LATTICE_MIN_PX = 7;

function snap(value: number): number {
  return Math.round(value) + 0.5;
}

function superscript(index: number): string {
  return String(index)
    .split('')
    .map((digit) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(digit)] ?? digit)
    .join('');
}

function sameValue(a: GaussianInteger, b: GaussianInteger): boolean {
  return a.re === b.re && a.im === b.im;
}

@Component({
  selector: 'app-gaussian-explorer',
  imports: [CanvasKeyboard],
  templateUrl: './gaussian-explorer.html',
  styleUrl: './gaussian-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaussianExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly operations: OperationInfo[] = [
    {
      key: 'add',
      label: 'Suma',
      expression: 'z + w',
      description:
        'La suma se queda en ℤ[i]: se suman las partes reales y las imaginarias por separado.',
    },
    {
      key: 'subtract',
      label: 'Resta',
      expression: 'z − w',
      description:
        'La resta también es cerrada en ℤ[i]. Geométricamente es el vector que va de w a z.',
    },
    {
      key: 'multiply',
      label: 'Producto',
      expression: 'z · w',
      description: 'El producto usa i² = −1. Además la norma es multiplicativa: N(zw) = N(z)·N(w).',
    },
    {
      key: 'divide',
      label: 'Cociente',
      expression: 'z / w',
      description: 'z/w pertenece a ℤ[i] solo cuando w divide a z. Se comprueba con la norma de w.',
    },
    {
      key: 'conjugate',
      label: 'Conjugado',
      expression: 'z̄',
      description:
        'El conjugado refleja z respecto al eje real, conserva la norma y sigue siendo gaussiano.',
    },
    {
      key: 'power',
      label: 'Potencia',
      expression: 'zⁿ',
      description:
        'Las potencias se obtienen multiplicando z consigo mismo. i² = −1 produce giros de 90°.',
    },
    {
      key: 'associates',
      label: 'Asociados',
      expression: 'z, iz, −z, −iz',
      description:
        'Los cuatro asociados comparten norma y divisibilidad: son el mismo elemento salvo unidades.',
    },
    {
      key: 'gcd',
      label: 'MCD',
      expression: 'mcd(z, w)',
      description:
        'ℤ[i] es un dominio euclídeo. El mcd se calcula con el algoritmo de Euclides usando la norma.',
    },
  ];

  readonly zPresets = ['3 + 4i', '5', '2 − i', '−3 + 2i'];
  readonly wPresets = ['2 + i', '1 + 2i', '3', '1 − i'];

  readonly units = GAUSSIAN_UNITS;

  readonly zInput = signal('3 + 4i');
  readonly wInput = signal('2 + i');
  readonly operation = signal<Operation>('add');
  readonly n = signal(2);

  readonly parsedZ = computed(() => parseGaussian(this.zInput()));
  readonly parsedW = computed(() => parseGaussian(this.wInput()));
  readonly z = computed(() => this.parsedZ().value);
  readonly w = computed(() => this.parsedW().value);

  readonly operationInfo = computed(
    () => this.operations.find((item) => item.key === this.operation()) ?? this.operations[0],
  );
  readonly needsN = computed(() => this.operation() === 'power');
  readonly needsW = computed(() =>
    ['add', 'subtract', 'multiply', 'divide', 'gcd'].includes(this.operation()),
  );

  readonly division = computed<GaussianQuotient | null>(() => {
    const z = this.z();
    const w = this.w();
    return z && w && this.operation() === 'divide' ? divideGaussian(z, w) : null;
  });

  readonly divisionInexact = computed(() => {
    const division = this.division();
    return division && !division.exact ? division : null;
  });

  readonly divisionText = computed(() => {
    const division = this.division();
    return division ? formatRationalQuotient(division) : '—';
  });

  readonly gcdComputation = computed<GcdResult | null>(() => {
    const z = this.z();
    const w = this.w();
    return z && w && this.operation() === 'gcd' ? gcdGaussian(z, w) : null;
  });

  readonly gcdSteps = computed(() => {
    const result = this.gcdComputation();
    if (!result) {
      return [];
    }
    return result.steps.map(
      (step) =>
        `${formatGaussian(step.dividend)} = (${formatGaussian(step.divisor)})·(${formatGaussian(
          step.quotient,
        )}) + ${formatGaussian(step.remainder)}`,
    );
  });

  readonly associates = computed(() => {
    const z = this.z();
    return z ? associatesOf(z) : [];
  });

  readonly result = computed<GaussianInteger | null>(() => {
    const z = this.z();
    const w = this.w();
    if (!z) {
      return null;
    }

    switch (this.operation()) {
      case 'add':
        return w ? addGaussian(z, w) : null;
      case 'subtract':
        return w ? subtractGaussian(z, w) : null;
      case 'multiply':
        return w ? multiplyGaussian(z, w) : null;
      case 'divide':
        return this.division()?.value ?? null;
      case 'conjugate':
        return conjugateGaussian(z);
      case 'power':
        return powerGaussian(z, this.n());
      case 'gcd':
        return this.gcdComputation()?.gcd ?? null;
      case 'associates':
        return null;
    }
  });

  readonly resultLabel = computed(() => {
    switch (this.operation()) {
      case 'add':
        return 'z + w';
      case 'subtract':
        return 'z − w';
      case 'multiply':
        return 'z·w';
      case 'divide':
        return 'z / w';
      case 'conjugate':
        return 'z̄';
      case 'power':
        return `z${superscript(this.n())}`;
      case 'associates':
        return 'asociados';
      case 'gcd':
        return 'mcd(z, w)';
    }
  });

  readonly plotPoints = computed<PlotPoint[]>(() => {
    const z = this.z();
    const w = this.w();
    const operation = this.operation();

    if (operation === 'associates') {
      return this.associates().map((associate) => ({
        id: `associate-${associate.label}`,
        value: associate.value,
        color: '#34d399',
        label: associate.label,
        kind: 'associate' as const,
      }));
    }

    const points: PlotPoint[] = [];
    if (z) {
      points.push({
        id: 'z',
        value: z,
        color: '#38bdf8',
        label: 'z',
        kind: 'input',
      });
    }
    if (w) {
      points.push({
        id: 'w',
        value: w,
        color: '#f472b6',
        label: 'w',
        kind: 'input',
      });
    }

    const result = this.result();
    if (result) {
      points.push({
        id: 'result',
        value: result,
        color: '#a78bfa',
        label: this.resultLabel(),
        kind: 'result',
      });
    }
    return points;
  });

  readonly rows = computed<InfoRow[]>(() => {
    if (this.operation() === 'associates') {
      return this.associates()
        .map((associate) => this.infoFor(associate.label, associate.value))
        .filter((row): row is InfoRow => row !== null);
    }

    const rows: InfoRow[] = [];
    const zInfo = this.infoFor('z', this.z());
    const wInfo = this.infoFor('w', this.w());
    const resultInfo = this.resultInfo();

    if (zInfo) {
      rows.push(zInfo);
    }
    if (wInfo) {
      rows.push(wInfo);
    }
    if (resultInfo) {
      rows.push(resultInfo);
    }
    return rows;
  });

  readonly resultInfo = computed(() => this.infoFor(this.resultLabel(), this.result()));
  readonly zKind = computed(() => {
    const z = this.z();
    return z ? describeGaussianKind(z) : '—';
  });
  readonly zPrime = computed(() => {
    const z = this.z();
    return z ? isGaussianPrime(z) : false;
  });
  readonly zNorm = computed(() => {
    const z = this.z();
    return z ? formatExact(norm(z), { digits: 0 }) : '—';
  });
  readonly zIsUnit = computed(() => {
    const z = this.z();
    return z ? isUnit(z) : false;
  });

  readonly errors = computed(() => {
    const errors: string[] = [];
    if (this.parsedZ().error) {
      errors.push(`z: ${this.parsedZ().error}`);
    }
    if (this.needsW() && this.parsedW().error) {
      errors.push(`w: ${this.parsedW().error}`);
    }
    if (this.operation() === 'power' && this.z() && this.result() === null) {
      errors.push('La potencia supera el tamaño representable. Prueba un exponente menor.');
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
        return 'z/w ∈ ℤ[i] ⇔ N(w) divide a z·w̄';
      case 'conjugate':
        return 'a + bi ↦ a − bi, con N(z̄) = N(z)';
      case 'power':
        return 'zⁿ = z·z⋯z (n factores)';
      case 'associates':
        return '{z, iz, −z, −iz} y N(iz) = N(z)';
      case 'gcd':
        return 'z = w·q + r, con N(r) < N(w)';
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
    return `Re ∈ [${formatDecimal(center.x - halfW, 2)}, ${formatDecimal(
      center.x + halfW,
      2,
    )}] · Im ∈ [${formatDecimal(center.y - halfH, 2)}, ${formatDecimal(center.y + halfH, 2)}]`;
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
  private dragPointId: 'z' | 'w' | null = null;
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
      this.zInput();
      this.wInput();
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

  onZInput(event: Event): void {
    this.zInput.set((event.target as HTMLInputElement).value);
  }

  onWInput(event: Event): void {
    this.wInput.set((event.target as HTMLInputElement).value);
  }

  setOperation(operation: Operation): void {
    this.operation.set(operation);
    this.fitView();
  }

  onNInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.n.set(clamp(Math.round(value), 1, 8));
      this.fitView();
    }
  }

  applyZPreset(value: string): void {
    this.zInput.set(value);
    this.fitView();
  }

  applyWPreset(value: string): void {
    this.wInput.set(value);
    this.fitView();
  }

  formatValue(value: GaussianInteger): string {
    return formatGaussian(value);
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

    let xMin = 0;
    let xMax = 0;
    let yMin = 0;
    let yMax = 0;

    for (const point of this.plotPoints()) {
      xMin = Math.min(xMin, point.value.re);
      xMax = Math.max(xMax, point.value.re);
      yMin = Math.min(yMin, point.value.im);
      yMax = Math.max(yMax, point.value.im);
    }

    const xSpan = Math.max(4, xMax - xMin);
    const ySpan = Math.max(4, yMax - yMin);
    const padding = 0.22;
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
      const value = formatGaussian({
        re: clamp(Math.round(world.x), -100_000, 100_000),
        im: clamp(Math.round(world.y), -100_000, 100_000),
      });
      if (this.dragPointId === 'z') {
        this.zInput.set(value);
      } else {
        this.wInput.set(value);
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

  private hitTest(point: { x: number; y: number }): 'z' | 'w' | null {
    if (this.operation() === 'associates') {
      const z = this.z();
      if (!z) {
        return null;
      }
      const px = this.screenX(z.re);
      const py = this.screenY(z.im);
      return Math.hypot(point.x - px, point.y - py) <= 14 ? 'z' : null;
    }

    const candidates: { id: 'z' | 'w'; value: GaussianInteger | null }[] = [
      { id: 'z', value: this.z() },
      { id: 'w', value: this.w() },
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
    this.drawLattice(ctx);
    this.drawAxes(ctx);
    this.drawOperationHelpers(ctx);
    this.drawPoints(ctx);
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const ppu = this.pixelsPerUnit();
    const center = this.center();
    const major = Math.max(1, niceStep(GRID_TARGET_PX / ppu));
    const subdivisions = major % 2 === 0 ? 4 : 5;
    const minor = major / subdivisions;

    const xMin = center.x - this.width / (2 * ppu);
    const xMax = center.x + this.width / (2 * ppu);
    const yMin = center.y - this.height / (2 * ppu);
    const yMax = center.y + this.height / (2 * ppu);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
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

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.17)';
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

  private drawLattice(ctx: CanvasRenderingContext2D): void {
    const ppu = this.pixelsPerUnit();
    if (ppu < LATTICE_MIN_PX) {
      return;
    }

    const center = this.center();
    const xMin = Math.ceil(center.x - this.width / (2 * ppu));
    const xMax = Math.floor(center.x + this.width / (2 * ppu));
    const yMin = Math.ceil(center.y - this.height / (2 * ppu));
    const yMax = Math.floor(center.y + this.height / (2 * ppu));

    if ((xMax - xMin + 1) * (yMax - yMin + 1) > 25_000) {
      return;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.52)';
    ctx.beginPath();
    for (let x = xMin; x <= xMax; x += 1) {
      const px = this.screenX(x);
      for (let y = yMin; y <= yMax; y += 1) {
        const py = this.screenY(y);
        ctx.moveTo(px + 1.4, py);
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    if (ppu >= 16) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const unit of GAUSSIAN_UNITS) {
        const px = this.screenX(unit.value.re);
        const py = this.screenY(unit.value.im);
        ctx.moveTo(px + 3, py);
        ctx.arc(px, py, 3, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    ctx.restore();
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

    const major = Math.max(1, niceStep(GRID_TARGET_PX / ppu));
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
    const z = this.z();
    const w = this.w();
    const result = this.result();
    const operation = this.operation();

    if (!z) {
      return;
    }

    if (operation === 'associates') {
      this.drawNormCircle(ctx, z, 'rgba(52, 211, 153, 0.3)');
      return;
    }

    if (!result) {
      return;
    }

    if (operation === 'add' && w) {
      this.drawDashedSegment(ctx, z, result, 'rgba(167, 139, 250, 0.4)');
      this.drawDashedSegment(ctx, w, result, 'rgba(167, 139, 250, 0.4)');
    } else if (operation === 'subtract' && w) {
      this.drawDashedSegment(ctx, w, z, 'rgba(167, 139, 250, 0.4)');
    } else if (operation === 'conjugate') {
      this.drawDashedSegment(ctx, z, result, 'rgba(52, 211, 153, 0.5)');
    }
  }

  private drawNormCircle(
    ctx: CanvasRenderingContext2D,
    value: GaussianInteger,
    color: string,
  ): void {
    const radius = Math.sqrt(norm(value)) * this.pixelsPerUnit();
    if (!Number.isFinite(radius) || radius < 2) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(this.screenX(0), this.screenY(0), radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawDashedSegment(
    ctx: CanvasRenderingContext2D,
    a: GaussianInteger,
    b: GaussianInteger,
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

  private drawPoints(ctx: CanvasRenderingContext2D): void {
    const points = this.plotPoints();
    const result = this.result();
    const operation = this.operation();

    if (operation === 'associates') {
      for (const point of points) {
        this.drawPoint(ctx, point.value, point.color, 4);
        this.drawPointLabel(
          ctx,
          point.label,
          this.screenX(point.value.re),
          this.screenY(point.value.im),
          '#6ee7b7',
        );
      }
      return;
    }

    const inputs = points.filter((point) => point.kind === 'input');
    for (const point of inputs) {
      this.drawVector(ctx, point);
    }

    if (result) {
      const coincides = inputs.some((point) => sameValue(point.value, result));
      if (!coincides) {
        this.drawPoint(ctx, result, '#a78bfa', 5);
        this.drawPointLabel(
          ctx,
          this.resultLabel(),
          this.screenX(result.re),
          this.screenY(result.im),
          '#c4b5fd',
        );
      }
    }

    for (const point of inputs) {
      this.drawPoint(ctx, point.value, point.color, 5);
      const label =
        result && sameValue(point.value, result)
          ? `${point.label} = ${this.resultLabel()}`
          : point.label;
      this.drawPointLabel(
        ctx,
        label,
        this.screenX(point.value.re),
        this.screenY(point.value.im),
        point.color,
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
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(px, py);
    ctx.stroke();

    const angle = Math.atan2(py - oy, px - ox);
    const head = 7;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - head * Math.cos(angle - 0.42), py - head * Math.sin(angle - 0.42));
    ctx.lineTo(px - head * Math.cos(angle + 0.42), py - head * Math.sin(angle + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawPoint(
    ctx: CanvasRenderingContext2D,
    point: GaussianInteger,
    color: string,
    radius: number,
  ): void {
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
    ctx.arc(x, y, radius, 0, Math.PI * 2);
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

  private infoFor(label: string, value: GaussianInteger | null): InfoRow | null {
    if (!value) {
      return null;
    }
    return {
      label,
      algebraic: formatGaussian(value),
      real: String(value.re).replace(/-/g, '−'),
      imaginary: String(value.im).replace(/-/g, '−'),
      norm: formatExact(norm(value), { digits: 0 }),
      modulus: formatExact(Math.sqrt(norm(value)), { digits: 2 }),
      kind: describeGaussianKind(value),
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
