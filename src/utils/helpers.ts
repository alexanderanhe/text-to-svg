import type { Font } from "opentype.js";
import type { Doc, Stroke, TextStroke } from "../types/strokes";

export function getMaxZ(arr: Stroke[]) {
  return arr.reduce((m, s) => Math.max(m, s.z), 0);
}
export function normalizeZ(arr: Stroke[]) {
  const sorted = [...arr].sort((a,b) => a.z - b.z);
  return sorted.map((s, i) => ({ ...s, z: i + 1 }));
}

export function alignShiftX(f: Font, line: string, size: number, align: TextStroke["align"]) {
  if (align === "left") return 0;
  const p = f.getPath(line, 0, 0, size);
  const b = p.getBoundingBox();
  const w = (b.x2 - b.x1) || 0;
  if (align === "center") return -w / 2;
  if (align === "right") return -w;
  return 0;
}

export function boundsWithFont(ts: TextStroke, f: Font) {
  const lines = (ts.text || "").split("\n").map(l => l || " ");
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  let y = ts.y;
  for (const line of lines) {
    const x = ts.x + alignShiftX(f, line, ts.size, ts.align);
    const p = f.getPath(line, x, y, ts.size);
    const b = p.getBoundingBox();
    xMin = Math.min(xMin, b.x1);
    yMin = Math.min(yMin, b.y1);
    xMax = Math.max(xMax, b.x2);
    yMax = Math.max(yMax, b.y2);
    y += ts.size * ts.lineHeight;
  }
  if (!isFinite(xMin)) return null;
  return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
}

export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(file);
  });
}
// en el stroke: { type:'image', dataURL: 'data:image/png;base64,...', x,y,w,h }

function lineVisualWidth(font: Font, text: string, size: number, letterSpacing = 0) {
  const unitsPerEm = font.unitsPerEm || 1000;
  const scale = size / unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  if (!glyphs.length) return 0;
  let w = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    w += (g.advanceWidth || 0) * scale;
    if (i < glyphs.length - 1) {
      w += (font.getKerningValue(g, glyphs[i + 1]) || 0) * scale;
      w += letterSpacing;
    }
  }
  return w;
}

export function alignShiftXLS(font: Font, text: string, size: number, align: "left"|"center"|"right", letterSpacing = 0) {
  const w = lineVisualWidth(font, text, size, letterSpacing);
  if (align === "center") return -w / 2;
  if (align === "right")  return -w;
  return 0; // left
}

export const degToRad = (d:number)=> d*Math.PI/180;