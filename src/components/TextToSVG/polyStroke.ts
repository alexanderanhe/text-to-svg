import { withRotation } from "../../utils/canvasUtils";
import { getPolyBounds, getPolyRawBounds, distToSeg, pointInPolygon } from "../../utils/polygonUtils";
import { unrotatePoint } from "../../utils/helpers";
import type { PolyStroke, Pt } from "../../types/strokes";

function applyPolyPath(
  ctx: CanvasRenderingContext2D,
  stroke: PolyStroke,
  draw: (pts: Pt[]) => void,
  opts: { skipRotation?: boolean } = {},
) {
  const pts = stroke.points.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (pts.length === 0) return;

  const bounds = getPolyBounds(stroke);
  if (!bounds) return;
  const cx = bounds.x + bounds.w / 2;
  const cy = bounds.y + bounds.h / 2;
  const angle = opts.skipRotation ? 0 : stroke.rotation || 0;

  const render = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (stroke.closed) ctx.closePath();
    draw(pts);
  };

  if (angle) {
    withRotation(ctx, angle, cx, cy, render);
  } else {
    render();
  }
}

export function drawPoly(ctx: CanvasRenderingContext2D, stroke: PolyStroke) {
  applyPolyPath(ctx, stroke, () => {
    if (stroke.fill !== "none" && stroke.closed) {
      ctx.fillStyle = stroke.fill;
      ctx.fill();
    }
    ctx.lineJoin = stroke.lineJoin || "round";
    ctx.lineCap = stroke.lineCap || "round";
    ctx.lineWidth = stroke.strokeWidth;
    ctx.strokeStyle = stroke.stroke;
    ctx.stroke();
  });
}

export function drawPolySelectionOverlay(
  ctx: CanvasRenderingContext2D,
  stroke: PolyStroke,
  opts: { color?: string; dpr?: number; vertexRadius?: number } = {},
) {
  const { color = "#0af", dpr = window.devicePixelRatio || 1, vertexRadius = 4 } = opts;
  const radius = Math.max(2, vertexRadius) * dpr;

  applyPolyPath(ctx, stroke, (pts) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, (stroke.strokeWidth || 1) / 2);
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeStyle = color;
    ctx.fillStyle = "#fff";
    for (const pt of pts) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }, { skipRotation: true });
}

export function hitPoly(point: Pt, stroke: PolyStroke) {
  const rawBounds = getPolyRawBounds(stroke);
  if (!rawBounds) return false;
  const cx = rawBounds.x + rawBounds.w / 2;
  const cy = rawBounds.y + rawBounds.h / 2;
  const angle = stroke.rotation || 0;
  const pointInLocal = angle ? unrotatePoint(point.x, point.y, cx, cy, angle) : point;

  const pts = stroke.points.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
  if (pts.length < 2) return false;

  const dpr = window.devicePixelRatio || 1;
  const tolerance = Math.max(4, (stroke.strokeWidth || 0) / 2 + 2) * dpr;

  for (let i = 1; i < pts.length; i += 1) {
    if (distToSeg(pointInLocal.x, pointInLocal.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= tolerance) {
      return true;
    }
  }

  if (stroke.closed) {
    const a = pts[pts.length - 1];
    const b = pts[0];
    if (distToSeg(pointInLocal.x, pointInLocal.y, a.x, a.y, b.x, b.y) <= tolerance) {
      return true;
    }
  }

  if (stroke.closed && stroke.fill !== "none") {
    return pointInPolygon(pointInLocal, pts);
  }

  return false;
}
