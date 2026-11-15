import { useState } from 'react';
import { motion } from 'motion/react';
import { usePhotoDepth } from '../motion/usePhotoDepth';
import { SOFT_EASE } from '../motion/policy';
import { AndeanLandscape } from './CropIllustration';

/** Existing Wikimedia photographs, with a bundled copy of the header image.
 * Credits stay outside the moving plane; unavailable images retain the illustration.
 */
export type PhotoKey = 'andenes' | 'quinua' | 'papa';

const COMMONS = 'https://commons.wikimedia.org/wiki/';
export const PHOTOS: Record<PhotoKey, { file: string; author: string; caption: string; position?: string }> = {
  andenes: { file: 'Andenes_de_cultivo.jpg', author: 'Jospastor', caption: 'Andenes de cultivo, valle del Colca (Perú)', position: 'center 55%' },
  quinua: { file: 'Quinua.JPG', author: 'Maurice Chédel', caption: 'Quinua cerca de Cachora, Apurímac, 3800 m', position: 'center 45%' },
  papa: { file: 'Variedades_de_papa_cosechados_de_una_sola_chacra_en_Llullucha.jpg', author: 'Carlo Brescia', caption: 'Variedades de papa de una sola chacra, Llullucha', position: 'center' },
};

export const photoUrl = (k: PhotoKey, width = 1600) => k === 'andenes' ? `${import.meta.env.BASE_URL}media/andenes-colca-1280.jpg` : `${COMMONS}Special:FilePath/${PHOTOS[k].file}?width=${width}`;
export const photoPage = (k: PhotoKey) => `${COMMONS}File:${PHOTOS[k].file}`;

type PhotoProps = {
  k: PhotoKey; className?: string; width?: number; credit?: boolean; kenBurns?: boolean;
  /** Para fotos de cabecera: con lazy el navegador puede no pedirla nunca y queda el dibujo. */
  eager?: boolean;
};
export function Photo(props: PhotoProps) { return <PhotoScene key={props.k} {...props}/>; }
function PhotoScene({ k, className, width = 1600, credit = true, kenBurns = true, eager = false }: PhotoProps) {
  const depth = usePhotoDepth();
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const p = PHOTOS[k];
  return <div ref={depth.ref} className={`photo photo--depth ${className ?? ''} photo--${state}`}>
    <motion.div className="photo-plane" style={{x:depth.x,y:depth.y,rotateX:depth.rotateX,rotateY:depth.rotateY,transformPerspective:1100,scale:depth.reduced?1:1.055}}>
    <AndeanLandscape className="photo-fallback" />
    {state !== 'error' && <motion.img src={photoUrl(k, width)} alt={p.caption} loading={eager ? 'eager' : 'lazy'} decoding="async"
      className="photo-img" style={{ objectPosition: p.position }}
      initial={{opacity:0,scale:depth.reduced?1:kenBurns?1.035:1.015}} animate={{opacity:state==='ok'?1:0,scale:1}}
      transition={{duration:depth.reduced?0:0.85,ease:SOFT_EASE}}
      onLoad={() => setState('ok')} onError={() => setState('error')} />}
    </motion.div>
    {credit && state === 'ok' && <a className="photo-credit" href={photoPage(k)} target="_blank" rel="noreferrer" title={k==='andenes'?'Jospastor · CC BY-SA 4.0 · Displayed with animated perspective':undefined}>
      {p.caption} · Foto: {p.author} · Wikimedia Commons</a>}
  </div>;
}

export function photoForCrop(crop?: string): PhotoKey {
  const s = (crop ?? '').toLowerCase();
  if (s.includes('papa')) return 'papa';
  if (s.includes('quinua')) return 'quinua';
  return 'andenes';
}
