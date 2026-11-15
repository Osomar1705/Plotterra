import { AnimatePresence, motion } from 'motion/react';
import type { AlternativeType } from '../../types/fieldshift';
import { ParticleCanvas, type ParticleKind } from './Particles';

/**
 * Cambia el ambiente de la foto real de la cabecera según la opción sobre la que
 * está el cursor: ingreso → luz dorada y monedas; agua → tono azul y gotas;
 * suelo → tono verde y puntitos que titilan. Sin cambiar la foto (un solo archivo).
 */
const KIND: Record<AlternativeType, ParticleKind> = { economy: 'coins', water: 'rain', soil: 'dots' };

export const AMBIENCE_TEXT: Record<AlternativeType, string> = {
  economy: 'This plan aims for the highest income, even if it asks more of the land.',
  water: 'This plan asks the least of your irrigation water.',
  soil: 'This plan fits your soil best.',
};

export function HeroAmbience({ mode }: { mode: AlternativeType | null }) {
  return <div className="amb" aria-hidden="true">
    {(['economy', 'water', 'soil'] as const).map((m) => <div key={m} className={`amb-tint amb-tint--${m} ${mode === m ? 'on' : ''}`} />)}
    <AnimatePresence>
      {mode && <motion.div key={mode} className="amb-fx" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .5 }}>
        <ParticleCanvas kind={KIND[mode]} density={mode === 'water' ? .55 : 1} className="amb-canvas" />
      </motion.div>}
    </AnimatePresence>
  </div>;
}
