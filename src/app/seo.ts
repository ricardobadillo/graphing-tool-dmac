import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import {
  TitleStrategy,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';

/**
 * Estrategia de títulos que además actualiza la descripción y las etiquetas
 * Open Graph de cada ruta. Se ejecuta también durante el prerender.
 */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot);
    const leaf = this.leaf(snapshot.root);
    const description = leaf.data['description'];

    if (title) {
      this.title.setTitle(title);
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ name: 'twitter:title', content: title });
    }

    if (typeof description === 'string' && description.trim()) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }

    const path = snapshot.url || '/';
    this.meta.updateTag({ property: 'og:url', content: path });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.updateCanonical(path);
  }

  private leaf(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = route;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }

  private updateCanonical(path: string): void {
    const head = this.document.head;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }

    // En cliente se resuelve contra el origen real; en SSR se deja la ruta.
    const origin = this.document.location?.origin;
    link.setAttribute('href', origin ? new URL(path, origin).toString() : path);
  }
}
