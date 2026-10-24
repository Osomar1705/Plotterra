import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const S = ({size=20,...p}:P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}/>;
export const LeafIcon=(p:P)=><S {...p}><path d="M20 4C12 4 6 8 5 15c3-2 6-3 10-3-4 1-7 3-9 6"/><path d="M5 15c0 3 2 5 5 5 6 0 9-7 10-16"/></S>;
export const WaterIcon=(p:P)=><S {...p}><path d="M12 3S6 10 6 14.5A6 6 0 0018 14.5C18 10 12 3 12 3Z"/><path d="M9.5 15.5c.6 1.2 1.5 1.8 2.8 2"/></S>;
export const CoinsIcon=(p:P)=><S {...p}><ellipse cx="8" cy="7" rx="5" ry="2.5"/><path d="M3 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7M3 11v4c0 1.4 2.2 2.5 5 2.5"/><ellipse cx="16.5" cy="14.5" rx="4.5" ry="2.3"/><path d="M12 14.5V18c0 1.3 2 2.3 4.5 2.3S21 19.3 21 18v-3.5"/></S>;
export const SproutIcon=(p:P)=><S {...p}><path d="M12 21v-9"/><path d="M12 13c-4 0-7-2-7-6 4 0 7 2 7 6ZM12 10c0-4 3-6 7-6 0 4-3 6-7 6Z"/></S>;
export const AlertIcon=(p:P)=><S {...p}><path d="M12 3 2.7 20h18.6L12 3Z"/><path d="M12 9v5M12 17h.01"/></S>;
export const InfoIcon=(p:P)=><S {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></S>;
export const FlaskIcon=(p:P)=><S {...p}><path d="M9 3h6M10 3v6l-5 9c-.7 1.3.2 3 1.7 3h10.6c1.5 0 2.4-1.7 1.7-3l-5-9V3"/><path d="M8 15h8"/></S>;
export const ChatIcon=(p:P)=><S {...p}><path d="M5 5h14v10H9l-4 4V5Z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/></S>;
export const PinIcon=(p:P)=><S {...p}><path d="M12 21s6-6 6-11a6 6 0 10-12 0c0 5 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></S>;
export const ArrowIcon=(p:P)=><S {...p}><path d="M5 12h14M14 7l5 5-5 5"/></S>;
export const CloseIcon=(p:P)=><S {...p}><path d="m6 6 12 12M18 6 6 18"/></S>;
export const SparkIcon=(p:P)=><S {...p}><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3Z"/><path d="m18 14 .9 2.6 2.6.9-2.6.9L18 21l-.9-2.6-2.6-.9 2.6-.9L18 14Z"/></S>;

// --- Vista 01 (Entrada de la parcela) ---
export const PencilIcon=(p:P)=><S {...p}><path d="M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16v4Z"/><path d="M13.5 6.5 17.5 10.5"/></S>;
export const TrashIcon=(p:P)=><S {...p}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></S>;
export const UndoIcon=(p:P)=><S {...p}><path d="M4 9h11a5 5 0 0 1 0 10h-6"/><path d="m8 5-4 4 4 4"/></S>;
export const CalendarIcon=(p:P)=><S {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></S>;
export const CheckIcon=(p:P)=><S {...p}><path d="m5 12 5 5 9-10"/></S>;
export const PlusIcon=(p:P)=><S {...p}><path d="M12 5v14M5 12h14"/></S>;
export const RainIcon=(p:P)=><S {...p}><path d="M7 15a4 4 0 0 1 .6-7.97 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17.5 15"/><path d="M8 18.5v2M12 18v2.5M16 18.5v2"/></S>;
export const ClockIcon=(p:P)=><S {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></S>;
