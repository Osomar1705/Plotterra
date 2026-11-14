import type { AppliedChange } from '../types/fieldshift';
import type { GuideReply, GuideRequest } from './types';
import { demoGuideReply } from './demoAdvisor';
import { isUsingMocks } from '../api/fieldshiftApi';

// AI-first: incluso con VITE_USE_LOCAL_MOCKS=true, las consultas usan OpenAI.
// El modo determinista SOLO se activa de manera explícita para pruebas sin clave.
const mode=String(import.meta.env.VITE_GUIDE_MODE??'ai');
const endpoint=String(import.meta.env.VITE_GUIDE_API_URL??'/api/v1/consultas');
const str=(v:unknown)=>typeof v==='string'?v:undefined;
export const guideIsDemo=()=>mode==='demo';

export async function guideHealth():Promise<{ready:boolean;model:string;message?:string}>{
 if(guideIsDemo())return {ready:true,model:'respuestas de demostración'};
 const url=endpoint.replace(/\/consultas(?:\?.*)?$/,'/guide-health');
 try{
  const response=await fetch(url,{cache:'no-store'});
  const data=await response.json();
  return {ready:response.ok&&data.ready===true,model:str(data.model)??'GPT-4o mini',message:str(data.message)};
 }catch{return {ready:false,model:'GPT-4o mini',message:'Inicia el servidor de IA con npm run dev.'}}
}

function normalizeChange(v:unknown):AppliedChange|undefined{
 if(!v||typeof v!=='object')return undefined;
 const r=v as Record<string,unknown>;
 const type=str(r.type??r.tipo);
 if(!type)return undefined;
 return {id:str(r.id),type,operation:str(r.operation??r.operacion),value:(r.value??r.valor) as number|string|undefined,unit:str(r.unit??r.unidad),label:str(r.label??r.etiqueta)};
}
function normalizeGuide(raw:unknown,conversationId:string):GuideReply{
 if(!raw||typeof raw!=='object')throw {farmerMessage:'La IA recibió una respuesta incompleta.'};
 const r=raw as Record<string,unknown>;
 const change=normalizeChange(r.change??r.cambio);
 const inputStatus=str(r.status??r.estado)??(change?'proposed_change':'answered');
 const status:GuideReply['status']=
 ['understood','proposed_change','confirm_change'].includes(inputStatus)?'proposed_change':
 ['needs_clarification','aclaracion','clarification'].includes(inputStatus)?'needs_clarification':
 ['unsupported','no_soportado'].includes(inputStatus)?'unsupported':'answered';
 const message=str(r.message??r.mensaje_agricultor??r.respuesta??r.reply??r.mensaje??r.clarification??r.aclaracion)??
 (status==='proposed_change'&&change?`Entendí: ${change.label??'cambio solicitado'}. ¿Recalculamos?`:status==='needs_clarification'?'¿Puedes darme un poco más de detalle?':'');
 if(status==='proposed_change'&&!change)throw {farmerMessage:'La IA no pudo identificar un cambio válido.'};
 if(!message)throw {farmerMessage:'La IA no devolvió una explicación comprensible.'};
 return {
  status,message,
  intent:str(r.intent??r.intencion),
  conversationId:str(r.conversation_id??r.conversationId)??conversationId,
  suggestions:Array.isArray(r.suggestions)?r.suggestions.filter((v):v is string=>typeof v==='string').slice(0,3):undefined,
  sources:Array.isArray(r.sources)?r.sources.filter((v):v is string=>typeof v==='string').slice(0,4):undefined,
  change,requiresConfirmation:status==='proposed_change',runId:str(r.run_id),
 };
}

/** La clave privada se guarda en el servidor Node. El navegador solo ve /api/v1/consultas. */
export async function askGuide(input:GuideRequest):Promise<GuideReply>{
 // El servidor necesita saber si hay motor real (cualquier cambio) o solo la demo local (30 % menos riego).
 const req:GuideRequest={...input,context:{...input.context,engine:isUsingMocks()?'local_mock':'backend'}};
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
  history:req.history.slice(-12),
  pending_clarification:req.pendingClarification??null,
  context:req.context,
 };
 let response:Response;
 try{response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})}
 catch{throw {farmerMessage:'No puedo conectar con la IA. Asegúrate de iniciar npm run dev y que el servidor esté activo.'}}
 let raw:unknown;
 try{raw=await response.json()}catch{throw {farmerMessage:'La IA no devolvió una respuesta válida.'}}
 if(!response.ok){const obj=raw as Record<string,unknown>|null;throw {farmerMessage:str(obj?.mensaje_agricultor??obj?.message)??'No pude comunicarme con la IA.',runId:str(obj?.run_id)}}
 return normalizeGuide(raw,req.conversationId);
}
