import { useEffect, useRef, useState } from "react";
import opentype, { Font } from "opentype.js";
import KCmdKModal from "./KCmdModal";
import { Label } from "./ui";

const FONT_URL = "/Inter_18pt-Regular.ttf";

type FontGoogle = [string, string];

type Pt = { x: number; y: number };
type Stroke = { color: string; size: number; points: Pt[] };

export default function TextToSVG() {
  // Estado UI
  const [fonts, setFonts] = useState<FontGoogle[]>(FALLBACK_FONTS);
  const [text, setText] = useState(DEFAULT_INPUT);
  const [font, setFont] = useState<Font | null>(null);
  const [fontFamily, setFontFamily] = useState<string>(FALLBACK_FONTS[0][0]);
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  const [fill, setFill] = useState<string>("#111111");
  const [bg, setBg] = useState<string>("#ffffff");
  const [transparentBG, setTransparentBG] = useState<boolean>(true);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);

  // Config del lápiz
  const [penColor, setPenColor] = useState<string>("#111"); // o usa `fill`
  const [penSize, setPenSize] = useState<number>(3);

  // Estado fuente
  const [status, setStatus] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  // Lista de fuentes
  useEffect(() => {
    (async () => {
      const list = await listFonts();
      setFonts(list);
    })();
  }, []);

  // Cargar fuente por URL (opcional)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!FONT_URL) return;
        const f = await opentype.load(FONT_URL);
        if (!alive) return;
        setFont(f);
        setStatus(`Fuente lista: ${f.names.fullName?.en || "TTF"}`);
      } catch {
        setStatus("Sube un TTF (no se pudo cargar la fuente por URL).");
      }
    })();
    return () => { alive = false; };
  }, []);

  // Redibuja en canvas cada vez que cambien parámetros
  useEffect(() => {
    if (!font) return;
    drawPreview();
  }, [font, text, fill, bg, transparentBG, lineHeight]);

  function handleFontChange(family: string) {
    setFontFamily(family);
    const selectedFont = fonts.find(([f]) => f === family);
    if (selectedFont) {
      setFont(null); // reset font to force loading
      setStatus(`Cargando fuente: ${family}`);
      opentype.load(selectedFont[1]).then((f) => {
        setFont(f);
        setStatus(`Fuente lista: ${family}`);
      }).catch((err) => {
        setStatus("Error al cargar la fuente: " + err.message);
      });
    }
  }

  function drawPreview() {
    const canvas = canvasRef.current;
    if (!canvas || !font) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Texto por líneas (sustituimos vacías por un espacio para mantener altura)
    const lines = (text ?? "").split("\n").map(l => (l.length ? l : " "));

    if (lines.length === 0) return;

    // --- Métricas de fuente a tamaño 1 ---
    const unitsPerEm = font.unitsPerEm || 1000;
    const ascent1  = (font.ascender  || 0) / unitsPerEm;
    const descent1 = Math.abs((font.descender || 0) / unitsPerEm);
    const lineGapMult = typeof lineHeight === "number" ? lineHeight : 1.2;

    // Medimos ancho máximo por bounding box (a size=1) y x mínimo (por si hay overhang negativo)
    let maxWidth1 = 0;
    let minX1 = Infinity;

    for (const line of lines) {
      const p = font.getPath(line, 0, 0, 1); // x=0,y=0,tamaño=1 solo para medir
      const b = p.getBoundingBox();
      const w = (b.x2 - b.x1) || 0; // puede ser 0 para " "
      maxWidth1 = Math.max(maxWidth1, w);
      minX1 = Math.min(minX1, b.x1);
    }

    // Altura total del bloque a size=1 (top-of-first hasta bottom-of-last)
    const totalHeight1 = ascent1 + descent1 + (lines.length - 1) * lineGapMult;

    // --- Calculamos el fontSize S que cabe en el canvas sin tocar sus dimensiones ---
    const sW = canvas.width  / Math.max(maxWidth1, 1e-6);   // escala por ancho
    const sH = canvas.height / Math.max(totalHeight1, 1e-6); // escala por alto
    const S = Math.max(0.0001, Math.min(sW, sH)); // mayor posible que cumple ambas

    // Posicionamiento vertical centrado
    const ascentPx  = ascent1 * S;
    const descentPx = descent1 * S;
    const lineStep  = lineGapMult * S; // distancia baseline-baseline
    const totalHeightPx = ascentPx + descentPx + (lines.length - 1) * lineStep;
    const topY = (canvas.height - totalHeightPx) / 2; // borde superior del bloque
    let y = topY + ascentPx; // baseline de la primera línea

    // Corregimos desplazamiento horizontal si hay x mínima negativa (overhang)
    const xShift = -Math.min(0, minX1 * S);

    // Limpiamos y dibujamos
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparentBG) {
      ctx.save();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    for (const line of lines) {
      const p = font.getPath(line, xShift, y, S);
      p.fill = fill;
      p.draw(ctx);
      y += lineStep;
    }

    // --- DIBUJAR TRAZOS ---
    ctx.save();
    strokes.forEach((s) => {
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  function exportSVG() {
    if (!font) {
      alert("Carga una fuente TTF/OTF primero.");
      return;
    }

    const canvas = canvasRef?.current as HTMLCanvasElement | null;
    const targetW = Math.max(1, canvas?.width ?? 1024);
    const targetH = Math.max(1, canvas?.height ?? 512);

    // --- TEXTO: igual que tu versión tight (sin padding/fontSize fijos) ---
    const lines = (text ?? "").split("\n").map(l => (l.length ? l : " "));
    if (lines.length === 0 && strokes.length === 0) return;

    const unitsPerEm = font.unitsPerEm || 1000;
    const ascent1  = (font.ascender  || 0) / unitsPerEm;
    const descent1 = Math.abs((font.descender || 0) / unitsPerEm);
    const lineGapMult = typeof lineHeight === "number" ? lineHeight : 1.2;

    let maxWidth1 = 0;
    for (const line of lines) {
      const p = font.getPath(line, 0, 0, 1);
      const b = p.getBoundingBox();
      const w = (b.x2 - b.x1) || 0;
      maxWidth1 = Math.max(maxWidth1, w);
    }

    const totalHeight1 = (lines.length
      ? ascent1 + descent1 + (lines.length - 1) * lineGapMult
      : 0);

    // Escala del texto para encajar en canvas (no añade aire al SVG)
    const sW = maxWidth1 ? targetW / maxWidth1 : Infinity;
    const sH = totalHeight1 ? targetH / totalHeight1 : Infinity;
    const S = !lines.length ? 1 : Math.max(0.0001, Math.min(sW, sH));

    const ascentPx = ascent1 * S;
    const lineStep = lineGapMult * S;
    let y = ascentPx;
    const x = 0;

    const textPaths: string[] = [];
    let txMin = Infinity, tyMin = Infinity, txMax = -Infinity, tyMax = -Infinity;

    if (lines.length) {
      for (const line of lines) {
        const p = font.getPath(line, x, y, S);
        textPaths.push(p.toPathData(3));
        const b = p.getBoundingBox();
        txMin = Math.min(txMin, b.x1);
        tyMin = Math.min(tyMin, b.y1);
        txMax = Math.max(txMax, b.x2);
        tyMax = Math.max(tyMax, b.y2);
        y += lineStep;
      }
    }

    // --- TRAZOS (mano alzada) ---
    // Convierte cada stroke en un <path> con stroke/width y recoge bbox
    let sxMin = Infinity, syMin = Infinity, sxMax = -Infinity, syMax = -Infinity;
    const strokePaths: string[] = [];

    const strokeToD = (pts: Pt[]) => {
      if (!pts.length) return "";
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
      return d;
    };

    strokes.forEach((s) => {
      if (s.points.length < 2) return;
      // bbox de puntos (considera grosor)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      s.points.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      const half = s.size / 2;
      sxMin = Math.min(sxMin, minX - half);
      syMin = Math.min(syMin, minY - half);
      sxMax = Math.max(sxMax, maxX + half);
      syMax = Math.max(syMax, maxY + half);

      const d = strokeToD(s.points);
      strokePaths.push(
        `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    });

    // --- BBOX combinado (texto + trazos) ---
    const mins = [
      isFinite(txMin) ? txMin : Infinity,
      isFinite(tyMin) ? tyMin : Infinity,
      isFinite(sxMin) ? sxMin : Infinity,
      isFinite(syMin) ? syMin : Infinity,
    ];
    const maxs = [
      isFinite(txMax) ? txMax : -Infinity,
      isFinite(tyMax) ? tyMax : -Infinity,
      isFinite(sxMax) ? sxMax : -Infinity,
      isFinite(syMax) ? syMax : -Infinity,
    ];

    const xMinAll = Math.min(mins[0], mins[2]);
    const yMinAll = Math.min(mins[1], mins[3]);
    const xMaxAll = Math.max(maxs[0], maxs[2]);
    const yMaxAll = Math.max(maxs[1], maxs[3]);

    // Si no hay nada, aborta
    if (!isFinite(xMinAll) || !isFinite(yMinAll) || !isFinite(xMaxAll) || !isFinite(yMaxAll)) {
      return;
    }

    const vbW = Math.max(1, Math.ceil(xMaxAll - xMinAll));
    const vbH = Math.max(1, Math.ceil(yMaxAll - yMinAll));

    // Fondo opcional
    const bgRect = transparentBG
      ? ""
      : `  <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="${bg}"/>\n`;

    // Grupo con translate para alinear todo a (0,0)
    const T = `transform="translate(${-xMinAll},${-yMinAll})"`;

    const textPathEl = textPaths.length
      ? `  <path d="${textPaths.join(" ")}" fill="${fill}" />\n`
      : "";

    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">\n` +
      bgRect +
      `  <g ${T}>\n` +
      textPathEl +
      (strokePaths.length ? `  ${strokePaths.join("\n  ")}\n` : "") +
      `  </g>\n` +
      `</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "text.svg";
    a.click();
    URL.revokeObjectURL(url);
  }


  function onUploadTTF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.arrayBuffer().then(buf => {
      try {
        const f = opentype.parse(buf);
        setFont(f);
        setStatus(`Fuente cargada: ${file.name}`);
      } catch (err: any) {
        setStatus("No pude parsear el TTF/OTF: " + (err?.message || err));
      }
    });
  }

  function getCanvasPos(canvas: HTMLCanvasElement, e: React.PointerEvent) {
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
}

function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
  const canvas = e.currentTarget;
  canvas.setPointerCapture?.(e.pointerId);
  const p = getCanvasPos(canvas, e);
  const s: Stroke = { color: penColor, size: penSize, points: [p] };
  drawingRef.current = s;
  setStrokes((prev) => [...prev, s]);
}

function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
  const s = drawingRef.current;
  if (!s) return;
  const canvas = e.currentTarget;
  const p = getCanvasPos(canvas, e);
  const last = s.points[s.points.length - 1];
  if (!last || last.x !== p.x || last.y !== p.y) {
    s.points.push(p);
    // Dibuja incrementalmente el segmento (opcional, para feedback inmediato)
    const ctx = canvas.getContext("2d");
    if (ctx && last) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
  drawingRef.current = null;
}


  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <div className="max-w-6xl mx-auto p-6 grid gap-6 md:grid-cols-2">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Text → SVG con Google Fonts</h1>
          <p className="text-sm text-neutral-600 mb-4">
            {status}
          </p>

          <div className="mb-4">
            <Label>Texto</Label>
            <textarea
              className="w-full h-40 p-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe aquí…"
              ref={textRef}
            />
          </div>


          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="col-span-4">
              <Label>Fuente (Google Fonts)</Label>
              <KCmdKModal
                title="Fuente (Google Fonts)"
                label={font?.names.fullName?.en || "Fuente"}
                fonts={fonts}
                handleFontChange={(f) => {
                  handleFontChange(f);
                  textRef.current?.focus();
                }}
                API_KEY={API_KEY}
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label>Line height</Label>
              <input
                type="number"
                step="0.05"
                className="w-full p-2 rounded-lg border border-neutral-300"
                min={0.8}
                max={3}
                value={lineHeight}
                onChange={(e) => setLineHeight(+e.target.value || 1.2)}
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label>Color</Label>
              <input
                type="color"
                className="w-full h-10 p-1 rounded-lg border border-neutral-300"
                value={fill}
                onChange={(e) => setFill(e.target.value)}
              />
            </div>

            <div className="col-span-4 sm:col-span-2">
              <Label>Fondo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="w-20 h-10 p-1 rounded-lg border border-neutral-300"
                  disabled={transparentBG}
                  value={bg}
                  onChange={(e)=>setBg(e.target.value)}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={transparentBG}
                    onChange={(e)=>setTransparentBG(e.target.checked)}
                  /> Transparente
                </label>
              </div>
            </div>

            <div className="col-span-4 overflow-hidden">
              <Label>Fuente (sube TTF/OTF): </Label>
              <input type="file" accept=".ttf,.otf" onChange={onUploadTTF} />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label>Pencil Color</Label>
              <input
                type="color"
                className="w-full h-10 p-1 rounded-lg border border-neutral-300"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label>Line height</Label>
              <input
                type="number"
                step="1"
                className="w-full p-2 rounded-lg border border-neutral-300"
                min={1}
                max={20}
                value={penSize}
                onChange={(e) => setPenSize(+e.target.value || 3)}
              />
            </div>

          </div>
        </div>

        <div className="md:pl-6">
          <h2 className="text-lg font-medium mb-2">Vista previa <span className={`font-[${fontFamily}]`}>{fontFamily}</span></h2>
          <div id="result-wrap" className="flex rounded-2xl border border-neutral-300 bg-white shadow-sm overflow-auto">{/* p-3 */}
            <canvas
              ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              className="flex-1 max-w-full h-auto min-h-48 rounded-lg" />
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            {status} {fill}
          </p>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={exportSVG}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              Guardar SVG
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** =========================
 *  Config
 *  ========================= */
const FALLBACK_FONTS = [
  "Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Oswald",
  "Noto Sans","Noto Serif","Merriweather","Source Sans 3","Nunito",
  "Work Sans","Playfair Display","Raleway","Rubik","Quicksand",
  "Fira Sans","PT Sans","PT Serif","Bebas Neue","Inconsolata",
  "DM Sans","DM Serif Display","Karla","Cabin","Manrope","Space Grotesk",
  "Space Mono","IBM Plex Sans","IBM Plex Serif","IBM Plex Mono","Archivo"
].map(f => [f, '']) as FontGoogle[];

const API_KEY = import.meta.env?.VITE_GOOGLE_FONTS_KEY as string | undefined;

async function listFonts(): Promise<FontGoogle[]> {
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

const DEFAULT_INPUT = `Enter your text here to convert it to SVG paths.`;