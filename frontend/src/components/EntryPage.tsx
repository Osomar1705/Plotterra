import { useEffect, useMemo, useRef, useState } from 'react';
import { useGuide } from '../assistant/GuideProvider';
import type {
  AlternativeType, EntryConditions, ExcludedCrop, ExclusionReason,
  FieldShiftApiError, PlotPoint, WaterMode,
} from '../types/fieldshift';
import { createPlot } from '../api/fieldshiftApi';
import { saveEntryConditions } from '../integration/entryContext';
import { PlotMap, type MapMode } from './PlotMap';
import { AndeanLandscape, CropIllustration } from './CropIllustration';
import { checkPolygon, formatHa } from '../lib/plotGeometry';
import '../styles/parcel-experience.css';
import { DEMO_PLOT_LOCALITY, DEMO_PLOT_POINTS } from '../lib/demoPlot';
import {
  AlertIcon, CalendarIcon, CheckIcon, ClockIcon, CoinsIcon, InfoIcon,
  LeafIcon, PlusIcon, RainIcon, SproutIcon, WaterIcon,
} from './Icons';

const CROPS = ['Papa', 'Quinua', 'Cebada', 'Avena', 'Haba', 'Tarwi'];

/** Fecha de hoy como YYYY-MM-DD en la zona del navegador (no en UTC). */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WATER_MODES: { id: WaterMode; label: string; hint: string }[] = [
  { id: 'rainfed', label: 'Solo lluvia', hint: 'Sin riego, dependo de la lluvia' },
  { id: 'scheduled', label: 'Riego por turnos', hint: 'Me toca riego algunos días' },
  { id: 'irrigated', label: 'Riego disponible', hint: 'Puedo regar cuando lo necesito' },
];

const PRIORITIES: { id: AlternativeType; label: string; hint: string }[] = [
  { id: 'economy', label: 'Economía', hint: 'El mayor margen posible' },
  { id: 'water', label: 'Agua', hint: 'Resistir una campaña seca' },
  { id: 'soil', label: 'Suelo', hint: 'Cuidar el terreno a futuro' },
];

const REASONS: { id: ExclusionReason; label: string }[] = [
  { id: 'sin_comprador', label: 'No tengo comprador' },
  { id: 'no_en_mi_zona', label: 'No se da en mi zona' },
  { id: 'no_quiero', label: 'No quiero sembrarlo' },
];

export function EntryPage() {
  const {setPage,setParcel}=useGuide();
  useEffect(()=>{setPage('parcel')},[setPage]);
  // --- parcela ---
  const [points, setPointsState] = useState<PlotPoint[]>([]);
  // Espejo sincrono de los puntos: varios clics seguidos llegan antes de que React
  // vuelva a renderizar, y leer el estado directamente perderia puntos.
  const pointsRef = useRef<PlotPoint[]>([]);
  const setPoints = (next: PlotPoint[]) => { pointsRef.current = next; setPointsState(next); };
  const [drawing, setDrawing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [typedArea, setTypedArea] = useState<string>('');
  const [useTypedArea, setUseTypedArea] = useState(false);
  const [locality, setLocality] = useState('Ambo, Huánuco');

  // --- condiciones ---
  const [previousCrop, setPreviousCrop] = useState('Papa');
  const [unknownPrevious, setUnknownPrevious] = useState(false);
  // Hoy en hora local: una fecha fija dejaba el formulario roto en cuanto pasaba
  // ese dia (el backend rechaza fechas anteriores a hoy).
  const [startDate, setStartDate] = useState(todayIso);
  const [waterMode, setWaterMode] = useState<WaterMode>('scheduled');
  const [irrigationMm, setIrrigationMm] = useState('180');
  const [excluded, setExcluded] = useState<ExcludedCrop[]>([]);
  const [askingFor, setAskingFor] = useState<string | null>(null);
  const [priority, setPriority] = useState<AlternativeType>('water');
  const [extraOpen, setExtraOpen] = useState(false);
  const [usualPlan, setUsualPlan] = useState('');

  const [mobilePanel, setMobilePanel] = useState<'map' | 'conditions'>('map');
  const panelHeading = useRef<HTMLHeadingElement>(null);

  function showPanel(panel: 'map' | 'conditions') {
    setMobilePanel(panel);
    requestAnimationFrame(() => panelHeading.current?.focus());
  }

  // --- envio ---
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FieldShiftApiError | null>(null);

  const check = useMemo(() => checkPolygon(points), [points]);
  const areaHa = useTypedArea ? Number(typedArea) || 0 : check.areaHa;
  const allowedCrops = CROPS.filter((c) => !excluded.some((e) => e.crop === c));

  const mode: MapMode = (() => {
    if (useTypedArea) return 'ready';
    if (denied && points.length === 0) return 'denied';
    if (closed && check.code) return 'invalid';
    if (closed) return 'ready';
    if (drawing || points.length > 0) return 'drawing';
    return 'empty';
  })();

  const hasPlot = useTypedArea ? Number.isFinite(areaHa) && areaHa >= 0.05 && areaHa <= 50 : (mode === 'ready' && check.valid);

  /** Lo que falta para poder comparar. El boton lo dice en vez de fallar al pulsarlo. */
  const blocker = (() => {
    if (mode === 'invalid') return 'Corrige el contorno de tu parcela';
    if (mode === 'drawing' && points.length < 3) return 'Faltan puntos para cerrar el contorno';
    if (mode === 'drawing') return 'Cierra el contorno de tu parcela';
    if (useTypedArea && !hasPlot) return 'Escribe una superficie entre 0,05 y 50 hectáreas';
    if (!hasPlot) return denied ? 'Falta ubicar tu parcela' : 'Falta dibujar tu parcela';
    if (!startDate || startDate < todayIso()) return 'Elige hoy o una fecha posterior para sembrar';
    if (allowedCrops.length < 2) return 'Habilita al menos dos cultivos';
    if (waterMode !== 'rainfed' && !(Number(irrigationMm) > 0 && Number(irrigationMm) <= 1200)) return 'Indica un riego mayor que 0 y hasta 1200 mm por campaña';
    return null;
  })();

  function addPoint(p: PlotPoint, closesShape = false) {
    if (closed) setClosed(false);
    if (!drawing) setDrawing(true);
    if (denied) setDenied(false);
    if (useTypedArea) setUseTypedArea(false);
    const prev = pointsRef.current;
    // Tocar el primer punto cierra el contorno, como en cualquier editor de mapas.
    // El mapa decide la cercania en pixeles, porque en grados depende del zoom.
    if (closesShape && prev.length >= 3) {
      setClosed(true);
      setDrawing(false);
      return;
    }
    setPoints([...prev, p]);
  }

  function loadDemoPlot() {
    setPoints([...DEMO_PLOT_POINTS]);
    setClosed(true);
    setDrawing(false);
    setDenied(false);
    setUseTypedArea(false);
    setLocality(DEMO_PLOT_LOCALITY);
  }

  function closePolygon() {
    if (points.length < 3) return;
    setClosed(true);
    setDrawing(false);
  }

  function toggleCrop(crop: string) {
    const already = excluded.find((e) => e.crop === crop);
    if (already) { setExcluded(excluded.filter((e) => e.crop !== crop)); return; }
    setAskingFor(crop);
  }

  function confirmExclusion(reason: ExclusionReason) {
    if (!askingFor) return;
    setExcluded([...excluded, { crop: askingFor, reason }]);
    setAskingFor(null);
  }

  useEffect(()=>{setParcel({areaHa,locality,previousCrop:unknownPrevious?undefined:previousCrop,waterMode,irrigationMm:Number(irrigationMm)||undefined,priority})},[setParcel,areaHa,locality,previousCrop,unknownPrevious,waterMode,irrigationMm,priority]);

  async function submit() {
    if (blocker || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const plot = await createPlot({
        points: useTypedArea ? [] : points,
        declaredAreaHa: useTypedArea ? Number(typedArea) : undefined,
        locality,
      });
      const conditions: EntryConditions = {
        plotId: plot.id,
        areaHa: plot.areaHa,
        startDate,
        previousCrop: unknownPrevious ? undefined : previousCrop.toLowerCase(),
        waterMode,
        irrigationMm: waterMode === 'rainfed' ? 0 : Number(irrigationMm),
        allowedCrops: allowedCrops.map((c) => c.toLowerCase()),
        excludedCrops: excluded.map((e) => ({ ...e, crop: e.crop.toLowerCase() })),
        priority,
        horizon: 3,
        usualPlan: usualPlan ? usualPlan.split(/[,>→-]+/).map((s) => s.trim().toLowerCase()).filter(Boolean) : undefined,
        dataQualityHint: unknownPrevious ? 'limited' : 'sufficient',
      };
      saveEntryConditions(conditions);
      window.history.pushState({}, '', '/opciones');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (e) {
      setError(e as FieldShiftApiError);
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell parcel-experience" data-mobile-panel={mobilePanel}>
      <header className="topbar">
        <a className="brand" href="/"><LeafIcon />FieldShift</a>
        <nav className="steps"><strong>1&nbsp; Parcela</strong><span>2&nbsp; Opciones</span><span>3&nbsp; Plan</span></nav>
      </header>

      <main className="entry-page">
        <h2 className="parcel-sr-only" ref={panelHeading} tabIndex={-1}>{mobilePanel === 'map' ? 'Ubica tu parcela' : 'Prepara tu campaña'}</h2>
        <section className="hero-row entry-hero">
          <AndeanLandscape className="entry-hero-art" tone="day" />
          <div>
            <span className="entry-kicker">Prueba tu siembra en 100 futuros antes de comprometer tu parcela</span>
            <h1>Prepara tu próxima siembra</h1>
            <p>Dibuja tu parcela, confirma tres datos de tu campaña y compara alternativas para economía, agua y suelo.</p>
          </div>
          {hasPlot && (
            <div className="parcel-meta">
              <div><CheckIcon />Parcela de {formatHa(areaHa)}</div>
              <small><InfoIcon size={14} />Puedes corregirla antes de continuar</small>
            </div>
          )}
        </section>

        {mode === 'invalid' && (
          <div className="error-banner">
            <div><AlertIcon /><span>{check.farmerMessage}</span></div>
          </div>
        )}
        {error && (
          <div className="error-banner">
            <div><AlertIcon /><span>{error.farmerMessage}</span></div>
            {error.runId && <small>run_id: {error.runId}</small>}
          </div>
        )}

        <nav className="parcel-mobile-nav" aria-label="Preparar la parcela">
          <button type="button" aria-current={mobilePanel === 'map' ? 'step' : undefined} onClick={() => showPanel('map')}>1. Tu parcela{hasPlot ? ' ✓' : ''}</button>
          <button type="button" aria-current={mobilePanel === 'conditions' ? 'step' : undefined} onClick={() => showPanel('conditions')}>2. Tu campaña</button>
        </nav>
        <div className="entry-grid">
          <section className="entry-map-col" aria-label="Tu parcela">
            <div className="parcel-section-title"><span>01</span><h2>Ubica y dibuja tu parcela</h2></div>
            <PlotMap
              mode={mode}
              points={useTypedArea ? [] : points}
              areaHa={areaHa}
              crossing={useTypedArea ? null : check.crossing}
              locality={locality}
              onLocality={setLocality}
              onAddPoint={addPoint}
              onReplacePoints={(next, isClosed) => {
                setPoints(next); setClosed(isClosed); setDrawing(!isClosed);
                setDenied(false); setUseTypedArea(false);
              }}
              onStartDraw={() => { setDrawing(true); setClosed(false); setDenied(false); setUseTypedArea(false); }}
              onUndoPoint={() => { setPoints(points.slice(0, -1)); setClosed(false); setDrawing(true); }}
              onClear={() => { setPoints([]); setClosed(false); setDrawing(false); setUseTypedArea(false); }}
              onTypeArea={() => { setUseTypedArea(true); setDrawing(false); setClosed(false); }}
              onUseDemo={loadDemoPlot}
              onLocationDenied={() => setDenied(true)}
            />

            {useTypedArea && (
              <div className="typed-area">
                <label htmlFor="typedArea">¿Cuántas hectáreas tiene tu parcela?</label>
                <div className="typed-area-row">
                  <input
                    id="typedArea" type="number" min="0.05" max="50" step="0.1"
                    value={typedArea} onChange={(e) => setTypedArea(e.target.value)} placeholder="1.8"
                  />
                  <span>ha</span>
                  <button type="button" className="link-btn" onClick={() => { setUseTypedArea(false); setDrawing(true); }}>
                    Prefiero dibujarla
                  </button>
                </div>
                <p className="field-help">Con la superficie y tu localidad podemos trabajar, aunque el resultado será menos preciso que con el contorno dibujado.</p>
              </div>
            )}

            {mode === 'drawing' && points.length >= 3 && (
              <button type="button" className="primary-btn wide" onClick={closePolygon}>Cerrar parcela</button>
            )}

            {!denied && mode === 'empty' && (
              <button type="button" className="link-btn" onClick={() => setDenied(true)}>
                No puedo usar mi ubicación
              </button>
            )}
            <button type="button" className="primary-btn parcel-next" disabled={!hasPlot} onClick={() => showPanel('conditions')}>Continuar con mi campaña →</button>
          </section>

          <section className="entry-fields" aria-label="Condiciones de la campaña">
            <div className="parcel-section-title"><span>02</span><h2>Prepara tu campaña</h2></div>
            <details className="parcel-question" name="campaign-questions" open><summary><span>1</span>¿Qué sembraste antes?</summary><div className="parcel-question-body"><div className="field">
              <label htmlFor="previous-crop">Cultivo anterior</label>
              <div className="field-row2 field-row2--demo">
                <select id="previous-crop" value={previousCrop} disabled={unknownPrevious} onChange={(e) => setPreviousCrop(e.target.value)}>
                  {CROPS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <div className="input-with-icon demo-secondary">
                  <CalendarIcon size={16} />
                  <input aria-label="Fecha de inicio de la siembra" type="date" min={todayIso()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
              <label className="checkline demo-secondary">
                <input type="checkbox" checked={unknownPrevious} onChange={(e) => setUnknownPrevious(e.target.checked)} />
                No lo sé
              </label>
              {unknownPrevious && (
                <p className="field-help field-help--warn">
                  <InfoIcon size={14} />Sin este dato, la calidad de la información bajará a limitada.
                </p>
              )}
            </div></div></details>

            <details className="parcel-question" name="campaign-questions"><summary><span>2</span>¿Cómo recibe agua tu parcela?</summary><div className="parcel-question-body"><div className="field">
              <label>Agua disponible</label>
              <div className="segmented">
                {WATER_MODES.map((m) => (
                  <button
                    key={m.id} type="button"
                    className={waterMode === m.id ? 'seg seg--on' : 'seg'}
                    aria-pressed={waterMode === m.id} onClick={() => setWaterMode(m.id)}
                  >
                    {m.id === 'rainfed' ? <RainIcon size={16} /> : m.id === 'scheduled' ? <ClockIcon size={16} /> : <WaterIcon size={16} />}
                    <strong>{m.label}</strong>
                    <small>{m.hint}</small>
                  </button>
                ))}
              </div>
              {waterMode !== 'rainfed' && (
                <div className="input-with-suffix demo-secondary">
                  <input
                    type="number" min="0" max="1200" value={irrigationMm}
                    onChange={(e) => setIrrigationMm(e.target.value)} aria-label="Agua de riego por campaña"
                  />
                  <span>mm por campaña</span>
                </div>
              )}
              {waterMode !== 'rainfed' && <p className="field-help">1 mm equivale a 1 litro de agua por metro cuadrado. Indica el total de riego para una campaña.</p>}
            </div></div></details>

            <details className="parcel-question" name="campaign-questions"><summary><span>3</span>¿Qué cultivos puedes sembrar?</summary><div className="parcel-question-body"><div className="field">
              <label>Cultivos que puedes sembrar</label>
              <div className="chips">
                {CROPS.map((c) => {
                  const ex = excluded.find((e) => e.crop === c);
                  return (
                    <button key={c} type="button" className={ex ? 'chip chip--off chip--crop' : 'chip chip--crop'} aria-pressed={!ex} onClick={() => toggleCrop(c)}>
                      <CropIllustration crop={c} size={26} />{c}{ex && <small>{REASONS.find((r) => r.id === ex.reason)?.label}</small>}
                    </button>
                  );
                })}
              </div>
              {askingFor && (
                <div className="reason-box">
                  <p>¿Por qué no puedes sembrar {askingFor}?</p>
                  <div className="reason-options">
                    {REASONS.map((r) => (
                      <button key={r.id} type="button" className="ghost-btn" onClick={() => confirmExclusion(r.id)}>{r.label}</button>
                    ))}
                    <button type="button" className="link-btn" onClick={() => setAskingFor(null)}>Cancelar</button>
                  </div>
                </div>
              )}
              <p className="field-help">Toca uno para excluirlo. Te preguntaremos por qué: eso también entra en el cálculo.</p>
              {allowedCrops.length < 2 && (
                <p className="field-help field-help--warn">
                  <AlertIcon size={14} />Con un solo cultivo no se puede armar una rotación. Habilita al menos uno más.
                </p>
              )}
            </div></div></details>

            <details className="parcel-question" name="campaign-questions"><summary><span>4</span>¿Qué quieres cuidar más?</summary><div className="parcel-question-body"><div className="field">
              <label>¿Qué te importa más esta campaña?</label>
              <div className="priority-grid">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id} type="button"
                    className={priority === p.id ? 'priority-card priority-card--on' : 'priority-card'}
                    aria-pressed={priority === p.id} onClick={() => setPriority(p.id)}
                  >
                    {p.id === 'economy' ? <CoinsIcon /> : p.id === 'water' ? <WaterIcon /> : <SproutIcon />}
                    <strong>{p.label}</strong>
                    <small>{p.hint}</small>
                  </button>
                ))}
              </div>
            </div></div></details>

            <div className="disclosure">
              <button type="button" className="disclosure-head" aria-expanded={extraOpen} onClick={() => setExtraOpen(!extraOpen)}>
                <span><PlusIcon size={16} />Mi plan habitual y datos adicionales</span>
                <small>Opcional · mejora la precisión</small>
              </button>
              {extraOpen && (
                <div className="disclosure-body">
                  <label htmlFor="usual">¿Qué sueles sembrar en estas tres campañas?</label>
                  <input
                    id="usual" value={usualPlan} onChange={(e) => setUsualPlan(e.target.value)}
                    placeholder="Papa, Papa, Cebada"
                  />
                  <p className="field-help">Con esto comparamos tu plan actual contra las alternativas, bajo los mismos escenarios.</p>
                </div>
              )}
            </div>

            <div className="submit-block">
              <button type="button" className="link-btn parcel-back" onClick={() => showPanel('map')}>← Volver a mi parcela</button>
              <button type="button" className="primary-btn wide" disabled={!!blocker || submitting} onClick={submit}>
                {submitting ? 'Comparando…' : 'Comparar mis opciones'}
              </button>
              {blocker && <p className="cta-why">{blocker}</p>}
            </div>
            {/* Fuera de la barra fija: dentro, la barra media 177 px y tapaba las preguntas. */}
            <p className="foot-note">NASA + MIDAGRI · Los datos ambientales se incorporan automáticamente al análisis.</p>
          </section>
        </div>
      </main>

    </div>
  );
}
