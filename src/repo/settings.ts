import { getDb } from '../db/database';
import type { Profile } from '../lib/calories';
import type { Unit } from '../lib/units';

export async function getSetting(key: string): Promise<string | null> {
  const row = await getDb().get<{ value: string }>(`SELECT value FROM setting WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await getDb().run(
    `INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export interface AppSettings {
  unit: Unit;
  theme: 'dark' | 'light' | 'auto';
  profileName: string;
  defaultRestS: number;      // 0 = timer off
  backupReminder: boolean;
  lastBackupAt: number | null;
  profile: Profile;
}

export const DEFAULT_SETTINGS: AppSettings = {
  unit: 'kg',
  theme: 'dark',
  profileName: '',
  defaultRestS: 120,
  backupReminder: true,
  lastBackupAt: null,
  profile: {
    sex: null, birthYear: null, heightCm: null, weightKg: null,
    bmrOverride: null, activityFactor: 1.375, goalWeightKg: null, goalRateKgPerWeek: 0.25,
  },
};

function num(v: string | undefined): number | null {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function loadSettings(): Promise<AppSettings> {
  const rows = await getDb().all<{ key: string; value: string }>(`SELECT key, value FROM setting`);
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;
  const d = DEFAULT_SETTINGS;
  return {
    unit: m.unit === 'lb' ? 'lb' : 'kg',
    theme: m.theme === 'light' || m.theme === 'auto' ? m.theme : 'dark',
    profileName: m.profile_name ?? d.profileName,
    defaultRestS: num(m.default_rest_s) ?? d.defaultRestS,
    backupReminder: m.backup_reminder !== '0',
    lastBackupAt: num(m.last_backup_at),
    profile: {
      sex: m.profile_sex === 'male' || m.profile_sex === 'female' ? m.profile_sex : null,
      birthYear: num(m.profile_birth_year),
      heightCm: num(m.profile_height_cm),
      weightKg: num(m.profile_weight_kg),
      bmrOverride: num(m.profile_bmr_override),
      activityFactor: num(m.profile_activity_factor) ?? d.profile.activityFactor,
      goalWeightKg: num(m.goal_weight_kg),
      goalRateKgPerWeek: num(m.goal_rate_kg_week) ?? d.profile.goalRateKgPerWeek,
    },
  };
}

export async function saveProfile(p: Profile): Promise<void> {
  const pairs: [string, string][] = [
    ['profile_sex', p.sex ?? ''],
    ['profile_birth_year', p.birthYear?.toString() ?? ''],
    ['profile_height_cm', p.heightCm?.toString() ?? ''],
    ['profile_weight_kg', p.weightKg?.toString() ?? ''],
    ['profile_bmr_override', p.bmrOverride?.toString() ?? ''],
    ['profile_activity_factor', p.activityFactor.toString()],
    ['goal_weight_kg', p.goalWeightKg?.toString() ?? ''],
    ['goal_rate_kg_week', p.goalRateKgPerWeek.toString()],
  ];
  for (const [k, v] of pairs) await setSetting(k, v);
}
