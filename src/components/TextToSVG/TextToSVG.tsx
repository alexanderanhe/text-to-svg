import { useEffect, useRef, useState } from "react";
import opentype, { Font } from "opentype.js";
import KCmdKModal from "../KCmdModal";
import { CircleIcon, CursorIcon, DownloadIcon, ErraserIcon, EyeClosedIcon, EyeOpenIcon, FileSVGIcon, FlipBackwardsIcon, ImagePlusIcon, Label, LayerDownIcon, LayerIcon, LayerUpIcon, LineIcon, LockClosedIcon, LockOpenIcon, PaintBrushIcon, SortAmountDownIcon, SortAmountUpIcon, SquareIcon, TextIcon, TrashIcon } from "../ui";
import { Drawer } from "vaul";
import ClassicMenuBar, { type Menu } from "../ClassicMenuBar";
import { BrushSizeSelect } from "../BrushSizeSelect";
import type { Tool, Pt, PenStroke, EraserStroke, TextStroke, SvgStroke, Stroke, Handle, FontGoogle, ShapeKind, ShapeStroke, StrokeType } from "../../types/strokes";
import { ensureFont, ensureFontAsync, listFonts } from "../../utils/fontUtils";
import { isFontFile, isSvgFile } from "../../utils/fileUtils";
import { extractSvgInner, parseSVGMeta } from "../../utils/svgUtils";
import { getCanvasPos } from "../../utils/canvasUtils";
import { alignShiftX, boundsWithFont, getMaxZ, normalizeZ } from "../../utils/helpers";
import { FillPicker } from "../FillPicker";
import { StrokeWidth } from "../StrokeWidth";
import { Radius } from "../Radius";
import { IconButton } from "../IconButton";

const AA_MARGIN = 1; // 1px de seguridad contra antialias/decimales

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
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const [openDrawer, setOpenDrawer] = useState(false);

  // Herramientas / lápiz
  const [tool, setTool] = useState<Tool>("text");
  const [penColor, setPenColor] = useState<string>("#111");
  const [penSize, setPenSize] = useState<number>(20);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [shapeFill, setShapeFill] = useState<string>("#09f");
  const [shapeHasFill, setShapeHasFill] = useState<boolean>(true);
  const [shapeStroke, setShapeStroke] = useState<string>("#111111");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);
  const [shapeRadius, setShapeRadius] = useState<number>(12); // rect redondeado
  const creatingShapeRef = useRef<ShapeStroke | null>(null);

  // util
  const isBreak = (p: Pt) => !Number.isFinite(p.x) || !Number.isFinite(p.y);
  const BREAK: Pt = { x: Number.NaN, y: Number.NaN };
  const currentPenIdRef = useRef<string | null>(null);


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

  const resizingRef = useRef<null | {
    id: string;
    handle: Handle;
    startPt: Pt;                  // donde empezó el drag
    startBBox: { x:number; y:number; w:number; h:number };
    startStroke: Stroke;          // snapshot
  }>(null);

  // ==== Cargar lista de fuentes ====
  useEffect(() => { (async () => setFonts(await listFonts(API_KEY, FALLBACK_FONTS)))(); }, []);

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
    console.log("ResizeObserver");
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // si cambias de herramienta o de estilo, “cierra” el pen activo
  useEffect(() => { if (tool !== "pen") currentPenIdRef.current = null; }, [tool]);
  // si cambias color/tamaño, empezará un stroke nuevo
  useEffect(() => { currentPenIdRef.current = null; }, [penColor, penSize]);


  const menus: Menu[] = [
    {
      id: "archivo",
      label: "Archivo",
      items: [
        { id: "nuevo", label: "Nuevo", shortcut: "⌘N", onSelect: clearCanvas },
        { id: "descargar-como", label: "Descargar SVG", shortcut: "⇧⌘S", onSelect: exportSVG },
      ],
    },
    {
      id: "edicion",
      label: "Edición",
      items: [
        { id: "deshacer", label: "Deshacer", shortcut: "⌘Z", onSelect: undo },
        { separator: true, id: "sep2" },
        { id: "cortar", label: "Cortar", shortcut: "⌘X" },
        { id: "copiar", label: "Copiar", shortcut: "⌘C" },
        { id: "pegar", label: "Pegar", shortcut: "⌘V" },
        { separator: true, id: "sep3" },
        { id: "seleccionar-todo", label: "Seleccionar todo", shortcut: "⌘A" },
      ],
    },
    {
      id: "imagen",
      label: "Imagen",
      items: [
        { id: "importar-imagen", label: "Importar Imagen...", shortcut: "", onSelect: handleUploadImage },
      ],
    },
    {
      id: "ver",
      label: "Ver",
      items: [
        { id: "capas", label: "Capas...", shortcut: "", onSelect: () => setOpenDrawer(a => !a) },
      ],
    },
  ];

  // ==== Cambio de fuente “actual” (para nuevos textos) ====
  async function handleFontChange(family: string, opts?: { applyToSelection?: boolean }) {
    setFontFamily(family); // fuente “por defecto” para textos nuevos

    const newFont = await ensureFontAsync(family, fonts, fontCacheRef.current, pendingLoadsRef.current);
    if (!newFont) {
      setStatus(`No pude cargar: ${family}`);
      return;
    }

    // ¿Hay textos seleccionados?
    const selectedTextIds = selectedIds.filter(id => {
      const s = strokes.find(st => st.id === id);
      return s && s.type === "text" && !s.locked;
    });

    const shouldApply = opts?.applyToSelection ?? (selectedTextIds.length > 0);

    if (shouldApply && selectedTextIds.length) {
      setStrokes(prev => prev.map(s => {
        if (s.type !== "text" || !selectedTextIds.includes(s.id)) return s;

        const ts = s as TextStroke;
        // fuente anterior (si no está en cache, no compensamos posición)
        const oldFont = fontCacheRef.current.get(ts.fontFamily);
        if (!oldFont) return { ...ts, fontFamily: family };

        // Mantener la esquina superior-izquierda: compensar x/y por diferencia de bbox
        const b0 = boundsWithFont(ts, oldFont);
        const tsNew: TextStroke = { ...ts, fontFamily: family };
        const b1 = boundsWithFont(tsNew, newFont);

        if (b0 && b1) {
          const dx = b0.x - b1.x;
          const dy = b0.y - b1.y;
          return { ...tsNew, x: tsNew.x + dx, y: tsNew.y + dy };
        }
        return tsNew;
      }));
      setStatus(`Fuente aplicada a selección: ${family}`);
    } else {
      setStatus(`Fuente activa: ${family}`);
    }

    drawPreview();
  }


  // ==== Redibujo ====
  useEffect(() => { drawPreview(); }, [strokes, bg]);

  function getCtx(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context");
    return ctx;
  }

  const setDragOff = () => {
    dragDepthRef.current = 0;
    setDragActive(false);
  };

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
      if (s.type === "eraser") { offctx.globalCompositeOperation="destination-out"; drawEraser(offctx, s); offctx.globalCompositeOperation="source-over"; }
      else if (s.type === "pen") drawPen(offctx, s);
      else if (s.type === "shape") drawShape(offctx, s as ShapeStroke);   // <---
      else if (s.type === "svg") drawSVG(offctx, s as SvgStroke);
      else if (s.type === "text") drawText(offctx, s as TextStroke);
    }
    offctx.restore();

    // Pegar en principal
    ctx.drawImage(off, 0, 0);

    // (Opcional) dibujar cajas de selección
    if (selectedIds.length) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.strokeStyle = "#0af";
      ctx.setLineDash([4, 4]);
      for (const id of selectedIds) {
        const s = strokes.find(st => st.id === id);
        if (!s) continue;
        const b = getStrokeBounds(s);
        if (!b) continue;
        // caja
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        // handles
        const hs = handleRects(b, dpr);
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#0af";
        for (const h of Object.values(hs)) {
          ctx.fillRect(h.x, h.y, h.w, h.h);
          ctx.strokeRect(h.x, h.y, h.w, h.h);
        }
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
    let started = false;
    for (const pt of s.points) {
      if (isBreak(pt)) { started = false; continue; }
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else { ctx.lineTo(pt.x, pt.y); }
    }
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
  function drawShape(ctx: CanvasRenderingContext2D, s: ShapeStroke) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = s.strokeWidth;
    ctx.strokeStyle = s.stroke;
    const doFill = s.fill !== "none";
    if (doFill) ctx.fillStyle = s.fill;

    if (s.kind === "rect") {
      const x = s.w >= 0 ? s.x : s.x + s.w;
      const y = s.h >= 0 ? s.y : s.y + s.h;
      const w = Math.abs(s.w), h = Math.abs(s.h);
      const r = Math.max(0, Math.min(s.rx ?? 0, Math.min(w, h)/2));
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(x, y, w, h, r);
      } else {
        // fallback simple sin esquinas redondas
        ctx.rect(x, y, w, h);
      }
      if (doFill) ctx.fill();
      if (s.strokeWidth > 0) ctx.stroke();
    } else if (s.kind === "ellipse") {
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      const rx = Math.abs(s.w / 2);
      const ry = Math.abs(s.h / 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (doFill) ctx.fill();
      if (s.strokeWidth > 0) ctx.stroke();
    } else if (s.kind === "line") {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.w, s.y + s.h);
      // llenar línea no aplica; solo stroke
      if (s.strokeWidth > 0) ctx.stroke();
    }
    ctx.restore();
  }

  function drawText(ctx: CanvasRenderingContext2D, s: TextStroke) {
    const f = ensureFont(s.fontFamily, fonts, fontCacheRef.current, pendingLoadsRef.current, setStatus, drawPreview);
    if (!f) return; // aún cargando

    const lines = (s.text || "").split("\n").map(l => l.length ? l : " ");
    let y = s.y;

    ctx.save();
    // (rotación/alineado básico; puedes ampliar)
    for (const line of lines) {
      const x = s.x + alignShiftX(f, line, s.size, s.align);
      const p = f.getPath(line, x, y, s.size);
      p.fill = s.fill;
      p.stroke = null;
      p.draw(ctx);
      y += s.size * s.lineHeight;
    }
    ctx.restore();
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
      const h = s.size / 2;
      return { x: minX - h, y: minY - h, w: (maxX - minX) + 2*h, h: (maxY - minY) + 2*h };
    } else if (s.type === "shape") {
      if (s.kind === "line") {
        const x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
        const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
        const h = s.strokeWidth / 2;
        return { x: minX - h, y: minY - h, w: (maxX - minX) + 2*h, h: (maxY - minY) + 2*h };
      }
      const x = s.w >= 0 ? s.x : s.x + s.w;
      const y = s.h >= 0 ? s.y : s.y + s.h;
      return { x, y, w: Math.abs(s.w), h: Math.abs(s.h) };
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
      } else if (s.type === "shape") {
        const c = document.createElement("canvas");
        const ctx = c.getContext("2d")!;
        const path = new Path2D();

        if (s.kind === "rect") {
          const x = s.w >= 0 ? s.x : s.x + s.w;
          const y = s.h >= 0 ? s.y : s.y + s.h;
          const w = Math.abs(s.w), h = Math.abs(s.h);
          path.rect(x, y, w, h);
          // hit en relleno o stroke
          if (s.fill !== "none" && ctx.isPointInPath(path, pt.x, pt.y)) return s.id;
          ctx.lineWidth = (s.strokeWidth || 0) + 4;
          if (ctx.isPointInStroke(path, pt.x, pt.y)) return s.id;
        } else if (s.kind === "ellipse") {
          const cx = s.x + s.w/2, cy = s.y + s.h/2;
          const rx = Math.abs(s.w/2), ry = Math.abs(s.h/2);
          // normaliza punto a coords unitarias y comprueba dentro de elipse
          const dx = (pt.x - cx) / rx, dy = (pt.y - cy) / ry;
          const inside = (dx*dx + dy*dy) <= 1;
          if (s.fill !== "none" && inside) return s.id;
          // stroke approx: margen por ancho
          const m = (s.strokeWidth || 0) / Math.max(rx, ry);
          const insideOuter = ((pt.x - cx)/(rx + m))**2 + ((pt.y - cy)/(ry + m))**2 <= 1;
          const insideInner = ((pt.x - cx)/(Math.max(1, rx - m)))**2 + ((pt.y - cy)/(Math.max(1, ry - m)))**2 <= 1;
          if (insideOuter && !insideInner) return s.id;
        } else if (s.kind === "line") {
          const d = new Path2D(`M ${s.x} ${s.y} L ${s.x + s.w} ${s.y + s.h}`);
          ctx.lineWidth = (s.strokeWidth || 1) + 4;
          if (ctx.isPointInStroke(d, pt.x, pt.y)) return s.id;
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
        ctx.lineWidth = s.size + 4;
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

    if (tool === "shape") {
      const s: ShapeStroke = {
        id: uid(),
        type: "shape",
        z: getMaxZ(strokes) + 1,
        visible: true,
        locked: false,
        kind: shapeKind,
        x: p.x, y: p.y,
        w: 0, h: 0,
        fill: shapeHasFill ? shapeFill : "none",
        stroke: shapeStroke,
        strokeWidth: shapeStrokeWidth,
        rx: shapeKind === "rect" ? shapeRadius : undefined,
      };
      creatingShapeRef.current = s;
      setStrokes(prev => [...prev, s]);
      setSelectedIds([s.id]);
      drawPreview();
      return;
    }

    if (tool === "pen") {
      setStrokes(prev => {
        const arr = [...prev];

        // intenta reusar el pen activo
        let s = currentPenIdRef.current
          ? (arr.find(st => st.id === currentPenIdRef.current) as PenStroke | undefined)
          : undefined;

        const canReuse =
          s && s.type === "pen" && s.color === penColor && s.size === penSize;

        if (!canReuse) {
          // crea uno nuevo
          s = {
            id: uid(),
            type: "pen",
            z: getMaxZ(arr) + 1,
            visible: true,
            locked: false,
            color: penColor,
            size: penSize,
            points: [],
          } as PenStroke;
          arr.push(s);
          currentPenIdRef.current = s.id;
        }

        // separador para NO unir con el segmento anterior
        if (s!.points.length && !isBreak(s!.points[s!.points.length - 1])) {
          s!.points.push(BREAK);
        }
        s!.points.push(p);

        drawingRef.current = s!;   // guarda referencia para el move
        return arr;
      });
      drawPreview();
      return;
    }

    if (tool === "eraser") {
      // (Comportamiento igual que antes; si quieres, puedes hacer la misma reutilización que con pen)
      let z = nextZ;
      if (e.shiftKey && selectedIds.length) {
        const target = strokes.find(s => s.id === selectedIds[0]);
        if (target) z = target.z - 0.5;
      }
      const s = {
        id: uid(),
        type: "eraser",
        z,
        visible: true,
        locked: false,
        color: penColor,
        size: penSize,
        points: [p],
      } as EraserStroke;

      drawingRef.current = s;
      setStrokes(prev => normalizeZ([...prev, s]));
      drawPreview();
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
      const f = ensureFont(fontFamily, fonts, fontCacheRef.current, pendingLoadsRef.current, setStatus, drawPreview);
      setStrokes(prev => [...prev, textStroke]);
      setSelectedIds([textStroke.id]);
      drawPreview();

      setTool("select");
      // Posicionar overlay input
      const wrap = wrapRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.clientWidth / canvas.width;
      const scaleY = canvas.clientHeight / canvas.height;
      const w = (() => {
        if (!f) return 240;
        const lines = textStroke.text.split("\n");
        let maxW = 0;
        for (const line of lines) {
          const p = f.getPath(line, 0, 0, textStroke.size);
          const b = p.getBoundingBox();
          maxW = Math.max(maxW, (b.x2 - b.x1) || 0);
        }
        return Math.max(160, maxW) * scaleX;
      })();
      setEditing({
        id: textStroke.id,
        value: textStroke.text,
        left: (rect.left + (textStroke.x * scaleX)) - wrap.getBoundingClientRect().left,
        top:  (rect.top  + (textStroke.y * scaleY) - textStroke.size * scaleY), // por encima de la baseline
        width: w,
      });
      return;
    }

    // 3) SELECT: primero mira si estás sobre UN HANDLE del elemento ya seleccionado
    if (tool === "select") {
      const selId = selectedIds[0] ?? null;
      if (selId) {
        const s = strokes.find(st => st.id === selId);
        const b = s ? getStrokeBounds(s) : null;
        if (s && b) {
          const dpr = window.devicePixelRatio || 1;
          const hs = handleRects(b, dpr);
          const hitHandle =
            pointInRect(p, hs.nw) ? "nw" :
            pointInRect(p, hs.ne) ? "ne" :
            pointInRect(p, hs.sw) ? "sw" :
            pointInRect(p, hs.se) ? "se" : null;
          if (hitHandle) {
            // ← SOLO si realmente tocaste un handle, entra a resize
            resizingRef.current = {
              id: s.id,
              handle: hitHandle,
              startPt: p,
              startBBox: b,
              startStroke: JSON.parse(JSON.stringify(s)) as Stroke,
            };
            return; // ¡ojo! salimos aquí SOLO si era un handle
          }
        }
      }

      // 4) Si no tocaste handle: hit-test normal para seleccionar y comenzar drag
      const id = hitTest(p);
      if (id) {
        setSelectedIds([id]);
        draggingRef.current = { id, last: p };
      } else {
        setSelectedIds([]);
      }
      return;
    }
  }


  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;

    // =========================
    // RESIZE activo
    // =========================
    if (resizingRef.current) {
      const r = resizingRef.current;
      const p = getCanvasPos(e.currentTarget, e);
      const { startBBox: b, startStroke: s0, handle } = r;

      // ancla = esquina opuesta al handle (para todos los tipos que usan bbox)
      let ax: number, ay: number;
      if (handle === "nw") { ax = b.x + b.w; ay = b.y + b.h; }
      else if (handle === "ne") { ax = b.x; ay = b.y + b.h; }
      else if (handle === "sw") { ax = b.x + b.w; ay = b.y; }
      else { /* se */ ax = b.x; ay = b.y; }

      // tamaño nuevo uniformemente (mantén proporción)
      const newW = Math.max(2, Math.abs(p.x - ax));
      const newH = Math.max(2, Math.abs(p.y - ay));
      const f = Math.max(0.01, Math.min(newW / Math.max(1,b.w), newH / Math.max(1,b.h))); // factor

      setStrokes(prev => prev.map(st => {
        if (st.id !== r.id) return st;

        // ---------------- SVG ----------------
        if (st.type === "svg") {
          const sv0 = s0 as SvgStroke;
          const sv: SvgStroke = { ...(st as SvgStroke), scale: Math.max(0.01, sv0.scale * f) };
          const w2 = b.w * f, h2 = b.h * f;
          let nx: number, ny: number;
          if (handle === "nw") { nx = ax - w2; ny = ay - h2; }
          else if (handle === "ne") { nx = ax; ny = ay - h2; }
          else if (handle === "sw") { nx = ax - w2; ny = ay; }
          else { /* se */ nx = ax; ny = ay; }
          sv.x = nx; sv.y = ny;
          return sv;
        }

        // ---------------- TEXT ----------------
        if (st.type === "text") {
          const ts0 = s0 as TextStroke;
          let cand: TextStroke = { ...(st as TextStroke), size: Math.max(1, ts0.size * f) };
          // bbox con x/y temporales
          const bTmp = getStrokeBounds(cand)!;

          // bbox deseado con ancla fija
          const w2 = b.w * f, h2 = b.h * f;
          let targetX: number, targetY: number;
          if (handle === "nw") { targetX = ax - w2; targetY = ay - h2; }
          else if (handle === "ne") { targetX = ax; targetY = ay - h2; }
          else if (handle === "sw") { targetX = ax - w2; targetY = ay; }
          else { /* se */           targetX = ax;       targetY = ay; }

          // desplaza para alinear bbox.tmp a bbox.target
          const dx = targetX - bTmp.x;
          const dy = targetY - bTmp.y;
          cand = { ...cand, x: (cand.x + dx), y: (cand.y + dy) };
          return cand;
        }

        // ---------------- SHAPE (rect / ellipse / line) ----------------
        if (st.type === "shape") {
          const sh0 = s0 as ShapeStroke;

          // ancla opuesta a la esquina que estás arrastrando
          let ax:number, ay:number;
          if (handle === "nw") { ax = b.x + b.w; ay = b.y + b.h; }
          else if (handle === "ne") { ax = b.x; ay = b.y + b.h; }
          else if (handle === "sw") { ax = b.x + b.w; ay = b.y; }
          else { ax = b.x; ay = b.y; } // 'se'

          // tamaños “libres”
          let newW = Math.max(2, Math.abs(p.x - ax));
          let newH = Math.max(2, Math.abs(p.y - ay));

          // Si SHIFT y tipo rect/ellipse => cuadrar manteniendo proporción 1:1
          if ((sh0.kind === "rect" || sh0.kind === "ellipse") && e.shiftKey) {
            const m = Math.min(newW, newH);
            newW = m;
            newH = m;
          }

          // coloca la caja con la esquina ancla fija
          let nx:number, ny:number;
          if (handle === "nw") { nx = ax - newW; ny = ay - newH; }
          else if (handle === "ne") { nx = ax; ny = ay - newH; }
          else if (handle === "sw") { nx = ax - newW; ny = ay; }
          else { nx = ax; ny = ay; }

          // conserva el signo original de w/h (dirección)
          return {
            ...(st as ShapeStroke),
            x: nx,
            y: ny,
            w: newW * ((st as ShapeStroke).w < 0 ? -1 : 1),
            h: newH * ((st as ShapeStroke).h < 0 ? -1 : 1),
          };
        }

        // otros tipos sin resize
        return st;
      }));

      drawPreview();
      return;
    }

    // =========================
    // Redimensionando al crear la forma (drag inicial)
    // =========================
    if (creatingShapeRef.current) {
      const p = getCanvasPos(canvas, e);
      setStrokes(prev => prev.map(st => {
        if (st.id !== creatingShapeRef.current!.id) return st;
        const s = st as ShapeStroke;

        // delta “libre”
        let w = p.x - s.x;
        let h = p.y - s.y;

        // Si es rect/ellipse y SHIFT está presionado => cuadrar
        if ((s.kind === "rect" || s.kind === "ellipse") && e.shiftKey) {
          const m = Math.min(Math.abs(w), Math.abs(h)) || 0;
          const sx = w >= 0 ? 1 : -1;
          const sy = h >= 0 ? 1 : -1;
          w = m * sx;
          h = m * sy;
        }

        return { ...s, w, h };
      }));
      drawPreview();
      return;
    }

    // =========================
    // DIBUJO ACTIVO (lápiz/goma): añadir puntos
    // =========================
    if (drawingRef.current) {
      const p = getCanvasPos(canvas, e);
      const s = drawingRef.current;
      const last = s.points[s.points.length - 1];
      if (!last || last.x !== p.x || last.y !== p.y) {
        s.points.push(p);        // ya está en strokes[], mutamos y repintamos
        drawPreview();
      }
      return;
    }

    // =========================
    // ARRASTRE (selección)
    // =========================
    const d = draggingRef.current;
    if (!d) return;

    const p = getCanvasPos(canvas, e);
    const dx = p.x - d.last.x;
    const dy = p.y - d.last.y;
    if (dx === 0 && dy === 0) return;

    setStrokes(prev => prev.map(s => {
      if (s.id !== d.id || s.locked) return s;

      // objetos con x/y: text, svg, shape
      if (s.type === "text" || s.type === "svg" || s.type === "shape") {
        return { ...s, x: s.x + dx, y: s.y + dy };
      }

      // polilíneas: pen / eraser
      if (s.type === "pen" || s.type === "eraser") {
        const pts = s.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }));
        return { ...s, points: pts };
      }

      return s;
    }));

    draggingRef.current = { ...d, last: p };
  }


  function onPointerUp() {
    if (resizingRef.current) {
      resizingRef.current = null;
      drawPreview();
      return;
    }

    if (creatingShapeRef.current) {
      creatingShapeRef.current = null;
      drawPreview();
      return;
    }

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
    const f = ensureFont(s.fontFamily, fonts, fontCacheRef.current, pendingLoadsRef.current, setStatus, drawPreview);
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
  function undo() {
    if (tool === "pen" && (currentPenIdRef.current || strokes.some(s => s.type === "pen"))) {
      undoLastPenSegment();
    } else {
      // fallback a tu undo global anterior
      setStrokes(s => s.slice(0, -1));
    }
  }
  function undoLastPenSegment() {
    setStrokes(prev => {
      const arr = [...prev];

      // 1) Preferir el pen "activo"
      let idx = arr.findIndex(s => s.id === currentPenIdRef.current);

      // 2) Si no hay activo, toma el ÚLTIMO pen que exista
      if (idx === -1) {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].type === "pen") { idx = i; break; }
        }
      }
      if (idx === -1) return prev; // no hay pen

      const pen = arr[idx] as PenStroke;
      if (!pen.points.length) {
        arr.splice(idx, 1);
        if (currentPenIdRef.current === pen.id) currentPenIdRef.current = null;
        return arr;
      }

      // 3) Saltar breaks al final (defensivo)
      let i = pen.points.length - 1;
      while (i >= 0 && isBreak(pen.points[i])) i--;
      if (i < 0) { // solo breaks → borra stroke
        arr.splice(idx, 1);
        if (currentPenIdRef.current === pen.id) currentPenIdRef.current = null;
        return arr;
      }

      // 4) Recortar hasta el break previo (quita el segmento final)
      let start = i;
      while (start >= 0 && !isBreak(pen.points[start])) start--;
      // mantener hasta el break (incluido), o vacío si no había breaks
      pen.points = pen.points.slice(0, start + 1);

      // 5) Limpia breaks sobrantes al final
      while (pen.points.length && isBreak(pen.points[pen.points.length - 1])) pen.points.pop();

      // 6) Si quedó vacío, elimina el stroke y resetea el activo
      if (pen.points.length === 0) {
        arr.splice(idx, 1);
        if (currentPenIdRef.current === pen.id) currentPenIdRef.current = null;
      }
      return arr;
    });
  }

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

  useEffect(() => {
    const onWindowDragLeave = (e: DragEvent) => {
      // si el puntero sale de la ventana
      const { clientX, clientY } = e;
      const out =
        clientX <= 0 || clientY <= 0 ||
        clientX >= window.innerWidth || clientY >= window.innerHeight;
      if (out) setDragOff();
    };
    const onWindowDrop = () => {
      // suelta en cualquier lado (incluyendo fuera del contenedor)
      setDragOff();
    };
    const onWindowDragEnd = () => setDragOff();

    window.addEventListener("dragleave", onWindowDragLeave);
    window.addEventListener("drop", onWindowDrop);
    window.addEventListener("dragend", onWindowDragEnd);
    return () => {
      window.removeEventListener("dragleave", onWindowDragLeave);
      window.removeEventListener("drop", onWindowDrop);
      window.removeEventListener("dragend", onWindowDragEnd);
    };
  }, []);

  
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

  function getDropCanvasPos(e: React.DragEvent) {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width;
    const sy = canvas.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    // Si realmente salimos del contenedor (no a un hijo), decrementa
    // Nota: relatedTarget puede venir null en arrastres desde el SO
    if (!e.currentTarget || (e as any).relatedTarget === null || 
        !(e.currentTarget as Element).contains((e as any).relatedTarget as Node)) {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragActive(false);
    }
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOff();
    setDragActive(false);
    const { x, y } = getDropCanvasPos(e);
    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      if (isFontFile(file)) {
        try {
          const buf = await file.arrayBuffer();
          const f = opentype.parse(buf);
          const name = f.names.fullName?.en || file.name.replace(/\.(ttf|otf)$/i, "");
          fontCacheRef.current.set(name, f);
          setFonts(prev => [[name, ""], ...prev]);
          setFontFamily(name);
          setStatus(`Fuente cargada: ${name}`);
          setTool("text");
        } catch (err: any) {
          setStatus("No pude parsear el TTF/OTF: " + (err?.message || err));
        }
        continue;
      }

      if (isSvgFile(file)) {
        const txt = await file.text();
        const meta = parseSVGMeta(txt);
        const iw = meta.width ?? meta.vbW ?? 100;
        const ih = meta.height ?? meta.vbH ?? 100;

        const s: SvgStroke = {
          id: uid(),
          type: "svg",
          z: getMaxZ(strokes) + 1,
          visible: true,
          locked: false,
          svg: txt,
          x, y,
          scale: 1,
          rotation: 0,
          iw, ih,
        };
        setStrokes(prev => [...prev, s]);
        setSelectedIds([s.id]);
        continue;
      }

      setStatus(`Tipo no soportado: ${file.name}`);
    }

    drawPreview();
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

  function penToPathD(s: PenStroke) {
    let d = "";
    let started = false;
    for (const pt of s.points) {
      if (isBreak(pt)) { started = false; continue; }
      if (!started) { d += (d ? " " : "") + `M ${pt.x} ${pt.y}`; started = true; }
      else { d += ` L ${pt.x} ${pt.y}`; }
    }
    return d;
  }


  // ==== Exportar SVG con máscara (respeta goma) ====
  function exportSVG({ eraseBackgroundToo = false }: { eraseBackgroundToo?: boolean } = {}) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sorted = [...strokes].filter(s => s.visible !== false).sort((a, b) => a.z - b.z);

    // ---- PASO 1: calcular bounds (solo contenido visible, sin goma)
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    const pushBounds = (x1:number,y1:number,x2:number,y2:number) => {
      xMin = Math.min(xMin, x1); yMin = Math.min(yMin, y1);
      xMax = Math.max(xMax, x2); yMax = Math.max(yMax, y2);
    };

    for (const s of sorted) {
      if (s.type === "pen") {
        if (s.points.length < 2) continue;
        let minX = s.points[0].x, minY = s.points[0].y, maxX = minX, maxY = minY;
        for (let i = 1; i < s.points.length; i++) {
          const p = s.points[i];
          if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
        }
        const h = s.size / 2;
        pushBounds(minX - h, minY - h, maxX + h, maxY + h);
      }
      if (s.type === "text") {
        const f = fontCacheRef.current.get(s.fontFamily);
        if (!f) continue;
        const lines = (s.text || "").split("\n").map(l => l || " ");
        let y = s.y;
        for (const line of lines) {
          const x = s.x + alignShiftX(f, line, s.size, s.align);
          const p = f.getPath(line, x, y, s.size);
          const b = p.getBoundingBox();
          pushBounds(b.x1, b.y1, b.x2, b.y2);
          y += s.size * s.lineHeight;
        }
      }
      if (s.type === "svg") {
        const w = (s.iw ?? 100) * (s.scale ?? 1);
        const h = (s.ih ?? 100) * (s.scale ?? 1);
        pushBounds(s.x, s.y, s.x + w, s.y + h);
      }
      if (s.type === "shape") {
        const sh = s as ShapeStroke;
        if (sh.kind === "line") {
          const x1 = sh.x,       y1 = sh.y;
          const x2 = sh.x+sh.w,  y2 = sh.y+sh.h;
          const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
          const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
          const h = (sh.strokeWidth || 0) / 2 + AA_MARGIN;
          pushBounds(minX - h, minY - h, maxX + h, maxY + h);
        } else {
          // rect / ellipse usan bbox con posible w/h negativos
          const x = sh.w >= 0 ? sh.x : sh.x + sh.w;
          const y = sh.h >= 0 ? sh.y : sh.y + sh.h;
          const w = Math.abs(sh.w);
          const h = Math.abs(sh.h);
          const pad = (sh.strokeWidth || 0) / 2 + AA_MARGIN;
          pushBounds(x - pad, y - pad, x + w + pad, y + h + pad);
        }
      }
    }

    if (!isFinite(xMin) || !isFinite(yMin) || !isFinite(xMax) || !isFinite(yMax)) {
      alert("No hay contenido visible para exportar.");
      return;
    }

    const vbW = Math.max(1, Math.ceil(xMax - xMin));
    const vbH = Math.max(1, Math.ceil(yMax - yMin));
    const T = `transform="translate(${-xMin},${-yMin})"`;

    // ---- PASO 2: strings en orden de z
    const contentEls: string[] = [];
    const eraserMask: string[] = [];

    for (const s of sorted) {
      if (s.type === "pen") {
        const d = penToPathD(s);
        contentEls.push(
          `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`
        );
        continue;
      }

      if (s.type === "text") {
        const f = fontCacheRef.current.get(s.fontFamily);
        if (!f) continue;
        const lines = (s.text || "").split("\n").map(l => l || " ");
        let y = s.y;
        for (const line of lines) {
          const x = s.x + alignShiftX(f, line, s.size, s.align);
          const p = f.getPath(line, x, y, s.size);
          contentEls.push(`<path d="${p.toPathData(3)}" fill="${s.fill}"/>`);
          y += s.size * s.lineHeight;
        }
        continue;
      }

      if (s.type === "svg") {
        const inner = extractSvgInner(s.svg);              // <- sin prolog/doctype/comments
        const vbX = s.vbX ?? 0, vbY = s.vbY ?? 0;
        const rot = s.rotation ? ` rotate(${(s.rotation * 180 / Math.PI).toFixed(3)})` : "";
        // IMPORTANTE: usa coordenadas ABSOLUTAS aquí; el grupo exterior ya tiene T = translate(-xMin,-yMin)
        contentEls.push(
          `    <g transform="translate(${s.x},${s.y}) scale(${s.scale})${rot} translate(${-vbX},${-vbY})">\n` +
          `      ${inner}\n` +
          `    </g>`
        );
        continue;
      }

      if (s.type === "shape") {
        const sh = s as ShapeStroke;
        // OJO: aquí NO restes xMin/yMin; ya lo hace el <g ${T}> padre
        if (sh.kind === "rect") {
          const x = sh.w >= 0 ? sh.x : sh.x + sh.w;
          const y = sh.h >= 0 ? sh.y : sh.y + sh.h;
          const w = Math.abs(sh.w), h = Math.abs(sh.h);
          const rx = Math.max(0, Math.min(sh.rx ?? 0, Math.min(w, h)/2));
          contentEls.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${h}"` +
            (rx ? ` rx="${rx}" ry="${rx}"` : ``) +
            ` fill="${sh.fill === "none" ? "none" : sh.fill}" stroke="${sh.stroke}" stroke-width="${sh.strokeWidth}"/>`
          );
        } else if (sh.kind === "ellipse") {
          const cx = sh.x + sh.w/2, cy = sh.y + sh.h/2;
          const rx = Math.abs(sh.w/2), ry = Math.abs(sh.h/2);
          contentEls.push(
            `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${sh.fill === "none" ? "none" : sh.fill}" stroke="${sh.stroke}" stroke-width="${sh.strokeWidth}"/>`
          );
        } else if (sh.kind === "line") {
          contentEls.push(
            `<line x1="${sh.x}" y1="${sh.y}" x2="${sh.x + sh.w}" y2="${sh.y + sh.h}" stroke="${sh.stroke}" stroke-width="${sh.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
          );
        }
        continue;
      }

      if (s.type === "eraser") {
        if (s.points.length < 2) continue;
        let d = `M ${s.points[0].x} ${s.points[0].y}`;
        for (let i = 1; i < s.points.length; i++) {
          const p = s.points[i];
          d += ` L ${p.x} ${p.y}`;
        }
        eraserMask.push(
          `<path d="${d}" fill="none" stroke="black" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>`
        );
        continue;
      }
    }

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
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  ${mask}
  ${maskedOpen}
  ${contentEls.join("\n")}
      </g>
    </g>
  </svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "text-to.svg";
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
        setTool("text");
        drawPreview();
      } catch (err: any) {
        setStatus("No pude parsear el TTF/OTF: " + (err?.message || err));
      }
    });
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

  function handleUploadImage() {
    document.getElementById("uploadImageInputFile")?.click();
  }

  function handleRects(b: {x:number;y:number;w:number;h:number}, dpr=1) {
    const s = 8 * dpr; // tamaño del handle en px canvas
    return {
      nw: { x: b.x - s/2,         y: b.y - s/2,         w: s, h: s },
      ne: { x: b.x + b.w - s/2,   y: b.y - s/2,         w: s, h: s },
      sw: { x: b.x - s/2,         y: b.y + b.h - s/2,   w: s, h: s },
      se: { x: b.x + b.w - s/2,   y: b.y + b.h - s/2,   w: s, h: s },
    } as const;
  }

  function pointInRect(p: Pt, r: {x:number;y:number;w:number;h:number}) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function updateSelectedPatch<P>(
    value: P,
    setLocal: (v: P) => void,
    opts: {
      types?: StrokeType[];
      patch: (s: Stroke, v: P) => Partial<Stroke>; // devuelve el “parche” por stroke
      draw?: boolean;
    }
  ) {
    const { types, patch } = opts;
    setLocal(value);

    setStrokes(prev => {
      const next = prev.map(s => {
        if (!selectedIds.includes(s.id)) return s;
        if (types && !types.includes(s.type)) return s;

        const p = patch(s, value) || {};
        const keys = Object.keys(p) as (keyof Stroke)[];
        if (!keys.length) return s;

        let changed = false;
        for (const k of keys) {
          if (s[k] !== p[k]) { changed = true; break; }
        }
        if (!changed) return s;

        return { ...s, ...p } as Stroke;
      });
      return next;
    });
  }


  // ==== JSX ====
  return (
    <div className="w-full h-dvh max-w-6xl mx-auto p-2 grid gap-1 grid-rows-[auto_1fr_auto]">
      <input id="uploadImageInputFile" type="file" className="hidden" accept=".svg" onChange={onUploadSVG} />
      <div>
        <div className="grid grid-cols-1 gap-1">
          <div className="flex w-full">
            <h1>
              <img src="/favicon.svg" className="w-8" alt="Editor Text + Dibujo → SVG" />
              <span className="hidden">Editor Text + Dibujo → SVG</span>
            </h1>
            <div className="flex-grow ml-4">
              <ClassicMenuBar
                menus={menus}
                onAction={(menuId, itemId) => {
                  // Replace this with your logic
                  console.log(`Action: ${menuId} -> ${itemId}`);
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1 mb-2">

            { tool === "text" && (
              <>
                <div className="w-full max-w-32 sm:max-w-xs">
                  <Label>Fuente</Label>
                  <KCmdKModal
                    title="Fuente (Google Fonts)"
                    label={fontFamily || "Fuente"}
                    fonts={fonts}
                    handleFontChange={(f) => { handleFontChange(f); }}
                    onUploadTTF={onUploadTTF}
                    API_KEY={API_KEY}
                  />
                </div>

                <div className="w-14 sm:w-auto">
                  <Label>Height</Label>
                  <input
                    type="number"
                    step="0.05"
                    className="w-full p-2 rounded-lg border border-neutral-300"
                    min={0.8}
                    max={3}
                    value={lineHeight}
                    onChange={(e) => updateSelectedPatch(+e.target.value || 1.2, setLineHeight, { 
                      types: ["text"],
                      patch: (_s, v) => ({ lineHeight: v }),
                    })}
                  />
                </div>

                <div className="w-14 sm:w-auto">
                  <Label>Color</Label>
                  <div className="relative flex items-center gap-2">
                    <FillPicker
                      label="Color de texto"
                      value={fill}
                      onChange={(v) => updateSelectedPatch(v, setFill, { 
                        types: ["text"],
                        patch: (_s, v) => ({ fill: v }),
                      })}
                    />
                    <span className="hidden sm:block text-xs text-neutral-500">{shapeStroke}</span>
                  </div>
                </div>
              </>
            )}

            { (tool === "pen" || tool === "eraser") && (
              <>
                <div className="w-14 sm:w-auto">
                  <Label>Color</Label>
                  <div className="relative flex items-center gap-2">
                    <FillPicker
                      label="Pencil Color"
                      value={penColor}
                      onChange={(v) => updateSelectedPatch(v, setPenColor, { 
                        types: ["pen"],
                        patch: (_s, v) => ({ color: v }),
                      })}
                      placement="bottom-right"
                    />
                    <span className="hidden sm:block text-xs text-neutral-500">{shapeStroke}</span>
                  </div>
                </div>

                <div>
                  <Label>Pencil Width</Label>
                  <BrushSizeSelect
                    value={penSize}
                    color={penColor}
                    onChange={(v) => updateSelectedPatch(v, setPenSize, { 
                      types: ["pen"],
                      patch: (_s, v) => ({ size: v }),
                    })}
                    className="w-44"
                  />
                </div>
              </>
            )}

            { tool === "select" && (
              <div>
                <Label>Herramientas de selección</Label>
                <div className="flex items-center gap-2 h-11">
                  <IconButton
                    title="Traer al frente"
                    ariaLabel="Traer al frente"
                    onClick={() => bringToFront(selectedIds)}
                    disabled={!selectedIds.length}
                  >
                    <LayerUpIcon className="size-6" />
                  </IconButton>

                  <IconButton
                    title="Enviar al fondo"
                    ariaLabel="Enviar al fondo"
                    onClick={() => sendToBack(selectedIds)}
                    disabled={!selectedIds.length}
                  >
                    <LayerDownIcon className="size-6" />
                  </IconButton>

                  <IconButton
                    title="Subir una capa"
                    ariaLabel="Subir una capa"
                    onClick={() => bringForward(selectedIds)}
                    disabled={!selectedIds.length}
                  >
                    <SortAmountUpIcon className="size-6" />
                  </IconButton>

                  <IconButton
                    title="Bajar una capa"
                    ariaLabel="Bajar una capa"
                    onClick={() => sendBackward(selectedIds)}
                    disabled={!selectedIds.length}
                  >
                    <SortAmountDownIcon className="size-6" />
                  </IconButton>

                  <IconButton
                    title="Eliminar"
                    ariaLabel="Eliminar"
                    variant="danger"
                    onClick={deleteSelected}
                    disabled={!selectedIds.length}
                  >
                    <TrashIcon className="size-6" />
                  </IconButton>
                </div>
              </div>

            )}

            { (tool === "shape") && (
              <>
                <div className="w-28 sm:w-auto">
                  <Label>Tipo</Label>
                  <select
                    className="w-full p-2 rounded-lg border border-neutral-300"
                    value={shapeKind}
                    onChange={e => setShapeKind(e.target.value as ShapeKind)}
                  >
                    <option value="rect">Rectángulo</option>
                    <option value="ellipse">Elipse</option>
                    <option value="line">Línea</option>
                  </select>
                </div>
                {shapeKind === "rect" && (
                  <div className="w-14">
                    <Label>Radio</Label>
                    <Radius
                      value={shapeRadius}
                      onChange={setShapeRadius}
                      min={0}
                      max={128}        // ajusta si quieres otro rango
                      step={1}
                      placement="bottom"  // "top" | "left" | "right"
                      disabled={shapeKind !== "rect"}  // solo aplica a rectángulos
                    />
                  </div>
                )}
                {shapeKind !== "line" && (
                  <div>
                    <Label>Relleno</Label>
                    <div className="relative flex items-center gap-2">
                      <FillPicker
                        label="Relleno"
                        value={shapeFill}
                        onChange={setShapeFill}
                        hasFill={shapeHasFill}
                        onHasFillChange={setShapeHasFill}
                        placement="bottom"
                      />
                      <span className="hidden sm:block text-xs text-neutral-500">{shapeHasFill ? shapeFill : "Sin relleno"}</span>
                    </div>
                  </div>
                )}

                <div className="w-14 sm:w-auto">
                  <Label>Borde</Label>
                  <div className="relative flex items-center gap-2">
                    <FillPicker
                      label="Borde"
                      value={shapeStroke}
                      onChange={setShapeStroke}
                    />
                    <span className="hidden sm:block text-xs text-neutral-500">{shapeStroke}</span>
                  </div>
                </div>

                <div className="w-14 sm:w-auto">
                  <Label>Grosor</Label>
                  <div className="relative flex items-center gap-2">
                    <StrokeWidth
                      value={shapeStrokeWidth}
                      onChange={setShapeStrokeWidth}
                      min={0}
                      max={64}
                      step={1}
                      placement="bottom"   // "top" | "left" | "right"
                    />
                    <span className="hidden sm:block text-xs text-neutral-500">{shapeStrokeWidth}px</span>
                  </div>
                </div>
              </>
            )}

            <div className="hidden md:block ml-auto">
              <Label>&nbsp;</Label>
              <div className="flex items-center gap-2">
                <Drawer.Root direction="right" open={openDrawer} onOpenChange={setOpenDrawer}>
                  <Drawer.Trigger className="w-14 h-10 rounded-lg border shadow-sm p-0 flex items-center justify-center hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-600 bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50 ">
                    <LayerIcon className="inline size-6" />
                  </Drawer.Trigger>
                  <Drawer.Portal>
                    <Drawer.Content
                      className="right-2 top-2 bottom-2 fixed z-10 outline-none w-[310px] flex"
                      style={{ '--initial-transform': 'calc(100% + 8px)' } as React.CSSProperties}
                    >
                      <div className="bg-zinc-50 h-full w-full grow p-5 flex flex-col rounded-[16px]">
                        <div className="flex flex-col h-full max-w-md mx-auto">
                          <Drawer.Title className="font-medium mb-2 text-zinc-900">
                            Capas y elementos del lienzo
                          </Drawer.Title>
                          <Drawer.Description className="text-zinc-600 mb-2">
                            Aquí puedes ver y gestionar todos los elementos del lienzo.
                          </Drawer.Description>
                          <ul className="flex-1 overflow-y-auto">
                            {strokes.length === 0 && (
                              <li className="text-sm text-zinc-500 italic">No hay elementos</li>
                            )}
                            {strokes.slice().sort((a,b)=>b.z - a.z).map(s => (
                              <li key={s.id} className={`flex items-center justify-between mb-1 p-2 rounded hover:bg-zinc-100 ${selectedIds.includes(s.id) ? 'bg-zinc-200' : ''}`}>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(s.id)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setSelectedIds(prev => {
                                        if (checked) {
                                          return [...prev, s.id];
                                        } else {
                                          return prev.filter(id => id !== s.id);
                                        }
                                      });
                                    }}
                                  />
                                  <span className="text-sm">
                                    {s.type === "text" && (
                                      <>
                                        <TextIcon className="inline size-4 mr-1" />
                                        {s.text.split("\n")[0].slice(0,20) || "<vacio>"}
                                      </>
                                    )}
                                    {s.type === "pen" && (
                                      <>
                                        <PaintBrushIcon className="inline size-4 mr-1" />
                                        Dibujo
                                      </>
                                    )}
                                    {s.type === "eraser" && (
                                      <>
                                        <ErraserIcon className="inline size-4 mr-1" />
                                        Goma
                                      </>
                                    )}
                                    {s.type === "svg" && (
                                      <>
                                      <FileSVGIcon className="inline size-4 mr-1" />
                                        SVG
                                      </>
                                    )}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setStrokes(prev => prev.map(st => st.id === s.id ? { ...st, visible: !(st.visible ?? true) } : st));
                                    }}
                                    title={s.visible === false ? "Mostrar" : "Ocultar"}
                                  >
                                    {s.visible === false
                                      ? <EyeClosedIcon className="inline size-5 text-zinc-400" />
                                      : <EyeOpenIcon className="inline size-5 text-zinc-700" />
                                    }
                                  </button>
                                  <button
                                    onClick={() => {
                                      setStrokes(prev => prev.map(st => st.id === s.id ? { ...st, locked: !(st.locked ?? false) } : st));
                                    }}
                                    title={s.locked ? "Desbloquear" : "Bloquear"}
                                  >
                                    {s.locked
                                      ? <LockClosedIcon className="inline size-5 text-zinc-400" />
                                      : <LockOpenIcon className="inline size-5 text-zinc-700" />
                                    }
                                  </button>
                                </div>
                              </li>
                            ))}
                            {/* <li>
                              <pre className="col-span-full">{ JSON.stringify(strokes, null, ' ')}</pre>
                            </li> */}
                          </ul>
                        </div>
                      </div>
                    </Drawer.Content>
                    <Drawer.Overlay className="fixed inset-0 bg-black/40" />
                  </Drawer.Portal>
                </Drawer.Root>

                <IconButton
                  title="Eliminar ultima capa"
                  ariaLabel="Eliminar ultima capa"
                  onClick={undo}
                >
                  <FlipBackwardsIcon className="inline size-6" />
                </IconButton>
                <span className="w-px h-full bg-gray-400">&nbsp;</span>
                <IconButton
                  title="Descargar SVG"
                  ariaLabel="Descargar SVG"
                  className="w-20"
                  onClick={() => exportSVG({ eraseBackgroundToo: false })}
                >
                  <span className="text-sm">SVG</span>
                  <DownloadIcon className="inline size-6" />
                </IconButton>
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

      </div>

      <div className="grid grid-cols-[auto_1fr] gap-1">
        <div className="grid grid-cols-1 gap-1 place-content-start grid-rows-auto">
          <button
            type="button"
            className={`px-3 py-2 rounded-lg ${tool === "select" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
            onClick={() => setTool("select")}
          >
            <CursorIcon className="size-4 md:size-8 rotate-20" />
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg ${tool === "shape" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
            onClick={() => setTool("shape")}
          >
            {shapeKind === "rect" ? <SquareIcon className="size-4 md:size-8" />
              : shapeKind === "ellipse" ? <CircleIcon className="size-4 md:size-8" />
              : shapeKind === "line" ? <LineIcon className="size-4 md:size-8" /> : null}
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg ${tool === "text" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
            onClick={() => setTool("text")}
          >
            <TextIcon className="size-4 md:size-8" />
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-neutral-200 text-neutral-800"
            onClick={handleUploadImage}
          >
            <ImagePlusIcon className="size-4 md:size-8" />
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg ${tool === "pen" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
            onClick={() => setTool("pen")}
          >
            <PaintBrushIcon className="size-4 md:size-8" />
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-lg ${tool === "eraser" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
            onClick={() => setTool("eraser")}
          >
            <ErraserIcon className="size-4 md:size-8" />
          </button>
          <FillPicker
            label="Fondo"
            value={bg}
            onChange={setBg}
            hasFill={!transparentBG}
            onHasFillChange={(v) => setTransparentBG(!v)}
            placement="right"
            className="size-10 md:w-14 md:h-10"
          />
        </div>

        <div>

          <div
            id="result-wrap"
            ref={wrapRef}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            className="relative h-full flex rounded-2xl border border-neutral-300 bg-white shadow-sm overflow-auto overscroll-contain"
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={onDoubleClick}
              className="flex-1 max-w-full h-full min-h-48 rounded-lg touch-none"
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
            {dragActive && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-500/5 text-blue-700 text-sm">
                <p>Suelta un <b>.TTF/.OTF</b> para cargar fuente o un <b>.SVG</b> para añadir al lienzo</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-14 overflow-y-auto space-y-1">
        <p className="text-xs text-neutral-500">{status}</p>
        { tool === "text" && (
          <>
            <p className="text-xs text-neutral-500">click para crear, doble click para editar. Seleccionar: arrastra para mover. Delete para borrar.</p>
            <p className="text-xs text-neutral-500">Puedes buscar una fuente, o subir un TTF/OTF personalizado.</p>
          </>
        )}
        { tool === "select" && (
          <>
            <p className="text-xs text-neutral-500">Seleccionar: arrastra para mover. Delete para borrar.</p>
          </>
        )}
        <p className="text-xs text-neutral-500">Tip: mantén <kbd>Shift</kbd> al iniciar un trazo para insertarlo debajo de lo seleccionado.</p>
      </div>
    </div>
  );
}
