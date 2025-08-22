import { useEffect, useMemo, useRef, useState } from "react";
import opentype, { Font } from "opentype.js";
import KCmdKModal from "./KCmdModal";
import { DownloadIcon, ErraserIcon, FlipBackwardsIcon, ImagePlusIcon, Label, LayerDownIcon, LayerUpIcon, NewIcon, PaintBrushIcon, SortAmountDownIcon, SortAmountUpIcon, SquareDashedIcon, TextIcon, TrashIcon } from "./ui";

type FontGoogle = [string, string];

// ==== Modelo unificado ====
type Tool = "select" | "text" | "pen" | "eraser";
type Pt = { x: number; y: number };

type Base = {
  id: string;
  z: number;
  visible: boolean;
  locked: boolean;
};

type PenStroke = Base & {
  type: "pen";
  color: string;
  size: number;
  points: Pt[];
};

type EraserStroke = Base & {
  type: "eraser";
  size: number;
  points: Pt[];
};

type TextStroke = Base & {
  type: "text";
  text: string;
  fontFamily: string;
  fill: string;
  lineHeight: number; // múltiplo
  x: number; y: number; // baseline primera línea
  size: number;         // equivalente a fontSize en px canvas
  rotation: number;     // radianes (no usado ahora)
  align: "left" | "center" | "right";
};

type SvgStroke = Base & {
  type: "svg";
  svg: string;                // svg completo como texto
  x: number; y: number;
  scale: number;              // 1 = tamaño intrínseco
  rotation: number;           // rad
  // dimensiones intrínsecas (para preview/hittest/export)
  iw: number; ih: number;     // en unidades del viewBox (o width/height)
};


type Stroke = PenStroke | EraserStroke | TextStroke | SvgStroke;

// ==== Config / estado global ====
const API_KEY = import.meta.env?.VITE_GOOGLE_FONTS_KEY as string | undefined;

const FALLBACK_FONTS = [
  "Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Oswald",
  "Noto Sans","Noto Serif","Merriweather","Source Sans 3","Nunito",
  "Work Sans","Playfair Display","Raleway","Rubik","Quicksand",
  "Fira Sans","PT Sans","PT Serif","Bebas Neue","Inconsolata",
  "DM Sans","DM Serif Display","Karla","Cabin","Manrope","Space Grotesk",
  "Space Mono","IBM Plex Sans","IBM Plex Serif","IBM Plex Mono","Archivo"
].map(f => [f, ""]) as FontGoogle[];

// Si quieres precargar alguna local:
const FALLBACK_FONT_URL = "/Inter_18pt-Regular.ttf";

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

// ==== Util ====
const uid = () => Math.random().toString(36).slice(2, 9);

export default function TextToSVG() {
  // UI / fuentes
  const [fonts, setFonts] = useState<FontGoogle[]>(FALLBACK_FONTS);
  const [fontFamily, setFontFamily] = useState<string>(FALLBACK_FONTS[0][0]);
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  const [fill, setFill] = useState<string>("#111111");
  const [bg, setBg] = useState<string>("#ffffff");
  const [transparentBG, setTransparentBG] = useState<boolean>(true);
  const [status, setStatus] = useState<string>("");

  // Herramientas / lápiz
  const [tool, setTool] = useState<Tool>("select");
  const [penColor, setPenColor] = useState<string>("#111");
  const [penSize, setPenSize] = useState<number>(3);

  // Documento
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const draggingRef = useRef<{ id: string; last: Pt } | null>(null);
  const drawingRef = useRef<PenStroke | EraserStroke | null>(null);
  const svgImgCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Cache de fuentes por familia
  const fontCacheRef = useRef<Map<string, Font>>(new Map());
  const pendingLoadsRef = useRef<Set<string>>(new Set());

  // Canvas y overlay de edición
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [editing, setEditing] = useState<{
    id: string;
    value: string;
    left: number;
    top: number;
    width: number;
  } | null>(null);

  // ==== Cargar lista de fuentes ====
  useEffect(() => { (async () => setFonts(await listFonts()))(); }, []);

  // Precarga una fuente fallback local
  useEffect(() => {
    (async () => {
      if (!FALLBACK_FONT_URL) return;
      try {
        const f = await opentype.load(FALLBACK_FONT_URL);
        fontCacheRef.current.set("Inter", f);
        setStatus(`Fuente lista: ${f.names.fullName?.en || "TTF"}`);
      } catch { /* noop */ }
    })();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = c.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
        drawPreview();
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);


  // ==== Helper: asegurar fuente ====
  function ensureFont(family: string) {
    const cached = fontCacheRef.current.get(family);
    if (cached) return cached;
    if (pendingLoadsRef.current.has(family)) return null;

    const entry = fonts.find(([name]) => name === family);
    const url = entry?.[1];
    if (!url) return null;

    pendingLoadsRef.current.add(family);
    setStatus(`Cargando fuente: ${family}`);
    opentype.load(url).then((f) => {
      fontCacheRef.current.set(family, f);
      pendingLoadsRef.current.delete(family);
      setStatus(`Fuente lista: ${family}`);
      drawPreview(); // repinta cuando llegue
    }).catch((err) => {
      pendingLoadsRef.current.delete(family);
      setStatus(`Error al cargar ${family}: ${err?.message || err}`);
    });
    return null;
  }

  // ==== Cambio de fuente “actual” (para nuevos textos) ====
  function handleFontChange(family: string) {
    setFontFamily(family);
    ensureFont(family);
  }

  // ==== Redibujo ====
  useEffect(() => { drawPreview(); }, [strokes, fill, bg, transparentBG, lineHeight]);

  function getCtx(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    return ctx;
  }

  function drawPreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Asegurar offscreen con mismo tamaño
    if (!offscreenRef.current) offscreenRef.current = document.createElement("canvas");
    const off = offscreenRef.current;
    if (off.width !== canvas.width || off.height !== canvas.height) {
      off.width = canvas.width;
      off.height = canvas.height;
    }

    const ctx = getCtx(canvas);
    const offctx = getCtx(off);

    // Fondo (solo en principal)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparentBG) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Contenido visible = pen + text (en offscreen)
    offctx.clearRect(0, 0, off.width, off.height);
    const sorted = [...strokes].filter(s => s.visible !== false).sort((a,b) => a.z - b.z);

    // Un único recorrido por capas:
    offctx.save();
    for (const s of sorted) {
      if (s.type === "eraser") {
        offctx.globalCompositeOperation = "destination-out";
        drawEraser(offctx, s);
        offctx.globalCompositeOperation = "source-over";
      } else if (s.type === "pen") {
        drawPen(offctx, s);
      } else if (s.type === "text") {
        drawText(offctx, s);
      } else if (s.type === "svg") {
        drawSVG(offctx, s);
      }
    }
    offctx.restore();

    // Pegar en principal
    ctx.drawImage(off, 0, 0);

    // (Opcional) dibujar cajas de selección
    if (selectedIds.length) {
      ctx.save();
      ctx.strokeStyle = "#0af";
      ctx.setLineDash([4, 4]);
      for (const id of selectedIds) {
        const s = strokes.find(st => st.id === id);
        if (!s) continue;
        const b = getStrokeBounds(s);
        if (!b) continue;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
      ctx.restore();
    }
  }

  // ==== Dibujar objetos ====
  function drawPen(ctx: CanvasRenderingContext2D, s: PenStroke) {
    if (s.points.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
    ctx.restore();
  }
  function drawEraser(ctx: CanvasRenderingContext2D, s: EraserStroke) {
    if (s.points.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = s.size;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
    ctx.restore();
  }
  function drawText(ctx: CanvasRenderingContext2D, s: TextStroke) {
    const f = ensureFont(s.fontFamily);
    if (!f) return; // aún cargando

    const lines = (s.text || "").split("\n").map(l => l.length ? l : " ");
    let y = s.y;

    ctx.save();
    // (rotación/alineado básico; puedes ampliar)
    for (const line of lines) {
      const x = s.x + alignShiftX(f, line, s.size, s.align);
      const p = f.getPath(line, x, y, s.size);
      (p as any).fill = s.fill;
      (p as any).stroke = null;
      p.draw(ctx);
      y += s.size * s.lineHeight;
    }
    ctx.restore();
  }
  function alignShiftX(f: Font, line: string, size: number, align: TextStroke["align"]) {
    if (align === "left") return 0;
    const p = f.getPath(line, 0, 0, size);
    const b = p.getBoundingBox();
    const w = (b.x2 - b.x1) || 0;
    if (align === "center") return -w / 2;
    if (align === "right") return -w;
    return 0;
  }

  // ==== Bounds aproximados ====
  function getStrokeBounds(s: Stroke): { x: number; y: number; w: number; h: number } | null {
    if (s.type === "pen" || s.type === "eraser") {
      if (!s.points.length) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const h = (s as any).size / 2;
      return { x: minX - h, y: minY - h, w: (maxX - minX) + 2*h, h: (maxY - minY) + 2*h };
    } else if (s.type === "svg") {
      const w = s.iw * s.scale;
      const h = s.ih * s.scale;
      // (sin rotación para simplificar bounds; si usas rotación, calcula el AABB)
      return { x: s.x, y: s.y, w, h };
    } else {
      const f = fontCacheRef.current.get(s.fontFamily);
      if (!f) return null;
      const lines = (s.text || "").split("\n").map(l => l.length ? l : " ");
      let y = s.y;
      let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
      for (const line of lines) {
        const x = s.x + alignShiftX(f, line, s.size, s.align);
        const p = f.getPath(line, x, y, s.size);
        const b = p.getBoundingBox();
        xMin = Math.min(xMin, b.x1);
        yMin = Math.min(yMin, b.y1);
        xMax = Math.max(xMax, b.x2);
        yMax = Math.max(yMax, b.y2);
        y += s.size * s.lineHeight;
      }
      if (!isFinite(xMin)) return null;
      return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
    }
  }

  // ==== Pointer utils ====
  function getCanvasPos(canvas: HTMLCanvasElement, e: React.PointerEvent) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function hitTest(pt: Pt): string | null {
    // topmost primero
    const sorted = [...strokes].sort((a,b)=>b.z-a.z);
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d")!;
    for (const s of sorted) {
      if (s.type === "text") {
        const f = fontCacheRef.current.get(s.fontFamily);
        if (!f) continue;
        const lines = s.text.split("\n").map(l => l.length ? l : " ");
        let y = s.y;
        for (const line of lines) {
          const x = s.x + alignShiftX(f, line, s.size, s.align);
          const p = f.getPath(line, x, y, s.size);
          const path2d = new Path2D(p.toPathData(2));
          if (ctx.isPointInPath(path2d, pt.x, pt.y)) return s.id;
          y += s.size * s.lineHeight;
        }
      } else if (s.type === "svg") {
        const w = s.iw * s.scale;
        const h = s.ih * s.scale;
        if (pt.x >= s.x && pt.x <= s.x + w && pt.y >= s.y && pt.y <= s.y + h) return s.id;
      } else {
        if (s.points.length < 2) continue;
        let d = `M ${s.points[0].x} ${s.points[0].y}`;
        for (let i=1;i<s.points.length;i++) d += ` L ${s.points[i].x} ${s.points[i].y}`;
        const path2d = new Path2D(d);
        (ctx as any).lineWidth = (s as any).size + 4;
        if (ctx.isPointInStroke(path2d, pt.x, pt.y)) return s.id;
      }
    }
    return null;
  }

  // ==== Interacción ====
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    canvas.setPointerCapture?.(e.pointerId);
    const p = getCanvasPos(canvas, e);
    const nextZ = getMaxZ(strokes) + 1;

    if (tool === "pen" || tool === "eraser") {
      let z = nextZ;
      if (e.shiftKey && selectedIds.length) {
        const target = strokes.find(s => s.id === selectedIds[0]);
        if (target) z = target.z - 0.5;
      }
      const s = {
        id: uid(),
        type: tool,
        z,
        visible: true,
        locked: false,
        color: penColor,
        size: penSize,
        points: [p],
      } as PenStroke | EraserStroke;

      drawingRef.current = s;                 // ← mantiene el trazo activo
      setStrokes(prev => normalizeZ([...prev, s]));
      drawPreview();                           // feedback inmediato
      return;
    }

    if (tool === "text") {
      const textStroke: TextStroke = {
        id: uid(),
        type: "text",
        z: strokes.length + 1,
        visible: true,
        locked: false,
        text: "Doble click para editar",
        fontFamily,
        fill,
        lineHeight,
        x: p.x,
        y: p.y,
        size: 64,
        rotation: 0,
        align: "left",
      };
      ensureFont(fontFamily);
      setStrokes(prev => [...prev, textStroke]);
      setSelectedIds([textStroke.id]);
      drawPreview();
      return;
    }

    // tool === "select"
    const id = hitTest(p);
    if (id) {
      setSelectedIds([id]);
      draggingRef.current = { id, last: p };
    } else {
      setSelectedIds([]);
    }
  }


  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;

    // DIBUJO ACTIVO (lápiz/goma): añadir puntos
    if (drawingRef.current) {
      const p = getCanvasPos(canvas, e);
      const s = drawingRef.current;
      const last = s.points[s.points.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) {
        s.points.push(p);        // muta el trazo en curso (ya está en strokes[])
        drawPreview();           // repinta sin esperar a setState
      }
      return;
    }

    // ARRASTRE (selección)
    const d = draggingRef.current;
    if (!d) return;
    const p = getCanvasPos(canvas, e);
    const dx = p.x - d.last.x;
    const dy = p.y - d.last.y;
    if (dx === 0 && dy === 0) return;

    setStrokes(prev => prev.map(s => {
      if (s.id !== d.id || s.locked) return s;
      if (s.type === "text" || s.type === "svg") {
        return { ...s, x: s.x + dx, y: s.y + dy };
      } else {
        const pts = s.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
        return { ...s, points: pts } as Stroke;
      }
    }));
    draggingRef.current = { ...d, last: p };
  }

  function onPointerUp() {
    if (drawingRef.current) {
      drawingRef.current = null;          // cierra trazo en curso
      // opcional: forzar rerender para “congelar” último segmento
      setStrokes(prev => prev.slice());
    }
    if (draggingRef.current) {
      draggingRef.current = null;
    }
    drawPreview();
  }

  function onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const p = getCanvasPos(canvas, e as any);
    const id = hitTest(p);
    if (!id) return;
    const s = strokes.find(st => st.id === id);
    if (!s || s.type !== "text") return;

    // Posicionar overlay input
    const wrap = wrapRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.clientWidth / canvas.width;
    const scaleY = canvas.clientHeight / canvas.height;

    // ancho sugerido por línea más larga
    const f = ensureFont(s.fontFamily);
    const w = (() => {
      if (!f) return 240;
      const lines = s.text.split("\n");
      let maxW = 0;
      for (const line of lines) {
        const p = f.getPath(line, 0, 0, s.size);
        const b = p.getBoundingBox();
        maxW = Math.max(maxW, (b.x2 - b.x1) || 0);
      }
      return Math.max(160, maxW) * scaleX;
    })();

    setEditing({
      id: s.id,
      value: s.text,
      left: (rect.left + (s.x * scaleX)) - wrap.getBoundingClientRect().left,
      top:  (rect.top  + (s.y * scaleY) - s.size * scaleY), // por encima de la baseline
      width: w,
    });
  }

  // ==== Overlay de edición ====
  const editingRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { if (editing) setTimeout(() => editingRef.current?.focus(), 0); }, [editing]);

  function commitEdit() {
    if (!editing) return;
    setStrokes(prev => prev.map(s => s.id === editing.id && s.type === "text"
      ? { ...s, text: editing.value }
      : s));
    setEditing(null);
  }

  // ==== Acciones ====
  function clearCanvas() { setStrokes([]); }
  function undo() { setStrokes(s => s.slice(0, -1)); }
  function deleteSelected() {
    if (!selectedIds.length) return;
    setStrokes(prev => prev.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  }

  // Tecla Delete para borrar selección
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // evita borrar si estás editando overlay
        if (document.activeElement && (document.activeElement as HTMLElement).tagName.toLowerCase() === "textarea") return;
        deleteSelected();
      }
      if (e.key === "Escape") setEditing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds]);
  
  function onUploadSVG(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => {
      // metadatos básicos
      const meta = parseSVGMeta(txt); // (debajo)
      const s: SvgStroke = {
        id: uid(),
        type: "svg",
        z: strokes.length + 1,
        visible: true,
        locked: false,
        svg: txt,
        x: 50, y: 50,
        scale: 1,
        rotation: 0,
        iw: meta.width ?? meta.vbW ?? 100,
        ih: meta.height ?? meta.vbH ?? 100,
      };
      setStrokes(prev => [...prev, s]);
      setSelectedIds([s.id]);
      drawPreview();
    });
  }

  // parser muy simple de width/height/viewBox
  function parseSVGMeta(svg: string): { width?: number; height?: number; vbX?: number; vbY?: number; vbW?: number; vbH?: number } {
    const mView = svg.match(/viewBox\\s*=\\s*\"([\\d\\.\\-eE]+)\\s+([\\d\\.\\-eE]+)\\s+([\\d\\.\\-eE]+)\\s+([\\d\\.\\-eE]+)\"/i);
    const mW = svg.match(/\\swidth\\s*=\\s*\"([\\d\\.]+)(px)?\"/i);
    const mH = svg.match(/\\sheight\\s*=\\s*\"([\\d\\.]+)(px)?\"/i);
    const out: any = {};
    if (mView) {
      out.vbX = +mView[1]; out.vbY = +mView[2]; out.vbW = +mView[3]; out.vbH = +mView[4];
    }
    if (mW) out.width = +mW[1];
    if (mH) out.height = +mH[1];
    return out;
  }

  function drawSVG(ctx: CanvasRenderingContext2D, s: SvgStroke) {
    // cache de Image por id (rasteriza solo para PREVIEW)
    let img = svgImgCacheRef.current.get(s.id);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.onload = () => drawPreview();
      const blob = new Blob([s.svg], { type: "image/svg+xml;charset=utf-8" });
      img.src = URL.createObjectURL(blob);
      svgImgCacheRef.current.set(s.id, img);
    }
    const w = s.iw * s.scale;
    const h = s.ih * s.scale;

    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.rotation) ctx.rotate(s.rotation);
    // dibuja con el origen en (0,0)
    if (img.complete) {
      ctx.drawImage(img, 0, 0, w, h);
    }
    ctx.restore();
  }


  // ==== Exportar SVG con máscara (respeta goma) ====
  function exportSVG({ eraseBackgroundToo = false }: { eraseBackgroundToo?: boolean } = {}) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generar paths y máscara a partir de strokes
    const penEls: string[] = [];
    const eraserMask: string[] = [];
    const textEls: string[] = [];

    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;

    const pushBounds = (bx1: number, by1: number, bx2: number, by2: number) => {
      xMin = Math.min(xMin, bx1);
      yMin = Math.min(yMin, by1);
      xMax = Math.max(xMax, bx2);
      yMax = Math.max(yMax, by2);
    };

    const sorted = [...strokes].filter(s=>s.visible!==false).sort((a,b)=>a.z-b.z);

    // lápiz detrás
    for (const s of sorted) {
      if (s.type !== "pen") continue;
      if (s.points.length < 2) continue;
      let d = `M ${s.points[0].x} ${s.points[0].y}`;
      let minX = s.points[0].x, minY = s.points[0].y, maxX = s.points[0].x, maxY = s.points[0].y;
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i];
        d += ` L ${p.x} ${p.y}`;
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
      const h = s.size / 2;
      pushBounds(minX - h, minY - h, maxX + h, maxY + h);
      penEls.push(
        `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }

    // bounds (antes de construir el string)
    for (const s of sorted) {
      if (s.type === "svg") {
        const sv = s as SvgStroke;
        const w = sv.iw * sv.scale, h = sv.ih * sv.scale;
        pushBounds(sv.x, sv.y, sv.x + w, sv.y + h);
      }
    }


    // texto encima
    for (const s of sorted) {
      if (s.type !== "text") continue;
      const f = fontCacheRef.current.get(s.fontFamily);
      if (!f) continue; // aún no cargado
      const lines = s.text.split("\n").map(l => l.length ? l : " ");
      let y = s.y;
      for (const line of lines) {
        const x = s.x + alignShiftX(f, line, s.size, s.align);
        const p = f.getPath(line, x, y, s.size);
        const b = p.getBoundingBox();
        pushBounds(b.x1, b.y1, b.x2, b.y2);
        textEls.push(`<path d="${p.toPathData(3)}" fill="${s.fill}"/>`);
        y += s.size * s.lineHeight;
      }
    }

    // goma → máscara negra
    for (const s of sorted) {
      if (s.type !== "eraser" || s.points.length < 2) continue;
      let d = `M ${s.points[0].x} ${s.points[0].y}`;
      let minX = s.points[0].x, minY = s.points[0].y, maxX = s.points[0].x, maxY = s.points[0].y;
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i];
        d += ` L ${p.x} ${p.y}`;
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
      const h = s.size / 2;
      // La goma no añade a bounds visibles
      eraserMask.push(`<path d="${d}" fill="none" stroke="black" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`);
    }

    const svgEls: string[] = [];
    for (const s of sorted) {
      if (s.type !== "svg") continue;
      const sv = s as SvgStroke;

      // Transform para posicionarlo (recuerda que ya hay un translate global T aplicado fuera)
      const tx = sv.x - xMin, ty = sv.y - yMin;
      const rot = sv.rotation ? ` rotate(${(sv.rotation*180/Math.PI).toFixed(3)})` : "";
      // Opción A (simple): incrusta el SVG entero anidado (mantiene todo, defs, estilos)
      svgEls.push(
        `    <g transform="translate(${tx},${ty}) scale(${sv.scale})${rot}">\n` +
        `      ${sanitizeForEmbed(sv.svg)}\n` +
        `    </g>`
      );
    }


    if (!isFinite(xMin) || !isFinite(yMin) || !isFinite(xMax) || !isFinite(yMax)) {
      alert("No hay contenido visible para exportar.");
      return;
    }

    const vbW = Math.max(1, Math.ceil(xMax - xMin));
    const vbH = Math.max(1, Math.ceil(yMax - yMin));
    const T = `transform="translate(${-xMin},${-yMin})"`;

    const bgRect = transparentBG ? "" : `  <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="${bg}"/>\n`;
    const mask =
`  <defs>
    <mask id="eraserMask" maskUnits="userSpaceOnUse">
      <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="white"/>
      <g ${T}>
${eraserMask.join("\n")}
      </g>
    </mask>
  </defs>`;

    const maskedOpen = eraseBackgroundToo
      ? `  <g mask="url(#eraserMask)">\n${bgRect}    <g ${T}>\n`
      : `  ${bgRect}  <g mask="url(#eraserMask)">\n    <g ${T}>\n`;

    const svg =
`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
${mask}
${maskedOpen}
${penEls.join("\n")}
${svgEls.join("\n")}
${textEls.join("\n")}
    </g>
  </g>
</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "editor-masked.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ==== Upload TTF/OTF y añadirlo al cache como “Custom” ====
  function onUploadTTF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.arrayBuffer().then(buf => {
      try {
        const f = opentype.parse(buf);
        const name = f.names.fullName?.en || file.name.replace(/\.(ttf|otf)$/i,"");
        fontCacheRef.current.set(name, f);
        setFonts(prev => [[name, ""], ...prev]);
        setFontFamily(name);
        setStatus(`Fuente cargada: ${name}`);
        drawPreview();
      } catch (err: any) {
        setStatus("No pude parsear el TTF/OTF: " + (err?.message || err));
      }
    });
  }

  function sanitizeForEmbed(src: string) {
    // elimina prolog y doctype; deja el <svg> como está
    return src
      .replace(/<\\?xml[^>]*>/gi, "")
      .replace(/<!DOCTYPE[^>]*>/gi, "")
      .trim();
  }

  // z helpers
  function getMaxZ(arr: Stroke[] = strokes) {
    return arr.reduce((m, s) => Math.max(m, s.z), 0);
  }
  function normalizeZ(arr: Stroke[]) {
    const sorted = [...arr].sort((a,b) => a.z - b.z);
    return sorted.map((s, i) => ({ ...s, z: i + 1 }));
  }

  // Acciones de orden
  function bringToFront(ids: string[]) {
    setStrokes(prev => {
      const max = getMaxZ(prev);
      let bump = 1;
      const arr = prev.map(s => ids.includes(s.id) ? { ...s, z: max + bump++ } : s);
      return normalizeZ(arr);
    });
  }
  function sendToBack(ids: string[]) {
    setStrokes(prev => {
      let neg = ids.length;
      const arr = prev.map(s => ids.includes(s.id) ? { ...s, z: -neg-- } : s);
      return normalizeZ(arr);
    });
  }
  function bringForward(ids: string[]) {
    setStrokes(prev => {
      const arr = [...prev];
      ids.forEach(id => {
        const i = arr.findIndex(s => s.id === id);
        if (i < 0) return;
        // busca el siguiente mayor z y permuta
        const higher = arr.filter(s => s.z > arr[i].z).sort((a,b)=>a.z-b.z)[0];
        if (!higher) return;
        const z = arr[i].z; arr[i].z = higher.z; higher.z = z;
      });
      return normalizeZ(arr);
    });
  }
  function sendBackward(ids: string[]) {
    setStrokes(prev => {
      const arr = [...prev];
      ids.forEach(id => {
        const i = arr.findIndex(s => s.id === id);
        if (i < 0) return;
        const lower = arr.filter(s => s.z < arr[i].z).sort((a,b)=>b.z-a.z)[0];
        if (!lower) return;
        const z = arr[i].z; arr[i].z = lower.z; lower.z = z;
      });
      return normalizeZ(arr);
    });
  }


  // ==== JSX ====
  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto p-6 grid gap-6 md:grid-rows-[auto_1fr]">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Editor Text + Dibujo → SVG</h1>
          <p className="text-sm text-neutral-600 mb-4">{status}</p>

          <div className="grid grid-cols-8 gap-3 mb-4">
            { tool === "text" && (
              <>
                <div className="col-span-full sm:col-span-4">
                  <Label>Fuente (Google Fonts)</Label>
                  <KCmdKModal
                    title="Fuente (Google Fonts)"
                    label={fontFamily || "Fuente"}
                    fonts={fonts}
                    handleFontChange={(f) => { handleFontChange(f); }}
                    API_KEY={API_KEY}
                  />
                  <p className="text-xs text-neutral-500">
                    Puedes buscar una fuente, o subir un TTF/OTF personalizado.
                  </p>
                </div>

                <div className="col-span-4 overflow-hidden">
                  <Label>Fuente (sube TTF/OTF): </Label>
                  <input type="file" accept=".ttf,.otf" onChange={onUploadTTF} />
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
                  <Label>Color de texto</Label>
                  <input
                    type="color"
                    className="w-full h-10 p-1 rounded-lg border border-neutral-300"
                    value={fill}
                    onChange={(e) => setFill(e.target.value)}
                  />
                </div>
              </>
            )}

            { (tool === "pen" || tool === "eraser") && (
              <>
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
                  <Label>Pencil Width</Label>
                  <input
                    type="number"
                    step="1"
                    className="w-full p-2 rounded-lg border border-neutral-300"
                    min={1}
                    max={40}
                    value={penSize}
                    onChange={(e) => setPenSize(+e.target.value || 3)}
                  />
                </div>
              </>
            )}

            <div className="col-span-4">
              <Label>Herramienta</Label>
              <div className="flex flex-wrap items-center gap-2">
                { tool === "select" && (
                  <>
                    <button onClick={() => bringToFront(selectedIds)} className="px-2 py-1 border rounded">
                      <LayerUpIcon className="inline size-6" />
                    </button>
                    <button onClick={() => sendToBack(selectedIds)} className="px-2 py-1 border rounded">
                      <LayerDownIcon className="inline size-6" />
                    </button>
                    <button onClick={() => bringForward(selectedIds)} className="px-2 py-1 border rounded">
                      <SortAmountUpIcon className="inline size-6" />
                    </button>
                    <button onClick={() => sendBackward(selectedIds)} className="px-2 py-1 border rounded">
                      <SortAmountDownIcon className="inline size-6" />
                    </button>
                  </>
                )}
                <label className="px-2 py-1 border rounded ml-auto">
                  <ImagePlusIcon className="inline size-6" />
                  <input type="file" className="hidden" accept=".svg" onChange={onUploadSVG} />
                </label>
                <button onClick={clearCanvas} className="px-2 py-1 rounded border ml-auto">
                  <NewIcon className="inline size-6" />
                </button>
                <button onClick={undo} className="px-2 py-1 rounded border">
                  <FlipBackwardsIcon className="inline size-6" />
                </button>
                <button onClick={deleteSelected} className="px-2 py-1 rounded border">
                  <TrashIcon className="inline size-6" />
                </button>
                <button
                  onClick={() => exportSVG({ eraseBackgroundToo: false })}
                  className="px-2 py-1 rounded bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-1"
                >
                  <span className="text-sm">SVG</span>
                  <DownloadIcon className="inline size-6" />
                </button>
                {/* <button
                  onClick={() => exportSVG({ eraseBackgroundToo: true })}
                  className="px-2 py-1 rounded bg-neutral-700 text-white hover:bg-neutral-600 disabled:opacity-50"
                  title="La goma también recorta el fondo"
                >
                  SVG (borra fondo)
                </button> */}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-1">
          <div className="grid grid-cols-1 gap-1 place-content-start grid-rows-auto">
            <button
              type="button"
              className={`px-3 py-2 rounded-lg ${tool === "select" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
              onClick={() => setTool("select")}
            >
              <SquareDashedIcon className="size-8" />
            </button>
            <button
              type="button"
              className={`px-3 py-2 rounded-lg ${tool === "text" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
              onClick={() => setTool("text")}
            >
              <TextIcon className="size-8" />
            </button>
            <button
              type="button"
              className={`px-3 py-2 rounded-lg ${tool === "pen" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
              onClick={() => setTool("pen")}
            >
              <PaintBrushIcon className="size-8" />
            </button>
            <button
              type="button"
              className={`px-3 py-2 rounded-lg ${tool === "eraser" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
              onClick={() => setTool("eraser")}
            >
              <ErraserIcon className="size-8" />
            </button>
            <input
              type="color"
              className={`size-14 p-1 rounded-lg border border-neutral-300 bg-neutral-200 overflow-hidden ${transparentBG ? 'relative before:content-[\'\'] before:absolute before:left-2 before:bottom-2 before:w-13 before:h-0.5 before:bg-red-500 before:-rotate-43 before:origin-left' : ''}`}
              disabled={transparentBG}
              value={transparentBG ? '#ffffff' : bg}
              onChange={(e)=>setBg(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={transparentBG}
                onChange={(e)=>setTransparentBG(e.target.checked)}
              />
            </label>
          </div>

          <div>

            <div
              id="result-wrap"
              ref={wrapRef}
              className="relative flex rounded-2xl border border-neutral-300 bg-white shadow-sm overflow-auto overscroll-contain"
            >
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={onDoubleClick}
                className="flex-1 max-w-full h-auto min-h-48 rounded-lg touch-none"
              />
              {/* Overlay de edición */}
              {editing && (
                <textarea
                  ref={editingRef}
                  value={editing.value}
                  onChange={(e)=>setEditing(ed => ed ? {...ed, value: e.target.value} : ed)}
                  onBlur={commitEdit}
                  onKeyDown={(e)=>{ if(e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitEdit(); } }}
                  style={{ position:"absolute", left: editing.left, top: editing.top, width: editing.width }}
                  className="rounded-md border border-neutral-300 bg-white p-2 shadow-sm text-sm outline-none focus:ring-2 focus:ring-neutral-600"
                  rows={3}
                />
              )}
            </div>
          </div>
          <p className="col-span-full text-xs text-neutral-500">
            Texto: click para crear, doble click para editar. Seleccionar: arrastra para mover. Delete para borrar.
            Tip: mantén <kbd>Shift</kbd> al iniciar un trazo para insertarlo debajo de lo seleccionado.
          </p>
          <pre className="col-span-full">{ JSON.stringify(strokes, null, ' ')}</pre>
        </div>
      </div>
    </div>
  );
}
