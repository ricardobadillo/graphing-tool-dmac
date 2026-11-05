import { BIG_O_FAMILIES, formatOperations, type LabMeasurement } from './complexity';

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartTick {
  x: number;
  y: number;
  label: string;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  path: string;
  points: ChartPoint[];
  dashed: boolean;
}

export interface ComplexityChart {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  xTicks: ChartTick[];
  yTicks: ChartTick[];
  measured: ChartSeries | null;
  references: ChartSeries[];
  hasData: boolean;
}

const WIDTH = 720;
const HEIGHT = 400;
const LEFT = 66;
const RIGHT = 24;
const TOP = 28;
const BOTTOM = 50;

export function buildComplexityChart(
  measurements: LabMeasurement[],
  logScale: boolean,
  showReferences: boolean,
): ComplexityChart {
  const left = LEFT;
  const right = WIDTH - RIGHT;
  const top = TOP;
  const bottom = HEIGHT - BOTTOM;
  const hasData = measurements.length > 0;

  if (!hasData) {
    return {
      width: WIDTH,
      height: HEIGHT,
      left,
      right,
      top,
      bottom,
      xTicks: [],
      yTicks: [],
      measured: null,
      references: [],
      hasData: false,
    };
  }

  const transformX = (n: number): number => (logScale ? Math.log10(n) : n);
  const minX = transformX(measurements[0].n);
  const maxX = transformX(measurements[measurements.length - 1].n);
  const spanX = Math.max(1e-9, maxX - minX);

  const mapX = (n: number): number => left + ((transformX(n) - minX) / spanX) * (right - left);

  const maxTotal = Math.max(...measurements.map((item) => item.total), 1);
  const transformY = (value: number): number => (logScale ? Math.log10(Math.max(1, value)) : value);
  const maxY = transformY(maxTotal * 1.08);
  const spanY = Math.max(1e-9, maxY);

  const mapY = (value: number): number => bottom - (transformY(value) / spanY) * (bottom - top);

  const xTicks: ChartTick[] = measurements.map((item) => ({
    x: mapX(item.n),
    y: bottom,
    label: String(item.n),
  }));

  const yTicks: ChartTick[] = [];
  const tickCount = 5;
  for (let index = 0; index < tickCount; index += 1) {
    const fraction = index / (tickCount - 1);
    const raw = logScale ? 10 ** (fraction * maxY) : fraction * maxY;
    yTicks.push({
      x: left,
      y: mapY(raw),
      label: formatOperations(raw),
    });
  }

  const measuredPoints = measurements.map((item) => ({
    x: mapX(item.n),
    y: mapY(item.total),
  }));

  const measured: ChartSeries = {
    id: 'measured',
    label: 'Medido',
    color: '#38bdf8',
    path: toPath(measuredPoints),
    points: measuredPoints,
    dashed: false,
  };

  const references: ChartSeries[] = [];

  if (showReferences && measurements.length >= 2) {
    const last = measurements[measurements.length - 1];
    if (last.total > 0) {
      for (const family of BIG_O_FAMILIES) {
        const rawLast = family.fn(last.n) || 1;
        const scale = last.total / rawLast;
        const points = measurements.map((item) => ({
          x: mapX(item.n),
          y: mapY(family.fn(item.n) * scale),
        }));
        references.push({
          id: family.id,
          label: family.label,
          color: family.color,
          path: toPath(points),
          points,
          dashed: true,
        });
      }
    }
  }

  return {
    width: WIDTH,
    height: HEIGHT,
    left,
    right,
    top,
    bottom,
    xTicks,
    yTicks,
    measured,
    references,
    hasData,
  };
}

function toPath(points: ChartPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
}
