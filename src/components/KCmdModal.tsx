import React, { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { PlusIcon } from "./ui";

type KCmdKModalProps = {
  title?: string;                  // (opcional) título del modal
  label?: string;                  // (opcional) etiqueta para el input
  fonts: [string, string][];       // lista de fuentes como tuplas [nombre, url]
  handleFontChange: (font: string) => void; // función para cambiar la fuente
  onUploadTTF: (e: ChangeEvent<HTMLInputElement>) => void;
  API_KEY?: string;                // (opcional) clave de API para Google Fonts
};

export default function KCmdKModal({
  title = "Buscar",
  label = "Fuente",
  fonts,
  handleFontChange,
  onUploadTTF,
  API_KEY
}: KCmdKModalProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");

  const filteredFonts = useMemo(() => {
    if (!query) return fonts;
    const q = query.toLowerCase().trim();
    return fonts.filter(([f]) => f.toLowerCase().includes(q));
  }, [fonts, query]);

  // ----- NUEVO: refs/estado para navegación -----
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(0);

  // Reinicia el índice activo cuando cambia el filtro o el número de items
  useEffect(() => {
    setActive(0);
    // limpia refs sobrantes
    btnRefs.current = [];
  }, [query, filteredFonts.length]);
  // ----------------------------------------------

  // Abre con CMD/Ctrl + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        lastActiveRef.current = document.activeElement as HTMLElement;
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cerrar con ESC, foco y scroll lock
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Enfocar input después de montar
    setTimeout(() => inputRef.current?.focus(), 0);

    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = prevOverflow;
      lastActiveRef.current?.focus?.();
    };
  }, [open]);

  // ---- NUEVO: utilidades de navegación ----
  const items = filteredFonts.slice(0, 400);

  const ensureVisible = (idx: number) => {
    const c = listRef.current;
    const el = btnRefs.current[idx];
    if (!c || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    const viewTop = c.scrollTop;
    const viewBottom = viewTop + c.clientHeight;
    if (top < viewTop) c.scrollTop = top;
    else if (bottom > viewBottom) c.scrollTop = bottom - c.clientHeight;
  };

  const move = (to: number) => {
    if (!items.length) return;
    const n = Math.max(0, Math.min(to, items.length - 1));
    setActive(n);
    btnRefs.current[n]?.focus();
    ensureVisible(n);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(0);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(active + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(active - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(items.length - 1);
        break;
      case "PageDown":
        e.preventDefault();
        move(active + Math.max(1, Math.floor((listRef.current?.clientHeight ?? 0) / 32)));
        break;
      case "PageUp":
        e.preventDefault();
        move(active - Math.max(1, Math.floor((listRef.current?.clientHeight ?? 0) / 32)));
        break;
      case "Enter": {
        e.preventDefault();
        if (!items.length) return;
        const [f] = items[active];
        handleFontChange(f);
        setOpen(false); // cierra al seleccionar
        break;
      }
    }
  };
  // -----------------------------------------

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-10 inline-flex items-center gap-2 p-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        title="Abrir buscador (⌘K / Ctrl+K)"
      >
        <span className="flex-1 text-left overflow-hidden whitespace-nowrap text-ellipsis">{label}</span>
        <kbd className="ml-1 hidden sm:inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 border">
          {/Mac|iPhone|iPad/i.test(navigator.platform) ? "⌘" : "Ctrl"} K
        </kbd>
      </button>
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4"
      onClick={() => setOpen(false)} // click overlay cierra
      aria-hidden={false}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kcmdk-title"
        className="relative z-10 mt-24 w-full max-w-lg rounded-xl border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()} // evita cerrar al hacer click dentro
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 id="kcmdk-title" className="text-sm font-medium text-neutral-800">
            {title}
          </h2>
          <button
            className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="rounded-xl border border-neutral-300 p-2">
          <input
            type="text"
            ref={inputRef}
            className="w-full p-2 mb-2 rounded-lg border border-neutral-200"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}            // ← NUEVO: ↓ salta a la lista
            placeholder="Buscar fuente…"
          />

          <div
            ref={listRef}
            role="listbox"
            aria-label="Resultados de fuentes"
            tabIndex={0}
            onKeyDown={onListKeyDown}             // ← NUEVO: navegación + Enter
            className="h-40 overflow-auto focus:outline-none"
          >
            {items.map(([f], i) => (
              <button
                key={f}
                ref={(el) => { btnRefs.current[i] = el; }}
                role="option"
                tabIndex={i === active ? 0 : -1}   // ← NUEVO: roving tabindex
                aria-selected={i === active}
                className={
                  "w-full text-left px-2 py-1 rounded-md " +
                  (i === active ? "bg-neutral-100" : "hover:bg-neutral-100")
                }
                onMouseMove={() => setActive(i)}   // opcional: hover sincroniza activo
                onClick={() => {
                  handleFontChange(f);
                  setOpen(false);                  // ← NUEVO: cierra al seleccionar
                }}
              >
                {f}
              </button>
            ))}

            {items.length === 0 && (
              <div className="text-sm text-neutral-500 px-2 py-1">Sin resultados</div>
            )}
          </div>

          {!API_KEY && (
            <div className="text-xs text-neutral-500 mt-2">
              Consejo: agrega <code>VITE_GOOGLE_FONTS_KEY</code> a tu <code>.env</code> para cargar todas las fuentes.
            </div>
          )}
          <div className="border-t-2 border-gray-200 pt-4">
            <label className="px-4 py-2 rounded-lg border shadow-sm p-0 flex items-center justify-center hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-600 bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50">
              Nueva fuente <PlusIcon className="inline size-6" />
              <input id="uploadFontInputFile" type="file" className="hidden" accept=".ttf,.otf" onChange={onUploadTTF} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
