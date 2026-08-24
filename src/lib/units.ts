export type Unit = 'kg' | 'lb';
const KG_PER_LB = 0.45359237;

export function toDisplayWeight(kg: number, unit: Unit): number {
  const v = unit === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(v * 10) / 10;
}

export function fromDisplayWeight(value: number, unit: Unit): number {
  const kg = unit === 'kg' ? value : value * KG_PER_LB;
  return Math.round(kg * 1000) / 1000;
}

/** Format a stored-kg weight for display, no unit suffix. */
export function fmtWeight(kg: number, unit: Unit): string {
  const v = toDisplayWeight(kg, unit);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Format volume like 2 687,5 with thin-space thousands. */
export function fmtVolume(kg: number, unit: Unit): string {
  const v = toDisplayWeight(kg, unit);
  const rounded = Math.round(v * 10) / 10;
  const [int, dec] = rounded.toFixed(1).split('.');
  // A normal space: the bundled Barlow faces have no THIN SPACE glyph.
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec === '0' ? grouped : `${grouped},${dec}`;
}

export function stepFor(equipment: string, unit: Unit): number {
  const coarse = equipment === 'barbell' || equipment === 'machine' || equipment === 'other';
  if (unit === 'kg') return coarse ? 2.5 : 1;
  return coarse ? 5 : 2.5;
}
