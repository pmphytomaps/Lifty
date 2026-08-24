/**
 * Every non-ASCII character the UI renders must exist in the bundled fonts.
 * A missing glyph shows as a tofu box or silently falls back to a system face
 * with a different weight and baseline — invisible until it is on a phone.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function cmapRanges(path: string): [number, number][] {
  const d = readFileSync(path);
  const numTables = d.readUInt16BE(4);
  let cmapOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (d.subarray(rec, rec + 4).toString('latin1') === 'cmap') cmapOff = d.readUInt32BE(rec + 8);
  }
  if (cmapOff < 0) return [];
  const n = d.readUInt16BE(cmapOff + 2);
  let best = -1;
  for (let i = 0; i < n; i++) {
    const rec = cmapOff + 4 + i * 8;
    const pid = d.readUInt16BE(rec);
    const eid = d.readUInt16BE(rec + 2);
    const off = d.readUInt32BE(rec + 4);
    if ((pid === 3 && (eid === 1 || eid === 10)) || (pid === 0 && (eid === 3 || eid === 4))) {
      best = cmapOff + off;
    }
  }
  if (best < 0 || d.readUInt16BE(best) !== 4) return [];
  const segX2 = d.readUInt16BE(best + 6);
  const seg = segX2 / 2;
  const out: [number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const end = d.readUInt16BE(best + 14 + i * 2);
    const start = d.readUInt16BE(best + 16 + segX2 + i * 2);
    out.push([start, end]);
  }
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('bundled font coverage', () => {
  it('renders every character the UI uses', () => {
    const fonts = readdirSync('assets/fonts')
      .filter((f) => f.endsWith('.ttf'))
      .map((f) => ({ name: f, ranges: cmapRanges(join('assets/fonts', f)) }));
    expect(fonts.length).toBeGreaterThan(0);

    const used = new Map<number, Set<string>>();
    for (const file of sourceFiles('src')) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
        for (const ch of line) {
          const cp = ch.codePointAt(0)!;
          if (cp > 127) {
            if (!used.has(cp)) used.set(cp, new Set());
            used.get(cp)!.add(file);
          }
        }
      }
    }

    const missing: string[] = [];
    for (const [cp, files] of used) {
      const absent = fonts.filter((f) => !f.ranges.some(([s, e]) => cp >= s && cp <= e));
      if (absent.length) {
        missing.push(
          `U+${cp.toString(16).toUpperCase().padStart(4, '0')} "${String.fromCodePoint(cp)}" ` +
          `absent from ${absent.length}/${fonts.length} fonts, used in ${[...files].join(', ')}`,
        );
      }
    }
    expect(missing).toEqual([]);
  });
});
