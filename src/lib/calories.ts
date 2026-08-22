export interface Profile {
  sex: 'male' | 'female' | null;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  bmrOverride: number | null;     // measured BMR (e.g. from a body scan)
  activityFactor: number;         // non-exercise lifestyle: 1.2 | 1.375 | 1.55
  goalWeightKg: number | null;
  goalRateKgPerWeek: number;      // magnitude; direction derived from goal vs current
}

export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Mostly sitting', factor: 1.2 },
  { key: 'light', label: 'On my feet some of the day', factor: 1.375 },
  { key: 'moderate', label: 'Active job / lots of walking', factor: 1.55 },
] as const;

export const STRENGTH_MET = 5.0;
export const KCAL_PER_KG = 7700;

/** Mifflin-St Jeor. */
export function mifflinBmr(sex: 'male' | 'female', weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === 'male' ? 5 : -161));
}

export function bmrFor(p: Profile, now = Date.now()): number | null {
  if (p.bmrOverride && p.bmrOverride > 500) return Math.round(p.bmrOverride);
  if (!p.sex || !p.weightKg || !p.heightCm || !p.birthYear) return null;
  const age = new Date(now).getFullYear() - p.birthYear;
  return mifflinBmr(p.sex, p.weightKg, p.heightCm, age);
}

/** kcal for an activity: Compendium approximation MET * kg * hours. */
export function activityKcal(met: number, weightKg: number, durationS: number): number {
  return met * weightKg * (durationS / 3600);
}

export interface WorkoutCalorieInput {
  durationS: number;
  cardioSets: { met: number; durationS: number }[];
  bodyWeightKg: number | null;
}

/** Strength time at STRENGTH_MET plus each cardio set at its own MET. */
export function workoutKcal(w: WorkoutCalorieInput): number {
  if (!w.bodyWeightKg) return 0;
  const cardioS = w.cardioSets.reduce((a, s) => a + s.durationS, 0);
  const strengthS = Math.max(0, w.durationS - cardioS);
  let kcal = activityKcal(STRENGTH_MET, w.bodyWeightKg, strengthS);
  for (const s of w.cardioSets) kcal += activityKcal(s.met, w.bodyWeightKg, s.durationS);
  return Math.round(kcal);
}

export interface DailyBudget {
  bmr: number;
  baseTdee: number;         // bmr * activity, before exercise
  exerciseKcal: number;     // logged workouts today
  adjustment: number;       // +surplus / -deficit from goal
  targetIntake: number;
  direction: 'gain' | 'lose' | 'maintain';
  macros: { proteinG: number; carbsG: number; fatG: number };
}

/**
 * Daily intake target: BMR x non-exercise activity + logged exercise +/- goal rate.
 * Macro split 30P/45C/25F (protein 4, carbs 4, fat 9 kcal/g).
 */
export function dailyBudget(p: Profile, exerciseKcal: number, now = Date.now()): DailyBudget | null {
  const bmr = bmrFor(p, now);
  if (!bmr) return null;
  const baseTdee = Math.round(bmr * p.activityFactor);
  let direction: DailyBudget['direction'] = 'maintain';
  let adjustment = 0;
  if (p.goalWeightKg && p.weightKg && Math.abs(p.goalWeightKg - p.weightKg) >= 0.5 && p.goalRateKgPerWeek > 0) {
    direction = p.goalWeightKg > p.weightKg ? 'gain' : 'lose';
    adjustment = Math.round((p.goalRateKgPerWeek * KCAL_PER_KG) / 7) * (direction === 'gain' ? 1 : -1);
  }
  const targetIntake = Math.max(1200, baseTdee + Math.round(exerciseKcal) + adjustment);
  return {
    bmr, baseTdee, exerciseKcal: Math.round(exerciseKcal), adjustment, targetIntake, direction,
    macros: {
      proteinG: Math.round((targetIntake * 0.30) / 4),
      carbsG: Math.round((targetIntake * 0.45) / 4),
      fatG: Math.round((targetIntake * 0.25) / 9),
    },
  };
}

/** Epley estimated one-rep max. */
export function epley1Rm(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
