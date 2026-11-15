import { motion } from 'motion/react';
import type { ScenarioFamily } from '../../types/fieldshift';
import rainImg from '../../assets/scenes/rain.webp';
import priceImg from '../../assets/scenes/price.webp';
import deadImg from '../../assets/scenes/dead.webp';
import { CoinsIcon, RainIcon, WaterIcon } from '../Icons';

/**
 * Escena que enseña, sin palabras de más, qué se está probando:
 * la foto real de la chacra cambia de ambiente según el tipo de futuro
 * (lluvia que baja, tierra que se seca, precio que cae) y tres medidores
 * muestran el valor real de cada factor en la prueba en curso (1 = normal).
 */
export const FAMILY_DEFAULTS: Record<ScenarioFamily, { rain: number; water: number; price: number }> = {
  tipica: { rain: 1, water: 1, price: 1 },
  menos_lluvia: { rain: .7, water: 1, price: 1 },
  menos_riego: { rain: 1, water: .7, price: 1 },
  caida_precio: { rain: 1, water: 1, price: .7 },
  combinado: { rain: .75, water: .75, price: .75 },
};

const pct = (f: number) => `${Math.round(f * 100)} %`;

function Gauge({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'rain' | 'water' | 'price' }) {
  const low = value < .985;
  return <div className={`sx-gauge sx-gauge--${tone} ${low ? 'is-low' : ''}`}>
    <span className="sx-gauge-ico">{icon}</span>
    <div className="sx-gauge-main">
      <div className="sx-gauge-top"><span>{label}</span><b>{pct(value)}</b></div>
      <div className="sx-gauge-bar"><motion.i animate={{ width: `${Math.max(4, value * 100)}%` }} transition={{ type: 'spring', stiffness: 90, damping: 18 }} /></div>
    </div>
  </div>;
}

/** Cuánto pesa cada ilustración (0..1) según el tipo de futuro y los factores de la prueba. */
function weights(family: ScenarioFamily | null, summary: boolean, rain: number, water: number) {
  const w = { rain: 0, price: 0, dead: 0 };
  const dry = (f: number) => Math.max(0, Math.min(1, (1 - f) / .45));
  if (summary || !family || family === 'tipica') w.rain = 1;
  else if (family === 'menos_lluvia') { const d = dry(rain); w.rain = 1 - d; w.dead = d; }
  else if (family === 'menos_riego') { const d = dry(water); w.rain = 1 - d; w.dead = d; }
  else if (family === 'caida_precio') w.price = 1;
  else w.dead = 1;
  return w;
}

/**
 * Escena que enseña qué se está probando con 3 ilustraciones del mismo estilo
 * (lluvia, caída de precio, suelo muerto). Se mezclan según los factores REALES de
 * la prueba en curso; los medidores muestran esos mismos valores. Sin animación extra.
 */
export function StressScene({ family, summary = false, rain, water, price }: {
  family: ScenarioFamily | null; summary?: boolean; rain: number; water: number; price: number; wait?: boolean;
}) {
  const w = weights(family, summary, rain, water);
  const layers: [string, number, string][] = [[rainImg, w.rain, 'rain'], [priceImg, w.price, 'price'], [deadImg, w.dead, 'dead']];
  return <div className="sx-scene" aria-hidden="true">
    {layers.map(([src, o, k]) => <img key={k} className={`sx-img sx-img--${k}`} src={src} alt="" style={{ opacity: o }} draggable={false} />)}
    <div className="sx-gauges">
      <Gauge icon={<RainIcon size={16} />} label="Rain" value={rain} tone="rain" />
      <Gauge icon={<WaterIcon size={16} />} label="Irrigation" value={water} tone="water" />
      <Gauge icon={<CoinsIcon size={16} />} label="Price" value={price} tone="price" />
    </div>
  </div>;
}
