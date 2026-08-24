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

describe('S4 — Discard does nothing', () => {
  it('confirming discard removes the workout and leaves the screen', async () => {
    const db = getDb();
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Squat (Barbell)'`);
    const wId = await createWorkout('Workout', null);
    await addExerciseToWorkout(wId, ex!.id, 120);
    await useActiveWorkout.getState().resume(wId);

    const view = await renderScreen(<ActiveWorkout />);
    expect(await view.findByText('Discard workout')).toBeTruthy();
    fireEvent.press(view.getByText('Discard workout'));

    // A themed dialog, not a native alert.
    expect(await view.findByText('Discard workout?')).toBeTruthy();
    expect(view.getByText('Keep training')).toBeTruthy();
    fireEvent.press(view.getByText('Discard'));

    await waitFor(async () => expect(await findUnfinishedWorkout()).toBeNull(), { timeout: 3000 });
    expect(useActiveWorkout.getState().workoutId).toBeNull();
  });

  it('cancelling keeps the workout', async () => {
    const wId = await createWorkout('Workout', null);
    await useActiveWorkout.getState().resume(wId);
    const view = await renderScreen(<ActiveWorkout />);
    expect(await view.findByText('Discard workout')).toBeTruthy();
    fireEvent.press(view.getByText('Discard workout'));
    expect(await view.findByText('Keep training')).toBeTruthy();
    fireEvent.press(view.getByText('Keep training'));
    await waitFor(() => expect(view.queryByText('Discard workout?')).toBeNull());
    expect(await findUnfinishedWorkout()).not.toBeNull();
  });
})
