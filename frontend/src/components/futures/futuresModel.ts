import { displayMoney } from '../../lib/money';
import type { Outcomes, ScenarioFamily, ScenarioMeta } from '../../types/fieldshift';

export const FAMILY_LABEL: Record<ScenarioFamily, string> = {
  tipica: 'Typical conditions',
  // The engine draws a different shock in every test (e.g. rain 15-45 % lower):
  // the family label does not promise a fixed figure; each test shows its own.
  menos_lluvia: 'Less rain',
  menos_riego: 'Less irrigation',
  caida_precio: 'Lower prices',
  combinado: 'Combined changes',
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
export const signedMoney = (n: number) => displayMoney(n);

export function summarize(o: Outcomes) {
  const v = o.marginByScenario;
  const wins = o.wins ?? v.filter((x) => x > 0).length;
  const avg = v.length ? v.reduce((sum,x)=>sum+x,0)/v.length : undefined;
  const worst = [...v].sort((a,b)=>a-b).slice(0,Math.min(10,v.length));
  const adverse = worst.length ? worst.reduce((sum,x)=>sum+x,0)/worst.length : undefined;
  return { total: v.length, wins, losses: o.losses ?? v.filter((x) => x < 0).length, mean: avg, adverse };
}

/** "−22 % rain · −40 % irrigation" with the real factors of the test; else the family label. */
function familyDetail(s: ScenarioMeta) {
  const cut = (f: number | undefined, what: string) => (f !== undefined && f < 0.995 ? `−${Math.round((1 - f) * 100)} % ${what}` : '');
  const parts = [cut(s.rainFactor, 'rain'), cut(s.irrigationFactor, 'irrigation'), cut(s.priceFactor, 'price')].filter(Boolean);
  return parts.length ? parts.join(' · ') : FAMILY_LABEL[s.family];
}

export function scenarioLabel(i: number, scenarios?: ScenarioMeta[], withFamily = true) {
  const s = scenarios?.[i];
  if (!s) return `Case ${i + 1}`;
  const first = s.climateYears[0]?.slice(0, 4), last = s.climateYears.at(-1)?.slice(-4);
  const years = first ? `weather ${first === last ? first : `${first}–${last}`}` : '';
  return [`Case ${i + 1}`, years, withFamily ? familyDetail(s) : ''].filter(Boolean).join(' · ');
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
