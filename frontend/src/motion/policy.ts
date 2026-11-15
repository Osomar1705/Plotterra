export const SOFT_EASE = [0.22, 1, 0.36, 1] as const;
export const SOFT_SPRING = { stiffness: 88, damping: 26, mass: 0.7 };
export const SELECTION_SPRING = { type: 'spring' as const, stiffness: 360, damping: 38, mass: 0.8 };
const clamp = (n: number, min: number, max: number) => Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;

/** A small camera movement, independent of the size of the source photograph. */
export function photoPose(x: number, y: number) {
  const nx = clamp(x, -1, 1), ny = clamp(y, -1, 1);
  return { x: nx * 7, y: ny * 4, rotateX: ny * -1.4, rotateY: nx * 1.8 };
}
export function scrollDepth(centerY: number, viewportHeight: number, compact: boolean) {
  if (!(viewportHeight > 0) || !Number.isFinite(centerY)) return 0;
  return clamp((centerY - viewportHeight / 2) / viewportHeight, -0.5, 0.5) * (compact ? 6 : 12);
}
