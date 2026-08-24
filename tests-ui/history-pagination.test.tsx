/// <reference types="jest" />
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderScreen, setRouteParams, until } from './harness';
import { prepareDb } from './db';
import { useSettings } from '../src/state/settings';
import { getDb } from '../src/db/database';
import { addExerciseToWorkout, createWorkout, finishWorkout, updateSet } from '../src/repo/workouts';
import HistoryTab from '../src/app/(tabs)/history';

beforeEach(async () => {
  await prepareDb();
  await useSettings.getState().init();
  setRouteParams({});
});

async function logSession(name: string, at: number): Promise<void> {
  const db = getDb();
  const ex = await db.get<{ id: string }>(`SELECT id FROM exercise WHERE name = 'Squat (Barbell)'`);
  const wId = await createWorkout(name, null);
  await db.run(`UPDATE workout SET started_at = ? WHERE id = ?`, [at, wId]);
  const weId = await addExerciseToWorkout(wId, ex!.id, 120);
  const s = await db.get<{ id: number }>(`SELECT id FROM workout_set WHERE workout_exercise_id = ?`, [weId]);
  await updateSet(s!.id, { weightKg: 100, reps: 5, isCompleted: true });
  await finishWorkout(wId, { name, notes: '', finishedAt: at + 3600_000, bodyWeightKg: 70 });
}

describe('history list never shows a workout twice', () => {
  it('end-reached fired while the first page loads does not duplicate it', async () => {
    await logSession('Legs B', Date.now() - 86400_000);
    const view = await renderScreen(<HistoryTab />);

    // FlatList fires onEndReached as soon as content is shorter than the
    // viewport — before the first page has landed.
    const list = await until(() => view.queryByTestId('history-list'));
    fireEvent(list, 'endReached');
    fireEvent(list, 'endReached');

    await until(() => view.queryAllByText('Legs B').length > 0);
    await new Promise((r) => setTimeout(r, 500));
    expect(view.queryAllByText('Legs B')).toHaveLength(1);
  });
});
