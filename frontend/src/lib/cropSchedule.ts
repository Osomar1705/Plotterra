import type { Campaign } from '../types/fieldshift';
import { sowingLabel } from './uiCopy';

/** ISO dates are treated as calendar dates, never browser-local timestamps. */
function isoDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
}
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function displayDate(value?: string): string | null {
  const date = isoDate(value);
  return date ? `${date.getUTCDate()} ${MONTH[date.getUTCMonth()]} ${date.getUTCFullYear()}` : null;
}
export function calendarInfo(c: Campaign, sourceResult?: string) {
  const exactSowing = displayDate(c.sowingDate);
  const exactHarvest = displayDate(c.harvestDate);
  const demonstration = sourceResult === 'mock' || c.calendarSource === 'demo';
  return {
    sowing: exactSowing ?? (c.window ? sowingLabel(c.window) : 'Not available'),
    sowingIsExact: Boolean(exactSowing),
    window: c.calendarSource === 'engine' ? null : (c.window ? sowingLabel(c.window) : null),
    harvest: exactHarvest ?? (c.endMonth && /^\d{4}-\d{2}$/.test(c.endMonth)
      ? `${MONTH[Number(c.endMonth.slice(5, 7)) - 1]} ${c.endMonth.slice(0, 4)}` : null),
    hasExactHarvest: Boolean(exactHarvest),
    duration: c.durationDays,
    illustrative: demonstration,
  };
}
export function daysBetween(first?: string, second?: string): number | null {
  const a = isoDate(first), b = isoDate(second);
  return a && b ? Math.round((b.getTime() - a.getTime()) / 86400000) : null;
}
