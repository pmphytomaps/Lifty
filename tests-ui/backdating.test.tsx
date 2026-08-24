/// <reference types="jest" />
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderScreen, setRouteParams, settle } from './harness';
import { prepareDb } from './db';
import { useSettings } from '../src/state/settings';
import { useActiveWorkout } from '../src/state/activeWorkout';
import { findUnfinishedWorkout } from '../src/repo/workouts';
import WorkoutTab from '../src/app/(tabs)/index';

beforeEach(async () => {
  await prepareDb();
  await useSettings.getState().init();
  useActiveWorkout.setState({ workoutId: null, name: '', startedAt: 0, exercises: [], restEndsAt: null, restTotalS: 0 });
  setRouteParams({});
});

describe('logging a workout you already did', () => {
  it('starts the session on the chosen day, not today', async () => {
    const view = await renderScreen(<WorkoutTab />);
    await settle();

    fireEvent.press(view.getByTestId('log-past-workout'));
    await settle();

    // The sheet offers an empty session plus every routine.
    expect(view.queryByText('Log a past workout')).toBeTruthy();
    expect(view.queryByText('Empty workout')).toBeTruthy();
    expect(view.queryAllByText('Push A').length).toBeGreaterThanOrEqual(2);

    fireEvent.press(view.getByText('Empty workout'));
    await settle();

    // Date first, then time — the Android sequence.
    const chosen = new Date(2026, 7, 18, 19, 30, 0, 0).getTime();
    fireEvent(view.getByTestId('datetimepicker-date'), 'pick', chosen);
    await settle(300);
    fireEvent(view.getByTestId('datetimepicker-time'), 'pick', chosen);
    await settle();

    const saved = await findUnfinishedWorkout();
    expect(saved).toBeTruthy();
    const at = new Date(saved!.started_at);
    expect(`${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`).toBe('2026-7-18');
    expect(at.getHours()).toBe(19);
    expect(at.getMinutes()).toBe(30);
  });

  it('backing out of the date picker starts nothing', async () => {
    const view = await renderScreen(<WorkoutTab />);
    await settle();
    fireEvent.press(view.getByTestId('log-past-workout'));
    await settle();
    fireEvent.press(view.getByText('Empty workout'));
    await settle();
    fireEvent(view.getByTestId('datetimepicker-date'), 'dismiss');
    await settle();
    expect(await findUnfinishedWorkout()).toBeNull();
  });
});
