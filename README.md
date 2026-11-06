# VisualLab

Laboratorio interactivo de matemáticas y programación. Cada herramienta se ejecuta en el navegador y está pensada para clase, estudio y exploración: funciones, cálculo, series, álgebra lineal, conjuntos, complejos, enteros gaussianos, estadística, optimización, geometría, estructuras de datos y algoritmos.

## Stack

- **Angular 22** standalone, signals y `ChangeDetectionStrategy.OnPush`.
- **Canvas 2D** para las visualizaciones interactivas.
- **mathjs** (`mathjs/number`) para evaluación, derivadas y series.
- **Tailwind CSS 4** para la interfaz.
- **SSR + prerender** con 14 rutas estáticas.
- **Vitest** para tests unitarios.

## Desarrollo

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:4200/`.

## Scripts

| Script                                 | Descripción                                    |
| -------------------------------------- | ---------------------------------------------- |
| `npm start`                            | Servidor de desarrollo.                        |
| `npm run build`                        | Build de producción con prerender.             |
| `npm test`                             | Tests en modo watch.                           |
| `npm run test:ci`                      | Tests una sola vez.                            |
| `npm run typecheck`                    | Comprobación de tipos con TypeScript estricto. |
| `npm run format`                       | Formatea con Prettier.                         |
| `npm run format:check`                 | Verifica el formato.                           |
| `npm run serve:ssr:graphing-tool-dmac` | Sirve el build SSR.                            |

## Estructura

```
src/app/
  shared/          Utilidades transversales (canvas, expresiones, números exactos, teclado)
  graphing/        Graficador de funciones
  calculus/        Derivadas, integrales y curvas polares/paramétricas
  analysis/        Series de Taylor y Fourier
  linear/          Álgebra lineal 2D
  sets/            Teoría de conjuntos y diagramas de Venn
  complex/         Números complejos
  gaussian/        Enteros gaussianos Z[i]
  statistics/      Distribuciones y teorema central del límite
  optimization/    Programación lineal y descenso de gradiente
  geometry/        Fractales, círculo trigonométrico y Möbius
  structures/      Estructuras de datos interactivas
  algorithms/      Ordenamientos y laboratorio Big-O
  tools.ts         Registro único de herramientas, rutas y secciones
  seo.ts           Títulos, descripciones y Open Graph por ruta
```

### Añadir una herramienta

1. Crea el componente en su carpeta.
2. Añade una entrada a `MATH_TOOLS` o `PROGRAMMING_TOOLS` en `src/app/tools.ts` con su `loadComponent`.
3. No hace falta tocar rutas, navegación ni el hub: se generan desde el registro.

## Estado compartido

El graficador y el visualizador de estructuras permiten compartir su estado mediante un hash versionado (`#share=...`). La codificación y decodificación están en `src/app/share.ts` y tienen límite de tamaño.

## Graficador de funciones

- Análisis numérico de raíces, máximos, mínimos, inflexiones, monotonía y asíntotas.
- Parámetros `a`, `b`, `c`, `d` con sliders y animación seleccionable de cualquiera de ellos.
- Funciones por tramos con `piecewise(condición, expresión, …)`.
- Regiones sombreadas para inecuaciones del tipo `y > f(x)`, `y ≥ f(x)`, `y < f(x)` y `y ≤ f(x)`.

## Laboratorio de cálculo

La ruta `/calculo-avanzado` reúne:

- **L’Hôpital:** formas 0/0 e ∞/∞, derivadas sucesivas y comparación numérica.
- **Optimización 1D:** puntos críticos, máximos/mínimos, concavidad, inflexiones y extremos globales.
- **Integración:** definida, impropia, sustitución, por partes y fracciones parciales.
- **Aplicaciones:** área entre curvas, longitud de arco y sólidos de revolución.
- **EDOs:** separables y lineales de primer orden, campo de pendientes y solución RK4.
- **Derivadas parciales:** gradiente, plano tangente y mapa de calor.
- **Derivadas direccionales:** vector unitario, producto punto, dirección de máximo crecimiento y tangente a la curva de nivel.

## Números exactos

Los resultados matemáticos se muestran primero en forma exacta:

- Racionales como fracciones: `1/2`, `9/5`, `-3/4`.
- Múltiplos de π: `π/4`, `3π/2`.
- Raíces simplificadas: `√2`, `2√2`, `√2/2`, `3√10/5`.
- Autovalores y autovectores con radicales: `(1 + √5)/2`, `(2, -1 + √5)`.

Cuando no existe una forma exacta reconocible se usa el decimal marcado con `≈`, por ejemplo `≈ 56.31°` o `≈ 68.3%`. Los ejes y las escalas de los gráficos conservan decimales porque son referencias de visualización, no resultados exactos.

La lógica está centralizada en `src/app/shared/exact-number.ts`.

## Accesibilidad

- Las visualizaciones con paneo/zoom admiten teclado: flechas para mover, `+`/`-` para zoom y `0` para restablecer.
- Los canvas tienen etiquetas descriptivas y son enfocables.
- Las animaciones respetan `prefers-reduced-motion` en los módulos que las usan.

## Tests

```bash
npm run test:ci
```

La suite cubre los motores de cálculo, expresión, series, estadística, optimización, conjuntos, complejos, gaussianos, estructuras, algoritmos, enlaces compartidos y registro de herramientas.

## Build y despliegue

```bash
npm run build
npm run serve:ssr:graphing-tool-dmac
```

El build genera rutas prerenderizadas con título, descripción y metadatos Open Graph propios. Para desplegar en producción, define `PORT` si el servidor SSR debe escuchar en otro puerto.
