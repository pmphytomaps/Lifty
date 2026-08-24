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

describe('History calendar tab', () => {
  it('switches to the calendar and renders the month grid', async () => {
    const view = await renderScreen(<HistoryTab />);
    expect(await view.findByText('Calendar')).toBeTruthy();
    fireEvent.press(view.getByText('Calendar'));
    expect(await view.findByText('Mon')).toBeTruthy();
    expect(view.getByText('Sun')).toBeTruthy();
    expect(view.getByText('This month')).toBeTruthy();
  });
})
