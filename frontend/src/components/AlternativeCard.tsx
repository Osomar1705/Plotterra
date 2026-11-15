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

export function AlternativeCard({alternative,priority,onOpenPlan,index=0}:{
 alternative:Alternative;priority:boolean;onOpenPlan:(id:string)=>void;index?:number;
}){
 const reduced=useReducedMotion();
 const m=meta[alternative.type],Icon=m.Icon,s=alternative.outcomes?summarize(alternative.outcomes):null;
 return <motion.article className={`oc oc--${alternative.type} ${priority?'oc--priority':''}`} style={{'--accent':`var(--${alternative.type})`} as CSSProperties}
  initial={{opacity:reduced?1:0,y:reduced?0:10}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:0.08}} transition={{delay:reduced?0:index*.055,duration:reduced?0:.48,ease:SOFT_EASE}}>
   <header className="oc-head"><span className="oc-icon"><Icon size={24}/></span><div><h2>{optionName[alternative.type]}</h2><p>{m.subtitle}</p></div>{priority&&<span className="oc-badge">Your priority</span>}</header>
   <p className="oc-summary">{m.explanation}</p>
   <div className="oc-sequence-label">Planting order</div>
   <ol className="oc-seq" aria-label="Planting order">
    {alternative.campaigns.map((c,i)=><li key={`${c.crop}-${i}`}><CropIllustration crop={c.cropId??c.crop} size={40} framed/><strong>{cropName(c.crop)}</strong><small>{displayDate(c.sowingDate)??sowingLabel(c.window)}</small></li>)}
   </ol>
   <div className="oc-main-metrics">
    <div><span><CoinsIcon size={16}/> Estimated margin</span><strong>{s?.mean!==undefined?signedMoney(s.mean):`${displayMoney(alternative.margin.min,alternative.margin.currency)}–${displayMoney(alternative.margin.max,alternative.margin.currency)}`}</strong><small>{s?.mean!==undefined?'Average · per ha':'Estimate · per ha'}</small></div>
    <div><span><WaterIcon size={16}/> {waterLabel(alternative)}</span><strong>{alternative.water.value} <small>{alternative.water.unit}</small></strong><small>{alternative.water.period?`Period: ${alternative.water.period==='campaña'?'season':alternative.water.period}`:'Check the period in the model details'}</small></div>
   </div>
   <div className="oc-actions oc-actions--only"><button className="oc-plan-btn" onClick={()=>onOpenPlan(alternative.id)}>View this plan →</button></div>
 </motion.article>;
}
