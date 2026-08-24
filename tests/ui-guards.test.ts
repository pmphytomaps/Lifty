import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function alertCalls(src: string): string[] {
  const calls: string[] = [];
  const re = /Alert\.alert\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (depth > 0 && i < src.length) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') depth--;
      i++;
    }
    calls.push(src.slice(m.index + m[0].length, i));
  }
  return calls;
}

describe('Android dialog limits', () => {
  /**
   * Android's AlertDialog renders at most three buttons and silently drops the
   * rest, so longer menus must go through the ActionSheet bottom sheet.
   */
  it('no Alert.alert has more than three buttons', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles('src')) {
      const src = readFileSync(file, 'utf8');
      for (const call of alertCalls(src)) {
        const explicit = (call.match(/\btext:/g) ?? []).length;
        const dynamic = call.includes('.map(') && call.includes('text:');
        if (explicit > 3 || dynamic) {
          offenders.push(`${file} (${dynamic ? 'dynamic list' : `${explicit} buttons`})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('text inputs commit while typing', () => {
  /**
   * Tapping a back arrow does not blur a focused TextInput on Android, so a
   * blur-only commit loses the value. NumInput must commit on change.
   */
  it('NumInput wires onChangeText to a committing handler', () => {
    const src = readFileSync('src/components/NumInput.tsx', 'utf8');
    expect(src).toMatch(/onChangeText=\{change\}/);
    expect(src).toMatch(/const change = \(raw: string\)/);
    expect(src.slice(src.indexOf('const change'))).toMatch(/onCommit\(parsed\)/);
  });
});
