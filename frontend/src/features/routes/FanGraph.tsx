import { useId, type CSSProperties } from 'react';
import type { Alternative, AlternativeKind } from '../../types/fieldshift';
import { PeacockMark } from './PeacockMark';

/** Color por criterio; replica las variables de decision-routes.css. */
const routeColor: Record<AlternativeKind, string> = {
  economy: '#006B57',
  water: '#155D8B',
  soil: '#007F86',
  unknown: '#66777B',
};

const routeName: Record<AlternativeKind, string> = {
  economy: 'Economía',
  water: 'Agua',
  soil: 'Suelo',
  unknown: 'Alternativa',
};

// El lienzo es el mismo viewBox que usa el CSS para .dr-fan-board (1100x660).
const VIEW_W = 1100;
const VIEW_H = 660;
const ORIGIN_X = 550;
const ORIGIN_Y = 580;
/** Un radio por campaña: coinciden con los arcos guia dibujados de fondo. */
const RADII = [158, 323, 488];
/** Apertura total del abanico. Con una sola ruta queda vertical. */
const SPREAD = 104;

/**
 * Posicion de un nodo en porcentaje del lienzo. Las rutas se abren en abanico
 * desde la parcela: el indice de la ruta da el angulo y el de la campaña el radio.
 */
function nodePosition(routeIndex: number, campaignIndex: number, routeCount: number) {
  const step = routeCount > 1 ? SPREAD / (routeCount - 1) : 0;
  const angle = routeCount > 1 ? -SPREAD / 2 + step * routeIndex : 0;
  const radians = (angle * Math.PI) / 180;
  const radius = RADII[Math.min(campaignIndex, RADII.length - 1)];
  return {
    angle,
    left: ((ORIGIN_X + radius * Math.sin(radians)) / VIEW_W) * 100,
    top: ((ORIGIN_Y - radius * Math.cos(radians)) / VIEW_H) * 100,
  };
}

interface Props {
  alternatives: Alternative[];
  selectedId: string;
  selectedCampaign: number;
  onSelect: (id: string, campaignIndex: number) => void;
}

/**
 * Abanico de rutas. Cada pluma es una estrategia completa y cada nodo una
 * campaña. Son alternativas excluyentes, no probabilidades: por eso no hay
 * ningun camino "mas ancho" ni porcentajes asociados.
 */
export function FanGraph({ alternatives, selectedId, selectedCampaign, onSelect }: Props) {
  const titleId = useId();
  const visible = alternatives.slice(0, 3);

  return (
    <div className="dr-fan-board" role="group" aria-labelledby={titleId}>
      <span id={titleId} className="dr-sr-only">
        Abanico de rotaciones. Cada pluma es una estrategia completa; cada nodo, una campaña.
      </span>

      <svg className="dr-fan-art" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
        <defs>
          <pattern id="dr-fan-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#DDE7E1" />
          </pattern>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#dr-fan-dots)" opacity=".5" />

        {/* Arcos guia: marcan a que campaña corresponde cada anillo. */}
        {RADII.map((r) => (
          <path
            key={r}
            d={`M${ORIGIN_X - r} ${ORIGIN_Y} A${r} ${r} 0 0 1 ${ORIGIN_X + r} ${ORIGIN_Y}`}
            fill="none"
            stroke="#CBD8D4"
            strokeDasharray="3 7"
            strokeWidth="1"
          />
        ))}

        {visible.map((alternative, index) => {
          const { angle } = nodePosition(index, 0, visible.length);
          const active = alternative.id === selectedId;
          const color = routeColor[alternative.type] ?? routeColor.unknown;
          return (
            <g
              key={alternative.id}
              transform={`rotate(${angle} ${ORIGIN_X} ${ORIGIN_Y})`}
              className={active ? 'dr-feather dr-feather--active' : 'dr-feather'}
            >
              <path
                d={`M${ORIGIN_X} ${ORIGIN_Y}C421 458 405 195 ${ORIGIN_X} 54C695 195 679 458 ${ORIGIN_X} ${ORIGIN_Y}Z`}
                fill={color}
                fillOpacity={active ? '.21' : '.075'}
                stroke={color}
                strokeOpacity={active ? '.85' : '.3'}
                strokeWidth={active ? 2 : 1}
              />
              <path
                d={`M${ORIGIN_X} ${ORIGIN_Y}V116`}
                stroke={color}
                strokeWidth={active ? 3 : 1.5}
                strokeOpacity={active ? 1 : '.3'}
                strokeDasharray={active ? undefined : '5 6'}
              />
            </g>
          );
        })}
      </svg>

      {visible.flatMap((alternative, routeIndex) =>
        alternative.campaigns.slice(0, RADII.length).map((campaign, campaignIndex) => {
          const { left, top } = nodePosition(routeIndex, campaignIndex, visible.length);
          const routeActive = alternative.id === selectedId;
          const nodeActive = routeActive && selectedCampaign === campaignIndex;
          const label = alternative.name || routeName[alternative.type] || routeName.unknown;
          return (
            <button
              key={campaign.id ?? `${alternative.id}-${campaignIndex}`}
              type="button"
              className={`dr-route-node ${routeActive ? 'is-route-active' : ''} ${nodeActive ? 'is-node-active' : ''}`}
              style={{
                left: `${left}%`,
                top: `${top}%`,
                '--route-color': routeColor[alternative.type] ?? routeColor.unknown,
              } as CSSProperties}
              aria-pressed={nodeActive}
              aria-label={`${label}, campaña ${campaignIndex + 1}: ${campaign.crop}`}
              onClick={() => onSelect(alternative.id, campaignIndex)}
            >
              <span className="dr-node-number">{String(campaignIndex + 1).padStart(2, '0')}</span>
              <span>
                <strong>{campaign.crop || 'Por confirmar'}</strong>
                <small>{campaign.window === '—' ? 'Ventana por confirmar' : campaign.window}</small>
              </span>
              {nodeActive && <span className="dr-node-check" aria-hidden="true">✓</span>}
            </button>
          );
        }),
      )}

      <div className="dr-fan-origin">
        <PeacockMark size={56} />
        <span>Tu parcela</span>
        <small>La decisión comienza aquí</small>
      </div>

      <p className="dr-fan-caption">Lee desde tu parcela hacia afuera: 01 → 02 → 03</p>
    </div>
  );
}
