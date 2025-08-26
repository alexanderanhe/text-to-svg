import opentype, { Font } from "opentype.js";
import type { FontGoogle } from "../types/strokes";

export async function listFonts(API_KEY?: string, FALLBACK_FONTS: FontGoogle[] = []): Promise<FontGoogle[]> {
  if (!API_KEY) return FALLBACK_FONTS;
  try {
    const r = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${API_KEY}`);
    if (!r.ok) throw 0;
    const data = await r.json();
    if (!Array.isArray(data.items)) throw 0;
    return data.items.map((it: any) => [it.family, it.files.regular]);
  } catch {
    return FALLBACK_FONTS;
  }
}

export function ensureFont(
  family: string,
  fonts: FontGoogle[],
  fontCache: Map<string, Font>,
  pendingLoads: Set<string>,
  setStatus: (msg: string) => void,
  drawPreview: () => void
): Font | null {
  const cached = fontCache.get(family);
  if (cached) return cached;
  if (pendingLoads.has(family)) return null;

  const entry = fonts.find(([name]) => name === family);
  const url = entry?.[1];
  if (!url) return null;

  pendingLoads.add(family);
  setStatus(`Cargando fuente: ${family}`);
  opentype.load(url).then((f) => {
    fontCache.set(family, f);
    pendingLoads.delete(family);
    setStatus(`Fuente lista: ${family}`);
    drawPreview();
  }).catch((err) => {
    pendingLoads.delete(family);
    setStatus(`Error al cargar ${family}: ${err?.message || err}`);
  });
  return null;
}

export async function ensureFontAsync(
  family: string,
  fonts: FontGoogle[],
  fontCache: Map<string, Font>,
  pendingLoads: Set<string>
): Promise<Font | null> {
  const cached = fontCache.get(family);
  if (cached) return cached;

  // si ya se está cargando, espera
  if (pendingLoads.has(family)) {
    return new Promise<Font | null>(resolve => {
      const tick = () => {
        const f = fontCache.get(family) || null;
        if (f) return resolve(f);
        setTimeout(tick, 40);
      };
      tick();
    });
  }

  const entry = fonts.find(([name]) => name === family);
  const url = entry?.[1];
  if (!url) return null;

  pendingLoads.add(family);
  try {
    const f = await opentype.load(url);
    fontCache.set(family, f);
    return f;
  } catch {
    return null;
  } finally {
    pendingLoads.delete(family);
  }
}
