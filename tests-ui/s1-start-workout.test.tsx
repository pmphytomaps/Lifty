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

describe('S1 — "Start empty workout" does nothing', () => {
  it('creates a workout and navigates', async () => {
    const view = await renderScreen(<WorkoutTab />);
    expect(await view.findByText('Start empty workout')).toBeTruthy();
    fireEvent.press(view.getByText('Start empty workout'));
    await waitFor(async () => expect(await findUnfinishedWorkout()).not.toBeNull());
    expect(router.push).toHaveBeenCalledWith('/workout/active');
  });

  it('offers resume or discard when a session is already open, and both settle', async () => {
    const routines = await listRoutines();
    await startFromRoutine(routines[0].id);

    const view = await renderScreen(<WorkoutTab />);
    expect(await view.findByText('Start empty workout')).toBeTruthy();
    fireEvent.press(view.getByText('Start empty workout'));

    // The sheet must appear rather than the tap silently doing nothing.
    expect(await view.findByText('Workout in progress')).toBeTruthy();
    expect(view.getByText('Resume it')).toBeTruthy();
    fireEvent.press(view.getByText('Discard it and start fresh'));

    // The stale session must actually go, and a fresh empty one takes its place.
    await waitFor(async () => {
      const now = await findUnfinishedWorkout();
      expect(now).not.toBeNull();
      expect(now!.name).toBe('Workout');
      expect(now!.routine_id).toBeNull();
    });
    const db = getDb();
    const old = await db.get(`SELECT id FROM workout WHERE name = 'Push A'`);
    expect(old).toBeNull();
  });

  it('shows a resume banner whenever an unfinished workout exists', async () => {
    const routines = await listRoutines();
    const wId = await startFromRoutine(routines[0].id);
    await useActiveWorkout.getState().resume(wId!); // store holds it: banner must still show
    const view = await renderScreen(<WorkoutTab />);
    expect(await view.findByText(/in progress/)).toBeTruthy();
  });
})
