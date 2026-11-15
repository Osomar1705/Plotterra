import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { SoftReveal } from '../motion/SoftReveal';
import { SOFT_EASE } from '../motion/policy';
import type { Alternative, Comparison, ScenarioFamily } from '../types/fieldshift';
import { FuturesGrid } from './futures/FuturesGrid';
import { FAMILY_ORDER, signedMoney, scenarioLabel, FAMILY_LABEL } from './futures/futuresModel';
import { InfoIcon } from './Icons';
import './scenario-breakdown.css';

// Ranges from backend/app/engine/scenarios.py: each test draws its own shock.
const HELP: Record<ScenarioFamily,string> = {
  tipica:'Real past weather years with no extra shock. Prices still vary year to year. Not necessarily the most likely future.',
  menos_lluvia:'Real weather years with rainfall cut by 15–45 % (each test draws its own cut).',
  menos_riego:'Real weather years with irrigation cut by 25–65 % (each test draws its own cut).',
  caida_precio:'Real weather years with selling prices 15–40 % lower (each test draws its own drop).',
  combinado:'Rain 20–45 %, irrigation 20–60 % and prices 10–35 % lower, all at the same time.',
};

/** Vertical, compact list of the 100 tests grouped by situation. Click a square to read that exact case. */
export function ScenarioBreakdown({ comparison, alternative }: { comparison: Comparison; alternative: Alternative }) {
  const [help, setHelp] = useState<ScenarioFamily|null>(null);
  const [sel, setSel] = useState<number|null>(null);
  // Tooltip con mini-grafico: sigue al cursor sobre un cuadrado y muestra donde cae entre los de su grupo.
  const hov = useRef<{f:ScenarioFamily;gi:number}|null>(null);
  const [tip, setTip] = useState<{f:ScenarioFamily;gi:number;x:number;y:number}|null>(null);
  const values = alternative.outcomes?.marginByScenario;
  const meta = comparison.scenarios;
  if (!values?.length) return null;
  const reliable = !!meta && meta.length === values.length;
  const groups = reliable ? FAMILY_ORDER.map(f=>({f,idx:meta!.map((s,i)=>s.family===f?i:-1).filter(i=>i>=0)})).filter(g=>g.idx.length) : [];
  const wins = values.filter(v=>v>0).length;
  const losses = values.length - wins;
  const ranks = alternative.outcomes?.rankByScenario;
  const byRank = ranks?.length === values.length;
  const best = alternative.outcomes?.best;
  return <motion.aside initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.38,ease:SOFT_EASE}} className="pv-card sb" aria-labelledby="sb-title">
    <header className="sb-head">
      <div><h2 id="sb-title">How it holds up</h2><p>{byRank
        ? 'Each square is one model test, compared with the other two plans in that same test. Not real-world probabilities.'
        : 'Each square is one model test: green gain, hatched orange loss. Not real-world probabilities.'}</p>
        <p className={`sb-profit ${losses>0?'neg':''}`}>{losses>0 ? `Loses money in ${losses} of ${values.length} tests` : `Makes a gain in all ${values.length} tests`}</p></div>
      {byRank && best!==undefined
        ? <span className="sb-total"><strong>{best}/{values.length}</strong><small>best of the three</small></span>
        : <span className="sb-total"><strong>{wins}/{values.length}</strong><small>with gain</small></span>}
    </header>
    {byRank && <div className="fg-legend fg-legend--rank">
      <span><i className="fg-sw fg-gain-3"/>Best of the three</span><span><i className="fg-sw fg-mid"/>Second</span>
      <span><i className="fg-sw fg-low"/>Earns the least</span><span><i className="fg-sw fg-loss-3"/>Loses money</span>
    </div>}
    {reliable && groups.length ? <div className="sb-list" onPointerMove={e=>{if(hov.current&&e.pointerType!=='touch')setTip({...hov.current,x:e.clientX,y:e.clientY})}} onPointerLeave={()=>{hov.current=null;setTip(null)}}>
      {groups.map(({f,idx})=>{
        const sub = idx.map(i=>values[i]); const pos = sub.filter(v=>v>0).length;
        const subRanks = byRank ? idx.map(i=>ranks![i]) : undefined;
        const top = subRanks ? subRanks.filter(r=>r===0).length : pos;
        return <SoftReveal className="sb-row" key={f}>
          <div className="sb-row__top"><strong>{FAMILY_LABEL[f]}</strong><span title={byRank?'Tests where this plan is the best of the three':'Tests with gain'}>{top}/{idx.length}</span>
            <button type="button" className="sb-info" aria-label={`Explain: ${FAMILY_LABEL[f]}`} aria-expanded={help===f} onClick={()=>setHelp(h=>h===f?null:f)}><InfoIcon size={14}/></button></div>
          {help===f && <p className="sb-help">{HELP[f]}</p>}
          <FuturesGrid values={sub} ranks={subRanks} scaleValues={values} scenarios={idx.map(i=>meta![i])} size="full" order="value" cellPx={17}
            onHoverIndex={i=>{hov.current=i===null?null:{f,gi:idx[i]};if(i===null)setTip(null)}}
            onSelectIndex={i=>setSel(idx[i])} selectedIndex={sel===null?null:idx.indexOf(sel)} ariaLabel={`${FAMILY_LABEL[f]}: ${pos} of ${idx.length} tests with gain`}/>
        </SoftReveal>;
      })}
    </div> : <FuturesGrid values={values} ranks={byRank?ranks:undefined} size="full" order="value" cellPx={17} onSelectIndex={setSel} selectedIndex={sel} ariaLabel={`${wins} of ${values.length} tests show a gain`}/>}
    <p className="sb-read" role="status" aria-live="polite">{sel!==null&&values[sel]!==undefined
      ? <><strong>{signedMoney(values[sel])}</strong> per ha · {scenarioLabel(sel, meta)}{byRank && <> · {values[sel]<0?'loses money':ranks![sel]===0?'best of the three':ranks![sel]===1?'second of three':'earns the least'}</>}</>
      : <span>Click a square to see that exact case. It stays selected until you pick another.</span>}</p>
    {tip&&meta&&values[tip.gi]!==undefined&&(()=>{
      const grp=FAMILY_ORDER.includes(tip.f)?meta.map((m,i)=>m.family===tip.f?values[i]:null).filter((v):v is number=>v!==null).sort((a,b)=>a-b):[];
      const mx=Math.max(1,...grp),mn=Math.min(0,...grp),W=120,H=36,span=Math.max(1,mx-mn),cur=values[tip.gi];
      const left=Math.min(window.innerWidth-176,tip.x+14),top=Math.min(window.innerHeight-130,tip.y+14);
      return <div className="sb-tip" style={{left,top}} role="presentation">
        <strong>{signedMoney(cur)}</strong><span>{scenarioLabel(tip.gi,meta)}</span>
        <svg width={W} height={H} aria-hidden="true">{grp.map((v,k)=>{const h=Math.max(1,(v-mn)/span*H);
          return <rect key={k} x={k*W/grp.length} y={H-h} width={Math.max(1,W/grp.length-1)} height={h} fill={v===cur?'#0B3644':v<0?'#e08a55':'#7ec8a8'}/>;})}</svg>
        <small>All {grp.length} tests of this type, lowest to highest</small>
      </div>;})()}
  </motion.aside>;
}
