import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon } from '../../components/icons';
import { LineChart } from '../../components/charts';
import { Body, Cap, Card, MuscleChip, Row, Title } from '../../components/ui';
import { fmtDate } from '../../lib/dates';
import { fmtWeight } from '../../lib/units';
import { getExercise } from '../../repo/exercises';
import { bestsForExercise } from '../../repo/prs';
import { exerciseSessions, exerciseTrend, type ExercisePoint, type ExerciseSession } from '../../repo/stats';
import type { Exercise, PrKind } from '../../repo/types';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { equipmentLabel, fonts } from '../../theme/tokens';
import { surface } from '../../lib/reportError';

const RANGES = [
  { key: '3M', ms: 92 * 86400000 },
  { key: '1Y', ms: 366 * 86400000 },
  { key: 'All', ms: 0 },
] as const;

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const unit = useSettings((s) => s.unit);
  const { width } = useWindowDimensions();
  const [ex, setEx] = useState<Exercise | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const [trend, setTrend] = useState<ExercisePoint[]>([]);
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [bests, setBests] = useState<Partial<Record<PrKind, { value: number; achieved_at: number }>>>({});

  useEffect(() => {
    if (!id) return;
    getExercise(id).then(setEx).catch(surface('Could not load this exercise.'));
    exerciseSessions(id, 40).then(setSessions).catch(surface('Could not load this exercise.'));
    bestsForExercise(id).then(setBests).catch(surface('Could not load this exercise.'));
  }, [id]);

  useEffect(() => {
    if (!id || !ex) return;
    const since = range.ms === 0 ? 0 : Date.now() - range.ms;
    exerciseTrend(id, ex.category === 'cardio' ? 'duration' : 'e1rm', since).then(setTrend).catch(surface('Could not load this exercise.'));
  }, [id, ex, range]);

  if (!ex) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const isCardio = ex.category === 'cardio';
  const secondary: string[] = (() => { try { return JSON.parse(ex.secondary_muscles); } catch { return []; } })();
  const last = trend[trend.length - 1];
  const first = trend[0];
  const pct = first && last && first.value > 0 ? Math.round(((last.value - first.value) / first.value) * 100) : null;
  const chartPoints = isCardio ? trend.map((p) => ({ ...p, value: Math.round(p.value / 60) })) : trend;

  const fmtVal = (kind: PrKind, v: number): string => {
    if (kind === 'duration') return `${Math.round(v / 60)} min`;
    if (kind === 'reps') return `${v} reps`;
    return `${fmtWeight(v, unit)} ${unit}`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 16, height: 52, gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ marginLeft: -6, padding: 4 }}>
          <BackIcon color={c.emphasisLow} />
        </Pressable>
        <Body numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 16.5, flex: 1 }}>{ex.name}</Body>
      </Row>
      <Row style={{ paddingHorizontal: 16, gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <MuscleChip small muscle={ex.primary_muscle} />
        {secondary.slice(0, 3).map((m) => <MuscleChip key={m} small muscle={m} />)}
        <Body style={{ fontSize: 11.5, color: c.dim, alignSelf: 'center' }}>
          {isCardio ? `${ex.met} MET` : equipmentLabel(ex.equipment)}
        </Body>
      </Row>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 14, paddingBottom: 30 }}>
        <Card style={{ paddingTop: 14, paddingBottom: 10, paddingHorizontal: 12 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 2 }}>
            <Cap>{isCardio ? 'Minutes per session' : 'Estimated 1RM'}</Cap>
            <Row style={{ gap: 4 }}>
              {RANGES.map((r) => (
                <Pressable key={r.key} onPress={() => setRange(r)} style={{
                  height: 24, paddingHorizontal: 10, borderRadius: 999, justifyContent: 'center',
                  backgroundColor: range.key === r.key ? c.borderStrong : 'transparent',
                }}>
                  <Text style={{
                    fontFamily: range.key === r.key ? fonts.bold : fonts.semibold,
                    fontSize: 11.5, color: range.key === r.key ? c.text : c.secondary,
                  }}>{r.key}</Text>
                </Pressable>
              ))}
            </Row>
          </Row>
          {last ? (
            <Row style={{ gap: 8, paddingHorizontal: 2, marginTop: 2, marginBottom: 8, alignItems: 'baseline' }}>
              <Title style={{ fontSize: 30 }}>
                {isCardio ? Math.round(last.value / 60) : fmtWeight(last.value, unit)}
                <Body style={{ fontSize: 14, color: c.secondary }}> {isCardio ? 'min' : unit}</Body>
              </Title>
              {pct != null && pct !== 0 && (
                <Body style={{ fontSize: 12.5, fontFamily: fonts.semibold, color: pct > 0 ? c.good : c.danger }}>
                  {pct > 0 ? '+' : ''}{pct}% in range
                </Body>
              )}
            </Row>
          ) : (
            <Body style={{ color: c.secondary, paddingHorizontal: 2, paddingVertical: 16 }}>
              Nothing logged in this range yet.
            </Body>
          )}
          {chartPoints.length >= 2 && (
            <LineChart points={chartPoints} width={width - 56} height={150} unitLabel={isCardio ? 'min' : unit} />
          )}
        </Card>

        {Object.keys(bests).length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {(isCardio ? (['duration'] as PrKind[]) : (['weight', 'e1rm', 'set_volume', 'reps'] as PrKind[]))
              .filter((k) => bests[k])
              .map((k) => (
                <Card key={k} style={{ width: '48%', flexGrow: 1, padding: 12, gap: 2 }}>
                  <Cap style={{ fontSize: 10 }}>
                    {{ weight: 'Heaviest set', e1rm: 'Best est. 1RM', set_volume: 'Best set volume', reps: 'Most reps', duration: 'Longest session' }[k]}
                  </Cap>
                  <Title style={{ fontSize: 21, color: c.accent }}>{fmtVal(k, bests[k]!.value)}</Title>
                  <Body style={{ fontSize: 11.5, color: c.dim }}>{fmtDate(bests[k]!.achieved_at)}</Body>
                </Card>
              ))}
          </View>
        )}

        <Cap style={{ marginTop: 2 }}>Every session · {sessions.length} logged</Cap>
        {sessions.map((s) => (
          <Pressable key={s.workout_id} onPress={() => router.push(`/workout/${s.workout_id}`)}>
            <Card style={{ padding: 12, gap: 8 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ fontFamily: fonts.bold, fontSize: 14.5 }}>{fmtDate(s.started_at)}</Body>
                <Row style={{ gap: 7 }}>
                  {s.pr === 1 && <Body style={{ fontFamily: fonts.bold, fontSize: 11, color: c.accent }}>PR</Body>}
                  <Body style={{ fontSize: 12, color: c.dim }}>{s.workout_name}</Body>
                </Row>
              </Row>
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                {s.sets.map((set, i) => (
                  <View key={i} style={{
                    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7,
                    backgroundColor: set.is_pr ? c.accentSoft : c.input,
                  }}>
                    <Text style={{
                      fontFamily: set.is_pr ? fonts.bold : fonts.regular, fontSize: 13,
                      color: set.is_pr ? c.accent : c.emphasis,
                    }}>
                      {isCardio
                        ? `${Math.round((set.duration_s ?? 0) / 60)} min`
                        : `${set.weight_kg != null ? fmtWeight(set.weight_kg, unit) : '—'} × ${set.reps ?? '—'}`}
                    </Text>
                  </View>
                ))}
              </Row>
            </Card>
          </Pressable>
        ))}
        {sessions.length === 0 && (
          <Body style={{ color: c.secondary, textAlign: 'center', paddingVertical: 20 }}>
            You haven&apos;t logged this exercise yet.
          </Body>
        )}
      </ScrollView>
    </View>
  );
}
