import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('Indica la carpeta con los módulos compilados.');
const { prepareTrace, canSnapClosed, simplifyTrace } = await import(pathToFileURL(path.join(root, 'lib/freehandTrace.js')));
const { checkPolygon, findSelfIntersection } = await import(pathToFileURL(path.join(root, 'lib/plotGeometry.js')));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`OK ${name}`); }
const p = (x, y) => ({ x, y });
const square = [p(100,100),p(200,100),p(200,200),p(100,200),p(104,104)];
const geographic = points => points.map(q => p(-76.2 + q.x * 0.00001, -10.13 + q.y * 0.00001));

test('Cierra una figura al soltar cerca del inicio', () => {
  const r = prepareTrace(square);
  assert.equal(r.closed, true); assert.equal(r.error, undefined); assert.equal(r.points.length,4);
  assert.ok(checkPolygon(geographic(r.points)).valid);
});
test('No duplica el primer vértice en el anillo', () => {
  const r = prepareTrace([...square.slice(0,-1),square[0]]);
  assert.notDeepEqual(r.points[0],r.points.at(-1));
});
test('Conserva abierto un contorno con una separación grande', () => {
  assert.equal(prepareTrace(square.slice(0,-1)).closed,false);
});
test('Una pequeña pasada de largo puede cerrar', () => {
  assert.ok(prepareTrace([...square.slice(0,-1),p(101,101),p(80,100)]).closed);
});
test('No borra una cola larga para forzar el cierre', () => {
  assert.equal(prepareTrace([...square.slice(0,-1),p(100,100),p(40,100)]).closed,false);
});
test('No confunde una línea de ida y vuelta con una parcela', () => {
  assert.equal(canSnapClosed([p(0,0),p(100,1),p(50,1),p(1,0)]),false);
});
test('Rechaza movimientos demasiado cortos', () => {
  assert.ok(prepareTrace([p(0,0),p(3,3)]).error);
});
test('Rechaza coordenadas no finitas', () => {
  assert.ok(prepareTrace([p(0,0),p(NaN,100)]).error);
});
test('Reduce temblor leve sin perder esquinas', () => {
  const noisy = Array.from({length:101},(_,i)=>p(i, i%2?0.3:-0.3));
  const r = simplifyTrace([...noisy,p(100,100)]);
  assert.equal(r.length,3); assert.deepEqual(r[1],noisy.at(-1));
});
test('Una curva densa válida no produce cruces falsos', () => {
  const circle = Array.from({length:180},(_,i)=>p(-76.2+0.0002*Math.cos(i*Math.PI/90),-10.13+0.0002*Math.sin(i*Math.PI/90)));
  assert.equal(findSelfIntersection(circle),null); assert.ok(checkPolygon(circle).valid);
});
test('Detecta cruces y señala su posición real', () => {
  const bow = [p(0,0),p(0.001,0.001),p(0,0.001),p(0.001,0)];
  const hit = findSelfIntersection(bow);
  assert.ok(hit); assert.ok(Math.abs(hit.x-0.0005)<1e-12); assert.ok(Math.abs(hit.y-0.0005)<1e-12);
  assert.equal(checkPolygon(bow).code,'POLIGONO_INVALIDO');
});
test('Detecta cruces aunque el trazo siga abierto', () => {
  assert.ok(findSelfIntersection([p(0,0),p(10,10),p(0,10),p(10,0)],false));
});
test('No inventa una arista de cierre para validar un trazo abierto', () => {
  const open = [p(3,3),p(7,3),p(7,7),p(0,7),p(0,0),p(10,0),p(10,10)];
  assert.equal(findSelfIntersection(open,false),null);
  assert.ok(findSelfIntersection(open,true));
});
test('Mantiene el límite de superficie mínima existente', () => {
  assert.equal(checkPolygon([p(0,0),p(0.00001,0),p(0.00001,0.00001),p(0,0.00001)]).code,'AREA_FUERA_DE_RANGO');
});
test('Mantiene el límite de superficie máxima existente', () => {
  assert.equal(checkPolygon([p(0,0),p(0.02,0),p(0.02,0.02),p(0,0.02)]).code,'AREA_FUERA_DE_RANGO');
});
test('No trunca silenciosamente un contorno demasiado complejo', () => {
  const complex = Array.from({length:600},(_,i)=>p(i*3,i%2?30:0));
  assert.ok(prepareTrace(complex).error);
});
console.log(`${passed} pruebas correctas.`);
