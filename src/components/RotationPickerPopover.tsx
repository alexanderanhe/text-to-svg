import { useEffect, useId, useRef, useState } from "react";
import { useConstrainedPopover } from "../hook/useConstrainedPopover";

type Placement = "bottom" | "top" | "left" | "right";
type Align = "start" | "center" | "end";

type RotationPickerPopoverProps = {
  value: number;
  onChange: (deg: number) => void;
  min?: number;                 // default -180
  max?: number;                 // default 180
  step?: number;                // default 1
  presets?: number[];           // default [-90,-45,0,45,90]
  snap?: number | null;         // default 15 (usa null para desactivar)
  decimals?: number;            // default 0
  preferred?: Placement;        // default "bottom"
  align?: Align;                // default "start"
  open?: boolean;               // controlado (opcional)
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  className?: string;           // clases extra para el contenedor
  ariaLabel?: string;           // etiqueta accesible del botón trigger
  showNormalized?: boolean;     // default true
};

export const RotationPickerPopover: React.FC<RotationPickerPopoverProps> = ({
  value,
  onChange,
  min = -180,
  max = 180,
  step = 1,
  presets = [-90, -45, 0, 45, 90],
  snap = 15,
  decimals = 0,
  preferred = "bottom",
  align = "start",
  open: controlledOpen,
  onOpenChange,
  disabled,
  className = "",
  ariaLabel = "Seleccionar rotación",
  showNormalized = true,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  useConstrainedPopover({
    open,
    popoverRef: popoverRef as React.RefObject<HTMLElement>,
    triggerRef: triggerRef as React.RefObject<HTMLElement>,
    preferred,
    align,
    gap: 8,
    padding: 8,
  });

  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setUncontrolledOpen(v);
  };

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const p = popoverRef.current;
      const t = triggerRef.current;
      if (!p || !t) return;
      const target = e.target as Node;
      if (!p.contains(target) && !t.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const apply = (n: number) => {
    const snapped = snap && snap > 0 ? Math.round(n / snap) * snap : n;
    onChange(clamp(snapped));
  };
  const fmt = (n: number) => n.toFixed(decimals);
  const norm = ((value % 360) + 360) % 360;

  const onPopoverKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); apply(value - (e.shiftKey ? 5 : 1)); }
    if (e.key === "ArrowRight"){ e.preventDefault(); apply(value + (e.shiftKey ? 5 : 1)); }
  };

  return (
    <div className={`inline-flex ${className}`}>
      {/* Trigger: altura fija 40px */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="h-10 px-3 rounded-lg border border-neutral-300 bg-white text-neutral-900 flex items-center gap-2 hover:border-neutral-400 active:scale-[0.99] disabled:opacity-50"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={ariaLabel}
        style={{ lineHeight: 1 }} // evita exceder 40px por line-height
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M12 4a8 8 0 1 1-7.07 4.47" />
          <path d="M3 4h6v6" />
        </svg>
        <span className="font-mono tabular-nums">{fmt(value)}°</span>
      </button>

      {/* Popover (se monta solo cuando está abierto) */}
      {open && (
        <div
          id={popoverId}
          ref={popoverRef}
          role="dialog"
          aria-label="Selector de rotación"
          className="z-[1000] rounded-xl border border-neutral-200 bg-white shadow-lg p-3 select-none w-[min(320px,calc(100vw-32px))]"
          style={{ willChange: "left, top" }}
          onKeyDown={onPopoverKeyDown}
        >
          <div className="flex items-center gap-3 mb-3">
            {/* Indicador visual */}
            <div className="relative w-14 h-14 rounded-full border border-neutral-300 grid place-items-center shrink-0">
              <div
                className="absolute w-0.5 h-6 rounded-full bg-neutral-800 origin-bottom"
                style={{ transform: `translateY(4px) rotate(${norm}deg)` }}
                aria-hidden="true"
              />
              <div className="text-[10px] text-neutral-500">N</div>
            </div>

            <div className="flex flex-col">
              <div className="text-2xl leading-none font-semibold font-mono tabular-nums">
                {fmt(value)}°
              </div>
              {showNormalized && (
                <div className="text-xs text-neutral-500">Normalized: {fmt(norm)}°</div>
              )}
            </div>
          </div>

          {/* Slider */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => apply(+e.target.value)}
            className="w-full accent-neutral-800"
            aria-label="Rotación"
          />

          {/* Controles finos + input */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" className="px-2 h-10 rounded-lg border border-neutral-300 text-sm" onClick={() => apply(value - 5)} aria-label="Disminuir 5 grados">−5°</button>
              <button type="button" className="px-2 h-10 rounded-lg border border-neutral-300 text-sm" onClick={() => apply(value - 1)} aria-label="Disminuir 1 grado">−1°</button>
            </div>

            <div className="flex items-center gap-1">
              <input
                type="number"
                step={step}
                min={min}
                max={max}
                value={Number.isFinite(value) ? value : 0}
                onChange={(e) => apply(+e.target.value || 0)}
                className="w-24 h-10 p-2 rounded-lg border border-neutral-300 text-right"
                aria-label="Grados"
              />
              <span className="text-sm text-neutral-500">°</span>
            </div>

            <div className="flex items-center gap-1">
              <button type="button" className="px-2 h-10 rounded-lg border border-neutral-300 text-sm" onClick={() => apply(value + 1)} aria-label="Aumentar 1 grado">+1°</button>
              <button type="button" className="px-2 h-10 rounded-lg border border-neutral-300 text-sm" onClick={() => apply(value + 5)} aria-label="Aumentar 5 grados">+5°</button>
            </div>
          </div>

          {/* Presets */}
          {!!presets.length && (
            <div className="mt-3 grid grid-cols-5 gap-1">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`h-8 rounded-md border text-sm
                    ${value === p ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-400"}`}
                  onClick={() => apply(p)}
                  title={`${p}°`}
                >
                  {p}°
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
