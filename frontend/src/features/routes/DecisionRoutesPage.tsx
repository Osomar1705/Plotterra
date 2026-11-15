import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGuide } from '../../assistant/GuideProvider';
import { readEntryConditions } from '../../integration/entryContext';
import type { Alternative, Campaign, Comparison, FieldShiftApiError } from '../../types/fieldshift';
import { getComparison, isUsingMocks } from '../../api/fieldshiftApi';
import { CoinsIcon, LeafIcon, SproutIcon, WaterIcon } from '../../components/Icons';
import { BrandLogo } from '../../components/BrandLogo';
import { CropIllustration } from '../../components/CropIllustration';
import { PlanEvidence } from '../../components/PlanEvidence';
import { PlanRisk } from '../../components/PlanRisk';
import { ScenarioBreakdown } from '../../components/ScenarioBreakdown';
import { signedMoney, summarize } from '../../components/futures/futuresModel';
import { displayMoney } from '../../lib/money';
import { cropName, optionName, riskName, soilName, translateKnownEngineNote, waterLabel } from '../../lib/uiCopy';
import { displayDate } from '../../lib/cropSchedule';
import './decision-routes.css';
import './plan.css';
import './plan-simple.css';
import './plan-v7.css';
import './plan-v8.css';

const errorMessage=(e:unknown)=>(e as Partial<FieldShiftApiError>)?.farmerMessage||'This plan is unavailable. Please try again.';
const shortDate=(iso?:string,fallback?:string)=>displayDate(iso)??fallback??'—';

/** Typical rainfall (mm) over the months between sowing and harvest, from the comparison's monthly climatology. */
const METRIC_LABEL:Record<string,string>={yield:'Expected yield',water:'Water shortfall',economy:'Margin',soil:'Soil fit'};
function rainBetween(c:Campaign,monthly?:number[]):number|null{
  if(!monthly||monthly.length!==12||!c.sowingDate||!c.harvestDate)return null;
  const a=new Date(c.sowingDate+'T00:00:00Z'),b=new Date(c.harvestDate+'T00:00:00Z');
  if(!(a<b))return null;
  let total=0;const cur=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),1));
  while(cur<=b){const m=cur.getUTCMonth();
    const first=cur.getTime()<a.getTime()?a.getUTCDate():1;
    const dim=new Date(Date.UTC(cur.getUTCFullYear(),m+1,0)).getUTCDate();
    const last=(cur.getUTCFullYear()===b.getUTCFullYear()&&m===b.getUTCMonth())?b.getUTCDate():dim;
    total+=monthly[m]*Math.max(0,last-first+1)/dim;cur.setUTCMonth(m+1);}
  return Math.round(total);
}

/** The plan is a selected, single rotation. Changing option happens on the Options page. */
export function DecisionRoutesPage({comparisonId,alternativeId}:{comparisonId:string|null;alternativeId:string|null}){
 const [comparison,setComparison]=useState<Comparison|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [selectedCrop,setSelectedCrop]=useState(0);
 const {setPage,setParcel,setComparison:publishComparison,setPlanSelection,openGuide}=useGuide();
 const entry=useMemo(()=>readEntryConditions()??undefined,[]);
 useEffect(()=>{setPage('plan');if(entry)setParcel(entry)},[setPage,setParcel,entry]);
 useEffect(()=>{
  document.title='Plotterra · Your plan';let alive=true;
  (async()=>{try{
    if(!comparisonId&&!isUsingMocks())throw new Error('Open this plan from the Options page.');
    const c=await getComparison(comparisonId||'cmp_demo_base');if(alive)setComparison(c);
   }catch(e){if(alive)setError(errorMessage(e))}finally{if(alive)setLoading(false)}})();
  return()=>{alive=false};
 },[comparisonId]);
 const selected=useMemo<Alternative|null>(()=>comparison?.alternatives.find(a=>a.id===alternativeId)??comparison?.alternatives[0]??null,[comparison,alternativeId]);
 useEffect(()=>{setSelectedCrop(0)},[selected?.id]);
 useEffect(()=>{if(comparison)publishComparison(comparison)},[comparison,publishComparison]);
 useEffect(()=>{if(selected)setPlanSelection(selected.id,selectedCrop)},[selected?.id,selectedCrop,setPlanSelection]);
 const optionsHref=`/opciones${comparison?`?comparisonId=${encodeURIComponent(comparison.id)}`:''}`;
 if(loading)return <div className="page-center"><div className="spinner"/><p>Preparing your plan…</p></div>;
 if(error||!comparison||!selected)return <div className="page-center error-state"><h2>Could not open your plan</h2><p>{error||'The selected option is no longer available.'}</p><a href={optionsHref}>← Back to options</a></div>;

 const o=selected.outcomes;const s=o?summarize(o):null;
 const isDemo=comparison.sourceResult==='mock';
 const camps=selected.campaigns;
 const c=camps[selectedCrop]??camps[0];
 const prev=selectedCrop>0?camps[selectedCrop-1]:null;
 const next=selectedCrop<camps.length-1?camps[selectedCrop+1]:null;
 const prevName=prev?cropName(prev.crop):entry?.previousCrop?cropName(entry.previousCrop):null;
 const position=selectedCrop===0?(prevName?`Opens the rotation, after ${prevName} on your plot.`:'Opens the rotation.')
   :next?`Goes after ${cropName(prev!.crop)} and before ${cropName(next.crop)}.`:`Closes the rotation, after ${cropName(prev!.crop)}.`;
 const differs=prevName&&cropName(c.crop)!==prevName;
 const rain=rainBetween(c,comparison.rainfallMonthlyMm);
 const note=translateKnownEngineNote(selected.explanation?.why);
 const cm=c.metrics;
 const metricChips=(['yield','water','economy','soil'] as const).flatMap(k=>{const m=cm?.[k];return m&&m.value!==null&&m.value!==undefined&&m.status!=='unavailable'?[{...m,key:k as string}]:[];});

 return <div className="plan-shell pv pv--simple pv--v7 pv--v8">
  <header className="topbar"><BrandLogo/><nav className="steps"><a href="/">1&nbsp; Plot</a><a href={optionsHref}>2&nbsp; Options</a><strong>3&nbsp; Plan</strong></nav></header>
  <main className="p8">
   <div className="p8-grid">
    <div className="p8-left">
    <section className={`pv-card p8-plan p8-plan--${selected.type}`} aria-labelledby="plan-name">
     <div className="p8-head">
      <div><a href={optionsHref} className="pv-back">← Options</a>
       <h1 id="plan-name">{optionName[selected.type]}</h1></div>
      <div className="p8-kpis">
       <div><span><CoinsIcon size={15}/> Margin</span><strong>{s?.mean!==undefined?signedMoney(s.mean):`${displayMoney(selected.margin.min,selected.margin.currency)}–${displayMoney(selected.margin.max,selected.margin.currency)}`}</strong><small>per ha · {camps.length} seasons</small></div>
       <div><span><WaterIcon size={15}/> {waterLabel(selected)}</span><strong>{selected.water.value} {selected.water.unit}</strong><small>{selected.water.period==='campaña'?'per season':selected.water.period??''}</small></div>
       <div><span><SproutIcon size={15}/> Soil</span><strong>{soilName(selected.soil.compatibility)}</strong><small>Risk: {riskName(selected.risk.level)}</small></div>
      </div>
     </div>

     <ol className="p8-seasons" aria-label="Planting schedule">
      {camps.map((k,i)=><li key={`${k.crop}-${i}`}>
       <button type="button" className={`p8-season ${selectedCrop===i?'is-on':''}`} aria-pressed={selectedCrop===i} onClick={()=>setSelectedCrop(i)}>
        <CropIllustration crop={k.cropId??k.crop} size={40} framed/>
        <span className="p8-season__txt"><small>Season {i+1}</small><strong>{cropName(k.crop)}</strong>
         <em>{shortDate(k.sowingDate,k.window)} <b aria-hidden="true">→</b> {shortDate(k.harvestDate,k.endMonth)}</em></span>
       </button>
      </li>)}
     </ol>

     <AnimatePresence mode="wait">
      <motion.div key={selectedCrop} className="p8-why" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.18}}>
       <div className="p8-why__title"><span>Why {cropName(c.crop)} here?</span><button type="button" onClick={()=>openGuide(`Why is ${cropName(c.crop)} in season ${selectedCrop+1} of this plan? Use only the data available.`)}><LeafIcon size={15}/> Ask the guide</button></div>
       <ul>
        <li>{position}</li>
        {differs&&<li>It is a different crop from the one before it, so the same crop is not repeated back to back.</li>}
        {rain!==null&&<li>Historical average rain between sowing and harvest: about <b>{rain} mm</b> (not a forecast).</li>}
        {metricChips.map((m,i)=>{const k=m.key;const n=Number(m.value);
         const text=k==='economy'&&Number.isFinite(n)?`${displayMoney(n,String(m.unit??'').toUpperCase().startsWith('S/')?'PEN':'USD')} per ha`:`${Number.isFinite(n)?Math.round(n*100)/100:String(m.value)} ${m.unit??''}`;
         return <li key={i}>{METRIC_LABEL[k]??m.label??'Metric'}: <b>{text}</b></li>;})}
        {note&&<li>{note}</li>}
        {selected.tradeoffs?.advantages?.slice(0,1).map(t=><li key={t}>{t}</li>)}
       </ul>
      </motion.div>
     </AnimatePresence>
    </section>
    <PlanRisk comparison={comparison} alternative={selected}><PlanEvidence comparison={comparison} alternative={selected}/></PlanRisk>
    </div>
    <ScenarioBreakdown comparison={comparison} alternative={selected}/>
   </div>
  </main>
 </div>;
}
