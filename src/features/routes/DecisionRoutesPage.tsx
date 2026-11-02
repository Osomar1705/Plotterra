import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  Alternative,
  AlternativeKind,
  AlternativePassport,
  Campaign,
  Comparison,
  FieldShiftApiError,
  MetricValue,
} from '../../types/fieldshift';
import { getAlternativePassport, getComparison, isUsingMocks } from '../../api/fieldshiftApi';
import { FanGraph } from './FanGraph';
import { PeacockMark } from './PeacockMark';
import { LeafIcon } from '../../components/Icons';
import './decision-routes.css';

const routeMeta: Record<AlternativeKind, {
  name: string;
  label: string;
  focus: string;
  tradeoff: string;
  color: string;
}> = {
  economy: {
    name: 'Economía',
    label: 'Prioriza el margen',
    focus: 'Mayor margen estimado',
    tradeoff: 'El criterio económico no garantiza menor demanda de agua ni una rotación más compatible. Contrasta los indicadores hídrico y agronómico.',
    color: '#006B57',
  },
  water: {
    name: 'Agua',
    label: 'Prioriza el criterio hídrico',
    focus: 'Prioriza la gestión del agua',
    tradeoff: 'Reducir el riego aportado no significa que disminuya la demanda del cultivo ni garantiza evitar el déficit hídrico. Contrasta rendimiento, margen y riesgo.',
    color: '#155D8B',
  },
  soil: {
    name: 'Suelo',
    label: 'Prioriza la compatibilidad',
    focus: 'Compatibilidad agronómica de la rotación',
    tradeoff: 'La compatibilidad de rotación no equivale a un aumento medido de fertilidad. Revisa también los límites económicos e hídricos.',
    color: '#007F86',
  },
  unknown: {
    name: 'Alternativa',
    label: 'Criterio por confirmar',
    focus: 'Estrategia devuelta por el motor',
    tradeoff: 'El motor no identificó el criterio de esta alternativa. Revisa sus indicadores y supuestos antes de compararla.',
    color: '#66777B',
  },
};

const riskLabel: Record<string, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  unknown: 'Por confirmar',
};
const qualityLabel: Record<string, string> = {
  sufficient: 'Información suficiente',
  limited: 'Información limitada',
  insufficient: 'Información insuficiente',
  unknown: 'Calidad por confirmar',
};

const soilLabel: Record<string, string> = {
  compatible: 'Compatible',
  high: 'Alta compatibilidad',
  medium: 'Compatibilidad media',
  low: 'Baja compatibilidad',
  unknown: 'Por confirmar',
};

function waterMetricLabel(metric: string) {
  if (metric === 'demand') return 'Demanda de agua';
  if (metric === 'deficit') return 'Déficit hídrico';
  if (metric === 'irrigation') return 'Riego aportado';
  return 'Indicador hídrico';
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(value);
}

function formatMoneyRange(alternative: Alternative) {
  const { min, max, currency, basis } = alternative.margin;
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) return 'No disponible';
  let amount: string;
  try {
    amount = new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: currency || 'PEN',
      maximumFractionDigits: 0,
    }).format(min) + ' – ' + new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: currency || 'PEN',
      maximumFractionDigits: 0,
    }).format(max);
  } catch {
    amount = `${currency} ${formatNumber(min)} – ${currency} ${formatNumber(max)}`;
  }
  const unit = basis === 'ha' ? 'por ha' : basis === 'plot' ? 'por parcela' : `base ${basis}`;
  return `${amount} ${unit}${alternative.margin.period ? ` · ${alternative.margin.period}` : ''}`;
}

function metricText(metric?: MetricValue | null) {
  if (!metric || metric.status === 'unavailable' || metric.value === null) return 'No disponible';
  const value = typeof metric.value === 'number' ? formatNumber(metric.value) : metric.value;
  return [value, metric.unit].filter(Boolean).join(' ');
}

function metricStatusLabel(metric?: MetricValue | null) {
  if (!metric || metric.status === 'unavailable' || metric.value === null) return 'Sin dato';
  if (metric.status === 'mock') return 'Demostración';
  if (metric.status === 'provisional') return 'Provisional';
  return 'Disponible';
}

function routeCounterpoints(alternative: Alternative) {
  return [
    { label: 'Margen estimado de la ruta', value: formatMoneyRange(alternative) },
    {
      label: waterMetricLabel(alternative.water.metric),
      value: alternative.water.value === null
        ? 'No disponible'
        : `${formatNumber(alternative.water.value)} ${alternative.water.unit}${alternative.water.period ? ` · ${alternative.water.period}` : ''}`,
    },
    {
      label: 'Compatibilidad de rotación',
      value: soilLabel[alternative.soil.compatibility] ?? alternative.soil.compatibility ?? 'Por confirmar',
    },
  ];
}

function errorMessage(error: unknown) {
  const apiError = error as Partial<FieldShiftApiError> | null;
  return apiError?.farmerMessage || 'No pudimos cargar las rutas. Inténtalo nuevamente.';
}

function readablePlotId(id?: string) {
  if (!id || id === 'unknown') return 'Tu parcela';
  return id.replace(/[_-]+/g, ' ');
}

function updateAddress(comparisonId: string, alternativeId: string, campaignIndex: number) {
  window.history.replaceState(
    {},
    '',
    `/plan?comparisonId=${encodeURIComponent(comparisonId)}&alternativeId=${encodeURIComponent(alternativeId)}&campaignIndex=${campaignIndex}`,
  );
}

function PassportPanel({
  passport,
  loading,
  error,
}: {
  passport: AlternativePassport | null;
  loading: boolean;
  error: string;
}) {
  if (loading) return <div className="dr-passport-state"><span className="dr-spinner" />Cargando trazabilidad…</div>;
  if (error) return <div className="dr-passport-error" role="alert">{error}</div>;
  if (!passport) return null;

  return (
    <section className="dr-passport" aria-label="Pasaporte de trazabilidad">
      <div className="dr-passport-heading">
        <div>
          <p className="dr-eyebrow">Trazabilidad</p>
          <h3>Pasaporte de la ruta</h3>
        </div>
        {passport.sourceResult && <span className="dr-passport-source">{passport.sourceResult}</span>}
      </div>

      {(passport.engineVersion || passport.datasetVersion) && (
        <p className="dr-passport-versions">
          {passport.engineVersion && `Motor ${passport.engineVersion}`}
          {passport.engineVersion && passport.datasetVersion && ' · '}
          {passport.datasetVersion && `Datos ${passport.datasetVersion}`}
        </p>
      )}

      {passport.metrics.length > 0 ? (
        <div className="dr-passport-metrics">
          {passport.metrics.map((metric) => (
            <article key={metric.id} className="dr-passport-metric">
              <strong>{metric.label}</strong>
              <span>{metric.value === null ? 'No disponible' : `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`}</span>
              {metric.definition && <small>{metric.definition}</small>}
              {metric.source && <small>Fuente: {metric.source}</small>}
              <small>Estado: {metric.status}</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="dr-passport-empty">El backend no devolvió el desglose de indicadores para esta alternativa.</p>
      )}

      {passport.sources.length > 0 && (
        <div className="dr-passport-list">
          <strong>Fuentes</strong>
          <ul>{passport.sources.map((source, index) => <li key={`${source}-${index}`}>{source}</li>)}</ul>
        </div>
      )}
      {passport.assumptions.length > 0 && (
        <div className="dr-passport-list">
          <strong>Supuestos y limitaciones</strong>
          <ul>{passport.assumptions.map((assumption, index) => <li key={`${assumption}-${index}`}>{assumption}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

interface Props {
  comparisonId: string | null;
  alternativeId: string | null;
  campaignIndex: number;
}

export function DecisionRoutesPage({ comparisonId, alternativeId, campaignIndex }: Props) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(alternativeId);
  const [selectedCampaign, setSelectedCampaign] = useState(campaignIndex);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [desktopView, setDesktopView] = useState<'fan' | 'list'>('fan');
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  const [passport, setPassport] = useState<AlternativePassport | null>(null);
  const [passportLoading, setPassportLoading] = useState(false);
  const [passportError, setPassportError] = useState('');
  const [passportOpen, setPassportOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.title = 'FieldShift · Explorador de rutas';
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    if (!comparisonId && !isUsingMocks()) {
      setComparison(null);
      setError('Abre esta vista desde “Explorar ruta” en la comparación de opciones.');
      setLoading(false);
      return () => { active = false; };
    }

    getComparison(comparisonId || 'cmp_demo_base')
      .then((result) => {
        if (!active) return;
        setComparison(result);
        const initial = result.alternatives.find((item) => item.id === alternativeId)
          ?? result.alternatives[0]
          ?? null;
        setSelectedId(initial?.id ?? null);
        const maxIndex = Math.max(0, (initial?.campaigns.length ?? 1) - 1);
        setSelectedCampaign(Math.min(Math.max(0, campaignIndex || 0), maxIndex));
      })
      .catch((reason: unknown) => {
        if (active) {
          setComparison(null);
          setError(errorMessage(reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [comparisonId, alternativeId, campaignIndex, retryKey]);

  const alternatives = useMemo(
    () => (comparison?.alternatives ?? []).slice(0, 3),
    [comparison],
  );

  const selected = alternatives.find((item) => item.id === selectedId) ?? alternatives[0] ?? null;
  const campaign: Campaign | null = selected?.campaigns[selectedCampaign] ?? selected?.campaigns[0] ?? null;
  const activeChange = comparison?.activeChanges.at(-1);
  const optionsHref = `/opciones${comparison ? `?comparisonId=${encodeURIComponent(comparison.id)}` : ''}`;
  const showList = isMobile || desktopView === 'list';
  const horizonCount = Math.max(0, ...alternatives.map((alternative) => alternative.campaigns.length));

  function chooseRoute(id: string, campaignIndex = 0) {
    if (!comparison) return;
    const next = alternatives.find((item) => item.id === id);
    if (!next) return;
    const safeIndex = Math.min(Math.max(0, campaignIndex), Math.max(0, next.campaigns.length - 1));
    setSelectedId(id);
    setSelectedCampaign(safeIndex);
    setPassport(null);
    setPassportOpen(false);
    setPassportError('');
    updateAddress(comparison.id, id, safeIndex);
  }

  async function openPassport() {
    if (!comparison || !selected) return;
    setPassportOpen(true);
    setPassportLoading(true);
    setPassportError('');
    try {
      const result = await getAlternativePassport(comparison.id, selected.id);
      setPassport(result);
    } catch (reason) {
      setPassportError(errorMessage(reason));
      setPassport(null);
    } finally {
      setPassportLoading(false);
    }
  }

  return (
    <div className="dr-shell">
      <header className="dr-header">
        <a className="dr-brand" href={optionsHref} aria-label="FieldShift, volver a opciones">
          <LeafIcon className="dr-brand-mark" size={36} aria-hidden="true" />
          <span>FieldShift</span>
        </a>
        <nav className="dr-steps" aria-label="Pasos de FieldShift">
          <a href="/">01 Parcela</a>
          <a href={optionsHref}>02 Opciones</a>
          <strong aria-current="step">03 Rutas</strong>
        </nav>
      </header>

      <main className="dr-main">
        <section className="dr-hero">
          <div className="dr-hero-copy">
            <a className="dr-back" href={optionsHref}>← Volver a opciones</a>
            <p className="dr-eyebrow">Explorador de decisiones</p>
            <h1>Una parcela.<br /><span>Varios caminos.</span></h1>
            <p className="dr-intro">
              Explora las estrategias completas, recorre cada campaña y revisa qué se gana y qué se sacrifica antes de elegir.
            </p>
          </div>
          <div className="dr-context">
            <span className="dr-parcel-tag">{readablePlotId(comparison?.plotId)}{comparison?.areaHa ? ` · ${comparison.areaHa} ha` : ''}</span>
            <span className="dr-context-note">
              {horizonCount > 0 ? `${horizonCount} campañas por ruta` : 'Horizonte por confirmar'}
            </span>
          </div>
        </section>

        {comparison?.sourceResult === 'mock' && (
          <div className="dr-demo-banner" role="note">
            <span aria-hidden="true">●</span>
            Modo demostración: los valores son sintéticos y sirven para probar la interfaz; no son recomendaciones agronómicas validadas.
          </div>
        )}

        {comparison?.sourceResult && comparison.sourceResult !== 'mock' && (
          <div className="dr-source-banner" role="status">
            Resultado: <strong>{comparison.sourceResult}</strong>
            {comparison.engineVersion && <span> · Motor {comparison.engineVersion}</span>}
            {comparison.datasetVersion && <span> · Datos {comparison.datasetVersion}</span>}
          </div>
        )}

        {activeChange && (
          <div className="dr-change-banner" role="status">
            <span>Escenario activo: <strong>{activeChange.label || 'Condiciones modificadas'}</strong></span>
            <a href={optionsHref}>Revisar comparación</a>
          </div>
        )}

        {loading && (
          <div className="dr-state" role="status">
            <span className="dr-spinner" />
            <strong>Preparando las rutas de tu parcela…</strong>
          </div>
        )}

        {!loading && error && (
          <div className="dr-state dr-state--error" role="alert">
            <strong>No pudimos abrir el explorador.</strong>
            <p>{error}</p>
            <button className="dr-button dr-button--primary" onClick={() => setRetryKey((value) => value + 1)}>
              Reintentar
            </button>
          </div>
        )}

        {!loading && comparison && comparison.status !== 'ready' && (
          <div className="dr-state dr-state--error" role="status">
            <strong>{comparison.status === 'failed' ? 'La comparación no pudo completarse.' : 'La comparación todavía no está lista.'}</strong>
            <p>Conserva las condiciones actuales y actualiza el estado antes de solicitar otro cálculo.</p>
            <button className="dr-button dr-button--secondary" onClick={() => setRetryKey((value) => value + 1)}>Actualizar estado</button>
            <a className="dr-button dr-button--primary" href={optionsHref}>Volver a opciones</a>
          </div>
        )}

        {!loading && comparison && comparison.status === 'ready' && alternatives.length === 0 && (
          <div className="dr-state dr-empty">
            <PeacockMark size={72} />
            <strong>No hay rutas viables con estas condiciones.</strong>
            <p>El motor no devolvió alternativas. Revisa el agua disponible, los cultivos permitidos o las restricciones de la parcela.</p>
            <a className="dr-button dr-button--primary" href={optionsHref}>Corregir condiciones</a>
          </div>
        )}

        {!loading && comparison && comparison.status === 'ready' && selected && (
          <>
            <div className="dr-result-intro">
              <div>
                <p className="dr-eyebrow">Mapa de rotaciones</p>
                <h2>Explora las rutas posibles</h2>
                <p>Cada pluma representa una estrategia completa. Selecciona una ruta o toca una campaña para enfocarla.</p>
              </div>
              {comparison.priority === selected.type && (
                <span className="dr-priority-match">Coincide con tu prioridad inicial</span>
              )}
            </div>

            <section className="dr-workspace">
              <div className="dr-map-panel">
                <div className="dr-map-heading">
                  <div>
                    <span className="dr-eyebrow">Un origen · distintas estrategias</span>
                    <h3>¿Qué camino quieres explorar?</h3>
                  </div>
                  {!isMobile && (
                    <div className="dr-view-switch" role="group" aria-label="Formato de visualización">
                      <button type="button" aria-pressed={desktopView === 'fan'} onClick={() => setDesktopView('fan')}>Abanico</button>
                      <button type="button" aria-pressed={desktopView === 'list'} onClick={() => setDesktopView('list')}>Lista</button>
                    </div>
                  )}
                </div>

                <div className="dr-route-switch" role="group" aria-label="Seleccionar una estrategia">
                  {alternatives.map((alternative) => {
                    const meta = routeMeta[alternative.type] ?? routeMeta.unknown;
                    return (
                      <button
                        key={alternative.id}
                        type="button"
                        className={`dr-route-choice dr-route-choice--${alternative.type}`}
                        aria-pressed={alternative.id === selected.id}
                        onClick={() => chooseRoute(alternative.id)}
                      >
                        <span className="dr-route-dot" aria-hidden="true" />
                        <span className="dr-route-choice-copy">
                          <strong>{alternative.name || meta.name}</strong>
                          <small>{meta.label}</small>
                        </span>
                        {alternative.id === selected.id && <span className="dr-route-check" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>

                <p className="dr-map-help">
                  Sigue los nodos en orden: cada número representa una campaña de esa estrategia. Las rutas son alternativas, no probabilidades.
                </p>

                {showList ? (
                  <div className="dr-mobile-routes">
                    {alternatives.map((alternative) => {
                      const meta = routeMeta[alternative.type] ?? routeMeta.unknown;
                      const active = alternative.id === selected.id;
                      return (
                        <article key={alternative.id} className={`dr-mobile-route ${active ? 'is-active' : ''}`}>
                          <button type="button" className="dr-mobile-route-head" onClick={() => chooseRoute(alternative.id)} aria-pressed={active}>
                            <span className="dr-mobile-route-dot" style={{ background: meta.color }} />
                            <span><strong>{alternative.name || meta.name}</strong><small>{meta.label}</small></span>
                            <span aria-hidden="true">{active ? '✓' : '↗'}</span>
                          </button>
                          <ol className="dr-mobile-campaigns">
                            {alternative.campaigns.map((item, index) => (
                              <li key={item.id ?? `${alternative.id}-${index}`}>
                                <button
                                  type="button"
                                  aria-pressed={active && selectedCampaign === index}
                                  className={active && selectedCampaign === index ? 'is-current' : ''}
                                  onClick={() => chooseRoute(alternative.id, index)}
                                >
                                  <span>{String(index + 1).padStart(2, '0')}</span>
                                  <strong>{item.crop || 'Cultivo por confirmar'}</strong>
                                  <small>{item.window === '—' ? 'Ventana por confirmar' : item.window}</small>
                                </button>
                              </li>
                            ))}
                          </ol>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <FanGraph
                    alternatives={alternatives}
                    selectedId={selected.id}
                    selectedCampaign={selectedCampaign}
                    onSelect={chooseRoute}
                  />
                )}

                <div className="dr-map-footer">
                  <span><i className="dr-legend-line dr-legend-line--active" />Ruta seleccionada</span>
                  <span><i className="dr-legend-line" />Otras rutas</span>
                  <span className="dr-map-count">{alternatives.length} {alternatives.length === 1 ? 'ruta disponible' : 'rutas disponibles'}</span>
                </div>
              </div>

              <aside className="dr-inspector" aria-label={`Detalles de ${routeMeta[selected.type].name}`} aria-live="polite">
                <div className="dr-inspector-top" style={{ '--route-color': routeMeta[selected.type].color } as CSSProperties}>
                  <p className="dr-eyebrow">Estrategia seleccionada</p>
                  <h2>{selected.name || routeMeta[selected.type].name}</h2>
                  <span className="dr-focus-label">{routeMeta[selected.type].focus}</span>
                  {selected.type === comparison.priority && <span className="dr-priority-pill">Tu prioridad inicial</span>}
                </div>

                <div className="dr-campaign-focus">
                  <div className="dr-campaign-index">{String(Math.min(selectedCampaign, Math.max(0, selected.campaigns.length - 1)) + 1).padStart(2, '0')}</div>
                  <div>
                    <span>Campaña enfocada</span>
                    <strong>{campaign?.crop || 'Campaña por confirmar'}</strong>
                    <small>{campaign?.window && campaign.window !== '—' ? campaign.window : 'Ventana por confirmar'}</small>
                  </div>
                </div>

                <section className="dr-campaign-metrics" aria-label="Indicadores de la campaña seleccionada">
                  <div className="dr-section-heading">
                    <p className="dr-eyebrow">Indicadores de esta campaña</p>
                    <small>{campaign?.crop ?? 'Cultivo por confirmar'}</small>
                  </div>
                  {campaign?.metrics ? (
                    <div className="dr-campaign-metric-grid">
                      {([
                        ['yield', 'Rendimiento'],
                        ['water', 'Agua'],
                        ['economy', 'Economía'],
                        ['soil', 'Suelo'],
                      ] as const).map(([key, label]) => {
                        const value = campaign.metrics?.[key];
                        return (
                          <article className="dr-campaign-metric" key={key}>
                            <span>{value?.label || label}</span>
                            <strong>{metricText(value)}</strong>
                            <small>{metricStatusLabel(value)}</small>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="dr-campaign-metrics-empty">
                      El backend todavía no ha proporcionado indicadores desglosados por campaña. No se reutilizan aquí los valores agregados de la ruta.
                    </p>
                  )}
                </section>

                <section className="dr-route-summary" aria-label="Indicadores agregados de la ruta">
                  <p className="dr-eyebrow">Resumen de la ruta · horizonte completo</p>
                  <div className="dr-counterpoints">
                    {routeCounterpoints(selected).map((item) => (
                      <div className="dr-counterpoint" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="dr-tradeoff-block">
                  <p className="dr-eyebrow">Qué debes poner en la balanza</p>
                  <p>{routeMeta[selected.type].tradeoff}</p>
                </div>

                <div className="dr-status-grid">
                  <div className={`dr-status dr-risk--${selected.risk.level}`}>
                    <span>Riesgo reportado</span>
                    <strong>{riskLabel[selected.risk.level] ?? 'Por confirmar'}</strong>
                    {selected.risk.mainCause && <small>{selected.risk.mainCause}</small>}
                  </div>
                  <div className={`dr-status dr-quality--${selected.dataQuality.level}`}>
                    <span>Calidad de información</span>
                    <strong>{qualityLabel[selected.dataQuality.level] ?? 'Calidad por confirmar'}</strong>
                    {selected.dataQuality.mainGap && <small>{selected.dataQuality.mainGap}</small>}
                  </div>
                </div>

                <p className="dr-inspector-note">
                  Riesgo y calidad de información son dimensiones distintas. No se combinan soles, milímetros y compatibilidad en una puntuación única.
                </p>

                <button type="button" className="dr-button dr-button--secondary dr-passport-button" onClick={openPassport} disabled={passportLoading}>
                  {passportLoading ? 'Abriendo pasaporte…' : 'Ver pasaporte y fuentes'}
                </button>
                {passportOpen && (
                  <PassportPanel passport={passport} loading={passportLoading} error={passportError} />
                )}

                <a className="dr-button dr-button--primary dr-return-button" href={optionsHref}>Volver a comparar escenarios</a>
              </aside>
            </section>

            <details className="dr-reading-guide">
              <summary>Cómo interpretar este mapa</summary>
              <div>
                <p><strong>Una pluma = una estrategia completa.</strong> Los nodos muestran el orden de las campañas devueltas por el motor.</p>
                <p><strong>Los indicadores de campaña cambian al seleccionar un nodo.</strong> El resumen de ruta corresponde al horizonte completo y no debe confundirse con una campaña individual.</p>
                <p><strong>La selección no recalcula.</strong> Para probar menos riego, excluir un cultivo o fijar un cultivo inicial, vuelve a Opciones y aplica el cambio.</p>
                <p><strong>Los indicadores conservan su significado.</strong> Demanda, déficit y riego aportado no son intercambiables. La compatibilidad de rotación no mide fertilidad futura.</p>
                <p><strong>La información incompleta se muestra como tal.</strong> Riesgo y calidad de datos se presentan por separado; una alternativa favorable puede tener datos limitados.</p>
              </div>
            </details>
          </>
        )}
      </main>

      <footer className="dr-footer">
        <span>FieldShift</span>
        <p>Explora antes de sembrar. La decisión sigue siendo tuya.</p>
        <LeafIcon className="dr-footer-mark" size={30} aria-hidden="true" />
      </footer>
    </div>
  );
}
