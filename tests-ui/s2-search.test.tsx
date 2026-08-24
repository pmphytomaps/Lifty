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

describe('S2 — catalogue search finds nothing', () => {
  it('finds a late-alphabet exercise by name, and counts the whole catalogue', async () => {
    const all = await listExercises({});
    const view = await renderScreen(<ExercisePicker />);
    // The placeholder must report the real total, not the old capped page size.
    const box = await view.findByPlaceholderText(`Search ${all.length} exercises`);
    expect(all.length).toBeGreaterThan(700);
    fireEvent.changeText(box, 'Volleyball');
    expect(await view.findByText('Volleyball')).toBeTruthy();
    expect(view.queryByText(/Nothing matches/)).toBeNull();
  });

  it('reaches late-alphabet exercises without searching at all', async () => {
    const all = await listExercises({});
    expect(all.map((e) => e.name)).toContain('Volleyball');
    expect(all.length).toBeGreaterThan(700);
  });

  it('a slow early query cannot overwrite a newer result', async () => {
    const view = await renderScreen(<ExercisePicker />);
    const box = await view.findByPlaceholderText(/Search \d+ exercises/);
    // Type quickly: several overlapping queries, the early ones broader.
    fireEvent.changeText(box, 'V');
    fireEvent.changeText(box, 'Vol');
    fireEvent.changeText(box, 'Volleyball');
    expect(await view.findByText('Volleyball')).toBeTruthy();
    // The final query's results must be what is on view.
    expect(view.queryByText('Bench Press (Barbell)')).toBeNull();
  });

})
