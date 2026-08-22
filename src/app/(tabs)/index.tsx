import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GearIcon, PlusIcon, FolderIcon } from '../../components/icons';
import { Body, Button, Cap, Card, Row, Title } from '../../components/ui';
import { daysAgoLabel } from '../../lib/dates';
import { deleteRoutine, duplicateRoutine, listRoutines, type RoutineSummary } from '../../repo/routines';
import { findUnfinishedWorkout } from '../../repo/workouts';
import type { Workout } from '../../repo/types';
import { useActiveWorkout } from '../../state/activeWorkout';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export default function WorkoutTab() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [draft, setDraft] = useState<Workout | null>(null);
  const active = useActiveWorkout();

  const reload = useCallback(() => {
    listRoutines().then(setRoutines).catch(() => {});
    findUnfinishedWorkout().then(setDraft).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const startEmpty = async () => {
    if (await guardDraft()) return;
    await active.startEmpty();
    router.push('/workout/active');
  };

  const startRoutine = async (id: number) => {
    if (await guardDraft()) return;
    if (await active.startRoutine(id)) router.push('/workout/active');
  };

  const guardDraft = async (): Promise<boolean> => {
    const existing = await findUnfinishedWorkout();
    if (!existing) return false;
    return new Promise((resolve) => {
      Alert.alert(
        'Workout in progress',
        `"${existing.name}" is still open. Resume it instead?`,
        [
          { text: 'Resume it', onPress: async () => { if (await active.resume(existing.id)) router.push('/workout/active'); resolve(true); } },
          { text: 'Discard it', style: 'destructive', onPress: async () => { const { discardWorkout } = await import('../../repo/workouts'); await discardWorkout(existing.id); resolve(false); } },
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(true) },
        ],
      );
    });
  };

  const resumeDraft = async () => {
    if (draft && (await active.resume(draft.id))) router.push('/workout/active');
  };

  const routineMenu = (r: RoutineSummary) => {
    Alert.alert(r.name, undefined, [
      { text: 'Edit', onPress: () => router.push(`/routine/${r.id}`) },
      { text: 'Duplicate', onPress: async () => { await duplicateRoutine(r.id); reload(); } },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => Alert.alert('Delete routine?', `"${r.name}" will be removed. Logged workouts stay.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRoutine(r.id); reload(); } },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const grouped = new Map<string, RoutineSummary[]>();
  for (const r of routines) {
    const key = r.folder_name ?? 'Routines';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 28 }}>
      <Row style={{ paddingHorizontal: 16, height: 52, justifyContent: 'space-between' }}>
        <Title style={{ fontSize: 30 }}>Workout</Title>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={{ padding: 6 }}>
          <GearIcon color={c.emphasisLow} />
        </Pressable>
      </Row>

      {draft && draft.id !== active.workoutId && (
        <Pressable onPress={resumeDraft} style={{ marginHorizontal: 16, marginBottom: 12 }}>
          <Row style={{
            minHeight: 56, borderRadius: 12, backgroundColor: c.accentSoft,
            borderWidth: 1, borderColor: c.accentBorder, paddingHorizontal: 14, gap: 12,
          }}>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: c.accent }} />
            <View style={{ flex: 1, paddingVertical: 8 }}>
              <Body style={{ fontFamily: fonts.semibold, fontSize: 14.5 }}>{draft.name} in progress</Body>
              <Body style={{ fontSize: 12, color: c.secondary }}>Started {daysAgoLabel(draft.started_at, Date.now())} — tap to resume</Body>
            </View>
          </Row>
        </Pressable>
      )}

      <Pressable onPress={startEmpty} style={{ marginHorizontal: 16, marginBottom: 18 }}>
        <Row style={{
          height: 50, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
          borderColor: c.borderStrong, justifyContent: 'center', gap: 9,
        }}>
          <PlusIcon color={c.emphasisLow} />
          <Body style={{ fontFamily: fonts.semibold, color: c.emphasisLow }}>Start empty workout</Body>
        </Row>
      </Pressable>

      {[...grouped.entries()].map(([folder, list]) => (
        <View key={folder}>
          <Row style={{ paddingHorizontal: 16, height: 34, gap: 8 }}>
            <FolderIcon color={c.secondary} />
            <Cap style={{ color: c.secondary }}>{folder}</Cap>
            <Body style={{ fontSize: 12, color: c.dim }}>{list.length} routines</Body>
          </Row>
          <View style={{ paddingHorizontal: 16, gap: 12, marginBottom: 20 }}>
            {list.map((r) => (
              <Card key={r.id} style={{ padding: 14 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Title style={{ fontSize: 22 }}>{r.name}</Title>
                  <Pressable onPress={() => routineMenu(r)} hitSlop={12}>
                    <Body style={{ color: c.dim, fontSize: 18 }}>⋮</Body>
                  </Pressable>
                </Row>
                <Body style={{ fontSize: 12.5, color: c.secondary, marginBottom: 8 }}>
                  {r.exercise_count} exercises{r.last_done_at ? ` · last done ${daysAgoLabel(r.last_done_at, Date.now())}` : ''}
                </Body>
                <Body numberOfLines={2} style={{ fontSize: 13, color: c.muted, lineHeight: 19, marginBottom: 11 }}>
                  {r.exercise_names}
                </Body>
                <Button label="Start routine" onPress={() => startRoutine(r.id)} style={{ height: 48 }} />
              </Card>
            ))}
          </View>
        </View>
      ))}

      <View style={{ paddingHorizontal: 16 }}>
        <Button label="New routine" kind="outline" onPress={() => router.push('/routine/new')} />
      </View>
    </ScrollView>
  );
}
