import { router } from 'expo-router';
import React, { useState } from 'react';
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../../components/icons';
import { NumInput } from '../../components/NumInput';
import { Body, Button, Cap, Card, Divider, Row, Title } from '../../components/ui';
import { ACTIVITY_LEVELS, dailyBudget, type Profile } from '../../lib/calories';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export default function ProfileScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const saved = useSettings((s) => s.profile);
  const updateProfile = useSettings((s) => s.updateProfile);
  const [p, setP] = useState<Profile>(saved);

  const patch = (part: Partial<Profile>) => {
    const next = { ...p, ...part };
    setP(next);
    updateProfile(next);
  };

  const done = () => {
    Keyboard.dismiss();
    updateProfile(p);
    router.back();
  };

  const preview = dailyBudget(p, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <BackIcon color={c.emphasisLow} />
        </Pressable>
        <Title style={{ fontSize: 26, flex: 1 }}>Body &amp; goal</Title>
        <Pressable onPress={done} hitSlop={10}>
          <Body style={{ color: c.accent, fontFamily: fonts.semibold, fontSize: 15.5 }}>Done</Body>
        </Pressable>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Body style={{ fontSize: 13, color: c.secondary, lineHeight: 19 }}>
          Used only to estimate calories burned and how much to eat. Everything stays on this phone
          and saves as you type.
        </Body>

        <Cap>Body</Cap>
        <Card>
          <FieldRow label="Sex">
            <Row style={{ gap: 6 }}>
              {(['male', 'female'] as const).map((sx) => (
                <Pill key={sx} label={sx === 'male' ? 'Male' : 'Female'} active={p.sex === sx} onPress={() => patch({ sex: sx })} />
              ))}
            </Row>
          </FieldRow>
          <Divider />
          <FieldRow label="Birth year">
            <NumInput integer width={90} value={p.birthYear} placeholder="1998"
              onCommit={(v) => patch({ birthYear: v && v > 1900 && v < 2100 ? v : null })} />
          </FieldRow>
          <Divider />
          <FieldRow label="Height (cm)">
            <NumInput width={90} value={p.heightCm} placeholder="178"
              onCommit={(v) => patch({ heightCm: v && v > 90 && v < 250 ? v : null })} />
          </FieldRow>
          <Divider />
          <FieldRow label="Weight (kg)">
            <NumInput width={90} value={p.weightKg} placeholder="70.8"
              onCommit={(v) => patch({ weightKg: v && v > 25 && v < 350 ? v : null })} />
          </FieldRow>
          <Divider />
          <FieldRow label="Measured BMR" hint="From a body scan, if you have one — beats the formula">
            <NumInput integer width={90} value={p.bmrOverride} placeholder="auto"
              onCommit={(v) => patch({ bmrOverride: v && v > 500 ? v : null })} />
          </FieldRow>
        </Card>

        <Cap>Life outside the gym</Cap>
        <Card style={{ padding: 6 }}>
          {ACTIVITY_LEVELS.map((a) => (
            <Pressable key={a.key} onPress={() => patch({ activityFactor: a.factor })} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 9,
              backgroundColor: p.activityFactor === a.factor ? c.accentSoft : 'transparent',
            }}>
              <View style={{
                width: 15, height: 15, borderRadius: 999,
                borderWidth: p.activityFactor === a.factor ? 4.5 : 1.5,
                borderColor: p.activityFactor === a.factor ? c.accent : c.dim,
              }} />
              <Body style={{ fontSize: 14 }}>{a.label}</Body>
            </Pressable>
          ))}
          <Body style={{ fontSize: 11.5, color: c.dim, padding: 10, paddingTop: 4, lineHeight: 16 }}>
            Pick what your day looks like WITHOUT training — logged workouts are added on top, so nothing is counted twice.
          </Body>
        </Card>

        <Cap>Goal</Cap>
        <Card>
          <FieldRow label="Goal weight (kg)">
            <NumInput width={90} value={p.goalWeightKg} placeholder="75"
              onCommit={(v) => patch({ goalWeightKg: v && v > 25 && v < 350 ? v : null })} />
          </FieldRow>
          <Divider />
          <FieldRow label="Pace (kg / week)" hint="0.25 is a steady, sustainable pace">
            <Row style={{ gap: 6 }}>
              {[0.25, 0.5].map((r) => (
                <Pill key={r} label={String(r)} active={p.goalRateKgPerWeek === r} onPress={() => patch({ goalRateKgPerWeek: r })} />
              ))}
            </Row>
          </FieldRow>
        </Card>

        {preview && (
          <Card style={{ padding: 14, gap: 6, borderColor: c.accentBorder }}>
            <Cap>Your numbers</Cap>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ color: c.secondary, fontSize: 13.5 }}>BMR {p.bmrOverride ? '(measured)' : '(estimated)'}</Body>
              <Body style={{ fontFamily: fonts.bold }}>{preview.bmr} kcal</Body>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ color: c.secondary, fontSize: 13.5 }}>Daily life burn</Body>
              <Body style={{ fontFamily: fonts.bold }}>{preview.baseTdee} kcal</Body>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ color: c.secondary, fontSize: 13.5 }}>
                {preview.direction === 'gain' ? 'Surplus for your goal' : preview.direction === 'lose' ? 'Deficit for your goal' : 'Goal adjustment'}
              </Body>
              <Body style={{ fontFamily: fonts.bold, color: c.accent }}>
                {preview.adjustment >= 0 ? '+' : ''}{preview.adjustment} kcal
              </Body>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Body style={{ fontFamily: fonts.semibold }}>Rest-day intake</Body>
              <Title style={{ fontSize: 20, color: c.accent }}>{preview.targetIntake} kcal</Title>
            </Row>
            <Body style={{ fontSize: 11.5, color: c.dim, lineHeight: 16 }}>
              On training days the Stats tab adds what you actually burned in the gym.
            </Body>
          </Card>
        )}
        <Button label="Done" onPress={done} />
      </ScrollView>
    </View>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <Row style={{ minHeight: 58, paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Body>{label}</Body>
        {hint && <Body style={{ fontSize: 11.5, color: c.dim }}>{hint}</Body>}
      </View>
      {children}
    </Row>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={{
      paddingHorizontal: 14, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
      backgroundColor: active ? c.accent : 'transparent',
      borderWidth: active ? 0 : 1, borderColor: c.borderStrong,
    }}>
      <Text style={{ fontFamily: active ? fonts.bold : fonts.semibold, fontSize: 13.5, color: active ? c.onAccent : c.emphasis }}>
        {label}
      </Text>
    </Pressable>
  );
}
