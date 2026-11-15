import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SOFT_EASE } from '../../motion/policy';
import type { ScenarioMeta } from '../../types/fieldshift';
import { FuturesGrid } from './FuturesGrid';
import { FAMILY_LABEL, prefersReducedMotion, scenarioLabel } from './futuresModel';

const STAGGER = 8;
const HOLD_SUMMARY = 650;

export function SimulationReveal({ values, previousValues, scenarios, changeLabel, layoutId, onDone, note }: {
  values?: number[];
  previousValues?: number[];
  scenarios?: ScenarioMeta[];
  changeLabel?: string | null;
  layoutId?: string;
  onDone: () => void;
  note?: string | null;
}) {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(-1);
  const [summary, setSummary] = useState(false);
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };

  useEffect(() => {
    if (!values) return;
    if (prefersReducedMotion()) { finish(); return; }
    let i = 0;
    const iv = window.setInterval(() => {
      i += 3; setTick(Math.min(i, values.length - 1));
      if (i >= values.length - 1) { window.clearInterval(iv); setSummary(true); }
    }, STAGGER * 3);
    const end = window.setTimeout(finish, values.length * STAGGER + 300 + HOLD_SUMMARY);
    return () => { window.clearInterval(iv); window.clearTimeout(end); };
  }, [values]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && values) finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const placeholder = Array.from({ length: 100 }, () => 0);
  const wins = values?.filter((v) => v > 0).length ?? 0;
  const worsened = values && previousValues
    ? values.filter((v, i) => v < 0 && (previousValues[i] ?? 0) >= 0).length : 0;
  const fam = values && tick >= 0 && scenarios?.[tick] ? FAMILY_LABEL[scenarios[tick].family] : null;

  return <motion.div className="sr-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .35 } }}>
    <motion.div className="sr-card" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.3,ease:SOFT_EASE}}>
      <span className="sr-kicker">{changeLabel ? `Running scenario · ${changeLabel}` : 'Scenario simulation'}</span>
      <h2>{values ? 'Testing your plot in 100 possible futures' : 'Preparing 100 possible futures for your plot…'}</h2>
      <div className={`sr-grid ${values ? '' : 'is-waiting'}`}>
       <motion.div className="sr-grid-plane" style={{transformPerspective:1000}}
        initial={{rotateX:reduced?0:14,rotateY:reduced?0:-9,scale:reduced?1:0.97}}
        animate={{rotateX:reduced||values?0:8,rotateY:reduced||values?0:-4,scale:1}}
        transition={{type:'spring',stiffness:85,damping:26}}>
        <FuturesGrid values={values ?? placeholder} scenarios={scenarios} size="mini" order="scenario"
          revealed={!!values} staggerMs={STAGGER} previousValues={previousValues} layoutId={layoutId} cellPx={22}
          ariaLabel="Simulation of 100 possible futures" />
       </motion.div>
      </div>
      <div className="sr-ticker" aria-live="polite">
        {!values && <span>We are checking rain, irrigation and price changes.</span>}
        {values && !summary && tick >= 0 && <span><b>{scenarioLabel(tick, scenarios, false)}</b>{fam && <em className={`sr-fam sr-fam--${scenarios![tick].family}`}>{fam}</em>}</span>}
        {values && summary && <motion.strong initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          Gain in {wins} of {values.length} simulated futures{worsened > 0 ? ` · ${worsened} moved into loss` : ''}
        </motion.strong>}
        {values && summary && note && <span className="sr-note">{note}</span>}
      </div>
      {values && <button className="sr-skip" onClick={finish}>See results →</button>}
    </motion.div>
  </motion.div>;
}
