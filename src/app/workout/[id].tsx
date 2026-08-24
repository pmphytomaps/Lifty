import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirm, notify } from '../../components/Dialog';
import { BackIcon, TrophyIcon } from '../../components/icons';
import { NumInput } from '../../components/NumInput';
import { Body, Button, Cap, Card, MuscleChip, Row, Title } from '../../components/ui';
import { fmtDate, fmtDuration, fmtTime } from '../../lib/dates';
import { fmtVolume, fromDisplayWeight, toDisplayWeight } from '../../lib/units';
import { rebuildAllPrs } from '../../repo/prs';
import { deleteWorkout, getWorkoutDetail, recomputeFinishedWorkout, updateSet, type WorkoutDetail } from '../../repo/workouts';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { surface } from '../../lib/reportError';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const unit = useSettings((s) => s.unit);
  const bodyWeightKg = useSettings((s) => s.profile.weightKg);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  const reload = useCallback(() => {
    getWorkoutDetail(workoutId).then(setDetail).catch(surface('Could not load this workout.'));
  }, [workoutId]);
  useEffect(() => { reload(); }, [reload]);

  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
            <BackIcon color={c.emphasisLow} />
          </Pressable>
          <Title style={{ fontSize: 22 }}>Workout</Title>
        </Row>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Body style={{ color: c.secondary, textAlign: 'center' }}>Loading…</Body>
        </View>
      </View>
    );
  }
  const w = detail.workout;

  const remove = async () => {
    const yes = await confirm({
      title: 'Delete workout?',
      message: 'This session and any personal records it set are removed.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!yes) return;
    try {
      await deleteWorkout(workoutId);
      await rebuildAllPrs();
      router.back();
    } catch (e) {
      await notify('Could not delete', e instanceof Error ? e.message : String(e));
    }
  };

  const stopEditing = async () => {
    setEditing(false);
    if (dirty) {
      await recomputeFinishedWorkout(workoutId, bodyWeightKg ?? null);
      await rebuildAllPrs();
      setDirty(false);
      reload();
    }
  };

  const editSet = async (setId: number, field: 'weightKg' | 'reps' | 'durationS', v: number | null) => {
    await updateSet(setId, { [field]: v } as never);
    setDirty(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <BackIcon color={c.emphasisLow} />
        </Pressable>
        <Title numberOfLines={1} style={{ fontSize: 22, flex: 1 }}>{w.name}</Title>
        <Pressable onPress={editing ? stopEditing : () => setEditing(true)} hitSlop={10}>
          <Body style={{ color: c.accent, fontFamily: fonts.semibold, fontSize: 15.5 }}>
            {editing ? 'Done' : 'Edit'}
          </Body>
        </Pressable>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
        <Body style={{ color: c.secondary, fontSize: 13.5 }}>
          {fmtDate(w.started_at)} · {fmtTime(w.started_at)}
          {w.pr_count > 0 ? ` · ${w.pr_count} record${w.pr_count > 1 ? 's' : ''}` : ''}
        </Body>

        <Row style={{ gap: 10 }}>
          <Card style={{ flex: 1, padding: 12, gap: 2 }}>
            <Cap style={{ fontSize: 10 }}>Duration</Cap>
            <Title style={{ fontSize: 21 }}>{fmtDuration(w.duration_s ?? 0)}</Title>
          </Card>
          <Card style={{ flex: 1.2, padding: 12, gap: 2 }}>
            <Cap style={{ fontSize: 10 }}>Volume</Cap>
            <Title style={{ fontSize: 21 }}>{fmtVolume(w.total_volume_kg, unit)}<Body style={{ fontSize: 12, color: c.secondary }}> {unit}</Body></Title>
          </Card>
          <Card style={{ flex: 0.9, padding: 12, gap: 2 }}>
            <Cap style={{ fontSize: 10 }}>Burn</Cap>
            <Title style={{ fontSize: 21 }}>{Math.round(w.calories_kcal)}<Body style={{ fontSize: 12, color: c.secondary }}> kcal</Body></Title>
          </Card>
        </Row>

        {w.notes ? (
          <Card style={{ padding: 13 }}>
            <Body style={{ fontSize: 14, color: c.emphasisLow, lineHeight: 20 }}>{w.notes}</Body>
          </Card>
        ) : null}

        {detail.exercises.map((e) => {
          const isCardio = e.exercise.category === 'cardio';
          return (
            <Card key={e.id} style={{ padding: 12 }}>
              <Pressable onPress={() => router.push(`/exercise/${e.exercise_id}`)}>
                <Row style={{ gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Body style={{ fontFamily: fonts.semibold, fontSize: 16 }}>{e.exercise.name}</Body>
                    <MuscleChip small muscle={e.exercise.primary_muscle} />
                  </View>
                </Row>
              </Pressable>
              {e.sets.map((s) => (
                <Row key={s.id} style={{ minHeight: editing ? 46 : 32, gap: 10, paddingHorizontal: 4 }}>
                  <Text style={{ width: 26, fontFamily: fonts.bold, fontSize: 14, color: c.secondary }}>{s.position + 1}</Text>
                  {editing ? (
                    isCardio ? (
                      <NumInput integer width={80}
                        value={s.duration_s != null ? Math.round(s.duration_s / 60) : null}
                        onCommit={(v) => editSet(s.id, 'durationS', v != null ? v * 60 : null)} />
                    ) : (
                      <>
                        <NumInput width={80}
                          value={s.weight_kg != null ? toDisplayWeight(s.weight_kg, unit) : null}
                          onCommit={(v) => editSet(s.id, 'weightKg', v != null ? fromDisplayWeight(v, unit) : null)} />
                        <NumInput integer width={66} value={s.reps}
                          onCommit={(v) => editSet(s.id, 'reps', v)} />
                      </>
                    )
                  ) : (
                    <Body style={{ fontSize: 14.5, color: c.emphasis }}>
                      {isCardio
                        ? `${Math.round((s.duration_s ?? 0) / 60)} min`
                        : `${s.weight_kg != null ? toDisplayWeight(s.weight_kg, unit) : '—'} ${unit} × ${s.reps ?? '—'}`}
                    </Body>
                  )}
                  <View style={{ flex: 1 }} />
                </Row>
              ))}
            </Card>
          );
        })}

        <Button label="Delete workout" kind="danger-text" onPress={remove} />
      </ScrollView>
    </View>
  );
}
