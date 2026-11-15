import { useEffect, useState } from 'react';
import type { Alternative, Comparison, EntryConditions } from '../types/fieldshift';
import { isUsingMocks } from '../api/fieldshiftApi';
import { askGuide, guideHealth } from '../assistant/guideApi';
import { GuideFormattedText } from '../assistant/GuideFormattedText';
import { SparkIcon, LeafIcon } from './Icons';
import './plan-why-ai.css';

type Explanation = { state: 'loading'|'ready'|'offline'|'failed'; message: string };
export function PlanWhyAI({comparison, alternative, parcel, onOpenGuide}:{
 comparison:Comparison; alternative:Alternative; parcel?:EntryConditions; onOpenGuide:(question:string)=>void;
}) {
  const [answer,setAnswer]=useState<Explanation>({state:'loading',message:''});
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let mounted=true;
    const key=`fieldshift.plan.explanation.v7:${comparison.id}:${comparison.runId??''}:${alternative.id}`;
    (async()=>{
      setAnswer({state:'loading',message:''});
      try {
        const stored=sessionStorage.getItem(key);
        if(stored){const saved=JSON.parse(stored) as {message:string;time:number};
          if(Date.now()-saved.time<60*60*1000&&saved.message){if(mounted)setAnswer({state:'ready',message:saved.message});return;}
        }
      }catch{/* cache is optional */}
      const health=await guideHealth();
      if(!mounted)return;
      if(!health.ready){setAnswer({state:'offline',message:'AI explanation is unavailable while the assistant server is offline. Run npm run dev with your private OpenAI key to enable it.'});return;}
      try{
        const reply=await askGuide({
          conversationId:`plan_${comparison.id.slice(0,32)}_${alternative.id.slice(0,32)}`,
          message:'PLAN_EXPLANATION: Explain this selected rotation in plain English. In 3 short points: (1) its demonstrated goal and actual comparison results, (2) one measurable trade-off with the other alternatives if available, (3) a concrete uncertainty or limitation from the source. Include at most three short bullet points and no fabricated agronomic mechanisms. The shown planting and harvest dates are from the model if sourceResult is calculated, or illustrative if mock. Do not propose a change.',
          context:{page:'plan',parcel,comparison,selectedAlternativeId:alternative.id,campaignIndex:0,engine:isUsingMocks()?'local_mock':'backend'},
          history:[],
        });
        if(!mounted)return;
        if(reply.message.trim()){
          setAnswer({state:'ready',message:reply.message});
          try{sessionStorage.setItem(key,JSON.stringify({message:reply.message,time:Date.now()}))}catch{/* ignore private mode */}
        } else setAnswer({state:'failed',message:'The assistant returned an empty explanation.'});
      }catch{
        if(mounted)setAnswer({state:'failed',message:'The assistant could not explain this plan right now. Try again or ask it in the chat.'});
      }
    })();
    return()=>{mounted=false};
  },[comparison.id,comparison.runId,alternative.id,version]);

  return <section className="pv-card plan-ai" aria-labelledby="plan-ai-title">
    <div className="plan-ai__heading"><span className="plan-ai__mark"><SparkIcon size={21}/></span><div>
      <span className="pv-simple-kicker">4 · Understand the recommendation</span>
      <h2 id="plan-ai-title">Why this plan?</h2>
      <p>Personalized explanation based on Plotterra results, not a new calculation.</p>
    </div></div>
    {answer.state==='ready'?<div className="plan-ai__answer"><GuideFormattedText text={answer.message}/></div>
      :<div className="plan-ai__notice" role="status">{answer.state==='loading'?<><span className="plan-ai__spinner"/>Checking the selected plan with AI…</>:answer.message}</div>}
    <div className="plan-ai__actions">
      {answer.state==='failed'&&<button type="button" className="plan-ai__retry" onClick={()=>setVersion(v=>v+1)}>Try explanation again</button>}
      <button type="button" onClick={()=>onOpenGuide('Can you explain why this rotation was recommended, using the results and harvest dates in my selected plan?')}><LeafIcon size={17}/> Ask a follow-up</button>
    </div>
    {comparison.sourceResult==='mock'&&<small>Explanation refers to illustrative demo figures, not a validated field recommendation.</small>}
  </section>;
}
