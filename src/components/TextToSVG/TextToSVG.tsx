import { useEffect, useRef, useState } from "react";
import { toast } from 'sonner'
import opentype, { Font } from "opentype.js";
import KCmdKModal from "../KCmdModal";
import { CircleIcon, CursorIcon, DownloadIcon, ErraserIcon, EyeClosedIcon, EyeOpenIcon, FileSVGIcon, FlipBackwardsIcon, ImagePlusIcon, Label, LayerDownIcon, LayerIcon, LayerUpIcon, LineIcon, LockClosedIcon, LockOpenIcon, PaintBrushIcon, PolygonIcon, SortAmountDownIcon, SortAmountUpIcon, SquareIcon, TextIcon, TrashIcon } from "../ui";
import { Drawer } from "vaul";
import ClassicMenuBar, { type Menu } from "../ClassicMenuBar";
import { BrushSizeSelect } from "../BrushSizeSelect";
import type { Tool, Pt, PenStroke, EraserStroke, TextStroke, SvgStroke, Stroke, Handle, FontGoogle, ShapeKind, ShapeStroke, StrokeType, Doc, EmbeddedFonts, PolyStroke } from "../../types/strokes";
import { ensureFont, ensureFontAsync, listFonts } from "../../utils/fontUtils";
import { isFontFile, isSvgFile } from "../../utils/fileUtils";
import { extractSvgInner, parseSVGMeta } from "../../utils/svgUtils";
import { getCanvasPos, withRotation } from "../../utils/canvasUtils";
import { alignShiftX, alignShiftXLS, boundsWithFont, degToRad, fileToDataURL, getMaxZ, normalizeZ, radToDeg, unrotatePoint } from "../../utils/helpers";
import { FillPicker } from "../FillPicker";
import { StrokeWidth } from "../StrokeWidth";
import { Radius } from "../Radius";
import { IconButton } from "../IconButton";
import ToolsContainer from "../ToolsContainer";
import { getPolyBounds, isNear } from "../../utils/polygonUtils";
import { translateStroke } from "./strokeTransforms";
import { drawPoly, drawPolySelectionOverlay, hitPoly } from "./polyStroke";

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
  const [letterSpacing, setLetterSpacing] = useState<number>(0);
  const [fill, setFill] = useState<string>("#111111");
  const [rotation, setRotation] = useState<number>(0);
  const [fontOutlineColor, setFontOutlineColor] = useState<string>("#111111");
  const [fontOutlineWidth, setFontOutlineWidth] = useState<number>(2);
  const [bg, setBg] = useState<string>("#ffffff");
  const [transparentBG, setTransparentBG] = useState<boolean>(true);
  const [status, setStatus] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);

  // Herramientas / lápiz
  const [tool, setTool] = useState<Tool>("select");
  const [penColor, setPenColor] = useState<string>("#111");
  const [penSize, setPenSize] = useState<number>(20);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rect");
  const [shapeFill, setShapeFill] = useState<string>("#09f");
  const [shapeHasFill, setShapeHasFill] = useState<boolean>(true);
  const [shapeStroke, setShapeStroke] = useState<string>("#111111");
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState<number>(2);
  const [shapeRadius, setShapeRadius] = useState<number>(12); // rect redondeado
  const creatingShapeRef = useRef<ShapeStroke | null>(null);

  // Polygon
  const polyDraftRef = useRef<{ id: string; committed: number } | null>(null);
  // <-- tolerancia para cerrar tocando el primer punto
  const CLOSE_TOL = 8;

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
    center: {x: number; y: number};
    angle: number;
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
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // si cambias de herramienta o de estilo, “cierra” el pen activo
  useEffect(() => {
    if (tool !== "pen") currentPenIdRef.current = null;
    if (tool !== "poly") polyDraftRef.current = null;
  }, [tool]);
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
        { id: "draw", label: "Pintar", shortcut: "", onSelect: drawPreview },
      ],
    },
  ];

  const isSelectedType = (types: Omit<StrokeType, 'svg'>[]) =>
      tool === "select" ? strokes.find((s) => types.includes(s.type) && selectedIds.includes(s.id)) : null;

  // ==== Cambio de fuente “actual” (para nuevos textos) ====
  async function handleFontChange(family: string, opts?: { applyToSelection?: boolean }) {
    setFontFamily(family); // fuente “por defecto” para textos nuevos

    const newFont = await ensureFontAsync(family, fonts, fontCacheRef.current, fontMetaRef.current, pendingLoadsRef.current);
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
  useEffect(() => {
    if (!fontsReady) return;
    drawPreview();
  }, [fontsReady, strokes, bg, transparentBG, lineHeight]);


  // ==== Persistencia local storage ====
  const SAVE_KEY = "text2svg:doc";
  const fontMetaRef  = useRef<Map<string, { kind:"google"|"data"; url:string }>>(new Map());

  function fontCacheToPersist(
    strokes: Stroke[],
    fontsCatalog: [string, string][] // tu `fonts` (Google Fonts) por si falta meta
  ): EmbeddedFonts {
    const used = new Set<string>();
    for (const s of strokes) {
      if (s.type === "text" && s.fontFamily) used.add(s.fontFamily);
    }

    const out: EmbeddedFonts = {};
    for (const family of used) {
      // 1) intenta meta registrada (preferido)
      const meta = fontMetaRef.current.get(family);
      if (meta) { out[family] = meta; continue; }

      // 2) intenta buscar en tu catálogo de Google Fonts (fonts: [family, url])
      const hit = fontsCatalog.find(([f]) => f === family);
      if (hit && hit[1]) {
        out[family] = { kind: "google", url: hit[1] };
        continue;
      }

      // 3) si no hay manera de obtener URL, no persistimos esa familia
      // (quedará con fallback del sistema; opcional: mostrar aviso)
    }
    return out;
  }


  async function preloadPersistedFonts(embedded: EmbeddedFonts) {
    const entries = Object.entries(embedded);
    for (const [family, meta] of entries) {
      try {
        // Evita recargar si ya está en caché
        if (fontCacheRef.current.has(family)) {
          fontMetaRef.current.set(family, meta);
          continue;
        }
        const f = await opentype.load(meta.url); // soporta data: y http(s)
        fontCacheRef.current.set(family, f);
        fontMetaRef.current.set(family, meta);
      } catch (err) {
        console.warn("No pude precargar fuente:", family, err);
      }
    }
  }

  useEffect(()=>{
    const id = setTimeout(()=>{
      const doc: Doc = {
        version:1,
        strokes,
        bg,
        transparentBG,
        embeddedFonts: fontCacheToPersist(strokes, fonts),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(doc));
    }, 200);
    return ()=>clearTimeout(id);
  }, [strokes, bg, transparentBG]);

  useEffect(()=>{
    (async() => {
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return;
      const doc = JSON.parse(raw) as Doc;
      if(doc.version!==1) return;
      setBg(doc.bg);
      setTransparentBG(doc.transparentBG);
      setStrokes(doc.strokes || []);
      if (doc.embeddedFonts) {
        // carga asíncrona; si quieres, puedes mostrar un “cargando fuentes…”
        await preloadPersistedFonts(doc.embeddedFonts);

        const names = Object.keys(doc.embeddedFonts);              // ["Inter", "Poppins", ...]
        setFonts(prev => {
          const seen = new Set(prev.map(([n]) => n));
          const add: [string, string][] = names
            .filter(n => !seen.has(n))
            // usa la URL persistida (sirve para tu picker)
            .map(n => [n, doc.embeddedFonts?.[n].url] as [string, string]);

          // las agregamos al inicio para que aparezcan primero
          return [...add, ...prev];
        });

        // 3) Selecciona la última familia embebida como activa en UI
        const name = names[names.length - 1];
        if (name) setFontFamily(name);
      }
      setFontsReady(true);
      requestAnimationFrame(() => drawPreview());
    })();
  },[]);


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

    // ---- Agrupar borradores por targetId
    type AnyStroke = typeof strokes[number];
    type Erase = Extract<AnyStroke, { type: "eraser" }>;
    const erasersByTarget = new Map<string, Erase[]>();

    for (const s of strokes) {
      if (s.visible === false || s.type !== "eraser") continue;
      const targets = s.targetIds as string[] | undefined;
      if (!Array.isArray(targets) || targets.length === 0) continue;
      for (const tid of targets) {
        if (!erasersByTarget.has(tid)) erasersByTarget.set(tid, []);
        erasersByTarget.get(tid)!.push(s as Erase);
      }
    }

    // ---- Dibuja cada elemento NO-eraser por separado, aplicando SOLO su máscara
    const drawables = [...strokes]
      .filter(s => s.visible !== false && s.type !== "eraser")
      .sort((a, b) => a.z - b.z);

    for (const s of drawables) {
      // limpiar layer
      offctx.clearRect(0, 0, off.width, off.height);

      // 1) pinta el elemento tal cual
      offctx.save();
      offctx.globalCompositeOperation = "source-over";
      if (s.type === "pen")      drawPen(offctx, s);
      else if (s.type === "shape") drawShape(offctx, s as ShapeStroke);
      else if (s.type === "poly") drawPoly(offctx, s as PolyStroke);
      else if (s.type === "svg")   drawSVG(offctx, s as SvgStroke);
      else if (s.type === "text")  drawText(offctx, s as TextStroke);
      offctx.restore();

      // 2) aplica SOLO los borradores que lo apunten
      const ers = erasersByTarget.get(s.id);
      if (ers && ers.length) {
        offctx.save();
        offctx.globalCompositeOperation = "destination-out";
        offctx.lineCap = "round";
        offctx.lineJoin = "round";

        for (const er of ers) {
          const pts = (er.points || []) as { x: number; y: number }[];
          if (pts.length < 2) continue;
          offctx.beginPath();
          offctx.lineWidth = er.size;
          // soporta posibles BREAKs (NaN) si los usas
          let started = false;
          for (const pt of pts) {
            const isBreak = !Number.isFinite(pt.x) || !Number.isFinite(pt.y);
            if (isBreak) { started = false; continue; }
            if (!started) { offctx.moveTo(pt.x, pt.y); started = true; }
            else { offctx.lineTo(pt.x, pt.y); }
          }
          offctx.stroke();
        }
        offctx.restore();
      }

      // 3) compón la capa al canvas principal
      ctx.drawImage(off, 0, 0);
    }

    // ---- (Opcional) dibujar cajas de selección
    if (selectedIds.length) {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      for (const id of selectedIds) {
        const st = strokes.find(st => st.id === id);
        if (!st) continue;
        const b = getStrokeBounds(st);
        if (!b) continue;
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const angle = (st.type === "text" || st.type === "svg" || st.type === "poly") ? st.rotation ?? 0 : 0;

        withRotation(ctx, angle, cx, cy, () => {
          ctx.save();
          ctx.strokeStyle = "#0af";
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.restore();

          if (st.type === "poly") {
            drawPolySelectionOverlay(ctx, st as PolyStroke, { color: "#0af", dpr });
          }

          const hs = handleRects(b, dpr);
          ctx.save();
          ctx.setLineDash([]);
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "#0af";
          for (const h of Object.values(hs)) {
            ctx.fillRect(h.x, h.y, h.w, h.h);
            ctx.strokeRect(h.x, h.y, h.w, h.h);
          }
          ctx.restore();
        });
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
    const f = ensureFont(
      s.fontFamily, fonts,
      fontCacheRef.current, fontMetaRef.current,
      pendingLoadsRef.current, setStatus, drawPreview
    );
    if (!f) return;

    const lines = (s.text || "").split("\n").map(l => (l ? l : " "));
    let baselineY = s.y;

    const sw   = s.outline?.width ?? 0;
    const scol = s.outline?.color ?? "#000";
    const join = (s.outline?.join ?? "round") as CanvasLineJoin;
    const mlim = s.outline?.miterLimit ?? 4;

    const letterSpacing = s.letterSpacing ?? 0;   // px
    const unitsPerEm = f.unitsPerEm || 1000;

    ctx.save();
    // (si más adelante agregas rotación por stroke, aplica aquí con ctx.translate/rotate)
    
    const b = s ? getStrokeBounds(s) : null; // si tu getStrokeBounds ya considera rotación, haz una variante "unrotated"
    if (!b) return
    const cx = b.x + b.w/2, cy = b.y + b.h/2;

    withRotation(ctx, s.rotation || 0, cx, cy, () => {

      for (const line of lines) {
        const glyphs = f.stringToGlyphs(line);
        const scale = s.size / unitsPerEm;
  
        // x inicial considerando alineación con tracking
        let x = s.x + alignShiftXLS(f, line, s.size, s.align, letterSpacing);
        const y = baselineY;
  
        for (let i = 0; i < glyphs.length; i++) {
          const g = glyphs[i];
  
          // --- STROKE debajo ---
          if (sw > 0) {
            const ps = g.getPath(x, y, s.size);
            ps.fill = null;
            ps.stroke = scol;
            ps.strokeWidth = sw;
            ctx.save();
            ctx.lineJoin = join;
            ctx.miterLimit = mlim;
            ps.draw(ctx);
            ctx.restore();
          }
  
          // --- FILL encima ---
          const pf = g.getPath(x, y, s.size);
          pf.stroke = null;
          pf.fill = s.fill === "none" ? null : s.fill;
          pf.draw(ctx);
  
          // Avance + kerning + tracking
          let adv = (g.advanceWidth || 0) * scale;
          if (i < glyphs.length - 1) {
            adv += (f.getKerningValue(g, glyphs[i + 1]) || 0) * scale;
            adv += letterSpacing;
          }
          x += adv;
        }
  
        baselineY += s.size * s.lineHeight;
      }
    });

  }

  // ==== Bounds aproximados ====
  function getStrokeBounds(s: Stroke): { x: number; y: number; w: number; h: number } | null | undefined {
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
    } if (s.type === "text") {
      const f = fontCacheRef.current.get(s.fontFamily);
      if (!f) return null;

      const lines = (s.text || "").split("\n").map(l => l || " "); // altura para líneas vacías
      const upm   = f.unitsPerEm || 1000;
      const ls    = s.letterSpacing ?? 0;            // ← tracking
      const sw    = s.outline?.width ?? 0;           // ← borde (para engordar bbox)
      const pad   = sw * 0.5;                         // ← mitad del stroke al rededor
      let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;

      let y = s.y;
      for (const line of lines) {
        const glyphs = f.stringToGlyphs(line);
        const scale  = s.size / upm;

        // Igual que al dibujar: usa tu alignShiftXLS con letterSpacing
        let x = s.x + alignShiftXLS(f, line, s.size, s.align, ls);

        for (let i = 0; i < glyphs.length; i++) {
          const g = glyphs[i];

          // bbox del glyph a (x,y) y tamaño s.size
          const b = g.getPath(x, y, s.size).getBoundingBox();
          xMin = Math.min(xMin, b.x1 - pad);
          yMin = Math.min(yMin, b.y1 - pad);
          xMax = Math.max(xMax, b.x2 + pad);
          yMax = Math.max(yMax, b.y2 + pad);

          // avance = advance + kerning + tracking (letterSpacing)
          let adv = (g.advanceWidth || 0) * scale;
          if (i < glyphs.length - 1) {
            adv += (f.getKerningValue(g, glyphs[i + 1]) || 0) * scale;
            adv += ls;                                  // ← tracking
          }
          x += adv;
        }
        y += s.size * s.lineHeight;
      }

      if (!Number.isFinite(xMin)) return null;
      return { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
    } else if (s.type === "poly") {
      return getPolyBounds(s);
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
      } else if (s.type === "poly") {
        if (hitPoly(pt, s as PolyStroke)) return s.id;
        continue;
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

  // function isHitSelect(px:number, py:number, st: Stroke){
  //   const b = getStrokeBounds(st);
  //   if (!b) return false;

  //   const angle = (st.type === "text" || st.type === "svg") ? (st.rotation || 0) : 0;
  //   const cx = b.x + b.w/2, cy = b.y + b.h/2;
  //   const HIT_PAD = 4; // margen de clic tolerante

  //   return pointInRotatedRect(px, py, b, angle, cx, cy, HIT_PAD);
  // }

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

    if (tool === "poly") {
      const arr = [...strokes];
      const draft = polyDraftRef.current;

      // Doble click para cerrar (si está dibujando)
      if (e.detail >= 2 && draft) {                    // <-- doble click
        const s = arr.find(st => st.id === draft.id) as PolyStroke | undefined;
        if (s && s.points.length >= 3) {
          s.closed = true;                             // <-- cierra
          // elimina el punto “ephemeral” (último duplicado)
          if (s.points.length >= draft.committed + 1) s.points.pop();
          polyDraftRef.current = null;
          setStrokes(arr);
          setSelectedIds([s.id]);
          drawPreview();
          return;
        }
      }

      // Si ya hay un polígono en curso
      if (draft) {
        const s = arr.find(st => st.id === draft.id) as PolyStroke | undefined;
        if (!s) { polyDraftRef.current = null; return; }

        // Cerrar tocando el primer punto
        const first = s.points[0];
        if (first && isNear(p, first, CLOSE_TOL)) {    // <-- clic cerca del primero
          if (s.points.length >= 3) {
            s.points.pop();                            // quita el ephemeral
            s.closed = true;                           // cierra
            polyDraftRef.current = null;
            setStrokes(arr);
            setSelectedIds([s.id]);
            drawPreview();
          }
          return;
        }

        // Commit del punto actual (convierte el “ephemeral” en fijo y añade otro ephemeral)
        s.points[s.points.length - 1] = p;             // <-- fija el actual
        s.points.push(p);                               // <-- agrega ephemeral nuevo
        polyDraftRef.current = { id: s.id, committed: draft.committed + 1 };
        setStrokes(arr);
        drawPreview();
        return;
      }

      // No hay polígono activo: crea uno nuevo con [p, p] (el 2° es “ephemeral”)
      const s: PolyStroke = {
        id: uid(),
        type: "poly",
        z: getMaxZ(arr) + 1,
        visible: true,
        locked: false,
        points: [p, p],                                // <-- 2º punto es temporal
        closed: false,
        fill: shapeHasFill ? shapeFill : "none",
        stroke: shapeStroke,
        strokeWidth: shapeStrokeWidth,
        lineJoin: "round",
        lineCap: "round",
        rotation: 0,
      };
      arr.push(s);
      polyDraftRef.current = { id: s.id, committed: 1 };
      setStrokes(arr);
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
      const p = getCanvasPos(e.currentTarget, e);

      if (!selectedIds.length) {
        toast('Selecciona un elemento para borrar');
        return;
      }

      let z = nextZ;
      if (e.shiftKey && selectedIds.length) {
        const target = strokes.find(s => s.id === selectedIds[0]);
        if (target) z = target.z - 0.5;
      }

      const s: EraserStroke = {
        id: uid(),
        type: "eraser",
        z,
        visible: true,
        locked: false,
        size: penSize,
        points: [p],
        targetIds: [...selectedIds],   // ← clave: apunta a la selección actual
      };

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
        letterSpacing,
        x: p.x,
        y: p.y,
        size: 64,
        rotation: 0,
        align: "left",
        outline: {
          color: fontOutlineColor,
          width: fontOutlineWidth,
          join: "round",
          miterLimit: 4,
        }
      };
      const f = ensureFont(fontFamily, fonts, fontCacheRef.current, fontMetaRef.current, pendingLoadsRef.current, setStatus, drawPreview);
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
      if (s) {
        const b = (s.type === "svg")
            ? { x: s.x, y: s.y, w: s.iw * s.scale, h: s.ih * s.scale }
            : getStrokeBounds(s);
        if (b) {
          const angle = (s.type === "text" || s.type === "svg") ? (s.rotation ?? 0) : 0;
          const cx = b.x + b.w/2, cy = b.y + b.h/2;

          // 2.2) des-rotar el punto del click si hace falta
          const pLocal = angle ? unrotatePoint(p.x, p.y, cx, cy, angle) : p;

          // 2.3) handles calculados en coords "no rotadas"
          const dpr = window.devicePixelRatio || 1;
          const hs = handleRects(b, dpr);

          const hitHandle =
            pointInRect(pLocal, hs.nw) ? "nw" :
            pointInRect(pLocal, hs.ne) ? "ne" :
            pointInRect(pLocal, hs.sw) ? "sw" :
            pointInRect(pLocal, hs.se) ? "se" : null;

          if (hitHandle) {
            resizingRef.current = {
              id: s.id,
              handle: hitHandle,
              startPt: pLocal,
              startBBox: b,
              startStroke: JSON.parse(JSON.stringify(s)) as Stroke,
              center: { x: cx, y: cy },
              angle,
            };
            return;
          }
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
      return translateStroke(s, dx, dy);
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
    const f = ensureFont(s.fontFamily, fonts, fontCacheRef.current, fontMetaRef.current, pendingLoadsRef.current, setStatus, drawPreview);
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

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter") return;
      const d = polyDraftRef.current; if (!d) return;
      setStrokes(prev => {
        const arr = [...prev];
        const s = arr.find(st => st.id === d.id) as PolyStroke | undefined;
        if (s && s.points.length >= 3) {
          s.points.pop(); s.closed = true;
          polyDraftRef.current = null;
        }
        return arr;
      });
      drawPreview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
          const [buf, dataURL] = await Promise.all([file.arrayBuffer(), fileToDataURL(file)]);
          const f = opentype.parse(buf);
          const name = f.names.fullName?.en || file.name.replace(/\.(ttf|otf)$/i, "");
          fontCacheRef.current.set(name, f);
          fontMetaRef.current.set(name, { kind: "data", url: dataURL });
          setFonts(prev => [[name, ""], ...prev]);
          setFontFamily(name);
          setStatus(`Fuente cargada: ${name}`);
          setTool("text");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          setStatus("No pude parsear el TTF/OTF: " + message);
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

    const bb = getStrokeBounds(s);
    if (!bb) return;
    const cx = bb.x + bb.w / 2;
    const cy = bb.y + bb.h / 2;

    ctx.save();
    withRotation(ctx, s.rotation || 0, cx, cy, () => {
      if (img.complete) {
        ctx.drawImage(img, s.x, s.y, w, h);               // <-- dibuja en su top-left (s.x,s.y)
      } else {
        // placeholder opcional mientras carga
        ctx.strokeStyle = "#ccc";                          // <-- placeholder visual
        ctx.strokeRect(s.x, s.y, w, h);
      }
    })

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
  function exportSVG() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sorted = [...strokes].filter(s => s.visible !== false).sort((a, b) => a.z - b.z);

    // ---- PASO 1: bounds (solo contenido visible NO-eraser)
    let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
    const pushBounds = (x1:number,y1:number,x2:number,y2:number) => {
      xMin = Math.min(xMin, x1); yMin = Math.min(yMin, y1);
      xMax = Math.max(xMax, x2); yMax = Math.max(yMax, y2);
    };

    for (const s of sorted) {
      if (s.type === "eraser") continue;
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
        const ls = s.letterSpacing ?? 0;
        const pad = (s.outline?.width ?? 0) / 2;
        let y = s.y;

        for (const line of lines) {
          const glyphs = f.stringToGlyphs(line);
          const upm = f.unitsPerEm || 1000;
          const scale = s.size / upm;

          let x = s.x + alignShiftXLS(f, line, s.size, s.align, ls);

          for (let i = 0; i < glyphs.length; i++) {
            const g = glyphs[i];
            const gp = g.getPath(x, y, s.size);
            const b = gp.getBoundingBox();
            pushBounds(b.x1 - pad, b.y1 - pad, b.x2 + pad, b.y2 + pad);

            let adv = (g.advanceWidth || 0) * scale;
            if (i < glyphs.length - 1) {
              adv += (f.getKerningValue(g, glyphs[i + 1]) || 0) * scale;
              adv += ls;
            }
            x += adv;
          }
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

    // ---- PASO 2: máscaras por target (solo erasers con targetIds)
    type AnyStroke = typeof strokes[number];
    type Erase = Extract<AnyStroke, { type: "eraser" }>;
    const erasersByTarget = new Map<string, Erase[]>();

    for (const s of sorted) {
      if (s.type !== "eraser") continue;
      const targets = s.targetIds as string[] | undefined;
      if (!Array.isArray(targets) || targets.length === 0) continue;
      for (const tid of targets) {
        if (!erasersByTarget.has(tid)) erasersByTarget.set(tid, []);
        erasersByTarget.get(tid)!.push(s as Erase);
      }
    }

    const pathDFromPoints = (pts: {x:number;y:number}[]) => {
      let d = "";
      let started = false;
      for (const pt of pts) {
        const isBreak = !Number.isFinite(pt.x) || !Number.isFinite(pt.y);
        if (isBreak) { started = false; continue; }
        if (!started) { d += (d ? " " : "") + `M ${pt.x} ${pt.y}`; started = true; }
        else { d += ` L ${pt.x} ${pt.y}`; }
      }
      return d;
    };

    const maskDefs: string[] = [];
    for (const [tid, ers] of erasersByTarget) {
      const PAD = 2;
      const ix1 = Math.floor(xMin - PAD), iy1 = Math.floor(yMin - PAD);
      const iw  = Math.ceil(xMax - xMin + 2*PAD);
      const ih  = Math.ceil(yMax - yMin + 2*PAD);
      const lines = ers
        .filter(er => er.points?.length >= 2)
        .map(er => {
          const d = pathDFromPoints(er.points);
          return `<path d="${d}" fill="none" stroke="black" stroke-width="${er.size}" stroke-linecap="round" stroke-linejoin="round"/>`;
        })
        .join("\n");
      maskDefs.push(`
      <mask id="m_${tid}" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse"
            x="${ix1}" y="${iy1}" width="${iw}" height="${ih}">
        <rect x="${ix1}" y="${iy1}" width="${iw}" height="${ih}" fill="white"/>
        <g transform="translate(0,0)">
          ${lines}
        </g>
      </mask>`);
    }

    // ---- PASO 3: contenido en orden de z, aplicando mask por-id cuando exista
    const contentEls: string[] = [];

    for (const s of sorted) {
      if (s.type === "eraser") continue;

      const maskAttr = erasersByTarget.has(s.id) ? ` mask="url(#m_${s.id})"` : "";

      if (s.type === "pen") {
        const d = penToPathD(s);
        contentEls.push(
          `<g${maskAttr}>
            <path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.size}" stroke-linecap="round" stroke-linejoin="round"/>
          </g>`
        );
        continue;
      }

      if (s.type === "text") {
        const f = fontCacheRef.current.get(s.fontFamily);
        if (!f) continue;

        const sw   = s.outline?.width ?? 0;
        const scol = s.outline?.color ?? "#000";
        const join = s.outline?.join ?? "round";
        const mlim = s.outline?.miterLimit ?? 4;

        const ls = s.letterSpacing ?? 0;

        let y = s.y;
        const parts: string[] = [];

        for (const line of (s.text || "").split("\n").map(l => l || " ")) {
          const glyphs = f.stringToGlyphs(line);
          const upm = f.unitsPerEm || 1000;
          const scale = s.size / upm;

          let x = s.x + alignShiftXLS(f, line, s.size, s.align, ls);

          for (let i = 0; i < glyphs.length; i++) {
            const g = glyphs[i];
            const d = g.getPath(x, y, s.size).toPathData(3);

            // stroke (debajo) si procede
            if (sw > 0) {
              parts.push(
                `<path d="${d}" fill="none" stroke="${scol}" stroke-width="${sw}" stroke-linejoin="${join}" stroke-miterlimit="${mlim}"/>`
              );
            }
            // fill (encima)
            if (s.fill !== "none") {
              parts.push(`<path d="${d}" fill="${s.fill}"/>`);
            }

            let adv = (g.advanceWidth || 0) * scale;
            if (i < glyphs.length - 1) {
              adv += (f.getKerningValue(g, glyphs[i + 1]) || 0) * scale;
              adv += ls;
            }
            x += adv;
          }

          y += s.size * s.lineHeight;
        }
        const deg = (s.rotation||0) * 180/Math.PI;
        const b = getStrokeBounds(s); // usa tu lógica de bounds de texto
        const cx = b ? b.x + b.w/2 : 0, cy = b ? b.y + b.h/2 : 0;
        const R = `translate(${cx},${cy}) rotate(${deg}) translate(${-cx},${-cy})`;

        contentEls.push(`<g${maskAttr} transform="${R}">${parts.join("\n")}</g>`);
        continue;
      }


      if (s.type === "svg") {
        const inner = extractSvgInner(s.svg); // sin prolog/doctype/comments
        const vbX = s.vbX ?? 0, vbY = s.vbY ?? 0;
        const rot = s.rotation ? ` rotate(${(s.rotation * 180 / Math.PI).toFixed(3)})` : "";
        contentEls.push(
          `<g${maskAttr} transform="translate(${s.x},${s.y}) scale(${s.scale})${rot} translate(${-vbX},${-vbY})">
            ${inner}
          </g>`
        );
        continue;
      }

      if (s.type === "shape") {
        const sh = s as ShapeStroke;
        if (sh.kind === "rect") {
          const x = sh.w >= 0 ? sh.x : sh.x + sh.w;
          const y = sh.h >= 0 ? sh.y : sh.y + sh.h;
          const w = Math.abs(sh.w), h = Math.abs(sh.h);
          const rx = Math.max(0, Math.min(sh.rx ?? 0, Math.min(w, h)/2));
          contentEls.push(
            `<g${maskAttr}>
              <rect x="${x}" y="${y}" width="${w}" height="${h}"` +
              (rx ? ` rx="${rx}" ry="${rx}"` : ``) +
              ` fill="${sh.fill === "none" ? "none" : sh.fill}" stroke="${sh.stroke}" stroke-width="${sh.strokeWidth}"/>
            </g>`
          );
        } else if (sh.kind === "ellipse") {
          const cx = sh.x + sh.w/2, cy = sh.y + sh.h/2;
          const rx = Math.abs(sh.w/2), ry = Math.abs(sh.h/2);
          contentEls.push(
            `<g${maskAttr}>
              <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${sh.fill === "none" ? "none" : sh.fill}" stroke="${sh.stroke}" stroke-width="${sh.strokeWidth}"/>
            </g>`
          );
        } else if (sh.kind === "line") {
          contentEls.push(
            `<g${maskAttr}>
              <line x1="${sh.x}" y1="${sh.y}" x2="${sh.x + sh.w}" y2="${sh.y + sh.h}" stroke="${sh.stroke}" stroke-width="${sh.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </g>`
          );
        }
        continue;
      }

      if (s.type === "poly") {
        const pts = s.points.map(p => `${p.x},${p.y}`).join(" ");
        const cx = (getPolyBounds(s)!.x + getPolyBounds(s)!.w/2);
        const cy = (getPolyBounds(s)!.y + getPolyBounds(s)!.h/2);
        const rot = s.rotation ? ` rotate(${(s.rotation*180/Math.PI).toFixed(3)} ${cx} ${cy})` : "";
        const common = `fill="${s.closed && s.fill!=="none" ? s.fill : "none"}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" stroke-linejoin="${s.lineJoin||"round"}" stroke-linecap="${s.lineCap||"round"}"`;
        contentEls.push(
          s.closed
            ? `<g${maskAttr} transform="${T}"><polygon points="${pts}" ${common}${rot && ""}/></g>`
            : `<g${maskAttr} transform="${T}"><polyline points="${pts}" ${common}${rot && ""}/></g>`
        );
      }

    }

    // ---- SVG final
    const bgRect = transparentBG ? "" : `  <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="${bg}"/>\n`;

    const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
    <defs>
  ${maskDefs.join("\n")}
    </defs>
    ${bgRect}
    <g ${T}>
  ${contentEls.join("\n")}
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
  async function onUploadTTF(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const [buf, dataURL] = await Promise.all([file.arrayBuffer(), fileToDataURL(file)]);
    try {
      const f = opentype.parse(buf);
      const name = f.names.fullName?.en || file.name.replace(/\.(ttf|otf)$/i,"");
      fontCacheRef.current.set(name, f);
      fontMetaRef.current.set(name, { kind: "data", url: dataURL });
      setFonts(prev => [[name, ""], ...prev]);
      setFontFamily(name);
      setStatus(`Fuente cargada: ${name}`);
      // setTool("text");
      drawPreview();
    } catch (err: any) {
      setStatus("No pude parsear el TTF/OTF: " + (err?.message || err));
    }
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
          <ToolsContainer tool={tool}>
            { (tool === "text" || isSelectedType(["text"])) && (
              <>
                <div className="min-w-32 sm:w-xs">
                  <Label>Fuente</Label>
                  <KCmdKModal
                    title="Fuente (Google Fonts)"
                    label={(isSelectedType(["text"]) as TextStroke)?.fontFamily || fontFamily || "Fuente"}
                    fonts={fonts}
                    handleFontChange={(f) => { handleFontChange(f); }}
                    onUploadTTF={onUploadTTF}
                    API_KEY={API_KEY}
                  />
                </div>

                <div className="min-w-20 sm:w-auto">
                  <Label>Interlineado</Label>
                  <input
                    type="number"
                    step="1"
                    className="w-full h-10 p-2 rounded-lg border border-neutral-300"
                    min={0}
                    max={30}
                    value={(isSelectedType(["text"]) as TextStroke)?.letterSpacing || letterSpacing}
                    onChange={(e) => updateSelectedPatch(+e.target.value || 0, setLetterSpacing, { 
                      types: ["text"],
                      patch: (_s, v) => ({ letterSpacing: v }),
                    })}
                  />
                </div>

                <div className="min-w-14 sm:w-auto">
                  <Label>Height</Label>
                  <input
                    type="number"
                    step="0.05"
                    className="w-full h-10 p-2 rounded-lg border border-neutral-300"
                    min={0.8}
                    max={3}
                    value={(isSelectedType(["text"]) as TextStroke)?.lineHeight || lineHeight}
                    onChange={(e) => updateSelectedPatch(+e.target.value || 1.2, setLineHeight, { 
                      types: ["text"],
                      patch: (_s, v) => ({ lineHeight: v }),
                    })}
                  />
                </div>

                <div className="min-w-14 sm:w-auto">
                  <Label>Color</Label>
                  <div className="relative flex items-center gap-2">
                    <span className="pointer-events-none select-none grid absolute inset-0 pb-1 items-end text-xs font-bold text-neutral-500 z-[1]" aria-hidden="true">{shapeStroke}</span>
                    <FillPicker
                      label="Color de texto"
                      value={(isSelectedType(["text"]) as TextStroke)?.fill || fill}
                      onChange={(v) => updateSelectedPatch(v, setFill, { 
                        types: ["text"],
                        patch: (_s, v) => ({ fill: v }),
                      })}
                    />
                  </div>
                </div>

                <div className="w-auto px-2">
                  <Label>Borde</Label>
                  <div className="flex gap-1">
                    <div className="relative flex items-center gap-2">
                      <span className="pointer-events-none select-none grid absolute inset-0 pb-1 items-end text-xs font-bold text-neutral-500 z-[1]">{fontOutlineWidth}px</span>
                      <StrokeWidth
                        value={(isSelectedType(["text"]) as TextStroke)?.outline?.width || fontOutlineWidth}
                        onChange={(v) => updateSelectedPatch(v, setFontOutlineWidth, { 
                          types: ["text"],
                          patch: (s, width) => {
                            if (s.type !== "text") return {};
                            const prev = (s as TextStroke).outline ?? {
                              color: fontOutlineColor,
                              width: fontOutlineWidth,
                              join: "round" as const,
                              miterLimit: 4,
                            };
                            return { outline: { ...prev, width } };
                          },
                        })}
                        min={0}
                        max={64}
                        step={1}
                        placement="bottom"   // "top" | "left" | "right"
                      />
                    </div>

                    <div className="relative flex items-center gap-2">
                      <span className="pointer-events-none select-none grid absolute inset-0 pb-1 items-end text-xs font-bold text-neutral-500 z-[1]">{fontOutlineColor}</span>
                      <FillPicker
                        label="Color de borde"
                        value={(isSelectedType(["text"]) as TextStroke)?.outline?.color || fontOutlineColor}
                        onChange={(v) => updateSelectedPatch(v, setFontOutlineColor, { 
                          types: ["text"],
                          patch: (s, color) => {
                            if (s.type !== "text") return {};
                            const prev = (s as TextStroke).outline ?? {
                              color: fontOutlineColor,
                              width: fontOutlineWidth,
                              join: "round" as const,
                              miterLimit: 4,
                            };
                            return { outline: { ...prev, color } };
                          },
                        })}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {isSelectedType(["text", "svg"]) && (
              <div className="min-w-14 sm:w-auto">
                <Label>Rotation</Label>
                <input
                  type="number"
                  step="1"
                  className="w-full p-2 rounded-lg border border-neutral-300"
                  min={-180}
                  max={180}
                  value={radToDeg((isSelectedType(["text", "svg"]) as TextStroke | SvgStroke)?.rotation) || rotation}
                  onChange={(e) => updateSelectedPatch(+e.target.value || 0, setRotation, { 
                    types: ["text"],
                    patch: (_s, v) => ({ rotation: degToRad(v) }),
                  })}
                />
              </div>
            )}

            { (tool === "pen" || isSelectedType(["pen"])) && (
              <div className="w-14 sm:w-auto">
                <Label>Color</Label>
                <div className="relative flex items-center gap-2">
                  <FillPicker
                    label="Pencil Color"
                    value={(isSelectedType(["pen"]) as PenStroke)?.color || penColor}
                    onChange={(v) => updateSelectedPatch(v, setPenColor, { 
                      types: ["pen"],
                      patch: (_s, v) => ({ color: v }),
                    })}
                    placement="bottom-right"
                  />
                </div>
              </div>
            )}
            { (tool === "pen" || tool == "eraser" || isSelectedType(["pen", "eraser"]) ) && (
              <div>
                <Label>Pencil Width</Label>
                <BrushSizeSelect
                  value={(isSelectedType(["pen", "eraser"]) as PenStroke | EraserStroke)?.size || penSize}
                  color={penColor}
                  onChange={(v) => updateSelectedPatch(v, setPenSize, { 
                    types: ["pen"],
                    patch: (_s, v) => ({ size: v }),
                  })}
                  className="w-44"
                />
              </div>
            )}

            { (tool == "shape" || isSelectedType(["shape"])) && (
              <>
                <div className="min-w-32 sm:w-xs">
                  <Label>Tipo</Label>
                  <select
                    className="w-full p-2 rounded-lg border border-neutral-300"
                    value={(isSelectedType(["shape"]) as ShapeStroke)?.kind || shapeKind}
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
                      value={(isSelectedType(["shape"]) as ShapeStroke)?.rx || shapeRadius}
                      onChange={(v) => updateSelectedPatch(v, setShapeRadius, { 
                        types: ["shape"],
                        patch: (_s, v) => ({ rx: v }),
                      })}
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
                      <span className="pointer-events-none select-none grid absolute inset-0 pb-1 items-end text-xs font-bold text-neutral-500 z-[1]">{shapeHasFill ? shapeFill : ""}</span>
                      <FillPicker
                        label="Relleno"
                        value={(isSelectedType(["shape"]) as ShapeStroke)?.fill || shapeFill}
                        onChange={(v) => updateSelectedPatch(v, setShapeFill, { 
                          types: ["shape"],
                          patch: (_s, v) => ({ fill: v }),
                        })}
                        hasFill={shapeHasFill}
                        onHasFillChange={setShapeHasFill}
                        placement="bottom"
                      />
                    </div>
                  </div>
                )}

                <div className="w-14 sm:w-auto">
                  <Label>Borde</Label>
                  <div className="relative flex items-center gap-2">
                    <span className="pointer-events-none select-none grid absolute inset-0 pb-1 items-end text-xs font-bold text-neutral-500 z-[1]">{shapeStroke}</span>
                    <FillPicker
                      label="Borde"
                      value={(isSelectedType(["shape"]) as ShapeStroke)?.stroke || shapeStroke}
                      onChange={(v) => updateSelectedPatch(v, setShapeStroke, { 
                        types: ["shape"],
                        patch: (_s, v) => ({ stroke: v }),
                      })}
                    />
                  </div>
                </div>

                <div className="w-14 sm:w-auto">
                  <Label>Grosor</Label>
                  <div className="relative flex items-center gap-2">
                    <span className="pointer-events-none select-none grid absolute inset-0 pb-1 items-end text-xs font-bold text-neutral-500 z-[1]">{shapeStrokeWidth}px</span>
                    <StrokeWidth
                      value={(isSelectedType(["shape"]) as ShapeStroke)?.strokeWidth || shapeStrokeWidth}
                      onChange={(v) => updateSelectedPatch(v, setShapeStrokeWidth, { 
                        types: ["shape"],
                        patch: (_s, v) => ({ strokeWidth: v }),
                      })}
                      min={0}
                      max={64}
                      step={1}
                      placement="bottom"   // "top" | "left" | "right"
                    />
                  </div>
                </div>
                <span className="w-px h-full bg-gray-400">&nbsp;</span>
              </>
            )}

            { tool == "select" && (
              <div>
                <Label>Herramientas de selección</Label>
                <div className="flex items-center gap-2">
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

            <div className="ml-auto">
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
                  onClick={() => exportSVG()}
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
          </ToolsContainer>
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
            className={`px-3 py-2 rounded-lg ${tool === "poly" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-800"}`}
            onClick={() => setTool("poly")}
          >
            <PolygonIcon className="size-4 md:size-8" />
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
          <span className="h-px w-2/3 my-1 mx-auto bg-gray-200">&nbsp;</span>
          <button
            type="button"
            className="px-3 py-2 rounded-lg bg-neutral-200 text-neutral-800"
            onClick={handleUploadImage}
          >
            <ImagePlusIcon className="size-4 md:size-8" />
          </button>
          <span className="h-px w-2/3 my-1 mx-auto bg-gray-200">&nbsp;</span>
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
      <div className="overflow-y-auto space-y-1">
        <p className="text-xs text-neutral-500 flex flex-col sm:flex-row pl-10 sm:pl-14">
          <span>{status}</span>
          { tool === "text" ? (
            <span className="ml-auto">Tip: click para crear. Puedes buscar una fuente, o subir un TTF/OTF personalizado.</span>
          ) : tool === "select" ? (
            <>
              <span className="ml-auto">Tip: Arrastra para mover. Delete para borrar.</span>
            </>
          ) : (
            <span className="ml-auto">Tip: mantén <kbd>Shift</kbd> al iniciar un trazo para insertarlo debajo de lo seleccionado.</span>
          )}
        </p>
      </div>
    </div>
  );
}
