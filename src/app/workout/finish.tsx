import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, TrophyIcon } from '../../components/icons';
import { Body, Button, Cap, Card, Row, Title } from '../../components/ui';
import { fmtDate, fmtTime } from '../../lib/dates';
import { workoutKcal } from '../../lib/calories';
import { fmtVolume, fmtWeight } from '../../lib/units';
import { collectPrCandidates, type PrCandidate } from '../../repo/prs';
import { getExercise } from '../../repo/exercises';
import { useActiveWorkout } from '../../state/activeWorkout';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Pressable } from 'react-native';

const KIND_LABEL: Record<string, string> = {
  weight: 'Heaviest set',
  e1rm: 'Best est. 1RM',
  set_volume: 'Best set volume',
  reps: 'Most reps',
  duration: 'Longest session',
};

export default function FinishScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const store = useActiveWorkout();
  const unit = useSettings((s) => s.unit);
  const bodyWeightKg = useSettings((s) => s.profile.weightKg);
  const [name, setName] = useState(store.name);
  const [notes, setNotes] = useState('');
  const [prs, setPrs] = useState<(PrCandidate & { exerciseName: string })[]>([]);
  const [saving, setSaving] = useState(false);

  const totals = store.totals();
  const durationS = Math.max(0, Math.round((Date.now() - store.startedAt) / 1000));
  const cardioSets = store.exercises
    .filter((e) => e.exercise.category === 'cardio')
    .flatMap((e) => e.sets.filter((s) => s.isCompleted && s.durationS)
      .map((s) => ({ met: e.exercise.met ?? 5, durationS: s.durationS! })));
  const kcal = workoutKcal({ durationS, cardioSets, bodyWeightKg: bodyWeightKg ?? null });

  useEffect(() => {
    if (!store.workoutId) return;
    (async () => {
      const candidates = await collectPrCandidates(store.workoutId!);
      const withNames = [];
      for (const cand of candidates) {
        const ex = await getExercise(cand.exerciseId);
        withNames.push({ ...cand, exerciseName: ex?.name ?? cand.exerciseId });
      }
      setPrs(withNames.filter((p) => ['weight', 'e1rm', 'duration'].includes(p.kind)));
    })().catch(() => {});
  }, [store.workoutId]);

  if (!store.workoutId) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  /** Pop the active-workout stack back to the tabs. */
  const leaveToHome = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await store.finish({
        name: name.trim() || 'Workout',
        notes: notes.trim(),
        finishedAt: Date.now(),
        bodyWeightKg: bodyWeightKg ?? null,
      });
      leaveToHome();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  };

  const discard = () => {
    Alert.alert('Discard workout?', 'All sets logged in this session will be lost.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => { await store.discard(); leaveToHome(); } },
    ]);
  };

  const fmtPr = (p: PrCandidate): string => {
    if (p.kind === 'duration') return `${Math.round(p.value / 60)} min`;
    if (p.kind === 'reps') return `${p.value} reps`;
    return `${fmtWeight(p.value, unit)} ${unit}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <BackIcon color={c.emphasisLow} />
        </Pressable>
        <Body style={{ fontFamily: fonts.bold, fontSize: 17 }}>Finish workout</Body>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Row style={{ gap: 10 }}>
          <Card style={{ flex: 1, padding: 13, gap: 2 }}>
            <Cap style={{ fontSize: 10 }}>Duration</Cap>
            <Title style={{ fontSize: 24 }}>{Math.round(durationS / 60)}<Body style={{ fontSize: 13, color: c.secondary }}> min</Body></Title>
          </Card>
          <Card style={{ flex: 1.3, padding: 13, gap: 2 }}>
            <Cap style={{ fontSize: 10 }}>Volume</Cap>
            <Title style={{ fontSize: 24 }}>{fmtVolume(totals.volumeKg, unit)}<Body style={{ fontSize: 12, color: c.secondary }}> {unit}</Body></Title>
          </Card>
          <Card style={{ flex: 0.8, padding: 13, gap: 2 }}>
            <Cap style={{ fontSize: 10 }}>Sets</Cap>
            <Title style={{ fontSize: 24 }}>{totals.sets}</Title>
          </Card>
        </Row>

        {kcal > 0 && (
          <Card style={{ padding: 13, gap: 2 }}>
            <Cap style={{ fontSize: 10 }}>Estimated burn</Cap>
            <Title style={{ fontSize: 24 }}>{kcal}<Body style={{ fontSize: 13, color: c.secondary }}> kcal</Body></Title>
            <Body style={{ fontSize: 11.5, color: c.dim }}>MET estimate from duration and body weight — set your weight in Settings › Profile</Body>
          </Card>
        )}

        {prs.length > 0 && (
          <Card style={{ padding: 14, borderColor: c.accentBorder, backgroundColor: c.accentSoft }}>
            <Row style={{ gap: 9, marginBottom: 10 }}>
              <TrophyIcon color={c.accent} size={19} />
              <Title style={{ fontSize: 20, color: c.accent }}>
                {prs.length} new record{prs.length > 1 ? 's' : ''}
              </Title>
            </Row>
            {prs.map((p, i) => (
              <Row key={`${p.exerciseId}-${p.kind}`} style={{
                gap: 10, paddingVertical: 9,
                borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.accentBorder,
              }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body style={{ fontFamily: fonts.semibold, fontSize: 14.5 }}>{p.exerciseName}</Body>
                  <Body style={{ fontSize: 12, color: c.secondary }}>
                    {KIND_LABEL[p.kind]}{p.prior > 0 ? ` · was ${fmtPr({ ...p, value: p.prior })}` : ' · first time logged'}
                  </Body>
                </View>
                <Title style={{ fontSize: 19, color: c.accent }}>{fmtPr(p)}</Title>
              </Row>
            ))}
          </Card>
        )}

        <View style={{ gap: 8 }}>
          <Cap>Workout name</Cap>
          <TextInput
            value={name}
            onChangeText={setName}
            style={{
              height: 50, borderRadius: 11, backgroundColor: c.input, borderWidth: 1,
              borderColor: c.borderStrong, paddingHorizontal: 14,
              fontFamily: fonts.semibold, fontSize: 16.5, color: c.text,
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Cap>Notes</Cap>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="How did it go?"
            placeholderTextColor={c.dim}
            style={{
              minHeight: 78, borderRadius: 11, backgroundColor: c.input, borderWidth: 1,
              borderColor: c.borderStrong, paddingHorizontal: 14, paddingTop: 12,
              fontFamily: fonts.regular, fontSize: 14.5, color: c.text, textAlignVertical: 'top',
            }}
          />
        </View>

        <Card style={{ paddingHorizontal: 14, height: 54, justifyContent: 'center' }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body>Date &amp; time</Body>
            <Body style={{ color: c.emphasisLow, fontSize: 14.5 }}>
              {fmtDate(store.startedAt)}, {fmtTime(store.startedAt)}
            </Body>
          </Row>
        </Card>

        <Button label={saving ? 'Saving…' : 'Save workout'} onPress={save} disabled={saving} />
        <Pressable onPress={discard} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <Body style={{ fontFamily: fonts.semibold, color: c.danger }}>Discard workout</Body>
        </Pressable>
      </ScrollView>
    </View>
  );
}
