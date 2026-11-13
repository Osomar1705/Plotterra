import { useEffect, useMemo, useState } from 'react';
import type { AppliedChange, Comparison, EntryConditions, FieldShiftApiError } from '../types/fieldshift';
import { applyChange, createComparison, getComparison, interpretAssistant, undoChange } from '../api/fieldshiftApi';
import { readEntryConditions, readQueryContext } from '../integration/entryContext';
import { AlternativeCard } from './AlternativeCard';
import { AssistantDrawer } from './AssistantDrawer';
import { GreennessPanel } from './GreennessPanel';
import { ChatIcon, FlaskIcon, LeafIcon, PinIcon, SproutIcon, WaterIcon } from './Icons';

const quickChanges: AppliedChange[] = [
  {type:'irrigation',operation:'reduce',value:30,unit:'percent',label:'30% menos riego'},
  {type:'exclude_crop',operation:'exclude',value:'cebada',unit:'crop',label:'Sin cebada'},
  {type:'first_crop',operation:'set',value:'papa',unit:'crop',label:'Papa al inicio'},
];

function changeKey(c?:AppliedChange|null){return c?`${c.type}:${c.operation}:${c.value}:${c.unit}`:''}

export function ComparisonPage(){
  const [comparison,setComparison]=useState<Comparison|null>(null);
  const [previous,setPrevious]=useState<Comparison|null>(null);
  const [pending,setPending]=useState<AppliedChange|null>(null);
  const [loading,setLoading]=useState(true);
  const [processing,setProcessing]=useState(false);
  const [error,setError]=useState<FieldShiftApiError|null>(null);
  const [assistantOpen,setAssistantOpen]=useState(false);
  const [assistantHasResult,setAssistantHasResult]=useState(false);

  useEffect(()=>{(async()=>{setLoading(true);setError(null);try{
    const q=readQueryContext(); const entry=readEntryConditions();
    if(q.comparisonId) setComparison(await getComparison(q.comparisonId));
    else setComparison(await createComparison({...entry,plotId:q.plotId??entry?.plotId} as EntryConditions));
  }catch(e:any){setError(e)}finally{setLoading(false)}})()},[]);

  const activeLabel = comparison?.activeChanges.at(-1)?.label ?? (comparison?.activeChanges.length ? 'Escenario modificado' : null);
  const area = comparison?.areaHa ?? 3.5;
  const ordered = useMemo(()=>comparison?.alternatives ?? [],[comparison]);

  async function recalc(change:AppliedChange, fromAssistant=false){
    if(!comparison||processing)return; setProcessing(true);setError(null);setAssistantHasResult(false);
    try{const old=comparison;const next=await applyChange(comparison.id,change);setPrevious(old);setComparison(next);setPending(null);if(fromAssistant)setAssistantHasResult(true)}catch(e:any){setError(e)}finally{setProcessing(false)}
  }
  async function undo(){if(!comparison||processing)return;setProcessing(true);setError(null);try{const next=previous??await undoChange(comparison);setComparison(next);setPrevious(null);setPending(null)}catch(e:any){setError(e)}finally{setProcessing(false)}}
  function openPlan(alternativeId:string){if(!comparison)return;const url=`/plan?comparisonId=${encodeURIComponent(comparison.id)}&alternativeId=${encodeURIComponent(alternativeId)}`;window.dispatchEvent(new CustomEvent('fieldshift:open-plan',{detail:{comparisonId:comparison.id,alternativeId}}));window.history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));}

  if(loading) return <div className="page-center"><div className="spinner"/><p>Cargando opciones…</p></div>;
  if(!comparison) return <div className="page-center error-state"><h2>No pudimos cargar las opciones</h2><p>{error?.farmerMessage}</p>{error?.runId&&<small>Referencia: {error.runId}</small>}</div>;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/"><LeafIcon/>FieldShift</a><nav className="steps"><span>1&nbsp; Parcela</span><strong>2&nbsp; Opciones</strong><span>3&nbsp; Plan</span></nav></header>
    <main className="comparison-page">
      <section className="hero-row"><div><h1>Tres formas de planificar tu próxima siembra</h1><p>{activeLabel?'Resultados actualizados según el escenario aplicado.':'Compara alternativas según lo que más te importa.'}</p></div><div className="parcel-meta"><div><PinIcon/>Parcela 1 · {area} ha</div><small>ⓘ Datos estimados por hectárea</small></div></section>

      {comparison.plotId&&comparison.plotId!=='unknown'&&<GreennessPanel plotId={comparison.plotId}/>}

      {activeLabel&&<div className="updated-banner"><span>✓ Comparación actualizada · {activeLabel}</span><button onClick={undo}>Deshacer</button></div>}
      {error&&<div className="error-banner"><div><strong>{error.code}</strong><span>{error.farmerMessage}</span></div>{error.runId&&<small>run_id: {error.runId}</small>}</div>}

      <section className="cards-grid">{ordered.map(a=><AlternativeCard key={a.id} alternative={a} priority={!activeLabel&&a.type===comparison.priority} onOpenPlan={openPlan}/>)}</section>

      <section className="scenario-panel"><div className="scenario-copy"><FlaskIcon/><div><h2>{pending?'Cambio seleccionado':'¿Qué quieres probar?'}</h2><p>{pending?(pending.label==='30% menos riego'?'Riego −30% · La lluvia se mantiene':'Listo para recalcular'):'Elige un cambio frecuente o pregunta al asistente.'}</p></div></div><div className="quick-actions">{quickChanges.map((c,i)=><button key={changeKey(c)} className={changeKey(c)===changeKey(pending)?'selected':''} onClick={()=>setPending(changeKey(c)===changeKey(pending)?null:c)}>{i===0?<WaterIcon/>:i===1?<SproutIcon/>:<LeafIcon/>}{c.label}</button>)}</div><button className="assistant-link" onClick={()=>setAssistantOpen(true)}><ChatIcon/>Consultar al asistente</button><button className={pending?'primary-btn':'ghost-btn'} disabled={!pending||processing} onClick={()=>pending&&recalc(pending)}>{processing?'Calculando…':'Aplicar cambio'}</button></section>

      <button className="edit-link" onClick={()=>window.history.back()}>← Editar parcela</button>
    </main>

    {processing&&<div className="processing-overlay"><div className="processing-modal"><div className="spinner"/><h2>Comparando tus opciones…</h2><p>Aplicando {pending?.label ?? 'el cambio seleccionado'}</p></div></div>}
    <AssistantDrawer open={assistantOpen} onClose={()=>setAssistantOpen(false)} onInterpret={q=>interpretAssistant(comparison.id,q)} onApply={async change=>{await recalc(change,true)}} isBusy={processing} result={assistantHasResult?comparison.alternatives:undefined}/>
  </div>
}
