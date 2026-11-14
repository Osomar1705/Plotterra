/**
 * Servidor mínimo AI-first para hackathon FieldShift.
 * No sirve el frontend ni implementa el motor agronómico. No pone claves en el navegador.
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanRequest, openaiGuide } from './guide-engine.mjs';

function loadLocalEnv(){
 try{
  const source=readFileSync(resolve(process.cwd(),'.env.ai'),'utf8');
  for(const line of source.split(/\r?\n/)){
   const match=line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
   if(!match)continue;
   const [,key,raw]=match;
   if(!['OPENAI_API_KEY','OPENAI_MODEL','FIELD_GUIDE_PORT','FIELD_GUIDE_HOST','FIELD_GUIDE_ALLOWED_ORIGINS'].includes(key)||process.env[key])continue;
   let value=raw.trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);
   process.env[key]=value;
  }
 }catch(e){if(e.code!=='ENOENT')console.warn('No se pudo leer .env.ai.');}
}
loadLocalEnv();
const candidate=process.env.OPENAI_API_KEY||'';
const API_KEY=candidate==='pega_tu_clave_aqui'?'':candidate;
const MODEL=process.env.OPENAI_MODEL||'gpt-4o-mini';
const PORT=Number(process.env.FIELD_GUIDE_PORT||8787);
const HOST=process.env.FIELD_GUIDE_HOST||'127.0.0.1';
const ORIGINS=new Set((process.env.FIELD_GUIDE_ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(v=>v.trim()).filter(Boolean));
const calls=new Map();

function send(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)}
async function receiveJson(req){
 let size=0;let text='';
 for await(const chunk of req){size+=chunk.length;if(size>125000){const err=new Error('Payload too large');err.status=413;throw err;}text+=chunk.toString('utf8')}
 try{return JSON.parse(text)}catch{const err=new Error('JSON inválido');err.status=400;throw err;}
}
function allowed(req){const origin=req.headers.origin;return !origin||ORIGINS.has(origin)}
function throttle(req){const ip=req.socket.remoteAddress??'local';const now=Date.now();let entry=calls.get(ip);if(!entry||entry.until<now)entry={until:now+60000,count:0};entry.count++;calls.set(ip,entry);if(calls.size>1500){for(const [key,v] of calls)if(v.until<now)calls.delete(key)}return entry.count<=24}

export const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`).pathname;
 if(!allowed(req)){send(res,403,{mensaje_agricultor:'Este origen no tiene acceso al asistente.'});return;}
 if(req.headers.origin){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');}
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});res.end();return;}
 if(req.method==='GET'&&(pathname==='/api/v1/guide-health'||pathname==='/health')){
  send(res,200,{provider:'openai',model:MODEL,configured:Boolean(API_KEY),ready:Boolean(API_KEY),message:API_KEY?'Guía FieldShift conectada':'Configura OPENAI_API_KEY en .env.ai y reinicia el servidor.'});return;
 }
 if(req.method!=='POST'||pathname!=='/api/v1/consultas'){send(res,404,{mensaje_agricultor:'Ruta no disponible.'});return;}
 if(!API_KEY){send(res,503,{mensaje_agricultor:'La IA aún no está configurada. Añade tu clave en .env.ai y reinicia npm run dev.',code:'AI_NOT_CONFIGURED'});return;}
 if(!throttle(req)){send(res,429,{mensaje_agricultor:'Hay muchas consultas seguidas. Intenta otra vez en un momento.',code:'RATE_LIMIT'});return;}
 try{
  const raw=await receiveJson(req);
  const request=cleanRequest(raw);
  if(!request){send(res,400,{mensaje_agricultor:'Escribe tu pregunta para continuar.',code:'INVALID_MESSAGE'});return;}
  const reply=await openaiGuide(request,{apiKey:API_KEY,model:MODEL});
  send(res,200,{...reply,conversation_id:request.conversationId||'fs_local',provider:'openai',model:MODEL});
 }catch(err){
  // No exponer upstream bodies ni stack traces, pues pueden contener datos sensibles.
  if(err.status===400||err.status===413){send(res,err.status,{mensaje_agricultor:err.message});return;}
  if(err.status===401){send(res,502,{mensaje_agricultor:'La clave de OpenAI no fue aceptada. Comprueba OPENAI_API_KEY en .env.ai.',code:'OPENAI_AUTH'});return;}
  if(err.status===429){send(res,503,{mensaje_agricultor:'El proveedor de IA está ocupado o se alcanzó su cuota. Revisa tu saldo y vuelve a intentarlo.',code:'OPENAI_QUOTA'});return;}
  if(err.name==='AbortError'){send(res,504,{mensaje_agricultor:'La IA tardó demasiado en responder. Intenta otra vez.',code:'AI_TIMEOUT'});return;}
  console.error('[FieldShift Guide] upstream error:',err.status??err.message);
  send(res,502,{mensaje_agricultor:'No pude obtener una respuesta de la IA. Comprueba tu conexión o intenta de nuevo.',code:'AI_UPSTREAM'});
 }
});
if(process.env.FIELD_GUIDE_TEST!=='1')server.listen(PORT,HOST,()=>console.log(`[FieldShift IA] http://${HOST}:${PORT} | modelo ${MODEL} | ${API_KEY?'clave cargada':'sin clave — configura .env.ai'}`));
