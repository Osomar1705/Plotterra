import type { ReactElement } from "react";
/**
 * Ilustraciones PROPIAS de los 6 cultivos del catálogo (sin stock ni marcas).
 * viewBox 96×96, estilo plano cálido. Mapeo por id o por nombre ("Cebada grano" -> cebada).
 */
const G = { leaf: '#3F8A5C', leafDark: '#2C6B45', stem: '#5E8C3A', soil: '#8A5A2B', soilLight: '#C9A27A' };

export type CropKey = 'papa' | 'quinua' | 'cebada' | 'avena' | 'haba' | 'tarwi';

export function cropKey(name?: string): CropKey | null {
  if (!name) return null;
  const s = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const k of ['papa', 'quinua', 'cebada', 'avena', 'haba', 'tarwi'] as CropKey[]) if (s.includes(k)) return k;
  if (s.includes('quinoa')) return 'quinua';
  if (s.includes('chocho') || s.includes('tarhui')) return 'tarwi';
  return null;
}

export const CROP_ACCENT: Record<CropKey, string> = {
  papa: '#C8963E', quinua: '#C2416B', cebada: '#D9A93A', avena: '#C7B26A', haba: '#5C9E52', tarwi: '#6C5BC4',
};

const art: Record<CropKey, ReactElement> = {
  papa: <g>
    <path d="M10 62h76" stroke={G.soil} strokeWidth="3" strokeLinecap="round" />
    <path d="M14 66c10 6 58 6 68 0v14c-10 6-58 6-68 0z" fill={G.soilLight} opacity=".45" />
    <ellipse cx="34" cy="73" rx="9" ry="6.5" fill="#C8963E" /><ellipse cx="55" cy="76" rx="11" ry="7" fill="#B98535" />
    <ellipse cx="70" cy="70" rx="6.5" ry="5" fill="#D6A852" />
    <circle cx="31" cy="72" r="1" fill="#7A5420" /><circle cx="58" cy="74" r="1" fill="#7A5420" /><circle cx="52" cy="78" r=".9" fill="#7A5420" />
    <path d="M48 62V30" stroke={G.stem} strokeWidth="3" strokeLinecap="round" />
    <path d="M48 44c-12-2-18-10-17-18 9 0 16 6 17 18zM48 38c11-3 17-11 16-19-9 1-15 8-16 19zM48 54c-10 0-16-6-17-13 8-1 15 4 17 13zM48 52c9-1 15-7 16-14-8 0-14 6-16 14z" fill={G.leaf} />
    <circle cx="44" cy="22" r="3.2" fill="#fff" /><circle cx="52" cy="20" r="3.2" fill="#fff" /><circle cx="48" cy="17" r="3.2" fill="#fff" />
    <circle cx="48" cy="20" r="1.6" fill="#E3B23C" />
  </g>,
  quinua: <g>
    <path d="M48 88V40" stroke={G.stem} strokeWidth="3" strokeLinecap="round" />
    <path d="M48 70c-11 1-17-5-18-12 8-1 15 4 18 12zM48 62c10-1 16-7 16-14-8 0-14 6-16 14z" fill={G.leaf} />
    {[[48, 14, 7], [42, 22, 6.5], [54, 22, 6.5], [38, 31, 6], [48, 30, 7], [58, 31, 6], [43, 39, 6], [53, 39, 6]].map(([x, y, r], i) =>
      <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? '#C2416B' : i % 3 === 1 ? '#D9653B' : '#A8325A'} />)}
    {[[45, 17], [51, 26], [40, 33], [56, 34], [47, 41]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.4" fill="#F6D6A8" />)}
  </g>,
  cebada: <g>
    {[[-14, 0], [0, -6], [14, 0]].map(([dx, dy], k) => <g key={k} transform={`translate(${dx} ${dy})`}>
      <path d="M48 90V38" stroke="#B88A2E" strokeWidth="2.4" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((j) => <g key={j}>
        <ellipse cx="44.5" cy={24 + j * 6} rx="3" ry="4.5" fill="#D9A93A" transform={`rotate(-20 44.5 ${24 + j * 6})`} />
        <ellipse cx="51.5" cy={27 + j * 6} rx="3" ry="4.5" fill="#E2B74B" transform={`rotate(20 51.5 ${27 + j * 6})`} />
        <path d={`M43 ${21 + j * 6}L36 ${8 + j * 6}M53 ${24 + j * 6}L60 ${11 + j * 6}`} stroke="#C99A35" strokeWidth=".9" />
      </g>)}
    </g>)}
    <path d="M30 70c-6-6-8-12-6-18 6 4 8 10 6 18zM66 72c6-6 8-12 6-18-6 4-8 10-6 18z" fill={G.leaf} />
  </g>,
  avena: <g>
    <path d="M48 90V20" stroke="#A9944A" strokeWidth="2.4" strokeLinecap="round" />
    {[[30, -30], [38, 30], [48, -38], [56, 34], [64, -28]].map(([y, a], i) => {
      const dir = a > 0 ? 1 : -1;
      return <g key={i}>
        <path d={`M48 ${y}q${dir * 10} 2 ${dir * 14} 12`} stroke="#A9944A" strokeWidth="1.4" fill="none" />
        <path d={`M${48 + dir * 14} ${y + 12}c${dir * 4} 1 ${dir * 5} 7 ${dir * 2} 10c${-dir * 4} -2 ${-dir * 5} -7 ${-dir * 2} -10z`} fill="#D8C37A" stroke="#B7A156" strokeWidth=".8" />
      </g>;
    })}
    <path d="M48 80c-12-2-17-9-16-15 8 1 14 6 16 15z" fill={G.leaf} />
  </g>,
  haba: <g>
    <path d="M48 90V18" stroke={G.stem} strokeWidth="3.2" strokeLinecap="round" />
    {[26, 42, 58].map((y, i) => <g key={i}>
      <ellipse cx={i % 2 ? 60 : 36} cy={y} rx="10" ry="5.5" fill={G.leaf} transform={`rotate(${i % 2 ? -25 : 25} ${i % 2 ? 60 : 36} ${y})`} />
    </g>)}
    <path d="M50 64c10 2 16 10 15 22-3 1-6-1-8-3-4-6-7-12-7-19z" fill="#6FAE5F" stroke={G.leafDark} strokeWidth="1" />
    <path d="M46 60c-10 2-15 9-15 19 3 1 6-1 8-3 3-5 6-10 7-16z" fill="#7DBB6B" stroke={G.leafDark} strokeWidth="1" />
    <circle cx="58" cy="74" r="1.8" fill="#D8EBC6" /><circle cx="60" cy="80" r="1.8" fill="#D8EBC6" /><circle cx="38" cy="72" r="1.8" fill="#D8EBC6" />
    <g transform="translate(52 30)"><path d="M0 0c5-3 10-1 10 4-4 2-8 1-10-4z" fill="#fff" stroke="#C9CFC6" strokeWidth=".8" /><circle cx="5" cy="2.2" r="1.5" fill="#2D2A33" /></g>
    <g transform="translate(34 46)"><path d="M0 0c5-3 10-1 10 4-4 2-8 1-10-4z" fill="#fff" stroke="#C9CFC6" strokeWidth=".8" /><circle cx="5" cy="2.2" r="1.5" fill="#2D2A33" /></g>
  </g>,
  tarwi: <g>
    <path d="M48 90V30" stroke={G.stem} strokeWidth="3" strokeLinecap="round" />
    {[0, 1, 2, 3, 4, 5].map((j) => <g key={j}>
      <ellipse cx={43 - (5 - j) * .4} cy={12 + j * 6} rx="4.2" ry="3.2" fill={j % 2 ? '#7B6AD0' : '#5C4BB8'} />
      <ellipse cx={53 + (5 - j) * .4} cy={14 + j * 6} rx="4.2" ry="3.2" fill={j % 2 ? '#5C4BB8' : '#8C7CDB'} />
      <ellipse cx={45 - (5 - j) * .4} cy={11 + j * 6} rx="1.4" ry="1" fill="#F2E27A" />
    </g>)}
    {[-60, -30, 0, 30, 60, 90, 120, 150, 180, 210, 240, 270].map((a, i) =>
      <ellipse key={i} cx="48" cy="62" rx="2.6" ry="11" fill={G.leaf} transform={`rotate(${a} 48 62) translate(0 -10)`} />)}
    <path d="M62 78c6-2 11 0 13 4-5 3-10 2-13-4z" fill="#8FB86A" stroke={G.leafDark} strokeWidth=".8" />
  </g>,
};

export function CropIllustration({ crop, size = 40, framed = false, className }: { crop?: string; size?: number; framed?: boolean; className?: string }) {
  const k = cropKey(crop);
  if (!k) return <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden className={className}><circle cx="48" cy="48" r="20" fill="#E6F4EE" /></svg>;
  return <svg width={size} height={size} viewBox="0 0 96 96" role="img" aria-label={k} className={className}>
    {framed && <circle cx="48" cy="48" r="46" fill={CROP_ACCENT[k]} opacity=".13" />}
    {art[k]}
  </svg>;
}

/** Paisaje andino ilustrado (cerros, andenes y chacras). Sustituible por una foto con crédito. */
export function AndeanLandscape({ className, tone = 'day' }: { className?: string; tone?: 'day' | 'dusk' }) {
  const sky = tone === 'day' ? ['#E9F4F1', '#F7F3E8'] : ['#F4D9B8', '#F8EEDF'];
  return <svg className={className} viewBox="0 0 1200 260" preserveAspectRatio={tone === "day" ? "xMidYMid slice" : "xMidYMax slice"} aria-hidden>
    <defs>
      <linearGradient id="al-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient>
    </defs>
    <rect width="1200" height="260" fill="url(#al-sky)" />
    <circle cx="980" cy="70" r="34" fill="#F3C969" opacity=".85" />
    <path d="M0 150 L120 70 L210 120 L330 40 L460 125 L560 75 L700 135 L820 55 L960 130 L1080 80 L1200 120 V260 H0Z" fill="#9FB8B0" opacity=".55" />
    <path d="M330 40 L362 62 L346 60 L330 70 L314 58 L300 60Z M820 55 L850 76 L834 74 L820 82 L806 72 L792 74Z" fill="#fff" opacity=".85" />
    <path d="M0 175 C150 120 260 160 380 130 C520 95 640 160 780 140 C920 120 1040 150 1200 125 V260 H0Z" fill="#6F9A7C" />
    {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${-40 + i * 10} ${190 + i * 14} C200 ${160 + i * 14} 420 ${200 + i * 12} 640 ${178 + i * 13} S1000 ${180 + i * 12} 1240 ${170 + i * 13}`}
      stroke={['#C9A35A', '#7FA65E', '#D8B26A', '#5E8C4E', '#B98A4A'][i]} strokeWidth="13" fill="none" opacity=".9" />)}
    <path d="M0 240 C300 220 600 250 900 232 C1020 225 1110 238 1200 232 V260 H0Z" fill="#4E7A55" />
  </svg>;
}
