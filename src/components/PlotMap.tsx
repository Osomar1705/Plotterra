import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlotPoint } from '../types/fieldshift';
import { formatHa } from '../lib/plotGeometry';
import { INITIAL_VIEW } from '../lib/demoPlot';
import { PinIcon, UndoIcon, PencilIcon, TrashIcon } from './Icons';

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
  onStartDraw: () => void;
  onUndoPoint: () => void;
  onClear: () => void;
  onTypeArea: () => void;
  onUseDemo: () => void;
  onLocationDenied: () => void;
}

/** Distancia en pixeles para considerar que el toque cae sobre el primer punto. */
const CLOSE_RADIUS_PX = 18;
const GREEN = '#00a37a';
const RED = '#e5484d';

const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Imágenes © Esri, Maxar, Earthstar Geographics · Búsqueda © OpenStreetMap';

const toLatLng = (p: PlotPoint): L.LatLngTuple => [p.y, p.x];

export function PlotMap(props: Props) {
  const { mode, points, areaHa, crossing } = props;
  const drawable = mode !== 'ready';
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

    map.on('click', (ev: L.LeafletMouseEvent) => {
      const p = latest.current;
      if (p.mode === 'ready') return;
      const first = p.points[0];
      if (first && p.points.length >= 3) {
        const a = map.latLngToContainerPoint(toLatLng(first));
        const b = map.latLngToContainerPoint(ev.latlng);
        if (a.distanceTo(b) <= CLOSE_RADIUS_PX) {
          p.onAddPoint(first, true);
          return;
        }
      }
      // Un doble toque en el mismo sitio no debe crear un punto repetido.
      const last = p.points[p.points.length - 1];
      if (last && map.latLngToContainerPoint(toLatLng(last)).distanceTo(map.latLngToContainerPoint(ev.latlng)) < 6) return;
      p.onAddPoint({ x: ev.latlng.lng, y: ev.latlng.lat });
    });

    mapRef.current = map;
    // El contenedor puede medir distinto al montar (rejilla, fuentes): se recalcula.
    const t = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(t);
      // Si se sale de la Vista 01 durante una animacion de zoom (por ejemplo
      // justo despues de "Usar chacra de ejemplo"), Leaflet termina la
      // animacion 250 ms despues sobre un mapa ya destruido y lanza
      // "_leaflet_pos". Con la bandera en false ese cierre no hace nada.
      map.stop();
      (map as unknown as { _animatingZoom: boolean })._animatingZoom = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Redibuja el contorno cada vez que cambian los puntos o el estado.
  useEffect(() => {
    const layer = shapeLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const closed = mode === 'ready' || mode === 'invalid';
    const color = mode === 'invalid' ? RED : GREEN;
    const latlngs = points.map(toLatLng);
    if (latlngs.length > 1) {
      if (closed) L.polygon(latlngs, { color, weight: 3, fillColor: color, fillOpacity: 0.28 }).addTo(layer);
      else L.polyline(latlngs, { color, weight: 3, dashArray: '6 6' }).addTo(layer);
    }
    points.forEach((p, i) => {
      L.circleMarker(toLatLng(p), {
        radius: i === 0 && !closed ? 8 : 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1,
        interactive: false,
      }).addTo(layer);
    });
    if (crossing) L.circleMarker(toLatLng(crossing), { radius: 12, color: RED, weight: 3, fill: false, interactive: false }).addTo(layer);
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
        setNotice('No encontramos esa localidad. Prueba con el nombre del distrito o del caserío.');
      }
    } catch {
      setNotice('No pudimos buscar ahora. Puedes acercar el mapa a mano o usar la chacra de ejemplo.');
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
    <div className="plot-map">
      <div className="plot-canvas">
        <div
          ref={container}
          className={drawable ? 'map-leaflet map-leaflet--drawing' : 'map-leaflet'}
          role="application"
          aria-label="Mapa satelital para dibujar el contorno de la parcela"
        />

        <form className="map-search" onSubmit={search}>
          <PinIcon size={16} />
          <input
            value={props.locality}
            onChange={(e) => props.onLocality(e.target.value)}
            placeholder={mode === 'denied' ? 'Escribe tu localidad' : 'Buscar localidad'}
            aria-label="Localidad"
          />
          <button type="submit" className="map-search-btn" disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button>
        </form>

        <div className="map-quick">
          <button type="button" className="map-chip" onClick={locate} disabled={locating}>{locating ? 'Ubicando…' : 'Usar mi ubicación'}</button>
          <button type="button" className="map-chip map-chip--accent" onClick={props.onUseDemo}>Usar chacra de ejemplo de Ambo</button>
        </div>

        {notice && <p className="map-notice">{notice}</p>}

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
              <p>Busca tu zona y acerca el mapa hasta ver tu chacra. Luego toca sus esquinas para dibujarla.</p>
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
          <p className="map-tip">Toca cada esquina. Toca el primer punto para cerrar la parcela.</p>
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
