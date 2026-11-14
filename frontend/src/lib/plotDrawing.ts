import L from 'leaflet';
import type { PlotPoint } from '../types/fieldshift';
import { checkPolygon, findSelfIntersection } from './plotGeometry';
import {
  canSnapClosed, distance, prepareTrace, TRACE_CLOSE_PX, TRACE_CONTINUE_PX,
  TRACE_MAX_SAMPLES, TRACE_SAMPLE_PX, type ScreenPoint,
} from './freehandTrace';

interface DrawingState { points: PlotPoint[]; mode: string }
export interface TraceStatus { tracing: boolean; nearStart: boolean }
interface Options {
  getState: () => DrawingState;
  onPoint: (point: PlotPoint, close: boolean) => void;
  onTrace: (points: PlotPoint[], closed: boolean) => void;
  onStatus: (status: TraceStatus) => void;
  onNotice: (message: string | null) => void;
}

interface Gesture {
  id: number;
  start: ScreenPoint;
  raw: ScreenPoint[];
  base: ScreenPoint[];
  moved: boolean;
  continues: boolean;
  outside: boolean;
  overflow: boolean;
}

/** Una sola fuente de eventos de puntero; no mezcla click de Leaflet y pointerup. */
export function installPlotDrawing(map: L.Map, element: HTMLElement, options: Options) {
  const preview = L.layerGroup().addTo(map);
  let enabled = false;
  let gesture: Gesture | null = null;
  let frame = 0;
  let lastNear = false;

  const project = (p: PlotPoint): ScreenPoint => map.latLngToContainerPoint([p.y, p.x]);
  const unproject = (p: ScreenPoint): PlotPoint => {
    const ll = map.containerPointToLatLng(L.point(p.x, p.y));
    return { x: ll.lng, y: ll.lat };
  };
  const toLatLng = (p: ScreenPoint): L.LatLngTuple => {
    const ll = map.containerPointToLatLng(L.point(p.x, p.y));
    return [ll.lat, ll.lng];
  };
  const local = (ev: PointerEvent): ScreenPoint => {
    const rect = element.getBoundingClientRect();
    return { x: ev.clientX - rect.left - element.clientLeft, y: ev.clientY - rect.top - element.clientTop };
  };
  const inside = (p: ScreenPoint) => p.x >= 0 && p.y >= 0 && p.x <= element.clientWidth && p.y <= element.clientHeight;

  function navigation() {
    // Durante el trazo el encuadre no puede cambiar por rueda, teclado o doble clic.
    const idle = !gesture;
    if (!enabled && idle) map.dragging.enable(); else map.dragging.disable();
    if (idle) { map.scrollWheelZoom.enable(); map.touchZoom.enable(); map.keyboard.enable(); }
    else { map.scrollWheelZoom.disable(); map.touchZoom.disable(); map.keyboard.disable(); }
    if (!enabled && idle) map.doubleClickZoom.enable(); else map.doubleClickZoom.disable();
    element.style.touchAction = enabled ? 'none' : '';
  }

  function render() {
    frame = 0;
    preview.clearLayers();
    if (!gesture?.moved || !gesture.continues) return;
    const path = [...gesture.base, ...gesture.raw.slice(gesture.base.length ? 1 : 0)];
    const near = canSnapClosed(path);
    if (near !== lastNear) {
      lastNear = near;
      options.onStatus({ tracing: true, nearStart: near });
    }
    const color = near ? '#51DEC2' : '#F9FCF6';
    L.polyline(path.map(toLatLng), { color: '#0A3E45', weight: 7, opacity: 0.9, interactive: false }).addTo(preview);
    L.polyline(path.map(toLatLng), { color, weight: 3, interactive: false }).addTo(preview);
    if (near) L.polygon(path.map(toLatLng), { color: '#51DEC2', weight: 1, dashArray: '5 5', fillOpacity: 0.16, interactive: false }).addTo(preview);
    L.circleMarker(toLatLng(path[0]), {
      radius: TRACE_CLOSE_PX, color: near ? '#51DEC2' : '#fff', weight: 2,
      dashArray: near ? undefined : '4 4', fillColor: '#006B57', fillOpacity: near ? 0.3 : 0.1, interactive: false,
    }).addTo(preview);
  }

  function clearGesture() {
    const id = gesture?.id;
    gesture = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    preview.clearLayers();
    if (id !== undefined && element.hasPointerCapture(id)) element.releasePointerCapture(id);
    lastNear = false;
    options.onStatus({ tracing: false, nearStart: false });
    navigation();
  }

  function cancel(message?: string) {
    if (!gesture) return;
    clearGesture();
    if (message) options.onNotice(message);
  }

  function down(ev: PointerEvent) {
    if (!enabled || options.getState().mode === 'ready' || ev.button !== 0) return;
    if (gesture) { cancel('Trazo cancelado. Usa un solo dedo o el botón izquierdo del mouse.'); return; }
    if (!ev.isPrimary || (ev.target instanceof Element && ev.target.closest('.leaflet-control'))) return;
    ev.preventDefault();
    ev.stopPropagation();
    map.stop();
    const start = local(ev);
    const base = options.getState().points.map(project);
    gesture = {
      id: ev.pointerId, start, raw: [start], base, moved: false,
      continues: !base.length || distance(base[base.length - 1], start) <= TRACE_CONTINUE_PX,
      outside: false, overflow: false,
    };
    options.onNotice(null);
    element.setPointerCapture(ev.pointerId);
    navigation();
  }

  function move(ev: PointerEvent) {
    const g = gesture;
    if (!g || ev.pointerId !== g.id) return;
    ev.preventDefault();
    ev.stopPropagation();
    const p = local(ev);
    if (!inside(p)) { g.outside = true; return; }
    if (!g.moved && distance(g.start, p) >= 6) {
      g.moved = true;
      options.onStatus({ tracing: true, nearStart: false });
      if (!g.continues) options.onNotice('Continúa desde el último punto o pulsa Borrar para empezar otro contorno.');
    }
    if (distance(g.raw[g.raw.length - 1], p) >= TRACE_SAMPLE_PX) {
      if (g.raw.length >= TRACE_MAX_SAMPLES) { g.overflow = true; return; }
      g.raw.push(p);
    }
    if (!frame) frame = requestAnimationFrame(render);
  }

  function up(ev: PointerEvent) {
    const g = gesture;
    if (!g || ev.pointerId !== g.id) return;
    ev.preventDefault();
    ev.stopPropagation();
    const end = local(ev);
    const endInside = inside(end);
    const moved = g.moved || distance(g.start, end) >= 6;
    if (endInside && distance(g.raw[g.raw.length - 1], end) >= 0.1) g.raw.push(end);
    clearGesture();
    if (!endInside || g.outside) { options.onNotice('El trazo salió del mapa. Vuelve a dibujarlo sin salir del recuadro. Tu contorno anterior se conserva.'); return; }
    if (g.overflow) { options.onNotice('El trazo es demasiado largo. Inténtalo de nuevo siguiendo solo el borde de tu parcela.'); return; }
    if (!moved) {
      const points = options.getState().points;
      const first = points[0], last = points[points.length - 1];
      if (first && points.length >= 3 && distance(project(first), end) <= 18) {
        options.onPoint(first, true);
        options.onNotice('Contorno cerrado. Revisa la superficie antes de continuar.');
      } else if (!last || distance(project(last), end) >= 6) {
        options.onPoint(unproject(end), false);
      }
      return;
    }
    if (!g.continues) return;
    const result = prepareTrace([...g.base, ...g.raw.slice(g.base.length ? 1 : 0)]);
    if (result.error) { options.onNotice(result.error); return; }
    const points = result.points.map(unproject);
    options.onTrace(points, result.closed);
    const check = result.closed ? checkPolygon(points) : null;
    if (!result.closed && findSelfIntersection(points, false)) options.onNotice('El trazo se cruza. Pulsa Deshacer para retirar la última pasada, o Borrar para empezar de nuevo.');
    else if (check?.code) options.onNotice(check.code === 'POLIGONO_INVALIDO'
      ? 'El contorno se cruza. Pulsa Deshacer para retirar la última pasada, o Borrar para empezar de nuevo.'
      : check.farmerMessage ?? 'Revisa el contorno antes de continuar.');
    else options.onNotice(result.closed
      ? 'Contorno cerrado automáticamente. Revisa la superficie antes de continuar.'
      : 'Trazo guardado. Continúa desde el último punto o pulsa Cerrar parcela.');
  }

  const escape = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && gesture) { ev.preventDefault(); cancel('Trazo cancelado. Tu contorno anterior se conserva.'); }
  };
  const lost = (ev: PointerEvent) => { if (gesture?.id === ev.pointerId) cancel('Se interrumpió el trazo. Tu contorno anterior se conserva.'); };
  const blur = () => cancel('Se interrumpió el trazo. Tu contorno anterior se conserva.');
  const moving = () => cancel('El mapa cambió de posición. Vuelve a trazar el contorno.');
  const wheel = (ev: WheelEvent) => { if (gesture) { ev.preventDefault(); ev.stopPropagation(); } };
  const click = (ev: MouseEvent) => {
    if (enabled && !(ev.target instanceof Element && ev.target.closest('.leaflet-control'))) { ev.preventDefault(); ev.stopPropagation(); }
  };

  element.addEventListener('pointerdown', down, true);
  element.addEventListener('pointermove', move, true);
  element.addEventListener('pointerup', up, true);
  element.addEventListener('pointercancel', lost, true);
  element.addEventListener('lostpointercapture', lost, true);
  element.addEventListener('click', click, true);
  element.addEventListener('wheel', wheel, { capture: true, passive: false });
  window.addEventListener('keydown', escape);
  window.addEventListener('blur', blur);
  map.on('movestart zoomstart', moving);

  return {
    setEnabled(value: boolean) { if (enabled !== value) cancel(); enabled = value; navigation(); },
    cancel,
    destroy() {
      cancel();
      element.removeEventListener('pointerdown', down, true);
      element.removeEventListener('pointermove', move, true);
      element.removeEventListener('pointerup', up, true);
      element.removeEventListener('pointercancel', lost, true);
      element.removeEventListener('lostpointercapture', lost, true);
      element.removeEventListener('click', click, true);
      element.removeEventListener('wheel', wheel, true);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('blur', blur);
      map.off('movestart zoomstart', moving);
      preview.remove();
      element.style.touchAction = '';
    },
  };
}
