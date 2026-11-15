import { useEffect, useLayoutEffect, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import { SOFT_EASE } from './motion/policy';
import { EntryPage } from './components/EntryPage';
import { ComparisonPage } from './components/ComparisonPage';
import { DecisionRoutesPage } from './features/routes/DecisionRoutesPage';
import { GuideDrawer } from './assistant/GuideDrawer';
import { GuideProvider } from './assistant/GuideProvider';

function PageRouter(){
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{const update=()=>setPath(window.location.pathname);window.addEventListener('popstate',update);return ()=>window.removeEventListener('popstate',update)},[]);
  const route=path.startsWith('/opciones')?'options':path.startsWith('/plan')?'plan':'plot';
  useLayoutEffect(()=>{window.scrollTo(0,0)},[route]);
  let page;
  if(route==='options')page=<ComparisonPage/>;
  else if(route==='plan'){
    const params=new URLSearchParams(window.location.search);
    page=<DecisionRoutesPage comparisonId={params.get('comparisonId')} alternativeId={params.get('alternativeId')}/>;
  }
  else page=<EntryPage/>;
  return <motion.div key={route} className="motion-page" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.22,ease:SOFT_EASE}}>{page}</motion.div>;
}
export default function App(){return <MotionConfig reducedMotion="user" transition={{duration:0.36,ease:SOFT_EASE}}><GuideProvider><PageRouter/><GuideDrawer/></GuideProvider></MotionConfig>}
