import { useEffect, useRef, useState } from "react";
import opentype, { Font } from "opentype.js";
import KCmdKModal from "./KCmdModal";
import { Label } from "./ui";

const FONT_URL = "/Inter_18pt-Regular.ttf";

type FontGoogle = [string, string];

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
  }

  function exportSVG() {
    if (!font) {
      alert("Carga una fuente TTF/OTF primero.");
      return;
    }

    // Si tienes un canvas de referencia para la escala (preview):
    const canvas = canvasRef?.current as HTMLCanvasElement | null;
    const targetW = Math.max(1, canvas?.width ?? 1024);
    const targetH = Math.max(1, canvas?.height ?? 512);

    // Texto por líneas; línea vacía cuenta altura
    const lines = (text ?? "").split("\n").map(l => (l.length ? l : " "));
    if (lines.length === 0) return;

    // Métricas base a size=1
    const unitsPerEm = font.unitsPerEm || 1000;
    const ascent1  = (font.ascender  || 0) / unitsPerEm;
    const descent1 = Math.abs((font.descender || 0) / unitsPerEm);
    const lineGapMult = typeof lineHeight === "number" ? lineHeight : 1.2;

    // Medición de ancho máx a size=1
    let maxWidth1 = 0;
    for (const line of lines) {
      const p = font.getPath(line, 0, 0, 1);
      const b = p.getBoundingBox();
      const w = (b.x2 - b.x1) || 0;
      maxWidth1 = Math.max(maxWidth1, w);
    }

    // Alto total del bloque a size=1
    const totalHeight1 = ascent1 + descent1 + (lines.length - 1) * lineGapMult;

    // Escala S que cabría en el canvas (solo para escalar el texto; no añade aire)
    const sW = targetW / Math.max(maxWidth1, 1e-6);
    const sH = targetH / Math.max(totalHeight1, 1e-6);
    const S = Math.max(0.0001, Math.min(sW, sH));

    // Baseline de la primera línea (sin centrar: “tight”)
    const ascentPx = ascent1 * S;
    const lineStep = lineGapMult * S;
    let y = ascentPx;   // primera baseline
    const x = 0;

    // Construir paths escalados y bbox total
    const ds: string[] = [];
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;

    for (const line of lines) {
      const p = font.getPath(line, x, y, S);
      ds.push(p.toPathData(3));
      const b = p.getBoundingBox();
      xMin = Math.min(xMin, b.x1);
      yMin = Math.min(yMin, b.y1);
      xMax = Math.max(xMax, b.x2);
      yMax = Math.max(yMax, b.y2);
      y += lineStep;
    }

    // Ajuste para que el contenido quede en (0,0)
    const tx = isFinite(xMin) ? -xMin : 0;
    const ty = isFinite(yMin) ? -yMin : 0;

    // Dimensiones "tight"
    const vbW = Math.max(1, Math.ceil((xMax - xMin) || 1));
    const vbH = Math.max(1, Math.ceil((yMax - yMin) || 1));

    const d = ds.join(" ");

    // Fondo opcional (si NO es transparente)
    const bgRect = transparentBG
      ? ""
      : `  <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="${bg}"/>\n`;

    // Color del texto desde tu estado `fill`
    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">\n` +
      bgRect +
      `  <path d="${d}" fill="${fill}" transform="translate(${tx},${ty})"/>\n` +
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

            <div>
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

            <div>
              <Label>Color</Label>
              <input
                type="color"
                className="w-full h-10 p-1 rounded-lg border border-neutral-300"
                value={fill}
                onChange={(e) => setFill(e.target.value)}
              />
            </div>

            <div className="col-span-2">
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
            <div className="col-span-4">
              <Label>Fuente (sube TTF/OTF): </Label>
              <input type="file" accept=".ttf,.otf" onChange={onUploadTTF} />
            </div>
          </div>
        </div>

        <div className="md:pl-6">
          <h2 className="text-lg font-medium mb-2">Vista previa <span className={`font-[${fontFamily}]`}>{fontFamily}</span></h2>
          <div id="result-wrap" className="flex rounded-2xl border border-neutral-300 bg-white shadow-sm overflow-auto">{/* p-3 */}
            <canvas ref={canvasRef} className="flex-1 max-w-full h-auto min-h-48 rounded-lg" />
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