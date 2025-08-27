import { useLayoutEffect } from "react";

type Placement = "bottom" | "top" | "left" | "right";
type Align = "start" | "center" | "end";

export function useConstrainedPopover(opts: {
  open: boolean;
  popoverRef: React.RefObject<HTMLElement>;
  triggerRef?: React.RefObject<HTMLElement>;
  triggerEl?: HTMLElement | null;
  preferred?: Placement;
  align?: Align;
  gap?: number;
  padding?: number;
}) {
  const {
    open, popoverRef, triggerRef, triggerEl,
    preferred = "bottom", align = "start",
    gap = 8, padding = 8,
  } = opts;

  useLayoutEffect(() => {
    if (!open) return;
    const p = popoverRef.current;
    const t = triggerEl ?? triggerRef?.current;
    if (!p || !t) return;

    const place = () => {
      p.style.position = "fixed";
      p.style.maxWidth = `${Math.max(160, window.innerWidth - padding * 2)}px`;
      p.style.maxHeight = `calc(100dvh - ${padding * 2}px)`;
      p.style.overflow = "auto";

      const tr = t.getBoundingClientRect();
      p.style.left = `${Math.round(tr.left)}px`;
      p.style.top = `${Math.round(tr.bottom + gap)}px`;

      const pr = p.getBoundingClientRect();

      let actual: Placement = preferred;

      if (preferred === "bottom" || preferred === "top") {
        const below = window.innerHeight - (tr.bottom + gap) - padding;
        const above = tr.top - gap - padding;
        if (preferred === "bottom" && pr.height > below && above > below) actual = "top";
        if (preferred === "top" && pr.height > above && below > above) actual = "bottom";
      } else {
        const right = window.innerWidth - (tr.right + gap) - padding;
        const left = tr.left - gap - padding;
        if (preferred === "right" && pr.width > right && left > right) actual = "left";
        if (preferred === "left" && pr.width > left && right > left) actual = "right";
      }

      let left = 0, top = 0;

      if (actual === "bottom" || actual === "top") {
        if (align === "start")      left = tr.left;
        else if (align === "end")   left = tr.right - pr.width;
        else                        left = tr.left + (tr.width - pr.width) / 2;

        top = actual === "bottom" ? tr.bottom + gap : tr.top - pr.height - gap;

        left = Math.min(Math.max(padding, left), window.innerWidth - pr.width - padding);
        top  = Math.min(Math.max(padding, top),  window.innerHeight - pr.height - padding);

        p.style.transformOrigin =
          (actual === "bottom" ? "top " : "bottom ") +
          (align === "start" ? "left" : align === "end" ? "right" : "center");
      } else {
        if (align === "start")      top = tr.top;
        else if (align === "end")   top = tr.bottom - pr.height;
        else                        top = tr.top + (tr.height - pr.height) / 2;

        left = actual === "right" ? tr.right + gap : tr.left - pr.width - gap;

        left = Math.min(Math.max(padding, left), window.innerWidth - pr.width - padding);
        top  = Math.min(Math.max(padding, top),  window.innerHeight - pr.height - padding);

        p.style.transformOrigin =
          (align === "start" ? "top" : align === "end" ? "bottom" : "center") +
          (actual === "right" ? " left" : " right");
      }

      p.style.left = `${Math.round(left)}px`;
      p.style.top  = `${Math.round(top)}px`;
      p.dataset.placement = actual;
    };

    place();
    const onResize = () => requestAnimationFrame(place);
    const onScroll = () => requestAnimationFrame(place);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    const ro = new ResizeObserver(() => place());
    ro.observe(document.body);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      ro.disconnect();
    };
  }, [open, popoverRef, triggerRef, triggerEl, preferred, align, gap, padding]);
}
