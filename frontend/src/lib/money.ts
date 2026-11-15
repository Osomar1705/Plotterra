/** Presentation-only FX conversion. The agricultural engine keeps PEN values. */
const configured = Number(import.meta.env.VITE_USD_PEN_RATE ?? 3.405);
export const PEN_PER_USD = Number.isFinite(configured) && configured > 0 ? configured : 3.405;
export const FX_DATE = String(import.meta.env.VITE_USD_RATE_DATE ?? '2026-11-13');
export const FX_NOTICE = `USD display · 1 USD = S/ ${PEN_PER_USD.toFixed(3)} (${FX_DATE} reference, not live)`;

const formatter = new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
export function displayMoney(value:number,currency='PEN') {
  if(!Number.isFinite(value))return '—';
  const usd=currency.toUpperCase()==='PEN'?value/PEN_PER_USD:value;
  return `${usd<0?'−':''}$ ${formatter.format(Math.abs(usd))}`;
}
