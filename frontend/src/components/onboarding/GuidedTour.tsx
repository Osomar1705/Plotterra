import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import './guided-tour.css';

/**
 * Paso a paso guiado para quien usa Plotterra por primera vez.
 * Pensado para agricultores que no estan acostumbrados a apps: una tarjeta grande por paso,
 * una frase corta, la parte de la pantalla resaltada (como un tutorial de juego)
 * y un boton para escuchar el texto en voz alta. Espanol o ingles.
 */
type Lang = 'es' | 'en';
type Step = {
  target: string;            // selector CSS de lo que se resalta
  icon: string;              // emoji grande: se entiende sin leer
  title: Record<Lang, string>;
  text: Record<Lang, string>;
  finger?: boolean;          // animacion del dedo dibujando el borde
};

const STEPS: Step[] = [
  {
    target: '.map-search', icon: '📍',
    title: { es: '¿Dónde está tu chacra?', en: 'Where is your plot?' },
    text: {
      es: 'Escribe el nombre de tu pueblo y toca Buscar. Luego acerca el mapa con dos dedos hasta ver tu chacra.',
      en: 'Type your town and tap Search. Then zoom the map with two fingers until you see your plot.',
    },
  },
  {
    target: '.plot-canvas', icon: '✍️', finger: true,
    title: { es: 'Dibuja el borde de tu chacra', en: 'Draw the edge of your plot' },
    text: {
      es: 'Toca "Draw plot". Pasa el dedo por todo el borde de tu chacra hasta volver al inicio, o toca cada esquina.',
      en: 'Tap "Draw plot". Run your finger along the whole edge until you are back at the start, or tap each corner.',
    },
  },
  {
    target: '[data-tour="cultivo"]', icon: '🥔',
    title: { es: '¿Qué sembraste antes?', en: 'What did you plant before?' },
    text: {
      es: 'Elige lo que sembraste en la última campaña. Si no te acuerdas, marca "I don\'t know".',
      en: 'Choose what you planted last season. If you do not remember, tick "I don\'t know".',
    },
  },
  {
    target: '[data-tour="agua"]', icon: '💧',
    title: { es: '¿Cómo riegas?', en: 'How do you water it?' },
    text: {
      es: 'Toca la opción que se parece a tu chacra: solo lluvia, riego por turnos o riego cuando quieras.',
      en: 'Tap the one that fits your plot: only rain, irrigation on some days, or irrigation when you need it.',
    },
  },
  {
    target: '[data-tour="prioridad"]', icon: '⭐',
    title: { es: '¿Qué te importa más?', en: 'What matters most to you?' },
    text: {
      es: 'Ganar más dinero, ahorrar agua o cuidar tu tierra. Igual te mostramos las tres opciones.',
      en: 'Earn more money, save water or care for your soil. We still show you all three options.',
    },
  },
  {
    target: '[data-tour="comparar"]', icon: '✅',
    title: { es: '¡Listo! Compara tus opciones', en: 'Done! Compare your options' },
    text: {
      es: 'Toca este botón. Verás tres formas de sembrar las próximas tres campañas, probadas en 100 años distintos de clima y precio.',
      en: 'Tap this button. You will see three ways to plant your next three seasons, tested in 100 different years of weather and prices.',
    },
  },
];

const UI = {
  es: { next: 'Siguiente', back: 'Atrás', skip: 'Saltar guía', done: 'Empezar', listen: 'Escuchar', stop: 'Detener', step: 'Paso' },
  en: { next: 'Next', back: 'Back', skip: 'Skip guide', done: 'Start', listen: 'Listen', stop: 'Stop', step: 'Step' },
};
const STORE = 'plotterra_tour_v1';
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [lang, setLang] = useState<Lang>(() => ((leer(STORE + '_lang') as Lang) || 'en'));
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  // Alto real de la tarjeta: con texto grande mide 360-420 px, no los ~290 que
  // se suponian, y en pantallas de 768 px se salia de la vista o tapaba lo resaltado.
  const [cardH, setCardH] = useState(320);
  useLayoutEffect(() => {
    const c = cardRef.current;
    if (!open || !c) return;
    const update = () => setCardH(c.offsetHeight || 320);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(c);
    return () => ro.disconnect();
  }, [open, i, lang]);
  const step = STEPS[i];
  const t = UI[lang];

  const medir = useCallback(() => {
    const el = document.querySelector(step.target) as HTMLElement | null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step.target]);

  // Lleva la parte resaltada a la vista y la vuelve a medir al desplazar o cambiar el tamano.
  useLayoutEffect(() => {
    if (!open) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    // En celular la tarjeta va abajo: lo resaltado se sube a la parte de arriba de la pantalla.
    const movil = window.innerWidth < 720;
    // Si lo resaltado y la tarjeta caben uno debajo del otro, lo resaltado se sube
    // bajo la cabecera para dejar sitio a la tarjeta; si no, se centra.
    const r = el?.getBoundingClientRect();
    // Arriba siempre que lo resaltado quepa: el espacio libre queda abajo, junto,
    // y si la tarjeta no entra entera tapa solo el borde inferior.
    const cabe = r && r.height + 100 <= window.innerHeight;
    if (el && r && (movil || cabe)) window.scrollTo({ top: r.top + window.scrollY - 84, behavior: 'smooth' });
    else el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const id = window.setTimeout(medir, 420);
    medir();
    window.addEventListener('resize', medir); window.addEventListener('scroll', medir, true);
    return () => { window.clearTimeout(id); window.removeEventListener('resize', medir); window.removeEventListener('scroll', medir, true); };
  // cardH no entra en las dependencias: volver a desplazar cada vez que cambia el alto sacudiria la pagina.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i, step.target, medir]);

  const callar = () => { window.speechSynthesis?.cancel(); setSpeaking(false); };
  useEffect(() => { callar(); }, [i, lang]);
  useEffect(() => { if (open) cardRef.current?.focus(); }, [open, i]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  function escuchar() {
    if (!('speechSynthesis' in window)) return;
    if (speaking) { callar(); return; }
    const u = new SpeechSynthesisUtterance(`${step.title[lang]}. ${step.text[lang]}`);
    u.lang = lang === 'es' ? 'es-PE' : 'en-US';
    u.rate = 0.92;
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (voz) u.voice = voz;
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); setSpeaking(true);
  }
  function cerrar() { callar(); guardar(STORE, 'visto'); setI(0); onClose(); }
  function siguiente() { if (i < STEPS.length - 1) setI(i + 1); else cerrar(); }
  function cambiarIdioma(l: Lang) { setLang(l); guardar(STORE + '_lang', l); }

  // Tarjeta debajo de lo resaltado si cabe, si no encima, si no al costado y, como
  // ultimo recurso, pegada abajo. Siempre dentro de la pantalla.
  const pos = useMemo(() => {
    const vw = window.innerWidth, vh = window.innerHeight, h = cardH, gap = 18, top0 = 80;
    const movil = vw < 720;
    if (!rect || movil) return (rect && rect.top > vh * 0.42 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 }) as CSSProperties;
    const ancho = Math.min(440, vw - 32);
    const left = Math.min(Math.max(16, rect.left + rect.width / 2 - ancho / 2), vw - ancho - 16);
    const clampTop = (t: number) => Math.max(16, Math.min(t, vh - h - 16));
    if (vh - rect.bottom >= h + gap + 16) return { left, top: rect.bottom + gap, width: ancho } as CSSProperties;
    if (rect.top - top0 >= h + gap) return { left, top: rect.top - gap - h, width: ancho } as CSSProperties;
    const der = vw - rect.right > ancho + 32, izq = rect.left > ancho + 32;
    if (der || izq) return { left: der ? rect.right + 24 : rect.left - ancho - 24, top: clampTop(rect.top), width: ancho } as CSSProperties;
    // No cabe sin tapar: se pega al borde con mas espacio libre.
    const masAbajo = vh - rect.bottom > rect.top;
    return { left, top: masAbajo ? clampTop(vh - h - 16) : clampTop(top0), width: ancho } as CSSProperties;
  }, [rect, cardH]);

  if (!open) return null;
  const pad = 10;
  // Portal al body: asi ningun contenedor con transform o z-index de la pagina lo tapa.
  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour-hole" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}>
          {step.finger && (
            <svg className="tour-finger" viewBox="0 0 200 140" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <path className="tour-finger-path" d="M40 30 L150 22 L170 105 L55 118 Z" />
              <circle className="tour-finger-dot" r="9" />
            </svg>
          )}
        </div>
      ) : <div className="tour-dim" />}

      <div className="tour-card" ref={cardRef} tabIndex={-1} style={pos}>
        <div className="tour-top">
          <span className="tour-count">{t.step} {i + 1} / {STEPS.length}</span>
          <div className="tour-top-right">
          <div className="tour-lang" role="group" aria-label="Idioma / Language">
            <button type="button" className={lang === 'es' ? 'on' : ''} onClick={() => cambiarIdioma('es')}>ES</button>
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => cambiarIdioma('en')}>EN</button>
          </div>
          <button type="button" className="tour-close" onClick={cerrar} aria-label={t.skip} title={t.skip}>✕</button>
          </div>
        </div>
        <div className="tour-body">
          <span className="tour-icon" aria-hidden="true">{step.icon}</span>
          <div>
            <h2 id="tour-title">{step.title[lang]}</h2>
            <p>{step.text[lang]}</p>
          </div>
        </div>
        <button type="button" className="tour-listen" onClick={escuchar} aria-pressed={speaking}>
          {speaking ? '⏹' : '🔊'} {speaking ? t.stop : t.listen}
        </button>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}</div>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={cerrar}>{t.skip}</button>
          <div>
            {i > 0 && <button type="button" className="ghost-btn" onClick={() => setI(i - 1)}>{t.back}</button>}
            <button type="button" className="primary-btn" onClick={siguiente}>{i === STEPS.length - 1 ? t.done : t.next}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** true la primera vez que alguien abre la app en este navegador. */
export function tourPendiente() { return leer(STORE) !== 'visto'; }

/**
 * Invitacion discreta (esquina de abajo) en vez de abrir la guia sola:
 * quien ya sabe usar la app la descarta con un toque y no vuelve a salir.
 */
export function TourInvite({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  const es = (leer(STORE + '_lang') || 'en') === 'es';
  const no = () => { guardar(STORE, 'visto'); onDismiss(); };
  return createPortal(
    <div className="tour-invite" role="status">
      <span className="tour-invite-icon" aria-hidden="true">👣</span>
      <div className="tour-invite-text">
        <strong>{es ? '¿Primera vez aquí?' : 'First time here?'}</strong>
        <span>{es ? 'Te guiamos paso a paso.' : 'We can guide you step by step.'}</span>
      </div>
      <button type="button" className="primary-btn" onClick={onStart}>{es ? 'Guíame' : 'Guide me'}</button>
      <button type="button" className="tour-invite-no" onClick={no} aria-label={es ? 'No, gracias' : 'No, thanks'}>{es ? 'No, gracias' : 'No, thanks'}</button>
    </div>,
    document.body,
  );
}
