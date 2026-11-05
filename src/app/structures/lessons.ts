import type { StructureKey } from './models';

export interface LessonStep {
  text: string;
  structure: StructureKey;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  steps: LessonStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'stack-queue',
    title: 'Pila vs. cola',
    description: 'Compara el orden LIFO de la pila con el FIFO de la cola.',
    steps: [
      {
        text: 'En la pila, inserta 5, 8 y 12. Observa cuál queda en el tope.',
        structure: 'stack',
      },
      {
        text: 'Haz Pop dos veces. Anota el orden en que salen los valores.',
        structure: 'stack',
      },
      {
        text: 'Cambia a la cola: encola 5, 8 y 12. El frente es el primero que entró.',
        structure: 'queue',
      },
      {
        text: 'Desencola dos veces y compara el orden con el de la pila.',
        structure: 'queue',
      },
    ],
  },
  {
    id: 'bst-traversals',
    title: 'Recorridos de un BST',
    description: 'Inorden, preorden y postorden sobre el mismo árbol.',
    steps: [
      {
        text: 'Activa el modo predicción y ejecuta Inorden. ¿Qué orden esperas?',
        structure: 'bst',
      },
      {
        text: 'Ejecuta Preorden. ¿Qué nodo aparece primero?',
        structure: 'bst',
      },
      {
        text: 'Ejecuta Postorden. ¿Qué diferencia ves con los otros dos?',
        structure: 'bst',
      },
      {
        text: 'Inserta 45 y repite el recorrido que prefieras.',
        structure: 'bst',
      },
    ],
  },
  {
    id: 'avl-rotations',
    title: 'Rotaciones AVL',
    description: 'Provoca rotaciones simples y dobles insertando en orden.',
    steps: [
      {
        text: 'Vacía el árbol y activa el modo predicción.',
        structure: 'avl',
      },
      {
        text: 'Inserta 10, 20 y 30 en ese orden. Predice la rotación.',
        structure: 'avl',
      },
      {
        text: 'Comprueba la raíz: debe ser 20. Repite con 30, 20 y 10.',
        structure: 'avl',
      },
      {
        text: 'Para una rotación doble: vacía e inserta 30, 10 y 20. ¿Qué ocurre?',
        structure: 'avl',
      },
    ],
  },
  {
    id: 'bfs-dfs',
    title: 'BFS vs. DFS',
    description: 'Compara la exploración por anchura y por profundidad.',
    steps: [
      {
        text: 'Selecciona el nodo inicial A y ejecuta BFS. Anota el orden.',
        structure: 'graph',
      },
      {
        text: 'Ejecuta DFS desde A. ¿En qué se diferencia la exploración?',
        structure: 'graph',
      },
      {
        text: 'Cambia el nodo inicial a D y compara BFS y DFS.',
        structure: 'graph',
      },
      {
        text: '¿Qué estructura usa BFS para su frontera? ¿Y DFS?',
        structure: 'graph',
      },
    ],
  },
  {
    id: 'dijkstra',
    title: 'Dijkstra',
    description: 'Distancias mínimas, relajaciones y el papel del nodo inicial.',
    steps: [
      {
        text: 'Ejecuta Dijkstra desde A. Observa el orden en que se extraen los nodos.',
        structure: 'graph',
      },
      {
        text: 'Anota las distancias finales. ¿Qué aristas se relajan más de una vez?',
        structure: 'graph',
      },
      {
        text: 'Cambia el nodo inicial a G y compara las nuevas distancias.',
        structure: 'graph',
      },
      {
        text: '¿Por qué Dijkstra no funciona correctamente con pesos negativos?',
        structure: 'graph',
      },
    ],
  },
];
