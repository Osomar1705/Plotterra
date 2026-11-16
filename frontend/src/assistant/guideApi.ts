import { PEN_PER_USD, FX_DATE } from '../lib/money';
import type { AppliedChange } from '../types/fieldshift';
import type { GuideReply, GuideRequest } from './types';
import { demoGuideReply } from './demoAdvisor';
import { isUsingMocks } from '../api/fieldshiftApi';
import { changeLabelEn } from '../lib/uiCopy';

// En Render el asistente usa el backend FastAPI y OpenAI.
// El modo determinista SOLO se activa de manera explícita para pruebas sin clave.
const mode=String(import.meta.env.VITE_GUIDE_MODE??'ai');
const endpoint=String(import.meta.env.VITE_GUIDE_API_URL??'/api/v1/guide-chat');
const str=(v:unknown)=>typeof v==='string'?v:undefined;
export const guideIsDemo=()=>mode==='demo';

export async function guideHealth():Promise<{ready:boolean;model:string;message?:string}>{
 if(guideIsDemo())return {ready:true,model:'demo replies'};
 const url=endpoint.replace(/\/(?:consultas|guide-chat)(?:\?.*)?$/,'/guide-health');
 try{
  const response=await fetch(`${url}?probe=true`,{cache:'no-store'});
  const data=await response.json();
  return {ready:response.ok&&data.probe?.ok===true,model:str(data.model)??'OpenAI assistant',message:data.probe?.error?.pista??data.probe?.error?.detalle??(data.probe?.ok?str(data.message):'OPENAI_API_KEY is missing or the AI API is unavailable. Check Render environment variables.')};
 }catch{return {ready:false,model:'OpenAI assistant',message:'Check the backend URL and the Render deployment.'}}
}

function normalizeChange(v:unknown):AppliedChange|undefined{
 if(!v||typeof v!=='object')return undefined;
 const r=v as Record<string,unknown>;
 const type=str(r.type??r.tipo);
 if(!type)return undefined;
 return {id:str(r.id),type,operation:str(r.operation??r.operacion),value:(r.value??r.valor) as number|string|undefined,unit:str(r.unit??r.unidad),label:str(r.label??r.etiqueta)};
}
function normalizeGuide(raw:unknown,conversationId:string):GuideReply{
 if(!raw||typeof raw!=='object')throw {farmerMessage:'The AI returned an incomplete reply.'};
 const r=raw as Record<string,unknown>;
 const change=normalizeChange(r.change??r.cambio);
 const inputStatus=str(r.status??r.estado)??(change?'proposed_change':'answered');
 const status:GuideReply['status']=
 ['understood','proposed_change','confirm_change'].includes(inputStatus)?'proposed_change':
 ['needs_clarification','aclaracion','clarification'].includes(inputStatus)?'needs_clarification':
 ['unsupported','no_soportado'].includes(inputStatus)?'unsupported':'answered';
 const message=str(r.message??r.mensaje_agricultor??r.respuesta??r.reply??r.mensaje??r.clarification??r.aclaracion)??
 (status==='proposed_change'&&change?`Understood: ${changeLabelEn(change.label)}. Shall I recalculate?`:status==='needs_clarification'?'Could you add a little more detail?':'');
 if(status==='proposed_change'&&!change)throw {farmerMessage:'The AI could not identify a valid change.'};
 if(!message)throw {farmerMessage:'The AI did not return a clear explanation.'};
 return {
  status,message,
  intent:str(r.intent??r.intencion),
  conversationId:str(r.conversation_id??r.conversationId)??conversationId,
  suggestions:Array.isArray(r.suggestions)?r.suggestions.filter((v):v is string=>typeof v==='string').slice(0,3):undefined,
  sources:Array.isArray(r.sources)?r.sources.filter((v):v is string=>typeof v==='string').slice(0,4):undefined,
  change,requiresConfirmation:status==='proposed_change',runId:str(r.run_id),
  fromEngine:'interpretado_por' in r,
 };
}

/** Las credenciales se guardan exclusivamente en FastAPI (Render), no en React. */
export async function askGuide(input:GuideRequest):Promise<GuideReply>{
 // El servidor necesita saber si hay motor real (cualquier cambio) o solo la demo local (30 % menos riego).
 const req:GuideRequest={...input,context:{...input.context,engine:isUsingMocks()?'local_mock':'backend',displayFx:{penPerUsd:PEN_PER_USD,asOf:FX_DATE}}};
 if(guideIsDemo()){
  await new Promise(r=>setTimeout(r,550));
  return {...demoGuideReply(req),conversationId:req.conversationId};
 }
 const payload={
  conversation_id:req.conversationId,
  comparison_id:req.context.comparison?.id,
  alternative_id:req.context.selectedAlternativeId,
  campaign_index:req.context.campaignIndex,
  page:req.context.page,
  message:req.message,
  history:req.history.slice(-16),
  pending_clarification:req.pendingClarification??null,
  context:req.context,
 };
 let response:Response;
 try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})}
 catch{throw {farmerMessage:'Cannot connect to the AI backend. Check the Render service URL and status.'}}
 let raw:unknown;
 try{raw=await response.json()}catch{throw {farmerMessage:'The AI returned an invalid reply.'}}
 if(!response.ok){const obj=raw as Record<string,unknown>|null;const nested=obj?.error as Record<string,unknown>|undefined;throw {farmerMessage:str(nested?.mensaje_agricultor??obj?.mensaje_agricultor??obj?.message)??`AI request failed (HTTP ${response.status})`,runId:str(nested?.run_id??obj?.run_id)}}
 return normalizeGuide(raw,req.conversationId);
}
