import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cleanRequest, verifyReply, openaiGuide } from '../server/guide-engine.mjs';

const raw={
  message:'¿Por qué Agua usa menos?',conversation_id:'fs_test',
  context:{page:'comparison',parcel:{locality:'Ambo, Huánuco',areaHa:3.5},comparison:{id:'cmp',priority:'water',sourceResult:'mock',alternatives:[
    {id:'a-water',type:'water',campaigns:[{crop:'Quinua',window:'Oct 2026'}],margin:{min:2700,max:3100,basis:'ha'},water:{value:260,unit:'mm'},soil:{compatibility:'compatible'},risk:{level:'low'},dataQuality:{level:'sufficient'}},
  ]}},history:[{role:'user',text:'¿Cuál usa menos agua?'}],
};
const req=cleanRequest(raw);
test('input contextual se reduce a datos necesarios',()=>{
 assert.equal(req.context.page,'comparison');
 assert.equal(req.context.parcel.locality,'Ambo, Huánuco');
 assert.equal(req.context.comparison.alternatives[0].water.value,260);
 assert.equal(req.history.length,1);
});
test('no se proponen cambios sin contexto de comparación',()=>{
 const change={type:'irrigation',operation:'reduce',value:30,unit:'percent',label:'Riego −30%'};
 const answer=verifyReply({status:'proposed_change',message:'Probaré riego',change}, {...req,context:{...req.context,page:'parcel'}});
 assert.equal(answer.status,'needs_clarification');
 assert.equal(answer.change,null);
});
test('la IA no puede proponer un tipo de escenario arbitrario',()=>{
 const result=verifyReply({status:'proposed_change',message:'Pesticida',change:{type:'pesticide',operation:'apply',value:'X',unit:'unit'}},req);
 assert.equal(result.status,'needs_clarification');assert.equal(result.change,null);
});
test('se preserva 30% de riego y se rechazan cambios sin cálculos mock',()=>{
 const base={status:'proposed_change',message:'¿Recalculamos?',change:{type:'irrigation',operation:'reduce',value:30,unit:'percent'}};
 const yes=verifyReply(base,req);assert.equal(yes.status,'proposed_change');assert.equal(yes.change.value,30);assert.equal(yes.requires_confirmation,true);
 const no=verifyReply({...base,change:{...base.change,value:45}},req);assert.equal(no.status,'unsupported');
});
test('respuestas conversacionales sin escenario no incluyen cambio',()=>{
 const answer=verifyReply({status:'answered',intent:'EXPLAIN_SYSTEM',message:'Los valores salen del motor FieldShift.',suggestions:['¿Qué datos?'],sources:['Resultados FieldShift'],change:{type:'irrigation',operation:'reduce',value:30,unit:'percent'}},req);
 assert.equal(answer.change,null);assert.equal(answer.message,'Los valores salen del motor FieldShift.');
});
test('OpenAI Responses estructurado: hace una llamada real al endpoint simulado',async()=>{
 let actual;
 const mock=http.createServer(async(request,response)=>{
  assert.equal(request.url,'/v1/responses');
  assert.equal(request.headers.authorization,'Bearer sk-test-placeholder');
  const parts=[];for await(const chunk of request)parts.push(chunk);actual=JSON.parse(Buffer.concat(parts).toString('utf8'));
  response.writeHead(200,{'Content-Type':'application/json'});
  response.end(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify({status:'answered',intent:'COMPARE_ALTERNATIVES',message:'Agua necesita 260 mm según la comparación.',suggestions:[],sources:['Resultados FieldShift'],change:null})}]}]}));
 });
 await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
 try{
  const port=mock.address().port;
  const reply=await openaiGuide(req,{apiKey:'sk-test-placeholder',endpoint:`http://127.0.0.1:${port}/v1/responses`});
  assert.equal(reply.status,'answered');assert.match(reply.message,/260 mm/);
  assert.equal(actual.model,'gpt-4o-mini');assert.equal(actual.store,false);
  assert.equal(actual.text.format.type,'json_schema');assert.equal(actual.text.format.strict,true);
  assert.match(actual.input.at(-1).content,/Ambo, Huánuco/);
 }finally{await new Promise(resolve=>mock.close(resolve))}
});


test('porcentaje aislado después de aclaración produce confirmación de riego',()=>{
 const followup=cleanRequest({...raw,message:'30%',pending_clarification:{kind:'irrigation_percent',originalQuestion:'¿Qué pasa si tengo menos riego?'}});
 const output=verifyReply({status:'needs_clarification',intent:'PROPOSE_SCENARIO',message:'¿Qué cambio quieres probar?',change:null},followup);
 assert.equal(output.status,'proposed_change');
 assert.equal(output.change.value,30);
 assert.equal(output.requires_confirmation,true);
 assert.match(output.message,/30%/);
});
test('porcentaje claro desde el principio no debe solicitar de nuevo el valor',()=>{
 const full=cleanRequest({...raw,message:'¿Qué pasa si tengo 30% menos riego?'});
 const output=verifyReply({status:'needs_clarification',intent:'PROPOSE_SCENARIO',message:'¿10%, 30% o 50%?',change:null},full);
 assert.equal(output.status,'proposed_change');
 assert.equal(output.change.value,30);
});
test('no muestra milímetros inventados antes de ejecutar la simulación',()=>{
 const full=cleanRequest({...raw,message:'30% menos riego'});
 const output=verifyReply({status:'proposed_change',intent:'PROPOSE_SCENARIO',message:'El riego pasará a 126 mm, confirmar',change:{type:'irrigation',operation:'reduce',value:30,unit:'percent'}},full);
 assert.doesNotMatch(output.message,/126 mm/);
 assert.match(output.message,/recalculate/i);
});

test('saludo después del recálculo no recupera la aclaración antigua',()=>{
 const greeting=cleanRequest({...raw,message:'hola',history:[
  {role:'user',text:'¿Qué pasa si tengo 30% menos riego?'},
  {role:'assistant',text:'Entendí Riego −30%. ¿Recalculamos?'},
  {role:'user',text:'Sí, confirmo recalcular con Riego −30%'},
  {role:'assistant',text:'RESULTADO YA CALCULADO: Economía 59/100, Agua 57/100 y Suelo 80/100.'},
  {role:'user',text:'¿Cuál es la más segura ahora?'},
  {role:'assistant',text:'Suelo, con 80 de 100 casos con margen positivo.'},
 ]});
 const answer=verifyReply({status:'needs_clarification',intent:'PROPOSE_SCENARIO',message:'¿10%, 30% o 50%?',change:null},greeting);
 assert.equal(answer.status,'answered');
 assert.match(answer.message,/Hi!/);
 assert.doesNotMatch(answer.message,/10%|30%|50%/);
 assert.equal(greeting.history.length,6);
});

test('resumen posterior a simulación nunca propone recalcular dos veces',()=>{
 const post=cleanRequest({...raw,message:'RESUMEN_POST_SIMULACION: Se aplicó Riego −30%. Explica los resultados.'});
 const answer=verifyReply({status:'proposed_change',intent:'PROPOSE_SCENARIO',message:'Suelo ganó en 80 de 100 casos.',change:{type:'irrigation',operation:'reduce',unit:'percent',value:30}},post);
 assert.equal(answer.status,'answered');
 assert.equal(answer.change,null);
 assert.match(answer.message,/Suelo/);
});

test('envía historial reciente completo en orden cronológico',()=>{
 const messages=Array.from({length:19},(_,i)=>({role:i%2?'assistant':'user',text:`turno ${i}`}));
 const input=cleanRequest({...raw,history:messages});
 assert.equal(input.history.length,16);
 assert.equal(input.history[0].text,'turno 3');
 assert.equal(input.history.at(-1).text,'turno 18');
});


test('English request for less irrigation is confirmed without an extra clarification',()=>{
 const req=cleanRequest({message:'What if I have 30% less irrigation?',context:{page:'comparison',engine:'local_mock',comparison:{id:'cmp_a',alternatives:[],sourceResult:'mock'}}});
 const r=verifyReply({status:'needs_clarification',message:'Which percentage?',intent:'SCENARIO',suggestions:[],sources:[],change:null},req);
 assert.equal(r.status,'proposed_change');
 assert.equal(r.change.value,30);
 assert.match(r.message,/30% less irrigation/);
});


test('English crop names are normalized to the backend crop identifiers',()=>{
 const real={...req,context:{...req.context,engine:'backend'}};
 const barley=verifyReply({status:'proposed_change',message:'Exclude barley?',change:{type:'exclude_crop',operation:'exclude',value:'barley',unit:'crop'}},real);
 assert.equal(barley.change.value,'cebada');
 assert.equal(barley.change.label,'No barley');
 const potato=verifyReply({status:'proposed_change',message:'Potato first?',change:{type:'first_crop',operation:'set',value:'potato',unit:'crop'}},real);
 assert.equal(potato.change.value,'papa');
 assert.equal(potato.change.label,'Start with potato');
});
