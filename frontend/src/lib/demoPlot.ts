import type { PlotPoint } from '../types/fieldshift';

/**
 * Chacra de ejemplo de Ambo. Es la misma geometria que el backend guarda en
 * datasets/cobertura.json (parcela_demostrativa, celda 100201) y esta dentro de
 * la superficie agricola del MIDAGRI. Sirve para que la demo no dependa de
 * buscar ni de dibujar en vivo.
 */
export const DEMO_PLOT_POINTS: PlotPoint[] = [
  { x: -76.176016, y: -10.112243 },
  { x: -76.174616, y: -10.112243 },
  { x: -76.174616, y: -10.113643 },
  { x: -76.176016, y: -10.113643 },
];

export const DEMO_PLOT_LOCALITY = 'Ambo, Huánuco, Perú';

/** Vista inicial del mapa: el valle de Ambo. */
export const INITIAL_VIEW = { lat: -10.13, lon: -76.2, zoom: 13 };
