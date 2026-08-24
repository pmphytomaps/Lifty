import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { fmtWeight, stepFor, toDisplayWeight, fromDisplayWeight, type Unit } from '../lib/units';
import type { ActiveExercise, ActiveSet } from '../state/activeWorkout';
import { useActiveWorkout } from '../state/activeWorkout';
import { useSettings } from '../state/settings';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { showActionSheet } from './ActionSheet';
import { confirm } from './Dialog';
import { CheckIcon, DotsIcon, PlusIcon } from './icons';
import { MuscleChip, Row, Body, Card } from './ui';
import { NumInput } from './NumInput';

function prevLabel(s: ActiveSet, isCardio: boolean, unit: Unit): string {
  if (!s.prev) return '—';
  if (isCardio) return s.prev.durationS ? `${Math.round(s.prev.durationS / 60)} min` : '—';
  if (s.prev.weightKg == null || s.prev.reps == null) return '—';
  return `${fmtWeight(s.prev.weightKg, unit)} ${unit} × ${s.prev.reps}`;
}

function SetRowView({ ex, s, unit, focusedField, setFocusedField }: {
  ex: ActiveExercise;
  s: ActiveSet;
  unit: Unit;
  focusedField: string | null;
  setFocusedField: (k: string | null) => void;
}) {
  const c = useTheme();
  const store = useActiveWorkout();
  const defaultRestS = useSettings((st) => st.defaultRestS);
  const isCardio = ex.exercise.category === 'cardio';
  const done = s.isCompleted;

  const fillFromPrev = () => {
    if (!s.prev || done) return;
    if (isCardio) {
      store.setField(ex.weId, s.id, 'durationS', s.prev.durationS);
    } else {
      store.setField(ex.weId, s.id, 'weightKg', s.prev.weightKg);
      store.setField(ex.weId, s.id, 'reps', s.prev.reps);
    }
  };

  const removeRow = async () => {
    const yes = await confirm({
      title: 'Remove this set?',
      message: `Set ${s.position + 1} of ${ex.exercise.name}.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (yes) store.removeSetFrom(ex.weId, s.id);
  };

  const weightKey = `${s.id}:w`;
  const repsKey = `${s.id}:r`;
  const showStepper = !done && (focusedField === weightKey || focusedField === repsKey);
  const wStep = stepFor(ex.exercise.equipment, unit);

  const bump = (field: 'weightKg' | 'reps' | 'durationS', delta: number) => {
    if (field === 'weightKg') {
      const cur = s.weightKg != null ? toDisplayWeight(s.weightKg, unit) : 0;
      store.setField(ex.weId, s.id, 'weightKg', fromDisplayWeight(Math.max(0, cur + delta), unit));
    } else if (field === 'reps') {
      store.setField(ex.weId, s.id, 'reps', Math.max(0, (s.reps ?? 0) + delta));
    } else {
      store.setField(ex.weId, s.id, 'durationS', Math.max(0, (s.durationS ?? 0) + delta * 60));
    }
  };

  return (
    <View>
      <Row style={{
        minHeight: 46, gap: 8, paddingHorizontal: 4, borderRadius: 10,
        backgroundColor: done ? c.goodSoft : 'transparent',
      }}>
        <Pressable onLongPress={removeRow} style={{ width: 30, alignItems: 'center' }} hitSlop={8}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: done ? c.good : c.secondary }}>
            {s.position + 1}
          </Text>
        </Pressable>
        <Pressable onPress={fillFromPrev} style={{ flex: 1 }} hitSlop={4}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13.5, color: done ? c.emphasisLow : c.muted }}>
            {prevLabel(s, isCardio, unit)}
          </Text>
        </Pressable>
        {isCardio ? (
          <NumInput
            integer
            width={80}
            completed={done}
            value={s.durationS != null ? Math.round(s.durationS / 60) : null}
            onCommit={(v) => store.setField(ex.weId, s.id, 'durationS', v != null ? v * 60 : null)}
            onFocus={() => setFocusedField(weightKey)}
            onBlur={() => setFocusedField(null)}
          />
        ) : (
          <>
            <NumInput
              width={80}
              completed={done}
              value={s.weightKg != null ? toDisplayWeight(s.weightKg, unit) : null}
              onCommit={(v) => store.setField(ex.weId, s.id, 'weightKg', v != null ? fromDisplayWeight(v, unit) : null)}
              onFocus={() => setFocusedField(weightKey)}
              onBlur={() => setFocusedField(null)}
            />
            <NumInput
              integer
              width={66}
              completed={done}
              value={s.reps}
              onCommit={(v) => store.setField(ex.weId, s.id, 'reps', v)}
              onFocus={() => setFocusedField(repsKey)}
              onBlur={() => setFocusedField(null)}
            />
          </>
        )}
        <Pressable
          onPress={() => store.toggleSet(ex.weId, s.id, defaultRestS)}
          hitSlop={6}
          style={{
            width: 52, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
            backgroundColor: done ? c.good : 'transparent',
            borderWidth: done ? 0 : 1.5, borderColor: c.borderStrong,
          }}
        >
          <CheckIcon color={done ? c.onGood : c.faint} />
        </Pressable>
      </Row>

      {showStepper && (
        <Row style={{ gap: 8, paddingHorizontal: 4, marginTop: 2, marginBottom: 6 }}>
          <View style={{ width: 30 }} />
          <Body style={{ flex: 1, fontSize: 11, color: c.dim }}>tap previous to fill</Body>
          {isCardio ? (
            <Row style={{ width: 80, gap: 5 }}>
              <Stepper label="-5" onPress={() => bump('durationS', -5)} />
              <Stepper label="+5" onPress={() => bump('durationS', 5)} />
            </Row>
          ) : (
            <>
              <Row style={{ width: 80, gap: 5 }}>
                <Stepper label={`-${wStep}`} onPress={() => bump('weightKg', -wStep)} />
                <Stepper label={`+${wStep}`} onPress={() => bump('weightKg', wStep)} />
              </Row>
              <Row style={{ width: 66, gap: 5 }}>
                <Stepper label="-1" onPress={() => bump('reps', -1)} />
                <Stepper label="+1" onPress={() => bump('reps', 1)} />
              </Row>
            </>
          )}
          <View style={{ width: 52 }} />
        </Row>
      )}
    </View>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} style={{
      flex: 1, height: 34, borderRadius: 8, backgroundColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: c.emphasis }}>{label}</Text>
    </Pressable>
  );
}

export function ExerciseLogCard({ ex }: { ex: ActiveExercise }) {
  const c = useTheme();
  const store = useActiveWorkout();
  const unit = useSettings((st) => st.unit);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isCardio = ex.exercise.category === 'cardio';

  const menu = () => {
    const rests: { label: string; value: number | null }[] = [
      { label: 'App default', value: null },
      { label: 'Off', value: 0 },
      { label: '60 seconds', value: 60 },
      { label: '90 seconds', value: 90 },
      { label: '2 minutes', value: 120 },
      { label: '2.5 minutes', value: 150 },
      { label: '3 minutes', value: 180 },
      { label: '4 minutes', value: 240 },
    ];
    showActionSheet({
      title: ex.exercise.name,
      message: 'Rest timer for this exercise',
      options: [
        ...rests.map((r) => ({
          label: r.label,
          selected: ex.restSeconds === r.value,
          onPress: () => store.setExerciseRest(ex.weId, r.value),
        })),
        {
          label: 'Remove exercise',
          hint: 'Its sets in this workout go too',
          destructive: true,
          onPress: async () => {
            const yes = await confirm({
              title: 'Remove exercise?',
              message: 'Its sets in this workout are removed too.',
              confirmLabel: 'Remove',
              destructive: true,
            });
            if (yes) store.removeExercise(ex.weId);
          },
        },
      ],
    });
  };

  return (
    <Card style={{ paddingVertical: 12, paddingHorizontal: 10 }}>
      <Row style={{ gap: 8, paddingHorizontal: 4, marginBottom: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Body style={{ fontFamily: fonts.semibold, fontSize: 16.5 }}>{ex.exercise.name}</Body>
          <Row style={{ gap: 6 }}>
            <MuscleChip small muscle={ex.exercise.primary_muscle} />
            <Body style={{ fontSize: 11.5, color: c.dim }}>
              {isCardio ? `${ex.exercise.met ?? '?'} MET` : ex.exercise.equipment}
            </Body>
          </Row>
        </View>
        <Pressable onPress={menu} hitSlop={12}>
          <DotsIcon size={18} color={c.dim} />
        </Pressable>
      </Row>

      <Row style={{ gap: 8, paddingHorizontal: 4, height: 22 }}>
        <Text style={[hdr(c), { width: 30, textAlign: 'center' }]}>SET</Text>
        <Text style={[hdr(c), { flex: 1 }]}>PREVIOUS</Text>
        {isCardio ? (
          <Text style={[hdr(c), { width: 80, textAlign: 'center' }]}>MIN</Text>
        ) : (
          <>
            <Text style={[hdr(c), { width: 80, textAlign: 'center' }]}>KG</Text>
            <Text style={[hdr(c), { width: 66, textAlign: 'center' }]}>REPS</Text>
          </>
        )}
        <View style={{ width: 52, alignItems: 'center' }}>
          <CheckIcon size={15} color={c.dim} strokeWidth={2.6} />
        </View>
      </Row>

      {ex.sets.map((s) => (
        <SetRowView key={s.id} ex={ex} s={s} unit={unit}
          focusedField={focusedField} setFocusedField={setFocusedField} />
      ))}

      <Pressable onPress={() => store.addSetTo(ex.weId)} style={{
        height: 40, marginTop: 4, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
        borderColor: c.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <PlusIcon size={16} color={c.secondary} />
        <Body style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.secondary }}>Add set</Body>
      </Pressable>
    </Card>
  );
}

function hdr(c: { dim: string }) {
  return { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.8, color: c.dim } as const;
}
