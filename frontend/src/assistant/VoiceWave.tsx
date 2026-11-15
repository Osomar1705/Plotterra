import { useEffect, useRef, useState } from 'react';

const BARS = 32;

/**
 * Onda de voz en vivo mientras el agricultor dicta. Lee el nivel real del
 * micrófono (AnalyserNode). Si el navegador no da acceso al audio, cae a una
 * animación suave en CSS para que siga viéndose "escuchando".
 */
export function VoiceWave({ active }: { active: boolean }) {
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BARS }, () => 0.08));
  const [real, setReal] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!active) { setReal(false); return; }
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let cancelled = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        ctx = new AudioContext();
        const an = ctx.createAnalyser(); an.fftSize = 128; an.smoothingTimeConstant = 0.72;
        ctx.createMediaStreamSource(stream).connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        setReal(true);
        const tick = () => {
          an.getByteFrequencyData(data);
          const usable = Math.floor(data.length * 0.75); // las voces viven en la parte baja/media
          setLevels(Array.from({ length: BARS }, (_, i) => {
            const v = data[Math.floor((i / BARS) * usable)] / 255;
            return Math.max(0.08, Math.min(1, v * 1.35));
          }));
          raf.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { setReal(false); }
    })();
    return () => {
      cancelled = true; cancelAnimationFrame(raf.current);
      stream?.getTracks().forEach((t) => t.stop()); ctx?.close().catch(() => {});
    };
  }, [active]);

  if (!active) return null;
  return <div className={`guide-wave ${real ? 'is-live' : 'is-fake'}`} aria-hidden="true">
    {levels.map((l, i) => <i key={i} style={real ? { height: `${Math.round(l * 100)}%` } : { animationDelay: `${(i % 8) * 0.09}s` }} />)}
  </div>;
}

/** Ecualizador chico para "se está leyendo la respuesta en voz alta". */
export function SpeakingEq() {
  return <span className="guide-eq" aria-hidden="true"><i /><i /><i /><i /></span>;
}
