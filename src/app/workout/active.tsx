import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { confirm, notify } from '../../components/Dialog';
import { ExerciseLogCard } from '../../components/ExerciseLogCard';
import { ChevronDownIcon } from '../../components/icons';
import { RestBar } from '../../components/RestBar';
import { Body, Button, Cap, Row, Title } from '../../components/ui';
import { fmtClock } from '../../lib/dates';
import { fmtVolume } from '../../lib/units';
import { setPickerHandler } from '../../lib/pickerBridge';
import { useActiveWorkout } from '../../state/activeWorkout';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export default function ActiveWorkoutScreen() {
  useKeepAwake();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const store = useActiveWorkout();
  const unit = useSettings((s) => s.unit);
  const defaultRestS = useSettings((s) => s.defaultRestS);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // No auto-navigation here: discard and finish both navigate explicitly, and a
  // back() fired from this effect would pop the finish screen out from under itself.
  if (!store.workoutId) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
        <Body style={{ color: c.secondary, textAlign: 'center' }}>This workout is no longer open.</Body>
        <Button label="Back to routines" kind="outline" onPress={() => router.replace('/')} style={{ paddingHorizontal: 24 }} />
      </View>
    );
  }

  const totals = store.totals();
  const durationS = Math.max(0, (now - store.startedAt) / 1000);

  const addExercise = () => {
    setPickerHandler((ids) => {
      (async () => {
        for (const id of ids) await store.addExercise(id, defaultRestS);
      })();
    });
    router.push('/exercise/picker');
  };

  const discard = async () => {
    const yes = await confirm({
      title: 'Discard workout?',
      message: 'Every set logged in this session will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep training',
      destructive: true,
    });
    if (!yes) return;
    try {
      await store.discard();
      router.replace('/');
    } catch (e) {
      await notify('Could not discard', e instanceof Error ? e.message : String(e));
    }
  };

  const finish = () => {
    if (totals.sets === 0) {
      notify('Nothing logged yet', 'Tick at least one set before finishing, or discard the workout.');
      return;
    }
    router.push('/workout/finish');
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <ChevronDownIcon size={22} color={c.emphasisLow} />
        </Pressable>
        <Title numberOfLines={1} style={{ fontSize: 22, flex: 1 }}>{store.name}</Title>
        <Pressable onPress={finish} style={{
          height: 38, paddingHorizontal: 18, borderRadius: 10, backgroundColor: c.accent,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.onAccent }}>Finish</Text>
        </Pressable>
      </Row>

      <Row style={{ paddingHorizontal: 16, height: 60, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flex: 1 }}>
          <Cap style={{ fontSize: 10 }}>Duration</Cap>
          <Text style={{ fontFamily: fonts.condBold, fontSize: 23, color: c.accent }}>{fmtClock(durationS)}</Text>
        </View>
        <View style={{ flex: 1.3 }}>
          <Cap style={{ fontSize: 10 }}>Volume</Cap>
          <Text style={{ fontFamily: fonts.condBold, fontSize: 23, color: c.text }}>
            {fmtVolume(totals.volumeKg, unit)}<Text style={{ fontSize: 14, color: c.secondary }}> {unit}</Text>
          </Text>
        </View>
        <View style={{ flex: 0.7 }}>
          <Cap style={{ fontSize: 10 }}>Sets</Cap>
          <Text style={{ fontFamily: fonts.condBold, fontSize: 23, color: c.text }}>{totals.sets}</Text>
        </View>
      </Row>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 130 }}
          keyboardShouldPersistTaps="handled"
        >
          {store.exercises.map((ex) => <ExerciseLogCard key={ex.weId} ex={ex} />)}
          <Button label="Add exercise" kind="outline" onPress={addExercise} />
          <Pressable onPress={discard} style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Body style={{ fontFamily: fonts.semibold, color: c.danger }}>Discard workout</Body>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <RestBar />
    </View>
  );
}
