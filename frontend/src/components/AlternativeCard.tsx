import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SOFT_EASE } from '../motion/policy';
import type { Alternative, AlternativeType } from '../types/fieldshift';
import { CoinsIcon, SproutIcon, WaterIcon } from './Icons';
import { CropIllustration } from './CropIllustration';
import { signedMoney, summarize } from './futures/futuresModel';
import { displayMoney } from '../lib/money';
import { displayDate } from '../lib/cropSchedule';
import { cropName, optionName, riskName, sowingLabel, waterLabel } from '../lib/uiCopy';

const meta: Record<AlternativeType, { subtitle:string; explanation:string; Icon:typeof CoinsIcon }> = {
 economy:{subtitle:'Focus: income',explanation:'For farmers prioritizing income. Check the water requirement and risk before choosing.',Icon:CoinsIcon},
 water:{subtitle:'Focus: water',explanation:'For farmers trying to reduce water pressure. Compare the possible gain as well.',Icon:WaterIcon},
 soil:{subtitle:'Focus: soil fit',explanation:'For farmers who care about crop compatibility with their land. This is not a soil-fertility guarantee.',Icon:SproutIcon},
};

const fmtMm=(n:number)=>Math.round(n).toLocaleString('en-US');
/** Deficit: mediana = anio tipico, p90 = anio seco. Va como texto, no como cifra
 *  principal: con riego suele ser 0 en las tres opciones y no las distingue. */
function shortfallNote(a:Alternative){
 const {value,dryYear}=a.water, typ=Math.round(value);
 const typical=typ<=0?'No shortfall in a typical year':`${fmtMm(typ)} mm short in a typical year`;
 if(dryYear===undefined)return typical;
 if(Math.round(dryYear)<=0)return typ<=0?'No shortfall, even in a dry year':typical;
 return `${typical} · ${fmtMm(dryYear)} mm short in a dry year`;
}

export function AlternativeCard({alternative,priority,onOpenPlan,index=0,onHover}:{
  alternative:Alternative;priority:boolean;onOpenPlan:(id:string)=>void;index?:number;onHover?:(t:AlternativeType|null)=>void;
}){
 const reduced=useReducedMotion();
 const m=meta[alternative.type],Icon=m.Icon,s=alternative.outcomes?summarize(alternative.outcomes):null;
 return <motion.article className={`oc oc--${alternative.type} ${priority?'oc--priority':''}`} style={{'--accent':`var(--${alternative.type})`} as CSSProperties}
  initial={{opacity:reduced?1:0,y:reduced?0:10}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:0.08}} transition={{delay:reduced?0:index*.055,duration:reduced?0:.48,ease:SOFT_EASE}}
  onMouseEnter={()=>onHover?.(alternative.type)} onMouseLeave={()=>onHover?.(null)} onFocus={()=>onHover?.(alternative.type)} onBlur={()=>onHover?.(null)}>
   <span className="oc-ring" aria-hidden="true"/>
   <header className="oc-head"><span className="oc-icon"><Icon size={24}/></span><div><h2>{optionName[alternative.type]}</h2><p>{m.subtitle}</p></div>{priority&&<span className="oc-badge">Your priority</span>}</header>
   <p className="oc-summary">{m.explanation}</p>
   <div className="oc-sequence-label">Planting order</div>
   <ol className="oc-seq" aria-label="Planting order">
    {alternative.campaigns.map((c,i)=><li key={`${c.crop}-${i}`}><CropIllustration crop={c.cropId??c.crop} size={40} framed/><strong>{cropName(c.crop)}</strong><small>{displayDate(c.sowingDate)??sowingLabel(c.window)}</small></li>)}
   </ol>
   <div className="oc-main-metrics">
    <div><span><CoinsIcon size={16}/> Estimated margin</span><strong>{s?.mean!==undefined?signedMoney(s.mean):`${displayMoney(alternative.margin.min,alternative.margin.currency)}–${displayMoney(alternative.margin.max,alternative.margin.currency)}`}</strong><small>{s?.mean!==undefined?'Average · per ha':'Estimate · per ha'}</small></div>
    {alternative.water.demand!==undefined
     ? <div><span><WaterIcon size={16}/> Water the plan needs</span><strong>{fmtMm(alternative.water.demand)} <small>mm · {alternative.campaigns.length} seasons</small></strong><small>{shortfallNote(alternative)}</small></div>
     : <div><span><WaterIcon size={16}/> {waterLabel(alternative)}</span><strong>{fmtMm(alternative.water.value)} <small>{alternative.water.unit}</small></strong><small>{shortfallNote(alternative)}</small></div>}
   </div>
   <div className="oc-actions oc-actions--only"><button className="oc-plan-btn" onClick={()=>onOpenPlan(alternative.id)}>View this plan →</button></div>
 </motion.article>;
}
