import { create } from 'zustand';
import type { Profile } from '../lib/calories';
import { loadSettings, saveProfile, setSetting, type AppSettings, DEFAULT_SETTINGS } from '../repo/settings';

interface SettingsState extends AppSettings {
  ready: boolean;
  init(): Promise<void>;
  setUnit(u: AppSettings['unit']): Promise<void>;
  setTheme(t: AppSettings['theme']): Promise<void>;
  setProfileName(n: string): Promise<void>;
  setDefaultRestS(s: number): Promise<void>;
  setBackupReminder(on: boolean): Promise<void>;
  markBackupDone(at: number): Promise<void>;
  updateProfile(p: Profile): Promise<void>;
  reload(): Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  ready: false,
  async init() {
    const s = await loadSettings();
    set({ ...s, ready: true });
  },
  async reload() {
    const s = await loadSettings();
    set({ ...s });
  },
  async setUnit(unit) {
    set({ unit });
    await setSetting('unit', unit);
  },
  async setTheme(theme) {
    set({ theme });
    await setSetting('theme', theme);
  },
  async setProfileName(profileName) {
    set({ profileName });
    await setSetting('profile_name', profileName);
  },
  async setDefaultRestS(defaultRestS) {
    set({ defaultRestS });
    await setSetting('default_rest_s', String(defaultRestS));
  },
  async setBackupReminder(backupReminder) {
    set({ backupReminder });
    await setSetting('backup_reminder', backupReminder ? '1' : '0');
  },
  async markBackupDone(at) {
    set({ lastBackupAt: at });
    await setSetting('last_backup_at', String(at));
  },
  async updateProfile(profile) {
    set({ profile });
    await saveProfile(profile);
  },
}));
