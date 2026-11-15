import { motion, useReducedMotion } from 'motion/react';
import { SOFT_EASE } from '../motion/policy';
import type { ReactNode } from 'react';
import type { Alternative, Comparison, ScenarioFamily } from '../types/fieldshift';
import { FAMILY_LABEL, FAMILY_ORDER, signedMoney } from './futures/futuresModel';

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

/** "What hurts this plan most?" + money range. Everything is computed from the same 100 outcomes shown as squares. */
export function PlanRisk({comparison,alternative,children}:{comparison:Comparison;alternative:Alternative;children?:ReactNode}){
  const reduced=useReducedMotion();
  const v=alternative.outcomes?.marginByScenario;const meta=comparison.scenarios;
  if(!v?.length||!meta||meta.length!==v.length)return null;
  const mean=(f:ScenarioFamily)=>avg(v.filter((_,i)=>meta[i].family===f));
  const rows=FAMILY_ORDER.filter(f=>meta.some(s=>s.family===f)).map(f=>({f,val:mean(f)}));
  const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.val)));
  const sorted=[...v].sort((a,b)=>a-b);const n=Math.min(10,sorted.length);
  const worst=avg(sorted.slice(0,n)),best=avg(sorted.slice(-n)),all=avg(v);
  const lo=sorted[0],hi=sorted[sorted.length-1],span=Math.max(1,hi-lo);
  const pos=(x:number)=>`${Math.min(100,Math.max(0,(x-lo)/span*100))}%`;
  const zero=lo<0&&hi>0?pos(0):null;
  return <section className="pv-card pr" aria-labelledby="pr-title">
    <h2 id="pr-title">What hurts this plan most?</h2>
    <p className="pr-sub">Average result per ha in each kind of test, for the same plan. Green earns money, orange loses it.</p>
    <ul className="pr-bars">
      {[...rows].sort((a,b)=>a.val-b.val).map(({f,val},index)=><li key={f}>
        <span className="pr-name">{FAMILY_LABEL[f]}</span>
        <span className="pr-track" aria-hidden="true"><motion.i className={val<0?'neg':'pos'} style={{width:`${Math.abs(val)/maxAbs*100}%`,originX:0}}
         initial={{scaleX:reduced?1:0.55,opacity:reduced?1:0.55}} whileInView={{scaleX:1,opacity:1}} viewport={{once:true,amount:0.2}}
         transition={{duration:reduced?0:.55,delay:reduced?0:index*.04,ease:SOFT_EASE}}/></span>
        <strong className={val<0?'neg':''}>{signedMoney(val)}</strong>
      </li>)}
    </ul>
    <div className="pr-range">
      <div className="pr-range__title">How much could you earn or lose? <small>USD per ha · all {v.length} tests</small></div>
      <div className="pr-line" aria-hidden="true">
        <span className="pr-line__bar"/>
        {zero&&<span className="pr-line__zero" style={{left:zero}}><em>0</em></span>}
        <span className="pr-dot pr-dot--w" style={{left:pos(worst)}}/><span className="pr-dot pr-dot--m" style={{left:pos(all)}}/><span className="pr-dot pr-dot--b" style={{left:pos(best)}}/>
      </div>
      <div className="pr-stats">
        <div><small>Worst 10 tests</small><strong>{signedMoney(worst)}</strong></div>
        <div><small>Average</small><strong>{signedMoney(all)}</strong></div>
        <div><small>Best 10 tests</small><strong>{signedMoney(best)}</strong></div>
      </div>
    </div>
    {children}
  </section>;
}
