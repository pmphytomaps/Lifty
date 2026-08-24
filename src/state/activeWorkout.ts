import { create } from 'zustand';
import { reportError } from '../lib/reportError';
import type { Exercise, WorkoutSet } from '../repo/types';
import {
  addExerciseToWorkout, addSet, createWorkout, discardWorkout, finishWorkout, setExerciseRestSeconds,
  getWorkoutDetail, previousSets, removeSet, removeWorkoutExercise,
  startFromRoutine, updateSet, type FinishResult,
} from '../repo/workouts';

export interface ActiveSet {
  id: number;
  position: number;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  isCompleted: boolean;
  prev: { weightKg: number | null; reps: number | null; durationS: number | null } | null;
}

export interface ActiveExercise {
  weId: number;
  exercise: Exercise;
  restSeconds: number | null;
  sets: ActiveSet[];
}

interface ActiveWorkoutState {
  workoutId: number | null;
  name: string;
  startedAt: number;
  exercises: ActiveExercise[];
  restEndsAt: number | null;
  restTotalS: number;
  startEmpty(): Promise<void>;
  startRoutine(routineId: number): Promise<boolean>;
  resume(workoutId: number): Promise<boolean>;
  setField(weId: number, setId: number, field: 'weightKg' | 'reps' | 'durationS', value: number | null): Promise<void>;
  toggleSet(weId: number, setId: number, defaultRestS: number): Promise<void>;
  addSetTo(weId: number): Promise<void>;
  removeSetFrom(weId: number, setId: number): Promise<void>;
  addExercise(exerciseId: string, defaultRestS: number): Promise<void>;
  removeExercise(weId: number): Promise<void>;
  setExerciseRest(weId: number, restSeconds: number | null): Promise<void>;
  finish(opts: { name: string; notes: string; finishedAt: number; bodyWeightKg: number | null }): Promise<FinishResult>;
  discard(): Promise<void>;
  adjustRest(deltaS: number): void;
  skipRest(): void;
  totals(): { volumeKg: number; sets: number };
}

async function hydrate(workoutId: number): Promise<Pick<ActiveWorkoutState, 'workoutId' | 'name' | 'startedAt' | 'exercises'> | null> {
  const detail = await getWorkoutDetail(workoutId);
  if (!detail || detail.workout.finished_at != null) return null;
  const exercises: ActiveExercise[] = [];
  for (const e of detail.exercises) {
    const prev = await previousSets(e.exercise_id);
    exercises.push({
      weId: e.id,
      exercise: e.exercise,
      restSeconds: e.rest_seconds,
      sets: e.sets.map((s: WorkoutSet) => ({
        id: s.id,
        position: s.position,
        weightKg: s.weight_kg,
        reps: s.reps,
        durationS: s.duration_s,
        isCompleted: !!s.is_completed,
        prev: prev[s.position]
          ? { weightKg: prev[s.position].weight_kg, reps: prev[s.position].reps, durationS: prev[s.position].duration_s }
          : null,
      })),
    });
  }
  return { workoutId, name: detail.workout.name, startedAt: detail.workout.started_at, exercises };
}

export const useActiveWorkout = create<ActiveWorkoutState>((set, get) => ({
  workoutId: null,
  name: '',
  startedAt: 0,
  exercises: [],
  restEndsAt: null,
  restTotalS: 0,

  async startEmpty() {
    const id = await createWorkout('Workout', null);
    const s = await hydrate(id);
    if (s) set({ ...s, restEndsAt: null, restTotalS: 0 });
  },

  async startRoutine(routineId) {
    const id = await startFromRoutine(routineId);
    if (!id) return false;
    const s = await hydrate(id);
    if (!s) return false;
    set({ ...s, restEndsAt: null, restTotalS: 0 });
    return true;
  },

  async resume(workoutId) {
    const s = await hydrate(workoutId);
    if (!s) return false;
    set({ ...s, restEndsAt: null, restTotalS: 0 });
    return true;
  },

  async setField(weId, setId, field, value) {
    const before = get().exercises
      .find((e) => e.weId === weId)?.sets.find((s) => s.id === setId)?.[field] ?? null;
    set((st) => ({
      exercises: st.exercises.map((e) => e.weId !== weId ? e : {
        ...e,
        sets: e.sets.map((s) => (s.id === setId ? { ...s, [field]: value } : s)),
      }),
    }));
    try {
      await updateSet(setId, { [field]: value } as never);
    } catch (e) {
      // Roll the optimistic edit back so the screen cannot claim a value the
      // database never accepted.
      set((st) => ({
        exercises: st.exercises.map((ex) => ex.weId !== weId ? ex : {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, [field]: before } : s)),
        }),
      }));
      reportError('That set could not be saved.', e);
    }
  },

  async toggleSet(weId, setId, defaultRestS) {
    const st = get();
    const ex = st.exercises.find((e) => e.weId === weId);
    const target = ex?.sets.find((s) => s.id === setId);
    if (!ex || !target) return;
    const completing = !target.isCompleted;
    set((cur) => ({
      exercises: cur.exercises.map((e) => e.weId !== weId ? e : {
        ...e,
        sets: e.sets.map((s) => (s.id === setId ? { ...s, isCompleted: completing } : s)),
      }),
    }));
    try {
      await updateSet(setId, { isCompleted: completing });
    } catch (e) {
      set((cur) => ({
        exercises: cur.exercises.map((ex) => ex.weId !== weId ? ex : {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, isCompleted: !completing } : s)),
        }),
      }));
      reportError('That set could not be saved.', e);
      return;
    }
    if (completing && ex.exercise.category === 'strength') {
      const rest = ex.restSeconds ?? defaultRestS;
      if (rest > 0) set({ restEndsAt: Date.now() + rest * 1000, restTotalS: rest });
    }
    if (!completing) set({ restEndsAt: null });
  },

  async addSetTo(weId) {
    let newId: number;
    try {
      newId = await addSet(weId);
    } catch (e) {
      reportError('Could not add a set.', e);
      return;
    }
    set((st) => ({
      exercises: st.exercises.map((e) => {
        if (e.weId !== weId) return e;
        const last = e.sets[e.sets.length - 1];
        const position = (last?.position ?? -1) + 1;
        return {
          ...e,
          sets: [...e.sets, {
            id: newId,
            position,
            weightKg: last?.weightKg ?? null,
            reps: last?.reps ?? null,
            durationS: last?.durationS ?? null,
            isCompleted: false,
            prev: null,
          }],
        };
      }),
    }));
  },

  async removeSetFrom(weId, setId) {
    try {
      await removeSet(setId);
    } catch (e) {
      reportError('Could not remove that set.', e);
      return;
    }
    set((st) => ({
      exercises: st.exercises.map((e) => e.weId !== weId ? e : {
        ...e,
        sets: e.sets.filter((s) => s.id !== setId),
      }),
    }));
  },

  async addExercise(exerciseId, defaultRestS) {
    const st = get();
    if (!st.workoutId) return;
    await addExerciseToWorkout(st.workoutId, exerciseId, defaultRestS);
    const s = await hydrate(st.workoutId);
    if (s) set(s);
  },

  async removeExercise(weId) {
    await removeWorkoutExercise(weId);
    set((st) => ({ exercises: st.exercises.filter((e) => e.weId !== weId) }));
  },

  async setExerciseRest(weId, restSeconds) {
    set((st) => ({
      exercises: st.exercises.map((e) => (e.weId === weId ? { ...e, restSeconds } : e)),
    }));
    try {
      await setExerciseRestSeconds(weId, restSeconds);
    } catch (e) {
      reportError('Could not change the rest timer.', e);
    }
  },

  async finish(opts) {
    const st = get();
    if (!st.workoutId) throw new Error('No active workout');
    const result = await finishWorkout(st.workoutId, opts);
    set({ workoutId: null, name: '', startedAt: 0, exercises: [], restEndsAt: null, restTotalS: 0 });
    return result;
  },

  async discard() {
    const st = get();
    if (st.workoutId) await discardWorkout(st.workoutId);
    set({ workoutId: null, name: '', startedAt: 0, exercises: [], restEndsAt: null, restTotalS: 0 });
  },

  adjustRest(deltaS) {
    const st = get();
    if (!st.restEndsAt) return;
    set({
      restEndsAt: Math.max(Date.now() + 1000, st.restEndsAt + deltaS * 1000),
      restTotalS: Math.max(1, st.restTotalS + deltaS),
    });
  },

  skipRest() {
    set({ restEndsAt: null });
  },

  totals() {
    const st = get();
    let volumeKg = 0;
    let sets = 0;
    for (const e of st.exercises) {
      for (const s of e.sets) {
        if (!s.isCompleted) continue;
        sets++;
        if (e.exercise.category === 'strength') volumeKg += (s.weightKg ?? 0) * (s.reps ?? 0);
      }
    }
    return { volumeKg, sets };
  },
}));
