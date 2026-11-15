import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { CAMERA_DURATION } from './fieldCamera';
import { createFieldRenderer } from './fieldRenderer';

/** Purely decorative camera, underneath the existing accessible results grid. */
export function FieldApproach() {
  const ref=useRef<HTMLCanvasElement>(null);
  const reduced=useReducedMotion();
  const [engine,setEngine]=useState<'webgl'|'canvas'|'fallback'>('fallback');
  useEffect(()=>{
    const canvas=ref.current;if(!canvas||reduced)return;
    const renderer=createFieldRenderer(canvas);if(!renderer)return;
    setEngine(renderer.engine);
    let raf=0,elapsed=0,last=0,lastDraw=0,complete=false,disposed=false;
    const draw=(now:number)=>{
      if(disposed||document.hidden)return;
      if(last)elapsed+=now-last;
      last=now;
      if(renderer.engine==='webgl'||now-lastDraw>=1000/24||elapsed>=CAMERA_DURATION){
        renderer.draw(Math.min(elapsed/CAMERA_DURATION,1));lastDraw=now;
      }
      if(elapsed<CAMERA_DURATION)raf=requestAnimationFrame(draw);else complete=true;
    };
    const visibility=()=>{
      cancelAnimationFrame(raf);last=0;
      if(!document.hidden&&!complete)raf=requestAnimationFrame(draw);
    };
    const resize=new ResizeObserver(()=>renderer.draw(Math.min(elapsed/CAMERA_DURATION,1)));
    resize.observe(canvas);
    const lost=()=>{cancelAnimationFrame(raf);complete=true;setEngine('fallback');};
    canvas.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',visibility);
    raf=requestAnimationFrame(draw);
    return()=>{disposed=true;cancelAnimationFrame(raf);resize.disconnect();document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);renderer.dispose();};
  },[reduced]);
  return <div className={`sr-field sr-field--${engine}`} aria-hidden="true">
    <div className="sr-field-shadow"/>
    <canvas ref={ref} className="sr-field-canvas"/>
    {/* CSS perspective fallback: no blocked GPU can prevent seeing the actual results. */}
    <div className="sr-field-fallback"><div>{Array.from({length:100},(_,i)=><i key={i}/>)}</div></div>
  </div>;
}
