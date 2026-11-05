import { clamp, niceStep } from './math-utils';

export interface PlotBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface PlotPoint {
  x: number;
  y: number | null;
}

export function sampleFunction(
  evaluate: (x: number) => number,
  xMin: number,
  xMax: number,
  count = 500,
): PlotPoint[] {
  return Array.from({ length: count + 1 }, (_, index) => {
    const x = xMin + ((xMax - xMin) * index) / count;
    const value = evaluate(x);
    return { x, y: Number.isFinite(value) ? value : null };
  });
}

export function autoBounds(
  points: PlotPoint[],
  fallback: PlotBounds = { xMin: -5, xMax: 5, yMin: -5, yMax: 5 },
): PlotBounds {
  const xs = points.map((point) => point.x).filter(Number.isFinite);
  const ys = points
    .map((point) => point.y)
    .filter(
      (value): value is number => value !== null && Number.isFinite(value) && Math.abs(value) < 1e6,
    )
    .sort((left, right) => left - right);

  if (xs.length === 0 || ys.length === 0) {
    return fallback;
  }

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const low = ys[Math.floor(ys.length * 0.04)] ?? -5;
  const high = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.96))] ?? 5;
  const padding = Math.max((high - low) * 0.18, 0.5);

  return {
    xMin,
    xMax,
    yMin: low - padding,
    yMax: high + padding,
  };
}

export function screenX(x: number, bounds: PlotBounds, width: number): number {
  return ((x - bounds.xMin) / (bounds.xMax - bounds.xMin)) * width;
}

export function screenY(y: number, bounds: PlotBounds, height: number): number {
  return height - ((y - bounds.yMin) / (bounds.yMax - bounds.yMin)) * height;
}

function snap(value: number): number {
  return Math.round(value) + 0.5;
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: PlotBounds,
): void {
  const step = niceStep((bounds.xMax - bounds.xMin) / 10);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let value = Math.ceil(bounds.xMin / step) * step; value <= bounds.xMax; value += step) {
    const x = snap(screenX(value, bounds, width));
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let value = Math.ceil(bounds.yMin / step) * step; value <= bounds.yMax; value += step) {
    const y = snap(screenY(value, bounds, height));
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: PlotBounds,
): void {
  const axisX = screenX(0, bounds, width);
  const axisY = screenY(0, bounds, height);
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (axisY >= 0 && axisY <= height) {
    ctx.moveTo(0, snap(axisY));
    ctx.lineTo(width, snap(axisY));
  }
  if (axisX >= 0 && axisX <= width) {
    ctx.moveTo(snap(axisX), 0);
    ctx.lineTo(snap(axisX), height);
  }
  ctx.stroke();
}

export function drawCurve(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: PlotBounds,
  points: PlotPoint[],
  color: string,
  lineWidth = 2,
): void {
  const jumpLimit = height * 1.3;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  let previousY: number | null = null;
  for (const point of points) {
    if (point.y === null) {
      previousY = null;
      continue;
    }
    const x = screenX(point.x, bounds, width);
    const y = clamp(screenY(point.y, bounds, height), -height * 3, height * 4);
    if (previousY === null || Math.abs(y - previousY) > jumpLimit) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    previousY = y;
  }

  ctx.stroke();
  ctx.restore();
}

export function drawPoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  kind: 'circle' | 'max' | 'min' | 'square' = 'circle',
): void {
  ctx.save();
  ctx.beginPath();
  if (kind === 'circle') {
    ctx.arc(x, y, 4, 0, Math.PI * 2);
  } else if (kind === 'square') {
    ctx.rect(x - 3.2, y - 3.2, 6.4, 6.4);
  } else if (kind === 'max') {
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 5, y + 4);
    ctx.lineTo(x - 5, y + 4);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y + 5);
    ctx.lineTo(x + 5, y - 4);
    ctx.lineTo(x - 5, y - 4);
    ctx.closePath();
  }
  ctx.fillStyle = '#080d19';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  lineWidth = 2,
): void {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const size = 7;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - size * Math.cos(angle - Math.PI / 6),
    toY - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    toX - size * Math.cos(angle + Math.PI / 6),
    toY - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
