import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AppliedChange, Comparison } from '../types/fieldshift';
import { ChatIcon, CloseIcon, LeafIcon, SparkIcon, SproutIcon, WaterIcon } from '../components/Icons';
import { isUsingMocks } from '../api/fieldshiftApi';
import { useGuide } from './GuideProvider';
import { defaultSuggestions } from './demoAdvisor';
import { askGuide, guideHealth, guideIsDemo } from './guideApi';
import { GUIDE_ALTERNATIVE_NAMES } from './types';
import type { GuideClarification, GuideMessage, GuideReply } from './types';
import { GuideFormattedText } from './GuideFormattedText';

/**
 * Guía FieldShift · panel conversacional.
 * Patrones aplicados (NN/g, Shape of AI, guías de chatbots 2025-26):
 *  1. Decir qué puede y qué no puede hacer antes de la primera pregunta.
 *  2. Preguntas sugeridas según la página (el agricultor no tiene que redactar).
 *  3. Contexto visible: sobre qué parcela/plan está respondiendo.
 *  4. Cambios solo con confirmación explícita y con "Deshacer" después.
 *  5. Resultados como tarjeta con cifras del MOTOR (la IA nunca las calcula).
 *  6. Estados claros: escribiendo, error con "Reintentar", IA no conectada.
 *  7. Voz: dictar la pregunta y escuchar la respuesta (útil en campo).
 */

type ResultRow={type:string;title:string;before:number|null;after:number;total:number};
type Turn={id:number;role:'user'|'assistant';text:string;sources?:string[];status?:GuideReply['status'];result?:{label:string;rows:ResultRow[];undone?:boolean}};

const winsOf=(a?:{outcomes?:{marginByScenario:number[]}})=>a?.outcomes?.marginByScenario?.length?a.outcomes.marginByScenario.filter(x=>x>0).length:null;
function resultRows(before:Comparison|null|undefined,after:Comparison):ResultRow[]{
  return after.alternatives.flatMap(a=>{
    const w=winsOf(a);if(w===null)return [];
    const prev=before?.alternatives.find(b=>b.type===a.type);
    return [{type:a.type,title:GUIDE_ALTERNATIVE_NAMES[a.type],before:winsOf(prev),after:w,total:a.outcomes!.marginByScenario.length}];
  });
}

const CAPABILITIES=[
  {icon:'💬',text:'Explicarte cada opción con palabras simples'},
  {icon:'🛡️',text:'Decirte qué tan segura es (en cuántos casos gana)'},
  {icon:'🧪',text:'Probar un cambio, como “30 % menos riego”'},
];

type SpeechRec={lang:string;interimResults:boolean;onresult:(e:any)=>void;onend:()=>void;onerror:()=>void;start:()=>void;stop:()=>void};
const SpeechCtor:(new()=>SpeechRec)|undefined=typeof window!=='undefined'?((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition):undefined;

export function GuideDrawer(){
 const {open,setOpen,initialQuestion,clearInitialQuestion,context,runScenario,undoLast}=useGuide();
 const [draft,setDraft]=useState('');
 const [turns,setTurns]=useState<Turn[]>([]);
 const [busy,setBusy]=useState(false);
 const [simulating,setSimulating]=useState(false);
 const [pending,setPending]=useState<AppliedChange|null>(null);
 const [suggestions,setSuggestions]=useState<string[]>([]);
 const [failed,setFailed]=useState<{message:string;question:string}|null>(null);
 const [pendingClarification,setPendingClarification]=useState<GuideClarification|null>(null);
 const [aiHealth,setAiHealth]=useState<{ready:boolean;model:string;message?:string}|null>(null);
 const [listening,setListening]=useState(false);
 const [speakingId,setSpeakingId]=useState<number|null>(null);
 const nextId=useRef(1);
 const conversationId=useRef(`fs_${Math.random().toString(36).slice(2,11)}`);
 const last=useRef<HTMLDivElement|null>(null);
 const input=useRef<HTMLInputElement|null>(null);
 const launcher=useRef<HTMLButtonElement|null>(null);
 const rec=useRef<SpeechRec|null>(null);
 const push=(role:Turn['role'],text:string,extras:Partial<Turn>={})=>setTurns(prev=>[...prev,{id:nextId.current++,role,text,...extras}].slice(-40));

 useEffect(()=>{if(!initialQuestion||!open)return;clearInitialQuestion();void ask(initialQuestion)},[initialQuestion,open,clearInitialQuestion]);
 useEffect(()=>{if(open){input.current?.focus();last.current?.scrollIntoView({block:'end',behavior:'smooth'})}},[open,turns.length,busy,pending,failed]);
 useEffect(()=>{if(!open)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[open]);
 const isDemo=guideIsDemo();
 useEffect(()=>{if(!open||isDemo)return;let live=true;guideHealth().then(info=>{if(live)setAiHealth(info)});return()=>{live=false}},[open,isDemo]);

 const recommended=defaultSuggestions(context.page);
 const selected=context.comparison?.alternatives.find(a=>a.id===context.selectedAlternativeId);
 const campaign=selected?.campaigns[context.campaignIndex??0];
 const aiOffline=!isDemo&&aiHealth!==null&&!aiHealth.ready;
 const contextLabel=context.page==='parcel'?`Tu parcela${context.parcel?.locality?` · ${context.parcel.locality}`:''}`
   :context.page==='comparison'?`${context.comparison?.alternatives.length??3} opciones · ${context.comparison?.activeChanges.at(-1)?.label??'condiciones normales'}`
   :selected?`Plan ${GUIDE_ALTERNATIVE_NAMES[selected.type]} · ${campaign?.crop??'rotación'}`:'Plan seleccionado';

 function close(){setOpen(false);rec.current?.stop();window.speechSynthesis?.cancel();setSpeakingId(null);window.setTimeout(()=>launcher.current?.focus(),0)}

 async function ask(q:string){
  const message=q.trim();if(!message||busy||simulating)return;
  setFailed(null);setDraft('');setPending(null);setSuggestions([]);
  const history:GuideMessage[]=turns.filter(t=>!t.result).map(t=>({role:t.role,text:t.text}));
  const clarification=pendingClarification;
  push('user',message);setBusy(true);
  try{
   const reply=await askGuide({message,conversationId:conversationId.current,context,history,pendingClarification:clarification});
   if(reply.conversationId)conversationId.current=reply.conversationId;
   push('assistant',reply.message,{sources:reply.sources,status:reply.status});
   setSuggestions(reply.suggestions??[]);
   if(reply.status==='proposed_change'&&reply.change){setPending(reply.change);setPendingClarification(null)}
   else if(reply.status==='needs_clarification'&&/\b(riego|agua|irrigaci[oó]n|porcentaje)\b/i.test([clarification?.originalQuestion,message,reply.message].filter(Boolean).join(' '))){
    setPendingClarification({kind:'irrigation_percent',originalQuestion:clarification?.originalQuestion??message});
   }else setPendingClarification(null);
  }catch(e:unknown){
   const info=e as {farmerMessage?:string};
   setTurns(prev=>prev.slice(0,-1)); // la pregunta vuelve al estado de error con "Reintentar"
   setFailed({message:info?.farmerMessage||'No pude responder ahora.',question:message});
  }finally{setBusy(false)}
 }
 function submit(e:FormEvent){e.preventDefault();void ask(draft)}

 async function confirm(){
  if(!pending||simulating)return;
  const change=pending;const before=context.comparison;
  setFailed(null);setSimulating(true);setPending(null);setSuggestions([]);
  push('user',`Sí, recalcular con ${change.label??'ese cambio'}`);
  setOpen(false); // deja ver la animación de los 100 casos
  let comparison:Comparison|null=null;
  try{
    comparison=await runScenario(change);
    // 1) Tarjeta con cifras del motor (no de la IA).
    push('assistant','',{result:{label:change.label??'Nuevo escenario',rows:resultRows(before,comparison)}});
    setOpen(true);setBusy(true);
    // 2) La IA explica la comparación nueva, sin recalcular nada.
    const reply=await askGuide({
      message:`RESUMEN_POST_SIMULACION: Se aplicó ${change.label??'el escenario confirmado'}. Explica de forma sencilla qué muestran ahora las alternativas. No propongas otro cambio en esta respuesta.`,
      conversationId:conversationId.current,context:{...context,comparison,page:'comparison'},
      history:turns.filter(t=>!t.result).map(t=>({role:t.role,text:t.text})),
    });
    if(reply.conversationId)conversationId.current=reply.conversationId;
    push('assistant',reply.message,{sources:reply.sources,status:reply.status});
    setSuggestions(reply.suggestions?.length?reply.suggestions:['¿Cuál es la más segura ahora?','¿Por qué cambió?','¿Qué datos utiliza?']);
    setPendingClarification(null);
  }catch(e:unknown){
    const info=e as {farmerMessage?:string};
    push('assistant',comparison?'La simulación terminó, pero no pude obtener la explicación. Las cifras nuevas ya están en pantalla; puedes volver a preguntarme.':(info?.farmerMessage??'No se pudo completar la simulación. No cambié ninguna cifra. Intenta de nuevo.'));
  }finally{setBusy(false);setSimulating(false);setOpen(true)}
 }

 async function undo(turnId:number){
  if(busy||simulating)return;
  setBusy(true);
  try{
   const back=await undoLast();
   setTurns(prev=>prev.map(t=>t.id===turnId&&t.result?{...t,result:{...t.result,undone:true}}:t));
   push('assistant',back?'Listo, volví a las condiciones anteriores. Las cifras en pantalla ya son las de antes.':'No había un cambio para deshacer.');
  }finally{setBusy(false)}
 }

 function speak(t:Turn){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  if(speakingId===t.id){setSpeakingId(null);return}
  const u=new SpeechSynthesisUtterance(t.text.replace(/\*\*|`/g,''));u.lang='es-PE';u.rate=.95;
  u.onend=()=>setSpeakingId(null);setSpeakingId(t.id);window.speechSynthesis.speak(u);
 }
 function dictate(){
  if(!SpeechCtor)return;
  if(listening){rec.current?.stop();return}
  const r=new SpeechCtor();r.lang='es-PE';r.interimResults=true;
  r.onresult=(e:any)=>{const text=Array.from(e.results as ArrayLike<any>).map((x:any)=>x[0].transcript).join(' ');setDraft(text)};
  r.onend=()=>setListening(false);r.onerror=()=>setListening(false);
  rec.current=r;setListening(true);r.start();
 }
 function reset(){setTurns([]);setPending(null);setFailed(null);setSuggestions([]);setPendingClarification(null);conversationId.current=`fs_${Math.random().toString(36).slice(2,11)}`}

 const chips=(suggestions.length?suggestions:recommended).slice(0,3);
 const empty=turns.length===0&&!busy;

 return <>
  {!open && <button ref={launcher} className="guide-launcher" onClick={()=>setOpen(true)} aria-label="Abrir Guía FieldShift"><span className="guide-launcher-mark"><SproutIcon size={23}/></span><span>¿Dudas? Pregúntame</span></button>}
  {open&&<><div className="guide-backdrop" onClick={close}/><aside className="guide-drawer" role="dialog" aria-modal="true" aria-label="Guía FieldShift">
   <span className="guide-grabber" aria-hidden="true"/>
   <header className="guide-header"><div className="guide-identity"><span className="guide-leaf"><SproutIcon size={22}/><i className={aiOffline?'off':''}/></span><span><strong>Guía FieldShift</strong><small>Asistente con IA · {isDemo?'modo demostración':aiOffline?'IA no conectada':'responde con tus resultados'}</small></span></div><div className="guide-header-actions">{turns.length>0&&<button onClick={reset} title="Nueva conversación" aria-label="Nueva conversación">↺</button>}<button onClick={close} title="Cerrar" aria-label="Cerrar asistente"><CloseIcon size={21}/></button></div></header>
   <div className="guide-context" title="La Guía responde sobre lo que ves en esta pantalla"><span className="guide-context-tag">{context.page==='parcel'?'PARCELA':context.page==='comparison'?'OPCIONES':'PLAN'}</span><span>Viendo: {contextLabel}</span></div>
   {aiOffline&&<div className="guide-demo-note guide-ai-warning">La IA no está conectada: {aiHealth?.message??'falta configurar el servidor.'} Puedes seguir usando la app normalmente.</div>}
   {!isDemo&&!aiOffline&&isUsingMocks()&&<div className="guide-demo-note guide-ai-sample">Las cifras de esta pantalla son datos de ejemplo.</div>}

   <div className="guide-messages" aria-live="polite">
    {empty&&<div className="guide-welcome">
      <p className="guide-welcome-hi">Hola 👋 Soy tu guía. Te explico tus resultados con palabras simples.</p>
      <ul className="guide-can">{CAPABILITIES.map(c=><li key={c.text}><span aria-hidden="true">{c.icon}</span>{c.text}</li>)}</ul>
      <p className="guide-cannot">No invento cifras: todo sale del simulador. <strong>La decisión siempre es tuya.</strong></p>
      <p className="guide-try">Prueba con:</p>
      <div className="guide-starters">{recommended.slice(0,3).map(s=><button key={s} onClick={()=>void ask(s)}>{s}<span aria-hidden="true">→</span></button>)}</div>
    </div>}

    {turns.map(t=>t.result?
      <div key={t.id} className={`guide-result ${t.result.undone?'guide-result--undone':''}`}>
        <div className="guide-result-head"><span>RESULTADO DEL SIMULADOR</span><strong>{t.result.label}</strong></div>
        {t.result.rows.length?<ul>{t.result.rows.map(r=>{const d=r.before===null?0:r.after-r.before;return <li key={r.type} className={`gr-${r.type}`}>
          <span className="gr-name">{r.title}</span>
          <span className="gr-bar" aria-hidden="true"><i style={{width:`${r.after/r.total*100}%`}}/></span>
          <span className="gr-val">gana en <b>{r.after}</b> de {r.total}{r.before!==null&&d!==0&&<em className={d<0?'down':'up'}>{d>0?'+':''}{d}</em>}</span>
        </li>})}</ul>:<p className="guide-result-empty">Las opciones se actualizaron en pantalla.</p>}
        {t.result.undone?<p className="guide-result-note">Cambio deshecho</p>:<button className="guide-undo" onClick={()=>void undo(t.id)} disabled={busy||simulating}>↶ Deshacer este cambio</button>}
      </div>
     :<div key={t.id} className={`guide-turn guide-turn--${t.role}`}>
      {t.role==='assistant'&&<span className="guide-turn-icon"><LeafIcon size={17}/></span>}
      <div className="guide-bubble"><GuideFormattedText text={t.text}/>{t.role==='assistant'&&<div className="guide-message-tools">{'speechSynthesis' in window&&<button onClick={()=>speak(t)} aria-label={speakingId===t.id?'Detener lectura':'Escuchar respuesta'}>{speakingId===t.id?'■ Detener':'🔊 Escuchar'}</button>}{t.sources&&t.sources.length>0&&<span className="guide-source-count">Fuente: {t.sources.slice(0,2).join(' · ')}</span>}</div>}</div>
    </div>)}

    {busy&&<div className="guide-turn guide-turn--assistant"><span className="guide-turn-icon guide-thinking"><SparkIcon size={17}/></span><div className="guide-bubble guide-bubble--typing">Revisando tus resultados <span/><span/><span/></div></div>}
    {pending&&!busy&&<div className="guide-confirm" role="group" aria-label="Confirmar cambio">
      <div className="guide-confirm-label"><WaterIcon size={18}/> CAMBIO PROPUESTO</div>
      <strong>{pending.label??'Cambio de escenario'}</strong>
      <p>Recalcularé las 3 opciones con este cambio. Lo demás de tu parcela se mantiene. <b>Puedes deshacerlo después.</b></p>
      <div><button className="guide-outline" onClick={()=>{push('assistant','De acuerdo, no aplico ese cambio. ¿Qué más quieres saber?');setPending(null)}}>No, gracias</button><button className="guide-accept" onClick={()=>void confirm()}>Sí, recalcular</button></div>
    </div>}
    {failed&&<div className="guide-error" role="alert"><p>{failed.message}</p><button onClick={()=>void ask(failed.question)}>↻ Reintentar</button></div>}
    <div ref={last}/>
   </div>

   {!empty&&!busy&&!pending&&!simulating&&chips.length>0&&<div className="guide-suggestions" aria-label="Preguntas sugeridas">{chips.map(s=><button key={s} onClick={()=>void ask(s)}>{s}</button>)}</div>}
   <form className="guide-compose" onSubmit={submit}>
    <input ref={input} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy||simulating} placeholder={listening?'Te escucho…':'Escribe o dicta tu pregunta…'} aria-label="Pregunta para Guía FieldShift"/>
    {SpeechCtor&&<button type="button" className={`guide-mic ${listening?'on':''}`} onClick={dictate} disabled={busy||simulating} aria-label={listening?'Dejar de escuchar':'Dictar pregunta'} aria-pressed={listening}>🎙</button>}
    <button type="submit" disabled={busy||simulating||!draft.trim()} aria-label="Enviar pregunta"><ChatIcon size={19}/></button>
   </form>
   <footer className="guide-footer">Las cifras vienen del simulador FieldShift. Tú tomas la decisión.</footer>
  </aside></>}
 </>;
}
