/** Coordenadas de pantalla: las tolerancias no dependen de hectáreas ni del zoom. */
export interface ScreenPoint { x: number; y: number }

export const TRACE_SAMPLE_PX = 2;
export const TRACE_CLOSE_PX = 22;
export const TRACE_CONTINUE_PX = 24;
export const TRACE_MAX_SAMPLES = 2048;

export const distance = (a: ScreenPoint, b: ScreenPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function traceLength(points: ScreenPoint[]): number {
  return points.slice(1).reduce((length, p, i) => length + distance(points[i], p), 0);
}

function segmentDistanceSquared(p: ScreenPoint, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const denominator = dx * dx + dy * dy;
  const t = denominator ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / denominator)) : 0;
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}

/** Ramer–Douglas–Peucker iterativo: conserva extremos y esquinas sin redondear la parcela. */
export function simplifyTrace(points: ScreenPoint[], tolerance = 1.25): ScreenPoint[] {
  if (points.length < 3) return points.slice();
  const keep = new Set([0, points.length - 1]);
  const ranges = [[0, points.length - 1]];
  while (ranges.length) {
    const [start, end] = ranges.pop()!;
    let max = tolerance * tolerance, index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistanceSquared(points[i], points[start], points[end]);
      if (d > max) { max = d; index = i; }
    }
    if (index !== -1) {
      keep.add(index);
      ranges.push([start, index], [index, end]);
    }
  }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}

export function canSnapClosed(points: ScreenPoint[]): boolean {
  if (points.length < 4 || traceLength(points) < 60) return false;
  // No cerrar un trazo muy pequeño solo porque sus extremos están cerca.
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
  if (Math.min(width, height) < 14) return false;
  const radius = Math.min(TRACE_CLOSE_PX, traceLength(points) * 0.09);
  return distance(points[0], points[points.length - 1]) <= radius;
}

export interface PreparedTrace { points: ScreenPoint[]; closed: boolean; error?: string }

export function prepareTrace(raw: ScreenPoint[]): PreparedTrace {
  if (raw.length < 2 || raw.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return { points: [], closed: false, error: 'No se pudo leer el trazo. Inténtalo de nuevo.' };
  }
  const length = traceLength(raw);
  if (length < 12) return { points: [], closed: false, error: 'El trazo es muy corto. Acerca el mapa y sigue el borde de tu parcela.' };
  let end = raw.length - 1;
  let closed = canSnapClosed(raw);
  // Acepta una pequeña pasada de largo después de volver al inicio, sin borrar bucles grandes.
  if (!closed) {
    let tail = 0;
    for (let i = raw.length - 2; i >= 3; i--) {
      tail += distance(raw[i], raw[i + 1]);
      if (tail > 24) break;
      if (distance(raw[i], raw[0]) <= 10 && canSnapClosed(raw.slice(0, i + 1))) {
        end = i; closed = true; break;
      }
    }
  }
  const input = raw.slice(0, end + 1);
  if (closed) input[input.length - 1] = input[0];
  let points = simplifyTrace(input);
  if (closed && distance(points[0], points[points.length - 1]) < 0.01) points = points.slice(0, -1);
  if (points.length > 256) return { points: [], closed: false, error: 'El contorno tiene demasiados detalles. Traza de nuevo siguiendo solo el borde de la parcela.' };
  if (closed && points.length < 3) return { points: [], closed: false, error: 'No se distingue una superficie. Acerca el mapa y dibuja alrededor de la parcela.' };
  return { points, closed };
}
