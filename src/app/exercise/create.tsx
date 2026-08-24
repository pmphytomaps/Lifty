import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../../components/icons';
import { NumInput } from '../../components/NumInput';
import { Body, Button, Cap, Card, Row, Title } from '../../components/ui';
import { pushCreatedExercise } from '../../lib/pickerBridge';
import { createCustomExercise } from '../../repo/exercises';
import { useTheme } from '../../theme/ThemeContext';
import { EQUIPMENT_TYPES, MUSCLE_GROUPS, equipmentLabel, fonts, muscleColors } from '../../theme/tokens';

export default function CreateExerciseScreen() {
  const { name: initialName } = useLocalSearchParams<{ name?: string }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(initialName ?? '');
  const [category, setCategory] = useState<'strength' | 'cardio'>('strength');
  const [muscle, setMuscle] = useState<string>('Chest');
  const [equipment, setEquipment] = useState<string>('barbell');
  const [met, setMet] = useState<number | null>(6);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name it first', 'Give the exercise a name so you can find it later.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const id = await createCustomExercise({
        name: trimmed,
        equipment: category === 'cardio' ? 'other' : equipment,
        primaryMuscle: category === 'cardio' ? 'Cardio' : muscle,
        category,
        met: category === 'cardio' ? (met ?? 6) : null,
      });
      pushCreatedExercise(id);
      router.back();
    } catch (e) {
      setSaving(false);
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        'Could not create it',
        /UNIQUE|constraint/i.test(msg)
          ? 'An exercise with that name already exists — search for it instead.'
          : msg,
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <BackIcon color={c.emphasisLow} />
        </Pressable>
        <Title style={{ fontSize: 24, flex: 1 }}>New exercise</Title>
      </Row>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Cap>Name</Cap>
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus={!initialName}
            placeholder="e.g. Cable Y-Raise"
            placeholderTextColor={c.dim}
            style={{
              height: 52, borderRadius: 11, backgroundColor: c.input, borderWidth: 1,
              borderColor: c.borderStrong, paddingHorizontal: 14,
              fontFamily: fonts.semibold, fontSize: 17, color: c.text,
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Cap>Type</Cap>
          <Row style={{ gap: 9 }}>
            {(['strength', 'cardio'] as const).map((t) => (
              <Pressable key={t} onPress={() => setCategory(t)} style={{
                flex: 1, height: 46, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                backgroundColor: category === t ? c.accent : 'transparent',
                borderWidth: category === t ? 0 : 1.5, borderColor: c.borderStrong,
              }}>
                <Text style={{
                  fontFamily: fonts.bold, fontSize: 15,
                  color: category === t ? c.onAccent : c.emphasis,
                }}>
                  {t === 'strength' ? 'Weights / reps' : 'Cardio / sport'}
                </Text>
              </Pressable>
            ))}
          </Row>
        </View>

        {category === 'strength' ? (
          <>
            <View style={{ gap: 8 }}>
              <Cap>Main muscle</Cap>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {MUSCLE_GROUPS.filter((m) => m !== 'Cardio').map((m) => {
                  const on = muscle === m;
                  const tint = muscleColors[m];
                  return (
                    <Pressable key={m} onPress={() => setMuscle(m)} style={{
                      paddingHorizontal: 13, height: 38, borderRadius: 999,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: on ? `${tint}2E` : 'transparent',
                      borderWidth: 1.5, borderColor: on ? tint : c.borderStrong,
                    }}>
                      <Text style={{ fontFamily: on ? fonts.bold : fonts.medium, fontSize: 13.5, color: on ? tint : c.emphasis }}>
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Cap>Equipment</Cap>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {EQUIPMENT_TYPES.map((e) => {
                  const on = equipment === e;
                  return (
                    <Pressable key={e} onPress={() => setEquipment(e)} style={{
                      paddingHorizontal: 13, height: 38, borderRadius: 999,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: on ? c.accentSoft : 'transparent',
                      borderWidth: 1.5, borderColor: on ? c.accent : c.borderStrong,
                    }}>
                      <Text style={{ fontFamily: on ? fonts.bold : fonts.medium, fontSize: 13.5, color: on ? c.accent : c.emphasis }}>
                        {equipmentLabel(e)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : (
          <Card style={{ padding: 14, gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Body>Intensity (MET)</Body>
                <Body style={{ fontSize: 11.5, color: c.dim }}>Drives the calorie estimate</Body>
              </View>
              <NumInput width={80} value={met} onCommit={(v) => setMet(v && v > 0 ? v : 6)} />
            </Row>
            <Body style={{ fontSize: 12, color: c.secondary, lineHeight: 17 }}>
              For reference: walking 4 · volleyball 4 · badminton 5.5 · basketball 6.5 · running 9 · skipping 11.
            </Body>
          </Card>
        )}

        <Button label={saving ? 'Creating…' : 'Create exercise'} onPress={save} disabled={saving} />
      </ScrollView>
    </View>
  );
}
