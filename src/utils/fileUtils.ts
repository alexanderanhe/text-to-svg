export const isFontFile = (f: File) =>
  /\.(ttf|otf)$/i.test(f.name) ||
  f.type.startsWith("font") ||
  f.type === "application/x-font-ttf" ||
  f.type === "application/x-font-otf";

export const isSvgFile = (f: File) =>
  /\.svg$/i.test(f.name) || f.type === "image/svg+xml";