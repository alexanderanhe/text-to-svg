import type { PolyStroke, Pt } from "../types/strokes";

// Centro correctamente: usa BBOX SIN PADDING
export function getPolyRawBounds(s: PolyStroke){
  let xMin=Infinity,yMin=Infinity,xMax=-Infinity,yMax=-Infinity;
  for (const p of s.points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.x < xMin) xMin = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.x > xMax) xMax = p.x;
    if (p.y > yMax) yMax = p.y;
  }
  if (!isFinite(xMin)) return null;
  return { x:xMin, y:yMin, w:xMax-xMin, h:yMax-yMin };
}

// BBOX con padding de stroke para pintar selección/hit AABB rápido
export function getPolyBounds(s: PolyStroke){
  const rb = getPolyRawBounds(s);
  if (!rb) return null;
  const pad = (s.strokeWidth || 0) / 2;
  return { x: rb.x - pad, y: rb.y - pad, w: rb.w + 2*pad, h: rb.h + 2*pad };
}

// rotación inversa de punto p alrededor de (cx,cy) con -ang
export function unrotatePoint(px:number, py:number, cx:number, cy:number, ang:number){
  const dx = px - cx, dy = py - cy;
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: cx +  dx*c + dy*s, y: cy + (-dx*s + dy*c) };
}

// distancia punto-segmento robusta (segmentos degenerados)
export function distToSeg(px:number,py:number, ax:number,ay:number, bx:number,by:number){
  const abx = bx-ax, aby = by-ay;
  const denom = abx*abx + aby*aby;
  if (denom === 0) return Math.hypot(px-ax, py-ay);
  const apx = px-ax, apy = py-ay;
  let t = (abx*apx + aby*apy) / denom;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t*abx, qy = ay + t*aby;
  return Math.hypot(px-qx, py-qy);
}

// punto dentro de polígono (ray-casting)
export function pointInPolygon(pt:Pt, pts:Pt[]){
  let inside=false;
  for (let i=0, j=pts.length-1; i<pts.length; j=i++){
    const {x:xi,y:yi} = pts[i];
    const {x:xj,y:yj} = pts[j];
    const intersect = ((yi>pt.y)!==(yj>pt.y)) &&
      (pt.x < ((xj-xi) * (pt.y-yi)) / ((yj-yi)||1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isNear(a:{x:number;y:number}, b:{x:number;y:number}, tol:number) {
  return Math.hypot(a.x-b.x, a.y-b.y) <= tol;
}