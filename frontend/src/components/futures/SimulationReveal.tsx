import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ScenarioFamily, ScenarioMeta } from '../../types/fieldshift';
import { FuturesGrid } from './FuturesGrid';
import { FAMILY_ORDER, prefersReducedMotion } from './futuresModel';
import { FAMILY_DEFAULTS, StressScene } from './StressScene';
import { CheckIcon, CoinsIcon, RainIcon, SparkIcon, SproutIcon, WaterIcon } from '../Icons';

const HOLD_SUMMARY = 1100;
/** Datos que el motor usa; se "encienden" uno a uno mientras avanza la prueba. */
const SOURCES = ['NASA POWER', 'CHIRPS', 'NASA HLS', 'ECOSTRESS', 'MIDAGRI'];

/** Qué se está probando, en una frase que entienda cualquiera. */
const STEP: Record<ScenarioFamily, { chip: string; title: string; text: string; Icon: typeof RainIcon }> = {
  tipica: { chip: 'Typical years', title: 'Typical years', Icon: SproutIcon,
    text: 'First we replay your plan with real weather from past seasons.' },
  menos_lluvia: { chip: 'Less rain', title: 'What if it rains less?', Icon: RainIcon,
    text: 'Same plan, but the rain falls short of what those years brought.' },
  menos_riego: { chip: 'Less water', title: 'What if irrigation falls short?', Icon: WaterIcon,
    text: 'The canal delivers less water than planned and the soil dries out.' },
  caida_precio: { chip: 'Lower prices', title: 'What if prices drop?', Icon: CoinsIcon,
    text: 'The market pays less for your harvest, even in a good season.' },
  combinado: { chip: 'All at once', title: 'And if it all happens together?', Icon: SparkIcon,
    text: 'Less rain, less water and lower prices in the same season: the hardest test.' },
};

export function useCountUp(target: number, run: boolean, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) { setN(0); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return n;
}

export function SimulationReveal({ values, previousValues, scenarios, changeLabel, layoutId, onDone, note }: {
  values?: number[];
  previousValues?: number[];
  scenarios?: ScenarioMeta[];
  changeLabel?: string | null;
  layoutId?: string;
  onDone: () => void;
  note?: string | null;
}) {
  const [block, setBlock] = useState(-1);
  const [shownN, setShownN] = useState(0);
  const [curCase, setCurCase] = useState(-1);
  const [waiting, setWaiting] = useState(false);
  const [summary, setSummary] = useState(false);
  const done = useRef(false);
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  // Al terminar deja de tapar la pagina al instante: si la animacion de salida no corre
  // (pestana en segundo plano), el overlay seguia bloqueando "View this plan".
  const [closing, setClosing] = useState(false);
  const finish = () => { if (!done.current) { done.current = true; setClosing(true); onDone(); } };
  // Con un cambio pedido desde el chat se acelera: ya vio la animación completa antes.
  const fast = !!changeLabel;
  const n = values?.length ?? 100;
  const hasScn = !!scenarios && scenarios.length === n;

  // Orden de reproducción: se prueban los futuros agrupados por tipo, uno tras otro.
  const plan = useMemo(() => {
    const idx = Array.from({ length: n }, (_, i) => i);
    // Mientras el motor calcula no se conocen los escenarios: se usa la composicion habitual
    // (40 tipicos y 15 de cada tipo de estres) para poder animar desde el primer segundo.
    const DEF: Record<ScenarioFamily, number> = { tipica: 0.4, menos_lluvia: 0.15, menos_riego: 0.15, caida_precio: 0.15, combinado: 0.15 };
    const bounds: Record<string, number> = {};
    let acc = 0; FAMILY_ORDER.forEach((f) => { acc += Math.round(DEF[f] * n); bounds[f] = acc; });
    const fam = (i: number): ScenarioFamily => hasScn ? scenarios![i].family
      : (FAMILY_ORDER.find((f) => i < bounds[f]) ?? 'combinado');
    const blocks = FAMILY_ORDER.map((f) => ({ family: f, items: idx.filter((i) => fam(i) === f) })).filter((b) => b.items.length);
    const order = blocks.flatMap((b) => b.items);
    const rank = new Array<number>(n);
    order.forEach((i, k) => { rank[i] = k; });
    return { blocks, order, rank };
  }, [n, hasScn, scenarios]);

  // Una simulacion nueva puede reutilizar esta instancia mientras sale la anterior.
  const planRef = useRef(plan);
  planRef.current = plan;
  const [cycle, setCycle] = useState(0);
  const hadValues = useRef(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  useEffect(() => {
    if (values) { hadValues.current = true; return; }
    if (hadValues.current) { hadValues.current = false; done.current = false; setClosing(false); setSummary(false); setBlock(-1); setShownN(0); setCycle((c) => c + 1); }
  }, [values]);

  useEffect(() => {
    const previous = document.activeElement;
    card.current?.focus({ preventScroll: true });
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => { if (values) card.current?.querySelector('button')?.focus({ preventScroll: true }); }, [values]);

  // La animacion arranca al abrir la pantalla y NO espera al calculo: corre en paralelo.
  // Si el motor termina antes, se muestra completa; si tarda, se queda en la ultima prueba
  // ("All at once") hasta que lleguen los resultados y entonces cierra enseguida.
  useEffect(() => {
    if (prefersReducedMotion() && valuesRef.current) { finish(); return; }
    const D = fast ? 300 : 800;                        // ms por tipo de futuro
    const T = D * planRef.current.blocks.length;
    const t0 = performance.now();
    let raf = 0, end = 0, closed = false;
    const tick = (now: number) => {
      const has = !!valuesRef.current;
      const el = Math.max(0, now - t0);
      if (has && el >= T) {
        closed = true;
        setBlock(planRef.current.blocks.length - 1); setShownN(n); setCurCase(planRef.current.order[n - 1]); setSummary(true);
        end = window.setTimeout(finish, fast ? 700 : HOLD_SUMMARY);
        return;
      }
      // Sin resultados todavia: se detiene al 92 % de la ultima prueba.
      const eff = has ? el : Math.min(el, T * 0.92);
      const b = Math.min(planRef.current.blocks.length - 1, Math.floor(eff / D));
      const p = Math.min(1, (eff - b * D) / (D * .82));
      const before = planRef.current.blocks.slice(0, b).reduce((s, x) => s + x.items.length, 0);
      const count = before + Math.max(1, Math.ceil(p * planRef.current.blocks[b].items.length));
      setBlock(b); setShownN(count); setCurCase(planRef.current.order[count - 1]); setWaiting(!has && el >= T * 0.92);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(end); if (!closed) setWaiting(false); };
  }, [cycle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && values) finish();
      if (e.key === 'Tab') { e.preventDefault(); (card.current?.querySelector('button') ?? card.current)?.focus({ preventScroll: true }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const running = block >= 0;
  const family: ScenarioFamily | null = running && !summary ? plan.blocks[block]?.family ?? null : null;
  const s = curCase >= 0 ? scenarios?.[curCase] : undefined;
  const def = family ? FAMILY_DEFAULTS[family] : { rain: 1, water: 1, price: 1 };
  // Valores reales de la prueba en curso; si el motor no los manda, los típicos del tipo.
  const rain = family && s?.rainFactor !== undefined && family !== 'tipica' ? Math.min(1, s.rainFactor) : def.rain;
  const water = family && s?.irrigationFactor !== undefined && family !== 'tipica' ? Math.min(1, s.irrigationFactor) : def.water;
  const price = family && s?.priceFactor !== undefined && family !== 'tipica' ? Math.min(1, s.priceFactor) : def.price;

  const shown = (i: number) => plan.rank[i] < shownN;
  const wins = values?.filter((v) => v > 0).length ?? 0;
  const worsened = values && previousValues ? values.filter((v, i) => v < 0 && (previousValues[i] ?? 0) >= 0).length : 0;
  const lit = summary ? SOURCES.length : Math.min(SOURCES.length, Math.floor((shownN / n) * SOURCES.length) + (values ? 1 : 0));
  const winsCount = useCountUp(wins, summary);
  const step = family ? STEP[family] : null;
  const activeIdx = family ? plan.blocks.findIndex((b) => b.family === family) : -1;
  const key = summary ? 'sum' : family ?? 'wait';

  return <motion.div className={`sx-overlay${closing ? ' is-closing' : ''}`} role="dialog" aria-modal={closing ? undefined : true} aria-hidden={closing || undefined} aria-labelledby={titleId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .4 } }}>
    <motion.div ref={card} tabIndex={-1} className="sx-card" initial={{ y: 18, scale: .985, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ duration: .45, ease: [.2, .8, .2, 1] }}>
      <header className="sx-head">
        <div>
          <span className="sx-kicker">{changeLabel ? `Re-running with: ${changeLabel}` : 'Stress test'}</span>
          <h2 id={titleId}>{summary ? 'Your plan, tested in 100 possible futures' : 'Testing your plan in 100 possible futures'}</h2>
        </div>
        {values && <button className="sx-skip" onClick={finish}>See results →</button>}
      </header>

      {<ol className="sx-steps" aria-label="Types of future being tested">
        {plan.blocks.map((b, i) => {
          const St = STEP[b.family];
          const state = summary || i < activeIdx ? 'done' : i === activeIdx ? 'on' : '';
          return <li key={b.family} className={`sx-step ${state}`}>
            <span className="sx-step-ico">{state === 'done' ? <CheckIcon size={14} /> : <St.Icon size={14} />}</span>{St.chip}
          </li>;
        })}
      </ol>}

      <div className="sx-body">
        <div className="sx-left">
          <StressScene family={family} summary={summary} rain={summary ? 1 : rain} water={summary ? 1 : water} price={summary ? 1 : price} />
          <div className="sx-caption">
            <AnimatePresence mode="wait">
              <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, transition: { duration: .12 } }} transition={{ duration: .28 }}>
                {summary
                  ? <><strong>Your plan earned in {winsCount} of {n} futures.</strong>
                    <span>{n - wins} of them were rough: they cost money. {worsened > 0 && `${worsened} got worse with your change.`}</span></>
                  : step
                    ? <><strong>{step.title}</strong><span>{step.text}</span></>
                    : <><strong>Getting your 100 futures ready…</strong><span>Real weather, water and price data for your area.</span></>}
                {!summary && waiting && <span className="sx-wait">Finishing the real calculation for your plot… this can take a few seconds.</span>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="sx-board">
          <div className="sx-count"><b>{String(shownN).padStart(3, '0')}</b><span>/ {n} tests</span></div>
          <div className="sx-grid">
            <FuturesGrid values={values ?? Array.from({ length: 100 }, () => 0)} scenarios={scenarios} size="mini" order="scenario"
              revealed pending={!values} shown={shown} previousValues={previousValues} layoutId={layoutId} cellPx={28}
              ariaLabel="Simulation of 100 possible futures" />
          </div>
          <div className="sx-bar"><i style={{ width: `${(shownN / n) * 100}%` }} /></div>
          <div className="sx-sources">{SOURCES.map((x, i) => <span key={x} className={i < lit ? 'on' : ''}>{x}</span>)}</div>
          {note && summary && <span className="sx-note">{note}</span>}
        </div>
      </div>
      <p className="sx-foot">The past weather years replayed here include real El Niño and La Niña events, so the tests are not only “normal” years.</p>
    </motion.div>
  </motion.div>;
}
