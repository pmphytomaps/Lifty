/// <reference types="jest" />
/**
 * Renders every screen against a real database. The previous suite never
 * mounted a component, so dead buttons and blank screens were invisible to it.
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { prepareDb } from './db';
import { renderScreen, setRouteParams } from './harness';
import { useSettings } from '../src/state/settings';
import { useActiveWorkout } from '../src/state/activeWorkout';
import { getDb } from '../src/db/database';
import { createWorkout, addExerciseToWorkout, updateSet, finishWorkout } from '../src/repo/workouts';

import WorkoutTab from '../src/app/(tabs)/index';
import HistoryTab from '../src/app/(tabs)/history';
import StatsTab from '../src/app/(tabs)/stats';
import ExercisePicker from '../src/app/exercise/picker';
import CreateExercise from '../src/app/exercise/create';
import ExerciseDetail from '../src/app/exercise/[id]';
import WorkoutDetail from '../src/app/workout/[id]';
import ActiveWorkout from '../src/app/workout/active';
import FinishWorkout from '../src/app/workout/finish';
import RoutineNew from '../src/app/routine/new';
import SettingsScreen from '../src/app/settings/index';
import ExportScreen from '../src/app/settings/export';
import ProfileScreen from '../src/app/settings/profile';

beforeEach(async () => {
  await prepareDb();
  await useSettings.getState().init();
  useActiveWorkout.setState({ workoutId: null, name: '', startedAt: 0, exercises: [], restEndsAt: null, restTotalS: 0 });
  setRouteParams({});
});

async function seedFinishedWorkout(): Promise<{ workoutId: number; exerciseId: string }> {
  const db = getDb();
  const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Bench Press (Barbell)'`);
  const wId = await createWorkout('Push A', null);
  const weId = await addExerciseToWorkout(wId, ex!.id, 120);
  const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
  await updateSet(s!.id, { weightKg: 60, reps: 8, isCompleted: true });
  await finishWorkout(wId, { name: 'Push A', notes: 'felt good', finishedAt: Date.now(), bodyWeightKg: 70 });
  return { workoutId: wId, exerciseId: ex!.id };
}

describe('every screen renders with real data', () => {
  it('Workout tab', async () => {
    await renderScreen(<WorkoutTab />);
    expect(await screen.findByText('Push A')).toBeTruthy();
    expect(screen.getByText('Start empty workout')).toBeTruthy();
    expect(screen.getByText('Legs B')).toBeTruthy();
    expect(screen.getAllByText('Start routine').length).toBe(6);
  });

  it('History tab, list and calendar', async () => {
    await seedFinishedWorkout();
    await renderScreen(<HistoryTab />);
    expect(await screen.findByText('History')).toBeTruthy();
    expect(screen.getByText('List')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('Push A').length).toBeGreaterThan(0));
  });

  it('Stats tab', async () => {
    await seedFinishedWorkout();
    await renderScreen(<StatsTab />);
    expect(await screen.findByText('Stats')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(await screen.findByText('Workouts')).toBeTruthy();
  });

  it('Exercise picker', async () => {
    await renderScreen(<ExercisePicker />);
    expect(await screen.findByText('Add exercise')).toBeTruthy();
    expect(screen.getByText('All equipment')).toBeTruthy();
    expect(await screen.findByPlaceholderText(/Search \d+ exercises/)).toBeTruthy();
  });

  it('Create exercise', async () => {
    await renderScreen(<CreateExercise />);
    expect(await screen.findByText('New exercise')).toBeTruthy();
    expect(screen.getByText('Weights / reps')).toBeTruthy();
    expect(screen.getByText('Cardio / sport')).toBeTruthy();
    expect(screen.getByText('Create exercise')).toBeTruthy();
  });

  it('Exercise detail', async () => {
    const { exerciseId } = await seedFinishedWorkout();
    setRouteParams({ id: exerciseId });
    await renderScreen(<ExerciseDetail />);
    expect(await screen.findByText('Bench Press (Barbell)')).toBeTruthy();
    expect(await screen.findByText(/Every session/)).toBeTruthy();
  });

  it('Workout detail', async () => {
    const { workoutId } = await seedFinishedWorkout();
    setRouteParams({ id: String(workoutId) });
    await renderScreen(<WorkoutDetail />);
    expect(await screen.findByText('felt good')).toBeTruthy();
    expect(screen.getByText('Delete workout')).toBeTruthy();
  });

  it('Routine editor', async () => {
    await renderScreen(<RoutineNew />);
    expect(await screen.findByText('New routine')).toBeTruthy();
    expect(screen.getByPlaceholderText('Routine name')).toBeTruthy();
    expect(screen.getByText('Add exercise')).toBeTruthy();
  });

  it('Settings', async () => {
    await renderScreen(<SettingsScreen />);
    expect(await screen.findByText('Settings')).toBeTruthy();
    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByText('Rest timer')).toBeTruthy();
    expect(screen.getByText('Export workouts')).toBeTruthy();
    expect(screen.getByText('Never backed up')).toBeTruthy();
  });

  it('Export', async () => {
    await renderScreen(<ExportScreen />);
    expect(await screen.findByText('Export')).toBeTruthy();
    expect(screen.getByText('JSON backup')).toBeTruthy();
    expect(screen.getByText('CSV')).toBeTruthy();
  });

  it('Body and goal', async () => {
    await renderScreen(<ProfileScreen />);
    expect(await screen.findByText('Body & goal')).toBeTruthy();
    expect(screen.getByText('Weight (kg)')).toBeTruthy();
    expect(screen.getAllByText('Done').length).toBe(2); // header action and footer button
  });

  it('Active workout with a live session', async () => {
    const db = getDb();
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Squat (Barbell)'`);
    const wId = await createWorkout('Legs A', null);
    await addExerciseToWorkout(wId, ex!.id, 120);
    await useActiveWorkout.getState().resume(wId);
    await renderScreen(<ActiveWorkout />);
    expect(await screen.findByText('Legs A')).toBeTruthy();
    expect(screen.getByText('Finish')).toBeTruthy();
    expect(screen.getByText('Squat (Barbell)')).toBeTruthy();
    expect(screen.getByText('Discard workout')).toBeTruthy();
  });

  it('Finish screen shows totals and records', async () => {
    const db = getDb();
    const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Squat (Barbell)'`);
    const wId = await createWorkout('Legs A', null);
    const weId = await addExerciseToWorkout(wId, ex!.id, 120);
    const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
    await updateSet(s!.id, { weightKg: 100, reps: 5, isCompleted: true });
    await useActiveWorkout.getState().resume(wId);
    await renderScreen(<FinishWorkout />);
    expect(await screen.findByText('Finish workout')).toBeTruthy();
    expect(screen.getByText('Save workout')).toBeTruthy();
    expect(await screen.findByText(/new record/)).toBeTruthy();
  });
});
