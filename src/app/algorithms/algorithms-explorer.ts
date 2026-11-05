import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  BIG_O_DEFINITION,
  BIG_O_TABLE,
  LAB_ALGORITHMS,
  LAB_DISTRIBUTIONS,
  LAB_SIZES,
  estimateGrowth,
  formatOperations,
  formatRatio,
  isSearchAlgorithm,
  labMeta,
  runLab,
  type LabAlgorithm,
  type LabMeasurement,
} from './complexity';
import { buildComplexityChart } from './complexity-chart';
import {
  SORT_META,
  SORT_PSEUDOCODE,
  generateArray,
  mulberry32,
  runSort,
  type SortAlgorithm,
  type SortDistribution,
  type SortFrame,
  type SortTone,
} from './sorting';

type Mode = 'sorting' | 'lab';

@Component({
  selector: 'app-algorithms-explorer',
  templateUrl: './algorithms-explorer.html',
  styleUrl: './algorithms-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlgorithmsExplorer {
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<Mode>('sorting');
  readonly sortAlgorithms = SORT_META;
  readonly sortDistributions = LAB_DISTRIBUTIONS;
  readonly labAlgorithms = LAB_ALGORITHMS;
  readonly labDistributions = LAB_DISTRIBUTIONS;
  readonly labSizes = LAB_SIZES;
  readonly bigOTable = BIG_O_TABLE;
  readonly bigODefinition = BIG_O_DEFINITION;

  readonly sortAlgorithm = signal<SortAlgorithm>('bubble');
  readonly sortDistribution = signal<SortDistribution>('random');
  readonly size = signal(16);
  readonly baseArray = signal<number[]>(generateArray(16, 'random', mulberry32(7)));

  readonly frames = signal<SortFrame[]>([]);
  readonly stepIndex = signal(0);
  readonly playing = signal(false);
  readonly speed = signal(4);

  readonly labAlgorithm = signal<LabAlgorithm>('bubble');
  readonly labDistribution = signal<SortDistribution>('random');
  readonly labLogScale = signal(false);
  readonly labShowReferences = signal(true);
  readonly labSeed = signal(1);
  readonly measurements = signal<LabMeasurement[]>(runLab('bubble', 'random', 1));

  private timer: number | null = null;

  readonly currentFrame = computed(() => this.frames()[this.stepIndex()] ?? null);
  readonly viewArray = computed(() => this.currentFrame()?.array ?? this.baseArray());
  readonly maxValue = computed(() => Math.max(1, ...this.viewArray()));
  readonly highlights = computed(() => {
    const map = new Map<number, SortTone>();
    for (const highlight of this.currentFrame()?.highlights ?? []) {
      map.set(highlight.index, highlight.tone);
    }
    return map;
  });

  readonly comparisons = computed(() => this.currentFrame()?.comparisons ?? 0);
  readonly writes = computed(() => this.currentFrame()?.writes ?? 0);
  readonly activeSortMeta = computed(
    () => SORT_META.find((item) => item.key === this.sortAlgorithm()) ?? SORT_META[0],
  );
  readonly pseudocode = computed(() => SORT_PSEUDOCODE[this.sortAlgorithm()]);
  readonly showBarLabels = computed(() => this.size() <= 20);

  readonly progress = computed(() => {
    const count = this.frames().length;
    if (count <= 1) {
      return count === 1 ? 100 : 0;
    }
    return Math.round((this.stepIndex() / (count - 1)) * 100);
  });

  readonly stepLabel = computed(() => {
    const count = this.frames().length;
    return count === 0 ? '—' : `${this.stepIndex() + 1} / ${count}`;
  });

  readonly canBack = computed(() => this.stepIndex() > 0);
  readonly canForward = computed(() => this.stepIndex() < this.frames().length - 1);

  readonly labAlgorithmMeta = computed(() => labMeta(this.labAlgorithm()));
  readonly labIsSearch = computed(() => isSearchAlgorithm(this.labAlgorithm()));
  readonly labChart = computed(() =>
    buildComplexityChart(this.measurements(), this.labLogScale(), this.labShowReferences()),
  );
  readonly labSummary = computed(() => estimateGrowth(this.measurements().at(-1)?.ratio ?? null));
  readonly labLast = computed(() => this.measurements().at(-1) ?? null);

  constructor() {
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.pause();
  }

  // ------------------------------------------------------------- ordenamientos

  selectSortAlgorithm(key: SortAlgorithm): void {
    this.pause();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.sortAlgorithm.set(key);
  }

  selectSortDistribution(key: SortDistribution): void {
    this.sortDistribution.set(key);
    this.newArray();
  }

  onSizeInput(event: Event): void {
    const size = Math.min(40, Math.max(6, Number((event.target as HTMLInputElement).value)));
    this.size.set(Number.isFinite(size) ? size : 16);
    this.newArray();
  }

  newArray(): void {
    this.pause();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.baseArray.set(generateArray(this.size(), this.sortDistribution()));
  }

  sort(): void {
    this.pause();
    const run = runSort(this.sortAlgorithm(), this.baseArray(), true);
    this.frames.set(run.frames);
    this.stepIndex.set(0);

    if (run.frames.length <= 1) {
      return;
    }

    if (this.prefersReducedMotion()) {
      this.stepIndex.set(run.frames.length - 1);
      return;
    }

    this.play();
  }

  resetVisual(): void {
    this.pause();
    this.frames.set([]);
    this.stepIndex.set(0);
  }

  finishSort(): void {
    this.pause();
    if (this.frames().length > 0) {
      this.stepIndex.set(this.frames().length - 1);
    }
  }

  barHeight(value: number): number {
    return Math.max(2, (value / this.maxValue()) * 100);
  }

  toneFor(index: number): SortTone | 'default' {
    return this.highlights().get(index) ?? 'default';
  }

  // -------------------------------------------------------------- reproductor

  togglePlay(): void {
    if (this.playing()) {
      this.pause();
      return;
    }
    if (this.frames().length <= 1) {
      return;
    }
    if (this.stepIndex() >= this.frames().length - 1) {
      this.stepIndex.set(0);
    }
    this.play();
  }

  replay(): void {
    this.stopPlayback();
    if (this.frames().length === 0) {
      return;
    }
    this.stepIndex.set(0);
    if (this.frames().length > 1) {
      this.play();
    }
  }

  stepForward(): void {
    this.pause();
    if (this.frames().length === 0) {
      return;
    }
    this.stepIndex.update((index) => Math.min(this.frames().length - 1, index + 1));
  }

  stepBack(): void {
    this.pause();
    this.stepIndex.update((index) => Math.max(0, index - 1));
  }

  setSpeed(event: Event): void {
    const speed = Number((event.target as HTMLSelectElement).value);
    this.speed.set(Number.isFinite(speed) && speed > 0 ? speed : 4);
    if (this.playing()) {
      this.stopTimer();
      this.scheduleTick();
    }
  }

  private play(): void {
    this.stopTimer();
    if (this.frames().length <= 1) {
      this.stepIndex.set(Math.max(0, this.frames().length - 1));
      return;
    }
    this.playing.set(true);
    this.scheduleTick();
  }

  private scheduleTick(): void {
    this.timer = window.setTimeout(() => {
      if (!this.playing()) {
        return;
      }

      const count = this.frames().length;
      const next = this.stepIndex() + 1;

      if (next >= count) {
        this.playing.set(false);
        this.timer = null;
        return;
      }

      this.stepIndex.set(next);

      if (next >= count - 1) {
        this.playing.set(false);
        this.timer = null;
        return;
      }

      this.scheduleTick();
    }, 600 / this.speed());
  }

  private pause(): void {
    this.playing.set(false);
    this.stopTimer();
  }

  private stopPlayback(): void {
    this.playing.set(false);
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (this.mode() !== 'sorting') {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)
    ) {
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      this.togglePlay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepForward();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.stepBack();
    }
  }

  // ----------------------------------------------------------------- laboratorio

  selectLabAlgorithm(key: string): void {
    this.labAlgorithm.set(key as LabAlgorithm);
    this.runMeasurements();
  }

  onLabAlgorithmChange(event: Event): void {
    this.selectLabAlgorithm((event.target as HTMLSelectElement).value);
  }

  selectLabDistribution(key: SortDistribution): void {
    this.labDistribution.set(key);
    this.runMeasurements();
  }

  onLabDistributionChange(event: Event): void {
    this.selectLabDistribution((event.target as HTMLSelectElement).value as SortDistribution);
  }

  distributionLabel(key: SortDistribution): string {
    return LAB_DISTRIBUTIONS.find((item) => item.key === key)?.label ?? key;
  }

  newLabSample(): void {
    this.labSeed.update((seed) => seed + 1);
    this.runMeasurements();
  }

  toggleLabScale(): void {
    this.labLogScale.update((value) => !value);
  }

  toggleLabReferences(): void {
    this.labShowReferences.update((value) => !value);
  }

  runMeasurements(): void {
    this.measurements.set(runLab(this.labAlgorithm(), this.labDistribution(), this.labSeed()));
  }

  formatOps(value: number): string {
    return formatOperations(value);
  }

  formatGrowth(value: number | null): string {
    return value === null ? '—' : formatRatio(value);
  }
}
