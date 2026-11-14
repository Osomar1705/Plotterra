import type { PlotPoint } from '../types/fieldshift';
import { formatHa } from '../lib/plotGeometry';
import { PinIcon, UndoIcon, PencilIcon, TrashIcon } from './Icons';

export type MapMode = 'empty' | 'drawing' | 'ready' | 'invalid' | 'denied';

interface Props {
  mode: MapMode;
  points: PlotPoint[];
  areaHa: number;
  crossing: PlotPoint | null;
  locality: string;
  onLocality: (v: string) => void;
  onAddPoint: (p: PlotPoint) => void;
  onStartDraw: () => void;
  onUndoPoint: () => void;
  onClear: () => void;
  onTypeArea: () => void;
}

const VB_W = 400;
const VB_H = 300;

export function PlotMap(props: Props) {
  const { mode, points, areaHa, crossing } = props;
  // Tocar el mapa empieza a dibujar sin tener que pulsar "Dibujar" primero:
  // el boton queda como pista, no como requisito.
  const drawable = mode !== 'ready';

  function handleClick(ev: React.MouseEvent<SVGSVGElement>) {
    if (!drawable) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    props.onAddPoint({
      x: ((ev.clientX - rect.left) / rect.width) * VB_W,
      y: ((ev.clientY - rect.top) / rect.height) * VB_H,
    });
  }

  const path = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const closed = mode === 'ready' || mode === 'invalid';

  return (
    <div className="plot-map">
      <div className="plot-canvas">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid slice"
          className={drawable ? 'map-svg map-svg--drawing' : 'map-svg'}
          onClick={handleClick}
          role="img"
          aria-label="Mapa de la zona con el contorno de la parcela"
        >
          <rect width={VB_W} height={VB_H} fill="#D9DFC8" />
          <path d="M-20,40 L180,-10 L250,60 L60,120 Z" fill="#CBD3B4" />
          <path d="M210,180 L420,120 L430,260 L240,300 Z" fill="#C3CFA6" />
          <path d="M-10,200 L140,160 L190,290 L-20,320 Z" fill="#E2D9C2" />
          <path d="M-20,150 C90,135 150,175 230,150 C300,128 360,150 420,130" stroke="#EDE9DF" strokeWidth="7" fill="none" />
          <path d="M120,45 C150,110 100,170 150,250" stroke="#EDE9DF" strokeWidth="4" fill="none" opacity=".55" />

          {points.length > 1 && (
            closed
              ? <polygon points={path} fill={mode === 'invalid' ? '#A33A2E' : '#006B57'} fillOpacity={mode === 'invalid' ? 0.18 : 0.24} stroke={mode === 'invalid' ? '#A33A2E' : '#006B57'} strokeWidth="2.5" />
              : <polyline points={path} fill="none" stroke="#006B57" strokeWidth="3" />
          )}
          {!closed && points.length > 0 && (
            <circle cx={points[0].x} cy={points[0].y} r="8" fill="none" stroke="#006B57" strokeWidth="1.5" strokeDasharray="3 3" />
          )}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4.5" fill="#fff" stroke={mode === 'invalid' ? '#A33A2E' : '#006B57'} strokeWidth="2" />
          ))}
          {crossing && <circle cx={crossing.x} cy={crossing.y} r="9" fill="none" stroke="#A33A2E" strokeWidth="2.5" />}
        </svg>

        <div className="map-search">
          <PinIcon size={16} />
          <input
            value={props.locality}
            onChange={(e) => props.onLocality(e.target.value)}
            placeholder={mode === 'denied' ? 'Escribe tu localidad' : 'Buscar localidad'}
            aria-label="Localidad"
          />
        </div>

        {(mode === 'ready' || mode === 'invalid') && points.length >= 3 && (
          <div className="map-badge">
            <strong>{formatHa(areaHa)}</strong>
            <span>calculada</span>
          </div>
        )}
        {mode === 'drawing' && points.length > 0 && (
          <div className="map-badge"><strong>{points.length}</strong><span>{points.length === 1 ? 'punto' : 'puntos'}</span></div>
        )}

        {mode === 'empty' && (
          <div className="map-hint">
            <div>
              <p>Dibuja el contorno de tu parcela tocando sus esquinas.</p>
              <button type="button" className="primary-btn" onClick={props.onStartDraw}>Dibujar parcela</button>
            </div>
          </div>
        )}
        {mode === 'denied' && (
          <div className="map-hint">
            <div>
              <p>No pudimos usar tu ubicación. Busca tu localidad o escribe cuántas hectáreas tiene tu parcela.</p>
              <div className="map-hint-actions">
                <button type="button" className="primary-btn" onClick={props.onStartDraw}>Dibujar parcela</button>
                <button type="button" className="ghost-btn" onClick={props.onTypeArea}>Escribir hectáreas</button>
              </div>
            </div>
          </div>
        )}
        {mode === 'drawing' && (
          <p className="map-tip">Toca cada esquina. Con tres puntos ya puedes cerrar la parcela.</p>
        )}
      </div>

      <div className="map-tools">
        <button type="button" className={mode === 'drawing' ? 'tool tool--on' : 'tool'} onClick={props.onStartDraw} disabled={mode === 'ready'}>
          <PencilIcon size={16} />Dibujar
        </button>
        <button type="button" className="tool" onClick={props.onStartDraw} disabled={mode !== 'ready'}>
          <PencilIcon size={16} />Editar
        </button>
        <button type="button" className="tool" onClick={props.onClear} disabled={points.length === 0}>
          <TrashIcon size={16} />Borrar
        </button>
        {drawable && points.length > 0 && (
          <button type="button" className="tool tool--ghost" onClick={props.onUndoPoint}>
            <UndoIcon size={16} />Deshacer último punto
          </button>
        )}
        <span className="tools-spacer" />
        <button type="button" className="tool tool--ghost" onClick={props.onTypeArea}>
          No puedo dibujarla, prefiero escribir las hectáreas
        </button>
      </div>
    </div>
  );
}
