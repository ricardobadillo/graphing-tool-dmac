import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  SET_LAWS,
  buildContext,
  cartesianSize,
  formatSet,
  inclusionExclusion,
  parseSetExpression,
  parseSetInput,
  powerSetSize,
  regionInfos,
  regionResults,
  resultElements,
  verifyLaw,
  type RegionInfo,
  type SetContext,
  type SetLaw,
  type SetNode,
} from './sets';
import { CanvasSurface } from '../shared/canvas-surface';

type Mode = 'venn' | 'laws';
type LawSide = 'left' | 'right';

interface VennRow extends RegionInfo {
  inA: boolean;
  inB: boolean;
  inC: boolean;
  result: boolean;
}

interface LawRow extends VennRow {
  left: boolean;
  right: boolean;
  equal: boolean;
}

interface CircleLayout {
  name: 'A' | 'B' | 'C';
  x: number;
  y: number;
  r: number;
  color: string;
}

interface VennLayout {
  u: { x: number; y: number; w: number; h: number };
  circles: CircleLayout[];
}

@Component({
  selector: 'app-set-theory-explorer',
  templateUrl: './set-theory-explorer.html',
  styleUrl: './set-theory-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTheoryExplorer {
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly expressionInput = viewChild<ElementRef<HTMLInputElement>>('expressionInput');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>('venn');
  readonly laws = SET_LAWS;

  readonly uInput = signal('1,2,3,4,5,6,7,8,9,10');
  readonly aInput = signal('1,2,3,4');
  readonly bInput = signal('3,4,5,6');
  readonly cInput = signal('4,6,7,8');
  readonly useC = signal(true);

  readonly expression = signal('(A ∩ B) ∪ C');
  readonly lawId = signal(SET_LAWS[0].id);
  readonly lawSide = signal<LawSide>('left');
  readonly hoverKey = signal<number | null>(null);
  readonly size = signal({ w: 0, h: 0 });

  readonly tokens = ['A', 'B', 'C', 'U', '∪', '∩', '\\', '△', 'ᶜ', '(', ')', '∅'];
  readonly presets = [
    'A ∪ B',
    'A ∩ B',
    'A \\ B',
    'A △ B',
    'Aᶜ',
    '(A ∪ B)ᶜ',
    'A ∩ (B ∪ C)',
    '(A ∪ B) ∩ C',
    'A ∩ Bᶜ',
  ];

  readonly uParsed = computed(() => parseSetInput(this.uInput()));
  readonly aParsed = computed(() => parseSetInput(this.aInput()));
  readonly bParsed = computed(() => parseSetInput(this.bInput()));
  readonly cParsed = computed(() => parseSetInput(this.cInput()));

  readonly inputErrors = computed(() => {
    const errors: string[] = [];
    if (this.uParsed().error) {
      errors.push(`U: ${this.uParsed().error}`);
    }
    if (this.aParsed().error) {
      errors.push(`A: ${this.aParsed().error}`);
    }
    if (this.bParsed().error) {
      errors.push(`B: ${this.bParsed().error}`);
    }
    if (this.useC() && this.cParsed().error) {
      errors.push(`C: ${this.cParsed().error}`);
    }
    return errors;
  });

  readonly context = computed<SetContext>(() =>
    buildContext(this.uInput(), this.aInput(), this.bInput(), this.cInput(), this.useC()),
  );

  readonly parsedExpression = computed(() => parseSetExpression(this.expression()));
  readonly activeLaw = computed<SetLaw>(
    () => SET_LAWS.find((law) => law.id === this.lawId()) ?? SET_LAWS[0],
  );
  readonly lawVerification = computed(() => verifyLaw(this.activeLaw(), this.context()));

  readonly displayAst = computed<SetNode | null>(() => {
    if (this.mode() === 'venn') {
      return this.parsedExpression().ast;
    }
    const verification = this.lawVerification();
    return this.lawSide() === 'left' ? verification.left.ast : verification.right.ast;
  });

  readonly displayError = computed(() => {
    if (this.mode() === 'venn') {
      return this.parsedExpression().error;
    }
    const verification = this.lawVerification();
    return this.lawSide() === 'left' ? verification.left.error : verification.right.error;
  });

  readonly displayRegions = computed(() => {
    const ast = this.displayAst();
    const map = new Map<number, boolean>();
    if (!ast) {
      return map;
    }
    const keys = this.useC() ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3];
    const values = regionResults(ast, this.useC());
    keys.forEach((key, index) => map.set(key, values[index] ?? false));
    return map;
  });

  readonly regions = computed(() => regionInfos(this.context()));

  readonly vennRows = computed<VennRow[]>(() =>
    this.regions().map((region) => ({
      ...region,
      inA: (region.key & 1) !== 0,
      inB: (region.key & 2) !== 0,
      inC: this.useC() && (region.key & 4) !== 0,
      result: this.displayRegions().get(region.key) ?? false,
    })),
  );

  readonly lawRows = computed<LawRow[]>(() => {
    const verification = this.lawVerification();
    if (verification.left.error || verification.right.error) {
      return [];
    }
    return this.vennRows().map((row, index) => ({
      ...row,
      left: verification.leftRegions[index] ?? false,
      right: verification.rightRegions[index] ?? false,
      equal:
        (verification.leftRegions[index] ?? false) === (verification.rightRegions[index] ?? false),
    }));
  });

  readonly hoverRegion = computed(() => {
    const key = this.hoverKey();
    if (key === null) {
      return null;
    }
    return this.regions().find((region) => region.key === key) ?? null;
  });

  readonly resultSet = computed(() => {
    const ast = this.parsedExpression().ast;
    return this.mode() === 'venn' && ast ? resultElements(ast, this.context()) : [];
  });

  readonly sizes = computed(() => {
    const context = this.context();
    return {
      a: context.A.size,
      b: context.B.size,
      c: context.C.size,
      u: context.U.size,
    };
  });

  readonly counts = computed(() => inclusionExclusion(this.context()));

  readonly powerSetA = computed(() => powerSetSize(this.context().A.size));
  readonly cartesianAB = computed(() => cartesianSize(this.context().A, this.context().B));

  readonly subsets = computed(() => {
    const context = this.context();
    return {
      aInB: [...context.A].every((element) => context.B.has(element)),
      bInA: [...context.B].every((element) => context.A.has(element)),
    };
  });

  readonly displayColor = computed(() => {
    if (this.mode() === 'laws' && this.lawSide() === 'right') {
      return 'emerald';
    }
    return 'violet';
  });

  private surface: CanvasSurface | null = null;
  private surfaceCanvas: HTMLCanvasElement | null = null;

  private canvasElement(): HTMLCanvasElement | null {
    return this.canvasRef()?.nativeElement ?? null;
  }

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
  private layout: VennLayout | null = null;

  constructor() {
    effect(() => {
      this.mode();
      this.uInput();
      this.aInput();
      this.bInput();
      this.cInput();
      this.useC();
      this.expression();
      this.lawId();
      this.lawSide();
      this.canvasRef();
      this.attachSurface();
      this.size();
      this.scheduleDraw();
    });

    this.destroyRef.onDestroy(() => this.surface?.destroy());
  }

  private attachSurface(): void {
    if (typeof CanvasRenderingContext2D === 'undefined') {
      return;
    }

    const canvas = this.canvasElement();
    if (!canvas || canvas === this.surfaceCanvas) {
      return;
    }

    const container = canvas.parentElement;
    if (!container) {
      return;
    }

    this.surface?.destroy();
    this.surfaceCanvas = canvas;
    this.surface = new CanvasSurface({
      canvas,
      container,
      draw: () => this.draw(),
      onResize: (size) => this.size.set(size),
    });
    this.surface.resize();
  }

  // ------------------------------------------------------------------ acciones

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.hoverKey.set(null);
  }

  onExpressionInput(event: Event): void {
    this.expression.set((event.target as HTMLInputElement).value);
  }

  setExpression(expression: string): void {
    this.expression.set(expression);
    this.focusExpression();
  }

  appendToken(token: string): void {
    const input = this.expressionInput()?.nativeElement;
    const value = this.expression();
    const text = ['∪', '∩', '\\', '△'].includes(token) ? ` ${token} ` : token;

    if (!input) {
      this.expression.set(value + text);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    this.expression.set(next);
    window.setTimeout(() => {
      input.focus();
      const position = start + text.length;
      input.setSelectionRange(position, position);
    }, 0);
  }

  clearExpression(): void {
    this.expression.set('');
    this.focusExpression();
  }

  private focusExpression(): void {
    window.setTimeout(() => {
      this.expressionInput()?.nativeElement.focus();
    }, 0);
  }

  onUInput(event: Event): void {
    this.uInput.set((event.target as HTMLInputElement).value);
  }

  onAInput(event: Event): void {
    this.aInput.set((event.target as HTMLInputElement).value);
  }

  onBInput(event: Event): void {
    this.bInput.set((event.target as HTMLInputElement).value);
  }

  onCInput(event: Event): void {
    this.cInput.set((event.target as HTMLInputElement).value);
  }

  toggleUseC(): void {
    this.useC.update((value) => !value);
    this.hoverKey.set(null);
  }

  onLawChange(event: Event): void {
    this.lawId.set((event.target as HTMLSelectElement).value);
  }

  setLawSide(side: LawSide): void {
    this.lawSide.set(side);
    this.hoverKey.set(null);
  }

  formatSet(elements: Iterable<string>): string {
    return formatSet(elements);
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

    const layout = this.computeLayout();
    this.layout = layout;

    this.drawUniverse(ctx, layout);
    this.drawShading(ctx, layout);
    this.drawCircles(ctx, layout);
    this.drawLabels(ctx, layout);
  }

  private computeLayout(): VennLayout {
    const w = this.width;
    const h = this.height;
    const u = { x: 14, y: 14, w: Math.max(1, w - 28), h: Math.max(1, h - 28) };

    if (this.useC()) {
      const r = Math.min(w * 0.21, h * 0.28);
      const cx = w / 2;
      const cy = h / 2;
      return {
        u,
        circles: [
          { name: 'A', x: cx - r * 0.7, y: cy - r * 0.32, r, color: '#38bdf8' },
          { name: 'B', x: cx + r * 0.7, y: cy - r * 0.32, r, color: '#f472b6' },
          { name: 'C', x: cx, y: cy + r * 0.64, r, color: '#fbbf24' },
        ],
      };
    }

    const r = Math.min(w * 0.28, h * 0.4);
    const cx = w / 2;
    const cy = h / 2;
    return {
      u,
      circles: [
        { name: 'A', x: cx - r * 0.55, y: cy, r, color: '#38bdf8' },
        { name: 'B', x: cx + r * 0.55, y: cy, r, color: '#f472b6' },
      ],
    };
  }

  private drawUniverse(ctx: CanvasRenderingContext2D, layout: VennLayout): void {
    this.roundedRectPath(ctx, layout.u.x, layout.u.y, layout.u.w, layout.u.h, 18);
    ctx.fillStyle = 'rgba(8, 13, 25, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawShading(ctx: CanvasRenderingContext2D, layout: VennLayout): void {
    const results = this.displayRegions();
    const { u } = layout;
    const shade = document.createElement('canvas');
    shade.width = u.w;
    shade.height = u.h;
    const shadeCtx = shade.getContext('2d');
    if (!shadeCtx) {
      return;
    }

    const image = shadeCtx.createImageData(u.w, u.h);
    const data = image.data;
    const color = this.displayColor() === 'emerald' ? [52, 211, 153] : [167, 139, 250];
    const alpha = Math.round(255 * 0.28);

    for (let y = 0; y < u.h; y += 1) {
      for (let x = 0; x < u.w; x += 1) {
        const mx = u.x + x;
        const my = u.y + y;
        let key = 0;
        for (const circle of layout.circles) {
          const dx = mx - circle.x;
          const dy = my - circle.y;
          if (dx * dx + dy * dy <= circle.r * circle.r) {
            key |= circle.name === 'A' ? 1 : circle.name === 'B' ? 2 : 4;
          }
        }
        if (!this.useC()) {
          key &= 3;
        }
        if (results.get(key)) {
          const index = (y * u.w + x) * 4;
          data[index] = color[0];
          data[index + 1] = color[1];
          data[index + 2] = color[2];
          data[index + 3] = alpha;
        }
      }
    }

    shadeCtx.putImageData(image, 0, 0);

    ctx.save();
    this.roundedRectPath(ctx, u.x, u.y, u.w, u.h, 18);
    ctx.clip();
    ctx.drawImage(shade, u.x, u.y);
    ctx.restore();
  }

  private drawCircles(ctx: CanvasRenderingContext2D, layout: VennLayout): void {
    for (const circle of layout.circles) {
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
      ctx.strokeStyle = circle.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawLabels(ctx: CanvasRenderingContext2D, layout: VennLayout): void {
    ctx.save();
    ctx.font = '600 13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const circle of layout.circles) {
      const labelX =
        circle.name === 'A'
          ? circle.x - circle.r * 0.58
          : circle.name === 'B'
            ? circle.x + circle.r * 0.58
            : circle.x;
      const labelY = circle.name === 'C' ? circle.y + circle.r * 0.78 : circle.y - circle.r * 0.62;
      this.drawText(ctx, circle.name, labelX, labelY, circle.color, '600 13px ui-sans-serif');
    }

    this.drawText(
      ctx,
      'U',
      layout.u.x + 18,
      layout.u.y + 18,
      'rgba(148, 163, 184, 0.9)',
      '600 12px ui-monospace',
    );

    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    for (const region of this.regions()) {
      if (region.elements.length === 0) {
        continue;
      }
      const position = this.regionPosition(region.key, layout);
      if (!position) {
        continue;
      }
      this.drawText(
        ctx,
        `n=${region.elements.length}`,
        position.x,
        position.y,
        '#e2e8f0',
        '500 10px ui-monospace',
      );
    }

    ctx.restore();
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    font: string,
  ): void {
    ctx.font = `${font}, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8, 13, 25, 0.88)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  private regionPosition(key: number, layout: VennLayout): { x: number; y: number } | null {
    const byName = new Map(layout.circles.map((circle) => [circle.name, circle]));
    const a = byName.get('A');
    const b = byName.get('B');
    const c = byName.get('C');

    if (!a || !b) {
      return null;
    }

    if (!this.useC() || !c) {
      if (key === 0) {
        return { x: layout.u.x + layout.u.w - 50, y: layout.u.y + 28 };
      }
      if (key === 1) {
        return { x: a.x - a.r * 0.46, y: a.y };
      }
      if (key === 2) {
        return { x: b.x + b.r * 0.46, y: b.y };
      }
      if (key === 3) {
        return { x: (a.x + b.x) / 2, y: a.y - a.r * 0.1 };
      }
      return null;
    }

    const r = a.r;
    switch (key) {
      case 0:
        return { x: layout.u.x + layout.u.w - 50, y: layout.u.y + 28 };
      case 1:
        return { x: a.x - r * 0.46, y: a.y - r * 0.04 };
      case 2:
        return { x: b.x + r * 0.46, y: b.y - r * 0.04 };
      case 3:
        return { x: (a.x + b.x) / 2, y: a.y - r * 0.38 };
      case 4:
        return { x: c.x, y: c.y + r * 0.46 };
      case 5:
        return { x: (a.x + c.x) / 2 - r * 0.28, y: (a.y + c.y) / 2 };
      case 6:
        return { x: (b.x + c.x) / 2 + r * 0.28, y: (b.y + c.y) / 2 };
      case 7:
        return {
          x: (a.x + b.x + c.x) / 3,
          y: (a.y + b.y + c.y) / 3,
        };
      default:
        return null;
    }
  }

  private roundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
  ): void {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.layout) {
      return;
    }

    const canvas = this.canvasElement();
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { u } = this.layout;

    if (x < u.x || x > u.x + u.w || y < u.y || y > u.y + u.h) {
      this.hoverKey.set(null);
      return;
    }

    let key = 0;
    for (const circle of this.layout.circles) {
      const dx = x - circle.x;
      const dy = y - circle.y;
      if (dx * dx + dy * dy <= circle.r * circle.r) {
        key |= circle.name === 'A' ? 1 : circle.name === 'B' ? 2 : 4;
      }
    }
    if (!this.useC()) {
      key &= 3;
    }
    this.hoverKey.set(key);
  }

  onPointerLeave(): void {
    this.hoverKey.set(null);
  }
}
