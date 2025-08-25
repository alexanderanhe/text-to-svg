import React, { useEffect, useMemo, useRef, useState } from "react";

// ————————————————————————————————————————————————————————————————
// Types
// ————————————————————————————————————————————————————————————————
export type MenuItem = {
  id: string;
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void;
  separator?: boolean;
};

export type Menu = {
  id: string;
  label: string;
  items: MenuItem[];
};

// ————————————————————————————————————————————————————————————————
// Default data (Archivo | Edición)
// ————————————————————————————————————————————————————————————————
const defaultMenus: Menu[] = [
  {
    id: "archivo",
    label: "Archivo",
    items: [
      { id: "nuevo", label: "Nuevo", shortcut: "⌘N" },
      { id: "abrir", label: "Abrir…", shortcut: "⌘O" },
      { id: "guardar", label: "Guardar", shortcut: "⌘S" },
      { id: "guardar-como", label: "Guardar como…", shortcut: "⇧⌘S" },
      { separator: true, id: "sep1" },
      { id: "cerrar", label: "Cerrar", shortcut: "⌘W" },
    ],
  },
  {
    id: "edicion",
    label: "Edición",
    items: [
      { id: "deshacer", label: "Deshacer", shortcut: "⌘Z" },
      { id: "rehacer", label: "Rehacer", shortcut: "⇧⌘Z" },
      { separator: true, id: "sep2" },
      { id: "cortar", label: "Cortar", shortcut: "⌘X" },
      { id: "copiar", label: "Copiar", shortcut: "⌘C" },
      { id: "pegar", label: "Pegar", shortcut: "⌘V" },
      { separator: true, id: "sep3" },
      { id: "seleccionar-todo", label: "Seleccionar todo", shortcut: "⌘A" },
    ],
  },
];

// ————————————————————————————————————————————————————————————————
// Helper utils
// ————————————————————————————————————————————————————————————————
function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// Returns only focusable items (excludes separators & disabled)
function getFocusable(items: MenuItem[]) {
  return items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !it.separator && !it.disabled);
}

// ————————————————————————————————————————————————————————————————
// Component: ClassicMenuBar
// ————————————————————————————————————————————————————————————————
export default function ClassicMenuBar({
  menus = defaultMenus,
  onAction,
  className,
}: {
  menus?: Menu[];
  onAction?: (menuId: string, itemId: string) => void;
  className?: string;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeItemIdx, setActiveItemIdx] = useState<number>(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Compute a map of focusable indices per menu to handle arrow navigation
  const focusableMap = useMemo(() => {
    const map: Record<string, { focusables: { it: MenuItem; i: number }[] }> = {};
    menus.forEach((m) => {
      map[m.id] = { focusables: getFocusable(m.items) };
    });
    return map;
  }, [menus]);

  // Close on outside click
  useEffect(() => {
    function onPointerDown(ev: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(ev.target as Node)) {
        setOpenMenuId(null);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Focus currently active menu item when menu or index changes
  useEffect(() => {
    if (!openMenuId) return;
    const id = `menu-${openMenuId}-item-${activeItemIdx}`;
    const el = document.getElementById(id) as HTMLButtonElement | null;
    el?.focus();
  }, [openMenuId, activeItemIdx]);

  // Helpers to move focus between top-level menu buttons
  const moveTopFocus = (dir: 1 | -1) => {
    const idx = menus.findIndex((m) => m.id === (openMenuId ?? document.activeElement?.getAttribute("data-menu-id")));
    const fallbackIdx = Math.max(0, idx);
    const next = (fallbackIdx + dir + menus.length) % menus.length;
    const nextMenu = menus[next];
    const btn = buttonRefs.current[nextMenu.id];
    btn?.focus();
    setOpenMenuId(nextMenu.id);
    setActiveItemIdx(0);
  };

  const handleMenubarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const targetMenuId = target.getAttribute("data-menu-id");

    switch (e.key) {
      case "ArrowDown":
      case "Enter":
      case " ": {
        if (!targetMenuId) return;
        e.preventDefault();
        if (openMenuId !== targetMenuId) setOpenMenuId(targetMenuId);
        setActiveItemIdx(0);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        moveTopFocus(1);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        moveTopFocus(-1);
        break;
      }
      case "Escape": {
        setOpenMenuId(null);
        (buttonRefs.current[targetMenuId ?? ""] as HTMLButtonElement | null)?.focus?.();
        break;
      }
    }
  };

  const handleMenuKeyDown = (menuId: string) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const focusables = focusableMap[menuId]?.focusables ?? [];
    const last = Math.max(0, focusables.length - 1);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setActiveItemIdx((i) => (i >= last ? 0 : i + 1));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setActiveItemIdx((i) => (i <= 0 ? last : i - 1));
        break;
      }
      case "Home": {
        e.preventDefault();
        setActiveItemIdx(0);
        break;
      }
      case "End": {
        e.preventDefault();
        setActiveItemIdx(last);
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        moveTopFocus(1);
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        moveTopFocus(-1);
        break;
      }
      case "Escape": {
        e.preventDefault();
        setOpenMenuId(null);
        buttonRefs.current[menuId]?.focus();
        break;
      }
      case "Enter":
      case " ": {
        e.preventDefault();
        const focusable = focusables[activeItemIdx];
        if (focusable) triggerSelect(menuId, focusable.it);
        break;
      }
    }
  };

  const triggerSelect = (menuId: string, item: MenuItem) => {
    if (item.disabled || item.separator) return;
    item.onSelect?.();
    onAction?.(menuId, item.id);
    setOpenMenuId(null);
    // Return focus to the button for usability
    buttonRefs.current[menuId]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className={clsx(
        "relative w-full select-none",
        className
      )}
    >
      <nav
        role="menubar"
        aria-label="Barra de menús"
        onKeyDown={handleMenubarKeyDown}
        className={clsx(
          "flex gap-2"
        )}
      >
        {menus.map((menu) => {
          const isOpen = openMenuId === menu.id;
          return (
            <div key={menu.id} className="relative">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                data-menu-id={menu.id}
                id={`menubutton-${menu.id}`}
                ref={(el) => {buttonRefs.current[menu.id] = el}}
                className={clsx(
                  "px-3 py-1.5 text-sm font-medium rounded-lg",
                  "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40",
                  isOpen && "bg-slate-100",
                )}
                onClick={() => {
                  setActiveItemIdx(0);
                  setOpenMenuId((prev) => (prev === menu.id ? null : menu.id));
                }}
                onMouseEnter={() => {
                  // If another menu is already open, hovering swaps it (classic desktop behavior)
                  setActiveItemIdx(0);
                  setOpenMenuId((prev) => (prev ? menu.id : prev));
                }}
              >
                {menu.label}
              </button>

              {/* Dropdown */}
              {isOpen && (
                <div
                  role="menu"
                  aria-labelledby={`menubutton-${menu.id}`}
                  id={`menu-${menu.id}-list`}
                  tabIndex={-1}
                  onKeyDown={handleMenuKeyDown(menu.id)}
                  className={clsx(
                    "absolute left-0 z-50 mt-1 min-w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg",
                  )}
                >
                  <div className="py-1">
                    {menu.items.map((item, rawIndex) => {
                      if (item.separator) {
                        return (
                          <div
                            key={`sep-${rawIndex}`}
                            role="separator"
                            className="my-1 border-t border-slate-200"
                          />
                        );
                      }

                      // Map raw index to focusable index for id
                      const focusables = focusableMap[menu.id]?.focusables ?? [];
                      const focusIdx = focusables.findIndex(({ i }) => i === rawIndex);
                      const isDisabled = !!item.disabled;
                      const isActive = activeItemIdx === focusIdx && !isDisabled;

                      return (
                        <button
                          key={item.id}
                          id={`menu-${menu.id}-item-${focusIdx}`}
                          role="menuitem"
                          tabIndex={-1}
                          aria-disabled={isDisabled}
                          disabled={isDisabled}
                          onMouseEnter={() => {
                            if (!isDisabled && focusIdx >= 0) setActiveItemIdx(focusIdx);
                          }}
                          onClick={() => triggerSelect(menu.id, item)}
                          className={clsx(
                            "flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-[13px]",
                            isActive
                              ? "bg-sky-50 text-sky-900"
                              : "hover:bg-slate-50",
                            isDisabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span>{item.label}</span>
                          {item.shortcut && (
                            <span className="font-mono text-[11px] opacity-60">{item.shortcut}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}