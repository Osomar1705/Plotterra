import type { Outcomes, ScenarioFamily, ScenarioMeta } from '../../types/fieldshift';

// El motor sortea el tamano del golpe en cada futuro (p. ej. lluvia entre −15 % y
// −45 %): el rotulo de la familia no promete una cifra fija; la etiqueta de cada
// futuro muestra la suya.
export const FAMILY_LABEL: Record<ScenarioFamily, string> = {
  tipica: 'Clima típico',
  menos_lluvia: 'Menos lluvia',
  menos_riego: 'Menos riego',
  caida_precio: 'Precio más bajo',
  combinado: 'Todo junto',
};
export const FAMILY_ORDER: ScenarioFamily[] = ['tipica', 'menos_lluvia', 'menos_riego', 'caida_precio', 'combinado'];

export type CellTone = 'gain-3' | 'gain-2' | 'gain-1' | 'neutral' | 'loss-1' | 'loss-2' | 'loss-3';

/** Escala divergente por tercios de la magnitud máxima (ganancia/pérdida). Solo presenta datos del backend. */
export function toneScale(values: number[]) {
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  return (v: number): CellTone => {
    const t = v / maxAbs;
    if (Math.abs(t) < 0.02) return 'neutral';
    const level = Math.abs(t) < 0.33 ? 1 : Math.abs(t) < 0.66 ? 2 : 3;
    return (t > 0 ? `gain-${level}` : `loss-${level}`) as CellTone;
  };
}

export const money = (n: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 }).format(Math.round(n));
export const signedMoney = (n: number) => `${n < 0 ? '−' : ''}S/ ${money(Math.abs(n))}`;

export function summarize(o: Outcomes) {
  const v = o.marginByScenario;
  const wins = o.wins ?? v.filter((x) => x > 0).length;
  return { total: v.length, wins, losses: o.losses ?? v.filter((x) => x < 0).length, mean: o.mean, adverse: o.adverse };
}

/** "−22 % lluvia · −40 % riego" con los factores reales del escenario; si no vienen, el rotulo de la familia. */
function familyDetail(s: ScenarioMeta) {
  const cut = (f: number | undefined, what: string) => (f !== undefined && f < 0.995 ? `−${Math.round((1 - f) * 100)} % ${what}` : '');
  const parts = [cut(s.rainFactor, 'lluvia'), cut(s.irrigationFactor, 'riego'), cut(s.priceFactor, 'precio')].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return FAMILY_LABEL[s.family];
}

export function scenarioLabel(i: number, scenarios?: ScenarioMeta[], withFamily = true) {
  const s = scenarios?.[i];
  if (!s) return `Futuro ${i + 1}`;
  const first = s.climateYears[0]?.slice(0, 4), last = s.climateYears.at(-1)?.slice(-4);
  const years = first ? `clima ${first === last ? first : `${first}–${last}`}` : '';
  return [`Futuro ${i + 1}`, years, withFamily ? familyDetail(s) : ''].filter(Boolean).join(' · ');
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
