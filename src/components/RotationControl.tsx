import * as React from "react";

type RotationControlProps = {
  value: number;
  onChange: (deg: number) => void;
  min?: number;       // default: -180
  max?: number;       // default: 180
  step?: number;      // default: 1
  presets?: number[]; // default: [-90, -45, 0, 45, 90]
  snap?: number | null; // si se define (p.ej. 15), redondea al múltiplo más cercano
  disabled?: boolean;
  className?: string;
};

export const RotationControl: React.FC<RotationControlProps> = ({
  value,
  onChange,
  min = -180,
  max = 180,
  step = 1,
  presets = [-90, -45, 0, 45, 90],
  snap = null,
  disabled,
  className = "",
}) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const apply = (n: number) => {
    const snapped =
      snap && snap > 0 ? Math.round(n / snap) * snap : n;
    onChange(clamp(snapped));
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Fila principal: slider + controles finos + input */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => apply(+e.target.value)}
          disabled={disabled}
          className="w-36 sm:w-44 accent-neutral-800"
          aria-label="Rotation slider"
        />

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="px-2 h-10 rounded-lg border border-neutral-300 text-sm"
            onClick={() => apply(value - 5)}
            disabled={disabled}
            aria-label="Decrease 5 degrees"
          >
            −5°
          </button>
          <button
            type="button"
            className="px-2 h-10 rounded-lg border border-neutral-300 text-sm"
            onClick={() => apply(value - 1)}
            disabled={disabled}
            aria-label="Decrease 1 degree"
          >
            −1°
          </button>

          <div className="flex items-center gap-1">
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              value={value}
              onChange={(e) => apply(+e.target.value || 0)}
              disabled={disabled}
              className="w-20 h-10 p-2 rounded-lg border border-neutral-300 text-right"
              aria-label="Rotation degrees"
            />
            <span className="text-sm text-neutral-500 select-none">°</span>
          </div>

          <button
            type="button"
            className="px-2 h-10 rounded-lg border border-neutral-300 text-sm"
            onClick={() => apply(value + 1)}
            disabled={disabled}
            aria-label="Increase 1 degree"
          >
            +1°
          </button>
          <button
            type="button"
            className="px-2 h-10 rounded-lg border border-neutral-300 text-sm"
            onClick={() => apply(value + 5)}
            disabled={disabled}
            aria-label="Increase 5 degrees"
          >
            +5°
          </button>
        </div>
      </div>

      {/* Presets */}
      {presets?.length ? (
        <div className="grid grid-cols-5 gap-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={`h-8 rounded-md border text-sm
                ${value === p
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 hover:border-neutral-400"}`}
              onClick={() => apply(p)}
              disabled={disabled}
              aria-label={`Set to ${p} degrees`}
              title={`${p}°`}
            >
              {p}°
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
