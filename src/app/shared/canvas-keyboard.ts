import { Directive, EventEmitter, HostListener, Output } from '@angular/core';

export interface CanvasPanEvent {
  /** Desplazamiento horizontal de la vista, en píxeles. */
  x: number;
  /** Desplazamiento vertical de la vista, en píxeles. */
  y: number;
}

/**
 * Navegación por teclado para canvas con paneo y zoom.
 * Flechas: desplazar. + / -: zoom. 0: restablecer.
 */
@Directive({
  selector: 'canvas[appCanvasKeyboard]',
  host: { tabindex: '0' },
})
export class CanvasKeyboard {
  @Output() readonly pan = new EventEmitter<CanvasPanEvent>();
  @Output() readonly zoom = new EventEmitter<number>();
  @Output() readonly resetView = new EventEmitter<void>();

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const step = event.shiftKey ? 96 : 32;
    let handled = true;

    switch (event.key) {
      case 'ArrowLeft':
        this.pan.emit({ x: step, y: 0 });
        break;
      case 'ArrowRight':
        this.pan.emit({ x: -step, y: 0 });
        break;
      case 'ArrowUp':
        this.pan.emit({ x: 0, y: step });
        break;
      case 'ArrowDown':
        this.pan.emit({ x: 0, y: -step });
        break;
      case '+':
      case '=':
        this.zoom.emit(1.2);
        break;
      case '-':
      case '_':
        this.zoom.emit(1 / 1.2);
        break;
      case '0':
      case 'Home':
        this.resetView.emit();
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
  }
}
