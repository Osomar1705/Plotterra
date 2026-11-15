import { useEffect, useMemo, useRef, useState } from 'react';
import { changeLabelEn } from '../lib/uiCopy';
import { useGuide } from '../assistant/GuideProvider';
import { AnimatePresence, motion } from 'motion/react';
import { Photo } from './Photo';
import type { AppliedChange, Comparison, EntryConditions, FieldShiftApiError } from '../types/fieldshift';
import { applyChange, createComparison, getComparison, undoChange } from '../api/fieldshiftApi';
import { readEntryConditions, readQueryContext } from '../integration/entryContext';
import { AlternativeCard } from './AlternativeCard';
import { LeafIcon, PinIcon } from './Icons';
import { SimulationReveal } from './futures/SimulationReveal';
import { optionName } from '../lib/uiCopy';
import './futures/futures.css';

const visibleChange=(label?:string|null)=>changeLabelEn(label);
type Reveal={values?:number[];previous?:number[];label?:string|null;note?:string|null};

export function ComparisonPage(){
 const [comparison,setComparison]=useState<Comparison|null>(null);
 const [previous,setPrevious]=useState<Comparison|null>(null);
 const [loading,setLoading]=useState(true);
 const [processing,setProcessing]=useState(false);
 const [error,setError]=useState<FieldShiftApiError|null>(null);
 const [reveal,setReveal]=useState<Reveal|null>(null);
 const revealDone=useRef<(()=>void)|null>(null);
 const {setPage,setParcel,setComparison:publishComparison,registerRunner,registerUndo}=useGuide();
 useEffect(()=>{setPage('comparison');const entry=readEntryConditions();if(entry)setParcel(entry)},[setPage,setParcel]);
 useEffect(()=>{if(comparison)publishComparison(comparison)},[comparison,publishComparison]);
 useEffect(()=>{registerRunner(recalc);registerUndo(async()=>comparison?.activeChanges.length?undo():null);return ()=>{registerRunner(null);registerUndo(null)}});
 const heroOf=(c:Comparison|null)=>c?.alternatives.find(a=>a.type===c.priority&&a.outcomes)??c?.alternatives.find(a=>a.outcomes);

 useEffect(()=>{(async()=>{setLoading(true);setError(null);
  const q=readQueryContext(),entry=readEntryConditions();
  // Fresh arrival from the plot form: show the 100-tests animation (waiting state while the engine answers).
  const fresh=!q.comparisonId;
  if(fresh)setReveal({});
  try{
   const c=q.comparisonId?await getComparison(q.comparisonId):await createComparison({...entry,plotId:q.plotId??entry?.plotId} as EntryConditions);
   setComparison(c);
   const hero=heroOf(c);
   if(fresh&&hero?.outcomes)setReveal({values:hero.outcomes.marginByScenario});
   else setReveal(null);
  }catch(e:any){setError(e);setReveal(null)}finally{setLoading(false)}})()},[]);
 const ordered=useMemo(()=>comparison?.alternatives??[],[comparison]);
 const activeLabel=comparison?.activeChanges.at(-1)?.label;
 const area=comparison?.areaHa;

 async function recalc(change:AppliedChange):Promise<Comparison>{
  if(!comparison||processing)throw {farmerMessage:'A calculation is already running. Please try again afterwards.'};
  setProcessing(true);setError(null);
  const old=comparison,oldHero=heroOf(old);
  setReveal({label:visibleChange(change.label),previous:oldHero?.outcomes?.marginByScenario});
  try{
   const next=await applyChange(comparison.id,change);
   setPrevious(old);setComparison(next);
   const newHero=heroOf(next);
   if(newHero?.outcomes){
    const done=new Promise<void>(resolve=>{revealDone.current=resolve;window.setTimeout(resolve,7000)});
    const oldOrder=oldHero?.campaigns.map(c=>c.crop).join(' → '),newOrder=newHero.campaigns.map(c=>c.crop).join(' → ');
    setReveal(r=>({...r,values:newHero.outcomes!.marginByScenario,note:oldOrder!==newOrder?'The planting order changed in the updated result.':null}));
    setProcessing(false);await done;
   }else setReveal(null);
   return next;
  }catch(e:any){setError(e);setReveal(null);throw e}finally{setProcessing(false)}
 }
 async function undo():Promise<Comparison|null>{
  if(!comparison||processing)return null;
  setProcessing(true);setError(null);
  try{const next=previous??await undoChange(comparison);setComparison(next);setPrevious(null);return next}
  catch(e:any){setError(e);return null}finally{setProcessing(false)}
 }
 function openPlan(alternativeId:string){if(!comparison)return;
  const url=`/plan?comparisonId=${encodeURIComponent(comparison.id)}&alternativeId=${encodeURIComponent(alternativeId)}`;
  window.dispatchEvent(new CustomEvent('fieldshift:open-plan',{detail:{comparisonId:comparison.id,alternativeId}}));
  window.history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));
 }
 if(!loading&&!comparison)return <div className="page-center error-state"><h2>We couldn't load your options</h2><p>{error?.farmerMessage??'Please try again.'}</p></div>;
 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="/"><LeafIcon/>FieldShift</a><nav className="steps"><a href="/">1&nbsp; Plot</a><strong>2&nbsp; Options</strong><span>3&nbsp; Plan</span></nav></header>
  {comparison&&<main className="comparison-page comparison-page--simple">
   <motion.section className="cmp-hero cmp-hero--photo" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}>
    <Photo k="andenes" eager/>
    <div className="cmp-hero-inner"><div><h1>Choose what matters most to you</h1><p>Every plan makes a different balance between income, water and soil.</p></div>
    {area!==undefined&&<div className="cmp-hero-meta"><span><PinIcon size={16}/> Your plot · {area} ha</span></div>}</div>
   </motion.section>
   {activeLabel&&<div className="updated-banner"><span>✓ Results updated: {visibleChange(activeLabel)}</span><button onClick={()=>void undo()}>Undo change</button></div>}
   {error&&<div className="error-banner"><div><span>{error.farmerMessage}</span></div></div>}
   <section className="cards-grid cards-grid--simple" aria-label="Three crop-plan options">{ordered.map((a,i)=><AlternativeCard key={a.id} index={i} alternative={a}
    priority={!activeLabel&&a.type===comparison.priority} onOpenPlan={openPlan}/>)}</section>
   <a className="edit-link" href="/">← Edit plot details</a>
  </main>}
  <AnimatePresence>{reveal&&<SimulationReveal key="reveal" values={reveal.values} previousValues={reveal.previous} scenarios={comparison?.scenarios}
   changeLabel={reveal.label} note={reveal.note} onDone={()=>{setReveal(null);revealDone.current?.();revealDone.current=null}}/>}</AnimatePresence>
 </div>;
}
