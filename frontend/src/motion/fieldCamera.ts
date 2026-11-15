/** Decorative test-field camera; never generates or interprets agricultural results. */
export type Vec3 = [number, number, number];
export const CAMERA_DURATION = 2200;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export function cameraPose(progress: number): Vec3 {
  const t = smoothstep(progress);
  // A real dolly towards the field, followed by a gentle overhead landing.
  const radius = mix(30, 13.2, t);
  const elevation = mix(.54, Math.PI / 2 - .001, t);
  const azimuth = mix(.62, 0, t);
  return [radius * Math.cos(elevation) * Math.sin(azimuth), radius * Math.sin(elevation), radius * Math.cos(elevation) * Math.cos(azimuth)];
}
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize = (v: Vec3): Vec3 => { const n = Math.hypot(...v); return v.map(x=>x/n) as Vec3; };
const dot = (a: Vec3, b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function cameraBasis(eye: Vec3) {
  const forward = normalize(subtract([0,0,0],eye));
  const right = normalize(cross(forward,[0,1,0]));
  const up = cross(right,forward);
  return {right,up,forward};
}
/** World -> NDC projection, also used to verify framing without a GPU. */
export function projectPoint(point: Vec3, eye: Vec3, aspect: number, basis = cameraBasis(eye)): Vec3 {
  const {right,up,forward}=basis, p=subtract(point,eye);
  const z=dot(p,forward), focal=1/Math.tan(Math.PI/12);
  return [dot(p,right)*focal/aspect/z,dot(p,up)*focal/z,z];
}
