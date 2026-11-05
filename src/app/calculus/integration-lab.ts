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
import { compileExpression, evaluateAt, evaluateExpression } from '../shared/expression';
import type { EvalFunction } from 'mathjs/number';
import { formatExact } from '../shared/exact-number';
import { autoBounds, drawAxes, drawCurve, drawGrid, sampleFunction } from '../shared/plot-utils';
import {
  analyzeImproper,
  integrate,
  partialFractions,
  verifyParts,
  verifySubstitution,
} from './integration';

type IntegrationMode = 'definite' | 'improper' | 'substitution' | 'parts' | 'fractions';

@Component({
  selector: 'app-integration-lab',
  templateUrl: './integration-lab.html',
  styleUrls: ['./lab-shared.css', './integration-lab.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationLab {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<IntegrationMode>('definite');
  readonly expression = signal('sin(x)');
  readonly aInput = signal('0');
  readonly bInput = signal('3.141592653589793');
  readonly substitutionF = signal('2*x*cos(x^2)');
  readonly substitutionG = signal('x^2');
  readonly substitutionH = signal('cos(u)');
  readonly partsU = signal('x');
  readonly partsDv = signal('e^x');
  readonly fractionsNumerator = signal('1');
  readonly fractionsRoots = signal('1, 2');

  readonly modes: { key: IntegrationMode; label: string }[] = [
    { key: 'definite', label: 'Definida' },
    { key: 'improper', label: 'Impropia' },
    { key: 'substitution', label: 'Sustitución' },
    { key: 'parts', label: 'Por partes' },
    { key: 'fractions', label: 'Fracciones' },
  ];

  readonly a = computed(() => Number(this.aInput().replace(',', '.')));
  readonly b = computed(() => Number(this.bInput().replace(',', '.')));
  readonly intervalValid = computed(
    () => Number.isFinite(this.a()) && Number.isFinite(this.b()) && this.b() > this.a(),
  );

  readonly mainFunction = computed(() => this.compile(this.activeExpression()));
  readonly definiteValue = computed(() => {
    const fn = this.mainFunction();
    if (!fn || !this.intervalValid()) {
      return null;
    }
    return integrate((x) => evaluateAt(fn, x), this.a(), this.b());
  });
  readonly improperResult = computed(() => {
    const fn = this.mainFunction();
    if (!fn || !this.intervalValid()) {
      return null;
    }
    return analyzeImproper((x) => evaluateAt(fn, x), this.a(), this.b());
  });

  readonly substitutionResult = computed(() => {
    const f = this.compile(this.substitutionF());
    const g = this.compile(this.substitutionG());
    const h = this.compile(this.substitutionH(), ['u']);
    if (!f || !g || !h || !this.intervalValid()) {
      return null;
    }
    return verifySubstitution(
      (x) => evaluateAt(f, x),
      (x) => evaluateAt(g, x),
      (u) => evaluateExpression(h, { u }),
      this.a(),
      this.b(),
    );
  });

  readonly partsResult = computed(() => {
    const u = this.compile(this.partsU());
    const dv = this.compile(this.partsDv());
    if (!u || !dv || !this.intervalValid()) {
      return null;
    }
    return verifyParts(
      (x) => evaluateAt(u, x),
      (x) => evaluateAt(dv, x),
      this.a(),
      this.b(),
    );
  });

  readonly fractionsResult = computed(() => {
    const numerator = this.compile(this.fractionsNumerator());
    const roots = this.fractionsRoots()
      .split(',')
      .map((value) => Number(value.trim().replace(',', '.')))
      .filter(Number.isFinite);
    if (!numerator || roots.length === 0 || !this.intervalValid()) {
      return null;
    }
    return partialFractions((x) => evaluateAt(numerator, x), roots, this.a(), this.b());
  });

  readonly activeExpression = computed(() => {
    switch (this.mode()) {
      case 'substitution':
        return this.substitutionF();
      case 'parts':
        return this.partsU();
      case 'fractions':
        return this.fractionsNumerator();
      default:
        return this.expression();
    }
  });

  readonly points = computed(() => {
    const fn = this.mainFunction();
    if (!fn) {
      return [];
    }
    const a = this.intervalValid() ? this.a() : -5;
    const b = this.intervalValid() ? this.b() : 5;
    return sampleFunction((x) => evaluateAt(fn, x), a, b, 500);
  });
  readonly bounds = computed(() => autoBounds(this.points()));

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

  constructor() {
    effect(() => {
      this.mode();
      this.points();
      this.size();
      this.surface?.requestDraw();
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

  setMode(mode: IntegrationMode): void {
    this.mode.set(mode);
  }

  onExpressionInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
  }

  onAInput(event: Event): void {
    this.aInput.set((event.target as HTMLInputElement).value);
  }

  onBInput(event: Event): void {
    this.bInput.set((event.target as HTMLInputElement).value);
  }

  onSignalInput(
    target:
      | 'substitutionF'
      | 'substitutionG'
      | 'substitutionH'
      | 'partsU'
      | 'partsDv'
      | 'fractionsNumerator'
      | 'fractionsRoots',
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    switch (target) {
      case 'substitutionF':
        this.substitutionF.set(value);
        break;
      case 'substitutionG':
        this.substitutionG.set(value);
        break;
      case 'substitutionH':
        this.substitutionH.set(value);
        break;
      case 'partsU':
        this.partsU.set(value);
        break;
      case 'partsDv':
        this.partsDv.set(value);
        break;
      case 'fractionsNumerator':
        this.fractionsNumerator.set(value);
        break;
      case 'fractionsRoots':
        this.fractionsRoots.set(value);
        break;
    }
  }

  applyDefinitePreset(expression: string, a: string, b: string): void {
    this.expression.set(expression);
    this.aInput.set(a);
    this.bInput.set(b);
  }

  format(value: number | null): string {
    return value === null ? '—' : formatExact(value, { digits: 6 });
  }

  formatList(values: number[]): string {
    return values.length === 0 ? '—' : values.map((value) => this.format(value)).join(', ');
  }

  private compile(expression: string, variables: string[] = ['x']): EvalFunction | null {
    return compileExpression(expression, variables).compiled;
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) {
      return;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const bounds = this.bounds();
    drawGrid(ctx, this.width, this.height, bounds);
    drawAxes(ctx, this.width, this.height, bounds);

    if (this.mode() === 'definite' || this.mode() === 'improper') {
      const fn = this.mainFunction();
      if (fn && this.intervalValid()) {
        const aX = ((this.a() - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
        const bX = ((this.b() - bounds.xMin) / (bounds.xMax - bounds.xMin)) * this.width;
        const zeroY = this.height - ((0 - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
        ctx.beginPath();
        ctx.moveTo(aX, zeroY);
        for (let px = aX; px <= bX; px += 2) {
          const worldX = bounds.xMin + (px / this.width) * (bounds.xMax - bounds.xMin);
          const value = evaluateAt(fn, worldX);
          if (!Number.isFinite(value)) {
            continue;
          }
          const y =
            this.height - ((value - bounds.yMin) / (bounds.yMax - bounds.yMin)) * this.height;
          ctx.lineTo(px, y);
        }
        ctx.lineTo(bX, zeroY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.fill();
      }
    }

    drawCurve(ctx, this.width, this.height, bounds, this.points(), '#38bdf8');
  }
}
