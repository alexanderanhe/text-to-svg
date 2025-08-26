import React from "react";

type IconButtonProps = {
  onClick?: () => void;
  title?: string;                 // tooltip nativo
  ariaLabel?: string;             // accesibilidad
  children: React.ReactNode;      // tu <Icon ... />
  active?: boolean;               // estado alterno (toggle)
  disabled?: boolean;
  variant?: "default" | "danger"; // para el botón de borrar
  className?: string;             // estilos extra si quieres
};

export function IconButton({
  onClick,
  title,
  ariaLabel,
  children,
  active = false,
  disabled = false,
  variant = "default",
  className = "",
}: IconButtonProps) {
  const base =
    "w-14 h-10 rounded-lg border shadow-sm p-0 " +
    "flex items-center justify-center " +
    (disabled ? "opacity-50 cursor-not-allowed " : "hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-600 ");

  const palette =
    variant === "danger"
      ? (active
          ? "bg-rose-600 text-white border-rose-600 "
          : "bg-white text-rose-600 border-rose-300 hover:bg-rose-50 ")
      : (active
          ? "bg-neutral-900 text-white border-neutral-900 "
          : "bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50 ");

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={ariaLabel || title}
      title={title}
      className={base + palette + className}
    >
      <span className="pointer-events-none flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}
