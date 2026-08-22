import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from '../../components/icons';
import { NumInput } from '../../components/NumInput';
import { Body, Button, Cap, Card, MuscleChip, Row } from '../../components/ui';
import { setPickerHandler } from '../../lib/pickerBridge';
import { getExercise } from '../../repo/exercises';
import {
  createRoutine, getRoutineDetail, updateRoutine, type RoutineDraft, type RoutineDraftExercise,
} from '../../repo/routines';
import type { Exercise } from '../../repo/types';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

interface DraftEx extends RoutineDraftExercise { exercise: Exercise }

export function RoutineEditor({ routineId }: { routineId: number | null }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<DraftEx[]>([]);
  const [loaded, setLoaded] = useState(routineId == null);

  useEffect(() => {
    if (routineId == null) return;
    (async () => {
      const d = await getRoutineDetail(routineId);
      if (!d) return;
      setName(d.routine.name);
      setNotes(d.routine.notes);
      setFolderId(d.routine.folder_id);
      setExercises(d.exercises.map((e) => ({
        exerciseId: e.exercise_id,
        notes: e.notes,
        restSeconds: e.rest_seconds,
        exercise: e.exercise,
        sets: e.sets.map((s) => ({
          repsMin: s.target_reps_min, repsMax: s.target_reps_max,
          weightKg: s.target_weight_kg, durationS: s.target_duration_s,
        })),
      })));
      setLoaded(true);
    })().catch(() => setLoaded(true));
  }, [routineId]);

  const addExercises = () => {
    setPickerHandler((ids) => {
      (async () => {
        const added: DraftEx[] = [];
        for (const id of ids) {
          const ex = await getExercise(id);
          if (!ex) continue;
          added.push({
            exerciseId: id, notes: '', restSeconds: null, exercise: ex,
            sets: [{ repsMin: 8, repsMax: 10, weightKg: null, durationS: ex.category === 'cardio' ? 1800 : null }],
          });
        }
        setExercises((prev) => [...prev, ...added]);
      })();
    });
    router.push('/exercise/picker');
  };

  const patchEx = (i: number, patch: Partial<DraftEx>) => {
    setExercises((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  };

  const move = (i: number, dir: -1 | 1) => {
    setExercises((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const exMenu = (i: number) => {
    const e = exercises[i];
    Alert.alert(e.exercise.name, undefined, [
      { text: 'Move up', onPress: () => move(i, -1) },
      { text: 'Move down', onPress: () => move(i, 1) },
      { text: 'Rest: app default', onPress: () => patchEx(i, { restSeconds: null }) },
      { text: 'Rest: 90 s', onPress: () => patchEx(i, { restSeconds: 90 }) },
      { text: 'Rest: 180 s', onPress: () => patchEx(i, { restSeconds: 180 }) },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => setExercises((prev) => prev.filter((_, j) => j !== i)),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Give the routine a name');
      return;
    }
    if (!exercises.length) {
      Alert.alert('Add at least one exercise');
      return;
    }
    const draft: RoutineDraft = {
      name: name.trim(), notes: notes.trim(), folderId,
      exercises: exercises.map(({ exercise: _ex, ...rest }) => rest),
    };
    if (routineId == null) await createRoutine(draft);
    else await updateRoutine(routineId, draft);
    router.back();
  };

  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 4 }}>
      <Row style={{ paddingHorizontal: 16, height: 48, justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Body style={{ color: c.secondary, fontSize: 15.5 }}>Cancel</Body>
        </Pressable>
        <Body style={{ fontFamily: fonts.bold, fontSize: 16.5 }}>{routineId == null ? 'New routine' : 'Edit routine'}</Body>
        <Pressable onPress={save} hitSlop={10}>
          <Body style={{ color: c.accent, fontFamily: fonts.semibold, fontSize: 15.5 }}>Save</Body>
        </Pressable>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Routine name"
          placeholderTextColor={c.dim}
          style={{
            height: 52, borderRadius: 11, backgroundColor: c.input, borderWidth: 1,
            borderColor: c.borderStrong, paddingHorizontal: 14,
            fontFamily: fonts.condBold, fontSize: 21, color: c.text,
          }}
        />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Routine notes (optional)"
          placeholderTextColor={c.dim}
          style={{
            height: 44, borderRadius: 11, backgroundColor: c.input, borderWidth: 1,
            borderColor: c.border, paddingHorizontal: 14,
            fontFamily: fonts.regular, fontSize: 14, color: c.text,
          }}
        />

        {exercises.map((e, i) => {
          const isCardio = e.exercise.category === 'cardio';
          return (
            <Card key={`${e.exerciseId}-${i}`} style={{ padding: 12 }}>
              <Row style={{ gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Body style={{ fontFamily: fonts.semibold, fontSize: 16 }}>{e.exercise.name}</Body>
                  <Row style={{ gap: 6 }}>
                    <MuscleChip small muscle={e.exercise.primary_muscle} />
                    {e.restSeconds != null && (
                      <Body style={{ fontSize: 11.5, color: c.dim }}>
                        rest {e.restSeconds === 0 ? 'off' : `${e.restSeconds}s`}
                      </Body>
                    )}
                  </Row>
                </View>
                <Pressable onPress={() => exMenu(i)} hitSlop={12}>
                  <Body style={{ color: c.dim, fontSize: 18 }}>⋮</Body>
                </Pressable>
              </Row>

              <Row style={{ gap: 8, height: 20, paddingHorizontal: 4 }}>
                <Text style={{ width: 30, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 10, color: c.dim }}>SET</Text>
                {isCardio ? (
                  <Text style={{ width: 90, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 10, color: c.dim }}>TARGET MIN</Text>
                ) : (
                  <>
                    <Text style={{ width: 66, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 10, color: c.dim }}>REPS MIN</Text>
                    <Text style={{ width: 66, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 10, color: c.dim }}>REPS MAX</Text>
                  </>
                )}
              </Row>
              {e.sets.map((s, si) => (
                <Row key={si} style={{ gap: 8, paddingHorizontal: 4, minHeight: 46 }}>
                  <Pressable
                    onLongPress={() => patchEx(i, { sets: e.sets.filter((_, sj) => sj !== si) })}
                    style={{ width: 30, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: c.secondary }}>{si + 1}</Text>
                  </Pressable>
                  {isCardio ? (
                    <NumInput
                      integer width={90}
                      value={s.durationS != null ? Math.round(s.durationS / 60) : null}
                      onCommit={(v) => {
                        const sets = e.sets.map((x, sj) => (sj === si ? { ...x, durationS: v != null ? v * 60 : null } : x));
                        patchEx(i, { sets });
                      }}
                    />
                  ) : (
                    <>
                      <NumInput
                        integer width={66} value={s.repsMin}
                        onCommit={(v) => patchEx(i, { sets: e.sets.map((x, sj) => (sj === si ? { ...x, repsMin: v } : x)) })}
                      />
                      <NumInput
                        integer width={66} value={s.repsMax}
                        onCommit={(v) => patchEx(i, { sets: e.sets.map((x, sj) => (sj === si ? { ...x, repsMax: v } : x)) })}
                      />
                    </>
                  )}
                  <View style={{ flex: 1 }} />
                </Row>
              ))}
              <Pressable
                onPress={() => patchEx(i, { sets: [...e.sets, e.sets[e.sets.length - 1] ?? { repsMin: 8, repsMax: 10, weightKg: null, durationS: null }] })}
                style={{
                  height: 38, marginTop: 4, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
                  borderColor: c.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <PlusIcon size={15} color={c.secondary} />
                <Body style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: c.secondary }}>Add set</Body>
              </Pressable>
            </Card>
          );
        })}

        <Button label="Add exercise" onPress={addExercises} />
        <Cap style={{ textAlign: 'center', marginTop: 2 }}>Long-press a set number to remove it</Cap>
      </ScrollView>
    </View>
  );
}
