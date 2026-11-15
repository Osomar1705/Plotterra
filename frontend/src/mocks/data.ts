import type { Alternative, Comparison, Plot } from '../types/fieldshift';
import { mockOutcomes, mockScenarios } from './futures';

/** Datos de demostración. Cultivos del catálogo del motor; cifras ilustrativas, no resultados reales. */
// Demo uses the crop durations documented by the team's Python backend.
// Dates are illustrative: the real backend sends explicit siembra and cosecha.
const cropDays: Record<string,number> = {papa:165,quinua:200,tarwi:190,haba:190,cebada:165,avena:140};
const datePlusDays=(iso:string,days:number)=>{
  const [year,month,day]=iso.split('-').map(Number);
  const d=new Date(Date.UTC(year,month-1,day));d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
};
const camp = (crop: string, cropId: string, window: string, startMonth: string, _endMonth: string, sowingDate: string) =>
  ({ crop, cropId, window, startMonth, endMonth:datePlusDays(sowingDate,cropDays[cropId]).slice(0,7),
    sowingDate, harvestDate:datePlusDays(sowingDate,cropDays[cropId]), durationDays:cropDays[cropId], calendarSource:'demo' as const });

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
    // Stress summaries are derived from the exact same 100 outcomes, not a second formula.
    stressTest: (['tipica','menos_lluvia','menos_riego','caida_precio','combinado'] as const).map(family=>{
      const values=outcomes.marginByScenario.filter((_,i)=>mockScenarios[i].family===family);
      const typical=outcomes.marginByScenario.filter((_,i)=>mockScenarios[i].family==='tipica');
      const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/Math.max(xs.length,1);
      return {family,label:family,meanMargin:Math.round(avg(values)),changeVsTypical:Math.round(avg(values)-avg(typical))};
    }),
    explanation: { why: 'Ejemplo de demostración.', dataThatWouldChange: 'Precio y costo local de papa.' },
  };
}

const seqEconomy = [camp('Quinua','quinua','Sep–nov 2026','2026-09','2027-03','2026-10-15'), camp('Tarwi seco','tarwi','Sep–oct 2027','2027-09','2028-04','2027-10-15'), camp('Papa','papa','Oct–nov 2028','2028-10','2029-04','2028-11-01')];
const seqWater = [camp('Cebada grano','cebada','Dic 2026–ene 2027','2026-12','2027-04','2026-12-15'), camp('Quinua','quinua','Sep–nov 2027','2027-09','2028-03','2027-10-15'), camp('Avena grano','avena','Dic 2028–ene 2029','2028-12','2029-05','2028-12-15')];
const seqSoil = [camp('Avena grano','avena','Dic 2026–ene 2027','2026-12','2027-05','2026-12-15'), camp('Haba seca','haba','Oct–nov 2027','2027-10','2028-04','2027-10-15'), camp('Papa','papa','Oct–nov 2028','2028-10','2029-04','2028-11-01')];
const seqUsual = [camp('Papa','papa','Oct–nov 2026','2026-10','2027-04','2026-11-01'), camp('Cebada grano','cebada','Dic 2027–ene 2028','2027-12','2028-04','2027-12-15'), camp('Papa','papa','Oct–nov 2028','2028-10','2029-04','2028-11-01')];
const rain = [12, 27, 50, 68, 78, 101, 110, 105, 51, 17, 3, 5];

export const baseComparison: Comparison = {
  id: 'cmp_demo_base', plotId: 'parcela_1', areaHa: 1.84, priority: 'economy', status: 'ready', activeChanges: [], sourceResult: 'mock',
  scenarios: mockScenarios, rainfallMonthlyMm: rain,
  alternatives: [
    alt('alt_economy', 'economy', seqEconomy, 11, 10600, 3600, 155, 'high', 'medium'),
    alt('alt_water', 'water', seqWater, 22, 4400, 2700, 96, 'medium', 'medium'),
    alt('alt_soil', 'soil', seqSoil, 33, 7900, 3500, 139, 'high', 'medium'),
  ],
  usualPlan: alt('plan_habitual', 'economy', seqUsual, 44, 6800, 9500, 156, 'low', 'high'),
};

export const changedComparison: Comparison = {
  ...baseComparison,
  id: 'cmp_demo_riego30', parentComparisonId: 'cmp_demo_base',
  activeChanges: [{ id: 'chg_riego30', type: 'irrigation', operation: 'reduce', value: 30, unit: 'percent', label: 'Riego −30%' }],
  alternatives: [
    alt('alt_economy', 'economy', seqEconomy, 11, 10600, 3600, 140, 'high', 'medium', 1500),
    alt('alt_water', 'water', seqWater, 22, 4400, 2700, 88, 'medium', 'medium', 400),
    alt('alt_soil', 'soil', seqSoil, 33, 7900, 3500, 128, 'high', 'medium', 1300),
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
