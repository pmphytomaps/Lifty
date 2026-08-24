import * as Notifications from 'expo-notifications';

const BACKUP_REMINDER_ID = 'lifty-backup-reminder';

/** Keep exactly one weekly backup-reminder notification scheduled (or none). */
export type ReminderResult =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'error'; message?: string };

export async function ensureBackupReminder(enabled: boolean): Promise<ReminderResult> {
  try {
    await Notifications.cancelScheduledNotificationAsync(BACKUP_REMINDER_ID).catch(() => {});
    if (!enabled) return { ok: true };
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.granted;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted;
    }
    if (!granted) return { ok: false, reason: 'denied' };
    await Notifications.scheduleNotificationAsync({
      identifier: BACKUP_REMINDER_ID,
      content: {
        title: 'Back up Lifty',
        body: 'Your training history lives only on this phone. Export a backup — it takes ten seconds.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 7 * 24 * 3600,
        repeats: true,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
