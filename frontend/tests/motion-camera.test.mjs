import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformWithOxc} from 'vite';
const source=readFileSync(new URL('../src/motion/fieldCamera.ts',import.meta.url),'utf8');
const {code}=await transformWithOxc(source,'fieldCamera.ts',{lang:'ts'});
const {cameraPose,cameraBasis,projectPoint}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('the camera gets closer without crossing the ground or overshooting',()=>{
  let last=Infinity;
  for(let i=0;i<=100;i++){
    const eye=cameraPose(i/100),distance=Math.hypot(...eye);
    assert.ok(distance<=last+1e-9);assert.ok(eye[1]>0);
    last=distance;
  }
  assert.ok(Math.hypot(...cameraPose(0))/last>2);
});
test('the camera basis stays orthonormal throughout the overhead landing',()=>{
  for(let i=0;i<=100;i++){
    const vectors=Object.values(cameraBasis(cameraPose(i/100)));
    vectors.forEach(v=>assert.ok(Math.abs(Math.hypot(...v)-1)<1e-9));
    for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)
      assert.ok(Math.abs(vectors[a].reduce((s,v,k)=>s+v*vectors[b][k],0))<1e-9);
  }
});
test('all field corners stay in frame on a narrow phone and desktop',()=>{
  for(const aspect of [296/330,320/330,360/330,390/330,800/380])for(let i=0;i<=100;i++)
    for(const x of [-3.1,3.1])for(const z of [-3.1,3.1]){
      const [px,py,depth]=projectPoint([x,-.36,z],cameraPose(i/100),aspect);
      assert.ok(Math.abs(px)<1 && Math.abs(py)<1,`clipped at ${aspect}, ${i}`);
      assert.ok(depth>.1);
    }
});
test('the field stays centred while its volume has real perspective',()=>{
  for(const progress of [0,.25,.5,.75,1]){
    const eye=cameraPose(progress),center=projectPoint([0,0,0],eye,2);
    assert.ok(Math.abs(center[0])<1e-9&&Math.abs(center[1])<1e-9);
  }
  const eye=cameraPose(.2);
  const ground=projectPoint([1,0,1],eye,2),plant=projectPoint([1,.3,1],eye,2);
  assert.ok(plant[1]>ground[1]);assert.notEqual(plant[2],ground[2]);
});
test('the final overhead framing matches the existing results grid',()=>{
  const eye=cameraPose(1),corner=projectPoint([3,0,3],eye,1);
  assert.ok(Math.abs(corner[0]-.848)<.003);
  assert.ok(Math.abs(corner[1]+.848)<.003);
  assert.deepEqual(cameraPose(-1),cameraPose(0));
  assert.deepEqual(cameraPose(2),cameraPose(1));
});
