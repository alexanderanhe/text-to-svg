export function parseSVGMeta(svg: string): { width?: number; height?: number; vbX?: number; vbY?: number; vbW?: number; vbH?: number } {
  const mView = svg.match(/viewBox\s*=\s*"([\d\.\-eE]+)\s+([\d\.\-eE]+)\s+([\d\.\-eE]+)\s+([\d\.\-eE]+)"/i);
  const mW = svg.match(/\swidth\s*=\s*"([\d\.]+)(px)?"/i);
  const mH = svg.match(/\sheight\s*=\s*"([\d\.]+)(px)?"/i);
  const out: any = {};
  if (mView) {
    out.vbX = +mView[1]; out.vbY = +mView[2]; out.vbW = +mView[3]; out.vbH = +mView[4];
  }
  if (mW) out.width = +mW[1];
  if (mH) out.height = +mH[1];
  return out;
}

export function sanitizeForEmbed(src: string) {
  let s = src.replace(/^\uFEFF/, "");
  s = s.replace(/<\?xml[\s\S]*?\?>/gi, "");
  s = s.replace(/<\?[\s\S]*?\?>/g, "");
  s = s.replace(/<!DOCTYPE[\s\S]*?>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<metadata[\s\S]*?<\/metadata>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\s+on[a-z\-]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");
  return s.trim();
}

export function extractSvgInner(svg: string) {
  const s = sanitizeForEmbed(svg);
  const m = s.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
  return m ? m[1] : s;
}