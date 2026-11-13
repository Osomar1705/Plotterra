import { useEffect, useMemo, useState } from 'react';
import type { Greenness } from '../types/fieldshift';
import { getGreenness } from '../api/fieldshiftApi';
import { SproutIcon } from './Icons';

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const W = 560, H = 150, PAD_L = 34, PAD_R = 12, PAD_T = 12, PAD_B = 26;
const Y_MIN = 0.2, Y_MAX = 0.9;

const PATTERN_LABEL: Record<string, string> = {
  ciclo_de_cultivo: 'Confirmado por satélite',
  sin_vegetacion: 'Sin vegetación',
  vegetacion_permanente: 'Vegetación permanente',
  dudoso: 'No concluyente',
};

/**
 * Verdor de la parcela (NDVI). Muestra los ultimos tres anios: con la serie
 * entera desde 2015 la linea se vuelve ilegible en una tarjeta.
 */
export function GreennessPanel({ plotId }: { plotId: string }) {
  const [data, setData] = useState<Greenness | null>(null);
  useEffect(() => { let alive = true; getGreenness(plotId).then((d) => alive && setData(d)); return () => { alive = false; }; }, [plotId]);

  const recent = useMemo(() => {
    if (!data?.series.length) return [];
    const last = new Date(data.series[data.series.length - 1].date).getTime();
    const from = last - 3 * 365 * 864e5;
    return data.series.filter((p) => new Date(p.date).getTime() >= from);
  }, [data]);

  if (!data) return null;

  if (!data.available) {
    return (
      <section className="greenness greenness--off" aria-label="Verdor de la parcela">
        <SproutIcon />
        <p>{data.farmerMessage}</p>
      </section>
    );
  }

  const t0 = new Date(recent[0].date).getTime();
  const t1 = new Date(recent[recent.length - 1].date).getTime();
  const x = (d: string) => PAD_L + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (Math.min(Y_MAX, Math.max(Y_MIN, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * (H - PAD_T - PAD_B);
  // En temporada de lluvias pasan semanas sin una imagen despejada. Unir esos
  // puntos con una recta inventaria valores: la linea se corta en cada hueco.
  const GAP_DAYS = 45;
  const path = recent.map((p, i) => {
    const gap = i > 0 && (new Date(p.date).getTime() - new Date(recent[i - 1].date).getTime()) / 864e5 > GAP_DAYS;
    return `${i === 0 || gap ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(p.ndvi).toFixed(1)}`;
  }).join('');
  const years: number[] = [];
  for (let yr = new Date(t0).getFullYear() + 1; yr <= new Date(t1).getFullYear(); yr++) years.push(yr);

  return (
    <section className="greenness" aria-label="Verdor de la parcela">
      <div className="greenness-copy">
        <span className={`greenness-badge greenness-badge--${data.pattern}`}><SproutIcon />{PATTERN_LABEL[data.pattern ?? 'dudoso']}</span>
        <h2>Tu chacra vista desde el satélite</h2>
        <p>{data.farmerMessage}</p>
        <dl>
          <div><dt>Último año</dt><dd>{data.lastYear?.min?.toFixed(2)} → {data.lastYear?.max?.toFixed(2)}</dd></div>
          <div><dt>Imágenes sin nubes</dt><dd>{data.clearImages} de {data.scenes}</dd></div>
        </dl>
        <small>{data.source}</small>
      </div>
      <figure className="greenness-chart">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Verdor de la parcela en los últimos tres años">
          {[0.3, 0.5, 0.7].map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} className="greenness-grid" />
              <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" className="greenness-axis">{v.toFixed(1)}</text>
            </g>
          ))}
          {years.map((yr) => {
            const xi = x(`${yr}-01-01`);
            return (
              <g key={yr}>
                <line x1={xi} x2={xi} y1={PAD_T} y2={H - PAD_B} className="greenness-grid" />
                <text x={xi} y={H - 8} textAnchor="middle" className="greenness-axis">{yr}</text>
              </g>
            );
          })}
          <path d={path} className="greenness-line" />
          {recent.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.ndvi)} r={2} className="greenness-dot"><title>{`${p.date}: NDVI ${p.ndvi.toFixed(2)}`}</title></circle>)}
        </svg>
        <figcaption>
          <span>Sin línea = semanas sin imagen despejada · Verdor típico por mes</span>
          <span className="greenness-months">
            {data.monthly.map((m) => (
              <i key={m.month} style={{ opacity: 0.25 + 0.75 * Math.max(0, (m.ndvi - 0.3) / 0.5) }} title={`NDVI medio ${m.ndvi.toFixed(2)}`}>{MONTHS[m.month - 1]}</i>
            ))}
          </span>
        </figcaption>
      </figure>
    </section>
  );
}
