import { useEffect, useMemo, useRef, useState } from 'react';
import { useGuide } from '../assistant/GuideProvider';
import type {
  AlternativeType, EntryConditions, ExcludedCrop, ExclusionReason,
  FieldShiftApiError, PlotPoint, WaterMode,
} from '../types/fieldshift';
import { createPlot, isUsingMocks } from '../api/fieldshiftApi';
import { saveEntryConditions } from '../integration/entryContext';
import { PlotMap, type MapMode } from './PlotMap';
import { CropIllustration } from './CropIllustration';
import { Photo } from './Photo';
import { cropName } from '../lib/uiCopy';
import { checkPolygon, formatHa } from '../lib/plotGeometry';
import {
  AlertIcon, CalendarIcon, CheckIcon, ClockIcon, CoinsIcon, InfoIcon,
  LeafIcon, RainIcon, SproutIcon, WaterIcon,
} from './Icons';

const CROPS = ['Papa', 'Quinua', 'Cebada', 'Avena', 'Haba', 'Tarwi'];

const WATER_MODES: { id: WaterMode; label: string; hint: string }[] = [
  { id: 'rainfed', label: 'Only rain', hint: 'No irrigation available' },
  { id: 'scheduled', label: 'Scheduled irrigation', hint: 'I have water on some days' },
  { id: 'irrigated', label: 'Irrigation available', hint: 'I can irrigate when needed' },
];

const PRIORITIES: { id: AlternativeType; label: string; hint: string }[] = [
  { id: 'economy', label: 'Earn more money', hint: 'Focus on expected income' },
  { id: 'water', label: 'Save water', hint: 'Reduce water pressure' },
  { id: 'soil', label: 'Care for soil', hint: 'Choose a better soil fit' },
];

const REASONS: { id: ExclusionReason; label: string }[] = [
  { id: 'sin_comprador', label: 'I have no buyer' },
  { id: 'no_en_mi_zona', label: 'It does not grow locally' },
  { id: 'no_quiero', label: 'I prefer not to plant it' },
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
  const [startDate, setStartDate] = useState('2026-11-15');
  const [waterMode, setWaterMode] = useState<WaterMode>('scheduled');
  const [irrigationMm, setIrrigationMm] = useState('180');
  const [excluded, setExcluded] = useState<ExcludedCrop[]>([]);
  const [askingFor, setAskingFor] = useState<string | null>(null);
  const [priority, setPriority] = useState<AlternativeType>('water');

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

  const hasPlot = useTypedArea ? areaHa > 0 : (mode === 'ready' && check.valid);

  /** Lo que falta para poder comparar. El boton lo dice en vez de fallar al pulsarlo. */
  const blocker = (() => {
    if (mode === 'invalid') return 'Fix the plot outline';
    if (mode === 'drawing' && points.length < 3) return 'Add more corners to close the plot';
    if (mode === 'drawing') return 'Close the plot outline';
    if (!hasPlot) return denied ? 'Enter the location of your plot' : 'Draw your plot or enter its size';
    if (allowedCrops.length < 2) return 'Select at least two crops';
    if (waterMode !== 'rainfed' && !(Number(irrigationMm) > 0)) return 'Enter your irrigation amount';
    return null;
  })();

  function addPoint(p: PlotPoint) {
    if (closed) setClosed(false);
    if (!drawing) setDrawing(true);
    if (denied) setDenied(false);
    if (useTypedArea) setUseTypedArea(false);
    const prev = pointsRef.current;
    // Tocar cerca del primer punto cierra el contorno, como en cualquier editor de mapas.
    if (prev.length >= 3) {
      const first = prev[0];
      if (Math.hypot(first.x - p.x, first.y - p.y) < 14) {
        setClosed(true);
        setDrawing(false);
        return;
      }
    }
    setPoints([...prev, p]);
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
        excludedCrops: excluded,
        priority,
        horizon: 3,
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
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/"><LeafIcon />FieldShift</a>
        <nav className="steps"><strong>1&nbsp; Plot</strong><span>2&nbsp; Options</span><span>3&nbsp; Plan</span></nav>
      </header>

      <main className="entry-page">
        <section className="hero-row entry-hero entry-hero--photo">
          <Photo k="andenes" eager kenBurns={false} />
          <div>
            <span className="entry-kicker">Plan a better crop rotation for your plot</span>
            <h1>Plan your next planting</h1>
            <p>Enter your plot and farming conditions to compare income, water and soil options.</p>
          </div>
          {hasPlot && (
            <div className="parcel-meta">
              <div><CheckIcon />Plot area: {formatHa(areaHa)}</div>
              <small><InfoIcon size={14} />You can edit it before continuing</small>
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

        <div className="entry-grid">
          <div className="entry-map-col">
            <PlotMap
              mode={mode}
              points={points}
              areaHa={areaHa}
              crossing={check.crossing}
              locality={locality}
              onLocality={setLocality}
              onAddPoint={addPoint}
              onStartDraw={() => { setDrawing(true); setClosed(false); setDenied(false); setUseTypedArea(false); }}
              onUndoPoint={() => { setPoints(points.slice(0, -1)); setClosed(false); setDrawing(true); }}
              onClear={() => { setPoints([]); setClosed(false); setDrawing(false); setUseTypedArea(false); }}
              onTypeArea={() => { setUseTypedArea(true); setDrawing(false); setClosed(false); }}
            />

            {useTypedArea && (
              <div className="typed-area">
                <label htmlFor="typedArea">How many hectares is your plot?</label>
                <div className="typed-area-row">
                  <input
                    id="typedArea" type="number" min="0.05" max="50" step="0.1"
                    value={typedArea} onChange={(e) => setTypedArea(e.target.value)} placeholder="1.8"
                  />
                  <span>ha</span>
                  <button type="button" className="link-btn" onClick={() => { setUseTypedArea(false); setDrawing(true); }}>
                    I prefer to draw it
                  </button>
                </div>
                <p className="field-help">You can continue with the area and location, although a drawn plot outline provides more detail.</p>
              </div>
            )}

            {mode === 'drawing' && points.length >= 3 && (
              <button type="button" className="primary-btn wide" onClick={closePolygon}>Close the plot</button>
            )}

            {!denied && mode === 'empty' && (
              <button type="button" className="link-btn" onClick={() => setDenied(true)}>
                I cannot use my location
              </button>
            )}
          </div>

          <div className="entry-fields">
            <div className="field">
              <label>Previous crop</label>
              <div className="field-row2 field-row2--demo">
                <select value={previousCrop} disabled={unknownPrevious} onChange={(e) => setPreviousCrop(e.target.value)}>
                  {CROPS.map((c) => <option key={c} value={c}>{cropName(c)}</option>)}
                </select>
                <div className="input-with-icon demo-secondary">
                  <CalendarIcon size={16} />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
              <label className="checkline demo-secondary">
                <input type="checkbox" checked={unknownPrevious} onChange={(e) => setUnknownPrevious(e.target.checked)} />
                I don't know
              </label>
              {unknownPrevious && (
                <p className="field-help field-help--warn">
                  <InfoIcon size={14} />Without this information, the results may rely on less complete data.
                </p>
              )}
            </div>

            <div className="field">
              <label>How do you get water for your plot?</label>
              <div className="segmented">
                {WATER_MODES.map((m) => (
                  <button
                    key={m.id} type="button"
                    className={waterMode === m.id ? 'seg seg--on' : 'seg'}
                    onClick={() => setWaterMode(m.id)}
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
                    onChange={(e) => setIrrigationMm(e.target.value)} aria-label="Irrigation depth per season"
                  />
                  <span>mm per season</span>
                </div>
              )}
            </div>

            <div className="field demo-secondary">
              <label>Which crops could you plant?</label>
              <div className="chips">
                {CROPS.map((c) => {
                  const ex = excluded.find((e) => e.crop === c);
                  return (
                    <button key={c} type="button" className={ex ? 'chip chip--off chip--crop' : 'chip chip--crop'} onClick={() => toggleCrop(c)}>
                      <CropIllustration crop={c} size={26} />{cropName(c)}{ex && <small>{REASONS.find((r) => r.id === ex.reason)?.label}</small>}
                    </button>
                  );
                })}
              </div>
              {askingFor && (
                <div className="reason-box">
                  <p>Why can't you plant {cropName(askingFor)}?</p>
                  <div className="reason-options">
                    {REASONS.map((r) => (
                      <button key={r.id} type="button" className="ghost-btn" onClick={() => confirmExclusion(r.id)}>{r.label}</button>
                    ))}
                    <button type="button" className="link-btn" onClick={() => setAskingFor(null)}>Cancel</button>
                  </div>
                </div>
              )}
              <p className="field-help">Tap a crop to exclude it. You can explain why, and the system will use that condition.</p>
              {allowedCrops.length < 2 && (
                <p className="field-help field-help--warn">
                  <AlertIcon size={14} />A rotation requires at least two crops. Please select another.
                </p>
              )}
            </div>

            <div className="field">
              <label>What matters most to you?</label>
              <div className="priority-grid">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id} type="button"
                    className={priority === p.id ? 'priority-card priority-card--on' : 'priority-card'}
                    onClick={() => setPriority(p.id)}
                  >
                    {p.id === 'economy' ? <CoinsIcon /> : p.id === 'water' ? <WaterIcon /> : <SproutIcon />}
                    <strong>{p.label}</strong>
                    <small>{p.hint}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="submit-block">
              <button type="button" className="primary-btn wide" disabled={!!blocker || submitting} onClick={submit}>
                {submitting ? 'Comparing…' : 'Compare my options'}
              </button>
              {blocker && <p className="cta-why">{blocker}</p>}
              <p className="foot-note">Environmental inputs depend on the connected data service.{isUsingMocks() ? ' In demo mode, results are examples.' : ''}</p>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
