import { mkdtempSync, writeFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const temp=mkdtempSync(join(root,'.drawing-checks-'));
try{
 writeFileSync(join(temp,'package.json'),'{"type":"commonjs"}');
 for(const name of ['lib/plotDrawing.ts','lib/freehandTrace.ts','lib/plotGeometry.ts','types/fieldshift.ts']){
  const dest=join(temp,'src',name);mkdirSync(dirname(dest),{recursive:true});copyFileSync(join(root,'src',name),dest);
 }
 const compiled=join(temp,'compiled');
 const args=[join(root,'node_modules/typescript/bin/tsc'),'--ignoreConfig','--outDir',compiled,'--module','Node16','--moduleResolution','Node16','--target','ES2022','--skipLibCheck','--esModuleInterop','src/lib/plotDrawing.ts','src/lib/freehandTrace.ts','src/lib/plotGeometry.ts'];
 for(const command of [args,[join(root,'tests/drawing/geometry.mjs'),compiled],[join(root,'tests/drawing/pointer.mjs'),compiled]]){
  const r=spawnSync(process.execPath,command,{cwd:temp,stdio:'inherit'});
  if(r.status!==0)process.exitCode=r.status||1;
  if(process.exitCode)break;
 }
}finally{rmSync(temp,{recursive:true,force:true});}
