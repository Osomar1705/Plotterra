import { useEffect, useState } from 'react';
import { EntryPage } from './components/EntryPage';
import { ComparisonPage } from './components/ComparisonPage';

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
    // Vista 03 (Integrante 3). Mientras no exista, se muestra el handoff recibido.
    const p = new URLSearchParams(window.location.search);
    return (
      <div className="page-center">
        <h2>Vista 03 — Pasaporte de campaña</h2>
        <p>Pendiente del Integrante 3.</p>
        <small>comparisonId: {p.get('comparisonId') ?? '—'} · alternativeId: {p.get('alternativeId') ?? '—'}</small>
      </div>
    );
  }
  return <EntryPage />;
}
