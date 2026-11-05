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
  addVec,
  angleBetween,
  cross,
  dot,
  eigenvalues,
  matApply,
  matDeterminant,
  matInverse,
  matMultiply,
  matRank,
  matTrace,
  matrixKind,
  norm,
  parseScalar,
  projectVec,
  solveSystem,
  subtractVec,
  unit,
  type EigenResult,
  type Mat2,
  type ParsedScalar,
  type SystemResult,
  type Vec2,
} from './linear';

type Mode = 'vectors' | 'transform' | 'systems';
type VectorOp = 'add' | 'subtract' | 'dot' | 'projection' | 'angle' | 'area';
type VectorField = 'ux' | 'uy' | 'vx' | 'vy';
type MatrixField = 'a' | 'b' | 'c' | 'd';
type SystemField = 'a1' | 'b1' | 'c1' | 'a2' | 'b2' | 'c2';
type DragTarget = 'u' | 'v' | 'test';

interface ModeInfo {
  key: Mode;
  label: string;
  title: string;
  subtitle: string;
  expression: string;
}

interface OperationInfo {
  key: VectorOp;
  label: string;
  expression: string;
  description: string;
}

interface VectorRow {
  label: string;
  x: string;
  y: string;
  length: string;
}

interface MatrixRow {
  label: string;
  a: string;
  b: string;
  c: string;
  d: string;
  determinant: string;
}

interface SystemRow {
  label: string;
  a: string;
  b: string;
  c: string;
}

interface MatrixPreset {
  label: string;
  a: string;
  b: string;
  c: string;
  d: string;
}

interface SystemPreset {
  label: string;
  a1: string;
  b1: string;
  c1: string;
  a2: string;
  b2: string;
  c2: string;
}

interface VectorAnswer {
  label: string;
  primary: string;
  secondary: string;
  formula: string;
}

const MIN_PIXELS_PER_UNIT = 0.001;
const MAX_PIXELS_PER_UNIT = 4_000;
const GRID_TARGET_PX = 78;
const EPS = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snap(value: number): number {
  return Math.round(value) + 0.5;
}

function niceStep(target: number): number {
  const raw = Math.max(target, Number.MIN_VALUE);
  const power = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / power;
  const factor = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return factor * power;
}

function samePoint(a: Vec2, b: Vec2): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
}

@Component({
  selector: 'app-linear-explorer',
  templateUrl: './linear-explorer.html',
  styleUrl: './linear-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinearExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly modes: ModeInfo[] = [
    {
      key: 'vectors',
      label: 'Vectores',
      title: 'Vectores en el plano',
      subtitle: 'Arrastra u y v · suma, resta, producto punto, proyección y área',
      expression: 'u, v ∈ ℝ²',
    },
    {
      key: 'transform',
      label: 'Transformaciones',
      title: 'Matrices y transformaciones 2×2',
      subtitle: 'Matriz A sobre la cuadrícula, el cuadrado unitario y la circunferencia',
      expression: 'A : ℝ² → ℝ²',
    },
    {
      key: 'systems',
      label: 'Sistemas',
      title: 'Sistemas de ecuaciones 2×2',
      subtitle: 'Dos rectas: solución única, infinitas soluciones o ninguna',
      expression: 'a₁x + b₁y = c₁',
    },
  ];

  readonly vectorOps: OperationInfo[] = [
    {
      key: 'add',
      label: 'Suma',
      expression: 'u + v',
      description: 'La suma es la diagonal del paralelogramo formado por u y v.',
    },
    {
      key: 'subtract',
      label: 'Resta',
      expression: 'u − v',
      description: 'La resta es el vector que va del extremo de v al extremo de u.',
    },
    {
      key: 'dot',
      label: 'Producto punto',
      expression: 'u · v',
      description: 'u·v = |u||v|cos θ. Vale 0 cuando los vectores son perpendiculares.',
    },
    {
      key: 'projection',
      label: 'Proyección',
      expression: 'proyᵤ v',
      description: 'Proyección de v sobre la dirección de u: (u·v / |u|²) u.',
    },
    {
      key: 'angle',
      label: 'Ángulo',
      expression: '∠(u, v)',
      description: 'Ángulo entre los vectores, calculado con u·v = |u||v|cos θ.',
    },
    {
      key: 'area',
      label: 'Área',
      expression: '|u × v|',
      description: 'Área del paralelogramo: el valor absoluto del producto cruz 2D.',
    },
  ];

  readonly matrixPresets: MatrixPreset[] = [
    { label: 'Identidad', a: '1', b: '0', c: '0', d: '1' },
    { label: 'Rotación 45°', a: '0.7071', b: '-0.7071', c: '0.7071', d: '0.7071' },
    { label: 'Reflexión eje x', a: '1', b: '0', c: '0', d: '-1' },
    { label: 'Escala', a: '1.6', b: '0', c: '0', d: '0.6' },
    { label: 'Cizalla', a: '1', b: '1', c: '0', d: '1' },
    { label: 'Proyección', a: '1', b: '0', c: '0', d: '0' },
    { label: 'Singular', a: '1', b: '2', c: '2', d: '4' },
  ];

  readonly systemPresets: SystemPreset[] = [
    { label: 'Única', a1: '1', b1: '1', c1: '4', a2: '1', b2: '-1', c2: '0' },
    { label: 'Paralelas', a1: '1', b1: '1', c1: '1', a2: '1', b2: '1', c2: '3' },
    { label: 'Coincidentes', a1: '1', b1: '2', c1: '4', a2: '2', b2: '4', c2: '8' },
  ];

  readonly uPresets: Vec2[] = [
    { x: 3, y: 1 },
    { x: -2, y: 3 },
    { x: 1, y: 0 },
  ];
  readonly vPresets: Vec2[] = [
    { x: 1, y: 3 },
    { x: 2, y: -1 },
    { x: 0, y: 1 },
  ];

  readonly mode = signal<Mode>('vectors');
  readonly modeInfo = computed(
    () => this.modes.find((item) => item.key === this.mode()) ?? this.modes[0],
  );

  // ------------------------------------------------------------------ vectores

  readonly uxInput = signal('3');
  readonly uyInput = signal('1');
  readonly vxInput = signal('1');
  readonly vyInput = signal('3');
  readonly vectorOp = signal<VectorOp>('add');

  readonly parsedUx = computed(() => parseScalar(this.uxInput()));
  readonly parsedUy = computed(() => parseScalar(this.uyInput()));
  readonly parsedVx = computed(() => parseScalar(this.vxInput()));
  readonly parsedVy = computed(() => parseScalar(this.vyInput()));

  readonly u = computed<Vec2 | null>(() => this.vectorFrom(this.parsedUx(), this.parsedUy()));
  readonly v = computed<Vec2 | null>(() => this.vectorFrom(this.parsedVx(), this.parsedVy()));

  readonly vectorErrors = computed(() => {
    const errors: string[] = [];
    this.collectError(errors, 'u.x', this.parsedUx());
    this.collectError(errors, 'u.y', this.parsedUy());
    this.collectError(errors, 'v.x', this.parsedVx());
    this.collectError(errors, 'v.y', this.parsedVy());
    return errors;
  });

  readonly vectorOpInfo = computed(
    () => this.vectorOps.find((item) => item.key === this.vectorOp()) ?? this.vectorOps[0],
  );

  readonly vectorSum = computed(() => {
    const u = this.u();
    const v = this.v();
    return u && v ? addVec(u, v) : null;
  });

  readonly vectorDifference = computed(() => {
    const u = this.u();
    const v = this.v();
    return u && v ? subtractVec(u, v) : null;
  });

  readonly vectorDot = computed(() => {
    const u = this.u();
    const v = this.v();
    return u && v ? dot(u, v) : null;
  });

  readonly vectorProjection = computed(() => {
    const u = this.u();
    const v = this.v();
    return u && v ? projectVec(v, u) : null;
  });

  readonly vectorAngleRadians = computed(() => {
    const u = this.u();
    const v = this.v();
    return u && v ? angleBetween(u, v) : null;
  });

  readonly vectorCross = computed(() => {
    const u = this.u();
    const v = this.v();
    return u && v ? cross(u, v) : null;
  });

  readonly uLength = computed(() => {
    const u = this.u();
    return u ? this.formatValue(norm(u)) : '—';
  });

  readonly vLength = computed(() => {
    const v = this.v();
    return v ? this.formatValue(norm(v)) : '—';
  });

  readonly dotText = computed(() => {
    const value = this.vectorDot();
    return value === null ? '—' : this.formatValue(value);
  });

  readonly vectorAnswer = computed<VectorAnswer | null>(() => {
    const u = this.u();
    const v = this.v();
    if (!u || !v) {
      return null;
    }

    switch (this.vectorOp()) {
      case 'add': {
        const sum = addVec(u, v);
        return {
          label: 'u + v',
          primary: this.formatVec(sum),
          secondary: `|u + v| = ${this.formatValue(norm(sum))}`,
          formula: `(${this.formatValue(u.x)} + ${this.formatValue(v.x)}, ${this.formatValue(
            u.y,
          )} + ${this.formatValue(v.y)})`,
        };
      }
      case 'subtract': {
        const difference = subtractVec(u, v);
        return {
          label: 'u − v',
          primary: this.formatVec(difference),
          secondary: `|u − v| = ${this.formatValue(norm(difference))}`,
          formula: `(${this.formatValue(u.x)} − ${this.formatValue(v.x)}, ${this.formatValue(
            u.y,
          )} − ${this.formatValue(v.y)})`,
        };
      }
      case 'dot': {
        const value = dot(u, v);
        return {
          label: 'u · v',
          primary: this.formatValue(value),
          secondary:
            Math.abs(value) < EPS
              ? 'Los vectores son perpendiculares.'
              : `cos θ = ${this.formatValue(value / (norm(u) * norm(v)))}`,
          formula: `${this.formatValue(u.x)}·${this.formatValue(v.x)} + ${this.formatValue(
            u.y,
          )}·${this.formatValue(v.y)}`,
        };
      }
      case 'projection': {
        const projection = projectVec(v, u);
        if (!projection) {
          return {
            label: 'proyᵤ v',
            primary: 'No definida',
            secondary: 'u es el vector cero.',
            formula: '(u·v / |u|²) u',
          };
        }
        return {
          label: 'proyᵤ v',
          primary: this.formatVec(projection),
          secondary: `|proyᵤ v| = ${this.formatValue(norm(projection))}`,
          formula: `(u·v / |u|²) u = ${this.formatValue(dot(v, u) / dot(u, u))} u`,
        };
      }
      case 'angle': {
        const radians = angleBetween(u, v);
        return {
          label: '∠(u, v)',
          primary: `${this.formatValue((radians * 180) / Math.PI)}°`,
          secondary: `${this.formatValue(radians, 3)} rad`,
          formula: 'cos θ = (u·v) / (|u||v|)',
        };
      }
      case 'area': {
        const signed = cross(u, v);
        return {
          label: '|u × v|',
          primary: this.formatValue(Math.abs(signed)),
          secondary: `producto cruz = ${this.formatValue(signed)}`,
          formula: `|${this.formatValue(u.x)}·${this.formatValue(v.y)} − ${this.formatValue(
            u.y,
          )}·${this.formatValue(v.x)}|`,
        };
      }
    }
  });

  readonly vectorRows = computed<VectorRow[]>(() => {
    const rows: VectorRow[] = [];
    const u = this.u();
    const v = this.v();
    if (u) {
      rows.push(this.vectorRow('u', u));
    }
    if (v) {
      rows.push(this.vectorRow('v', v));
    }
    if (this.vectorSum()) {
      rows.push(this.vectorRow('u + v', this.vectorSum()!));
    }
    if (this.vectorDifference()) {
      rows.push(this.vectorRow('u − v', this.vectorDifference()!));
    }
    if (this.vectorProjection()) {
      rows.push(this.vectorRow('proyᵤ v', this.vectorProjection()!));
    }
    return rows;
  });

  // ------------------------------------------------------------ transformación

  readonly m11Input = signal('1.5');
  readonly m12Input = signal('0.5');
  readonly m21Input = signal('0.5');
  readonly m22Input = signal('1.5');

  readonly n11Input = signal('0');
  readonly n12Input = signal('-1');
  readonly n21Input = signal('1');
  readonly n22Input = signal('0');
  readonly compose = signal(false);

  readonly txInput = signal('2');
  readonly tyInput = signal('1');

  readonly parsedM11 = computed(() => parseScalar(this.m11Input()));
  readonly parsedM12 = computed(() => parseScalar(this.m12Input()));
  readonly parsedM21 = computed(() => parseScalar(this.m21Input()));
  readonly parsedM22 = computed(() => parseScalar(this.m22Input()));

  readonly parsedN11 = computed(() => parseScalar(this.n11Input()));
  readonly parsedN12 = computed(() => parseScalar(this.n12Input()));
  readonly parsedN21 = computed(() => parseScalar(this.n21Input()));
  readonly parsedN22 = computed(() => parseScalar(this.n22Input()));

  readonly parsedTx = computed(() => parseScalar(this.txInput()));
  readonly parsedTy = computed(() => parseScalar(this.tyInput()));

  readonly matrixA = computed<Mat2 | null>(() =>
    this.matrixFrom(this.parsedM11(), this.parsedM12(), this.parsedM21(), this.parsedM22()),
  );
  readonly matrixB = computed<Mat2 | null>(() =>
    this.matrixFrom(this.parsedN11(), this.parsedN12(), this.parsedN21(), this.parsedN22()),
  );
  readonly testVector = computed<Vec2 | null>(() =>
    this.vectorFrom(this.parsedTx(), this.parsedTy()),
  );

  readonly activeMatrix = computed<Mat2 | null>(() => {
    const a = this.matrixA();
    if (!a) {
      return null;
    }
    if (!this.compose()) {
      return a;
    }
    const b = this.matrixB();
    return b ? matMultiply(a, b) : null;
  });
  readonly activeMatrixLabel = computed(() => (this.compose() ? 'A·B' : 'A'));

  readonly composition = computed(() => {
    const a = this.matrixA();
    const b = this.matrixB();
    return a && b ? matMultiply(a, b) : null;
  });

  readonly compositionText = computed(() => {
    const matrix = this.composition();
    return matrix ? this.formatMatrix(matrix) : '—';
  });

  readonly matrixErrors = computed(() => {
    const errors: string[] = [];
    this.collectError(errors, 'a', this.parsedM11());
    this.collectError(errors, 'b', this.parsedM12());
    this.collectError(errors, 'c', this.parsedM21());
    this.collectError(errors, 'd', this.parsedM22());
    if (this.compose()) {
      this.collectError(errors, 'B: a', this.parsedN11());
      this.collectError(errors, 'B: b', this.parsedN12());
      this.collectError(errors, 'B: c', this.parsedN21());
      this.collectError(errors, 'B: d', this.parsedN22());
    }
    return errors;
  });

  readonly testVectorErrors = computed(() => {
    const errors: string[] = [];
    this.collectError(errors, 'v.x', this.parsedTx());
    this.collectError(errors, 'v.y', this.parsedTy());
    return errors;
  });

  readonly matrixStats = computed(() => {
    const matrix = this.activeMatrix();
    if (!matrix) {
      return null;
    }
    const determinant = matDeterminant(matrix);
    return {
      kind: matrixKind(matrix),
      determinant: this.formatValue(determinant),
      absoluteDeterminant: this.formatValue(Math.abs(determinant)),
      trace: this.formatValue(matTrace(matrix)),
      rank: String(matRank(matrix)),
      invertible: Math.abs(determinant) > EPS,
      orientation:
        determinant > EPS
          ? 'Conserva orientación'
          : determinant < -EPS
            ? 'Invierte orientación'
            : 'Colapsa el plano',
    };
  });

  readonly inverseText = computed(() => {
    const inverse = this.activeMatrix() ? matInverse(this.activeMatrix()!) : null;
    return inverse ? this.formatMatrix(inverse) : null;
  });

  readonly eigen = computed<EigenResult | null>(() => {
    const matrix = this.activeMatrix();
    return matrix ? eigenvalues(matrix) : null;
  });

  readonly eigenvalueRows = computed(() => {
    const result = this.eigen();
    if (!result) {
      return [];
    }
    return result.eigenvalues.map((value, index) => {
      const symbolic = result.eigenvalueLabels[index];
      return {
        label: `λ${index === 0 ? '₁' : '₂'}`,
        value:
          symbolic ??
          (Math.abs(value.im) < EPS
            ? this.formatValue(value.re)
            : `${this.formatValue(value.re)} ${value.im < 0 ? '−' : '+'} ${this.formatValue(
                Math.abs(value.im),
              )}i`),
      };
    });
  });

  readonly eigenvectorRows = computed(() => {
    const result = this.eigen();
    if (!result) {
      return [];
    }
    if (!result.real) {
      return [{ label: 'Autovectores', value: 'No reales' }];
    }
    if (result.vectors.length === 0) {
      return [{ label: 'Autovectores', value: '—' }];
    }
    return result.vectors.map((vector, index) => ({
      label: `v${index === 0 ? '₁' : '₂'}`,
      value: result.vectorLabels[index] ?? this.formatVec(vector),
    }));
  });

  readonly eigenNote = computed(() => {
    const result = this.eigen();
    if (!result) {
      return '';
    }
    if (!result.real) {
      return 'Los autovalores son complejos: la transformación incluye una rotación.';
    }
    if (result.repeated) {
      return result.vectors.length > 1
        ? 'Autovalor repetido: todo vector es propio.'
        : 'Autovalor repetido: solo hay una dirección propia real.';
    }
    return 'Las direcciones propias no cambian al aplicar la transformación.';
  });

  readonly testImage = computed<Vec2 | null>(() => {
    const matrix = this.activeMatrix();
    const vector = this.testVector();
    return matrix && vector ? matApply(matrix, vector) : null;
  });

  readonly matrixRows = computed<MatrixRow[]>(() => {
    const rows: MatrixRow[] = [];
    const a = this.matrixA();
    const b = this.matrixB();
    const composition = this.composition();
    const active = this.activeMatrix();
    const inverse = active ? matInverse(active) : null;

    if (a) {
      rows.push(this.matrixRow('A', a));
    }
    if (b) {
      rows.push(this.matrixRow('B', b));
    }
    if (composition) {
      rows.push(this.matrixRow('A·B', composition));
    }
    if (inverse) {
      rows.push(this.matrixRow(this.compose() ? '(A·B)⁻¹' : 'A⁻¹', inverse));
    }
    return rows;
  });

  // ------------------------------------------------------------------ sistemas

  readonly s11Input = signal('1');
  readonly s12Input = signal('1');
  readonly s13Input = signal('4');
  readonly s21Input = signal('1');
  readonly s22Input = signal('-1');
  readonly s23Input = signal('0');

  readonly parsedS11 = computed(() => parseScalar(this.s11Input()));
  readonly parsedS12 = computed(() => parseScalar(this.s12Input()));
  readonly parsedS13 = computed(() => parseScalar(this.s13Input()));
  readonly parsedS21 = computed(() => parseScalar(this.s21Input()));
  readonly parsedS22 = computed(() => parseScalar(this.s22Input()));
  readonly parsedS23 = computed(() => parseScalar(this.s23Input()));

  readonly systemErrors = computed(() => {
    const errors: string[] = [];
    this.collectError(errors, 'L₁: a', this.parsedS11());
    this.collectError(errors, 'L₁: b', this.parsedS12());
    this.collectError(errors, 'L₁: c', this.parsedS13());
    this.collectError(errors, 'L₂: a', this.parsedS21());
    this.collectError(errors, 'L₂: b', this.parsedS22());
    this.collectError(errors, 'L₂: c', this.parsedS23());
    return errors;
  });

  readonly system = computed<SystemResult | null>(() => {
    const a1 = this.parsedS11().value;
    const b1 = this.parsedS12().value;
    const c1 = this.parsedS13().value;
    const a2 = this.parsedS21().value;
    const b2 = this.parsedS22().value;
    const c2 = this.parsedS23().value;
    if (a1 === null || b1 === null || c1 === null || a2 === null || b2 === null || c2 === null) {
      return null;
    }
    return solveSystem(a1, b1, c1, a2, b2, c2);
  });

  readonly systemStats = computed(() => {
    const result = this.system();
    if (!result) {
      return null;
    }
    const labels = {
      unique: 'Solución única',
      infinite: 'Infinitas soluciones',
      none: 'Sin solución',
    };
    return {
      kind: result.kind,
      kindLabel: labels[result.kind],
      solution: result.solution ? this.formatVec(result.solution) : null,
      determinant: this.formatValue(result.determinant),
      rankCoefficients: String(result.rankCoefficients),
      rankAugmented: String(result.rankAugmented),
    };
  });

  readonly systemRows = computed<SystemRow[]>(() => {
    return [
      {
        label: 'L₁',
        a: this.parsedS11().value === null ? '—' : this.formatValue(this.parsedS11().value!),
        b: this.parsedS12().value === null ? '—' : this.formatValue(this.parsedS12().value!),
        c: this.parsedS13().value === null ? '—' : this.formatValue(this.parsedS13().value!),
      },
      {
        label: 'L₂',
        a: this.parsedS21().value === null ? '—' : this.formatValue(this.parsedS21().value!),
        b: this.parsedS22().value === null ? '—' : this.formatValue(this.parsedS22().value!),
        c: this.parsedS23().value === null ? '—' : this.formatValue(this.parsedS23().value!),
      },
    ];
  });

  readonly center = signal({ x: 0, y: 0 });
  readonly pixelsPerUnit = signal(48);
  readonly size = signal({ w: 0, h: 0 });
  readonly dragging = signal(false);

  readonly rangeLabel = computed(() => {
    const { w, h } = this.size();
    const ppu = this.pixelsPerUnit();
    if (w <= 0 || h <= 0) {
      return '';
    }
    const center = this.center();
    const halfW = w / (2 * ppu);
    const halfH = h / (2 * ppu);
    return `x ∈ [${formatDecimal(center.x - halfW)}, ${formatDecimal(
      center.x + halfW,
    )}] · y ∈ [${formatDecimal(center.y - halfH)}, ${formatDecimal(center.y + halfH)}]`;
  });

  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private fallback = 0;
  private viewInitialized = false;
  private dragTarget: DragTarget | null = null;
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
      this.mode();
      this.u();
      this.v();
      this.vectorOp();
      this.matrixA();
      this.matrixB();
      this.compose();
      this.testVector();
      this.system();
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
    if (this.mode() === mode) {
      return;
    }
    this.mode.set(mode);
    this.dragTarget = null;
    this.fitView();
  }

  onVectorInput(field: VectorField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'ux':
        this.uxInput.set(value);
        break;
      case 'uy':
        this.uyInput.set(value);
        break;
      case 'vx':
        this.vxInput.set(value);
        break;
      case 'vy':
        this.vyInput.set(value);
        break;
    }
  }

  setVector(target: 'u' | 'v', x: number, y: number): void {
    if (target === 'u') {
      this.uxInput.set(String(x));
      this.uyInput.set(String(y));
    } else {
      this.vxInput.set(String(x));
      this.vyInput.set(String(y));
    }
    this.fitView();
  }

  setVectorOperation(operation: VectorOp): void {
    this.vectorOp.set(operation);
  }

  onMatrixInput(field: MatrixField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'a':
        this.m11Input.set(value);
        break;
      case 'b':
        this.m12Input.set(value);
        break;
      case 'c':
        this.m21Input.set(value);
        break;
      case 'd':
        this.m22Input.set(value);
        break;
    }
  }

  onMatrixBInput(field: MatrixField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'a':
        this.n11Input.set(value);
        break;
      case 'b':
        this.n12Input.set(value);
        break;
      case 'c':
        this.n21Input.set(value);
        break;
      case 'd':
        this.n22Input.set(value);
        break;
    }
  }

  onTestVectorInput(axis: 'x' | 'y', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (axis === 'x') {
      this.txInput.set(value);
    } else {
      this.tyInput.set(value);
    }
  }

  applyMatrixPreset(preset: MatrixPreset): void {
    this.m11Input.set(preset.a);
    this.m12Input.set(preset.b);
    this.m21Input.set(preset.c);
    this.m22Input.set(preset.d);
    this.fitView();
  }

  onComposeChange(event: Event): void {
    this.compose.set((event.target as HTMLInputElement).checked);
    this.fitView();
  }

  onSystemInput(field: SystemField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'a1':
        this.s11Input.set(value);
        break;
      case 'b1':
        this.s12Input.set(value);
        break;
      case 'c1':
        this.s13Input.set(value);
        break;
      case 'a2':
        this.s21Input.set(value);
        break;
      case 'b2':
        this.s22Input.set(value);
        break;
      case 'c2':
        this.s23Input.set(value);
        break;
    }
  }

  applySystemPreset(preset: SystemPreset): void {
    this.s11Input.set(preset.a1);
    this.s12Input.set(preset.b1);
    this.s13Input.set(preset.c1);
    this.s21Input.set(preset.a2);
    this.s22Input.set(preset.b2);
    this.s23Input.set(preset.c2);
    this.fitView();
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

    const points: Vec2[] = [{ x: 0, y: 0 }];

    if (this.mode() === 'vectors') {
      const u = this.u();
      const v = this.v();
      if (u) {
        points.push(u);
      }
      if (v) {
        points.push(v);
      }
      if (this.vectorSum()) {
        points.push(this.vectorSum()!);
      }
      if (this.vectorDifference()) {
        points.push(this.vectorDifference()!);
      }
      if (this.vectorProjection()) {
        points.push(this.vectorProjection()!);
      }
      this.fitPoints(points, 6);
      return;
    }

    if (this.mode() === 'transform') {
      const matrix = this.activeMatrix();
      if (matrix) {
        const square: Vec2[] = [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ];
        points.push(...square.map((point) => matApply(matrix, point)));
        for (let index = 0; index < 72; index += 1) {
          const angle = (index / 72) * Math.PI * 2;
          points.push(matApply(matrix, { x: Math.cos(angle), y: Math.sin(angle) }));
        }
        points.push(matApply(matrix, { x: 1, y: 0 }), matApply(matrix, { x: 0, y: 1 }));
        if (this.testVector()) {
          points.push(this.testVector()!);
        }
        if (this.testImage()) {
          points.push(this.testImage()!);
        }
      }
      this.fitPoints(points, 6);
      return;
    }

    const solution = this.system()?.solution;
    if (solution) {
      points.push(solution);
    }
    const coefficients = this.systemCoefficients();
    if (coefficients) {
      if (Math.abs(coefficients.b1) > EPS) {
        points.push({ x: 0, y: coefficients.c1 / coefficients.b1 });
      }
      if (Math.abs(coefficients.a1) > EPS) {
        points.push({ x: coefficients.c1 / coefficients.a1, y: 0 });
      }
      if (Math.abs(coefficients.b2) > EPS) {
        points.push({ x: 0, y: coefficients.c2 / coefficients.b2 });
      }
      if (Math.abs(coefficients.a2) > EPS) {
        points.push({ x: coefficients.c2 / coefficients.a2, y: 0 });
      }
    }
    this.fitPoints(points, 8);
  }

  private fitPoints(points: Vec2[], minimumSpan: number): void {
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) {
      return;
    }

    let xMin = 0;
    let xMax = 0;
    let yMin = 0;
    let yMax = 0;

    for (const point of points) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        continue;
      }
      xMin = Math.min(xMin, point.x);
      xMax = Math.max(xMax, point.x);
      yMin = Math.min(yMin, point.y);
      yMax = Math.max(yMax, point.y);
    }

    const xSpan = Math.max(minimumSpan, xMax - xMin);
    const ySpan = Math.max(minimumSpan, yMax - yMin);
    const padding = 0.18;
    const ppu = clamp(
      Math.min(w / (xSpan * (1 + padding * 2)), h / (ySpan * (1 + padding * 2))) * 0.9,
      MIN_PIXELS_PER_UNIT,
      MAX_PIXELS_PER_UNIT,
    );

    this.pixelsPerUnit.set(ppu);
    this.center.set({ x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 });
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
      this.dragTarget = hit;
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

    if (this.dragTarget) {
      const world = this.screenToWorld(point);
      const x = formatDecimal(world.x, 2);
      const y = formatDecimal(world.y, 2);
      if (this.dragTarget === 'u') {
        this.uxInput.set(x);
        this.uyInput.set(y);
      } else if (this.dragTarget === 'v') {
        this.vxInput.set(x);
        this.vyInput.set(y);
      } else {
        this.txInput.set(x);
        this.tyInput.set(y);
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
    this.dragTarget = null;
    this.panStart = null;
    this.dragging.set(false);
  }

  onPointerLeave(): void {
    if (!this.dragTarget && !this.panStart) {
      this.dragging.set(false);
    }
  }

  private hitTest(point: { x: number; y: number }): DragTarget | null {
    if (this.mode() === 'vectors') {
      const u = this.u();
      const v = this.v();
      if (u && this.nearPoint(point, u)) {
        return 'u';
      }
      if (v && this.nearPoint(point, v)) {
        return 'v';
      }
      return null;
    }

    if (this.mode() === 'transform') {
      const vector = this.testVector();
      if (vector && this.nearPoint(point, vector)) {
        return 'test';
      }
    }
    return null;
  }

  private nearPoint(screen: { x: number; y: number }, value: Vec2): boolean {
    return Math.hypot(screen.x - this.screenX(value.x), screen.y - this.screenY(value.y)) <= 14;
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
    if (this.mode() === 'transform') {
      this.drawTransformedGrid(ctx);
    }
    this.drawAxes(ctx);

    if (this.mode() === 'vectors') {
      this.drawVectors(ctx);
    } else if (this.mode() === 'transform') {
      this.drawTransform(ctx);
    } else {
      this.drawSystem(ctx);
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    const ppu = this.pixelsPerUnit();
    const major = Math.max(niceStep(GRID_TARGET_PX / ppu), Number.MIN_VALUE);
    const normalized = major / 10 ** Math.floor(Math.log10(major));
    const subdivisions = normalized === 2 || normalized === 5 ? 5 : 4;
    const minor = major / subdivisions;

    const { xMin, xMax, yMin, yMax } = this.worldBounds();

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

  private drawAxes(ctx: CanvasRenderingContext2D): void {
    const ppu = this.pixelsPerUnit();
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

    const major = Math.max(niceStep(GRID_TARGET_PX / ppu), Number.MIN_VALUE);
    const { xMin, xMax, yMin, yMax } = this.worldBounds();

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
      ctx.fillText('x', this.width - 8, axisY - 5);
    }
    if (showY) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('y', axisX + 7, 7);
    }
  }

  private drawTransformedGrid(ctx: CanvasRenderingContext2D): void {
    const matrix = this.activeMatrix();
    if (!matrix) {
      return;
    }

    const ppu = this.pixelsPerUnit();
    const major = Math.max(niceStep(GRID_TARGET_PX / ppu), Number.MIN_VALUE);
    const step = major * 2;
    const { xMin, xMax, yMin, yMax } = this.worldBounds();

    ctx.save();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.08)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = Math.ceil(xMin / step); i <= Math.floor(xMax / step); i += 1) {
      const a = matApply(matrix, { x: i * step, y: yMin });
      const b = matApply(matrix, { x: i * step, y: yMax });
      ctx.moveTo(this.screenX(a.x), this.screenY(a.y));
      ctx.lineTo(this.screenX(b.x), this.screenY(b.y));
    }
    for (let i = Math.ceil(yMin / step); i <= Math.floor(yMax / step); i += 1) {
      const a = matApply(matrix, { x: xMin, y: i * step });
      const b = matApply(matrix, { x: xMax, y: i * step });
      ctx.moveTo(this.screenX(a.x), this.screenY(a.y));
      ctx.lineTo(this.screenX(b.x), this.screenY(b.y));
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawVectors(ctx: CanvasRenderingContext2D): void {
    const u = this.u();
    const v = this.v();
    if (!u || !v) {
      return;
    }

    const operation = this.vectorOp();
    const sum = this.vectorSum();
    const difference = this.vectorDifference();
    const projection = this.vectorProjection();

    if (operation === 'area' && sum) {
      this.fillPolygon(ctx, [this.origin(), u, sum, v], 'rgba(167, 139, 250, 0.12)');
    }

    if (operation === 'add' && sum) {
      this.drawDashedSegment(ctx, u, sum, 'rgba(167, 139, 250, 0.4)');
      this.drawDashedSegment(ctx, v, sum, 'rgba(167, 139, 250, 0.4)');
    } else if (operation === 'subtract' && difference) {
      this.drawDashedSegment(ctx, v, u, 'rgba(167, 139, 250, 0.4)');
    } else if (operation === 'projection' && projection) {
      this.drawDashedSegment(ctx, v, projection, 'rgba(52, 211, 153, 0.5)');
    } else if (operation === 'dot' || operation === 'angle') {
      this.drawAngleArc(ctx, u, v);
    }

    this.drawVector(ctx, u, '#38bdf8', 'u');
    this.drawVector(ctx, v, '#f472b6', 'v');

    if (operation === 'add' && sum) {
      this.drawVector(ctx, sum, '#a78bfa', 'u + v');
    } else if (operation === 'subtract' && difference) {
      this.drawVector(ctx, difference, '#a78bfa', 'u − v');
    } else if (operation === 'projection' && projection) {
      this.drawVector(ctx, projection, '#34d399', 'proyᵤ v');
    }
  }

  private drawTransform(ctx: CanvasRenderingContext2D): void {
    const matrix = this.activeMatrix();
    if (!matrix) {
      return;
    }

    this.drawUnitSquare(ctx, matrix);
    this.drawUnitCircle(ctx, matrix);
    this.drawEigenLines(ctx);
    this.drawTransformedBasis(ctx, matrix);
    this.drawTestVector(ctx, matrix);
  }

  private drawUnitSquare(ctx: CanvasRenderingContext2D, matrix: Mat2): void {
    const square: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const transformed = square.map((point) => matApply(matrix, point));

    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 1;
    this.tracePolygon(ctx, square);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(167, 139, 250, 0.12)';
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.65)';
    ctx.lineWidth = 1.5;
    this.tracePolygon(ctx, transformed);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawUnitCircle(ctx: CanvasRenderingContext2D, matrix: Mat2): void {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.screenX(0), this.screenY(0), this.pixelsPerUnit(), 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let index = 0; index <= 96; index += 1) {
      const angle = (index / 96) * Math.PI * 2;
      const point = matApply(matrix, { x: Math.cos(angle), y: Math.sin(angle) });
      const x = this.screenX(point.x);
      const y = this.screenY(point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawTransformedBasis(ctx: CanvasRenderingContext2D, matrix: Mat2): void {
    const first = matApply(matrix, { x: 1, y: 0 });
    const second = matApply(matrix, { x: 0, y: 1 });
    const label = this.activeMatrixLabel();

    if (norm(first) > EPS) {
      this.drawVector(ctx, first, '#38bdf8', `${label}·e₁`);
    }
    if (norm(second) > EPS) {
      this.drawVector(ctx, second, '#f472b6', `${label}·e₂`, 8, 14);
    }
  }

  private drawEigenLines(ctx: CanvasRenderingContext2D): void {
    const result = this.eigen();
    if (!result || !result.real) {
      return;
    }

    const radius = Math.max(this.width, this.height) / this.pixelsPerUnit();
    const labelDistance = (Math.min(this.width, this.height) * 0.32) / this.pixelsPerUnit();
    const seen = new Set<string>();

    result.vectors.forEach((vector, index) => {
      const key = `${this.formatValue(vector.x)}:${this.formatValue(vector.y)}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      const direction = unit(vector) ?? { x: 1, y: 0 };
      const a = { x: direction.x * radius, y: direction.y * radius };
      const b = { x: -direction.x * radius, y: -direction.y * radius };

      ctx.save();
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(this.screenX(a.x), this.screenY(a.y));
      ctx.lineTo(this.screenX(b.x), this.screenY(b.y));
      ctx.stroke();
      ctx.restore();

      const labelPoint = {
        x: direction.x * labelDistance,
        y: direction.y * labelDistance,
      };
      this.drawPointLabel(
        ctx,
        `v${index === 0 ? '₁' : '₂'}`,
        this.screenX(labelPoint.x),
        this.screenY(labelPoint.y),
        '#6ee7b7',
      );
    });
  }

  private drawTestVector(ctx: CanvasRenderingContext2D, matrix: Mat2): void {
    const vector = this.testVector();
    if (!vector) {
      return;
    }
    const image = matApply(matrix, vector);
    const label = this.activeMatrixLabel();

    this.drawDashedSegment(ctx, vector, image, 'rgba(251, 191, 36, 0.45)');
    this.drawVector(ctx, vector, '#fbbf24', 'v');

    if (samePoint(vector, image)) {
      this.drawPointLabel(
        ctx,
        `v = ${label}·v`,
        this.screenX(image.x),
        this.screenY(image.y),
        '#c4b5fd',
      );
    } else {
      this.drawVector(ctx, image, '#a78bfa', `${label}·v`, 8, 14);
    }
  }

  private drawSystem(ctx: CanvasRenderingContext2D): void {
    const coefficients = this.systemCoefficients();
    if (!coefficients) {
      return;
    }

    this.drawEquation(ctx, coefficients.a1, coefficients.b1, coefficients.c1, '#38bdf8', 'L₁');
    this.drawEquation(ctx, coefficients.a2, coefficients.b2, coefficients.c2, '#f472b6', 'L₂');

    const result = this.system();
    if (result?.solution) {
      const point = result.solution;
      this.drawPoint(ctx, point, '#a78bfa', 5);
      this.drawPointLabel(
        ctx,
        `(${this.formatValue(point.x)}, ${this.formatValue(point.y)})`,
        this.screenX(point.x),
        this.screenY(point.y),
        '#c4b5fd',
      );
    }
  }

  private drawEquation(
    ctx: CanvasRenderingContext2D,
    a: number,
    b: number,
    c: number,
    color: string,
    label: string,
  ): void {
    const { xMin, xMax, yMin, yMax } = this.worldBounds();
    let first: Vec2 | null = null;
    let second: Vec2 | null = null;

    if (Math.abs(b) > EPS) {
      first = { x: xMin, y: (c - a * xMin) / b };
      second = { x: xMax, y: (c - a * xMax) / b };
    } else if (Math.abs(a) > EPS) {
      const x = c / a;
      first = { x, y: yMin };
      second = { x, y: yMax };
    }

    if (!first || !second) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(this.screenX(first.x), this.screenY(first.y));
    ctx.lineTo(this.screenX(second.x), this.screenY(second.y));
    ctx.stroke();
    ctx.restore();

    const labelPoint = {
      x: first.x + (second.x - first.x) * 0.62,
      y: first.y + (second.y - first.y) * 0.62,
    };
    if (
      Number.isFinite(labelPoint.x) &&
      Number.isFinite(labelPoint.y) &&
      this.screenX(labelPoint.x) > 20 &&
      this.screenX(labelPoint.x) < this.width - 20 &&
      this.screenY(labelPoint.y) > 20 &&
      this.screenY(labelPoint.y) < this.height - 20
    ) {
      this.drawPointLabel(
        ctx,
        label,
        this.screenX(labelPoint.x),
        this.screenY(labelPoint.y),
        color,
      );
    }
  }

  private drawAngleArc(ctx: CanvasRenderingContext2D, u: Vec2, v: Vec2): void {
    if (norm(u) < EPS || norm(v) < EPS) {
      return;
    }

    const start = Math.atan2(-u.y, u.x);
    const end = Math.atan2(-v.y, v.x);
    let delta = end - start;
    while (delta > Math.PI) {
      delta -= Math.PI * 2;
    }
    while (delta < -Math.PI) {
      delta += Math.PI * 2;
    }

    const cx = this.screenX(0);
    const cy = this.screenY(0);
    const radius = 48;
    const color = 'rgba(167, 139, 250, 0.75)';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, start + delta, delta < 0);
    ctx.stroke();

    const middle = start + delta / 2;
    const labelX = cx + (radius + 16) * Math.cos(middle);
    const labelY = cy + (radius + 16) * Math.sin(middle);
    const degrees = (angleBetween(u, v) * 180) / Math.PI;
    this.drawPointLabel(ctx, `${this.formatValue(degrees)}°`, labelX, labelY, '#c4b5fd');
    ctx.restore();
  }

  private drawVector(
    ctx: CanvasRenderingContext2D,
    value: Vec2,
    color: string,
    label: string,
    labelDx = 8,
    labelDy = -8,
  ): void {
    const ox = this.screenX(0);
    const oy = this.screenY(0);
    const px = this.screenX(value.x);
    const py = this.screenY(value.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
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

    this.drawPoint(ctx, value, color, 4);
    this.drawPointLabel(ctx, label, px, py, color, labelDx, labelDy);
  }

  private drawPoint(
    ctx: CanvasRenderingContext2D,
    point: Vec2,
    color: string,
    radius: number,
  ): void {
    const x = this.screenX(point.x);
    const y = this.screenY(point.y);
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
    dx = 8,
    dy = -8,
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
    ctx.strokeText(label, x + dx, y + dy);
    ctx.fillStyle = color;
    ctx.fillText(label, x + dx, y + dy);
    ctx.restore();
  }

  private drawDashedSegment(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, color: string): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(this.screenX(a.x), this.screenY(a.y));
    ctx.lineTo(this.screenX(b.x), this.screenY(b.y));
    ctx.stroke();
    ctx.restore();
  }

  private fillPolygon(ctx: CanvasRenderingContext2D, points: Vec2[], color: string): void {
    ctx.save();
    ctx.fillStyle = color;
    this.tracePolygon(ctx, points);
    ctx.fill();
    ctx.restore();
  }

  private tracePolygon(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
    if (points.length === 0) {
      return;
    }
    ctx.beginPath();
    points.forEach((point, index) => {
      const x = this.screenX(point.x);
      const y = this.screenY(point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
  }

  // ------------------------------------------------------------------ helpers

  private systemCoefficients(): {
    a1: number;
    b1: number;
    c1: number;
    a2: number;
    b2: number;
    c2: number;
  } | null {
    const a1 = this.parsedS11().value;
    const b1 = this.parsedS12().value;
    const c1 = this.parsedS13().value;
    const a2 = this.parsedS21().value;
    const b2 = this.parsedS22().value;
    const c2 = this.parsedS23().value;
    if (a1 === null || b1 === null || c1 === null || a2 === null || b2 === null || c2 === null) {
      return null;
    }
    return { a1, b1, c1, a2, b2, c2 };
  }

  private vectorFrom(x: ParsedScalar, y: ParsedScalar): Vec2 | null {
    return x.value === null || y.value === null ? null : { x: x.value, y: y.value };
  }

  private matrixFrom(
    a: ParsedScalar,
    b: ParsedScalar,
    c: ParsedScalar,
    d: ParsedScalar,
  ): Mat2 | null {
    if (a.value === null || b.value === null || c.value === null || d.value === null) {
      return null;
    }
    return { a: a.value, b: b.value, c: c.value, d: d.value };
  }

  private collectError(errors: string[], label: string, parsed: ParsedScalar): void {
    if (parsed.error) {
      errors.push(`${label}: ${parsed.error}`);
    }
  }

  private vectorRow(label: string, value: Vec2): VectorRow {
    return {
      label,
      x: this.formatValue(value.x),
      y: this.formatValue(value.y),
      length: this.formatValue(norm(value)),
    };
  }

  private matrixRow(label: string, value: Mat2): MatrixRow {
    return {
      label,
      a: this.formatValue(value.a),
      b: this.formatValue(value.b),
      c: this.formatValue(value.c),
      d: this.formatValue(value.d),
      determinant: this.formatValue(matDeterminant(value)),
    };
  }

  private formatMatrix(value: Mat2): string {
    return `[${this.formatValue(value.a)}, ${this.formatValue(value.b)}; ${this.formatValue(
      value.c,
    )}, ${this.formatValue(value.d)}]`;
  }

  formatVec(value: Vec2 | null): string {
    return value ? `(${this.formatValue(value.x)}, ${this.formatValue(value.y)})` : '—';
  }

  formatValue(value: number, digits = 2): string {
    return formatNumber(value, digits).replace(/-/g, '−');
  }

  private origin(): Vec2 {
    return { x: 0, y: 0 };
  }

  private worldBounds(): { xMin: number; xMax: number; yMin: number; yMax: number } {
    const ppu = this.pixelsPerUnit();
    const center = this.center();
    return {
      xMin: center.x - this.width / (2 * ppu),
      xMax: center.x + this.width / (2 * ppu),
      yMin: center.y - this.height / (2 * ppu),
      yMax: center.y + this.height / (2 * ppu),
    };
  }

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
