import { useEffect, useState } from 'react';
import { EntryPage } from './components/EntryPage';
import { ComparisonPage } from './components/ComparisonPage';
import { DecisionRoutesPage } from './features/routes/DecisionRoutesPage';

/**
 * Router minimo para poder recorrer Parcela -> Opciones sin dependencias.
 * Si el equipo adopta React Router, se reemplaza esto y las vistas no cambian:
 * cada una navega con history.pushState + PopStateEvent.
 */
export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onNavigate = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, []);

  if (path.startsWith('/opciones')) return <ComparisonPage />;
  if (path.startsWith('/plan')) {
    // Vista 03 (Integrante 3). El handoff llega por query params desde Opciones.
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
