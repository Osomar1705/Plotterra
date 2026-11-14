import type { PlotPoint } from '../types/fieldshift';

/** Radio medio de la Tierra en metros (WGS84). */
const EARTH_RADIUS_M = 6371008.8;

export const MIN_AREA_HA = 0.05;
export const MAX_AREA_HA = 50;

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Area geodesica del poligono en hectareas. Los puntos van en grados
 * (x = longitud, y = latitud). Usa el area sobre la esfera, suficiente para
 * parcelas: el error es muy inferior al de dibujar el contorno con el dedo.
 */
export function polygonAreaHa(points: PlotPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += rad(b.x - a.x) * (2 + Math.sin(rad(a.y)) + Math.sin(rad(b.y)));
  }
  return Math.abs((sum * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2) / 10000;
}

function onSegment(p: PlotPoint, q: PlotPoint, r: PlotPoint) {
  return Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x)
    && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
}

function orientation(p: PlotPoint, q: PlotPoint, r: PlotPoint) {
  const v = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  if (Math.abs(v) < 1e-14) return 0;
  return v > 0 ? 1 : 2;
}

function segmentsCross(p1: PlotPoint, q1: PlotPoint, p2: PlotPoint, q2: PlotPoint) {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

/**
 * Detecta si el contorno se cruza consigo mismo y devuelve el punto aproximado
 * del cruce, para poder senalarlo en el mapa en lugar de decir solo "invalido".
 */
export function findSelfIntersection(points: PlotPoint[], closed = true): PlotPoint | null {
  const n = points.length;
  if (n < 4) return null;
  const edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i++) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < edges; j++) {
      if (j === i) continue;
      const adjacent = (j === i + 1) || (closed && i === 0 && j === n - 1);
      if (adjacent) continue;
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      if (segmentsCross(a1, a2, b1, b2)) {
        const dx = a2.x - a1.x, dy = a2.y - a1.y;
        const ex = b2.x - b1.x, ey = b2.y - b1.y;
        const denominator = dx * ey - dy * ex;
        if (Math.abs(denominator) > 1e-16) {
          const t = ((b1.x - a1.x) * ey - (b1.y - a1.y) * ex) / denominator;
          return { x: a1.x + t * dx, y: a1.y + t * dy };
        }
        // Solapamiento colineal: señala un extremo que pertenece a ambos segmentos.
        return [a1, a2, b1, b2].find(p => onSegment(a1, p, a2) && onSegment(b1, p, b2)) ?? b1;
      }
    }
  }
  return null;
}

export interface PolygonCheck {
  valid: boolean;
  areaHa: number;
  crossing: PlotPoint | null;
  /** Codigo alineado con el catalogo de errores del backend. */
  code?: 'POLIGONO_INVALIDO' | 'AREA_FUERA_DE_RANGO';
  farmerMessage?: string;
}

export function checkPolygon(points: PlotPoint[]): PolygonCheck {
  const areaHa = polygonAreaHa(points);
  const crossing = findSelfIntersection(points);
  if (crossing) {
    return {
      valid: false, areaHa, crossing, code: 'POLIGONO_INVALIDO',
      farmerMessage: 'El contorno se cruza. Pulsa Deshacer o vuelve a dibujar la parcela.',
    };
  }
  if (points.length >= 3 && (areaHa < MIN_AREA_HA || areaHa > MAX_AREA_HA)) {
    return {
      valid: false, areaHa, crossing: null, code: 'AREA_FUERA_DE_RANGO',
      farmerMessage: areaHa > MAX_AREA_HA
        ? 'Esa superficie parece muy grande para una parcela. Revisa el contorno o escribe las hectáreas a mano.'
        : 'Esa superficie es demasiado pequeña. Revisa el contorno o escribe las hectáreas a mano.',
    };
  }
  return { valid: points.length >= 3, areaHa, crossing: null };
}

export const formatHa = (n: number) => `${n.toFixed(2)} ha`;
