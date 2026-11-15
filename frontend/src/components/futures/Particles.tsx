import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './futuresModel';

/**
 * Capa de partículas en canvas, ligera y sin dependencias.
 *  - rain: gotas de lluvia en diagonal (density 0..1 = cuántas se dibujan; cambia en vivo).
 *  - coins: monedas doradas que flotan hacia arriba (ingreso).
 *  - dots: puntitos verdes que titilan (suelo).
 * Con "reducir movimiento" dibuja un solo cuadro.
 */
export type ParticleKind = 'rain' | 'coins' | 'dots';

type P = { x: number; y: number; v: number; s: number; ph: number; a: number };
const MAX: Record<ParticleKind, number> = { rain: 240, coins: 34, dots: 90 };

export function ParticleCanvas({ kind, density = 1, className }: { kind: ParticleKind; density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dens = useRef(density);
  dens.current = density;

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    let w = 0, h = 0, raf = 0, last = performance.now(), t = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);

    const spawn = (initial: boolean): P => {
      const r = Math.random;
      if (kind === 'rain') return { x: r() * (w + 80), y: initial ? r() * h : -20, v: 520 + r() * 420, s: 10 + r() * 16, ph: 0, a: .35 + r() * .45 };
      if (kind === 'coins') return { x: r() * w, y: initial ? r() * h : h + 12, v: 14 + r() * 26, s: 3.4 + r() * 4.2, ph: r() * 6.3, a: .7 + r() * .3 };
      return { x: r() * w, y: r() * h, v: 4 + r() * 10, s: 1 + r() * 1.9, ph: r() * 6.3, a: .3 + r() * .7 };
    };
    const ps: P[] = Array.from({ length: MAX[kind] }, () => spawn(true));

    const draw = (dt: number) => {
      t += dt;
      ctx.clearRect(0, 0, w, h);
      const n = Math.round(MAX[kind] * Math.max(0, Math.min(1, dens.current)));
      if (kind === 'rain') {
        ctx.lineCap = 'round'; ctx.lineWidth = 1.3;
        for (let i = 0; i < n; i++) {
          const p = ps[i];
          p.y += p.v * dt; p.x -= p.v * dt * .12;
          if (p.y > h + 10 || p.x < -20) { Object.assign(p, spawn(false)); }
          ctx.strokeStyle = `rgba(214,236,248,${p.a})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.s * .12, p.y - p.s); ctx.stroke();
        }
      } else if (kind === 'coins') {
        for (let i = 0; i < n; i++) {
          const p = ps[i];
          p.y -= p.v * dt; p.x += Math.sin(t * 1.1 + p.ph) * 14 * dt;
          if (p.y < -14) Object.assign(p, spawn(false));
          const tw = .65 + .35 * Math.sin(t * 3 + p.ph);
          ctx.shadowColor = 'rgba(255,205,90,.9)'; ctx.shadowBlur = 10;
          ctx.fillStyle = `rgba(255,211,105,${p.a * tw})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
          ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(176,121,18,${p.a * .7})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s * .62, 0, 6.283); ctx.stroke();
        }
      } else {
        for (let i = 0; i < n; i++) {
          const p = ps[i];
          p.y -= p.v * dt * .5; p.x += Math.sin(t * .6 + p.ph) * 6 * dt;
          if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
          const tw = (Math.sin(t * (1.4 + p.v * .1) + p.ph) + 1) / 2;
          ctx.shadowColor = 'rgba(120,255,170,1)'; ctx.shadowBlur = 8;
          ctx.fillStyle = `rgba(150,255,190,${p.a * (.25 + .75 * tw)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
    };

    if (prefersReducedMotion()) { draw(.5); return () => ro.disconnect(); }
    const loop = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!document.hidden) draw(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [kind]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
