import type { CSSProperties } from 'react';
import type { Alternative, AlternativeType } from '../types/fieldshift';
import { AlertIcon, CoinsIcon, InfoIcon, LeafIcon, SproutIcon, WaterIcon } from './Icons';

const meta: Record<AlternativeType,{title:string;subtitle:string;Icon:typeof CoinsIcon}> = {
  economy:{title:'Economía',subtitle:'Mayor rentabilidad estimada.',Icon:CoinsIcon},
  water:{title:'Agua',subtitle:'Menor uso de agua.',Icon:WaterIcon},
  soil:{title:'Suelo',subtitle:'Mayor compatibilidad agronómica.',Icon:SproutIcon},
};
const riskLabel={low:'Bajo',medium:'Medio',high:'Alto',unknown:'Sin definir'};
const qualityLabel={sufficient:'Datos suficientes',limited:'Datos limitados',insufficient:'Datos insuficientes',unknown:'Calidad sin definir'};
const soilLabel=(v:string)=>({compatible:'Compatible',high:'Alta compatibilidad',medium:'Compatibilidad media',low:'Baja compatibilidad'}[v] ?? v);
const money=(n:number)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(n);

export function AlternativeCard({alternative,priority,onOpenPlan}:{alternative:Alternative;priority:boolean;onOpenPlan:(id:string)=>void}){
  const m=meta[alternative.type]; const Icon=m.Icon;
  const accent=`var(--${alternative.type})`;
  return <article className={`option-card ${priority?'option-card--priority':''}`} style={{'--accent':accent} as CSSProperties}>
    <div className="option-head">
      <div className="option-icon"><Icon size={24}/></div>
      <div className="option-title"><h2>{m.title}</h2><p>{m.subtitle}</p></div>
      {priority && <span className="priority-badge">Prioridad</span>}
    </div>

    <div className="section-label">Secuencia</div>
    <div className="campaign-row">
      {alternative.campaigns.map((c,i)=><div className="campaign-wrap" key={`${c.crop}-${i}`}>
        <div className="crop"><span className="crop-icon"><LeafIcon size={14}/></span><span><strong>{c.crop}</strong><small>{c.window}</small></span></div>
        {i<alternative.campaigns.length-1 && <span className="crop-arrow">→</span>}
      </div>)}
    </div>
    <div className="divider"/>

    <div className="metric-title"><span>▥</span> Margen estimado</div>
    <strong className="metric-value">S/ {money(alternative.margin.min)} – {money(alternative.margin.max)} /{alternative.margin.basis}</strong>
    <div className="bar"><span style={{width:`${Math.min(92,45+(alternative.margin.max/4000)*45)}%`,background:accent}}/></div>

    <div className="metric-water"><div><WaterIcon size={16}/><span>Agua</span></div><strong>{alternative.water.value} {alternative.water.unit}</strong><div className="bar"><span style={{width:`${Math.max(28,Math.min(88,alternative.water.value/4))}%`}}/></div></div>

    <div className="status-row status-row--soil"><LeafIcon size={17}/><span>Suelo</span><strong>{soilLabel(alternative.soil.compatibility)}</strong></div>
    <div className={`status-row status-row--risk risk-${alternative.risk.level}`}><AlertIcon size={17}/><span>Riesgo</span><strong>{riskLabel[alternative.risk.level]}</strong></div>

    <div className="card-foot"><span className={`quality quality-${alternative.dataQuality.level}`}><InfoIcon size={15}/>{qualityLabel[alternative.dataQuality.level]}</span><button className="ghost-btn" onClick={()=>onOpenPlan(alternative.id)}>Ver mi plan</button></div>
  </article>
}
