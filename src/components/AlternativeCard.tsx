import type { CSSProperties } from 'react';
import { motion } from 'motion/react';
import type { Alternative, AlternativeKind, Campaign, ScenarioMeta } from '../types/fieldshift';
import { AlertIcon, CoinsIcon, InfoIcon, LeafIcon, SproutIcon, WaterIcon } from './Icons';
import { CropIllustration } from './CropIllustration';
import { FuturesGrid } from './futures/FuturesGrid';
import { signedMoney, summarize } from './futures/futuresModel';
import { useCountUp } from './useCountUp';

const meta: Record<AlternativeKind,{title:string;subtitle:string;Icon:typeof CoinsIcon}> = {
  economy:{title:'Economía',subtitle:'Mayor rentabilidad estimada',Icon:CoinsIcon},
  water:{title:'Agua',subtitle:'Menor uso de agua',Icon:WaterIcon},
  soil:{title:'Suelo',subtitle:'Mayor compatibilidad agronómica',Icon:SproutIcon},
  unknown:{title:'Alternativa',subtitle:'Criterio por confirmar',Icon:LeafIcon},
};
const riskLabel={low:'Bajo',medium:'Medio',high:'Alto',unknown:'—'};
const qualityLabel={sufficient:'Datos suficientes',limited:'Datos limitados',insufficient:'Datos insuficientes',unknown:'Calidad sin definir'};
const soilLabel=(v:string)=>({compatible:'Compatible',high:'Alta',medium:'Media',low:'Baja',bueno:'Buena',regular:'Regular',malo:'Mala'}[v] ?? v);
const money=(n:number)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(n);
// El motor puede no devolver un indicador: mostramos el hueco en vez de un cero.
const SIN_DATO='No disponible';
const moneyRange=(min:number|null,max:number|null,basis:string)=>
  min===null||max===null ? SIN_DATO : `S/ ${money(min)} – ${money(max)} /${basis}`;

const MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const monthLabel=(ym:string)=>{const [y,m]=ym.split('-').map(Number);return MONTHS[m-1]?`${MONTHS[m-1]} ${y}`:ym};
/** "nov 2026 – jun 2027" a partir de los meses de siembra y cosecha; si faltan, la ventana tal cual. */
function campaignWindow(c:Campaign){
  if(c.startMonth&&c.endMonth)return `${monthLabel(c.startMonth)} – ${monthLabel(c.endMonth)}`;
  return c.window;
}

export function AlternativeCard({alternative,priority,onOpenPlan,scenarios,hoveredScenario=null,onHoverScenario,onOpenFutures,layoutId,index=0,hideGrid=false,onAsk}:{
  alternative:Alternative; priority:boolean; onOpenPlan:(id:string)=>void;
  scenarios?:ScenarioMeta[]; hoveredScenario?:number|null; onHoverScenario?:(i:number|null)=>void;
  onOpenFutures?:()=>void; layoutId?:string; index?:number; hideGrid?:boolean; onAsk?:(q:string)=>void;
}){
  const m=meta[alternative.type]; const Icon=m.Icon;
  const accent=alternative.type==='unknown'?'var(--navy)':`var(--${alternative.type})`;
  const o=alternative.outcomes; const s=o?summarize(o):null;
  const wins=useCountUp(s?.wins??0, 900, 250+index*150);
  const {min,max,basis}=alternative.margin;
  return <motion.article className={`oc oc--${alternative.type} ${priority?'oc--priority':''}`} style={{'--accent':accent} as CSSProperties}
    initial={{opacity:0,y:28,scale:.98}} animate={{opacity:1,y:0,scale:1}} whileHover={{y:-4}}
    transition={{delay:.06+index*.12,type:'spring',stiffness:150,damping:20}}>
    <header className="oc-head">
      <span className="oc-icon"><Icon size={22}/></span>
      <div><h2>{m.title}</h2><p>{m.subtitle}</p></div>
      {priority && <span className="oc-badge">✓ Tu prioridad</span>}
    </header>

    <ol className="oc-seq" aria-label="Secuencia de cultivos">
      {alternative.campaigns.map((c,i)=><motion.li key={`${c.crop}-${i}`} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.3+index*.12+i*.08}}>
        <CropIllustration crop={c.cropId ?? c.crop} size={40} framed/>
        <strong>{c.crop.replace(' grano','').replace(' seco','').replace(' seca','')}</strong>
        <small>{campaignWindow(c)}</small>
      </motion.li>)}
    </ol>

    {o && s ? <div className="oc-fut">
      <div className="oc-fut-grid" style={{visibility: hideGrid ? 'hidden' : 'visible'}}>
        <FuturesGrid values={o.marginByScenario} scenarios={scenarios} size="mini" cellPx={9} order="value"
          highlightIndex={hoveredScenario} onHoverIndex={onHoverScenario} layoutId={hideGrid?undefined:layoutId}
          ariaLabel={`${m.title}: gana en ${s.wins} de ${s.total} futuros`}/>
      </div>
      <div className="oc-fut-text">
        <span className="oc-wins"><b>{wins}</b><small>/ {s.total}</small></span>
        <span className="oc-wins-label">futuros con ganancia</span>
        {s.mean!==undefined && <span className="oc-line" title={min===null||max===null?undefined:`Rango de escenarios: S/ ${money(min)} a ${money(max)}`}>Promedio <b>{signedMoney(s.mean)}</b></span>}
        {s.adverse!==undefined && <span className="oc-line">10 peores <b className={s.adverse<0?'neg':''}>{signedMoney(s.adverse)}</b></span>}
        <span className="oc-links">
          {onOpenFutures && <button className="oc-link" onClick={onOpenFutures}>Ver los 100 →</button>}
          {onAsk && <button className="oc-link oc-link--ask" onClick={()=>onAsk(`¿Por qué me recomiendan la opción ${m.title}?`)}>¿Por qué? 💬</button>}
        </span>
      </div>
    </div> : <div className="oc-fut oc-fut--plain">
      <span className="oc-line">Margen estimado</span>
      <strong className="oc-plain-val">{moneyRange(min,max,basis)}</strong>
      {onAsk && <button className="oc-link oc-link--ask" onClick={()=>onAsk(`¿Por qué me recomiendan la opción ${m.title}?`)}>¿Por qué? 💬</button>}
    </div>}

    <div className="oc-chips">
      <span className="oc-chip oc-chip--water"><WaterIcon size={15}/><small>Agua</small><b>{alternative.water.value===null?SIN_DATO:`${alternative.water.value} ${alternative.water.unit}`}</b></span>
      <span className="oc-chip oc-chip--soil"><LeafIcon size={15}/><small>Suelo</small><b>{soilLabel(alternative.soil.compatibility)}</b></span>
      <span className={`oc-chip oc-chip--risk risk-${alternative.risk.level}`}><AlertIcon size={15}/><small>Riesgo</small><b>{riskLabel[alternative.risk.level]}</b></span>
    </div>

    <footer className="oc-foot">
      <span className={`quality quality-${alternative.dataQuality.level}`}><InfoIcon size={14}/>{qualityLabel[alternative.dataQuality.level]}</span>
      <button className="oc-plan-btn demo-plan-btn" onClick={()=>onOpenPlan(alternative.id)}>Ver este plan →</button>
    </footer>
  </motion.article>
}
