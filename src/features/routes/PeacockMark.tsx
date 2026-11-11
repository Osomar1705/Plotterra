import { useId } from 'react';

/**
 * Muyu, el pavo real de FieldShift. Ilustracion propia hecha en codigo.
 * Decorativa por defecto: en el abanico va acompanada de texto que ya nombra
 * el origen, asi que repetirla en el lector de pantalla seria ruido.
 */
export function PeacockMark({
  size = 112,
  decorative = true,
}: {
  size?: number;
  decorative?: boolean;
}) {
  const titleId = useId();
  return (
    <svg
      className="dr-peacock-mark"
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-labelledby={decorative ? undefined : titleId}
    >
      {!decorative && <title id={titleId}>Muyu, el pavo real de FieldShift</title>}
      <g stroke="#0B3444" strokeWidth="1.2" strokeLinejoin="round">
        {[-64, -32, 0, 32, 64].map((angle, i) => (
          <g key={angle} transform={`rotate(${angle} 80 130)`}>
            <path d="M80 132C49 108 53 45 80 24C107 45 111 108 80 132Z" fill={i % 2 ? '#087566' : '#126F79'} />
            <path d="M80 127V49" stroke="#B9DAC8" strokeWidth="1" />
            <ellipse cx="80" cy="59" rx="14" ry="19" fill="#D8C784" stroke="none" />
            <ellipse cx="80" cy="59" rx="10" ry="14" fill="#25A39F" stroke="none" />
            <ellipse cx="80" cy="59" rx="6" ry="9" fill="#254D9B" stroke="none" />
            <ellipse cx="81" cy="57" rx="3" ry="5" fill="#0B3444" stroke="none" />
          </g>
        ))}
      </g>
      <path d="M73 140L69 151M89 140L94 151M65 152H74M90 152H100" stroke="#96742D" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M66 132C60 108 77 103 78 89L77 71C76 54 96 51 102 64C105 72 97 77 92 76L93 97C107 113 103 133 87 140C77 144 68 141 66 132Z" fill="#155D8B" stroke="#0B3444" strokeWidth="1.5" />
      <path d="M78 104C62 109 67 131 85 133C92 125 92 112 78 104Z" fill="#00858D" stroke="#0B3444" strokeWidth="1.2" />
      <path d="M100 65L112 70L100 73Z" fill="#B38D36" />
      <path d="M94 61L103 64L96 70L90 66Z" fill="#E4F0E8" />
      <circle cx="98" cy="65" r="2" fill="#0B3444" />
      <path d="M86 56L82 46M90 55L91 43M94 56L99 47" stroke="#155D8B" strokeWidth="1.8" />
      <g fill="#00858D">
        <circle cx="82" cy="45" r="3" />
        <circle cx="91" cy="42" r="3" />
        <circle cx="100" cy="46" r="3" />
      </g>
    </svg>
  );
}
