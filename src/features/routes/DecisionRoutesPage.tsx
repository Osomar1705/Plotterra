import { useEffect, useMemo, useRef, useState } from 'react';
import { useGuide } from '../../assistant/GuideProvider';
import { readEntryConditions } from '../../integration/entryContext';
import { motion } from 'motion/react';
import type { Alternative, AlternativeKind, AlternativePassport, Campaign, Comparison, FieldShiftApiError, PassportMetric } from '../../types/fieldshift';
import { getAlternativePassport, getComparison, isUsingMocks } from '../../api/fieldshiftApi';
import { LeafIcon } from '../../components/Icons';
import type { ReactNode } from 'react';
import { AndeanLandscape, CROP_ACCENT, CropIllustration, cropKey } from '../../components/CropIllustration';
import { useCountUp } from '../../components/useCountUp';
import { FuturesGrid } from '../../components/futures/FuturesGrid';
import { FAMILY_LABEL, profitLine, signedMoney, summarize } from '../../components/futures/futuresModel';
import '../../components/futures/futures.css';
import './decision-routes.css';
import './plan.css';

const meta: Record<AlternativeKind, { title: string; subtitle: string }> = {
  economy: { title: 'Plan Economía', subtitle: 'Mayor margen estimado' },
  water: { title: 'Plan Agua', subtitle: 'Menor exposición hídrica' },
  soil: { title: 'Plan Suelo', subtitle: 'Mayor compatibilidad agronómica' },
  unknown: { title: 'Plan seleccionado', subtitle: 'Detalle de la alternativa' },
};
const soilLabel: Record<string, string> = { compatible: 'Compatible', high: 'Alta compatibilidad', medium: 'Compatibilidad media', low: 'Baja compatibilidad', unknown: 'Por confirmar' };
const soilShort: Record<string, string> = { compatible: 'Compatible', high: 'Alta', medium: 'Media', low: 'Baja', unknown: '—' };
const riskLabel: Record<string, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', unknown: 'Por confirmar' };
const MONTHS = ['ago', 'sep', 'oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul'];
const MONTH_IDX: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "2026-11-14 a 2027-06-02" -> "14 nov 2026 – 2 jun 2027"; otro formato se deja tal cual. */
function readableWindow(w: string) {
  const d = [...w.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)].map(([, y, m, day]) => `${Number(day)} ${MES[Number(m) - 1]} ${y}`);
  return d.length === 2 ? `${d[0]} – ${d[1]}` : w;
}

const err = (e: unknown) => (e as Partial<FieldShiftApiError>)?.farmerMessage || 'No pudimos cargar este plan.';

/** "2026-10" -> índice de mes desde agosto del año agrícola base. */
const monthIndex = (ym: string, baseYear: number) => {
  const [y, m] = ym.split('-').map(Number);
  return (y - baseYear) * 12 + (m - 8);
};
/** Si el backend no envía start/end_month, se deduce de la ventana ("Oct–nov 2026"). Sin fin conocido: 5 meses. */
function campaignSpan(c: Campaign, baseYear: number, k: number): [number, number] {
  if (c.startMonth && c.endMonth) return [monthIndex(c.startMonth, baseYear), monthIndex(c.endMonth, baseYear)];
  const m = c.window.toLowerCase().match(/([a-zé]{3})[^0-9]*?(\d{4})/);
  const start = m ? monthIndex(`${m[2]}-${String(MONTH_IDX[m[1]] ?? 10).padStart(2, '0')}`, baseYear) : k * 12 + 2;
  return [start, start + 5];
}

export function DecisionRoutesPage({ comparisonId, alternativeId, campaignIndex: initialCampaign = 0 }: { comparisonId: string | null; alternativeId: string | null; campaignIndex?: number }) {
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [altId, setAltId] = useState<string | null>(alternativeId);
  const [campaignIndex, setCampaignIndex] = useState(initialCampaign);
  const [compareUsual, setCompareUsual] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const { setPage, setParcel, setComparison: publishComparison, setPlanSelection, openGuide } = useGuide();
  useEffect(() => { setPage('plan'); const e = readEntryConditions(); if (e) setParcel(e); }, [setPage, setParcel]);

  useEffect(() => {
    document.title = 'FieldShift · Tu plan';
    let alive = true;
    (async () => {
      try {
        if (!comparisonId && !isUsingMocks()) throw new Error('Abre el plan desde la comparación.');
        const c = await getComparison(comparisonId || 'cmp_demo_base');
        if (alive) setComparison(c);
      } catch (e) { if (alive) setError(err(e)); } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [comparisonId]);

  const selected = useMemo<Alternative | null>(() => comparison?.alternatives.find((a) => a.id === altId) ?? comparison?.alternatives[0] ?? null, [comparison, altId]);
  // Al cambiar de alternativa se vuelve a la primera campana; en la primera carga
  // se respeta la campana que vino en la URL.
  const lastSelected = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastSelected.current !== undefined && lastSelected.current !== selected?.id) setCampaignIndex(0);
    lastSelected.current = selected?.id;
  }, [selected?.id]);

  // Pasaporte: de donde sale cada cifra (fuentes NASA, supuestos, versiones).
  const [passport, setPassport] = useState<AlternativePassport | null>(null);
  const [passportLoading, setPassportLoading] = useState(false);
  const [passportError, setPassportError] = useState('');
  useEffect(() => {
    if (!comparison || !selected) return;
    let alive = true;
    setPassportLoading(true); setPassportError(''); setPassport(null);
    getAlternativePassport(comparison.id, selected.id)
      .then((p) => { if (alive) setPassport(p); })
      .catch((e) => { if (alive) setPassportError(err(e)); })
      .finally(() => { if (alive) setPassportLoading(false); });
    return () => { alive = false; };
  }, [comparison?.id, selected?.id]);
  useEffect(() => { if (comparison) publishComparison(comparison); }, [comparison, publishComparison]);
  useEffect(() => { if (selected) setPlanSelection(selected.id, campaignIndex); }, [selected?.id, campaignIndex, setPlanSelection]);

  const baseYear = useMemo(() => {
    const first = selected?.campaigns[0];
    if (first?.startMonth) { const [y, m] = first.startMonth.split('-').map(Number); return m >= 8 ? y : y - 1; }
    const y = Number(first?.window.match(/\d{4}/)?.[0]); return Number.isFinite(y) && y > 0 ? y : new Date().getFullYear();
  }, [selected]);

  const optionsHref = `/opciones${comparison ? `?comparisonId=${encodeURIComponent(comparison.id)}` : ''}`;
  if (loading) return <div className="page-center"><div className="spinner" /><p>Preparando tu plan…</p></div>;
  if (error || !comparison || !selected) return <div className="page-center error-state"><h2>No pudimos abrir este plan</h2><p>{error || 'La alternativa seleccionada ya no está disponible.'}</p><a href={optionsHref}>← Volver a comparar</a></div>;

  const m = meta[selected.type ?? 'unknown'];
  const focused = selected.campaigns[campaignIndex] ?? selected.campaigns[0];
  const rain = comparison.rainfallMonthlyMm;
  const rainMax = rain ? Math.max(...rain, 1) : 1;
  const spans = selected.campaigns.map((c, k) => campaignSpan(c, baseYear, k));
  const o = selected.outcomes; const s = o ? summarize(o) : null;
  const usual = comparison.usualPlan?.outcomes ? comparison.usualPlan : null;
  const us = usual ? summarize(usual.outcomes!) : null;
  const metrics = focused?.metrics;
  const metricRows = [['Rendimiento', metrics?.yield], ['Agua que la lluvia no cubre', metrics?.water], ['Margen', metrics?.economy]] as const;
  const fmt = (v: unknown) => typeof v === 'number' ? new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(v) : String(v ?? '—');

  const switchAlt = (id: string) => {
    setAltId(id);
    const url = `/plan?comparisonId=${encodeURIComponent(comparison.id)}&alternativeId=${encodeURIComponent(id)}`;
    window.history.replaceState({}, '', url);
  };

  return <div className="plan-shell pv">
    <header className="topbar"><a className="brand" href="/"><LeafIcon />FieldShift</a><nav className="steps"><a href="/">1&nbsp; Parcela</a><a href={optionsHref}>2&nbsp; Opciones</a><strong>3&nbsp; Plan</strong></nav></header>

    <section className={`pv-hero pv-hero--${selected.type}`}>
      <AndeanLandscape className="pv-hero-art" tone="dusk" />
      <div className="pv-hero-inner">
        <a className="pv-back" href={optionsHref}>← Volver a comparar</a>
        <div className="pv-hero-row">
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5 }}>
            <span className="pv-kicker">Este es el plan que elegiste</span>
            <h1>{m.title}</h1>
            <p className="pv-seq">{selected.campaigns.map((c) => c.crop).join('  →  ')}</p>
            <div className="pv-tabs" role="tablist" aria-label="Cambiar de plan">
              {comparison.alternatives.map((a) => <button key={a.id} role="tab" aria-selected={a.id === selected.id}
                className={a.id === selected.id ? 'on' : ''} onClick={() => switchAlt(a.id)}>{meta[a.type].title.replace('Plan ', '')}{a.type === comparison.priority && ' ✓'}</button>)}
            </div>
            <button className="pv-ask" onClick={() => openGuide('¿Por qué me recomiendan esta rotación y qué tan segura es?')}>💬 Preguntar por este plan</button>
          </motion.div>
          <div className="pv-kpis">
            {s && (s.best !== undefined
              ? <Kpi i={0} label="Es la mejor opción en" value={<><CountUp n={s.best} /> <small>/ {s.total}</small></>} sub={profitLine(s)} />
              : <Kpi i={0} label="Futuros con ganancia" value={<><CountUp n={s.wins} /> <small>/ {s.total}</small></>} />)}
            {s?.mean !== undefined && <Kpi i={1} label="Margen promedio" value={signedMoney(s.mean)} sub="por ha · 3 campañas" />}
            <Kpi i={2} label="Agua que la lluvia no cubre" value={`${selected.water.value} ${selected.water.unit}`} sub="por campaña" />
            <Kpi i={3} label="Suelo" value={soilShort[selected.soil.compatibility] || selected.soil.compatibility} sub="compatibilidad" />
            <Kpi i={4} label="Riesgo" value={riskLabel[selected.risk.level] || selected.risk.level} sub="en los futuros probados" />
          </div>
        </div>
      </div>
    </section>

    <main className="pv-main">
      {/* ---------- Línea de tiempo + detalle de la campaña elegida ---------- */}
      <section className="pv-card pv-timeline" aria-label="Calendario de la rotación">
        <div className="pv-sec-head pv-sec-head--row"><div><h2>Tu rotación en el tiempo</h2><p>Toca una banda para ver esa campaña.{rain ? ' Las barras azules son la lluvia media de cada mes.' : ''}</p></div></div>
        <div className="pv-tl-scroll">
          <div className="pv-tl">
            {rain && <div className="pv-rain" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <motion.i key={i} style={{ height: `${rain[i % 12] / rainMax * 100}%`, originY: 1 }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * .015, duration: .5 }} />)}</div>}
            <div className="pv-years">{[0, 1, 2].map((k) => <span key={k}>Año agrícola {baseYear + k}–{String(baseYear + k + 1).slice(2)}</span>)}</div>
            <div className="pv-lane">
              {selected.campaigns.map((c, k) => {
                const [a, b] = spans[k]; const ck = cropKey(c.cropId ?? c.crop);
                return <motion.button key={`${selected.id}-${k}`} className={`pv-band ${k === campaignIndex ? 'is-on' : ''}`}
                  style={{ left: `${Math.max(0, a) / 36 * 100}%`, width: `${Math.max(2, Math.min(36, b) - Math.max(0, a)) / 36 * 100}%`, ['--band' as string]: ck ? CROP_ACCENT[ck] : '#6f9a7c' }}
                  initial={{ clipPath: 'inset(0 100% 0 0 round 14px)' }} animate={{ clipPath: 'inset(0 0% 0 0 round 14px)' }}
                  transition={{ delay: .2 + k * .3, duration: .7, ease: [.2, .7, .3, 1] }}
                  onClick={() => setCampaignIndex(k)} aria-pressed={k === campaignIndex}>
                  <CropIllustration crop={c.cropId ?? c.crop} size={36} />
                  <span><strong>{c.crop}</strong><small>{readableWindow(c.window)}</small></span>
                </motion.button>;
              })}
            </div>
            <div className="pv-months" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <span key={i} className={i % 12 === 0 ? 'y' : ''}>{MONTHS[i % 12]}</span>)}</div>
          </div>
        </div>
        {focused && <motion.div key={`${selected.id}-${campaignIndex}`} className="pv-camp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <CropIllustration crop={focused.cropId ?? focused.crop} size={72} framed />
          <div className="pv-camp-id"><span className="pv-kicker pv-kicker--dark">Campaña {campaignIndex + 1} de {selected.campaigns.length}</span><h3>{focused.crop}</h3><p>De {readableWindow(focused.window)}</p><button className="pv-ask pv-ask--sm" onClick={() => openGuide(`¿Por qué ${focused.crop} va en la campaña ${campaignIndex + 1}?`)}>¿Por qué aquí? 💬</button></div>
          {metricRows.some(([, v]) => v?.value != null) ? metricRows.filter(([, v]) => v?.value != null).map(([label, v]) => <article key={label} className="pv-metric">
            <span>{label}</span><strong>{fmt(v!.value)} <small>{v!.unit}</small></strong>
            {(v as any).range && <em>{fmt((v as any).range.p10)} a {fmt((v as any).range.p90)} según el futuro</em>}
          </article>) : <p className="pv-muted">El motor aún no envió métricas por campaña.</p>}
        </motion.div>}
      </section>

      <div className="pv-two">
        {/* ---------- 100 futuros del plan ---------- */}
        {o && s ? <section className="pv-card pv-futures">
          <div className="pv-sec-head pv-sec-head--row">
            <div><h2>Este plan en 100 futuros</h2><p>Clima histórico y golpes de lluvia, riego y precio.</p></div>
            {usual && <label className="pv-switch"><input type="checkbox" checked={compareUsual} onChange={(e) => setCompareUsual(e.target.checked)} /><span />Comparar con mi plan habitual</label>}
          </div>
          <div className={`pv-fut-grid ${compareUsual && usual ? 'is-compare' : ''}`}>
            <div>
              <p className="pv-fut-big">{s.best !== undefined ? <>La mejor de las tres en <b><CountUp n={s.best} /></b> de {s.total}</> : <>Gana en <b><CountUp n={s.wins} /></b> de {s.total}</>}</p>
              <p className={`pv-profit ${s.losses > 0 ? 'neg' : ''}`}>{profitLine(s)}</p>
              <FuturesGrid values={o.marginByScenario} scenarios={comparison.scenarios} size="full" order="value" highlightIndex={hover} onHoverIndex={setHover} ariaLabel={`Este plan gana en ${s.wins} de ${s.total} futuros`} />
              <dl className="fp-stats">{s.mean !== undefined && <><dt>Promedio</dt><dd>{signedMoney(s.mean)} /ha</dd></>}{s.adverse !== undefined && <><dt>10 peores</dt><dd className={s.adverse < 0 ? 'neg' : ''}>{signedMoney(s.adverse)} /ha</dd></>}</dl>
            </div>
            {compareUsual && usual && us ? <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <p className="pv-fut-big pv-fut-big--usual">Tu plan habitual: <b>{profitLine(us)}</b></p>
              <FuturesGrid values={usual.outcomes!.marginByScenario} scenarios={comparison.scenarios} size="full" order="value" highlightIndex={hover} onHoverIndex={setHover} ariaLabel={`Plan habitual: gana en ${us.wins} de ${us.total} futuros`} />
              <dl className="fp-stats">{us.mean !== undefined && <><dt>Promedio</dt><dd>{signedMoney(us.mean)} /ha</dd></>}{us.adverse !== undefined && <><dt>10 peores</dt><dd className={us.adverse < 0 ? 'neg' : ''}>{signedMoney(us.adverse)} /ha</dd></>}</dl>
            </motion.div> : selected.stressTest && <div className="pv-stress">
              <h3>Por tipo de futuro</h3>
              <ul className="fp-stress">{selected.stressTest.map((r, i) => {
                const max = Math.max(...selected.stressTest!.map((x) => Math.abs(x.meanMargin)), 1);
                return <li key={r.family}><span>{FAMILY_LABEL[r.family as keyof typeof FAMILY_LABEL] ?? r.label}</span><i><motion.b className={r.meanMargin < 0 ? 'neg' : ''} initial={{ width: 0 }} animate={{ width: `${Math.abs(r.meanMargin) / max * 100}%` }} transition={{ delay: .4 + i * .08, duration: .6 }} /></i><em>{signedMoney(r.meanMargin)}</em></li>;
              })}</ul>
            </div>}
          </div>
        </section> : <section className="pv-card"><p className="pv-muted">El motor no envió los 100 futuros de este plan.</p></section>}

        {/* ---------- Por qué este plan ---------- */}
        <section className="pv-card pv-why">
          <h2>Por qué este plan</h2>
          {(selected.explanation?.why ?? passport?.explanation?.why) && <p className="pv-lead">{selected.explanation?.why ?? passport?.explanation?.why}</p>}
          {!selected.tradeoffs?.costOfPriority && passport?.explanation?.tradeoff && <p className="pv-muted">{passport.explanation.tradeoff}</p>}
          {selected.tradeoffs?.costOfPriority && <p className="pv-muted">{selected.tradeoffs.costOfPriority}</p>}
          {(selected.tradeoffs?.advantages?.length ?? 0) > 0 && <><h3>A favor</h3><ul>{selected.tradeoffs!.advantages.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
          {(selected.tradeoffs?.risks?.length ?? 0) > 0 && <><h3>A vigilar</h3><ul className="risk">{selected.tradeoffs!.risks.map((t, i) => <li key={i}>{t}</li>)}</ul></>}
          {selected.risk.mainCause && <p className="pv-note">⚠ {selected.risk.mainCause}</p>}
          {(selected.explanation?.dataThatWouldChange ?? passport?.explanation?.dataThatWouldChange) && <p className="pv-note pv-note--info">Qué dato podría cambiar la decisión: {selected.explanation?.dataThatWouldChange ?? passport?.explanation?.dataThatWouldChange}</p>}
        </section>

        {/* ---------- De dónde sale cada cifra ---------- */}
        <section className="pv-card pv-passport">
          <PassportPanel passport={passport} loading={passportLoading} error={passportError} />
        </section>
      </div>
      {comparison.sourceResult === 'mock' && <p className="pv-foot">Datos de demostración. Ilustraciones propias de FieldShift; fotos de Wikimedia Commons con crédito.</p>}
    </main>
  </div>;
}

function CountUp({ n }: { n: number }) { return <>{useCountUp(n, 1000, 300)}</>; }

function Kpi({ label, value, sub, i }: { label: string; value: ReactNode; sub?: string; i: number }) {
  return <motion.article className="pv-kpi" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 + i * .1 }}>
    <span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}
  </motion.article>;
}

/** "Ficha avena: Rendimiento: p90 de INEI..." -> una sola linea para todas las fichas. */
function groupSources(sources: string[]) {
  const fichas: string[] = []; const rest: { title: string; text: string }[] = [];
  for (const s of sources) {
    const m = s.match(/^Ficha ([^:]+):\s*(.*)$/i);
    if (m) { fichas.push(m[1]); continue; }
    const i = s.indexOf(': ');
    rest.push(i > 0 ? { title: s.slice(0, i), text: s.slice(i + 2) } : { title: s, text: '' });
  }
  if (fichas.length) rest.push({ title: 'Fichas de cultivo', text: `${fichas.join(', ')}: rendimiento y calendario INEI ENA, precios SIEA/MIDAGRI, costos INEI` });
  return rest;
}

const fmtValue = (m: PassportMetric) =>
  m.value === null ? 'Sin dato' : `${typeof m.value === 'number' ? m.value.toLocaleString('es-PE') : m.value}${m.unit ? ` ${m.unit}` : ''}`;

/**
 * Trazabilidad compacta: las cifras en una grilla (la explicacion de cada una
 * al pasar el cursor) y fuentes y supuestos plegados para quien quiera auditar.
 */
function PassportPanel({ passport, loading, error }: { passport: AlternativePassport | null; loading: boolean; error: string }) {
  if (loading) return <p className="pv-pass-state">Cargando de dónde salen las cifras…</p>;
  if (error) return <p className="pv-pass-state" role="alert">{error}</p>;
  if (!passport) return null;
  const sources = groupSources(passport.sources);
  return (
    <section className="pv-pass" aria-label="De dónde salen las cifras">
      <header className="pv-pass-head">
        <h2>De dónde salen estas cifras</h2>
        {(passport.engineVersion || passport.datasetVersion) && (
          <small>Motor {passport.engineVersion ?? '—'} · Datos {passport.datasetVersion ?? '—'}{passport.sourceResult === 'cache' ? ' · resultado guardado' : ''}</small>
        )}
      </header>
      {passport.metrics.length > 0 ? (
        <dl className="pv-pass-grid">
          {passport.metrics.map((m) => (
            <div key={m.id} title={m.definition ?? undefined}>
              <dt>{m.label}</dt>
              <dd>{fmtValue(m)}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="pv-pass-state">El motor no envió el desglose de esta alternativa.</p>}
      {sources.length > 0 && (
        <details className="pv-pass-more">
          <summary>Ver fuentes ({sources.length})</summary>
          <ul>{sources.map((s, i) => <li key={i} title={s.text}><strong>{s.title}</strong>{s.text && <span>{s.text.length > 120 ? `${s.text.slice(0, 117)}…` : s.text}</span>}</li>)}</ul>
        </details>
      )}
      {passport.assumptions.length > 0 && (
        <details className="pv-pass-more">
          <summary>Ver supuestos y límites ({passport.assumptions.length})</summary>
          <ul>{passport.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
