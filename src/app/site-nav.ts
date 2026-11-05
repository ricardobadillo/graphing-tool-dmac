import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { sectionForPath, type SectionKey } from './tools';

@Component({
  selector: 'app-site-nav',
  imports: [RouterLink],
  template: `
    <header class="sticky top-0 z-50 border-b border-white/5 bg-[#070b16]/85 backdrop-blur-xl">
      <div
        class="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <a routerLink="/" class="group flex items-center gap-2.5" aria-label="Ir al inicio">
          <span
            class="grid h-8 w-8 place-items-center rounded-xl border border-sky-400/30 bg-sky-400/10 text-sky-300 transition group-hover:border-sky-400/60 group-hover:bg-sky-400/15"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="h-[18px] w-[18px]"
            >
              <circle cx="6" cy="6" r="2.2" />
              <circle cx="18" cy="6" r="2.2" />
              <circle cx="12" cy="18" r="2.2" />
              <path d="M7.6 7.7 10.7 16M16.4 7.7 13.3 16M8.2 6h7.6" />
            </svg>
          </span>
          <span class="hidden text-sm font-semibold tracking-tight text-white sm:inline">
            Visual<span class="text-sky-400">Lab</span>
          </span>
        </a>

        <nav
          class="nav-scroll flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1"
          aria-label="Secciones principales"
        >
          <a
            routerLink="/matematicas"
            class="nav-link"
            [class.nav-link-active]="activeSection() === 'math'"
            [attr.aria-current]="activeSection() === 'math' ? 'true' : null"
          >
            Matemáticas
          </a>
          <a
            routerLink="/programacion"
            class="nav-link"
            [class.nav-link-active]="activeSection() === 'programming'"
            [attr.aria-current]="activeSection() === 'programming' ? 'true' : null"
          >
            Programación
          </a>
        </nav>
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .nav-link {
        flex-shrink: 0;
        padding: 0.35rem 0.65rem;
        border: 1px solid transparent;
        border-radius: 0.5rem;
        color: rgb(148 163 184);
        font-size: 11px;
        font-weight: 500;
        transition:
          color 150ms ease,
          background-color 150ms ease,
          border-color 150ms ease;
      }

      .nav-scroll {
        scrollbar-width: none;
      }

      .nav-scroll::-webkit-scrollbar {
        display: none;
      }

      @media (min-width: 640px) {
        .nav-link {
          padding: 0.375rem 0.9rem;
          font-size: 12px;
        }
      }

      .nav-link:hover {
        color: rgb(226 232 240);
        background: rgb(255 255 255 / 0.04);
      }

      .nav-link-active {
        color: rgb(186 230 253);
        background: rgb(56 189 248 / 0.12);
        border-color: rgb(56 189 248 / 0.25);
      }

      .nav-link:focus-visible {
        outline: 2px solid rgb(56 189 248 / 0.7);
        outline-offset: 2px;
      }
    `,
  ],
})
export class SiteNav {
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly activeSection = computed<SectionKey | null>(() => sectionForPath(this.currentUrl()));
}
