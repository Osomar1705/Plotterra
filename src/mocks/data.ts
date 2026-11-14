import type { Alternative, Comparison, Plot } from '../types/fieldshift';
import { mockOutcomes, mockScenarios } from './futures';

/** Datos de demostración. Cultivos del catálogo del motor; cifras ilustrativas, no resultados reales. */
const camp = (crop: string, cropId: string, window: string, startMonth: string, endMonth: string) =>
  ({ crop, cropId, window, startMonth, endMonth });

function alt(id: string, type: Alternative['type'], campaigns: Alternative['campaigns'], seed: number, mean: number,
             spread: number, water: number, soil: string, risk: Alternative['risk']['level'], penalty = 0): Alternative {
  const outcomes = mockOutcomes(seed, mean, spread, penalty);
  const sorted = [...outcomes.marginByScenario].sort((a, b) => a - b);
  return {
    id, type, campaigns, outcomes,
    margin: { min: sorted[10], max: sorted[89], currency: 'PEN', basis: 'ha', period: '3 campañas' },
    water: { metric: 'exposicion_hidrica', value: water, unit: 'mm', period: 'campaña' },
    soil: { compatibility: soil }, risk: { level: risk, mainCause: 'Peor grupo de escenarios: caída de precio.' },
    dataQuality: { level: 'limited', mainGap: 'Datos de demostración.' },
    stressTest: [
      { family: 'tipica', label: 'Campaña típica (histórico)', meanMargin: mean * 1.4, changeVsTypical: 0 },
      { family: 'menos_lluvia', label: 'Menos lluvia (−30 %)', meanMargin: mean * 0.9, changeVsTypical: -mean * 0.4 },
      { family: 'menos_riego', label: 'Menos riego (−30 %)', meanMargin: mean * 1.2, changeVsTypical: -mean * 0.17 },
      { family: 'caida_precio', label: 'Caída de precio (−30 %)', meanMargin: mean * 0.3, changeVsTypical: -mean * 1.3 },
      { family: 'combinado', label: 'Combinado adverso', meanMargin: mean * 0.08, changeVsTypical: -mean * 1.15 },
    ],
    explanation: { why: 'Ejemplo de demostración.', dataThatWouldChange: 'Precio y costo local de papa.' },
  };
}

const seqEconomy = [camp('Quinua', 'quinua', 'Sep–nov 2026', '2026-09', '2027-03'), camp('Tarwi seco', 'tarwi', 'Sep–oct 2027', '2027-09', '2028-04'), camp('Papa', 'papa', 'Oct–nov 2028', '2028-10', '2029-04')];
const seqWater = [camp('Cebada grano', 'cebada', 'Dic 2026–ene 2027', '2026-12', '2027-04'), camp('Quinua', 'quinua', 'Sep–nov 2027', '2027-09', '2028-03'), camp('Avena grano', 'avena', 'Dic 2028–ene 2029', '2028-12', '2029-05')];
const seqSoil = [camp('Avena grano', 'avena', 'Dic 2026–ene 2027', '2026-12', '2027-05'), camp('Haba seca', 'haba', 'Oct–nov 2027', '2027-10', '2028-04'), camp('Papa', 'papa', 'Oct–nov 2028', '2028-10', '2029-04')];
const seqUsual = [camp('Papa', 'papa', 'Oct–nov 2026', '2026-10', '2027-04'), camp('Cebada grano', 'cebada', 'Dic 2027–ene 2028', '2027-12', '2028-04'), camp('Papa', 'papa', 'Oct–nov 2028', '2028-10', '2029-04')];
const rain = [12, 27, 50, 68, 78, 101, 110, 105, 51, 17, 3, 5];

export const baseComparison: Comparison = {
  id: 'cmp_demo_base', plotId: 'parcela_1', areaHa: 1.84, priority: 'economy', status: 'ready', activeChanges: [], sourceResult: 'mock',
  scenarios: mockScenarios, rainfallMonthlyMm: rain,
  alternatives: [
    alt('alt_economy', 'economy', seqEconomy, 11, 7000, 6500, 155, 'high', 'medium'),
    alt('alt_water', 'water', seqWater, 22, 2600, 3200, 96, 'medium', 'medium'),
    alt('alt_soil', 'soil', seqSoil, 33, 6200, 6000, 139, 'high', 'medium'),
  ],
  usualPlan: alt('plan_habitual', 'economy', seqUsual, 44, 6800, 9500, 156, 'low', 'high'),
};

export const changedComparison: Comparison = {
  ...baseComparison,
  id: 'cmp_demo_riego30', parentComparisonId: 'cmp_demo_base',
  activeChanges: [{ id: 'chg_riego30', type: 'irrigation', operation: 'reduce', value: 30, unit: 'percent', label: 'Riego −30%' }],
  alternatives: [
    alt('alt_economy', 'economy', seqEconomy, 11, 7000, 6500, 140, 'high', 'medium', 1500),
    alt('alt_water', 'water', seqWater, 22, 2600, 3200, 88, 'medium', 'medium', 400),
    alt('alt_soil', 'soil', seqSoil, 33, 6200, 6000, 128, 'high', 'medium', 1300),
  ],
  usualPlan: alt('plan_habitual', 'economy', seqUsual, 44, 6800, 9500, 146, 'low', 'high', 2300),
};

export const demoPlot: Plot = {
  id: 'parcela_1',
  areaHa: 1.84,
  locality: 'Huánuco',
  cellId: 'hco_0412',
  suggestions: {
    rainfallMm: 612,
    rainfallSource: 'Datos de demostración',
    soilTexture: 'Franco',
    fieldCapacityMm: 142,
    soilSource: 'SoilGrids v2.0',
    soilUncertainty: 'media',
  },
};
