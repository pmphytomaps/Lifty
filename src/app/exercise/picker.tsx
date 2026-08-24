import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showActionSheet } from '../../components/ActionSheet';
import { CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon } from '../../components/icons';
import { Body, Cap, MuscleChip, Row } from '../../components/ui';
import { firePickerHandler, takeCreatedExercises } from '../../lib/pickerBridge';
import { listExercises, recentExerciseIds } from '../../repo/exercises';
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
  const [total, setTotal] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    listExercises({ search: search || undefined, equipment, muscle }).then(setAll).catch(() => {});
  }, [search, equipment, muscle, reloadKey]);

  useEffect(() => {
    listExercises({}).then((e) => setTotal(e.length)).catch(() => {});
    recentExerciseIds(8).then(setRecents).catch(() => {});
  }, [reloadKey]);

  // Exercises created on the New-exercise screen come back selected and ready to add.
  useFocusEffect(useCallback(() => {
    const fresh = takeCreatedExercises();
    if (fresh.length) {
      setSearch('');
      setEquipment(null);
      setMuscle(null);
      setSelected((prev) => new Set([...prev, ...fresh]));
      setReloadKey((k) => k + 1);
    }
  }, []));

  const data = useMemo(() => {
    if (search || equipment || muscle) return all;
    const recentSet = new Set(recents);
    const rec = recents.map((id) => all.find((e) => e.id === id)).filter((e): e is Exercise => !!e);
    return [...rec, ...all.filter((e) => !recentSet.has(e.id))];
  }, [all, recents, search, equipment, muscle]);

  const recentCount = !search && !equipment && !muscle
    ? recents.filter((id) => all.some((e) => e.id === id)).length
    : 0;

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

  const pickFilter = (kind: 'equipment' | 'muscle') => {
    const current = kind === 'equipment' ? equipment : muscle;
    const values = kind === 'equipment' ? [...EQUIPMENT_TYPES] : MUSCLE_GROUPS;
    const apply = (v: string | null) => (kind === 'equipment' ? setEquipment(v) : setMuscle(v));
    showActionSheet({
      title: kind === 'equipment' ? 'Filter by equipment' : 'Filter by muscle',
      options: [
        { label: kind === 'equipment' ? 'All equipment' : 'All muscles', selected: current == null, onPress: () => apply(null) },
        ...values.map((v) => ({
          label: kind === 'equipment' ? equipmentLabel(v) : v,
          selected: current === v,
          onPress: () => apply(v),
        })),
      ],
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 4 }}>
      <Row style={{ paddingHorizontal: 16, height: 48, justifyContent: 'space-between' }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Body style={{ color: c.secondary, fontSize: 15.5 }}>Cancel</Body>
        </Pressable>
        <Body style={{ fontFamily: fonts.bold, fontSize: 16.5 }}>
          {selected.size > 0 ? `${selected.size} selected` : 'Add exercise'}
        </Body>
        <Pressable
          onPress={() => router.push({ pathname: '/exercise/create', params: search.trim() ? { name: search.trim() } : {} })}
          hitSlop={10}
        >
          <Row style={{ gap: 4 }}>
            <PlusIcon size={15} color={c.accent} />
            <Body style={{ color: c.accent, fontFamily: fonts.semibold, fontSize: 15.5 }}>New</Body>
          </Row>
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
            placeholder={total ? `Search ${total} exercises` : 'Search exercises'}
            placeholderTextColor={c.dim}
            returnKeyType="search"
            style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.text, paddingVertical: 0 }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Body style={{ color: c.dim, fontSize: 18 }}>✕</Body>
            </Pressable>
          )}
        </Row>
      </View>

      <Row style={{ paddingHorizontal: 16, gap: 9, marginTop: 11, marginBottom: 6 }}>
        <FilterPill
          label={equipment ? equipmentLabel(equipment) : 'All equipment'}
          active={!!equipment}
          onPress={() => pickFilter('equipment')}
        />
        <FilterPill
          label={muscle ?? 'All muscles'}
          active={!!muscle}
          onPress={() => pickFilter('muscle')}
        />
      </Row>

      <FlatList
        style={{ flex: 1 }}
        data={data}
        keyExtractor={(e) => e.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          recentCount > 0
            ? <Cap style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>Recent first</Cap>
            : null
        }
        ListEmptyComponent={
          <View style={{ padding: 36, alignItems: 'center', gap: 14 }}>
            <Body style={{ color: c.secondary, textAlign: 'center', lineHeight: 21 }}>
              {search.trim()
                ? `Nothing matches “${search.trim()}”.`
                : 'No exercises match those filters.'}
            </Body>
            {search.trim().length > 0 && (
              <Pressable
                onPress={() => router.push({ pathname: '/exercise/create', params: { name: search.trim() } })}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20,
                  borderRadius: 12, backgroundColor: c.accent,
                }}
              >
                <PlusIcon size={17} color={c.onAccent} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: c.onAccent }}>
                  Create “{search.trim()}”
                </Text>
              </Pressable>
            )}
          </View>
        }
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
                      {item.category === 'cardio' ? `${item.met} MET · minutes` : equipmentLabel(item.equipment)}
                    </Body>
                    {item.is_custom === 1 && (
                      <Body style={{ fontSize: 11.5, color: c.dim }}>· custom</Body>
                    )}
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

      {/* In-flow footer, not absolute: with adjustResize it stays above the keyboard. */}
      {selected.size > 0 && (
        <View style={{
          paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12,
          borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.tabBg,
        }}>
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
      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: active ? c.accent : c.emphasis }}>
        {label}
      </Text>
      <ChevronDownIcon size={14} color={active ? c.accent : c.muted} />
    </Pressable>
  );
}
