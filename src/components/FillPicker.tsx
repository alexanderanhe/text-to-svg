import { useEffect, useRef, useState } from "react";

type FillPickerProps = {
  label: string;
  value: string;
  className?: string;
  onChange: (hex: string) => void;
  hasFill?: boolean;
  onHasFillChange?: (v: boolean) => void;
  disabled?: boolean;
  placement?: "bottom" | "top" | "left" | "right" | "bottom-right";
};

export function FillPicker({
  label,
  value,
  className="w-14 h-10",
  onChange,
  hasFill,
  onHasFillChange,
  disabled = false,
  placement = "bottom", // ← por defecto
}: FillPickerProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setHex(value), [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const normalized = (raw: string) => {
    let v = raw.trim();
    if (!v.startsWith("#")) v = "#" + v;
    const m3 = /^#([0-9a-f]{3})$/i.exec(v);
    if (m3) { const [r,g,b]=m3[1].split(""); v = `#${r}${r}${g}${g}${b}${b}`; }
    if (!/^#([0-9a-f]{6})$/i.test(v)) return null;
    return v.toLowerCase();
  };
  const handleCommitHex = () => { const n = normalized(hex); if (n) onChange(n); else setHex(value); };

  const swatchBg = (hasFill || hasFill === undefined)
    ? value
    : "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 10px 10px";

  // Posición del popover según placement
  const pos = {
    bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
    top: "bottom-full mb-2 right-0",
    left: "top-1/2 -translate-y-1/2 right-full mr-2",
    right: "top-1/2 -translate-y-1/2 left-full ml-2",
    "bottom-right": "top-full mt-2 left-0",
  }[placement];

  return (
    <div ref={wrapRef} className="relative inline-block">
      {/* Trigger w-14 */}
      <button
        ref={btnRef}
        type="button"
        className={`${className} rounded-lg border border-neutral-300 shadow-sm flex items-center justify-center relative ${disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow"} focus:outline-none focus:ring-2 focus:ring-neutral-600`}
        style={{ background: swatchBg }}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        {!(hasFill || hasFill === undefined) && <span className="pointer-events-none absolute block w-[2px] h-12 bg-rose-500 rotate-45" />}
        <span className="pointer-events-none absolute inset-1 rounded-md border border-black/10" />
      </button>

      {open && !disabled && (
        <div
          role="dialog"
          className={`absolute z-50 rounded-xl border bg-white shadow-xl p-3 ${pos}`}
        >
          <div className="grid grid-cols-[auto,1fr] items-center gap-2">
            <label className="text-xs text-neutral-600">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-8 p-0 border border-neutral-300 rounded cursor-pointer"
                value={hasFill ? value : "#ffffff"}
                onChange={(e) => { if (onHasFillChange) {onHasFillChange(true);} onChange(e.target.value); setHex(e.target.value); }}
                disabled={!hasFill}
                title="Selecciona color"
              />
              <input
                type="text"
                className="flex-1 text-sm px-2 py-1 rounded border border-neutral-300"
                placeholder="#000000"
                value={hex}
                onChange={(e)=>setHex(e.target.value)}
                onBlur={handleCommitHex}
                onKeyDown={(e)=>{ if(e.key==="Enter") { e.preventDefault(); handleCommitHex(); } }}
                disabled={!hasFill}
              />
            </div>

            { hasFill !== undefined && onHasFillChange && (
              <div className="col-span-2 mt-2">
                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasFill}
                    onChange={(e) => {
                      onHasFillChange(e.target.checked);
                      if (e.target.checked) {
                        const n = normalized(hex) || value;
                        onChange(n); setHex(n);
                      }
                    }}
                  />
                  Con relleno
                </label>
              </div>
            )}

            <div className="col-span-2 mt-2">
              {/* <div className="text-xs text-neutral-500 mb-1">Swatches</div> */}
              <div className="grid grid-cols-8 gap-1">
                {["#09f","#111111","#ffffff","#ff4757","#ffa502","#2ed573","#1e90ff","#8e44ad","#f1c40f","#e67e22","#2ecc71","#e84393"].map(c => (
                  <button
                    key={c}
                    type="button"
                    className="h-6 w-6 rounded border border-neutral-300"
                    style={{ backgroundColor: c }}
                    onClick={() => { if (onHasFillChange) {onHasFillChange(true);} onChange(c); setHex(c); setOpen(false); }}
                    title={c}
                  />
                ))}
                {/* Sin relleno */}
                { hasFill !== undefined && onHasFillChange && (
                  <button
                    type="button"
                    className="h-6 w-6 rounded border border-neutral-300 relative"
                    onClick={() => { if (onHasFillChange) onHasFillChange(false); setOpen(false); }}
                    title="Sin relleno"
                  >
                    <span className="absolute inset-0"
                          style={{ background: "repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 50% / 8px 8px" }} />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-7 bg-rose-500 rotate-45" />
                  </button>
                )}
              </div>
            </div>

            <div className="col-span-2 mt-3 flex justify-end">
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
