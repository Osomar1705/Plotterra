import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import type { ScenarioMeta } from '../../types/fieldshift';
import { FuturesGrid } from './FuturesGrid';
import { Photo } from '../Photo';
import { FAMILY_LABEL, prefersReducedMotion, scenarioLabel } from './futuresModel';

const STAGGER = 12;           // ms entre celdas → ~1,2 s para 100
const HOLD_SUMMARY = 1100;    // ms mostrando el resumen antes de cerrar

/**
 * Momento wow 1. Mientras la API responde: 100 parcelas vacías "respiran" (sin progreso inventado).
 * Cuando llegan los datos: se pintan en cascada con los valores REALES y un contador recorre los
 * escenarios reales. Luego la cuadrícula viaja a la tarjeta destacada (layoutId compartido).
 */
export function SimulationReveal({ values, previousValues, scenarios, changeLabel, layoutId, onDone, note }: {
  values?: number[];            // undefined = todavía esperando la API
  previousValues?: number[];    // en recálculos: para contar futuros que empeoraron
  scenarios?: ScenarioMeta[];
  changeLabel?: string | null;
  layoutId?: string;
  onDone: () => void;
  note?: string | null;          // p. ej. "La opción Economía ahora es Tarwi → Avena → Tarwi"
}) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <Photo k="andenes" className="sr-bg" credit={false} width={1200} />
    <div className="sr-card">
      <span className="sr-kicker">{changeLabel ? `Simulando · ${changeLabel}` : 'Simulación de escenarios'}</span>
      <h2>{values ? 'Probando tu parcela en 100 futuros' : 'Preparando 100 futuros para tu parcela…'}</h2>
      <div className={`sr-grid ${values ? '' : 'is-waiting'}`}>
        <FuturesGrid values={values ?? placeholder} scenarios={scenarios} size="mini" order="scenario"
          revealed={!!values} staggerMs={STAGGER} previousValues={previousValues} layoutId={layoutId} cellPx={22}
          ariaLabel="Simulación de 100 futuros" />
      </div>
      <div className="sr-ticker" aria-live="polite">
        {!values && <span>Clima histórico NASA · lluvia · riego · precio</span>}
        {values && !summary && tick >= 0 && <span><b>{scenarioLabel(tick, scenarios, false)}</b>{fam && <em className={`sr-fam sr-fam--${scenarios![tick].family}`}>{fam}</em>}</span>}
        {values && summary && <motion.strong initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          Con ganancia en {wins} de {values.length} futuros{worsened > 0 ? ` · ${worsened} pasaron a pérdida` : ''}
        </motion.strong>}
        {values && summary && note && <span className="sr-note">{note}</span>}
      </div>
      {values && <button className="sr-skip" onClick={finish}>Ver resultados →</button>}
    </div>
  </motion.div>;
}
