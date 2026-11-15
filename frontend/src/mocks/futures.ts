import type { Outcomes, ScenarioFamily, ScenarioMeta } from '../types/fieldshift';

/**
 * Datos de DEMOSTRACIÓN deterministas (semilla fija) con la misma forma que el backend:
 * 40 futuros típicos + 15 de cada perturbación, que reutilizan futuros base.
 * Solo se usan con VITE_USE_LOCAL_MOCKS=true.
 */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

const FAMILY_PLAN: { family: ScenarioFamily; n: number; shift: number }[] = [
  { family: 'tipica', n: 40, shift: 0 },
  { family: 'menos_lluvia', n: 15, shift: -0.32 },
  { family: 'menos_riego', n: 15, shift: -0.14 },
  { family: 'caida_precio', n: 15, shift: -0.85 },
  { family: 'combinado', n: 15, shift: -0.9 },
];

export const mockScenarios: ScenarioMeta[] = (() => {
  const r = mulberry32(2026);
  const out: ScenarioMeta[] = [];
  const baseStart: number[] = [];
  for (let i = 0; i < 40; i++) baseStart.push(1984 + Math.floor(r() * 38));
  FAMILY_PLAN.forEach(({ family, n }) => {
    for (let i = 0; i < n; i++) {
      const b = family === 'tipica' ? i : Math.floor(r() * 40);
      const y = baseStart[b];
      out.push({ id: `esc_${String(out.length).padStart(3, '0')}`, family, baseId: `esc_${String(b).padStart(3, '0')}`,
        climateYears: [0, 1, 2].map((k) => `${y + k}-${y + k + 1}`) });
    }
  });
  return out;
})();

/** Márgenes coherentes por escenario: los perturbados derivan de su futuro base. */
export function mockOutcomes(seed: number, mean: number, spread: number, irrigationPenalty = 0): Outcomes {
  const r = mulberry32(seed);
  // Shared weather/economic shock for the same indexed scenario across all plans.
  const shared = mulberry32(20261114);
  const baseShock = Array.from({length:40},()=>gauss(shared));
  const base = baseShock.map(v=>mean+spread*v+spread*0.12*gauss(r));
  const values = mockScenarios.map((s, i) => {
    const plan = FAMILY_PLAN.find((f) => f.family === s.family)!;
    const b = Number(s.baseId!.slice(4));
    const v = s.family === 'tipica' ? base[i] : base[b] + plan.shift * Math.abs(mean) + 0.12 * spread * gauss(r);
    return Math.round((v - irrigationPenalty * (0.6 + 0.4 * r())) / 10) * 10;
  });
  const sorted = [...values].sort((a, b) => a - b);
  return {
    marginByScenario: values,
    wins: values.filter((v) => v > 0).length,
    losses: values.filter((v) => v < 0).length,
    mean: Math.round(values.reduce((a, b) => a + b, 0) / values.length / 10) * 10,
    adverse: Math.round(sorted.slice(0, 10).reduce((a, b) => a + b, 0) / 10 / 10) * 10,
  };
}
