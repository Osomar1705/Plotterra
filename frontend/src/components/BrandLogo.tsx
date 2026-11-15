/**
 * Marca Plotterra: la P con la hoja y los surcos, mas el nombre.
 * El icono es SVG en linea (nitido a cualquier tamano); el nombre usa la letra Outfit.
 */
export function PlotterraMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path fill="#163726" fillRule="evenodd" d="M22 9 H66 C83.5 9 95 20.5 95 35.5 C95 51.5 83 62.5 67.5 62.5 C58 62.5 51.5 58.5 42 57.5 C33 56.6 24 58.2 13.5 61 Z M33.5 56.8 C32.3 41 39.5 28.5 52.5 23 C61 19.5 70.5 18.6 81 18.2 C79 30.5 74.5 42 65 49.5 C57 55.4 46.5 56.8 33.5 56.8 Z" />
      <path fill="#6F993A" d="M36.2 55.2 C35.8 43.5 41.5 33.2 52 27.2 C55.5 25.2 59.2 23.9 63.5 23 C53.5 31 45.5 41.5 41.2 55 C39.5 55.1 37.8 55.2 36.2 55.2 Z" />
      <path fill="#6F993A" d="M15.5 66.2 C36 61.6 57 63 74.5 74.2 C50.5 71.6 28.5 79.6 11 92.5 Z" />
      <path fill="#6F993A" d="M16.2 97.5 C30.5 85 50 77.4 74.5 76.4 C58.5 80.5 46.5 88.5 34.2 97.5 Z" />
      <path fill="#6F993A" d="M41 97.5 C49.5 88 60 81.8 71.5 79.6 C64 85 59.5 90.5 56 97.5 Z" />
    </svg>
  );
}

export function BrandLogo() {
  return (
    <a className="brand brand--plotterra" href="/" aria-label="Plotterra, home">
      <PlotterraMark />
      <span className="brand-divider" aria-hidden="true" />
      <span className="brand-name">Plotterra</span>
    </a>
  );
}
