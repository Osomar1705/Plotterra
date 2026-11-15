import { useState } from 'react';
import type { Alternative, Comparison, ScenarioFamily } from '../types/fieldshift';
import { FuturesGrid } from './futures/FuturesGrid';
import { FAMILY_ORDER, signedMoney, scenarioLabel, FAMILY_LABEL } from './futures/futuresModel';
import { InfoIcon } from './Icons';
import './scenario-breakdown.css';

const HELP: Record<ScenarioFamily,string> = {
  tipica:'Baseline model tests with no extra reduction to rain, irrigation or prices. Not necessarily the most likely future.',
  menos_lluvia:'Same baseline situations, but with rainfall reduced by 30%.',
  menos_riego:'Same baseline situations, but with irrigation availability reduced by 30%.',
  caida_precio:'Same baseline situations, but with selling prices 30% lower.',
  combinado:'Rain, irrigation and prices all reduced at the same time.',
};

/** Vertical, compact list of the 100 tests grouped by situation. Hover/tap a square to read that exact case. */
export function ScenarioBreakdown({ comparison, alternative }: { comparison: Comparison; alternative: Alternative }) {
  const [help, setHelp] = useState<ScenarioFamily|null>(null);
  const [sel, setSel] = useState<number|null>(null);
  const values = alternative.outcomes?.marginByScenario;
  const meta = comparison.scenarios;
  if (!values?.length) return null;
  const reliable = !!meta && meta.length === values.length;
  const groups = reliable ? FAMILY_ORDER.map(f=>({f,idx:meta!.map((s,i)=>s.family===f?i:-1).filter(i=>i>=0)})).filter(g=>g.idx.length) : [];
  const wins = values.filter(v=>v>0).length;
  return <aside className="pv-card sb" aria-labelledby="sb-title">
    <header className="sb-head">
      <div><h2 id="sb-title">How it holds up</h2><p>Each square is one model test: green gain, hatched orange loss. Not real-world probabilities.</p></div>
      <span className="sb-total"><strong>{wins}/{values.length}</strong><small>with gain</small></span>
    </header>
    {reliable && groups.length ? <div className="sb-list">
      {groups.map(({f,idx})=>{
        const sub = idx.map(i=>values[i]); const pos = sub.filter(v=>v>0).length;
        return <div className="sb-row" key={f}>
          <div className="sb-row__top"><strong>{FAMILY_LABEL[f]}</strong><span>{pos}/{idx.length}</span>
            <button type="button" className="sb-info" aria-label={`Explain: ${FAMILY_LABEL[f]}`} aria-expanded={help===f} onClick={()=>setHelp(h=>h===f?null:f)}><InfoIcon size={14}/></button></div>
          {help===f && <p className="sb-help">{HELP[f]}</p>}
          <FuturesGrid values={sub} scaleValues={values} scenarios={idx.map(i=>meta![i])} size="full" order="value" cellPx={17}
            onHoverIndex={i=>setSel(i===null?null:idx[i])} ariaLabel={`${FAMILY_LABEL[f]}: ${pos} of ${idx.length} tests with gain`}/>
        </div>;
      })}
    </div> : <FuturesGrid values={values} size="full" order="value" cellPx={17} onHoverIndex={setSel} ariaLabel={`${wins} of ${values.length} tests show a gain`}/>}
    <p className="sb-read" role="status" aria-live="polite">{sel!==null&&values[sel]!==undefined
      ? <><strong>{signedMoney(values[sel])}</strong> per ha · {scenarioLabel(sel, meta)}</>
      : <span>Hover or tap a square to see that exact case.</span>}</p>
  </aside>;
}
