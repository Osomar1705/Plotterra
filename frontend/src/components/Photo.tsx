import { useState } from 'react';
import { AndeanLandscape } from './CropIllustration';

/**
 * Fotos reales de Wikimedia Commons, cargadas por el navegador del usuario (hotlink a Special:FilePath).
 * Siempre con crédito y enlace a la página del archivo (allí está su licencia).
 * Si la imagen no carga (sin internet, bloqueo de red), se muestra la ilustración propia.
 * ANTES DE PUBLICAR: revisar la licencia de cada archivo en su enlace `page`.
 */
export type PhotoKey = 'andenes' | 'quinua' | 'papa';

const COMMONS = 'https://commons.wikimedia.org/wiki/';
export const PHOTOS: Record<PhotoKey, { file: string; author: string; caption: string; position?: string }> = {
  andenes: { file: 'Andenes_de_cultivo.jpg', author: 'Jospastor', caption: 'Andenes de cultivo, valle del Colca (Perú)', position: 'center 55%' },
  quinua: { file: 'Quinua.JPG', author: 'Maurice Chédel', caption: 'Quinua cerca de Cachora, Apurímac, 3800 m', position: 'center 45%' },
  papa: { file: 'Variedades_de_papa_cosechados_de_una_sola_chacra_en_Llullucha.jpg', author: 'Carlo Brescia', caption: 'Variedades de papa de una sola chacra, Llullucha', position: 'center' },
};

export const photoUrl = (k: PhotoKey, width = 1600) => `${COMMONS}Special:FilePath/${PHOTOS[k].file}?width=${width}`;
export const photoPage = (k: PhotoKey) => `${COMMONS}File:${PHOTOS[k].file}`;

export function Photo({ k, className, width = 1600, credit = true, kenBurns = true }: {
  k: PhotoKey; className?: string; width?: number; credit?: boolean; kenBurns?: boolean;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const p = PHOTOS[k];
  return <div className={`photo ${className ?? ''} photo--${state}`}>
    <AndeanLandscape className="photo-fallback" />
    {state !== 'error' && <img src={photoUrl(k, width)} alt={p.caption} loading="lazy" decoding="async"
      className={kenBurns ? 'photo-img photo-img--kb' : 'photo-img'} style={{ objectPosition: p.position }}
      onLoad={() => setState('ok')} onError={() => setState('error')} />}
    {credit && state === 'ok' && <a className="photo-credit" href={photoPage(k)} target="_blank" rel="noreferrer">
      {p.caption} · Foto: {p.author} · Wikimedia Commons</a>}
  </div>;
}

export function photoForCrop(crop?: string): PhotoKey {
  const s = (crop ?? '').toLowerCase();
  if (s.includes('papa')) return 'papa';
  if (s.includes('quinua')) return 'quinua';
  return 'andenes';
}
