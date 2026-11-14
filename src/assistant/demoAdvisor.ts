import type { AppliedChange, Alternative } from '../types/fieldshift';
import type { GuideContext, GuideReply, GuideRequest } from './types';
import { GUIDE_ALTERNATIVE_NAMES as name } from './types';

const norm=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const num=(x:number)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(x);
const soil=(s:string)=>({high:'alta',compatible:'compatible',medium:'media',low:'baja',unknown:'no determinada'}[s] ?? s);
const risk=(s:string)=>({low:'bajo',medium:'medio',high:'alto',unknown:'no determinado'}[s] ?? s);
const fmtMargin=(a:Alternative)=>`S/ ${num(a.margin.min)}–${num(a.margin.max)} por ${a.margin.basis==='ha'?'hectárea':a.margin.basis}`;
const has=(s:string,...words:string[])=>words.some(w=>s.includes(w));
const make=(status:GuideReply['status'],message:string,options:Partial<GuideReply>={}):GuideReply=>({status,message,...options});
const common=['¿Cómo funciona FieldShift?','¿Qué datos utiliza?','¿Qué significa prioridad?'];
const suggestions={
  parcel:['¿Qué datos necesito?','¿Por qué importa el agua?','¿Qué datos obtiene FieldShift?'],
  comparison:['¿Cuál es la más segura?','¿Qué pasa si tengo 30% menos riego?','¿Cuál usa menos agua?'],
  plan:['¿Por qué va aquí este cultivo?','¿Qué tan seguro es este plan?','¿De dónde salen los resultados?'],
};

function relevantAlt(ctx:GuideContext,s:string):Alternative|undefined {
  const alts=ctx.comparison?.alternatives ?? [];
  const mentioned=s.includes('economia')||s.includes('rentabilidad')||s.includes('margen')?'economy':s.includes('agua')?'water':s.includes('suelo')?'soil':undefined;
  return alts.find(a=>a.type===mentioned)||alts.find(a=>a.id===ctx.selectedAlternativeId)||alts.find(a=>a.type===ctx.comparison?.priority)||alts[0];
}
function explanationForAlternative(a:Alternative,ctx:GuideContext):GuideReply {
  const title=name[a.type];
  const key=a.type==='economy'?`su margen estimado es ${fmtMargin(a)}`:a.type==='water'?`requiere ${a.water.value} ${a.water.unit} en el horizonte evaluado`:`presenta compatibilidad de suelo ${soil(a.soil.compatibility)}`;
  return make('answered',`La alternativa ${title} se muestra porque prioriza ${a.type==='economy'?'el margen económico':a.type==='water'?'la menor demanda de agua':'la compatibilidad de la rotación'}: ${key}. También tiene riesgo ${risk(a.risk.level)} y una secuencia de ${a.campaigns.map(c=>c.crop).join(' → ')}. No es necesariamente la mejor para todas las parcelas.`,{
    intent:'EXPLAIN_ALTERNATIVE',suggestions:['¿Cuál usa menos agua?','¿Cuál tiene menor riesgo?','¿Por qué va aquí este cultivo?'],sources:['Resultados FieldShift',...(ctx.comparison?.sourceResult==='mock'?['Datos de demostración']:[])]
  });
}
function cropExplanation(ctx:GuideContext,s:string):GuideReply {
  const a=ctx.comparison?.alternatives.find(x=>x.id===ctx.selectedAlternativeId)||ctx.comparison?.alternatives.find(x=>x.type===ctx.comparison?.priority);
  if(!a) return make('needs_clarification','Primero abre uno de los planes para explicarte por qué un cultivo aparece en esa posición.',{suggestions:['¿Cómo se elige una rotación?']});
  let index=ctx.campaignIndex??0;
  for(let i=0;i<a.campaigns.length;i++)if(norm(a.campaigns[i].crop).split(' ').some(w=>w.length>2&&s.includes(w))){index=i;break}
  const c=a.campaigns[index];
  if(!c)return make('needs_clarification','Selecciona un cultivo del plan para que pueda explicarte esa campaña.');
  const before=index>0?a.campaigns[index-1].crop:null;
  const after=index<a.campaigns.length-1?a.campaigns[index+1].crop:null;
  const place=index===0?'abre la rotación':index===a.campaigns.length-1?'cierra la rotación':`va después de ${before} y antes de ${after}`;
  const metrics=c.metrics;
  const details=metrics&&Object.values(metrics).filter(x=>x?.value!==null&&x?.value!==undefined);
  let message=`${c.crop} ${place} en ${c.window}, dentro de la alternativa ${name[a.type]}. Es parte de la secuencia ${a.campaigns.map(v=>v.crop).join(' → ')} que FieldShift evaluó. `;
  if(details?.length){message+=`Esta campaña tiene ${details.map(x=>`${x?.label??'un indicador'}: ${x?.value} ${x?.unit??''}`).join('; ')}.`}
  else {message+='Tengo resultados para la rotación completa, pero no indicadores agronómicos específicos de este cultivo. No sería correcto atribuirle una mejora de suelo, rendimiento o resistencia al agua sin esos datos.'}
  return make('answered',message,{intent:'EXPLAIN_CROP_POSITION',suggestions:['¿Qué debo vigilar en esta campaña?','¿Cómo se compara este plan?','¿Qué datos utiliza?'],sources:['Secuencia del plan','Resultados FieldShift']});
}

/** Demo explicativa y determinista. No invoca un LLM ni inventa cálculos agronómicos. */
export function demoGuideReply(req:GuideRequest):GuideReply {
 const {context:ctx}=req;
 const s=norm(req.message);
 const alts=ctx.comparison?.alternatives??[];
 const quality=ctx.comparison?.sourceResult==='mock'?['Datos de demostración']:[];
 const info={sources:['Resultados FieldShift',...quality]};
 if(req.message.startsWith('RESUMEN_POST_SIMULACION')){
  const rows=alts.filter(a=>a.outcomes?.marginByScenario?.length).map(a=>({a,w:a.outcomes!.marginByScenario.filter(x=>x>0).length,n:a.outcomes!.marginByScenario.length})).sort((x,y)=>y.w-x.w);
  const label=ctx.comparison?.activeChanges.at(-1)?.label??'el cambio';
  if(!rows.length)return make('answered',`Listo: las opciones ya se recalcularon con **${label}**. Revisa las nuevas cifras en pantalla.`,{...info});
  const best=rows[0],last=rows[rows.length-1];
  return make('answered',`Con **${label}**, la opción que aguanta en más casos es **${name[best.a.type]}**: gana en **${best.w} de ${best.n}**. La más afectada es **${name[last.a.type]}** (${last.w} de ${last.n}).\nSi esta situación te parece probable, conviene mirar con más atención la opción ${name[best.a.type]}.`,{intent:'POST_SIMULATION',suggestions:['¿Por qué cambió?','¿Cuál usa menos agua?','¿Qué datos utiliza?'],...info});
 }
 const previous=norm([...req.history].reverse().find(t=>t.role==='user')?.text??'');
 const waterMention=has(s,'riego','irrigacion','regar','menos agua','agua disponible','sin agua','sequia');
 const scenarioIntent=has(s,'que pasa si','que pasaria si','simula','simular','probar un cambio','recalcula','cambiar la','modificar el','si tengo','si no puedo','quiero empezar','empezar con','al inicio','sin cebada') || /^\d{1,2}\s*%$/.test(s);
 if(has(s,'pesticida','plaguicida','fungicida','herbicida','fertilizante recomendado','medicina'))
   return make('unsupported','No tengo datos verificados para recomendar tratamientos o productos. Sí puedo ayudarte a entender agua, margen, suelo, riesgo y rotaciones calculadas por FieldShift.',{suggestions:common.slice(0,2)});
 if(has(s,'que puedes hacer','ayuda','que puedo pregunt','ejemplos','como te uso'))
   return make('answered','Puedo explicarte de dónde salen los datos, comparar Economía, Agua y Suelo, revisar por qué aparece un cultivo en una campaña y ayudarte a probar escenarios con confirmación.',{intent:'HELP',suggestions:suggestions[ctx.page]});
 if((scenarioIntent&&waterMention)||(/^\d{1,2}\s*%$/.test(s)&&has(previous,'riego','agua'))) {
   const match=s.match(/(\d{1,3})\s*%/);
   if(!match) return make('needs_clarification','¿Cuánto menos riego quieres probar? Elige una cantidad para que no tenga que suponerla.',{intent:'PROPOSE_SCENARIO',suggestions:['10% menos riego','30% menos riego','50% menos riego']});
   const pct=Number(match[1]);
   if(pct<=0||pct>=100) return make('needs_clarification','Indica un porcentaje entre 1% y 99% para reducir el riego.',{suggestions:['10% menos riego','30% menos riego','50% menos riego']});
   if(ctx.page!=='comparison') return make('needs_clarification','Para recalcular, entra primero a Opciones. Allí podré aplicar el cambio a las tres alternativas.',{suggestions:['¿Cómo funciona la simulación?']});
   if((ctx.engine==='local_mock'||(!ctx.engine&&ctx.comparison?.sourceResult==='mock')) && pct!==30)return make('unsupported','En esta demostración solo existe un resultado recalculado para 30% menos riego. Con el motor conectado podrán probarse otras cantidades sin inventar cifras.',{suggestions:['30% menos riego']});
   const change:AppliedChange={type:'irrigation',operation:'reduce',value:pct,unit:'percent',label:`Riego −${pct}%`};
   return make('proposed_change',`Entendí que quieres probar ${pct}% menos riego. Mantendré las demás condiciones de la parcela. ¿Comparo nuevamente tus opciones?`,{intent:'PROPOSE_SCENARIO',change,requiresConfirmation:true});
 }
 if(scenarioIntent && has(s,'sin cebada','excluir cebada','no usar cebada','no uso cebada','no puedo sembrar cebada','papa al inicio','empezar con papa')) {
   const cebada=has(s,'cebada');
   if(ctx.page!=='comparison') return make('needs_clarification','Para aplicar un escenario, entra primero a Opciones.',{suggestions:['¿Cómo funciona FieldShift?']});
   if(ctx.engine==='local_mock'||(!ctx.engine&&ctx.comparison?.sourceResult==='mock'))return make('unsupported','La interfaz reconoce este cambio, pero el modo demostración aún no tiene resultados calculados para él. Con el motor real conectado sí podrá evaluarlo.',{suggestions:['¿Qué pasa si tengo 30% menos riego?']});
   const change:AppliedChange=cebada?{type:'exclude_crop',operation:'exclude',value:'cebada',unit:'crop',label:'Sin cebada'}:{type:'first_crop',operation:'set',value:'papa',unit:'crop',label:'Papa al inicio'};
   return make('proposed_change',`Entendí: ${change.label}. Confirmemos antes de recalcular las tres alternativas.`,{intent:'PROPOSE_SCENARIO',change,requiresConfirmation:true});
 }
 if(has(s,'como funciona','como decide','modelo','red neuronal','algoritmo','simulacion','40 casos','100 combinaciones'))
   return make('answered','FieldShift combina las condiciones que indicaste para tu parcela con datos ambientales disponibles y evalúa secuencias de cultivos. El motor calcula margen, agua, compatibilidad y riesgo; yo te ayudo a entender los resultados. Las etapas de 40/100 casos mostradas en la demo son ilustrativas y deben validarse con el motor real.',{intent:'EXPLAIN_SYSTEM',suggestions:['¿Qué datos utiliza?','¿Por qué existen tres opciones?','¿Cuál usa menos agua?'],sources:['Condiciones de parcela','Motor FieldShift']});
 if(has(s,'datos limitados','calidad de datos','datos suficientes','informacion suficiente','calidad de informacion')){
   const a=relevantAlt(ctx,s);return a?make('answered',`${name[a.type]} presenta calidad de información ${a.dataQuality.level==='sufficient'?'suficiente':a.dataQuality.level==='limited'?'limitada':'por confirmar'}. ${a.dataQuality.mainGap?'El sistema señala: '+a.dataQuality.mainGap+'.':'No tengo un desglose adicional para precisar cuáles datos faltan.'}`,{intent:'EXPLAIN_DATA_QUALITY',suggestions:['¿Qué datos utiliza?','¿Por qué esta alternativa?'],...info}):make('needs_clarification','¿Para qué alternativa quieres revisar la calidad de datos?');
 }
 if(has(s,'datos','nasa','midagri','fuente','lluvia','satelital','temperatura','relieve','humedad','de donde'))
   return make('answered','El proyecto contempla datos ambientales de NASA, como lluvia, humedad del suelo, temperatura y relieve, y referencias agrícolas de MIDAGRI, además de lo que indicaste para tu parcela. Esos son datos de entrada; los márgenes, el agua y el riesgo mostrados son resultados del motor FieldShift. La conexión final determinará qué fuentes se usaron efectivamente en cada cálculo.',{intent:'EXPLAIN_DATA',suggestions:['¿Cómo compara las rotaciones?','¿Qué datos puse yo?','¿Por qué esta alternativa?'],sources:['NASA (fuentes del proyecto)','MIDAGRI (fuentes del proyecto)','Datos de tu parcela']});
 if(has(s,'que puse','mis datos','mi parcela','mi prioridad','prioridad')) {
   const p=ctx.parcel;
   return make('answered',`Tu parcela se está considerando con ${p?.areaHa?`${p.areaHa} ha`:'el área indicada'}${p?.locality?` en ${p.locality}`:''}. ${p?.previousCrop?`Cultivo anterior: ${p.previousCrop}. `:''}${p?.waterMode?`Disponibilidad de agua: ${p.waterMode==='rainfed'?'solo lluvia':p.waterMode==='scheduled'?'riego por turnos':'riego disponible'}. `:''}La prioridad sirve para destacar una alternativa, sin ocultar los otros criterios.`,{intent:'EXPLAIN_PARCEL',suggestions:['¿Qué datos utiliza?','¿Cómo funciona FieldShift?']});
 }
 if(has(s,'por que va','por que esta primero','por que esta despues','por que va primero','por que papa','por que quinua','por que maiz','esta campaña','este cultivo','que debo vigilar','funcion cumple','por que esta siembra'))
   return cropExplanation(ctx,s);
 if(!alts.length){
   if(ctx.page==='parcel')return make('answered','Primero dibuja o declara tu parcela, indica cultivo anterior, agua disponible y prioridad. Después FieldShift generará tres alternativas para comparar. Todavía no hay resultados de una rotación para explicar.',{intent:'HELP',suggestions:suggestions.parcel});
   return make('needs_clarification','Aún no tengo una comparación calculada que pueda consultar. Genera primero tus opciones y luego podré explicarlas con sus cifras.',{suggestions:common});
 }
 if(has(s,'cuanto menos','y cuanto menos','cual usa menos agua','cual necesita menos agua','menor demanda','mas agua','menos agua') && !scenarioIntent){
   const sorted=[...alts].sort((a,b)=>a.water.value-b.water.value);const lo=sorted[0],hi=sorted[sorted.length-1];
   const economy=alts.find(a=>a.type==='economy');
   const other=s.includes('economia')&&economy?economy:hi;
   const diff=other.water.value-lo.water.value;
   return make('answered',`${name[lo.type]} requiere ${lo.water.value} ${lo.water.unit}, la menor demanda entre las tres opciones. ${diff>0?`Son ${diff} ${lo.water.unit} menos que ${name[other.type]} (${other.water.value} ${other.water.unit}).`:''} Recuerda comparar también el margen y el riesgo.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['¿Cuál deja mayor margen?','¿Cuál tiene menor riesgo?','¿Qué pasa si tengo 30% menos riego?'],...info});
 }
 if(has(s,'segur','seguridad','confiable es','casos','100 futuros','futuros','pierdo','perder','mal año')){
  const alts=ctx.comparison?.alternatives??[];
  const rows=alts.filter(a=>a.outcomes?.marginByScenario?.length).map(a=>{const v=a.outcomes!.marginByScenario;const w=v.filter(x=>x>0).length;return {a,w,n:v.length,share:Math.round(w/v.length*10)}}).sort((x,y)=>y.w-x.w);
  if(!rows.length)return make('answered','Cuando el motor termine la comparación podré decirte en cuántos casos gana cada opción.');
  const best=rows[0];
  return make('answered',`Probamos cada opción en los **mismos ${best.n} casos** (años reales de clima y golpes de −30 % de lluvia, riego o precio).\n${rows.map(r=>`- **${name[r.a.type]}**: ganó en **${r.w} de ${r.n}** (≈ ${r.share} de cada 10)`).join('\n')}\nNo es una garantía: muestra qué tan seguido aguanta cada plan en condiciones distintas.`,{intent:'EXPLAIN_SAFETY',suggestions:['¿Qué pasa si tengo 30% menos riego?','¿Por qué esta rotación?','¿Qué datos utiliza?'],sources:['Prueba en 100 casos FieldShift',...(ctx.comparison?.sourceResult==='mock'?['Datos de demostración']:[])]});
 }
 if(has(s,'cual conviene','que conviene ahora','cual es mejor','cual me recomiendas','cual elegir','mejor opcion')){
   const wet=[...alts].sort((a,b)=>a.water.value-b.water.value)[0];const earn=[...alts].sort((a,b)=>b.margin.max-a.margin.max)[0];
   return make('answered',`Depende de lo que quieras cuidar: ${name[wet.type]} usa menos agua (${wet.water.value} ${wet.water.unit}), mientras ${name[earn.type]} ofrece el margen máximo más alto (${fmtMargin(earn)}). Tu prioridad inicial es ${name[ctx.comparison!.priority]}; compara también suelo y riesgo antes de decidir.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['¿Por qué esta rotación?','¿Cuál tiene menos riesgo?','¿Qué pasa si tengo 30% menos riego?'],...info});
 }
 if(has(s,'mayor margen','mas rentable','mas dinero','gana mas','mejor economia','cual deja')){
   const best=[...alts].sort((a,b)=>b.margin.max-a.margin.max)[0];
   return make('answered',`${name[best.type]} muestra el margen máximo más alto: ${fmtMargin(best)}. No significa que sea la alternativa con menor agua o riesgo; mira esos indicadores antes de elegir.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['¿Cuál usa menos agua?','¿Cuál tiene menor riesgo?'],...info});
 }
 if(has(s,'menor riesgo','mas riesgo','riesgo bajo','riesgo medio')){
   const order={low:0,medium:1,high:2,unknown:3};const best=[...alts].sort((a,b)=>order[a.risk.level]-order[b.risk.level]);
   return make('answered',`El menor nivel reportado es ${risk(best[0].risk.level)}, presente en ${best.filter(a=>a.risk.level===best[0].risk.level).map(a=>name[a.type]).join(' y ')}. Es una clasificación calculada; no elimina por completo la incertidumbre.`,{intent:'COMPARE_ALTERNATIVES',suggestions:['¿Cuál usa menos agua?','¿Por qué esta alternativa?'],...info});
 }
 if(has(s,'por que esta rotacion','por que eligieron esta rotacion','por que elegiste esta rotacion','por que se eligio esta rotacion','por que este plan','por que selecciono','por que estas rotaciones','por que esta alternativa','por que economia','por que agua','por que suelo','por que es mejor')){
   const a=relevantAlt(ctx,s);return a?explanationForAlternative(a,ctx):make('needs_clarification','Dime cuál alternativa quieres entender: Economía, Agua o Suelo.');
 }
 if(has(s,'calidad','limitados','suficientes','confiable')){
   const a=relevantAlt(ctx,s);return a?make('answered',`${name[a.type]} muestra calidad de datos ${a.dataQuality.level==='sufficient'?'suficiente':a.dataQuality.level==='limited'?'limitada':'por confirmar'}. ${a.dataQuality.mainGap?'La principal limitación indicada es '+a.dataQuality.mainGap+'.':'No se proporcionó un desglose adicional de las fuentes o la incertidumbre para esta opción.'}`,{intent:'EXPLAIN_DATA_QUALITY',suggestions:['¿Qué datos utiliza?','¿Por qué esta alternativa?'],...info}):make('needs_clarification','¿Para qué alternativa quieres revisar la calidad de datos?');
 }
 if(has(s,'economia','suelo','rotacion','agua','alternativa','opcion','esta','por que')){
   const a=relevantAlt(ctx,s);return a?explanationForAlternative(a,ctx):make('needs_clarification','¿Quieres hablar de Economía, Agua o Suelo?');
 }
 return make('needs_clarification',`Puedo ayudarte con datos, rotaciones, cultivos y escenarios de tu parcela. ¿Cuál de estos temas te interesa?`,{intent:'HELP',suggestions:suggestions[ctx.page]});
}

export const defaultSuggestions=(page:GuideContext['page'])=>suggestions[page];
