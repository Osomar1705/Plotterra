import { useId, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { ScenarioMeta } from '../../types/fieldshift';
import { FAMILY_LABEL, FAMILY_ORDER, scenarioLabel, signedMoney, toneScale } from './futuresModel';

/**
 * 100 futuros como 100 parcelitas (quantile dotplot). Cada celda = un escenario real del backend.
 *  - order="value": de peor a mejor (se lee cuántas pérdidas hay).
 *  - order="scenario": en el orden del backend; en tamaño "full" se agrupa por tipo de futuro.
 * Las pérdidas llevan rayado diagonal además del color (no depende solo del color).
 */
export function FuturesGrid({
  values, scenarios, size = 'mini', order = 'value', highlightIndex = null, onHoverIndex,
  revealed = true, staggerMs = 10, previousValues, layoutId, ariaLabel, cellPx, ranks,
}: {
  values: number[];
  scenarios?: ScenarioMeta[];
  size?: 'mini' | 'full';
  order?: 'value' | 'scenario';
  highlightIndex?: number | null;
  onHoverIndex?: (i: number | null) => void;
  revealed?: boolean;
  staggerMs?: number;
  previousValues?: number[];
  layoutId?: string;
  ariaLabel?: string;
  cellPx?: number;   // tamaño de celda personalizado (overlay de simulación)
  /**
   * Puesto de esta opcion en cada futuro (0 la mejor de las tres). Si viene, el
   * color dice como le fue frente a las otras en ese mismo futuro: verde la
   * mejor, amarillo segunda, naranja la peor. Con margen positivo en casi todos
   * los futuros, colorear solo por ganancia dejaba la cuadricula toda verde.
   * Las perdidas siguen en rojo fuerte y rayadas.
   */
  ranks?: number[];
}) {
  const uid = useId().replace(/:/g, '');
  const scale = useMemo(() => toneScale(previousValues ? [...values, ...previousValues] : values), [values, previousValues]);
  const byRank = ranks?.length === values.length;
  const tone = (v: number, i: number) => {
    if (!byRank) return scale(v);
    if (v < 0) return 'loss-3';
    return ranks![i] === 0 ? 'gain-3' : ranks![i] === 1 ? 'mid' : 'low';
  };
  const [hover, setHover] = useState<number | null>(null);
  const cell = cellPx ?? (size === 'mini' ? 10 : 15);
  const gap = cellPx ? Math.max(2, Math.round(cellPx / 8)) : 2;
  const cols = 10;

  const groups = useMemo(() => {
    const idx = values.map((_, i) => i);
    if (order === 'value') return [{ key: 'all', label: null as string | null, items: [...idx].sort((a, b) => values[a] - values[b]) }];
    if (size === 'full' && scenarios?.length === values.length) {
      return FAMILY_ORDER.map((f) => ({ key: f, label: FAMILY_LABEL[f], items: idx.filter((i) => scenarios[i].family === f) }))
        .filter((g) => g.items.length);
    }
    return [{ key: 'all', label: null, items: idx }];
  }, [values, scenarios, order, size]);

  const setH = (i: number | null) => { setHover(i); onHoverIndex?.(i); };
  const active = hover ?? highlightIndex;
  let seq = 0;

  const body = (
    <div className={`fg fg--${size}`} role="img" aria-label={ariaLabel}
         onMouseLeave={() => setH(null)}>
      {groups.map((g) => {
        const rows = Math.ceil(g.items.length / cols);
        const w = cols * cell + (cols - 1) * gap;
        const h = rows * cell + (rows - 1) * gap;
        return <div className="fg-group" key={g.key}>
          {g.label && <div className="fg-group-label">{g.label}<span>{g.items.length}</span></div>}
          <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} width="100%" style={{ maxWidth: w + 4 }}>
            <defs>
              <pattern id={`hatch-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4" stroke="rgba(255,255,255,.55)" strokeWidth="1.3" />
              </pattern>
            </defs>
            {g.items.map((i, k) => {
              const x = (k % cols) * (cell + gap);
              const y = Math.floor(k / cols) * (cell + gap);
              const v = values[i];
              const t = revealed ? tone(v, i) : 'empty';
              const delay = revealed ? (seq++) * staggerMs : 0;
              const isActive = active === i;
              return <g key={i} className={`fg-cell fg-${t} ${isActive ? 'is-active' : ''}`}
                        style={{ transitionDelay: `${delay}ms`, transformOrigin: `${x + cell / 2}px ${y + cell / 2}px` }}
                        onMouseEnter={() => setH(i)} onFocus={() => setH(i)} onBlur={() => setH(null)}
                        onTouchStart={() => setH(i)} tabIndex={size === 'full' ? 0 : -1}>
                <rect x={x} y={y} width={cell} height={cell} rx={cell <= 12 ? 2.5 : 3.5} />
                {cell >= 18 && <path className="fg-furrow" d={`M${x + 5} ${y + cell * .38} H${x + cell - 5} M${x + 5} ${y + cell * .62} H${x + cell - 5}`} />}
                {revealed && v < 0 && <rect x={x} y={y} width={cell} height={cell} rx={cell <= 12 ? 2.5 : 3.5} fill={`url(#hatch-${uid})`} pointerEvents="none" />}
              </g>;
            })}
          </svg>
        </div>;
      })}
      {hover !== null && revealed && <div className="fg-tip" role="status">
        <strong>{signedMoney(values[hover])} <small>por ha · 3 campañas</small></strong>
        <span>{scenarioLabel(hover, scenarios)}</span>
        {byRank && <span>{values[hover] < 0 ? 'Pierde plata' : ranks![hover] === 0 ? 'La mejor de las tres' : ranks![hover] === 1 ? 'Segunda de las tres' : 'La que menos deja'} en este futuro</span>}
      </div>}
      {byRank && size === 'full' && <div className="fg-legend fg-legend--rank">
        <span><i className="fg-sw fg-gain-3" />La mejor</span><span><i className="fg-sw fg-mid" />Segunda</span>
        <span><i className="fg-sw fg-low" />La que menos deja</span><span><i className="fg-sw fg-loss-3" />Pierde plata</span>
      </div>}
    </div>
  );
  return layoutId ? <motion.div layoutId={layoutId} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>{body}</motion.div> : body;
}
