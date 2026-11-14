import { useEffect, useState } from 'react';
import { EntryPage } from './components/EntryPage';
import { ComparisonPage } from './components/ComparisonPage';
import { DecisionRoutesPage } from './features/routes/DecisionRoutesPage';
import { GuideDrawer } from './assistant/GuideDrawer';
import { GuideProvider } from './assistant/GuideProvider';

function PageRouter(){
  const [path,setPath]=useState(window.location.pathname);
  useEffect(()=>{const update=()=>setPath(window.location.pathname);window.addEventListener('popstate',update);return ()=>window.removeEventListener('popstate',update)},[]);
  if(path.startsWith('/opciones'))return <ComparisonPage/>;
  if(path.startsWith('/plan')){
    const params=new URLSearchParams(window.location.search);
    return <DecisionRoutesPage comparisonId={params.get('comparisonId')} alternativeId={params.get('alternativeId')}/>;
  }
  return <EntryPage/>;
}
export default function App(){return <GuideProvider><PageRouter/><GuideDrawer/></GuideProvider>}
