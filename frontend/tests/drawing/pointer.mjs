import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import vm from 'node:vm';
const root=process.argv[2], require=createRequire(join(root,'lib/plotDrawing.js'));
const code=readFileSync(join(root,'lib/plotDrawing.js'),'utf8');
let passed=0;
function test(name,fn){fn();passed++;console.log(`OK ${name}`)}
function fixture(){
 const listeners={},windowListeners={},mapListeners={},captured=new Set(),notices=[],traces=[];
 const layer={addTo(){return this},clearLayers(){},remove(){}};
 const leaflet={layerGroup:()=>layer,polyline:()=>({addTo(){}}),polygon:()=>({addTo(){}}),circleMarker:()=>({addTo(){}}),point:(x,y)=>({x,y})};
 const handlers=()=>({on:true,enable(){this.on=true},disable(){this.on=false}});
 const map={dragging:handlers(),scrollWheelZoom:handlers(),touchZoom:handlers(),keyboard:handlers(),doubleClickZoom:handlers(),stop(){},on(name,fn){mapListeners[name]=fn},off(name){delete mapListeners[name]},latLngToContainerPoint:([y,x])=>({x:(x+76.2)*100000,y:(y+10.13)*100000}),containerPointToLatLng:({x,y})=>({lng:x/100000-76.2,lat:y/100000-10.13})};
 const element={style:{},clientWidth:700,clientHeight:500,clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:0,top:0}),addEventListener(n,f){listeners[n]=f},removeEventListener(n){delete listeners[n]},setPointerCapture(id){captured.add(id)},hasPointerCapture:id=>captured.has(id),releasePointerCapture(id){captured.delete(id)}};
 const state={points:[],mode:'drawing'};
 const exports={};
 vm.runInNewContext(code,{exports,require:id=>id==='leaflet'?leaflet:require(id),Element:class{},requestAnimationFrame:()=>1,cancelAnimationFrame(){},window:{addEventListener(n,f){windowListeners[n]=f},removeEventListener(n){delete windowListeners[n]}}});
 const drawing=exports.installPlotDrawing(map,element,{getState:()=>state,onPoint(p,closed){state.points.push(p);if(closed)state.mode='ready'},onTrace(points,closed){traces.push({points,closed});state.points=points;state.mode=closed?'ready':'drawing'},onStatus(){},onNotice:n=>notices.push(n)});
 const fire=(name,x=100,y=100,extra={})=>listeners[name]?.({clientX:x,clientY:y,button:0,pointerId:1,isPrimary:true,preventDefault(){},stopPropagation(){},...extra});
 const square=()=>{fire('pointerdown');fire('pointermove',200,100);fire('pointermove',200,200);fire('pointermove',100,200);fire('pointerup',102,102)};
 drawing.setEnabled(true);
 return {drawing,state,map,element,captured,traces,notices,fire,square,windowListeners,mapListeners,listeners};
}
test('El gesto cerrado se confirma una sola vez al soltar',()=>{const f=fixture();f.square();assert.equal(f.traces.length,1);assert.equal(f.traces[0].closed,true);assert.equal(f.captured.size,0);f.drawing.destroy()});
test('Un clic sigue permitiendo marcar esquinas',()=>{const f=fixture();f.fire('pointerdown');f.fire('pointerup');assert.equal(f.state.points.length,1);assert.equal(f.traces.length,0);f.drawing.destroy()});
test('Un trazo abierto no se cierra por fuerza',()=>{const f=fixture();f.fire('pointerdown');f.fire('pointermove',250,100);f.fire('pointerup',250,200);assert.equal(f.traces.length,1);assert.equal(f.traces[0].closed,false);f.drawing.destroy()});
test('Pointercancel conserva el contorno anterior',()=>{const f=fixture();f.state.points=[{x:-76.199,y:-10.129}];f.fire('pointerdown');f.fire('pointermove',200,100);f.fire('pointercancel');assert.equal(f.state.points.length,1);assert.equal(f.traces.length,0);assert.equal(f.captured.size,0);f.drawing.destroy()});
test('Escape cancela la pasada en curso',()=>{const f=fixture();f.fire('pointerdown');f.fire('pointermove',200,100);f.windowListeners.keydown({key:'Escape',preventDefault(){}});assert.equal(f.traces.length,0);assert.equal(f.captured.size,0);f.drawing.destroy()});
test('Salir del mapa descarta solo la pasada en curso',()=>{const f=fixture();f.fire('pointerdown');f.fire('pointermove',750,200);f.fire('pointerup',200,200);assert.equal(f.traces.length,0);assert.equal(f.state.points.length,0);f.drawing.destroy()});
test('Un segundo dedo cancela sin confirmar puntos',()=>{const f=fixture();f.fire('pointerdown');f.fire('pointermove',200,100);f.fire('pointerdown',150,150,{pointerId:2,isPrimary:false});f.fire('pointerup',100,100);assert.equal(f.traces.length,0);assert.equal(f.state.points.length,0);f.drawing.destroy()});
test('Mover mapa restaura la navegación y no dibuja',()=>{const f=fixture();assert.equal(f.map.dragging.on,false);f.drawing.setEnabled(false);assert.equal(f.map.dragging.on,true);f.fire('pointerdown');f.fire('pointerup');assert.equal(f.state.points.length,0);f.drawing.destroy()});
test('Desmontar elimina eventos y captura',()=>{const f=fixture();f.fire('pointerdown');f.drawing.destroy();assert.equal(f.captured.size,0);assert.equal(Object.keys(f.listeners).length,0);assert.equal(Object.keys(f.windowListeners).length,0);assert.equal(f.element.style.touchAction,'')});
console.log(`${passed} pruebas de puntero correctas.`);
