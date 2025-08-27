import { useEffect, useRef, useState } from "react";
import { useConstrainedPopover } from "../hook/useConstrainedPopover";

type Placement = "bottom" | "top" | "left" | "right";

type StrokeWidthProps = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placement?: Placement;   // "bottom" | "top" | "left" | "right"
  className?: string;      // ancho del trigger, por defecto w-14
};

const PRESETS = [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32];

export function StrokeWidth({
  value,
  onChange,
  min = 0,
  max = 64,
  step = 1,
  placement = "bottom",
  className = "w-14",
}: StrokeWidthProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setLocal(value), [value]);

  // cerrar con click fuera / Esc y atajos ↑ ↓
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(max, (value ?? 0) + step)); }
      if (e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(min, (value ?? 0) - step)); }
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open, value, min, max, step, onChange]);

  // Mapea tu placement a preferred + align del hook
  const map = {
    bottom: { preferred: "bottom" as const, align: "end" as const }, // antes: right-0
    top:    { preferred: "top"    as const, align: "end" as const }, // antes: right-0
    left:   { preferred: "left"   as const, align: "center" as const },
    right:  { preferred: "right"  as const, align: "center" as const },
  }[placement];

  // Posicionamiento fijo clampeado al viewport
  useConstrainedPopover({
    open,
    popoverRef: popRef as React.RefObject<HTMLElement>,
    triggerRef: btnRef as React.RefObject<HTMLElement>,
    preferred: map.preferred,
    align: map.align,
    gap: 8,
    padding: 8,
  });

  return (
    <div ref={wrapRef} className="relative inline-block">
      {/* Trigger compacto */}
      <button
        ref={btnRef}
        type="button"
        className={`${className} h-10 rounded-lg border border-neutral-300 shadow-sm flex items-center justify-center p-0 hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-600`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Grosor: ${value}`}
      >
        {/* Mini preview de línea con el grosor actual */}
        <div className="w-9 relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-neutral-900 rounded-full" style={{ height: Math.max(1, value) }} />
        </div>
      </button>

      {/* Popover (FIXED + clamp viewport) */}
      {open && (
        <div
          ref={popRef}
          role="dialog"
          className="fixed z-50 w-64 rounded-xl border bg-white shadow-xl p-3
                     max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-auto overscroll-contain"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-600 w-14">Grosor</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={local}
                onChange={(e) => { const v = +e.target.value; setLocal(v); onChange(v); }}
                className="flex-1 accent-neutral-900"
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={local}
                onChange={(e) => {
                  const v = Math.min(max, Math.max(min, +e.target.value || 0));
                  setLocal(v); onChange(v);
                }}
                onBlur={() => {
                  const v = Math.min(max, Math.max(min, local || 0));
                  if (v !== local) { setLocal(v); onChange(v); }
                }}
                className="w-16 text-sm px-2 py-1 rounded border border-neutral-300"
              />
            </div>

            {/* Presets */}
            <div>
              <div className="text-xs text-neutral-500 mb-1">Presets</div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setLocal(p); onChange(p); setOpen(false); }}
                    className={`px-2 py-1 text-xs rounded border ${p === value ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 hover:bg-neutral-50"}`}
                    title={`${p}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setLocal(0); onChange(0); setOpen(false); }}
                  className="px-2 py-1 text-xs rounded border border-neutral-300 hover:bg-neutral-50"
                  title="Sin borde"
                >
                  0 (sin borde)
                </button>
              </div>
            </div>

            {/* Preview grande */}
            <div className="mt-1">
              <div className="text-xs text-neutral-500 mb-1">Preview</div>
              <div className="h-10 rounded-md border border-neutral-200 bg-white relative overflow-hidden">
                <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 bg-neutral-900 rounded-full" style={{ height: Math.max(1, local) }} />
              </div>
            </div>

            <div className="flex justify-end">
              <button className="px-2 py-1 text-sm rounded border border-neutral-300" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
