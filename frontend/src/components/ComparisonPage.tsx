import { useEffect, useMemo, useRef, useState } from 'react';
import { useGuide } from '../assistant/GuideProvider';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { AndeanLandscape } from './CropIllustration';
import type { AppliedChange, Comparison, EntryConditions, FieldShiftApiError } from '../types/fieldshift';
import { applyChange, createComparison, getComparison, undoChange } from '../api/fieldshiftApi';
import { readEntryConditions, readQueryContext } from '../integration/entryContext';
import { AlternativeCard } from './AlternativeCard';
import { ChatIcon, FlaskIcon, LeafIcon, PinIcon, SproutIcon, WaterIcon } from './Icons';
import { FuturesPanel } from './futures/FuturesPanel';
import { SimulationReveal } from './futures/SimulationReveal';
import { scenarioLabel, signedMoney } from './futures/futuresModel';
import './futures/futures.css';

const quickChanges: AppliedChange[] = [
  {type:'irrigation',operation:'reduce',value:30,unit:'percent',label:'30% menos riego'},
  {type:'exclude_crop',operation:'exclude',value:'cebada',unit:'crop',label:'Sin cebada'},
  {type:'first_crop',operation:'set',value:'papa',unit:'crop',label:'Papa al inicio'},
];

function changeKey(c?:AppliedChange|null){return c?`${c.type}:${c.operation}:${c.value}:${c.unit}`:''}
const altTitle = { economy:'Economía', water:'Agua', soil:'Suelo', unknown:'Alternativa' } as const;
const HERO_LAYOUT = 'futures-hero';

type Reveal = { values?: number[]; previous?: number[]; label?: string | null; first: boolean; note?: string | null };

export function ComparisonPage(){
  const [comparison,setComparison]=useState<Comparison|null>(null);
  const [previous,setPrevious]=useState<Comparison|null>(null);
  const [pending,setPending]=useState<AppliedChange|null>(null);
  const [loading,setLoading]=useState(true);
  const [processing,setProcessing]=useState(false);
  const [error,setError]=useState<FieldShiftApiError|null>(null);
  const [reveal,setReveal]=useState<Reveal|null>({first:true});
  const [hovered,setHovered]=useState<number|null>(null);
  const [panelOpen,setPanelOpen]=useState(false);
  const revealDone=useRef<(()=>void)|null>(null);
  const {openGuide,setPage,setParcel,setComparison:publishComparison,registerRunner,registerUndo}=useGuide();
  useEffect(()=>{setPage('comparison');const entry=readEntryConditions();if(entry)setParcel(entry)},[setPage,setParcel]);
  useEffect(()=>{if(comparison)publishComparison(comparison)},[comparison,publishComparison]);
  useEffect(()=>{registerRunner(recalc);registerUndo(async()=>{if(!comparison?.activeChanges.length)return null;return undo()});return ()=>{registerRunner(null);registerUndo(null)}});

  const heroOf=(c:Comparison|null)=>c?.alternatives.find(a=>a.type===c.priority&&a.outcomes)??c?.alternatives.find(a=>a.outcomes);

  // `alive` evita que una carga descartada (React monta dos veces en desarrollo,
  // o el usuario sale antes de que responda) pinte su error sobre la buena.
  useEffect(()=>{let alive=true;(async()=>{setLoading(true);setError(null);try{
    const q=readQueryContext(); const entry=readEntryConditions();
    const c = q.comparisonId ? await getComparison(q.comparisonId)
      : await createComparison({...entry,plotId:q.plotId??entry?.plotId} as EntryConditions);
    if(!alive)return;
    setComparison(c);setError(null);
    const hero=heroOf(c);
    setReveal(hero?{first:true,values:hero.outcomes!.marginByScenario}:null);   // sin outcomes: sin animación
  }catch(e:any){if(alive){setError(e);setReveal(null)}}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[]);

  const activeLabel = comparison?.activeChanges.at(-1)?.label ?? (comparison?.activeChanges.length ? 'Escenario modificado' : null);
  const area = comparison?.areaHa ?? 3.5;
  const ordered = useMemo(()=>comparison?.alternatives ?? [],[comparison]);
  const hero = heroOf(comparison);

  /** Recalcula con el motor y espera a que termine la animación de los 100 futuros. Lo usa también la Guía (chat). */
  async function recalc(change:AppliedChange):Promise<Comparison>{
    if(!comparison||processing)throw {farmerMessage:'Ya hay un cálculo en curso. Prueba de nuevo cuando termine.'};
    setProcessing(true);setError(null);
    const oldHero=heroOf(comparison);
    setReveal({first:false,label:change.label??null,previous:oldHero?.outcomes?.marginByScenario});
    try{
      const old=comparison;
      const next=await applyChange(comparison.id,change);
      setPrevious(old);setComparison(next);setPending(null);
      const nh=heroOf(next);
      const seq=(a?:typeof nh)=>a?.campaigns.map(c=>c.crop).join(' → ');
      const note=nh&&oldHero&&seq(nh)!==seq(oldHero)?`La opción ${altTitle[nh.type]} ahora es ${seq(nh)}`:null;
      if(nh){
        const done=new Promise<void>(r=>{revealDone.current=r;window.setTimeout(r,7000)});
        setReveal(r=>r?{...r,values:nh.outcomes!.marginByScenario,note}:null);
        setProcessing(false);
        await done;
      }else setReveal(null);
      return next;
    }catch(e:any){setError(e);setReveal(null);throw e}finally{setProcessing(false)}
  }
  async function undo():Promise<Comparison|null>{if(!comparison||processing)return null;setProcessing(true);setError(null);try{const next=previous??await undoChange(comparison);setComparison(next);setPrevious(null);setPending(null);return next}catch(e:any){setError(e);return null}finally{setProcessing(false)}}
  function openPlan(alternativeId:string){if(!comparison)return;const url=`/plan?comparisonId=${encodeURIComponent(comparison.id)}&alternativeId=${encodeURIComponent(alternativeId)}`;window.dispatchEvent(new CustomEvent('fieldshift:open-plan',{detail:{comparisonId:comparison.id,alternativeId}}));window.history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));}

  const showOverlay = !!reveal && (loading || processing || !!reveal.values);

  if(!loading && !comparison) return <div className="page-center error-state"><h2>No pudimos cargar las opciones</h2><p>{error?.farmerMessage}</p>{error?.runId&&<small>Referencia: {error.runId}</small>}</div>;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/"><LeafIcon/>FieldShift</a><nav className="steps"><a href="/">1&nbsp; Parcela</a><strong>2&nbsp; Opciones</strong><span>3&nbsp; Plan</span></nav></header>
    <LayoutGroup>
    {comparison && <main className="comparison-page">
      <motion.section className="cmp-hero" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.5}}>
        <AndeanLandscape className="cmp-hero-art" tone="day"/>
        <div className="cmp-hero-inner">
          <div><h1>Tres formas de planificar tu próxima siembra</h1><p>{activeLabel?`Resultados actualizados · ${activeLabel}`:'Cada opción se probó en los mismos 100 futuros posibles de tu parcela.'}</p></div>
          <div className="cmp-hero-meta"><span><PinIcon/>Parcela · {area} ha</span><span>100 futuros · 3 campañas</span>{comparison.sourceResult==='mock'&&<span>Datos de demostración</span>}</div>
        </div>
      </motion.section>

      {activeLabel&&<div className="updated-banner"><span>✓ Comparación actualizada · {activeLabel}</span><button onClick={undo}>Deshacer</button></div>}
      {error&&<div className="error-banner"><div><strong>{error.code}</strong><span>{error.farmerMessage}</span></div>{error.runId&&<small>run_id: {error.runId}</small>}</div>}

      {ordered.some(a=>a.outcomes) && <div className={`same-future ${hovered!==null?'is-on':''}`} aria-live="polite">
        {hovered===null
          ? <span>Pasa el cursor sobre un cuadrito: verás <strong>el mismo futuro</strong> en las tres opciones.</span>
          : <><strong>{scenarioLabel(hovered, comparison.scenarios)}</strong>{ordered.filter(a=>a.outcomes).map(a=>{const v=a.outcomes!.marginByScenario[hovered];return <span key={a.id} className={v<0?'neg':'pos'}>{altTitle[a.type]}: {signedMoney(v)}</span>})}</>}
      </div>}

      <section className="cards-grid">{ordered.map((a,i)=><AlternativeCard key={a.id} index={i} alternative={a} priority={!activeLabel&&a.type===comparison.priority} onOpenPlan={openPlan}
        scenarios={comparison.scenarios} hoveredScenario={hovered} onHoverScenario={setHovered} onOpenFutures={()=>setPanelOpen(true)} onAsk={q=>openGuide(q)}
        layoutId={a.id===hero?.id?HERO_LAYOUT:undefined} hideGrid={showOverlay&&a.id===hero?.id}/>)}</section>

      <section className="scenario-panel scenario-panel--rail scenario-panel--always-open">
        <div className="scenario-rail-intro">
          <div className="scenario-copy"><FlaskIcon/><div><h2>{pending?'Cambio seleccionado':'Probar un cambio'}</h2><p>{pending?(pending.label==='30% menos riego'?'Riego −30% · La lluvia se mantiene':'Listo para recalcular'):'Cambia una condición o conversa con el asistente sin salir de tus tres opciones.'}</p></div></div>
        </div>
        <div className="scenario-rail-expand is-visible">
          <div className="quick-actions">{quickChanges.map((c,i)=><button key={changeKey(c)} className={changeKey(c)===changeKey(pending)?'selected':''} onClick={()=>setPending(changeKey(c)===changeKey(pending)?null:c)}>{i===0?<WaterIcon/>:i===1?<SproutIcon/>:<LeafIcon/>}{c.label}</button>)}</div>
          <button className="assistant-link assistant-link--hero" onClick={()=>openGuide()}><ChatIcon/><span><strong>Guía FieldShift · Pregunta lo que necesites</strong><small>Te explica las cifras o prueba otro escenario</small></span></button>
          <button className={`${pending?'primary-btn':'ghost-btn'} dock-apply-btn`} disabled={!pending||processing} onClick={()=>{if(pending)void recalc(pending).catch(()=>{})}}>{processing?'Calculando…':'Comparar de nuevo'}</button>
        </div>
        <div className="scenario-rail-meta">
          <span className="summary-chip">Prioridad: {altTitle[comparison.priority]}</span>
          {activeLabel && <span className="summary-chip summary-chip--active">Activo: {activeLabel}</span>}
        </div>
      </section>

      <a className="edit-link" href="/">← Editar parcela</a>
    </main>}

    <AnimatePresence>
      {showOverlay && reveal && <SimulationReveal key="reveal" values={reveal.values} previousValues={reveal.previous}
        scenarios={comparison?.scenarios} changeLabel={reveal.label} layoutId={HERO_LAYOUT} note={reveal.note}
        onDone={()=>{setReveal(null);revealDone.current?.();revealDone.current=null}}/>}
    </AnimatePresence>
    </LayoutGroup>

    {comparison && <FuturesPanel comparison={comparison} open={panelOpen} onClose={()=>setPanelOpen(false)}/>}
  </div>
}
