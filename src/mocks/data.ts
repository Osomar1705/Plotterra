import type { Comparison, Plot } from '../types/fieldshift';

export const baseComparison: Comparison = {
  id: 'cmp_demo_base', plotId: 'parcela_1', areaHa: 3.5, priority: 'economy', status: 'ready', activeChanges: [], sourceResult: 'mock',
  alternatives: [
    { id:'alt_economy', type:'economy', campaigns:[{crop:'Papa',window:'Oct 2026'},{crop:'Quinua',window:'Mar 2027'},{crop:'Maíz',window:'Oct 2027'}], margin:{min:3100,max:3600,currency:'PEN',basis:'ha'}, water:{metric:'demand',value:340,unit:'mm'}, soil:{compatibility:'compatible'}, risk:{level:'medium'}, dataQuality:{level:'sufficient'} },
    { id:'alt_water', type:'water', campaigns:[{crop:'Quinua',window:'Oct 2026'},{crop:'Maíz',window:'Mar 2027'},{crop:'Papa',window:'Oct 2027'}], margin:{min:2700,max:3100,currency:'PEN',basis:'ha'}, water:{metric:'demand',value:260,unit:'mm'}, soil:{compatibility:'compatible'}, risk:{level:'low'}, dataQuality:{level:'sufficient'} },
    { id:'alt_soil', type:'soil', campaigns:[{crop:'Maíz',window:'Oct 2026'},{crop:'Papa',window:'Mar 2027'},{crop:'Quinua',window:'Oct 2027'}], margin:{min:2900,max:3300,currency:'PEN',basis:'ha'}, water:{metric:'demand',value:300,unit:'mm'}, soil:{compatibility:'high'}, risk:{level:'low'}, dataQuality:{level:'limited'} },
  ]
};

export const changedComparison: Comparison = {
  ...baseComparison,
  id:'cmp_demo_riego30', parentComparisonId:'cmp_demo_base',
  activeChanges:[{id:'chg_riego30',type:'irrigation',operation:'reduce',value:30,unit:'percent',label:'Riego −30%'}],
  alternatives:[
    {...baseComparison.alternatives[0],margin:{min:2850,max:3200,currency:'PEN',basis:'ha'},water:{metric:'demand',value:240,unit:'mm'}},
    {...baseComparison.alternatives[1],margin:{min:2400,max:2900,currency:'PEN',basis:'ha'},water:{metric:'demand',value:180,unit:'mm'}},
    {...baseComparison.alternatives[2],margin:{min:2650,max:3100,currency:'PEN',basis:'ha'},water:{metric:'demand',value:210,unit:'mm'}},
  ]
};

export const demoPlot: Plot = {
  id: 'parcela_1',
  areaHa: 1.84,
  locality: 'Huánuco',
  cellId: 'hco_0412',
  suggestions: {
    rainfallMm: 612,
    rainfallSource: 'NASA GPM IMERG 2015–2025',
    soilTexture: 'Franco',
    fieldCapacityMm: 142,
    soilSource: 'SoilGrids v2.0',
    soilUncertainty: 'media',
  },
};
