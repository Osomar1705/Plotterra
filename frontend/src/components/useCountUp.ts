import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './futures/futuresModel';

/** Cuenta animada hacia un valor REAL (no inventa: solo anima el número que ya llegó). */
export function useCountUp(target: number, duration = 900, delay = 0) {
  const [v, setV] = useState(prefersReducedMotion() ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setV(target); return; }
    let raf = 0; const start = performance.now() + delay; const a = from.current;
    const step = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(a + (target - a) * e));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  return v;
}
