export function getCanvasPos(canvas: HTMLCanvasElement, e: React.PointerEvent) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width;
  const sy = canvas.height / r.height;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

export function withRotation(
  ctx: CanvasRenderingContext2D,
  angleRad: number,
  cx: number, cy: number,
  draw: ()=>void
){
  if (!angleRad) { draw(); return; }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}
