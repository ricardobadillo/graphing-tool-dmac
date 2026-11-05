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
import { clamp, formatNumber } from '../shared/math-utils';
import { julia, mandelbrot } from './geometry';

type Mode = 'fractal' | 'circle' | 'mobius';
type FractalType = 'mandelbrot' | 'julia';

interface ScreenPoint {
  x: number;
  y: number;
}

interface MobiusQuad {
  points: ScreenPoint[];
  depth: number;
  color: string;
}

const PALETTE = buildPalette();

function buildPalette(): Uint8ClampedArray {
  const stops = [
    { at: 0, color: [8, 16, 40] },
    { at: 0.22, color: [24, 82, 170] },
    { at: 0.42, color: [0, 190, 230] },
    { at: 0.62, color: [90, 235, 165] },
    { at: 0.8, color: [255, 214, 70] },
    { at: 1, color: [255, 250, 220] },
  ];
  const palette = new Uint8ClampedArray(256 * 3);

  for (let index = 0; index < 256; index += 1) {
    const t = index / 255;
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let stop = 0; stop < stops.length - 1; stop += 1) {
      if (t >= stops[stop].at && t <= stops[stop + 1].at) {
        left = stops[stop];
        right = stops[stop + 1];
        break;
      }
    }
    const span = Math.max(1e-9, right.at - left.at);
    const ratio = (t - left.at) / span;
    palette[index * 3] = Math.round(left.color[0] + (right.color[0] - left.color[0]) * ratio);
    palette[index * 3 + 1] = Math.round(left.color[1] + (right.color[1] - left.color[1]) * ratio);
    palette[index * 3 + 2] = Math.round(left.color[2] + (right.color[2] - left.color[2]) * ratio);
  }
  return palette;
}

@Component({
  selector: 'app-geometry-explorer',
  imports: [CanvasKeyboard],
  templateUrl: './geometry-explorer.html',
  styleUrl: './geometry-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeometryExplorer {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>('fractal');
  readonly fractalType = signal<FractalType>('mandelbrot');
  readonly maxIterations = signal(120);
  readonly juliaReInput = signal('-0.8');
  readonly juliaImInput = signal('0.156');

  readonly centerX = signal(-0.5);
  readonly centerY = signal(0);
  readonly span = signal(3.2);

  readonly angleDegrees = signal(32);

  readonly yaw = signal(0.55);
  readonly pitch = signal(-0.5);

  readonly modeInfo = computed(() => {
    switch (this.mode()) {
      case 'fractal':
        return {
          label: this.fractalType() === 'mandelbrot' ? 'Mandelbrot' : 'Julia',
          title:
            this.fractalType() === 'mandelbrot'
              ? 'El conjunto de Mandelbrot'
              : 'Un conjunto de Julia',
          subtitle: 'Arrastra para desplazar · rueda para hacer zoom',
          expression: 'zₙ₊₁ = zₙ² + c',
        };
      case 'circle':
        return {
          label: 'Trigonometría',
          title: 'El círculo trigonométrico',
          subtitle: 'Seno, coseno y tangente sobre la circunferencia unitaria',
          expression: '(cos θ, sen θ)',
        };
      case 'mobius':
        return {
          label: 'Topología',
          title: 'La banda de Möbius',
          subtitle: 'Una superficie con una sola cara y un solo borde',
          expression: 'una cara · un borde',
        };
    }
  });

  readonly juliaC = computed(() => ({
    x: this.numberOr(this.juliaReInput(), -0.8),
    y: this.numberOr(this.juliaImInput(), 0.156),
  }));

  readonly initialSpan = computed(() => (this.fractalType() === 'mandelbrot' ? 3.2 : 4));

  readonly angleRadians = computed(() => (this.angleDegrees() * Math.PI) / 180);
  readonly sine = computed(() => Math.sin(this.angleRadians()));
  readonly cosine = computed(() => Math.cos(this.angleRadians()));
  readonly tangent = computed(() => Math.tan(this.angleRadians()));
  readonly dragging = signal(false);

  readonly canvasSize = signal({ w: 0, h: 0 });

  private surface: CanvasSurface | null = null;
  private offscreen: HTMLCanvasElement | null = null;

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
  private dragStart: { x: number; y: number } | null = null;
  private dragCenter: { x: number; y: number } | null = null;

  constructor() {
    effect(() => {
      this.mode();
      this.fractalType();
      this.maxIterations();
      this.juliaC();
      this.centerX();
      this.centerY();
      this.span();
      this.angleDegrees();
      this.yaw();
      this.pitch();
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
      this.offscreen = document.createElement('canvas');

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

  setFractalType(type: FractalType): void {
    this.fractalType.set(type);
    if (type === 'mandelbrot') {
      this.centerX.set(-0.5);
      this.centerY.set(0);
      this.span.set(3.2);
    } else {
      this.centerX.set(0);
      this.centerY.set(0);
      this.span.set(4);
    }
  }

  onMaxIterationsInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.maxIterations.set(clamp(Math.round(value), 30, 250));
    }
  }

  onJuliaInput(axis: 're' | 'im', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (axis === 're') {
      this.juliaReInput.set(value);
    } else {
      this.juliaImInput.set(value);
    }
  }

  onAngleInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) {
      this.angleDegrees.set(clamp(value, 0, 360));
    }
  }

  onAnglePreset(value: number): void {
    this.angleDegrees.set(value);
  }

  resetFractalView(): void {
    this.setFractalType(this.fractalType());
  }

  resetMobius(): void {
    this.yaw.set(0.55);
    this.pitch.set(-0.5);
  }

  onPointerDown(event: PointerEvent): void {
    if (this.mode() === 'circle') {
      return;
    }
    const canvas = this.canvasRef().nativeElement;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Ignorar.
    }
    const point = this.localPoint(event);
    this.dragging.set(true);
    this.dragStart = point;

    if (this.mode() === 'fractal') {
      this.dragCenter = { x: this.centerX(), y: this.centerY() };
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragStart) {
      return;
    }
    const point = this.localPoint(event);
    const dx = point.x - this.dragStart.x;
    const dy = point.y - this.dragStart.y;

    if (this.mode() === 'fractal' && this.dragCenter) {
      const worldPerPixel = this.span() / Math.max(1, this.width);
      this.centerX.set(this.dragCenter.x - dx * worldPerPixel);
      this.centerY.set(this.dragCenter.y + dy * worldPerPixel);
      return;
    }

    if (this.mode() === 'mobius') {
      this.yaw.set(this.yaw() + dx * 0.008);
      this.pitch.set(clamp(this.pitch() + dy * 0.008, -1.3, 1.3));
      this.dragStart = point;
    }
  }

  onPointerUp(event: PointerEvent): void {
    const canvas = this.canvasRef().nativeElement;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Ignorar.
    }
    this.dragStart = null;
    this.dragCenter = null;
    this.dragging.set(false);
  }

  panBy(dx: number, dy: number): void {
    if (this.mode() === 'fractal') {
      const worldPerPixel = this.span() / Math.max(1, this.width);
      this.centerX.update((value) => value - dx * worldPerPixel);
      this.centerY.update((value) => value + dy * worldPerPixel);
    } else if (this.mode() === 'mobius') {
      this.yaw.update((value) => value + dx * 0.008);
      this.pitch.set(clamp(this.pitch() + dy * 0.008, -1.3, 1.3));
    }
  }

  zoomBy(factor: number): void {
    if (this.mode() === 'fractal') {
      this.span.set(clamp(this.span() / factor, 1e-6, 8));
    } else if (this.mode() === 'mobius') {
      this.pitch.set(clamp(this.pitch() + (factor - 1) * 0.5, -1.3, 1.3));
    }
  }

  resetView(): void {
    if (this.mode() === 'fractal') {
      this.resetFractalView();
    } else if (this.mode() === 'mobius') {
      this.resetMobius();
    }
  }

  onWheel(event: WheelEvent): void {
    if (this.mode() === 'circle') {
      return;
    }
    event.preventDefault();

    if (this.mode() === 'fractal') {
      const factor = Math.exp(event.deltaY * 0.0012);
      this.span.set(clamp(this.span() * factor, 1e-6, 8));
    } else {
      this.pitch.set(clamp(this.pitch() + event.deltaY * 0.0005, -1.3, 1.3));
    }
  }

  formatValue(value: number, digits = 3): string {
    return formatNumber(value, digits).replace(/-/g, '−');
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

    if (this.mode() === 'fractal') {
      this.drawFractal(ctx);
    } else if (this.mode() === 'circle') {
      this.drawCircle(ctx);
    } else {
      this.drawMobius(ctx);
    }
  }

  // ------------------------------------------------------------------ fractal

  private drawFractal(ctx: CanvasRenderingContext2D): void {
    const offscreen = this.offscreen;
    if (!offscreen) {
      return;
    }

    const resolution = 0.55;
    const renderWidth = Math.max(2, Math.round(this.width * resolution));
    const renderHeight = Math.max(2, Math.round(this.height * resolution));
    offscreen.width = renderWidth;
    offscreen.height = renderHeight;
    const offscreenContext = offscreen.getContext('2d');
    if (!offscreenContext) {
      return;
    }

    const image = offscreenContext.createImageData(renderWidth, renderHeight);
    const spanX = this.span();
    const spanY = spanX * (this.height / this.width);
    const centerX = this.centerX();
    const centerY = this.centerY();
    const maxIterations = this.maxIterations();
    const juliaC = this.juliaC();
    const isJulia = this.fractalType() === 'julia';

    for (let py = 0; py < renderHeight; py += 1) {
      const cy = centerY + (0.5 - (py + 0.5) / renderHeight) * spanY;
      for (let px = 0; px < renderWidth; px += 1) {
        const cx = centerX + ((px + 0.5) / renderWidth - 0.5) * spanX;
        const escape = isJulia
          ? julia(cx, cy, juliaC.x, juliaC.y, maxIterations)
          : mandelbrot(cx, cy, maxIterations);
        const index = (py * renderWidth + px) * 4;

        if (escape.iterations >= maxIterations) {
          image.data[index] = 5;
          image.data[index + 1] = 8;
          image.data[index + 2] = 18;
          image.data[index + 3] = 255;
        } else {
          const normalized = Math.pow(escape.smooth / maxIterations, 0.4);
          const colorIndex = Math.min(255, Math.floor(normalized * 255)) * 3;
          image.data[index] = PALETTE[colorIndex];
          image.data[index + 1] = PALETTE[colorIndex + 1];
          image.data[index + 2] = PALETTE[colorIndex + 2];
          image.data[index + 3] = 255;
        }
      }
    }

    offscreenContext.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, this.width, this.height);
  }

  // ------------------------------------------------------------------- círculo

  private drawCircle(ctx: CanvasRenderingContext2D): void {
    const size = Math.min(this.width, this.height);
    const scale = size * 0.32;
    const cx = this.width / 2;
    const cy = this.height / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let value = -2; value <= 2; value += 0.5) {
      if (Math.abs(value) < 1e-9) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(cx + value * scale, 0);
      ctx.lineTo(cx + value * scale, this.height);
      ctx.moveTo(0, cy + value * scale);
      ctx.lineTo(this.width, cy + value * scale);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - scale * 1.4, cy);
    ctx.lineTo(cx + scale * 1.4, cy);
    ctx.moveTo(cx, cy - scale * 1.4);
    ctx.lineTo(cx, cy + scale * 1.4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, scale, 0, Math.PI * 2);
    ctx.stroke();

    const angle = this.angleRadians();
    const pointX = cx + Math.cos(angle) * scale;
    const pointY = cy - Math.sin(angle) * scale;

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pointX, pointY);
    ctx.lineTo(pointX, cy);
    ctx.moveTo(pointX, pointY);
    ctx.lineTo(cx, pointY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, scale * 0.28, 0, -angle, true);
    ctx.stroke();

    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pointX, pointY);
    ctx.stroke();

    this.drawScreenPoint(ctx, pointX, pointY, '#a78bfa', 5);
    this.drawScreenLabel(
      ctx,
      `cos = ${this.formatValue(this.cosine())}`,
      pointX,
      cy,
      '#7dd3fc',
      8,
      14,
    );
    this.drawScreenLabel(
      ctx,
      `sen = ${this.formatValue(this.sine())}`,
      cx,
      pointY,
      '#6ee7b7',
      8,
      -8,
    );
    this.drawScreenLabel(
      ctx,
      `θ = ${this.formatValue(this.angleDegrees(), 1)}°`,
      cx + Math.cos(angle / 2) * scale * 0.45,
      cy - Math.sin(angle / 2) * scale * 0.45,
      '#c4b5fd',
    );

    ctx.fillStyle = 'rgba(203, 213, 225, 0.82)';
    ctx.font = '500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('1', cx + scale, cy + 15);
    ctx.fillText('−1', cx - scale, cy + 15);
    ctx.fillText('1', cx - 15, cy - scale + 4);
    ctx.fillText('−1', cx - 20, cy + scale + 4);
    ctx.restore();
  }

  // -------------------------------------------------------------------- Möbius

  private drawMobius(ctx: CanvasRenderingContext2D): void {
    const segments = 84;
    const widthSegments = 10;
    const scale = Math.min(this.width, this.height) * 0.3;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const quads: MobiusQuad[] = [];
    const yaw = this.yaw();
    const pitch = this.pitch();

    const project = (x: number, y: number, z: number) => {
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const x1 = x * cosYaw - y * sinYaw;
      const y1 = x * sinYaw + y * cosYaw;
      const z1 = z;
      const y2 = y1 * cosPitch - z1 * sinPitch;
      const z2 = y1 * sinPitch + z1 * cosPitch;
      return {
        x: centerX + x1 * scale,
        y: centerY - z2 * scale,
        depth: y2,
      };
    };

    const point = (u: number, v: number) => {
      const radius = 1 + v * Math.cos(u / 2);
      return {
        x: radius * Math.cos(u),
        y: radius * Math.sin(u),
        z: v * Math.sin(u / 2),
      };
    };

    for (let uIndex = 0; uIndex < segments; uIndex += 1) {
      const u0 = (uIndex / segments) * Math.PI * 2;
      const u1 = ((uIndex + 1) / segments) * Math.PI * 2;
      for (let vIndex = 0; vIndex < widthSegments; vIndex += 1) {
        const v0 = -0.6 + (vIndex / widthSegments) * 1.2;
        const v1 = -0.6 + ((vIndex + 1) / widthSegments) * 1.2;
        const corners = [
          project(point(u0, v0).x, point(u0, v0).y, point(u0, v0).z),
          project(point(u1, v0).x, point(u1, v0).y, point(u1, v0).z),
          project(point(u1, v1).x, point(u1, v1).y, point(u1, v1).z),
          project(point(u0, v1).x, point(u0, v1).y, point(u0, v1).z),
        ];
        const depth = corners.reduce((sum, corner) => sum + corner.depth, 0) / corners.length;
        const hue = 195 + 45 * Math.sin(u0);
        quads.push({
          points: corners.map((corner) => ({ x: corner.x, y: corner.y })),
          depth,
          color: `hsla(${hue}, 72%, 55%, 0.42)`,
        });
      }
    }

    quads.sort((left, right) => right.depth - left.depth);
    for (const quad of quads) {
      ctx.beginPath();
      quad.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      ctx.fillStyle = quad.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(8, 13, 25, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let index = 0; index <= segments; index += 1) {
      const u = (index / segments) * Math.PI * 2;
      const upper = point(u, 0.6);
      const projected = project(upper.x, upper.y, upper.z);
      if (index === 0) {
        ctx.moveTo(projected.x, projected.y);
      } else {
        ctx.lineTo(projected.x, projected.y);
      }
    }
    ctx.stroke();
  }

  // ------------------------------------------------------------------ helpers

  private localPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private numberOr(text: string, fallback: number): number {
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) ? value : fallback;
  }

  private drawScreenPoint(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    radius: number,
  ): void {
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

  private drawScreenLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    y: number,
    color: string,
    dx = 8,
    dy = -8,
  ): void {
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
}
