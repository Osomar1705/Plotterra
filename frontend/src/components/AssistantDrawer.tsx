import { useState } from 'react';
import type { AppliedChange, Alternative, AssistantInterpretation } from '../types/fieldshift';
import { ChatIcon, CloseIcon, CoinsIcon, LeafIcon, SparkIcon, SproutIcon, WaterIcon } from './Icons';

export function AssistantDrawer({open,onClose,onInterpret,onApply,isBusy,result}:{
  open:boolean;onClose:()=>void;onInterpret:(q:string)=>Promise<AssistantInterpretation>;onApply:(change:AppliedChange)=>Promise<void>;isBusy:boolean;result?:Alternative[]
}){
  const [text,setText]=useState('');
  const [question,setQuestion]=useState('');
  const [interpretation,setInterpretation]=useState<AssistantInterpretation|null>(null);
  const [error,setError]=useState('');
  if(!open) return null;
  const ask=async(q=text)=>{if(!q.trim())return;setQuestion(q);setError('');try{setInterpretation(await onInterpret(q));}catch(e:any){setError(e?.farmerMessage??'No se pudo interpretar la consulta.');}};
  const hasResult=Boolean(result?.length && interpretation?.change);
  return <><div className="drawer-backdrop" onClick={onClose}/><aside className="assistant-drawer" aria-label="Asistente de escenarios">
    <header><div className="assistant-brand"><SparkIcon/><span>Asistente IA</span></div><button className="icon-btn" onClick={onClose}><CloseIcon/></button></header>
    {!question && <div className="assistant-body">
      <h2>¿Qué quieres probar?</h2><p>Puedes escribir tu pregunta o elegir una opción.</p>
      <div className="suggestions"><button onClick={()=>ask('¿Qué pasa si tengo 30% menos riego?')}><WaterIcon/>30% menos riego</button><button onClick={()=>ask('¿Qué pasa si no uso cebada?')}><SproutIcon/>Sin cebada</button><button onClick={()=>ask('Quiero empezar con papa')}><LeafIcon/>Papa al inicio</button></div>
    </div>}
    {question && <div className="assistant-body">
      <div className="user-bubble">{question}</div>
      {error && <div className="assistant-error">{error}</div>}
      {interpretation?.status==='needs_clarification' && <div className="assistant-card"><p>{interpretation.clarification}</p><button className="link-btn" onClick={()=>{setQuestion('');setInterpretation(null)}}>Reformular</button></div>}
      {interpretation?.status==='unsupported' && <div className="assistant-card"><p>Ese cambio todavía no está soportado. Prueba con riego, excluir cebada o cambiar el cultivo inicial.</p></div>}
      {interpretation?.status==='understood' && interpretation.change && !hasResult && <div className="assistant-card">
        <p>Entendí que quieres probar:</p><span className="big-chip">{interpretation.change.label ?? 'Cambio de escenario'}</span><small>La lluvia se mantiene igual, salvo que el cambio indique otra cosa.</small><p>¿Comparo nuevamente tus opciones?</p>
        <div className="assistant-actions"><button className="ghost-btn" onClick={()=>{setQuestion('');setInterpretation(null)}}>Cancelar</button><button className="primary-btn" disabled={isBusy} onClick={()=>onApply(interpretation.change!)}>{isBusy?'Comparando…':'Sí, comparar'}</button></div>
      </div>}
      {hasResult && <><h3>Con este cambio:</h3><div className="assistant-insights">
        <div><WaterIcon/><span><strong>Agua</strong><small>Revisa la alternativa con menor demanda hídrica.</small></span></div>
        <div><CoinsIcon/><span><strong>Economía</strong><small>El margen se actualizó con el nuevo escenario.</small></span></div>
        <div><SproutIcon/><span><strong>Suelo</strong><small>La compatibilidad se mantiene visible por alternativa.</small></span></div>
      </div><button className="primary-btn wide" onClick={onClose}>Ver resultados actualizados</button></>}
    </div>}
    {!question && <div className="assistant-input"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()} placeholder="Escribe tu pregunta…"/><button onClick={()=>ask()}><ChatIcon/></button></div>}
  </aside></>;
}
