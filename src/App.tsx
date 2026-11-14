import { useEffect, useState } from 'react';
import { EntryPage } from './components/EntryPage';
import { ComparisonPage } from './components/ComparisonPage';
import { DecisionRoutesPage } from './features/routes/DecisionRoutesPage';
import { GuideDrawer } from './assistant/GuideDrawer';
import { GuideProvider } from './assistant/GuideProvider';

/**
 * Router minimo para poder recorrer Parcela -> Opciones sin dependencias.
 * Si el equipo adopta React Router, se reemplaza esto y las vistas no cambian:
 * cada una navega con history.pushState + PopStateEvent.
 */
function PageRouter() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onNavigate = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, []);

  if (path.startsWith('/opciones')) return <ComparisonPage />;
  if (path.startsWith('/plan')) {
    // Vista 03. El handoff llega por query params desde Opciones.
    const p = new URLSearchParams(window.location.search);
    const campaignIndex = Number.parseInt(p.get('campaignIndex') ?? '0', 10);
    return (
      <DecisionRoutesPage
        comparisonId={p.get('comparisonId')}
        alternativeId={p.get('alternativeId')}
        campaignIndex={Number.isFinite(campaignIndex) ? Math.max(0, campaignIndex) : 0}
      />
    );
  }
  return <EntryPage />;
}

/** La Guia (chat) vive fuera de las vistas: acompana al agricultor en las tres. */
export default function App() {
  return (
    <GuideProvider>
      <PageRouter />
      <GuideDrawer />
    </GuideProvider>
  );
}
