import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { OPERATION_LABELS, PSEUDOCODE, STRUCTURES, type StructureMeta } from './config';
import { LESSONS, type Lesson } from './lessons';
import { buildPrediction, type PredictionSpec } from './predictions';
import {
  deserializeAvl,
  deserializeTree,
  serializeHash,
  serializeTree,
  type StructuresShareData,
} from './share';
import { buildShareUrl, copyShareUrl, decodeShare } from '../share';
import {
  INITIAL_AVL_VALUES,
  balanceFactor,
  buildBalancedAvl,
  clear as clearAvl,
  insert as insertAvl,
  randomAvl,
  remove as removeAvl,
  type AvlState,
} from './avl';
import {
  INITIAL_HASH_ENTRIES,
  HASH_SIZE,
  clear as clearHash,
  createTable,
  get as getHash,
  randomTable,
  remove as removeHash,
  set as setHash,
  type HashState,
} from './hash-table';
import {
  INITIAL_HEAP,
  clear as clearHeap,
  extractMin,
  insert as insertHeap,
  peek as peekHeap,
  randomHeap,
  type HeapState,
} from './heap';
import { layoutHeap } from './heap-layout';
import { bfs, createGraph, dfs, dijkstra, type GraphState } from './graph';
import {
  INITIAL_LIST_VALUES,
  clear as clearList,
  createList,
  insertAt,
  insertHead,
  insertTail,
  randomList,
  removeAt,
  search as searchList,
  type ListState,
} from './linked-list';
import type { Frame, HighlightTone, Operation, StructureKey } from './models';
import {
  INITIAL_QUEUE,
  clear as clearQueue,
  dequeue,
  enqueue,
  peek as peekQueue,
  randomQueue,
} from './queue';
import {
  INITIAL_STACK,
  clear as clearStack,
  peek as peekStack,
  pop as popStack,
  push as pushStack,
  randomStack,
} from './stack';
import {
  INITIAL_TREE_VALUES,
  buildBalancedTree,
  clear as clearTree,
  insert as insertTree,
  randomTree,
  remove as removeTree,
  search as searchTree,
  traverse,
  type TraversalOrder,
  type TreeState,
} from './bst';
import { layoutTree } from './tree-layout';

interface LogEntry {
  id: number;
  structure: StructureKey;
  label: string;
  message: string;
  steps: number;
}

interface ListItemView {
  id: string;
  value: number;
  index: number;
}

interface PendingPrediction extends PredictionSpec {
  label: string;
  chosen: number | null;
  revealed: boolean;
  run: () => void;
}

@Component({
  selector: 'app-data-structures-explorer',
  templateUrl: './data-structures-explorer.html',
  styleUrl: './data-structures-explorer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataStructuresExplorer {
  private readonly destroyRef = inject(DestroyRef);

  readonly structures = STRUCTURES;
  readonly lessons = LESSONS;

  readonly active = signal<StructureKey>('stack');
  readonly activeMeta = computed<StructureMeta>(
    () => STRUCTURES.find((item) => item.key === this.active()) ?? STRUCTURES[0],
  );

  readonly predictionEnabled = signal(false);
  readonly pendingPrediction = signal<PendingPrediction | null>(null);
  readonly presentationMode = signal(false);
  readonly activeLessonId = signal<string | null>(null);
  readonly lessonStep = signal(0);
  readonly toast = signal<string | null>(null);

  readonly activeLesson = computed<Lesson | null>(
    () => LESSONS.find((lesson) => lesson.id === this.activeLessonId()) ?? null,
  );
  readonly currentLessonStep = computed(
    () => this.activeLesson()?.steps[this.lessonStep()] ?? null,
  );
  readonly lessonTotal = computed(() => this.activeLesson()?.steps.length ?? 0);
  readonly predictionLocked = computed(() => {
    const prediction = this.pendingPrediction();
    return !!prediction && !prediction.revealed;
  });

  private readonly stackState = signal<number[]>([...INITIAL_STACK]);
  private readonly queueState = signal<number[]>([...INITIAL_QUEUE]);
  private readonly listState = signal<ListState>(createList([...INITIAL_LIST_VALUES]));
  private readonly bstState = signal<TreeState>(buildBalancedTree([...INITIAL_TREE_VALUES]));
  private readonly avlState = signal<AvlState>(buildBalancedAvl([...INITIAL_AVL_VALUES]));
  private readonly heapState = signal<HeapState>([...INITIAL_HEAP]);
  private readonly hashState = signal<HashState>(createTable(INITIAL_HASH_ENTRIES));

  readonly graph: GraphState = createGraph();

  readonly frames = signal<Frame<unknown>[]>([]);
  readonly stepIndex = signal(0);
  readonly playing = signal(false);
  readonly speed = signal(1);

  readonly valueInput = signal('42');
  readonly indexInput = signal('0');
  readonly keyInput = signal('12');
  readonly startNode = signal('A');
  readonly hashSize = HASH_SIZE;
  readonly formError = signal<string | null>(null);

  readonly log = signal<LogEntry[]>([]);
  private logId = 1;
  private timer: number | null = null;
  private toastTimer: number | null = null;

  readonly currentFrame = computed<Frame<unknown> | null>(
    () => this.frames()[this.stepIndex()] ?? null,
  );

  readonly highlights = computed(() => {
    const map = new Map<string, HighlightTone>();
    for (const highlight of this.currentFrame()?.highlights ?? []) {
      map.set(highlight.id, highlight.tone);
    }
    return map;
  });

  readonly stackView = computed(
    () => (this.active() === 'stack' ? this.frameState<number[]>() : null) ?? this.stackState(),
  );
  readonly queueView = computed(
    () => (this.active() === 'queue' ? this.frameState<number[]>() : null) ?? this.queueState(),
  );
  readonly listView = computed(
    () => (this.active() === 'list' ? this.frameState<ListState>() : null) ?? this.listState(),
  );
  readonly bstView = computed(
    () => (this.active() === 'bst' ? this.frameState<TreeState>() : null) ?? this.bstState(),
  );
  readonly avlView = computed(
    () => (this.active() === 'avl' ? this.frameState<AvlState>() : null) ?? this.avlState(),
  );
  readonly heapView = computed(
    () => (this.active() === 'heap' ? this.frameState<HeapState>() : null) ?? this.heapState(),
  );
  readonly hashView = computed(
    () => (this.active() === 'hash' ? this.frameState<HashState>() : null) ?? this.hashState(),
  );
  readonly graphView = computed(
    () => (this.active() === 'graph' ? this.frameState<GraphState>() : null) ?? this.graph,
  );

  readonly stackDisplay = computed(() =>
    this.stackView()
      .map((value, index) => ({ value, index }))
      .reverse(),
  );

  readonly listItems = computed<ListItemView[]>(() =>
    this.listView().map((node, index) => ({ id: node.id, value: node.value, index })),
  );

  readonly listWidth = computed(() => Math.max(320, this.listView().length * 132 + 96));

  readonly treeLayout = computed(() =>
    layoutTree(this.active() === 'avl' ? this.avlView() : this.bstView()),
  );

  readonly heapLayout = computed(() => layoutHeap(this.heapView()));

  readonly heapItems = computed(() => this.heapView().map((value, index) => ({ value, index })));

  readonly hashBuckets = computed(() =>
    this.hashView().map((entries, index) => ({ index, entries })),
  );

  readonly graphEdgeViews = computed(() => {
    const graph = this.graphView();
    const positions = new Map(graph.nodes.map((node) => [node.id, node]));

    return graph.edges.map((edge) => {
      const from = positions.get(edge.from)!;
      const to = positions.get(edge.to)!;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;

      return {
        ...edge,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        labelX: (from.x + to.x) / 2 - (dy / length) * 12,
        labelY: (from.y + to.y) / 2 + (dx / length) * 12,
      };
    });
  });

  readonly code = computed(() => {
    const frame = this.currentFrame();
    if (!frame) {
      return null;
    }
    const lines = PSEUDOCODE[this.active()][frame.operation];
    if (!lines) {
      return null;
    }
    return {
      title: OPERATION_LABELS[frame.operation] ?? frame.operation,
      lines,
      line: frame.line,
    };
  });

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

  readonly isEmpty = computed(() => {
    switch (this.active()) {
      case 'stack':
        return this.stackView().length === 0;
      case 'queue':
        return this.queueView().length === 0;
      case 'list':
        return this.listView().length === 0;
      case 'bst':
        return this.bstView().root === null;
      case 'avl':
        return this.avlView().root === null;
      case 'heap':
        return this.heapView().length === 0;
      case 'hash':
        return this.hashView().every((bucket) => bucket.length === 0);
      case 'graph':
        return false;
    }
  });

  readonly emptyLabel = computed(() => {
    switch (this.active()) {
      case 'stack':
        return 'La pila está vacía';
      case 'queue':
        return 'La cola está vacía';
      case 'list':
        return 'La lista está vacía';
      case 'bst':
        return 'El árbol está vacío';
      case 'avl':
        return 'El árbol AVL está vacío';
      case 'heap':
        return 'El heap está vacío';
      case 'hash':
        return 'La tabla está vacía';
      case 'graph':
        return 'El grafo está vacío';
    }
  });

  constructor() {
    afterNextRender(() => this.restoreFromShareLink());
    this.destroyRef.onDestroy(() => {
      this.stopTimer();
      if (this.toastTimer !== null) {
        clearTimeout(this.toastTimer);
      }
    });
  }

  toneFor(id: string): HighlightTone | 'default' {
    return this.highlights().get(id) ?? 'default';
  }

  balanceFor(id: string): string {
    const balance = balanceFactor(this.avlView(), id);
    return balance > 0 ? `+${balance}` : String(balance);
  }

  structureLabel(key: StructureKey): string {
    return STRUCTURES.find((item) => item.key === key)?.label ?? key;
  }

  queueLabel(index: number): string {
    const last = this.queueView().length - 1;
    if (index === 0 && index === last) {
      return 'frente / final';
    }
    if (index === 0) {
      return 'frente';
    }
    if (index === last) {
      return 'final';
    }
    return '';
  }

  togglePrediction(): void {
    const enabled = !this.predictionEnabled();
    this.predictionEnabled.set(enabled);
    if (!enabled) {
      this.pendingPrediction.set(null);
    }
    this.showToast(enabled ? 'Modo predicción activado' : 'Modo predicción desactivado');
  }

  answerPrediction(index: number): void {
    const prediction = this.pendingPrediction();
    if (!prediction || prediction.revealed) {
      return;
    }
    this.pendingPrediction.set({
      ...prediction,
      chosen: index,
      revealed: true,
    });
    prediction.run();
  }

  dismissPrediction(): void {
    this.pendingPrediction.set(null);
  }

  private clearPrediction(): void {
    this.pendingPrediction.set(null);
  }

  selectStructure(key: StructureKey): void {
    if (key === this.active()) {
      return;
    }
    this.clearPrediction();
    this.pause();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.formError.set(null);
    this.active.set(key);
  }

  // ------------------------------------------------------------------ pila

  doPush(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.stackState();
    const operation = pushStack(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.stackState.set(state),
      `push(${value})`,
      before,
    );
  }

  doPop(): void {
    const before = this.stackState();
    const operation = popStack(before);
    this.dispatchWithPrediction(operation, (state) => this.stackState.set(state), 'pop()', before);
  }

  doPeekStack(): void {
    const before = this.stackState();
    const operation = peekStack(before);
    this.dispatchWithPrediction(operation, (state) => this.stackState.set(state), 'peek()', before);
  }

  doClearStack(): void {
    const before = this.stackState();
    const operation = clearStack(before);
    this.dispatchWithPrediction(
      operation,
      (state) => this.stackState.set(state),
      'clear()',
      before,
    );
  }

  // ------------------------------------------------------------------ cola

  doEnqueue(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.queueState();
    const operation = enqueue(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.queueState.set(state),
      `enqueue(${value})`,
      before,
    );
  }

  doDequeue(): void {
    const before = this.queueState();
    const operation = dequeue(before);
    this.dispatchWithPrediction(
      operation,
      (state) => this.queueState.set(state),
      'dequeue()',
      before,
    );
  }

  doPeekQueue(): void {
    const before = this.queueState();
    const operation = peekQueue(before);
    this.dispatchWithPrediction(operation, (state) => this.queueState.set(state), 'peek()', before);
  }

  doClearQueue(): void {
    const before = this.queueState();
    const operation = clearQueue(before);
    this.dispatchWithPrediction(
      operation,
      (state) => this.queueState.set(state),
      'clear()',
      before,
    );
  }

  // ---------------------------------------------------------------- lista

  doInsertHead(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.listState();
    const operation = insertHead(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.listState.set(state),
      `insertHead(${value})`,
      before,
    );
  }

  doInsertTail(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.listState();
    const operation = insertTail(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.listState.set(state),
      `insertTail(${value})`,
      before,
    );
  }

  doInsertAt(): void {
    const value = this.requireValue();
    const index = this.requireIndex();
    if (value === null || index === null) {
      return;
    }
    const before = this.listState();
    const operation = insertAt(before, index, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.listState.set(state),
      `insertAt(${index}, ${value})`,
      before,
    );
  }

  doRemoveAt(): void {
    const index = this.requireIndex();
    if (index === null) {
      return;
    }
    const before = this.listState();
    const operation = removeAt(before, index);
    this.dispatchWithPrediction(
      operation,
      (state) => this.listState.set(state),
      `removeAt(${index})`,
      before,
    );
  }

  doSearchList(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.listState();
    const operation = searchList(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.listState.set(state),
      `search(${value})`,
      before,
    );
  }

  doClearList(): void {
    const before = this.listState();
    const operation = clearList(before);
    this.dispatchWithPrediction(operation, (state) => this.listState.set(state), 'clear()', before);
  }

  // ----------------------------------------------------------------- árbol

  doInsertTree(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.bstState();
    const operation = insertTree(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.bstState.set(state),
      `insert(${value})`,
      before,
    );
  }

  doSearchTree(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.bstState();
    const operation = searchTree(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.bstState.set(state),
      `search(${value})`,
      before,
    );
  }

  doRemoveTree(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.bstState();
    const operation = removeTree(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.bstState.set(state),
      `remove(${value})`,
      before,
    );
  }

  doTraverse(order: TraversalOrder): void {
    const before = this.bstState();
    const operation = traverse(before, order);
    this.dispatchWithPrediction(
      operation,
      (state) => this.bstState.set(state),
      OPERATION_LABELS[order] ?? order,
      before,
    );
  }

  doTraverseActive(order: TraversalOrder): void {
    if (this.active() === 'avl') {
      this.doTraverseAvl(order);
    } else {
      this.doTraverse(order);
    }
  }

  doClearTree(): void {
    const before = this.bstState();
    const operation = clearTree(before);
    this.dispatchWithPrediction(operation, (state) => this.bstState.set(state), 'clear()', before);
  }

  // -------------------------------------------------------------------- AVL

  doInsertAvl(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.avlState();
    const operation = insertAvl(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.avlState.set(state),
      `insert(${value})`,
      before,
    );
  }

  doSearchAvl(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.avlState();
    const operation = searchTree(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.avlState.set(state),
      `search(${value})`,
      before,
    );
  }

  doRemoveAvl(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.avlState();
    const operation = removeAvl(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.avlState.set(state),
      `remove(${value})`,
      before,
    );
  }

  doTraverseAvl(order: TraversalOrder): void {
    const before = this.avlState();
    const operation = traverse(before, order);
    this.dispatchWithPrediction(
      operation,
      (state) => this.avlState.set(state),
      OPERATION_LABELS[order] ?? order,
      before,
    );
  }

  doClearAvl(): void {
    const before = this.avlState();
    const operation = clearAvl(before);
    this.dispatchWithPrediction(operation, (state) => this.avlState.set(state), 'clear()', before);
  }

  // ------------------------------------------------------------------- heap

  doInsertHeap(): void {
    const value = this.requireValue();
    if (value === null) {
      return;
    }
    const before = this.heapState();
    const operation = insertHeap(before, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.heapState.set(state),
      `insert(${value})`,
      before,
    );
  }

  doExtractMin(): void {
    const before = this.heapState();
    const operation = extractMin(before);
    this.dispatchWithPrediction(
      operation,
      (state) => this.heapState.set(state),
      'extractMin()',
      before,
    );
  }

  doPeekHeap(): void {
    const before = this.heapState();
    const operation = peekHeap(before);
    this.dispatchWithPrediction(operation, (state) => this.heapState.set(state), 'peek()', before);
  }

  doClearHeap(): void {
    const before = this.heapState();
    const operation = clearHeap(before);
    this.dispatchWithPrediction(operation, (state) => this.heapState.set(state), 'clear()', before);
  }

  // ------------------------------------------------------------------- hash

  doHashSet(): void {
    const key = this.requireKey();
    const value = this.requireValue();
    if (key === null || value === null) {
      return;
    }
    const before = this.hashState();
    const operation = setHash(before, key, value);
    this.dispatchWithPrediction(
      operation,
      (state) => this.hashState.set(state),
      `set(${key}, ${value})`,
      before,
    );
  }

  doHashGet(): void {
    const key = this.requireKey();
    if (key === null) {
      return;
    }
    const before = this.hashState();
    const operation = getHash(before, key);
    this.dispatchWithPrediction(
      operation,
      (state) => this.hashState.set(state),
      `get(${key})`,
      before,
    );
  }

  doHashRemove(): void {
    const key = this.requireKey();
    if (key === null) {
      return;
    }
    const before = this.hashState();
    const operation = removeHash(before, key);
    this.dispatchWithPrediction(
      operation,
      (state) => this.hashState.set(state),
      `remove(${key})`,
      before,
    );
  }

  doHashClear(): void {
    const before = this.hashState();
    const operation = clearHash(before);
    this.dispatchWithPrediction(operation, (state) => this.hashState.set(state), 'clear()', before);
  }

  // ------------------------------------------------------------------ grafo

  doBfs(): void {
    const operation = bfs(this.graph, this.startNode());
    this.dispatchWithPrediction(operation, () => undefined, `BFS(${this.startNode()})`, this.graph);
  }

  doDfs(): void {
    const operation = dfs(this.graph, this.startNode());
    this.dispatchWithPrediction(operation, () => undefined, `DFS(${this.startNode()})`, this.graph);
  }

  doDijkstra(): void {
    const operation = dijkstra(this.graph, this.startNode());
    this.dispatchWithPrediction(
      operation,
      () => undefined,
      `Dijkstra(${this.startNode()})`,
      this.graph,
    );
  }

  onStartNodeChange(event: Event): void {
    this.clearPrediction();
    this.pause();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.formError.set(null);
    this.startNode.set((event.target as HTMLSelectElement).value);
  }

  // ------------------------------------------------------------ datos/azar

  randomize(): void {
    if (this.active() === 'graph') {
      return;
    }

    this.clearPrediction();
    this.stopPlayback();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.formError.set(null);

    switch (this.active()) {
      case 'stack':
        this.stackState.set(randomStack());
        break;
      case 'queue':
        this.queueState.set(randomQueue());
        break;
      case 'list':
        this.listState.set(randomList());
        break;
      case 'bst':
        this.bstState.set(randomTree());
        break;
      case 'avl':
        this.avlState.set(randomAvl());
        break;
      case 'heap':
        this.heapState.set(randomHeap());
        break;
      case 'hash':
        this.hashState.set(randomTable());
        break;
    }

    this.addLog('Aleatorio', 'Nuevo conjunto de datos generado', 0);
  }

  resetActive(): void {
    this.clearPrediction();
    this.stopPlayback();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.formError.set(null);

    switch (this.active()) {
      case 'stack':
        this.stackState.set([...INITIAL_STACK]);
        break;
      case 'queue':
        this.queueState.set([...INITIAL_QUEUE]);
        break;
      case 'list':
        this.listState.set(createList([...INITIAL_LIST_VALUES]));
        break;
      case 'bst':
        this.bstState.set(buildBalancedTree([...INITIAL_TREE_VALUES]));
        break;
      case 'avl':
        this.avlState.set(buildBalancedAvl([...INITIAL_AVL_VALUES]));
        break;
      case 'heap':
        this.heapState.set([...INITIAL_HEAP]);
        break;
      case 'hash':
        this.hashState.set(createTable(INITIAL_HASH_ENTRIES));
        break;
      case 'graph':
        break;
    }

    this.addLog('Reiniciar', 'Estado inicial restaurado', 0);
  }

  clearLog(): void {
    this.log.set([]);
  }

  // --------------------------------------------------------------- lecciones

  onLessonChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (!id) {
      this.closeLesson();
      return;
    }
    this.startLesson(id);
  }

  startLesson(id: string): void {
    const lesson = LESSONS.find((item) => item.id === id);
    if (!lesson) {
      return;
    }

    this.activeLessonId.set(id);
    this.lessonStep.set(0);
    this.active.set(lesson.steps[0].structure);
    this.resetActive();
    this.showToast(`Lección: ${lesson.title}`);
  }

  nextLessonStep(): void {
    const lesson = this.activeLesson();
    if (!lesson) {
      return;
    }
    this.applyLessonStep(Math.min(lesson.steps.length - 1, this.lessonStep() + 1));
  }

  prevLessonStep(): void {
    if (!this.activeLesson()) {
      return;
    }
    this.applyLessonStep(Math.max(0, this.lessonStep() - 1));
  }

  closeLesson(): void {
    this.activeLessonId.set(null);
    this.lessonStep.set(0);
  }

  private applyLessonStep(index: number): void {
    const lesson = this.activeLesson();
    const step = lesson?.steps[index];
    if (!step) {
      return;
    }

    this.lessonStep.set(index);
    if (step.structure !== this.active()) {
      this.clearPrediction();
      this.pause();
      this.frames.set([]);
      this.stepIndex.set(0);
      this.active.set(step.structure);
    }
  }

  // ----------------------------------------------------------- presentación

  togglePresentation(): void {
    this.presentationMode.update((value) => !value);
    this.showToast(
      this.presentationMode() ? 'Modo presentación activado' : 'Modo presentación desactivado',
    );
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
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

    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.togglePlay();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.stepForward();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.stepBack();
        break;
      case 'r':
      case 'R':
        this.resetActive();
        break;
      case 'p':
      case 'P':
        this.togglePresentation();
        break;
      case 'Escape':
        if (this.presentationMode()) {
          this.presentationMode.set(false);
        } else if (this.pendingPrediction()) {
          this.dismissPrediction();
        }
        break;
    }
  }

  // ------------------------------------------------------------ compartir

  copyShareLink(): void {
    const url = buildShareUrl('structures', this.buildShareData());
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', url);
    }
    void copyShareUrl(url).then((copied) => {
      if (copied) {
        this.showToast('Enlace copiado al portapapeles');
      } else if (typeof window !== 'undefined') {
        window.prompt('Copia el enlace para compartir:', url);
      }
    });
  }

  private buildShareData(): StructuresShareData {
    return {
      structure: this.active(),
      stack: [...this.stackState()],
      queue: [...this.queueState()],
      list: this.listState().map((node) => node.value),
      bst: serializeTree(this.bstState()),
      avl: serializeTree(this.avlState()),
      heap: [...this.heapState()],
      hash: serializeHash(this.hashState()),
      startNode: this.startNode(),
    };
  }

  private restoreFromShareLink(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const envelope = decodeShare<StructuresShareData>(window.location.hash);
    if (!envelope || envelope.tool !== 'structures' || !envelope.data) {
      return;
    }

    const data = envelope.data;

    if (Array.isArray(data.stack)) {
      this.stackState.set(this.toNumbers(data.stack));
    }
    if (Array.isArray(data.queue)) {
      this.queueState.set(this.toNumbers(data.queue));
    }
    if (Array.isArray(data.list)) {
      this.listState.set(createList(this.toNumbers(data.list)));
    }
    if (Array.isArray(data.heap)) {
      this.heapState.set(this.toNumbers(data.heap));
    }
    if (Array.isArray(data.hash)) {
      const entries = data.hash
        .filter(
          (entry) =>
            entry !== null &&
            typeof entry === 'object' &&
            Number.isFinite(Number(entry.key)) &&
            Number.isFinite(Number(entry.value)),
        )
        .map((entry) => ({ key: Number(entry.key), value: Number(entry.value) }));
      this.hashState.set(createTable(entries));
    }

    if (data.bst !== undefined) {
      this.bstState.set(deserializeTree(data.bst));
    }
    if (data.avl !== undefined) {
      this.avlState.set(deserializeAvl(data.avl));
    }
    if (
      typeof data.startNode === 'string' &&
      this.graph.nodes.some((node) => node.id === data.startNode)
    ) {
      this.startNode.set(data.startNode);
    }
    if (this.isStructureKey(data.structure)) {
      this.active.set(data.structure);
    }

    this.pause();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.pendingPrediction.set(null);
    this.showToast('Estado restaurado desde el enlace');
  }

  private toNumbers(value: unknown): number[] {
    return Array.isArray(value) ? value.map(Number).filter((item) => Number.isFinite(item)) : [];
  }

  private isStructureKey(value: unknown): value is StructureKey {
    return STRUCTURES.some((item) => item.key === value);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    if (this.toastTimer !== null) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2600);
  }

  // --------------------------------------------------------------- entradas

  onValueInput(event: Event): void {
    this.valueInput.set((event.target as HTMLInputElement).value);
  }

  onIndexInput(event: Event): void {
    this.indexInput.set((event.target as HTMLInputElement).value);
  }

  onKeyInput(event: Event): void {
    this.keyInput.set((event.target as HTMLInputElement).value);
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
    this.speed.set(Number.isFinite(speed) && speed > 0 ? speed : 1);
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
    }, 650 / this.speed());
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

  // --------------------------------------------------------------- internos

  private dispatchWithPrediction<S>(
    operation: Operation<S>,
    commit: (state: S) => void,
    label: string,
    before: unknown,
  ): void {
    const operationKey = operation.frames[0]?.operation ?? '';
    const prediction = operationKey
      ? buildPrediction({
          structure: this.active(),
          operation: operationKey,
          label,
          before,
          after: operation.result,
          frames: operation.frames,
          graph: this.graph,
          startNode: this.startNode(),
        })
      : null;

    this.dispatch(operation, commit, label, prediction);
  }

  private dispatch<S>(
    operation: Operation<S>,
    commit: (state: S) => void,
    label: string,
    prediction: PredictionSpec | null,
  ): void {
    if (!this.predictionEnabled() || prediction === null) {
      this.pendingPrediction.set(null);
      this.execute(operation, commit, label);
      return;
    }

    this.stopPlayback();
    this.frames.set([]);
    this.stepIndex.set(0);
    this.pendingPrediction.set({
      ...prediction,
      label,
      chosen: null,
      revealed: false,
      run: () => this.execute(operation, commit, label),
    });
  }

  private execute<S>(operation: Operation<S>, commit: (state: S) => void, label: string): void {
    this.stopPlayback();
    commit(operation.result);
    this.frames.set(operation.frames);
    this.stepIndex.set(0);
    this.formError.set(null);

    const lastMessage = operation.frames[operation.frames.length - 1]?.message ?? label;
    this.addLog(label, lastMessage, operation.frames.length);

    if (operation.frames.length <= 1) {
      return;
    }

    if (this.prefersReducedMotion()) {
      this.stepIndex.set(operation.frames.length - 1);
      return;
    }

    this.play();
  }

  private addLog(label: string, message: string, steps: number): void {
    const entry: LogEntry = {
      id: this.logId++,
      structure: this.active(),
      label,
      message,
      steps,
    };
    this.log.update((entries) => [entry, ...entries].slice(0, 12));
  }

  private requireValue(): number | null {
    return this.parseInteger(this.valueInput(), 'El valor');
  }

  private requireIndex(): number | null {
    return this.parseInteger(this.indexInput(), 'El índice');
  }

  private requireKey(): number | null {
    return this.parseInteger(this.keyInput(), 'La clave');
  }

  private parseInteger(text: string, label: string): number | null {
    const trimmed = text.trim();
    const value = Number(trimmed);

    if (trimmed === '' || !Number.isFinite(value) || !Number.isInteger(value)) {
      this.formError.set(`${label} debe ser un número entero.`);
      return null;
    }

    this.formError.set(null);
    return value;
  }

  private frameState<S>(): S | null {
    const frame = this.currentFrame();
    return frame ? (frame.state as S) : null;
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
