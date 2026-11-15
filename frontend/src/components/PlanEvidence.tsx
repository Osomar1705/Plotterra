import { useEffect, useState } from 'react';
import type { Alternative, AlternativePassport, Comparison } from '../types/fieldshift';
import { getAlternativePassport } from '../api/fieldshiftApi';
import { InfoIcon } from './Icons';
import { FX_NOTICE } from '../lib/money';
import './plan-evidence.css';

function translateLimit(value:string):string {
  const rows:[RegExp,string][]=[
    [/^Los resultados son simulados/i,'The scenarios compare possible outcomes and do not provide calibrated real-world probabilities.'],
    [/^Los precios son referencias/i,'Crop prices are market references, not confirmed offers from local buyers.'],
    [/^El índice de suelo/i,'Soil compatibility is not a measurement of future soil fertility.'],
    [/^El motor no decide/i,'The engine compares available options; it does not make the decision for the farmer.'],
    [/^La escala de los productos NASA/i,'Regional environmental datasets should be checked against conditions on the plot.'],
    [/^Cuando el suelo viene/i,'Estimated soil information is less certain than field measurements.'],
    [/^Riesgo y calidad/i,'Risk and input-data quality are different indicators.'],
    [/^Datos faltantes en esta ejecución:/i,`Data missing in this run: ${value.split(':').slice(1).join(':').trim()}`],
  ];
  return rows.find(([r])=>r.test(value))?.[1]??value;
}

/** Provenance belongs here, once. Numeric outcomes are already shown above. */
export function PlanEvidence({comparison,alternative}:{comparison:Comparison;alternative:Alternative}){
 const [passport,setPassport]=useState<AlternativePassport|null>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;setPassport(null);setFailed(false);
  getAlternativePassport(comparison.id,alternative.id).then(p=>{if(active)setPassport(p)}).catch(()=>{if(active)setFailed(true)});
  return()=>{active=false};
 },[comparison.id,alternative.id]);
 const isDemo=comparison.sourceResult==='mock'||passport?.sourceResult==='mock';
 return <details className="p8-data">
  <summary><InfoIcon size={16}/> Where does the data come from?</summary>
  <div className="p8-data__body">
   <div><h3>Data the engine uses</h3>
   <ul className="p8-data__list">
    <li><b>Climate:</b> NASA satellite data (rain, humidity, temperature, relief), grouped into real agricultural years</li>
    <li><b>Soil:</b> SoilGrids v2.0 (texture and water-holding capacity)</li>
    <li><b>Crops and land use:</b> MIDAGRI agricultural maps and the project’s crop catalog (cycle length, planting windows)</li>
    <li><b>Water and yield:</b> FAO-56 daily water balance and FAO-33 yield response</li>
    <li><b>Yield and price models:</b> the team’s trained models, with their past error used to build the 40 base cases</li>
   </ul>
   <h3 className="p8-data__h">This run</h3>
   {isDemo?<p>Illustrative local demonstration. This run did not verify external agricultural datasets.</p>:
    failed?<p>The engine did not provide a traceable source list for this request.</p>:
    !passport?<p>Loading source details…</p>:
    passport.sources.length?<ul>{passport.sources.map((source,i)=><li key={i}>{source}</li>)}</ul>:<p>No run-specific sources were returned.</p>}
   {passport&&!isDemo&&<p>Engine: {passport.engineVersion??'not reported'} · Dataset: {passport.datasetVersion??'not reported'}</p>}
   <p className="p8-data__fx">{FX_NOTICE}</p></div>
   <div><h3>Limits</h3><ul>
    <li>Tests are not guaranteed harvests or probabilities of real-world success.</li>
    <li>Prices, field conditions and irrigation can differ from the model inputs.</li>
    <li>Harvest date = suggested sowing date + the crop’s recorded duration; it is not adjusted to a future weather forecast.</li>
    {alternative.dataQuality.level==='limited'&&<li>Data quality is limited for this rotation.</li>}
    {!isDemo&&passport?.assumptions.map((a,i)=><li key={i}>{translateLimit(a)}</li>)}
   </ul></div>
  </div>
 </details>;
}
