import React from "react";

const SIZE_PRESETS = [2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 64];

type BrushSizeSelectProps = {
  value: number;
  color: string;
  onChange: (n: number) => void;
  className?: string;
};

export function BrushSizeSelect({ value, color='#000000', onChange, className }: BrushSizeSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(
    Math.max(0, SIZE_PRESETS.findIndex((s) => s === value))
  );
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);

  React.useEffect(() => {
    const i = SIZE_PRESETS.findIndex((s) => s === value);
    if (i >= 0) setActiveIndex(i);
  }, [value]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!btnRef.current || !listRef.current) return;
      const t = e.target as Node;
      if (!btnRef.current.contains(t) && !listRef.current.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const commit = (n: number) => {
    onChange(n);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        e.preventDefault();
        setOpen(true);
        // enfocar el activo al abrir
        requestAnimationFrame(() => {
          const el = document.getElementById(`size-opt-${activeIndex}`);
          (el as HTMLLIElement | null)?.focus?.();
        });
        break;
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % SIZE_PRESETS.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + SIZE_PRESETS.length) % SIZE_PRESETS.length);
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(SIZE_PRESETS.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(SIZE_PRESETS[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
        break;
    }
  };

  const VISUAL_CAP = 28;
  const current = Math.max(2, Math.min(VISUAL_CAP, value));

  return (
    <div className={className}>
      <div className="relative inline-block">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-44 justify-between inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50"
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onButtonKeyDown}
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 rounded-md border border-neutral-200 bg-white flex items-center justify-center">
              <div
                className={"w-14 rounded-full"}
                style={{ height: `${current}px`, backgroundColor: color }}
                aria-hidden
              />
            </div>
            <span className="text-sm tabular-nums">{value}px</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 20 20" className="opacity-70" aria-hidden>
            <path d="M5 7l5 5 5-5" fill="currentColor" />
          </svg>
        </button>

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`size-opt-${activeIndex}`}
            onKeyDown={onListKeyDown}
            className="absolute z-50 mt-2 w-56 max-h-72 overflow-auto rounded-xl border border-neutral-200 bg-white shadow-lg p-1"
          >
            {SIZE_PRESETS.map((s, i) => {
              const h = Math.max(2, Math.min(VISUAL_CAP, s));
              const selected = s === value;
              const active = i === activeIndex;
              return (
                <li
                  id={`size-opt-${i}`}
                  key={s}
                  role="option"
                  aria-selected={selected}
                  tabIndex={active ? 0 : -1}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(s)}
                  className={[
                    "flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer",
                    active
                      ? "bg-sky-50 text-sky-900"
                      : "hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <div className="h-8 w-28 rounded-md border border-neutral-200 bg-white flex items-center justify-center">
                    <div
                      className="w-24 rounded-full bg-neutral-900"
                      style={{ height: `${h}px` }}
                      aria-hidden
                    />
                  </div>
                  <span className="text-sm tabular-nums">{s}px</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
