import type { Pt, Stroke } from "../../types/strokes";

function translatePoints(points: Pt[], dx: number, dy: number): Pt[] {
  if (dx === 0 && dy === 0) return points;
  return points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
}

export function translateStroke<T extends Stroke>(stroke: T, dx: number, dy: number): T {
  if (dx === 0 && dy === 0) return stroke;

  if (stroke.type === "pen" || stroke.type === "eraser") {
    return { ...stroke, points: translatePoints(stroke.points, dx, dy) } as T;
  }

  if (stroke.type === "poly") {
    return { ...stroke, points: translatePoints(stroke.points, dx, dy) } as T;
  }

  if (stroke.type === "shape" || stroke.type === "text" || stroke.type === "svg") {
    return { ...stroke, x: stroke.x + dx, y: stroke.y + dy } as T;
  }

  return stroke;
}
