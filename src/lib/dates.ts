export const DAY_MS = 86400000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 of the week containing t (local time). */
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  return d.getTime() - dow * DAY_MS;
}

export function startOfMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function addMonths(t: number, n: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function fmtMonthYear(t: number): string {
  const d = new Date(t);
  const M = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${M[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateShort(t: number): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function fmtDayName(t: number): string {
  return DAYS[new Date(t).getDay()];
}

export function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export function daysAgoLabel(t: number, now: number): string {
  const days = Math.floor((startOfDay(now) - startOfDay(t)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'a month ago' : `${months} months ago`;
}

/** ISO local date key YYYY-MM-DD used for calendar grouping. */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}
