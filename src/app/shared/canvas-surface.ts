export interface CanvasSize {
  w: number;
  h: number;
}

export interface CanvasSurfaceOptions {
  canvas: HTMLCanvasElement;
  /** Elemento que define el tamaño visible del canvas. */
  container: HTMLElement;
  /** Dibuja el contenido completo del canvas. */
  draw: () => void;
  /** Notifica cambios reales de tamaño o densidad de píxeles. */
  onResize?: (size: CanvasSize, pixelRatio: number) => void;
  maxPixelRatio?: number;
}

const MAX_PIXEL_RATIO = 2.5;

/**
 * Gestiona el ciclo de vida común de un canvas 2D: densidad de píxeles,
 * ResizeObserver, programación de frames y limpieza.
 */
export class CanvasSurface {
  readonly context: CanvasRenderingContext2D | null;
  width = 0;
  height = 0;
  pixelRatio = 1;

  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly options: CanvasSurfaceOptions;
  private readonly resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private fallback = 0;
  private destroyed = false;
  private readonly onWindowResize = (): void => this.resize();

  constructor(options: CanvasSurfaceOptions) {
    this.options = options;
    this.canvas = options.canvas;
    this.container = options.container;
    this.context = this.canvas.getContext('2d');

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }

    window.addEventListener('resize', this.onWindowResize);
  }

  resize(): void {
    if (this.destroyed) {
      return;
    }

    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const maxPixelRatio = this.options.maxPixelRatio ?? MAX_PIXEL_RATIO;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);

    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) {
      return;
    }

    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);

    this.options.onResize?.({ w: width, h: height }, pixelRatio);
    this.requestDraw();
  }

  requestDraw(): void {
    if (!this.context || this.frame || this.destroyed) {
      return;
    }

    this.frame = requestAnimationFrame(() => {
      cancelAnimationFrame(this.frame);
      clearTimeout(this.fallback);
      this.frame = 0;
      this.fallback = 0;
      this.options.draw();
    });

    // Respaldo para pestañas o entornos donde rAF está limitado.
    this.fallback = window.setTimeout(() => {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.fallback = 0;
      this.options.draw();
    }, 90);
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    cancelAnimationFrame(this.frame);
    clearTimeout(this.fallback);
  }
}
