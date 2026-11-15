import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SOFT_EASE } from '../../motion/policy';
import { FieldApproach } from '../../motion/FieldApproach';
import { CAMERA_DURATION } from '../../motion/fieldCamera';
import '../../motion/field-approach.css';
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
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(-1);
  const [summary, setSummary] = useState(false);
  const [landed, setLanded] = useState(() => prefersReducedMotion());
  const done = useRef(false);
  // Al terminar deja de tapar la pagina al instante: si la animacion de salida
  // no corre (pestana en segundo plano, ahorro de bateria), el overlay seguia
  // encima bloqueando "View this plan" y el boton "See results" ya no hacia nada.
  const [closing, setClosing] = useState(false);
  const finish = () => { if (!done.current) { done.current = true; setClosing(true); onDone(); } };

  // Una simulacion nueva puede reutilizar esta instancia mientras sale la anterior.
  useEffect(() => {
    if (!values) { done.current = false; setClosing(false); setSummary(false); setTick(-1); }
  }, [values]);

  useEffect(() => {
    const previous = document.activeElement;
    card.current?.focus({preventScroll:true});
    return () => { if(previous instanceof HTMLElement && previous.isConnected) previous.focus({preventScroll:true}); };
  }, []);
  useEffect(() => { if(values) card.current?.querySelector('button')?.focus({preventScroll:true}); }, [values]);

  useEffect(() => {
    if (reduced) { setLanded(true); return; }
    const end = window.setTimeout(() => setLanded(true), CAMERA_DURATION);
    return () => window.clearTimeout(end);
  }, [reduced]);

  useEffect(() => {
    if (!values || !landed) return;
    if (prefersReducedMotion()) { finish(); return; }
    let i = 0;
    const iv = window.setInterval(() => {
      i += 3; setTick(Math.min(i, values.length - 1));
      if (i >= values.length - 1) { window.clearInterval(iv); setSummary(true); }
    }, STAGGER * 3);
    const end = window.setTimeout(finish, values.length * STAGGER + 300 + HOLD_SUMMARY);
    return () => { window.clearInterval(iv); window.clearTimeout(end); };
  }, [values, landed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && values) finish();
      if (e.key === 'Tab') {e.preventDefault();(card.current?.querySelector('button')??card.current)?.focus({preventScroll:true});}
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const placeholder = Array.from({ length: 100 }, () => 0);
  const wins = values?.filter((v) => v > 0).length ?? 0;
  const worsened = values && previousValues
    ? values.filter((v, i) => v < 0 && (previousValues[i] ?? 0) >= 0).length : 0;
  const fam = values && tick >= 0 && scenarios?.[tick] ? FAMILY_LABEL[scenarios[tick].family] : null;

  return <motion.div className={`sr-overlay${closing ? ' is-closing' : ''}`} role="dialog" aria-modal={closing ? undefined : true} aria-hidden={closing || undefined} aria-labelledby={titleId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .35 } }}>
    <motion.div ref={card} tabIndex={-1} className="sr-card sr-card--cinema" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4}} transition={{duration:.3,ease:SOFT_EASE}}>
      <span className="sr-kicker">{changeLabel ? `Running scenario · ${changeLabel}` : 'Scenario simulation'}</span>
      <h2 id={titleId}>{values ? 'Testing your plot in 100 possible futures' : 'Preparing 100 possible futures for your plot…'}</h2>
      <div className={`sr-cinema ${landed ? 'sr-cinema--landed' : ''} ${landed && values ? 'sr-cinema--results' : ''}`}>
       {!reduced && <FieldApproach/>}
       <motion.div className={`sr-grid sr-grid--landing ${values ? '' : 'is-waiting'}`}
        initial={false} animate={{opacity:landed || reduced?1:0}}
        transition={{duration:reduced?0:.5,ease:SOFT_EASE}}>
        <FuturesGrid values={values ?? placeholder} scenarios={scenarios} size="mini" order="scenario"
          revealed={!!values && landed} staggerMs={STAGGER} previousValues={previousValues} layoutId={layoutId} cellPx={22}
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
