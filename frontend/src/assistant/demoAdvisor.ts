import type { AppliedChange, Alternative } from '../types/fieldshift';
import type { GuideContext, GuideReply, GuideRequest } from './types';
import { GUIDE_ALTERNATIVE_NAMES as name } from './types';
import { displayMoney } from '../lib/money';
import { cropName } from '../lib/uiCopy';

// Matching accepts English and Spanish keywords (farmers may type either); replies are always in English.
const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
const soil=(s:string)=>({high:'high',compatible:'compatible',medium:'medium',low:'low',unknown:'not determined'}[s] ?? s);
const risk=(s:string)=>({low:'low',medium:'medium',high:'high',unknown:'not determined'}[s] ?? s);
const fmtMargin=(a:Alternative)=>`${displayMoney(a.margin.min,a.margin.currency)}–${displayMoney(a.margin.max,a.margin.currency).replace('$ ','$')} per ${a.margin.basis==='ha'?'hectare':a.margin.basis}`;
const has=(s:string,...words:string[])=>words.some(w=>s.includes(w));
const make=(status:GuideReply['status'],message:string,options:Partial<GuideReply>={}):GuideReply=>({status,message,...options});
const common=['How does Plotterra work?','What data does it use?','What does the priority mean?'];
const suggestions={
  parcel:['What details do I need?','Why does irrigation matter?','What data does Plotterra use?'],
  comparison:['Which plan is safer?','What if I have 30% less irrigation?','Which needs less water?'],
  plan:['Why is this crop here?','How safe is this plan?','Where do the numbers come from?'],
};
const quality=(l:string)=>l==='sufficient'?'sufficient':l==='limited'?'limited':'still to be confirmed';

function relevantAlt(ctx:GuideContext,s:string):Alternative|undefined {
  const alts=ctx.comparison?.alternatives ?? [];
  const mentioned=has(s,'economia','rentabilidad','margen','money','income','profit','earn')?'economy':has(s,'agua','water')?'water':has(s,'suelo','soil')?'soil':undefined;
  return alts.find(a=>a.type===mentioned)||alts.find(a=>a.id===ctx.selectedAlternativeId)||alts.find(a=>a.type===ctx.comparison?.priority)||alts[0];
}
function explanationForAlternative(a:Alternative,ctx:GuideContext):GuideReply {
  const title=name[a.type];
  const key=a.type==='economy'?`its estimated margin is ${fmtMargin(a)}`:a.type==='water'?`it needs ${a.water.value} ${a.water.unit} over the evaluated period`:`its soil fit is ${soil(a.soil.compatibility)}`;
  return make('answered',`“${title}” is shown because it prioritises ${a.type==='economy'?'economic margin':a.type==='water'?'the lowest water demand':'rotation fit with your soil'}: ${key}. Its risk level is ${risk(a.risk.level)} and its sequence is ${a.campaigns.map(c=>cropName(c.crop)).join(' → ')}. It is not necessarily the best plan for every plot.`,{
    intent:'EXPLAIN_ALTERNATIVE',suggestions:['Which needs less water?','Which has the lowest risk?','Why is this crop here?'],sources:['Plotterra results',...(ctx.comparison?.sourceResult==='mock'?['Demo data']:[])]
  });
}
function cropExplanation(ctx:GuideContext,s:string):GuideReply {
  const a=ctx.comparison?.alternatives.find(x=>x.id===ctx.selectedAlternativeId)||ctx.comparison?.alternatives.find(x=>x.type===ctx.comparison?.priority);
  if(!a) return make('needs_clarification','Open one of the plans first so I can explain why a crop appears in that position.',{suggestions:['How is a rotation chosen?']});
  let index=ctx.campaignIndex??0;
  for(let i=0;i<a.campaigns.length;i++){const words=[...norm(a.campaigns[i].crop).split(' '),...norm(cropName(a.campaigns[i].crop)).split(' ')];if(words.some(w=>w.length>2&&s.includes(w))){index=i;break}}
  const c=a.campaigns[index];
  if(!c)return make('needs_clarification','Select a crop in the plan so I can explain that season.');
  const before=index>0?cropName(a.campaigns[index-1].crop):null;
  const after=index<a.campaigns.length-1?cropName(a.campaigns[index+1].crop):null;
  const place=index===0?'opens the rotation':index===a.campaigns.length-1?'closes the rotation':`comes after ${before} and before ${after}`;
  const metrics=c.metrics;
  const details=metrics&&Object.values(metrics).filter(x=>x?.value!==null&&x?.value!==undefined);
  let message=`${cropName(c.crop)} ${place} (${c.window}) in the “${name[a.type]}” plan. It is part of the sequence ${a.campaigns.map(v=>cropName(v.crop)).join(' → ')} that Plotterra evaluated. `;
  if(details?.length){message+=`This season has ${details.map(x=>`${x?.label??'an indicator'}: ${x?.value} ${x?.unit??''}`).join('; ')}.`}
  else {message+='I have results for the whole rotation, but no crop-specific agronomic indicators. It would not be right to credit this crop with better soil, yield or drought resistance without that data.'}
  return make('answered',message,{intent:'EXPLAIN_CROP_POSITION',suggestions:['What should I watch this season?','How does this plan compare?','What data does it use?'],sources:['Plan sequence','Plotterra results']});
}

/** Explanatory, deterministic demo. It does not call an LLM and does not invent agronomic calculations. */
export function demoGuideReply(req:GuideRequest):GuideReply {
 const {context:ctx}=req;
 const s=norm(req.message);
 const alts=ctx.comparison?.alternatives??[];
 const dq=ctx.comparison?.sourceResult==='mock'?['Demo data']:[];
 const info={sources:['Plotterra results',...dq]};
 if(req.message.startsWith('RESUMEN_POST_SIMULACION')){
  const rows=alts.filter(a=>a.outcomes?.marginByScenario?.length).map(a=>({a,w:a.outcomes!.marginByScenario.filter(x=>x>0).length,n:a.outcomes!.marginByScenario.length})).sort((x,y)=>y.w-x.w);
  const label=ctx.comparison?.activeChanges.at(-1)?.label??'the change';
  if(!rows.length)return make('answered',`Done: your options were recalculated with **${label}**. Check the new figures on screen.`,{...info});
  const best=rows[0],last=rows[rows.length-1];
  return make('answered',`With **${label}**, the plan that holds up in the most tests is **${name[best.a.type]}**: it earns in **${best.w} of ${best.n}**. The most affected is **${name[last.a.type]}** (${last.w} of ${last.n}).\nIf this situation looks likely to you, look more closely at “${name[best.a.type]}”.`,{intent:'POST_SIMULATION',suggestions:['Why did it change?','Which needs less water?','What data does it use?'],...info});
 }
 const previous=norm([...req.history].reverse().find(t=>t.role==='user')?.text??'');
 const waterMention=has(s,'riego','irrigacion','regar','menos agua','agua disponible','sin agua','sequia','irrigation','water','drought');
 const scenarioIntent=has(s,'que pasa si','que pasaria si','simula','simular','probar un cambio','recalcula','cambiar la','modificar el','si tengo','si no puedo','quiero empezar','empezar con','al inicio','sin cebada','what if','what happens if','simulate','recalculate','try a change','if i have','if i can','without barley','start with') || /^\d{1,2}\s*%$/.test(s);
 if(has(s,'pesticida','plaguicida','fungicida','herbicida','fertilizante recomendado','medicina','pesticide','fungicide','herbicide','fertilizer','medicine'))
   return make('unsupported','I do not have verified data to recommend treatments or products. I can help you understand water, margin, soil, risk and the rotations calculated by Plotterra.',{suggestions:common.slice(0,2)});
 if(has(s,'que puedes hacer','ayuda','que puedo pregunt','ejemplos','como te uso','what can you do','help','what can i ask','examples','how do i use'))
   return make('answered','I can explain where the data comes from, compare Money, Water and Soil, review why a crop appears in a season, and help you test scenarios with your confirmation.',{intent:'HELP',suggestions:suggestions[ctx.page]});
 if((scenarioIntent&&waterMention)||(/^\d{1,2}\s*%$/.test(s)&&has(previous,'riego','agua','irrigation','water'))) {
   const match=s.match(/(\d{1,3})\s*%/);
   if(!match) return make('needs_clarification','How much less irrigation do you want to test? Pick an amount so I do not have to guess.',{intent:'PROPOSE_SCENARIO',suggestions:['10% less irrigation','30% less irrigation','50% less irrigation']});
   const pct=Number(match[1]);
   if(pct<=0||pct>=100) return make('needs_clarification','Give a percentage between 1% and 99% to reduce the irrigation.',{suggestions:['10% less irrigation','30% less irrigation','50% less irrigation']});
   if(ctx.page!=='comparison') return make('needs_clarification','To recalculate, go to Options first. There I can apply the change to the three plans.',{suggestions:['How does the simulation work?']});
   if((ctx.engine==='local_mock'||(!ctx.engine&&ctx.comparison?.sourceResult==='mock')) && pct!==30)return make('unsupported','In this demo only one recalculated result exists, for 30% less irrigation. With the real engine connected, other amounts can be tested without inventing figures.',{suggestions:['30% less irrigation']});
   const change:AppliedChange={type:'irrigation',operation:'reduce',value:pct,unit:'percent',label:`Irrigation −${pct}%`};
   return make('proposed_change',`Understood: you want to test ${pct}% less irrigation. I will keep the other plot conditions. Shall I compare your options again?`,{intent:'PROPOSE_SCENARIO',change,requiresConfirmation:true});
 }
 if(scenarioIntent && has(s,'sin cebada','excluir cebada','no usar cebada','no uso cebada','no puedo sembrar cebada','papa al inicio','empezar con papa','without barley','exclude barley','no barley','start with potato','potato first')) {
   const cebada=has(s,'cebada','barley');
   if(ctx.page!=='comparison') return make('needs_clarification','To apply a scenario, go to Options first.',{suggestions:['How does Plotterra work?']});
   if(ctx.engine==='local_mock'||(!ctx.engine&&ctx.comparison?.sourceResult==='mock'))return make('unsupported','The interface recognises this change, but demo mode has no calculated results for it yet. With the real engine connected it can be evaluated.',{suggestions:['What if I have 30% less irrigation?']});
   const change:AppliedChange=cebada?{type:'exclude_crop',operation:'exclude',value:'cebada',unit:'crop',label:'Without barley'}:{type:'first_crop',operation:'set',value:'papa',unit:'crop',label:'Potato first'};
   return make('proposed_change',`Understood: ${change.label}. Let us confirm before recalculating the three plans.`,{intent:'PROPOSE_SCENARIO',change,requiresConfirmation:true});
 }
 if(has(s,'como funciona','como decide','modelo','red neuronal','algoritmo','simulacion','40 casos','100 combinaciones','how does','how it works','how do you','model','algorithm','simulation'))
   return make('answered','Plotterra combines the conditions you gave for your plot with available environmental data and evaluates crop sequences. The engine calculates margin, water, rotation fit and risk; I help you understand the results. The 40/100-test stages shown in the demo are illustrative and must be validated with the real engine.',{intent:'EXPLAIN_SYSTEM',suggestions:['What data does it use?','Why are there three options?','Which needs less water?'],sources:['Plot conditions','Plotterra engine']});
 if(has(s,'datos limitados','calidad de datos','datos suficientes','informacion suficiente','calidad de informacion','data quality','limited data','enough data','sufficient data')){
   const a=relevantAlt(ctx,s);return a?make('answered',`“${name[a.type]}” has ${quality(a.dataQuality.level)} information quality. ${a.dataQuality.mainGap?'The system points out: '+a.dataQuality.mainGap+'.':'I have no further breakdown of which data is missing.'}`,{intent:'EXPLAIN_DATA_QUALITY',suggestions:['What data does it use?','Why this plan?'],...info}):make('needs_clarification','Which plan do you want to check the data quality for?');
 }
 if(has(s,'datos','nasa','midagri','fuente','lluvia','satelital','temperatura','relieve','humedad','de donde','data','source','where do the numbers','rainfall','satellite','temperature','where does'))
   return make('answered','The project uses NASA environmental data (rainfall, soil moisture, temperature and terrain) and MIDAGRI agricultural references, plus what you entered for your plot. Those are inputs; the margins, water and risk shown are results of the Plotterra engine. The final connection determines which sources were actually used in each calculation.',{intent:'EXPLAIN_DATA',suggestions:['How does it compare rotations?','What did I enter?','Why this plan?'],sources:['NASA (project sources)','MIDAGRI (project sources)','Your plot data']});
 if(has(s,'que puse','mis datos','mi parcela','mi prioridad','prioridad','what did i enter','my data','my plot','my priority','priority')) {
   const p=ctx.parcel;
   return make('answered',`Your plot is being considered with ${p?.areaHa?`${p.areaHa} ha`:'the area you entered'}${p?.locality?` in ${p.locality}`:''}. ${p?.previousCrop?`Previous crop: ${cropName(p.previousCrop)}. `:''}${p?.waterMode?`Water availability: ${p.waterMode==='rainfed'?'rain only':p.waterMode==='scheduled'?'irrigation by turns':'irrigation available'}. `:''}The priority is used to highlight one plan, without hiding the other criteria.`,{intent:'EXPLAIN_PARCEL',suggestions:['What data does it use?','How does Plotterra work?']});
 }
 if(has(s,'por que va','por que esta primero','por que esta despues','por que va primero','por que papa','por que quinua','por que maiz','esta campaña','este cultivo','que debo vigilar','funcion cumple','por que esta siembra','why is this crop','why does this crop','this crop','this season','what should i watch','why is it first','why potato','why quinoa'))
   return cropExplanation(ctx,s);
 if(!alts.length){
   if(ctx.page==='parcel')return make('answered','First draw or describe your plot, then give the previous crop, available water and priority. After that Plotterra will generate three plans to compare. There are no rotation results to explain yet.',{intent:'HELP',suggestions:suggestions.parcel});
   return make('needs_clarification','I do not have a calculated comparison to look at yet. Generate your options first and then I can explain them with their figures.',{suggestions:common});
 }
 if(has(s,'cuanto menos','y cuanto menos','cual usa menos agua','cual necesita menos agua','menor demanda','mas agua','menos agua','less water','least water','lowest water','needs less water','uses less water','more water') && !scenarioIntent){
   const sorted=[...alts].sort((a,b)=>a.water.value-b.water.value);const lo=sorted[0],hi=sorted[sorted.length-1];
   const economy=alts.find(a=>a.type==='economy');
   const other=has(s,'economia','money','income')&&economy?economy:hi;
   const diff=other.water.value-lo.water.value;
   return make('answered',`“${name[lo.type]}” needs ${lo.water.value} ${lo.water.unit}, the lowest water demand of the three options. ${diff>0?`That is ${diff} ${lo.water.unit} less than “${name[other.type]}” (${other.water.value} ${other.water.unit}).`:''} Remember to compare margin and risk as well.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['Which gives the highest margin?','Which has the lowest risk?','What if I have 30% less irrigation?'],...info});
 }
 if(has(s,'segur','seguridad','confiable es','casos','100 futuros','futuros','pierdo','perder','mal año','safer','safe','safety','100 futures','futures','tests','lose money','bad year','reliable')){
  const alts2=ctx.comparison?.alternatives??[];
  const rows=alts2.filter(a=>a.outcomes?.marginByScenario?.length).map(a=>{const v=a.outcomes!.marginByScenario;const w=v.filter(x=>x>0).length;return {a,w,n:v.length,share:Math.round(w/v.length*10)}}).sort((x,y)=>y.w-x.w);
  if(!rows.length)return make('answered','Once the engine finishes the comparison I can tell you in how many tests each option earns money.');
  const best=rows[0];
  return make('answered',`We tested each option in the **same ${best.n} cases** (real weather years plus −30 % shocks to rain, irrigation or price).\n${rows.map(r=>`- **${name[r.a.type]}**: earned in **${r.w} of ${r.n}** (≈ ${r.share} out of every 10)`).join('\n')}\nIt is not a guarantee: it shows how often each plan holds up under different conditions.`,{intent:'EXPLAIN_SAFETY',suggestions:['What if I have 30% less irrigation?','Why this rotation?','What data does it use?'],sources:['Plotterra 100-test run',...(ctx.comparison?.sourceResult==='mock'?['Demo data']:[])]});
 }
 if(has(s,'cual conviene','que conviene ahora','cual es mejor','cual me recomiendas','cual elegir','mejor opcion','which is better','which should i','which one should','best option','recommend')){
   const wet=[...alts].sort((a,b)=>a.water.value-b.water.value)[0];const earn=[...alts].sort((a,b)=>b.margin.max-a.margin.max)[0];
   return make('answered',`It depends on what you want to protect: “${name[wet.type]}” uses the least water (${wet.water.value} ${wet.water.unit}), while “${name[earn.type]}” offers the highest top margin (${fmtMargin(earn)}). Your initial priority is “${name[ctx.comparison!.priority]}”; also compare soil and risk before deciding.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['Why this rotation?','Which has the lowest risk?','What if I have 30% less irrigation?'],...info});
 }
 if(has(s,'mayor margen','mas rentable','mas dinero','gana mas','mejor economia','cual deja','highest margin','most profitable','more money','earns more','best economy','highest income')){
   const best=[...alts].sort((a,b)=>b.margin.max-a.margin.max)[0];
   return make('answered',`“${name[best.type]}” shows the highest top margin: ${fmtMargin(best)}. That does not mean it has the lowest water use or risk; check those indicators before choosing.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['Which needs less water?','Which has the lowest risk?'],...info});
 }
 if(has(s,'menor riesgo','mas riesgo','riesgo bajo','riesgo medio','lowest risk','less risk','lower risk','riskier','low risk')){
   const order={low:0,medium:1,high:2,unknown:3};const best=[...alts].sort((a,b)=>order[a.risk.level]-order[b.risk.level]);
   return make('answered',`The lowest reported level is ${risk(best[0].risk.level)}, found in ${best.filter(a=>a.risk.level===best[0].risk.level).map(a=>`“${name[a.type]}”`).join(' and ')}. It is a calculated classification; it does not remove uncertainty entirely.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['Which needs less water?','Why this plan?'],...info});
 }
 if(has(s,'por que esta rotacion','por que eligieron esta rotacion','por que elegiste esta rotacion','por que se eligio esta rotacion','por que este plan','por que selecciono','por que estas rotaciones','por que esta alternativa','por que economia','por que agua','por que suelo','por que es mejor','why this rotation','why this plan','why was this','why these rotations','why money','why water','why soil','why is it better','why three')){
   const a=relevantAlt(ctx,s);return a?explanationForAlternative(a,ctx):make('needs_clarification','Tell me which plan you want to understand: Money, Water or Soil.');
 }
 if(has(s,'calidad','limitados','suficientes','confiable','quality','limited','sufficient','confident')){
   const a=relevantAlt(ctx,s);return a?make('answered',`“${name[a.type]}” has ${quality(a.dataQuality.level)} data quality. ${a.dataQuality.mainGap?'The main limitation noted is '+a.dataQuality.mainGap+'.':'No further breakdown of sources or uncertainty was provided for this option.'}`,{intent:'EXPLAIN_DATA_QUALITY',suggestions:['What data does it use?','Why this plan?'],...info}):make('needs_clarification','Which plan do you want to check the data quality for?');
 }
 if(has(s,'economia','suelo','rotacion','agua','alternativa','opcion','esta','por que','money','soil','rotation','water','plan','option','explain','why')){
   const a=relevantAlt(ctx,s);return a?explanationForAlternative(a,ctx):make('needs_clarification','Do you want to talk about Money, Water or Soil?');
 }
 return make('needs_clarification','I can help with data, rotations, crops and scenarios for your plot. Which of these topics interests you?',{intent:'HELP',suggestions:suggestions[ctx.page]});
}

export const defaultSuggestions=(page:GuideContext['page'])=>suggestions[page];
