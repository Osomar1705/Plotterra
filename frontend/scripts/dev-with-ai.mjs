import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const tasks=[];
function start(name,args){
 const child=spawn(process.execPath,args,{cwd:process.cwd(),stdio:'inherit',env:process.env});
 tasks.push(child);
 child.on('error',err=>{console.error(`${name}:`,err.message);finish(1)});
 child.on('exit',(code,signal)=>{if(!ending)finish(typeof code==='number'?code:signal?1:0)});
 return child;
}
let ending=false;
function finish(code=0){if(ending)return;ending=true;for(const child of tasks)if(child.exitCode===null)child.kill();process.exitCode=code;}
process.on('SIGINT',()=>finish(0));
process.on('SIGTERM',()=>finish(0));
start('Guía FieldShift IA',['server/ai-server.mjs']);
// Los argumentos extra (p. ej. --port 5180 --strictPort de launch.json) se pasan a Vite.
start('Vite',[resolve('node_modules/vite/bin/vite.js'),'--host','0.0.0.0',...process.argv.slice(2)]);
