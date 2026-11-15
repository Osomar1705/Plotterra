import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlotPoint } from '../types/fieldshift';
import { formatHa } from '../lib/plotGeometry';
import { INITIAL_VIEW } from '../lib/demoPlot';
import { PinIcon, UndoIcon, PencilIcon, TrashIcon } from './Icons';
import { installPlotDrawing, type TraceStatus } from '../lib/plotDrawing';
import '../styles/plot-drawing.css';
import '../styles/plot-map.css';

export type MapMode = 'empty' | 'drawing' | 'ready' | 'invalid' | 'denied';

interface Props {
  mode: MapMode;
  points: PlotPoint[];
  areaHa: number;
  crossing: PlotPoint | null;
  locality: string;
  onLocality: (v: string) => void;
  /** closesShape = el toque cayo sobre el primer punto y cierra el contorno. */
  onAddPoint: (p: PlotPoint, closesShape?: boolean) => void;
  onReplacePoints: (points: PlotPoint[], closed: boolean) => void;
  onStartDraw: () => void;
  onUndoPoint: () => void;
  onClear: () => void;
  onTypeArea: () => void;
  onUseDemo: () => void;
  onLocationDenied: () => void;
}

const GREEN = '#00a37a';
const RED = '#e5484d';

const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics · Search © OpenStreetMap';

const toLatLng = (p: PlotPoint): L.LatLngTuple => [p.y, p.x];

export function PlotMap(props: Props) {
  const { mode, points, areaHa, crossing } = props;
  const drawable = mode !== 'ready';
  const [tool, setTool] = useState<'draw' | 'move'>('move');
  const activeDraw = tool === 'draw' && drawable;
  const [traceStatus, setTraceStatus] = useState<TraceStatus>({ tracing: false, nearStart: false });
  const [undoCount, setUndoCount] = useState(0);
  const history = useRef<{ points: PlotPoint[]; closed: boolean }[]>([]);
  const drawingRef = useRef<ReturnType<typeof installPlotDrawing> | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const shapeLayer = useRef<L.LayerGroup | null>(null);
  // Los manejadores de Leaflet se registran una sola vez: leen siempre las props actuales.
  const latest = useRef(props);
  latest.current = props;
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = L.map(container.current, { zoomControl: true, attributionControl: true })
      .setView([INITIAL_VIEW.lat, INITIAL_VIEW.lon], INITIAL_VIEW.zoom);
    L.tileLayer(SATELLITE_URL, { maxZoom: 19, maxNativeZoom: 17, attribution: ATTRIBUTION }).addTo(map);
    L.tileLayer(LABELS_URL, { maxZoom: 19, maxNativeZoom: 17, opacity: 0.85 }).addTo(map);
    shapeLayer.current = L.layerGroup().addTo(map);

    drawingRef.current = installPlotDrawing(map, container.current, {
      getState: () => latest.current,
      onPoint: (point, close) => {
        remember();
        latest.current.onAddPoint(point, close);
      },
      onTrace: (next, closed) => {
        remember();
        latest.current.onReplacePoints(next, closed);
      },
      onStatus: setTraceStatus,
      onNotice: setNotice,
    });

    mapRef.current = map;
    // El contenedor puede medir distinto al montar (rejilla, fuentes): se recalcula.
    // Cambios de ventana, orientación y panel móvil: Leaflet necesita el tamaño real.
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (container.current?.clientWidth && container.current.clientHeight) {
          map.invalidateSize({ pan: false });
          const current = latest.current;
          if (current.mode === 'ready' && current.points.length >= 3) {
            map.fitBounds(L.latLngBounds(current.points.map(toLatLng)), {
              padding: [32, 32], maxZoom: 17, animate: false,
            });
          }
        }
      });
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      // Si se sale de la Vista 01 durante una animacion de zoom (por ejemplo
      // justo despues de "Usar chacra de ejemplo"), Leaflet termina la
      // animacion 250 ms despues sobre un mapa ya destruido y lanza
      // "_leaflet_pos". Con la bandera en false ese cierre no hace nada.
      drawingRef.current?.destroy();
      drawingRef.current = null;
      map.stop();
      (map as unknown as { _animatingZoom: boolean })._animatingZoom = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    drawingRef.current?.setEnabled(activeDraw);
    // La clase se agrega a mano: si React reescribe className del contenedor,
    // borra las que pone Leaflet (leaflet-container, leaflet-touch...) y el mapa
    // pierde estilos y el control de gestos tactiles.
    container.current?.classList.toggle('map-leaflet--drawing', activeDraw);
  }, [activeDraw]);

  function remember() {
    const p = latest.current;
    history.current = [...history.current.slice(-29), {
      points: p.points.map(point => ({ ...point })), closed: p.mode === 'ready' || p.mode === 'invalid',
    }];
    setUndoCount(history.current.length);
  }

  function resetHistory() { history.current = []; setUndoCount(0); setNotice(null); }
  function startDrawing() { setTool('draw'); setNotice(null); props.onStartDraw(); }
  function clear() { drawingRef.current?.cancel(); resetHistory(); setTool('draw'); props.onClear(); props.onStartDraw(); }
  function undo() {
    drawingRef.current?.cancel();
    const previous = history.current.pop();
    setUndoCount(history.current.length);
    setNotice(null);
    if (previous) {
      setTool(previous.closed ? 'move' : 'draw');
      props.onReplacePoints(previous.points, previous.closed);
    } else { setTool('draw'); props.onUndoPoint(); }
  }
  function useDemo() { drawingRef.current?.cancel(); resetHistory(); setTool('move'); props.onUseDemo(); }

  // Redibuja el contorno cada vez que cambian los puntos o el estado.
  useEffect(() => {
    const layer = shapeLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const closed = mode === 'ready' || mode === 'invalid';
    const color = mode === 'invalid' ? RED : GREEN;
    const latlngs = points.map(toLatLng);
    if (latlngs.length > 1) {
      if (closed) L.polygon(latlngs, { color, weight: 3, fillColor: color, fillOpacity: 0.28, interactive: false }).addTo(layer);
      else L.polyline(latlngs, { color, weight: 3, dashArray: '6 6', interactive: false }).addTo(layer);
    }
    points.forEach((p, i) => {
      if (points.length > 24 && i !== 0 && i !== points.length - 1) return;
      L.circleMarker(toLatLng(p), {
        radius: i === 0 && !closed ? 8 : 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
    });
    if (crossing) L.circleMarker(toLatLng(crossing), { radius: 12, color: RED, weight: 3, fill: false, interactive: false }).addTo(layer);
    if (!closed && latlngs.length) L.circleMarker(latlngs[latlngs.length - 1], { radius: 11, color: GREEN, weight: 2, fillOpacity: 0.12, interactive: false }).addTo(layer);
  }, [points, mode, crossing]);

  // Una parcela ya cerrada (por ejemplo la de ejemplo) se encuadra en pantalla.
  const pointsKey = points.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`).join('|');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'ready' || points.length < 3) return;
    map.fitBounds(L.latLngBounds(points.map(toLatLng)), { padding: [70, 70], maxZoom: 17 });
    // Solo al cerrar o cambiar la parcela, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pointsKey]);

  async function search(ev: React.FormEvent) {
    ev.preventDefault();
    const q = props.locality.trim();
    const map = mapRef.current;
    if (!q || !map || searching) return;
    setSearching(true);
    setNotice(null);
    try {
      // Nominatim (OpenStreetMap): una sola consulta al pulsar buscar, limitada a Peru.
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=pe&accept-language=es&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = res.ok ? await res.json() : [];
      if (Array.isArray(data) && data.length) {
        map.flyTo([Number(data[0].lat), Number(data[0].lon)], 15, { duration: 1.2 });
      } else {
        setNotice('We could not find that place. Try the district or village name.');
      }
    } catch {
      setNotice('Search is not available right now. Zoom the map by hand or use the example plot.');
    } finally {
      setSearching(false);
    }
  }

  function locate() {
    const map = mapRef.current;
    if (!map) return;
    if (!('geolocation' in navigator)) { props.onLocationDenied(); return; }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { duration: 1.2 });
      },
      () => { setLocating(false); props.onLocationDenied(); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <div className="plot-map" data-map-mode={mode}>
      <div className="plot-canvas">
        <div
          ref={container}
          className="map-leaflet"
          role="application"
          aria-label="Satellite map to draw the plot outline"
          aria-describedby="plot-drawing-help"
        />

        <form className="map-search" onSubmit={search}>
          <PinIcon size={16} />
          <input
            value={props.locality}
            onChange={(e) => props.onLocality(e.target.value)}
            placeholder={mode === 'denied' ? 'Type your town' : 'Search for a town'}
            aria-label="Town or district"
          />
          <button type="submit" className="map-search-btn" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>



        {notice && <p className="map-notice" role="status">{notice}</p>}

        {mode === 'ready' && points.length >= 3 && (
          <div className="map-badge">
            <strong>{formatHa(areaHa)}</strong>
            <span>calculated</span>
          </div>
        )}
        {mode === 'invalid' && (
          <div className="map-badge"><strong>Check the outline</strong><span>{crossing ? 'It crosses itself' : 'Size out of range'}</span></div>
        )}
        {mode === 'drawing' && points.length > 0 && (
          <div className="map-badge"><strong>Outline open</strong><span>Continue or close it</span></div>
        )}

        {mode === 'empty' && (
          <div className="map-hint">
            <div>
              <p>Find your area and zoom in until you see your plot. Then press and hold on the map and follow its edge, or tap its corners.</p>
              <button type="button" className="primary-btn" onClick={startDrawing}>Draw plot</button>
            </div>
          </div>
        )}
        {mode === 'denied' && (
          <div className="map-hint">
            <div>
              <p>We could not use your location. Search for your town or enter how many hectares your plot has.</p>
              <div className="map-hint-actions">
                <button type="button" className="primary-btn" onClick={startDrawing}>Draw plot</button>
                <button type="button" className="ghost-btn" onClick={props.onTypeArea}>Enter hectares</button>
              </div>
            </div>
          </div>
        )}
        {activeDraw && (
          <p className={`map-tip map-draw-tip${traceStatus.nearStart ? ' map-draw-tip--close' : ''}`}>
            {mode === 'invalid' ? 'Press Undo to fix the last stroke or Clear to start over.' : traceStatus.tracing
              ? traceStatus.nearStart ? 'Release to close the outline' : 'Follow the edge back to the starting circle · Esc cancels'
              : points.length ? 'Continue from the last point or tap another corner' : 'Press and hold the map and trace the edge · You can also tap corners'}
          </p>
        )}
      </div>

      <div className="map-tools map-drawing-tools" aria-label="Outline tools">
        <div className="map-drawing-switch" role="group" aria-label="Map action">
          <button type="button" className={activeDraw ? 'tool tool--on' : 'tool'} aria-pressed={activeDraw} onClick={startDrawing}>
            <PencilIcon size={16} />{mode === 'ready' && points.length ? 'Edit outline' : 'Draw'}
          </button>
          <button type="button" className={!activeDraw ? 'tool tool--on' : 'tool'} aria-pressed={!activeDraw} onClick={() => { drawingRef.current?.cancel(); setTool('move'); setNotice(null); }}>
            <span aria-hidden="true">↔</span>Move map
          </button>
        </div>
        <button type="button" className="tool" onClick={undo} disabled={!undoCount && !points.length}>
          <UndoIcon size={16} />Undo
        </button>
        <button type="button" className="tool" onClick={clear} disabled={!points.length && !traceStatus.tracing}>
          <TrashIcon size={16} />Clear
        </button>
        <button type="button" className="tool tool--ghost map-area-fallback" onClick={() => { drawingRef.current?.cancel(); setTool('move'); resetHistory(); props.onTypeArea(); }}>
          Enter the plot size instead
        </button>
      </div>
        <div className="map-quick">
          <button type="button" className="map-chip" onClick={locate} disabled={locating}>{locating ? 'Locating…' : 'Use my location'}</button>
          <button type="button" className="map-chip map-chip--accent" onClick={useDemo}>Example plot in Ambo</button>
        </div>
      <p className="map-drawing-help" id="plot-drawing-help">
        {activeDraw
          ? 'Trace without lifting your finger or mouse and release near the start to close. If it stays open, continue from the last point or tap the starting point.'
          : 'Move and zoom the map to find your plot. Press Draw to trace its edge or tap its corners.'}
      </p>
    </div>
  );
}
