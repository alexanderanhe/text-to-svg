export type Tool = "select" | "text" | "pen" | "eraser" | "shape";
export type Pt = { x: number; y: number };

export type Base = {
  id: string;
  z: number;
  visible: boolean;
  locked: boolean;
};

export type PenStroke = Base & {
  type: "pen";
  color: string;
  size: number;
  points: Pt[];
};

export type EraserStroke = {
  id: string;
  type: "eraser";
  z: number;
  visible: boolean;
  locked: boolean;
  size: number;
  points: Pt[];
  targetIds: string[];
};

export type TextStroke = Base & {
  type: "text";
  text: string;
  fontFamily: string;
  fill: string;
  lineHeight: number;
  x: number; y: number;
  size: number;
  rotation: number;
  align: "left" | "center" | "right";
};

export type SvgStroke = Base & {
  type: "svg";
  svg: string;
  x: number; y: number;
  scale: number;
  rotation: number;
  iw: number; ih: number;
  vbX?: number; vbY?: number; vbW?: number; vbH?: number;
};

export type ShapeKind = "rect" | "ellipse" | "line";

export type ShapeStroke = Base & {
  type: "shape";
  kind: ShapeKind;
  x: number; y: number;   // esquina sup-izq del bbox (o punto inicial para line)
  w: number; h: number;   // tamaño (para line: dx, dy)
  fill: string;           // "none" para sin relleno
  stroke: string;
  strokeWidth: number;
  rx?: number;            // radio esquinas (solo rect)
};

export type Stroke = PenStroke | EraserStroke | TextStroke | SvgStroke | ShapeStroke;
export type StrokeType = Stroke["type"];
export type Handle = "nw" | "ne" | "sw" | "se";
export type FontGoogle = [string, string];