export function PeacockMark({ size = 64 }: { size?: number }) {
  const feathers = [-52,-26,0,26,52];
  return <svg className="peacock-mark-svg" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="fs-feather" x1="18" y1="8" x2="38" y2="46" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8AD5BC"/>
        <stop offset="1" stopColor="#148478"/>
      </linearGradient>
      <linearGradient id="fs-body" x1="26" y1="30" x2="39" y2="60" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0C8A72"/>
        <stop offset="1" stopColor="#00584D"/>
      </linearGradient>
    </defs>
    <g className="peacock-fan">
      {feathers.map((deg,i)=><g key={deg} transform={`rotate(${deg} 32 43)`}>
        <path d="M32 43C23 36 20 23 25 10C33 16 37 29 32 43Z" fill="url(#fs-feather)" stroke="#F0B95B" strokeWidth="1.6" strokeLinejoin="round"/>
        <circle cx="28.5" cy="17" r="2.7" fill={i%2===0?'#0B4650':'#F0B95B'} opacity=".95"/>
      </g>)}
    </g>
    <path d="M29 39C29 34 31.5 30 35 28.5C36.5 31.5 36.6 35.5 35.5 39.5L34.2 44.2C38.2 46.6 39.5 51 38 55.5C36.6 59.5 33.5 61.5 30.5 60.4C27.4 59.3 25.7 56 26.4 52.2C27 48.8 28.7 46.3 31.2 44.5L29 39Z" fill="url(#fs-body)"/>
    <circle cx="35.8" cy="27.8" r="4.1" fill="#006B57"/>
    <path d="M39.3 27.4L43.2 25.9L39.7 29.2Z" fill="#F0B95B"/>
    <circle cx="37" cy="26.8" r=".8" fill="#fff"/>
  </svg>;
}
