/// <reference types="jest" />
/**
 * One test per bug the user actually hit. These are the checks the old suite
 * could not perform: it never rendered a component and never ran two database
 * operations at once.
 */
import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderScreen, setRouteParams } from './harness';
import { resetApp } from './reset';
import { getDb } from '../src/db/database';
import { useActiveWorkout } from '../src/state/activeWorkout';
import {
  addExerciseToWorkout, createWorkout, findUnfinishedWorkout, startFromRoutine, updateSet,
} from '../src/repo/workouts';
import { listRoutines } from '../src/repo/routines';
import { listExercises } from '../src/repo/exercises';

import WorkoutTab from '../src/app/(tabs)/index';
import HistoryTab from '../src/app/(tabs)/history';
import ExercisePicker from '../src/app/exercise/picker';
import ActiveWorkout from '../src/app/workout/active';

beforeEach(async () => {
  await resetApp();
  setRouteParams({});
});

describe('set logging writes through', () => {
  it('ticking a set persists it and updates the counters', async () => {
    const db = getDb();
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Squat (Barbell)'`);
    const wId = await createWorkout('Legs A', null);
    const weId = await addExerciseToWorkout(wId, ex!.id, 0);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 100, reps: 5 });
    await useActiveWorkout.getState().resume(wId);

    const view = await renderScreen(<ActiveWorkout />);
    expect(await view.findByText('Squat (Barbell)')).toBeTruthy();
    await useActiveWorkout.getState().toggleSet(weId, s!.id, 0);

    const row = await db.get<{ is_completed: number }>(`SELECT is_completed FROM workout_set WHERE id = ?`, [s!.id]);
    expect(row!.is_completed).toBe(1);
    expect(useActiveWorkout.getState().totals()).toEqual({ volumeKg: 500, sets: 1 });
  });
})
