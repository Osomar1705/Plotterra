import { useState, type MouseEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Comparison } from '../../types/fieldshift';
import { CropIllustration } from '../CropIllustration';
import { FuturesGrid } from './FuturesGrid';
import { caseName, cropName, optionName } from '../../lib/uiCopy';
import { signedMoney, summarize } from './futuresModel';

/** Details are optional. No invented "usual plan" is shown. */
export function FuturesPanel({comparison,open,onClose}:{comparison:Comparison;open:boolean;onClose:()=>void}){
 const [order,setOrder]=useState<'value'|'scenario'>('value');
 const [hover,setHover]=useState<number|null>(null);
 const columns=comparison.alternatives.filter(a=>a.outcomes);
 return <AnimatePresence>{open&&<motion.div className="fp-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
  <motion.section className="fp" role="dialog" aria-modal="true" aria-label="Detailed comparison of simulated results"
   initial={{y:25,opacity:0}} animate={{y:0,opacity:1}} exit={{y:20,opacity:0}} onClick={(e:MouseEvent<HTMLElement>)=>e.stopPropagation()} onKeyDown={(e:KeyboardEvent<HTMLElement>)=>e.key==='Escape'&&onClose()}>
   <header className="fp-head"><div><span className="fp-kicker">More details · optional</span><h2>How the three plans performed</h2>
    <p>All three plans were tested against the same set of situations. A square is one test, not a forecast or a real-world probability.</p></div>
    <div className="fp-tools"><div className="fp-toggle" role="group" aria-label="Sort results"><button className={order==='value'?'on':''} onClick={()=>setOrder('value')}>From loss to gain</button><button className={order==='scenario'?'on':''} onClick={()=>setOrder('scenario')}>By situation</button></div>
    <button className="fp-close" onClick={onClose} aria-label="Close results">×</button></div></header>
   <div className="fp-hover" aria-live="polite">{hover===null?'Tap or hover on a square to compare the same case across all three plans.':<><strong>Test {hover+1} · {comparison.scenarios?.[hover]?caseName[comparison.scenarios[hover].family]:'Simulated situation'}</strong>{columns.map(a=><span key={a.id} className={a.outcomes!.marginByScenario[hover]<0?'neg':'pos'}>{optionName[a.type]}: {signedMoney(a.outcomes!.marginByScenario[hover])}</span>)}</>}</div>
   <div className="fp-grid fp-grid--three">{columns.map(a=>{const s=summarize(a.outcomes!);return <article key={a.id} className={`fp-col fp-col--${a.type}`}>
    <h3>{optionName[a.type]}</h3><div className="fp-seq">{a.campaigns.map((c,i)=><span key={i}><CropIllustration crop={c.cropId??c.crop} size={22}/>{cropName(c.crop)}</span>)}</div>
    <p className="fp-big">Gain in <b>{s.wins}</b> of {s.total} tests</p>
    <FuturesGrid values={a.outcomes!.marginByScenario} scenarios={comparison.scenarios} size="full" order={order} highlightIndex={hover} onHoverIndex={setHover}
     ariaLabel={`${optionName[a.type]}: positive gain in ${s.wins} of ${s.total} tests`}/>
    <dl className="fp-stats">{s.mean!==undefined&&<><dt>Average margin</dt><dd>{signedMoney(s.mean)} /ha</dd></>}{s.adverse!==undefined&&<><dt>10 worst cases</dt><dd className={s.adverse<0?'neg':''}>{signedMoney(s.adverse)} /ha</dd></>}</dl>
   </article>})}</div>
   <footer className="fp-legend"><span><i className="fg-sw fg-gain-3"/>Larger gain</span><span><i className="fg-sw fg-gain-1"/>Smaller gain</span><span><i className="fg-sw fg-neutral"/>Near zero</span><span><i className="fg-sw fg-loss-2 fg-sw--hatch"/>Loss</span>
    <small>Margins converted to USD per hectare for display; calculations remain in PEN. {comparison.sourceResult==='mock'?'Demo data only.':''}</small></footer>
  </motion.section>
 </motion.div>}</AnimatePresence>;
}
