import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Alternative, Comparison } from '../../types/fieldshift';
import { CropIllustration } from '../CropIllustration';
import { FuturesGrid } from './FuturesGrid';
import { FAMILY_LABEL, profitLine, scenarioLabel, signedMoney, summarize } from './futuresModel';

const TITLE = { economy: 'Economía', water: 'Agua', soil: 'Suelo', unknown: 'Alternativa' } as const;

/** Vista completa: las alternativas (y el plan habitual) lado a lado en los mismos 100 futuros. */
export function FuturesPanel({ comparison, open, onClose }: { comparison: Comparison; open: boolean; onClose: () => void }) {
  const [order, setOrder] = useState<'value' | 'scenario'>('value');
  const [hover, setHover] = useState<number | null>(null);
  const columns: { alt: Alternative; title: string; usual?: boolean }[] = [
    ...comparison.alternatives.filter((a) => a.outcomes).map((a) => ({ alt: a, title: TITLE[a.type] })),
    ...(comparison.usualPlan?.outcomes ? [{ alt: comparison.usualPlan, title: 'Tu plan habitual', usual: true }] : []),
  ];

  return <AnimatePresence>
    {open && <motion.div className="fp-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.section className="fp" role="dialog" aria-modal="true" aria-label="Los 100 futuros de tu parcela"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }} onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="fp-head">
          <div>
            <span className="fp-kicker">Prueba de estrés</span>
            <h2>Los 100 futuros de tu parcela</h2>
            <p>Cada cuadrito es un futuro posible construido con años reales de clima y golpes de lluvia, riego o precio. No es una probabilidad: es un conjunto de pruebas igual para todas las opciones.</p>
          </div>
          <div className="fp-tools">
            <div className="fp-toggle" role="group" aria-label="Ordenar">
              <button className={order === 'value' ? 'on' : ''} onClick={() => setOrder('value')}>De peor a mejor</button>
              <button className={order === 'scenario' ? 'on' : ''} onClick={() => setOrder('scenario')}>Por tipo de futuro</button>
            </div>
            <button className="fp-close" onClick={onClose} aria-label="Cerrar">×</button>
          </div>
        </header>

        <div className="fp-hover" aria-live="polite">
          {hover === null ? <span>Pasa el cursor sobre un cuadrito: verás cómo le va a cada opción en <b>ese mismo futuro</b>.</span>
            : <><strong>{scenarioLabel(hover, comparison.scenarios)}</strong>
              {columns.map(({ alt, title }) => <span key={alt.id} className={alt.outcomes!.marginByScenario[hover] < 0 ? 'neg' : 'pos'}>{title}: {signedMoney(alt.outcomes!.marginByScenario[hover])}</span>)}</>}
        </div>

        <div className="fp-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` }}>
          {columns.map(({ alt, title, usual }) => {
            const s = summarize(alt.outcomes!);
            return <article key={alt.id} className={`fp-col fp-col--${usual ? 'usual' : alt.type}`}>
              <h3>{title}</h3>
              <div className="fp-seq">{alt.campaigns.map((c, i) => <span key={i}><CropIllustration crop={c.cropId ?? c.crop} size={22} />{c.crop}</span>)}</div>
              <p className="fp-big">{!usual && s.best !== undefined ? <>La mejor en <b>{s.best}</b> de {s.total}</> : <>Gana en <b>{s.wins}</b> de {s.total}</>}</p>
              <p className={`fp-profit ${s.losses > 0 ? 'neg' : ''}`}>{profitLine(s)}</p>
              <FuturesGrid values={alt.outcomes!.marginByScenario} ranks={usual ? undefined : alt.outcomes!.rankByScenario} scenarios={comparison.scenarios} size="full" order={order}
                highlightIndex={hover} onHoverIndex={setHover}
                ariaLabel={`${title}: ${profitLine(s).toLowerCase()} futuros`} />
              <dl className="fp-stats">
                {s.mean !== undefined && <><dt>Promedio</dt><dd>{signedMoney(s.mean)} /ha</dd></>}
                {s.adverse !== undefined && <><dt>10 peores futuros</dt><dd className={s.adverse < 0 ? 'neg' : ''}>{signedMoney(s.adverse)} /ha</dd></>}
              </dl>
              {alt.stressTest && <ul className="fp-stress" aria-label="Margen medio por tipo de futuro">
                {alt.stressTest.map((r) => {
                  const max = Math.max(...alt.stressTest!.map((x) => Math.abs(x.meanMargin)), 1);
                  return <li key={r.family}><span>{FAMILY_LABEL[r.family as keyof typeof FAMILY_LABEL] ?? r.label}</span>
                    <i><b className={r.meanMargin < 0 ? 'neg' : ''} style={{ width: `${Math.abs(r.meanMargin) / max * 100}%` }} /></i>
                    <em>{signedMoney(r.meanMargin)}</em></li>;
                })}
              </ul>}
            </article>;
          })}
        </div>
        <footer className="fp-legend">
          <span><i className="fg-sw fg-gain-3" />gana mucho</span><span><i className="fg-sw fg-gain-1" />gana poco</span>
          <span><i className="fg-sw fg-neutral" />casi cero</span><span><i className="fg-sw fg-loss-2 fg-sw--hatch" />pierde</span>
          <small>Margen en soles por hectárea sumando las 3 campañas. Datos: {comparison.sourceResult === 'mock' ? 'demostración' : 'motor FieldShift'}.</small>
        </footer>
      </motion.section>
    </motion.div>}
  </AnimatePresence>;
}
