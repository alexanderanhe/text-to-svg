import { useEffect, useRef, useState } from "react";
import type { Tool } from "../types/strokes";

type ToolsContainerProps = {
  children: React.ReactNode;
  tool: Tool;
}
export default function ToolsContainer({ children, tool}: ToolsContainerProps) {
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function updateArrows() {
    const el = toolsRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = Math.max(0, scrollWidth - clientWidth);
    const EPS = 1; // tolerancia por decimales/AA
    setCanLeft(scrollLeft > EPS);
    setCanRight(scrollLeft < max - EPS);
  }

  useEffect(() => {
    const el = toolsRef.current;
    if (!el) return;
    updateArrows();

    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => updateArrows());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    // cuando cambie la herramienta, regresa al inicio
    const el = toolsRef.current;
    if (!el) return;
    el.scrollTo({ left: 0, behavior: "auto" });
    // espera al layout para medir bien
    requestAnimationFrame(updateArrows);
  }, [tool]); // <-- usa tu estado `tool`

  const handleToolsScroll = (direction: number) => () => {
    const el = toolsRef.current;
    if (!el) return;
    const page = el.clientWidth; // “página” visible
    const target = Math.max(
      0,
      Math.min(el.scrollLeft + page * direction, el.scrollWidth - el.clientWidth)
    );
    el.scrollTo({ left: target, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canLeft && (
        <button
          className="absolute left-0 p-2 h-full rounded-lg border shadow-sm flex items-center justify-center hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-600 bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50 z-10"
          onClick={handleToolsScroll(-1)}
          aria-hidden={!canLeft}
        >
          {"<"}
        </button>
      )}

      {canRight && (
        <button
          className="absolute right-0 p-2 h-full rounded-lg border shadow-sm flex items-center justify-center hover:shadow focus:outline-none focus:ring-2 focus:ring-neutral-600 bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50 z-10"
          onClick={handleToolsScroll(1)}
          aria-hidden={!canRight}
        >
          {">"}
        </button>
      )}
      <div className="flex w-full snap-x snap-mandatory [&>*]:snap-center overflow-x-scroll no-scrollbar items-center gap-1 pb-2" ref={toolsRef}>
        {children}
      </div>
    </div>
  )
}