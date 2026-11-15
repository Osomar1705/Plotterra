import type { Alternative, Campaign, ScenarioFamily } from '../types/fieldshift';

const CROPS: Record<string,string> = {
  papa:'Potato', quinua:'Quinoa', cebada:'Barley', avena:'Oats', haba:'Fava bean', tarwi:'Tarwi',
};
const MONTH: Record<string,number> = {ene:1,jan:1,feb:2,mar:3,abr:4,apr:4,may:5,jun:6,jul:7,ago:8,aug:8,sep:9,oct:10,nov:11,dic:12,dec:12};
const ABBR=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const optionName = {economy:'Earn more money',water:'Save water',soil:'Care for soil'} as const;
export function cropName(name:string):string {
  const clean=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const crop=Object.entries(CROPS).find(([key])=>clean.includes(key));
  if(!crop)return name;
  return clean.includes('tarwi seco')?'Dry tarwi':crop[1];
}
export function sowingLabel(window:string){
  return window.replace(/\b(ene|jan|feb|mar|abr|apr|may|jun|jul|ago|aug|sep|oct|nov|dic|dec)\b/gi, v=>ABBR[MONTH[v.toLowerCase()]]??v);
}

/** Dates highlighted are taken from the explicitly supplied *planting window*, never from a crop's growing period. */
export function sowingMonths(campaign:Campaign):string[] {
  const matches=[...campaign.window.toLowerCase().matchAll(/\b(ene|jan|feb|mar|abr|apr|may|jun|jul|ago|aug|sep|oct|nov|dic|dec)\b\s*(\d{4})?/g)];
  if(!matches.length)return campaign.startMonth ? [campaign.startMonth] : [];
  const firstMonth=MONTH[matches[0][1]], lastMonth=MONTH[matches.at(-1)![1]];
  const lastYear=Number(matches.at(-1)![2] ?? matches[0][2] ?? campaign.startMonth?.slice(0,4));
  if(!Number.isInteger(lastYear)||lastYear<1900)return campaign.startMonth?[campaign.startMonth]:[];
  let firstYear=Number(matches[0][2] ?? (firstMonth>lastMonth?lastYear-1:lastYear));
  let finalYear=Number(matches.at(-1)![2] ?? (lastMonth<firstMonth?firstYear+1:firstYear));
  if(matches.length===1){firstYear=lastYear;finalYear=lastYear;}
  const first=firstYear*12+firstMonth-1,last=finalYear*12+lastMonth-1;
  if(last<first||last-first>4)return campaign.startMonth?[campaign.startMonth]:[];
  return Array.from({length:last-first+1},(_,i)=>{
    const code=first+i;return `${Math.floor(code/12)}-${String(code%12+1).padStart(2,'0')}`;
  });
}

export function waterLabel(a:Alternative){
  const key=a.water.metric.toLowerCase();
  if(key.includes('exposicion')||key.includes('exposure'))return 'Water exposure';
  if(key.includes('deficit')||key.includes('faltante')||key.includes('shortfall'))return 'Water shortfall';
  if(key.includes('riego')||key.includes('irrigation'))return 'Irrigation needed';
  return 'Water indicator';
}
export function riskName(risk:string){return ({low:'Low',medium:'Medium',high:'High',unknown:'Not rated'} as Record<string,string>)[risk]??'Not rated';}
export function soilName(soil:string){return ({compatible:'Good fit',bueno:'Good fit',regular:'Fair',pobre:'Poor',high:'High',medium:'Medium',low:'Low',unknown:'Not rated'} as Record<string,string>)[soil]??soil;}
export const caseName:Record<ScenarioFamily,string>={
 tipica:'Typical conditions',menos_lluvia:'30% less rain',menos_riego:'30% less irrigation',caida_precio:'30% lower prices',combinado:'Changes combined',
};
export function translateKnownEngineNote(note?:string|null){
  if(!note)return '';
  const value=note.trim();
  if(/^Ejemplo de demostraci[oó]n\.?$/i.test(value))return '';
  if(/^Peor grupo de escenarios:\s*ca[ií]da de precio\.?$/i.test(value))return 'The lowest results occurred in the lower-price tests.';
  if(/^Precio y costo local de papa\.?$/i.test(value))return 'Local potato prices and production costs could change the outcome.';
  if(/^Datos de demostraci[oó]n\.?$/i.test(value))return 'Illustrative data';
  // Unknown engine-provided notes are not silently translated or misrepresented.
  return value;
}
