/**
 * Builds assets/exercises.json from:
 *  - data/free-exercise-db.json  (yuhonas/free-exercise-db, public domain)
 *  - data/extra-exercises.json   (hand-written gap fillers, Hevy-style names)
 *  - data/cardio-exercises.json  (sports/cardio with Compendium MET values)
 *
 * Names are normalised to "Movement (Equipment)". Output is committed so app
 * builds never touch the network.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('data/free-exercise-db.json', 'utf8'));
const extras = JSON.parse(readFileSync('data/extra-exercises.json', 'utf8'));
const cardio = JSON.parse(readFileSync('data/cardio-exercises.json', 'utf8'));

const DROP_CATEGORIES = new Set(['stretching', 'plyometrics', 'cardio']);
const DROP_EQUIPMENT = new Set(['foam roll']);

const EQUIPMENT = {
  barbell: { key: 'barbell', suffix: 'Barbell', words: ['barbell'] },
  dumbbell: { key: 'dumbbell', suffix: 'Dumbbell', words: ['dumbbell', 'dumbbells'] },
  cable: { key: 'cable', suffix: 'Cable', words: ['cable', 'cables'] },
  machine: { key: 'machine', suffix: 'Machine', words: ['machine'] },
  'e-z curl bar': { key: 'ez bar', suffix: 'EZ Bar', words: ['e-z', 'ez-bar'] },
  kettlebells: { key: 'kettlebell', suffix: 'Kettlebell', words: ['kettlebell', 'kettlebells'] },
  bands: { key: 'band', suffix: 'Band', words: ['band', 'bands'] },
  'medicine ball': { key: 'medicine ball', suffix: 'Medicine Ball', words: ['medicine'] },
  'exercise ball': { key: 'stability ball', suffix: 'Stability Ball', words: ['exercise'] },
  'body only': { key: 'bodyweight', suffix: null, words: [] },
  other: { key: 'other', suffix: null, words: [] },
};

const MUSCLE = {
  abdominals: 'Core', hamstrings: 'Hamstrings', adductors: 'Adductors',
  quadriceps: 'Quads', biceps: 'Biceps', shoulders: 'Shoulders', chest: 'Chest',
  'middle back': 'Upper Back', calves: 'Calves', glutes: 'Glutes',
  'lower back': 'Lower Back', lats: 'Lats', triceps: 'Triceps', traps: 'Traps',
  forearms: 'Forearms', neck: 'Neck', abductors: 'Glutes',
};

const SMITH_TOKEN = '@@SMITH@@';

function normaliseName(rawName, eq) {
  let n = rawName.replace(/\s*-\s*(Medium Grip|With Bands)\s*/gi, ' ');
  if (eq.suffix && eq.words.length) {
    n = n.replace(/Smith Machine/gi, SMITH_TOKEN);
    const re = new RegExp('\\b(' + eq.words.join('|') + ')\\b', 'gi');
    n = n.replace(re, '').split(SMITH_TOKEN).join('Smith Machine');
  }
  n = n.replace(/\s{2,}/g, ' ').replace(/\s*-\s*$/, '').replace(/^\s*-\s*/, '').trim();
  return eq.suffix ? n + ' (' + eq.suffix + ')' : n;
}

const out = [];
const seen = new Set();

function push(e) {
  const key = e.name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(e);
}

// Hand-written entries win the name dedup, so add them first.
for (const e of extras) {
  push({ id: e.id, name: e.name, equipment: e.equipment, primaryMuscle: e.primary,
    secondaryMuscles: e.secondary, category: 'strength', met: null });
}
for (const c of cardio) {
  push({ id: c.id, name: c.name, equipment: 'other', primaryMuscle: 'Cardio',
    secondaryMuscles: [], category: 'cardio', met: c.met });
}
let dropped = 0;
for (const x of src) {
  if (DROP_CATEGORIES.has(x.category) || DROP_EQUIPMENT.has(x.equipment)) { dropped++; continue; }
  const eq = EQUIPMENT[x.equipment ?? 'other'] ?? EQUIPMENT.other;
  const primary = MUSCLE[x.primaryMuscles?.[0]] ?? 'Other';
  const secondary = [...new Set((x.secondaryMuscles ?? []).map((m) => MUSCLE[m]).filter((m) => m && m !== primary))];
  push({ id: x.id, name: normaliseName(x.name, eq), equipment: eq.key,
    primaryMuscle: primary, secondaryMuscles: secondary, category: 'strength', met: null });
}

out.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync('assets/exercises.json', JSON.stringify(out, null, 1) + '\n');
console.log('catalog: ' + out.length + ' exercises (' + dropped + ' source rows dropped, ' + extras.length + ' extras, ' + cardio.length + ' cardio)');
