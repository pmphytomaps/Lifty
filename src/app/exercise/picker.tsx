import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon, ChevronDownIcon, SearchIcon } from '../../components/icons';
import { Body, Cap, MuscleChip, Row } from '../../components/ui';
import { firePickerHandler } from '../../lib/pickerBridge';
import { createCustomExercise, listExercises, recentExerciseIds } from '../../repo/exercises';
import type { Exercise } from '../../repo/types';
import { useTheme } from '../../theme/ThemeContext';
import { EQUIPMENT_TYPES, MUSCLE_GROUPS, equipmentLabel, fonts } from '../../theme/tokens';

export default function ExercisePicker() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [equipment, setEquipment] = useState<string | null>(null);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [all, setAll] = useState<Exercise[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    listExercises({ search: search || undefined, equipment, muscle }).then(setAll).catch(() => {});
  }, [search, equipment, muscle]);
  useEffect(() => {
    recentExerciseIds(8).then(setRecents).catch(() => {});
  }, []);

  const data = useMemo(() => {
    if (search || equipment || muscle) return all;
    const recentSet = new Set(recents);
    const rec = recents
      .map((id) => all.find((e) => e.id === id))
      .filter((e): e is Exercise => !!e);
    const rest = all.filter((e) => !recentSet.has(e.id));
    return [...rec, ...rest];
  }, [all, recents, search, equipment, muscle]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    firePickerHandler([...selected]);
    router.back();
  };

  const createCustom = () => {
    if (!search.trim()) {
      Alert.alert('Custom exercise', 'Type the name into the search box first, then tap Create.');
      return;
    }
    const name = search.trim();
    Alert.alert(`Create "${name}"?`, 'Pick the main muscle it trains:', [
      ...['Chest', 'Shoulders', 'Lats', 'Upper Back', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Core'].map((m) => ({
        text: m,
        onPress: async () => {
          const id = await createCustomExercise({ name, equipment: equipment ?? 'other', primaryMuscle: m, category: 'strength' });
          setSelected((prev) => new Set(prev).add(id));
          setSearch('');
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const cycleFilter = (kind: 'equipment' | 'muscle') => {
    const options = kind === 'equipment' ? [...EQUIPMENT_TYPES] : MUSCLE_GROUPS;
    const current = kind === 'equipment' ? equipment : muscle;
    const items = ['All', ...options];
    Alert.alert(kind === 'equipment' ? 'Equipment' : 'Muscle', undefined, [
      ...items.map((o) => ({
        text: o === current ? `• ${equipmentLabel(o)}` : equipmentLabel(o),
        onPress: () => {
          const v = o === 'All' ? null : o;
          if (kind === 'equipment') setEquipment(v);
          else setMuscle(v);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const recentCount = !search && !equipment && !muscle ? recents.filter((id) => all.some((e) => e.id === id)).length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 4 }}>
      <Row style={{ paddingHorizontal: 16, height: 48, justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Body style={{ color: c.secondary, fontSize: 15.5 }}>Cancel</Body>
        </Pressable>
        <Body style={{ fontFamily: fonts.bold, fontSize: 16.5 }}>Add exercise</Body>
        <Pressable onPress={createCustom} hitSlop={10}>
          <Body style={{ color: c.accent, fontFamily: fonts.semibold, fontSize: 15.5 }}>Create</Body>
        </Pressable>
      </Row>

      <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
        <Row style={{
          height: 46, borderRadius: 11, backgroundColor: c.input, borderWidth: 1,
          borderColor: c.border, paddingHorizontal: 13, gap: 10,
        }}>
          <SearchIcon color={c.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${all.length || ''} exercises`}
            placeholderTextColor={c.dim}
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.text, paddingVertical: 0 }}
          />
        </Row>
      </View>

      <Row style={{ paddingHorizontal: 16, gap: 9, marginTop: 11, marginBottom: 6 }}>
        <FilterPill label={equipment ? equipmentLabel(equipment) : 'All equipment'} active={!!equipment} onPress={() => cycleFilter('equipment')} />
        <FilterPill label={muscle ?? 'All muscles'} active={!!muscle} onPress={() => cycleFilter('muscle')} />
      </Row>

      <FlatList
        data={data}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={recentCount > 0 ? <Cap style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>Recent first</Cap> : null}
        renderItem={({ item }) => {
          const on = selected.has(item.id);
          return (
            <Pressable onPress={() => toggle(item.id)}>
              <Row style={{
                minHeight: 62, paddingHorizontal: 16, gap: 12,
                backgroundColor: on ? c.accentSoft : 'transparent',
                borderLeftWidth: on ? 3 : 0, borderLeftColor: c.accent,
                borderTopWidth: 1, borderTopColor: c.divider,
              }}>
                <View style={{ flex: 1, gap: 3, paddingVertical: 9 }}>
                  <Body style={{ fontFamily: fonts.semibold, fontSize: 15.5 }}>{item.name}</Body>
                  <Row style={{ gap: 6 }}>
                    <MuscleChip small muscle={item.primary_muscle} />
                    <Body style={{ fontSize: 11.5, color: c.dim }}>
                      {item.category === 'cardio' ? `${item.met} MET · logged in minutes` : equipmentLabel(item.equipment)}
                    </Body>
                  </Row>
                </View>
                <View style={{
                  width: 26, height: 26, borderRadius: 999,
                  backgroundColor: on ? c.accent : 'transparent',
                  borderWidth: on ? 0 : 1.8, borderColor: c.borderStrong,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {on && <CheckIcon size={16} color={c.onAccent} strokeWidth={3.2} />}
                </View>
              </Row>
            </Pressable>
          );
        }}
      />

      {selected.size > 0 && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 14 }}>
          <Pressable onPress={confirm} style={{
            height: 52, borderRadius: 12, backgroundColor: c.accent,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: c.onAccent }}>
              Add {selected.size} exercise{selected.size > 1 ? 's' : ''}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={{
      flex: 1, height: 38, borderRadius: 999, flexDirection: 'row', alignItems: 'center',
      justifyContent: 'center', gap: 6,
      backgroundColor: active ? c.accentSoft : 'transparent',
      borderWidth: 1, borderColor: active ? c.accentBorder : c.borderStrong,
    }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: active ? c.accent : c.emphasis }}>{label}</Text>
      <ChevronDownIcon size={14} color={active ? c.accent : c.muted} />
    </Pressable>
  );
}
