export type Face = "top" | "front" | "bottom" | "back" | "left" | "right";
export const FACES = [
  "left",
  "right",
  "bottom",
  "top",
  "back",
  "front",
] as Face[];

export const FACE_OPPOSITE_MAP: Record<Face, number> = {
  front: FACES.indexOf("back"),
  back: FACES.indexOf("front"),
  top: FACES.indexOf("bottom"),
  bottom: FACES.indexOf("top"),
  left: FACES.indexOf("right"),
  right: FACES.indexOf("left"),
} as const;
