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
import { changeLabelEn } from '../lib/uiCopy';

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

// El interprete del motor solo traduce preguntas a cambios: si la guia corre
// sobre /consultas del backend, el resumen tras recalcular se arma aqui con las
// cifras del motor (antes se reinterpretaba como otra pregunta y repetia el cambio).
function engineSummary(label:string,rows:ResultRow[]):string{
  if(!rows.length)return `Done: the three options were recalculated with **${label}**. Check the new figures on screen.`;
  const sorted=[...rows].sort((a,b)=>b.after-a.after);
  const best=sorted[0],worst=sorted[sorted.length-1];
  const moved=rows.filter(r=>r.before!==null&&r.before!==r.after).map(r=>`${r.title} ${r.before}→${r.after}`);
  return `With **${label}**, the option that gains money in the most cases is **${best.title}**: **${best.after} of ${best.total}**.`+
    (worst!==best?` The most affected is **${worst.title}** (${worst.after} of ${worst.total}).`:'')+
    (moved.length?`\nChange against before: ${moved.join(' · ')}.`:'\nThe number of winning cases did not change; check the margins on each card.');
}

const CAPABILITIES=[
  {icon:'💬',text:'Explain the three options in simple words'},
  {icon:'🛡️',text:'Explain how often each plan gains money'},
  {icon:'🧪',text:'Try a change, such as “30% less irrigation”'},
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
 // Se incluye el resultado del simulador en la memoria reciente, no solo mensajes de texto.
 // La IA recibe estos turnos cronológicos con cada solicitud (sin almacenar la API key).
 const recentHistory=(items:Turn[]):GuideMessage[]=>items.flatMap(t=>{
   if(t.result){
     const summary=t.result.rows.map(r=>`${r.title}: ${r.after} de ${r.total} tested cases with positive margin`).join('; ');
     return [{role:'assistant' as const,text:`CALCULATED RESULT (${t.result.label}${t.result.undone?' — UNDONE':''}): ${summary||'Options updated'}.`}];
   }
   return t.text.trim()?[{role:t.role,text:t.text}]:[];
 }).slice(-16);
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
 const contextLabel=context.page==='parcel'?`Your plot${context.parcel?.locality?` · ${context.parcel.locality}`:''}`
   :context.page==='comparison'?`${context.comparison?.alternatives.length??3} options · ${context.comparison?.activeChanges.at(-1)?.label??'original conditions'}`
   :selected?`Plan ${GUIDE_ALTERNATIVE_NAMES[selected.type]} · ${campaign?.crop??'rotation'}`:'Selected plan';

 function close(){setOpen(false);rec.current?.stop();window.speechSynthesis?.cancel();setSpeakingId(null);window.setTimeout(()=>launcher.current?.focus(),0)}

 async function ask(q:string){
  const message=q.trim();if(!message||busy||simulating)return;
  setFailed(null);setDraft('');setPending(null);setSuggestions([]);
  const history:GuideMessage[]=recentHistory(turns);
  const clarification=pendingClarification;
  push('user',message);setBusy(true);
  try{
   const reply=await askGuide({message,conversationId:conversationId.current,context,history,pendingClarification:clarification});
   if(reply.conversationId)conversationId.current=reply.conversationId;
   push('assistant',reply.message,{sources:reply.sources,status:reply.status});
   setSuggestions(reply.suggestions??[]);
   if(reply.status==='proposed_change'&&reply.change){setPending(reply.change);setPendingClarification(null)}
   else if(reply.status==='needs_clarification'&&/\b(riego|agua|irrigaci[oó]n|porcentaje|irrigation|water|percent)\b/i.test([clarification?.originalQuestion,message,reply.message].filter(Boolean).join(' '))){
    setPendingClarification({kind:'irrigation_percent',originalQuestion:clarification?.originalQuestion??message});
   }else setPendingClarification(null);
  }catch(e:unknown){
   const info=e as {farmerMessage?:string};
   setTurns(prev=>prev.slice(0,-1)); // la pregunta vuelve al estado de error con "Reintentar"
   setFailed({message:info?.farmerMessage||'I could not answer right now.',question:message});
  }finally{setBusy(false)}
 }
 function submit(e:FormEvent){e.preventDefault();void ask(draft)}

 async function confirm(){
  if(!pending||simulating)return;
  const change=pending;const before=context.comparison;
  setFailed(null);setSimulating(true);setPending(null);setPendingClarification(null);setSuggestions([]);
  const shown=changeLabelEn(change.label);
  push('user',`Yes, recalculate with ${shown}`);
  setOpen(false); // deja ver la animación de los 100 casos
  let comparison:Comparison|null=null;
  try{
    const updated=await runScenario(change);
    comparison=updated;
    // 1) Tarjeta con cifras del motor (no de la IA).
    push('assistant','',{result:{label:shown,rows:resultRows(before,updated)}});
    setOpen(true);setBusy(true);
    // 2) La IA explica la comparación nueva, sin recalcular nada.
    const reply=await askGuide({
      message:`RESUMEN_POST_SIMULACION: Applied ${change.label??'the confirmed scenario'}. Explain the new alternatives in plain English. Do not suggest another scenario in this reply.`,
      conversationId:conversationId.current,context:{...context,comparison:updated,page:'comparison'},
      history:[...recentHistory(turns),
        {role:'user' as const,text:`Yes, I confirm recalculating with ${change.label??'this change'}`},
        {role:'assistant' as const,text:`CALCULATED RESULT (${change.label}): ${resultRows(before,updated).map(r=>`${r.title}: positive gain in ${r.after} of ${r.total} tested cases`).join('; ')}.`}
      ].slice(-16),
    });
    if(reply.conversationId)conversationId.current=reply.conversationId;
    push('assistant',reply.fromEngine?engineSummary(shown,resultRows(before,updated)):reply.message,{sources:reply.sources,status:'answered'});
    setSuggestions(['Which is safest now?','Why did it change?','What data does it use?']);
    setPendingClarification(null);
  }catch(e:unknown){
    const info=e as {farmerMessage?:string};
    push('assistant',comparison?'The simulation finished, but the explanation is unavailable. The updated results are shown; you can ask again.':(info?.farmerMessage??'The simulation did not finish, so no figures were changed. Please retry.'));
  }finally{setBusy(false);setSimulating(false);setOpen(true)}
 }

 async function undo(turnId:number){
  if(busy||simulating)return;
  setBusy(true);
  try{
   const back=await undoLast();
   setPending(null);setPendingClarification(null);setSuggestions([]);
   setTurns(prev=>prev.map(t=>t.id===turnId&&t.result?{...t,result:{...t.result,undone:true}}:t));
   push('assistant',back?'Done. Your previous conditions and results are restored.':'There was no change to undo.');
  }finally{setBusy(false)}
 }

 function speak(t:Turn){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  if(speakingId===t.id){setSpeakingId(null);return}
  const u=new SpeechSynthesisUtterance(t.text.replace(/\*\*|`/g,''));u.lang='en-US';u.rate=.95;
  u.onend=()=>setSpeakingId(null);setSpeakingId(t.id);window.speechSynthesis.speak(u);
 }
 function dictate(){
  if(!SpeechCtor)return;
  if(listening){rec.current?.stop();return}
  const r=new SpeechCtor();r.lang='en-US';r.interimResults=true;
  r.onresult=(e:any)=>{const text=Array.from(e.results as ArrayLike<any>).map((x:any)=>x[0].transcript).join(' ');setDraft(text)};
  r.onend=()=>setListening(false);r.onerror=()=>setListening(false);
  rec.current=r;setListening(true);r.start();
 }
 function reset(){setTurns([]);setPending(null);setFailed(null);setSuggestions([]);setPendingClarification(null);conversationId.current=`fs_${Math.random().toString(36).slice(2,11)}`}

 const chips=(suggestions.length?suggestions:recommended).slice(0,3);
 const empty=turns.length===0&&!busy;

 return <>
  {!open && <button ref={launcher} className="guide-launcher" onClick={()=>setOpen(true)} aria-label="Open Plotterra guide"><span className="guide-launcher-mark"><SproutIcon size={23}/></span><span>Questions? Ask me</span></button>}
  {open&&<><div className="guide-backdrop" onClick={close}/><aside className="guide-drawer" role="dialog" aria-modal="true" aria-label="Plotterra guide">
   <span className="guide-grabber" aria-hidden="true"/>
   <header className="guide-header"><div className="guide-identity"><span className="guide-leaf"><SproutIcon size={22}/><i className={aiOffline?'off':''}/></span><span><strong>Plotterra guide</strong><small>AI assistant · {isDemo?'demo mode':aiOffline?'AI not connected':'uses your current results'}</small></span></div><div className="guide-header-actions">{turns.length>0&&<button onClick={reset} title="New conversation" aria-label="New conversation">↺</button>}<button onClick={close} title="Close" aria-label="Close assistant"><CloseIcon size={21}/></button></div></header>
   <div className="guide-context" title="The guide uses results from this screen"><span className="guide-context-tag">{context.page==='parcel'?'PLOT':context.page==='comparison'?'OPTIONS':'PLAN'}</span><span>Viewing: {contextLabel}</span></div>
   {aiOffline&&<div className="guide-demo-note guide-ai-warning">AI is not connected: {aiHealth?.message??'start the AI server.'} The rest of Plotterra still works.</div>}
   {!isDemo&&!aiOffline&&isUsingMocks()&&<div className="guide-demo-note guide-ai-sample">These figures are demonstration data.</div>}

   <div className="guide-messages" aria-live="polite">
    {empty&&<div className="guide-welcome">
      <p className="guide-welcome-hi">Hi! What would you like to know about your planting plan?</p>
      <div className="guide-starters guide-starters--v7">{CAPABILITIES.map((c,i)=><button key={c.text} onClick={()=>void ask([
        'Explain the three options in simple words.',
        'Explain how often each plan gains money in the model tests.',
        'What if I have 30% less irrigation?'
      ][i])}><span aria-hidden="true">{c.icon}</span>{c.text}<span aria-hidden="true">→</span></button>)}</div>
    </div>}

    {turns.map(t=>t.result?
      <div key={t.id} className={`guide-result ${t.result.undone?'guide-result--undone':''}`}>
        <div className="guide-result-head"><span>SIMULATOR RESULT</span><strong>{t.result.label}</strong></div>
        {t.result.rows.length?<ul>{t.result.rows.map(r=>{const d=r.before===null?0:r.after-r.before;return <li key={r.type} className={`gr-${r.type}`}>
          <span className="gr-name">{r.title}</span>
          <span className="gr-bar" aria-hidden="true"><i style={{width:`${r.after/r.total*100}%`}}/></span>
          <span className="gr-val"><b>{r.after}/{r.total}</b> cases{r.before!==null&&d!==0&&<em className={d<0?'down':'up'}>{d>0?'+':''}{d}</em>}</span>
        </li>})}</ul>:<p className="guide-result-empty">The options were updated on screen.</p>}
        {t.result.undone?<p className="guide-result-note">Change undone</p>:<button className="guide-undo" onClick={()=>void undo(t.id)} disabled={busy||simulating}>↶ Undo this change</button>}
      </div>
     :<div key={t.id} className={`guide-turn guide-turn--${t.role}`}>
      {t.role==='assistant'&&<span className="guide-turn-icon"><LeafIcon size={17}/></span>}
      <div className="guide-bubble"><GuideFormattedText text={t.text}/>{t.role==='assistant'&&<div className="guide-message-tools">{'speechSynthesis' in window&&<button onClick={()=>speak(t)} aria-label={speakingId===t.id?'Stop reading':'Listen to reply'}>{speakingId===t.id?'■ Stop':'🔊 Listen'}</button>}{t.sources&&t.sources.length>0&&<span className="guide-source-count">Source: {t.sources.slice(0,2).join(' · ')}</span>}</div>}</div>
    </div>)}

    {busy&&<div className="guide-turn guide-turn--assistant"><span className="guide-turn-icon guide-thinking"><SparkIcon size={17}/></span><div className="guide-bubble guide-bubble--typing">Checking your results <span/><span/><span/></div></div>}
    {pending&&!busy&&<div className="guide-confirm" role="group" aria-label="Confirm a change">
      <div className="guide-confirm-label"><WaterIcon size={18}/> PROPOSED CHANGE</div>
      <strong>{changeLabelEn(pending.label)}</strong>
      <p>I will recalculate all three plans with this change. The other conditions stay the same. <b>You can undo it later.</b></p>
      <div><button className="guide-outline" onClick={()=>{push('assistant','Understood. I will not apply that change. What else would you like to know?');setPending(null)}}>No, thanks</button><button className="guide-accept" onClick={()=>void confirm()}>Yes, recalculate</button></div>
    </div>}
    {failed&&<div className="guide-error" role="alert"><p>{failed.message}</p><button onClick={()=>void ask(failed.question)}>↻ Retry</button></div>}
    <div ref={last}/>
   </div>

   {!empty&&!busy&&!pending&&!simulating&&chips.length>0&&<div className="guide-suggestions" aria-label="Suggested questions">{chips.map(s=><button key={s} onClick={()=>void ask(s)}>{s}</button>)}</div>}
   <form className="guide-compose" onSubmit={submit}>
    <input ref={input} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy||simulating} placeholder={listening?'Listening…':'Type or dictate a question…'} aria-label="Question for the Plotterra guide"/>
    {SpeechCtor&&<button type="button" className={`guide-mic ${listening?'on':''}`} onClick={dictate} disabled={busy||simulating} aria-label={listening?'Stop listening':'Dictate question'} aria-pressed={listening}>🎙</button>}
    <button type="submit" disabled={busy||simulating||!draft.trim()} aria-label="Send question"><ChatIcon size={19}/></button>
   </form>
  </aside></>}
 </>;
}
