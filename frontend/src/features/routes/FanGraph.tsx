import type { CSSProperties } from 'react';
import type { Alternative } from '../../types/fieldshift';
const colors: Record<string,string>={economy:'#006B57',water:'#155D8B',soil:'#007F86',unknown:'#66777B'};
export function FanGraph({alternatives,selectedId,selectedCampaign,onSelect}:{alternatives:Alternative[];selectedId:string;selectedCampaign:number;onSelect:(id:string,index?:number)=>void}) {
  return <div className="dr-fan" aria-label="Visual map of routes">
    <div className="dr-fan-origin"><span>Your plot</span><strong>Ambo</strong></div>
    {alternatives.map((a,ai)=><div className={`dr-fan-route ${a.id===selectedId?'is-active':''}`} key={a.id} style={{'--fan-color':colors[a.type]||colors.unknown} as CSSProperties}>
      <button className="dr-fan-label" onClick={()=>onSelect(a.id)}>{a.name||({economy:'Money',water:'Water',soil:'Soil'} as any)[a.type]||'Route'}</button>
      <div className="dr-fan-line" />
      <div className="dr-fan-nodes">{a.campaigns.map((c,i)=><button key={c.id||i} className={a.id===selectedId&&i===selectedCampaign?'is-current':''} onClick={()=>onSelect(a.id,i)}><b>{i+1}</b><span>{c.crop}</span><small>{c.window}</small></button>)}</div>
    </div>)}
  </div>;
}
