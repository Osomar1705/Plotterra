import type { ReactNode } from 'react';
import type { Alternative, Comparison, ScenarioFamily } from '../types/fieldshift';
import { FAMILY_LABEL, FAMILY_ORDER, signedMoney } from './futures/futuresModel';

const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;

/** "What hurts this plan most?" + money range. Everything is computed from the same 100 outcomes shown as squares. */
export function PlanRisk({comparison,alternative,children}:{comparison:Comparison;alternative:Alternative;children?:ReactNode}){
  const v=alternative.outcomes?.marginByScenario;const meta=comparison.scenarios;
  if(!v?.length||!meta||meta.length!==v.length)return null;
  const mean=(f:ScenarioFamily)=>avg(v.filter((_,i)=>meta[i].family===f));
  const typical=mean('tipica');
  const rows=FAMILY_ORDER.filter(f=>f!=='tipica'&&meta.some(s=>s.family===f)).map(f=>({f,delta:mean(f)-typical}));
  const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.delta)));
  const sorted=[...v].sort((a,b)=>a-b);const n=Math.min(10,sorted.length);
  const worst=avg(sorted.slice(0,n)),best=avg(sorted.slice(-n)),all=avg(v);
  const lo=sorted[0],hi=sorted[sorted.length-1],span=Math.max(1,hi-lo);
  const pos=(x:number)=>`${Math.min(100,Math.max(0,(x-lo)/span*100))}%`;
  const zero=lo<0&&hi>0?pos(0):null;
  return <section className="pv-card pr" aria-labelledby="pr-title">
    <h2 id="pr-title">What hurts this plan most?</h2>
    <p className="pr-sub">Change in average margin versus typical conditions ({signedMoney(typical)} per ha), for the same plan.</p>
    <ul className="pr-bars">
      {[...rows].sort((a,b)=>a.delta-b.delta).map(({f,delta})=><li key={f}>
        <span className="pr-name">{FAMILY_LABEL[f]}</span>
        <span className="pr-track" aria-hidden="true"><i className={delta<0?'neg':'pos'} style={{width:`${Math.abs(delta)/maxAbs*100}%`}}/></span>
        <strong>{delta>0?'+':''}{signedMoney(delta)}</strong>
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
