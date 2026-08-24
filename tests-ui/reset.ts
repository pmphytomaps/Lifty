/// <reference types="jest" />
import { useActionSheetStore } from '../src/components/ActionSheet';
import { useDialogStore } from '../src/components/Dialog';
import { takeCreatedExercises, setPickerHandler } from '../src/lib/pickerBridge';
import { useActiveWorkout } from '../src/state/activeWorkout';
import { useSettings } from '../src/state/settings';
import { prepareDb } from './db';

/**
 * Module-level singletons (the database handle, the zustand stores and the
 * picker bridge) outlive a single test, so every one is reset here. Without
 * this, tests pass alone and fail in sequence — which is exactly the kind of
 * false confidence this suite exists to remove.
 */
export async function resetApp(): Promise<void> {
  await prepareDb();
  await useSettings.getState().init();
  useActiveWorkout.setState({
    workoutId: null, name: '', startedAt: 0, exercises: [], restEndsAt: null, restTotalS: 0,
  });
  useDialogStore.setState({ visible: false, opts: null, resolver: null });
  useActionSheetStore.setState({ visible: false, options: [], chosen: false, onDismiss: undefined });
  takeCreatedExercises();
  setPickerHandler(() => {});
  jest.clearAllMocks();
}
