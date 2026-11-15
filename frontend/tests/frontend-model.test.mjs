import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {transformWithOxc} from 'vite';

const require=createRequire(import.meta.url);
// TypeScript 7 (el del proyecto) ya no expone ts.transpileModule: los tipos se
// quitan con el transformador Oxc que trae Vite 8, una vez al cargar el archivo,
// y se pasa a CommonJS lo poco que usan estos modulos (import con nombre y export).
const FUENTES=['src/api/normalizers.ts','src/mocks/futures.ts','src/mocks/data.ts'];
const SIN_TIPOS=Object.fromEntries(await Promise.all(FUENTES.map(async f=>[f,(await transformWithOxc(readFileSync(resolve(f),'utf8'),f,{lang:'ts'})).code])));
function cjs(file){
 let code=SIN_TIPOS[file];
 const names=[];
 code=code.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/gm,(_,ids,from)=>`const {${ids}}=require(${JSON.stringify(from)});`);
 code=code.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z0-9_$]+)/gm,(_,kind,name)=>{names.push(name);return `${kind} ${name}`;});
 return code+'\n'+names.map(n=>`exports.${n}=${n};`).join('\n');
}

function normalizer(){
 const module={exports:{}};
 // No runtime imports (all imports are TypeScript types), only pure parsing code.
 new Function('module','exports','require','crypto',cjs('src/api/normalizers.ts'))(module,module.exports,require,globalThis.crypto);
 return module.exports;
}
function fixtures(){
 const dir=mkdtempSync(join(tmpdir(),'fieldshift-model-'));
 for(const file of ['futures','data']){
  const contents=cjs(`src/mocks/${file}.ts`).replaceAll('require("./futures")','require("./futures.cjs")');
  writeFileSync(join(dir,`${file}.cjs`),contents);
 }
 const result=require(join(dir,'data.cjs'));
 return {result,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}

test('real backend sowing/harvest and duration are normalized without confusing planting window',()=>{
 const n=normalizer();
 const alt=n.normalizeAlternative({alternative_id:'alt_1',tipo:'economy',campanas:[{
  cultivo:'quinua',siembra:'2026-10-15',cosecha:'2027-05-03',ventana_dias:200,ventana:'2026-10-15 a 2027-05-03',
 }],margin:{min:10,max:20,currency:'PEN'},water:{value:155,unit:'mm'}});
 const c=alt.campaigns[0];
 assert.equal(c.sowingDate,'2026-10-15');
 assert.equal(c.harvestDate,'2027-05-03');
 assert.equal(c.durationDays,200);
 assert.equal(c.window,'2026-10-15');
 assert.equal(c.calendarSource,'engine');
 assert.equal(c.startMonth,'2026-10');
 assert.equal(c.endMonth,'2027-05');
});

test('100 simulation groups preserve the scenario metadata and reference identities',()=>{
 const {result,cleanup}=fixtures();
 try{
  const a=result.baseComparison;
  assert.equal(a.scenarios.length,100);
  const counts=Object.groupBy(a.scenarios,x=>x.family);
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key,v])=>[key,v.length])),{
   tipica:40,menos_lluvia:15,menos_riego:15,caida_precio:15,combinado:15,
  });
  for(const alt of a.alternatives){
   assert.equal(alt.outcomes.marginByScenario.length,100);
   for(const group of alt.stressTest){
    const idx=a.scenarios.map((s,i)=>s.family===group.family?i:-1).filter(i=>i>=0);
    const expected=Math.round(idx.reduce((sum,i)=>sum+alt.outcomes.marginByScenario[i],0)/idx.length);
    assert.equal(group.meanMargin,expected);
   }
  }
 }finally{cleanup()}
});

test('illustrative economics match named priorities both before and after water change',()=>{
 const {result,cleanup}=fixtures();
 try{
  for(const comparison of [result.baseComparison,result.changedComparison]){
   const byType=Object.fromEntries(comparison.alternatives.map(a=>[a.type,a]));
   assert.ok(byType.economy.outcomes.mean>byType.soil.outcomes.mean);
   assert.ok(byType.economy.outcomes.mean>byType.water.outcomes.mean);
   assert.ok(byType.water.water.value<byType.economy.water.value);
   assert.ok(byType.water.water.value<byType.soil.water.value);
   for(const a of comparison.alternatives){
    for(const campaign of a.campaigns){
     assert.equal(campaign.calendarSource,'demo');
     assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(campaign.sowingDate));
     const days=(Date.parse(campaign.harvestDate+'T00:00:00Z')-Date.parse(campaign.sowingDate+'T00:00:00Z'))/86400000;
     assert.equal(days,campaign.durationDays);
    }
   }
  }
 }finally{cleanup()}
});
