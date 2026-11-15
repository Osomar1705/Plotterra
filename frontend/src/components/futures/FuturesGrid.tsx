import { useId, useMemo, useState, type CSSProperties } from 'react';
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
  values, scaleValues, scenarios, size = 'mini', order = 'value', highlightIndex = null, onHoverIndex, ranks,
  revealed = true, staggerMs = 10, previousValues, layoutId, ariaLabel, cellPx, shown, onSelectIndex, selectedIndex,
}: {
  values: number[];
  scaleValues?: number[]; // use a consistent color scale across scenario groups
  /**
   * Position of this option in each test (0 = best of the three). When given,
   * the color tells how it did against the others in that same test: green best,
   * yellow second, orange last; losses stay solid red and hatched. Coloring only
   * by gain left the whole grid green.
   */
  ranks?: number[];
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
  /** Si se da, cada celda aparece cuando shown(i) es true (animación guiada por la simulación). */
  shown?: (i: number) => boolean;
  /** Clic en una celda: la selección queda marcada hasta que se elige otra. */
  onSelectIndex?: (i: number) => void;
  selectedIndex?: number | null;
}) {
  const uid = useId().replace(/:/g, '');
  const scale = useMemo(() => toneScale(scaleValues ?? (previousValues ? [...values, ...previousValues] : values)), [values, previousValues, scaleValues]);
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
              const on = revealed && (!shown || shown(i));
              const t = on ? tone(v, i) : 'empty';
              const delay = on && !shown ? (seq++) * staggerMs : 0;
              const isActive = active === i || selectedIndex === i;
              return <g key={i} className={`fg-cell fg-${t} ${isActive ? 'is-active' : ''}`}
                        style={{ '--cell-delay': `${delay}ms`, transformOrigin: `${x + cell / 2}px ${y + cell / 2}px` } as CSSProperties}
                        onMouseEnter={() => setH(i)} onFocus={() => setH(i)} onBlur={() => setH(null)}
                        onTouchStart={() => setH(i)} onClick={() => onSelectIndex?.(i)} tabIndex={size === 'full' ? 0 : -1}>
                <rect x={x} y={y} width={cell} height={cell} rx={cell <= 12 ? 2.5 : 3.5} />
                {cell >= 18 && <path className="fg-furrow" d={`M${x + 5} ${y + cell * .38} H${x + cell - 5} M${x + 5} ${y + cell * .62} H${x + cell - 5}`} />}
                {on && v < 0 && <rect x={x} y={y} width={cell} height={cell} rx={cell <= 12 ? 2.5 : 3.5} fill={`url(#hatch-${uid})`} pointerEvents="none" />}
              </g>;
            })}
          </svg>
        </div>;
      })}
      {hover !== null && revealed && !onHoverIndex && <div className="fg-tip" role="status">
        <strong>{signedMoney(values[hover])} <small>per ha · 3 seasons</small></strong>
        <span>{scenarioLabel(hover, scenarios)}</span>
      </div>}
    </div>
  );
  return layoutId ? <motion.div layoutId={layoutId} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>{body}</motion.div> : body;
}
