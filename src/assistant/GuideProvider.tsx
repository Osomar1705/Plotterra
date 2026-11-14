import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppliedChange, Comparison, EntryConditions } from '../types/fieldshift';
import type { GuideContext, GuidePage } from './types';

type Runner = (change: AppliedChange) => Promise<Comparison>;
interface GuideStore {
  open: boolean;
  setOpen: (open:boolean)=>void;
  openGuide: (suggestion?:string)=>void;
  initialQuestion: string;
  clearInitialQuestion: ()=>void;
  context: GuideContext;
  setPage: (page:GuidePage)=>void;
  setParcel: (parcel:EntryConditions & {locality?:string})=>void;
  setComparison: (comparison:Comparison)=>void;
  setPlanSelection: (alternativeId:string, campaignIndex:number)=>void;
  registerRunner: (runner:Runner|null)=>void;
  runScenario: Runner;
  registerUndo: (fn:(()=>Promise<Comparison|null>)|null)=>void;
  undoLast: ()=>Promise<Comparison|null>;
}
const Context=createContext<GuideStore|null>(null);
export function GuideProvider({children}:{children:ReactNode}){
  const [open,setOpen]=useState(false);
  const [initialQuestion,setInitialQuestion]=useState('');
  const [context,setContext]=useState<GuideContext>({page:'parcel'});
  const runner=useRef<Runner|null>(null);
  const undoRef=useRef<(()=>Promise<Comparison|null>)|null>(null);
  const registerUndo=useCallback((fn:(()=>Promise<Comparison|null>)|null)=>{undoRef.current=fn},[]);
  const undoLast=useCallback(async()=>undoRef.current?undoRef.current():null,[]);
  const openGuide=useCallback((suggestion?:string)=>{setInitialQuestion(suggestion??'');setOpen(true)},[]);
  const clearInitialQuestion=useCallback(()=>setInitialQuestion(''),[]);
  const setPage=useCallback((page:GuidePage)=>setContext(prev=>({...prev,page,selectedAlternativeId:page==='plan'?prev.selectedAlternativeId:undefined,campaignIndex:page==='plan'?prev.campaignIndex:undefined,comparison:page==='parcel'?undefined:prev.comparison})),[]);
  const setParcel=useCallback((parcel:EntryConditions & {locality?:string})=>setContext(prev=>({...prev,parcel})),[]);
  const setComparison=useCallback((comparison:Comparison)=>setContext(prev=>({...prev,comparison})),[]);
  const setPlanSelection=useCallback((selectedAlternativeId:string,campaignIndex:number)=>setContext(prev=>({...prev,page:'plan',selectedAlternativeId,campaignIndex})),[]);
  const registerRunner=useCallback((fn:Runner|null)=>{runner.current=fn},[]);
  const runScenario=useCallback(async(change:AppliedChange)=>{
    if(!runner.current)throw {farmerMessage:'Abre la pantalla Opciones para probar este cambio.'};
    return runner.current(change);
  },[]);
  const value=useMemo<GuideStore>(()=>({open,setOpen,openGuide,initialQuestion,clearInitialQuestion,context,setPage,setParcel,setComparison,setPlanSelection,registerRunner,runScenario,registerUndo,undoLast}),[open,openGuide,initialQuestion,clearInitialQuestion,context,setPage,setParcel,setComparison,setPlanSelection,registerRunner,runScenario,registerUndo,undoLast]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useGuide(){const result=useContext(Context);if(!result)throw new Error('GuideProvider missing');return result}
