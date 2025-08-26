import { useEffect, useRef, useState } from "react";

type Placement = "bottom" | "top" | "left" | "right";

type RadiusProps = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placement?: Placement;
  className?: string;    // ancho del trigger; por defecto w-14
  disabled?: boolean;
};

const PRESETS = [0, 4, 8, 12, 16, 24, 32, 48];

export function Radius({
  value,
  onChange,
  min = 0,
  max = 128,
  step = 1,
  placement = "bottom",
  className = "w-14",
  disabled = false,
}: RadiusProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setLocal(value), [value]);

  // Cerrar con click fuera / Esc y atajos ↑ ↓
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
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, value, min, max, step, onChange]);

  const pos = {
    bottom: "top-full mt-2 left-0",
    'bottom-left': "top-full mt-2 right-0",
    top: "bottom-full mb-2 right-0",
    left: "top-1/2 -translate-y-1/2 right-full mr-2",
    right: "top-1/2 -translate-y-1/2 left-full ml-2",
  }[placement];

  // Preview interno del trigger (caja 22x14)
  const boxW = 22, boxH = 14;
  const maxCorner = Math.min(boxW, boxH) / 2;
  const corner = Math.min(local, maxCorner);

  return (
    <div ref={wrapRef} className="relative inline-block">
      {/* Trigger compacto */}
      <button
        type="button"
        className={`${className} h-10 rounded-lg border border-neutral-300 shadow-sm flex items-center justify-center p-0 ${disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow"} focus:outline-none focus:ring-2 focus:ring-neutral-600`}
        onClick={() => !disabled && setOpen(o => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Radio: ${value}`}
        disabled={disabled}
      >
        <div className="relative" style={{ width: boxW + 10, height: boxH + 10 }}>
          <div
            className="absolute inset-0 left-1 right-1 top-1 bottom-1 bg-neutral-900/10 border border-neutral-500/50"
            style={{ borderRadius: corner }}
          />
        </div>
      </button>

      {/* Popover */}
      {open && !disabled && (
        <div role="dialog" className={`absolute z-50 w-64 rounded-xl border bg-white shadow-xl p-3 ${pos}`}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-600 w-14">Radio</span>
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
              </div>
            </div>

            {/* Preview grande */}
            <div className="mt-1">
              <div className="text-xs text-neutral-500 mb-1">Preview</div>
              <div className="h-14 rounded-md border border-neutral-200 bg-white relative grid place-items-center">
                <div
                  className="w-[120px] h-[70px] border border-neutral-400 bg-neutral-100"
                  style={{ borderRadius: Math.min(local, 35) }}
                />
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
