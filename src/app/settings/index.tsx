import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { BackIcon, ChevronRightIcon, ExportIcon } from '../../components/icons';
import { Body, Cap, Card, Divider, Row, Title } from '../../components/ui';
import { readTextFile } from '../../lib/fileio';
import { ensureBackupReminder } from '../../lib/notify';
import { restoreBackup, validateBackup } from '../../export/backup';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

function daysSince(t: number | null): number | null {
  if (!t) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export default function SettingsScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const s = useSettings();
  const [name, setName] = useState(s.profileName);
  useFocusEffect(useCallback(() => { setName(useSettings.getState().profileName); }, []));

  const backupAge = daysSince(s.lastBackupAt);
  const backupTone = backupAge == null || backupAge > 21 ? c.danger : backupAge > 7 ? c.accent : c.good;
  const backupLabel = s.lastBackupAt == null
    ? 'Never backed up'
    : backupAge === 0 ? 'Backed up today' : `Last backup ${backupAge} day${backupAge === 1 ? '' : 's'} ago`;

  const toggleReminder = async (on: boolean) => {
    await s.setBackupReminder(on);
    const ok = await ensureBackupReminder(on);
    if (on && !ok) {
      Alert.alert('Notifications blocked', 'Allow notifications for Lifty in Android settings to get backup reminders.');
    }
  };

  const restore = async () => {
    Alert.alert(
      'Restore from backup?',
      'This REPLACES everything on this phone with the backup file — workouts, routines, records, settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose file', style: 'destructive',
          onPress: async () => {
            try {
              const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'application/octet-stream', '*/*'] });
              if (res.canceled || !res.assets?.[0]) return;
              const text = await readTextFile(res.assets[0].uri);
              const backup = validateBackup(JSON.parse(text));
              await restoreBackup(backup);
              await s.reload();
              Alert.alert('Restored', 'Your data was replaced with the backup.');
            } catch (e) {
              Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <BackIcon color={c.emphasisLow} />
        </Pressable>
        <Title style={{ fontSize: 26 }}>Settings</Title>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Pressable onPress={() => router.push('/settings/export')}>
          <Row style={{
            borderRadius: 13, backgroundColor: c.accentSoft, borderWidth: 1,
            borderColor: backupTone === c.good ? c.border : c.accentBorder,
            padding: 13, gap: 12,
          }}>
            <ExportIcon color={backupTone} />
            <View style={{ flex: 1, gap: 2 }}>
              <Body style={{ fontFamily: fonts.bold, fontSize: 14.5 }}>{backupLabel}</Body>
              <Body style={{ fontSize: 12, color: c.secondary }}>Your history only lives on this phone.</Body>
            </View>
            <View style={{
              height: 36, paddingHorizontal: 14, borderRadius: 9, backgroundColor: c.accent,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: c.onAccent }}>Back up</Text>
            </View>
          </Row>
        </Pressable>

        <Cap style={{ marginTop: 2 }}>Profile</Cap>
        <Card>
          <Row style={{ minHeight: 56, paddingHorizontal: 14, gap: 12 }}>
            <Body>Name</Body>
            <TextInput
              value={name}
              onChangeText={setName}
              onEndEditing={() => s.setProfileName(name.trim())}
              placeholder="Your name"
              placeholderTextColor={c.dim}
              style={{ flex: 1, textAlign: 'right', fontFamily: fonts.medium, fontSize: 14.5, color: c.emphasisLow, paddingVertical: 0 }}
            />
          </Row>
          <Divider />
          <Pressable onPress={() => router.push('/settings/profile')}>
            <Row style={{ minHeight: 56, paddingHorizontal: 14, gap: 12, justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Body>Body & goal</Body>
                <Body style={{ fontSize: 11.5, color: c.dim }}>Weight, BMR, calorie target</Body>
              </View>
              <ChevronRightIcon color={c.dim} />
            </Row>
          </Pressable>
        </Card>

        <Cap style={{ marginTop: 2 }}>Preferences</Cap>
        <Card>
          <Row style={{ minHeight: 58, paddingHorizontal: 14, justifyContent: 'space-between' }}>
            <Body>Units</Body>
            <Seg options={['kg', 'lb'] as const} value={s.unit} onChange={(u) => s.setUnit(u)} />
          </Row>
          <Divider />
          <Row style={{ minHeight: 58, paddingHorizontal: 14, justifyContent: 'space-between' }}>
            <Body>Theme</Body>
            <Seg options={['dark', 'light', 'auto'] as const} value={s.theme} onChange={(t) => s.setTheme(t)} labels={{ dark: 'Dark', light: 'Light', auto: 'Auto' }} />
          </Row>
          <Divider />
          <Row style={{ minHeight: 58, paddingHorizontal: 14, justifyContent: 'space-between' }}>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Body>Rest timer</Body>
              <Body style={{ fontSize: 11.5, color: c.dim }}>Starts when you complete a set</Body>
            </View>
            <Seg
              options={[0, 90, 120, 150, 180] as const}
              value={s.defaultRestS as 0 | 90 | 120 | 150 | 180}
              onChange={(v) => s.setDefaultRestS(v)}
              labels={{ 0: 'Off', 90: '90s', 120: '2m', 150: '2.5m', 180: '3m' }}
            />
          </Row>
          <Divider />
          <Row style={{ minHeight: 58, paddingHorizontal: 14, justifyContent: 'space-between' }}>
            <View style={{ gap: 2, flexShrink: 1 }}>
              <Body>Backup reminder</Body>
              <Body style={{ fontSize: 11.5, color: c.dim }}>Weekly nudge if you skip backups</Body>
            </View>
            <Switch
              value={s.backupReminder}
              onValueChange={toggleReminder}
              trackColor={{ true: c.accent, false: c.borderStrong }}
              thumbColor={c.text}
            />
          </Row>
        </Card>

        <Cap style={{ marginTop: 2 }}>Data</Cap>
        <Card>
          <Pressable onPress={() => router.push('/settings/export')}>
            <Row style={{ minHeight: 56, paddingHorizontal: 14, justifyContent: 'space-between' }}>
              <Body>Export workouts</Body>
              <ChevronRightIcon color={c.dim} />
            </Row>
          </Pressable>
          <Divider />
          <Pressable onPress={restore}>
            <Row style={{ minHeight: 56, paddingHorizontal: 14, justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Body>Restore from backup</Body>
                <Body style={{ fontSize: 11.5, color: c.dim }}>Replaces everything on this phone</Body>
              </View>
              <ChevronRightIcon color={c.dim} />
            </Row>
          </Pressable>
        </Card>

        <Card>
          <Row style={{ minHeight: 54, paddingHorizontal: 14, justifyContent: 'space-between' }}>
            <Body>About Lifty</Body>
            <Body style={{ color: c.dim, fontSize: 14 }}>v1.0.0 · offline</Body>
          </Row>
        </Card>
      </ScrollView>
    </View>
  );
}

function Seg<T extends string | number>({ options, value, onChange, labels }: {
  options: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>>;
}) {
  const c = useTheme();
  return (
    <Row style={{ height: 34, borderRadius: 9, backgroundColor: c.input, padding: 3, gap: 3 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} style={{
            paddingHorizontal: 11, borderRadius: 7, justifyContent: 'center',
            backgroundColor: on ? c.accent : 'transparent', minWidth: 40, alignItems: 'center',
          }}>
            <Text style={{
              fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 13,
              color: on ? c.onAccent : c.secondary,
            }}>
              {labels?.[o] ?? String(o)}
            </Text>
          </Pressable>
        );
      })}
    </Row>
  );
}
