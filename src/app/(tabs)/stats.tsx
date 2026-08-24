import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart } from '../../components/charts';
import { ChevronRightIcon, FlameIcon, GearIcon, TrophyIcon } from '../../components/icons';
import { Body, Cap, Card, Row, Title } from '../../components/ui';
import { dailyBudget, type DailyBudget } from '../../lib/calories';
import { fmtDateShort } from '../../lib/dates';
import { fmtWeight } from '../../lib/units';
import { recentPrs, type PrRow } from '../../repo/prs';
import { allTimeTotals, kcalToday, mostTrained, sessionsPerWeek, type Totals } from '../../repo/stats';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

const KIND_SHORT: Record<string, string> = {
  weight: 'Heaviest set', e1rm: 'Best est. 1RM', set_volume: 'Best set volume',
  reps: 'Most reps', duration: 'Longest session',
};

export default function StatsTab() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const unit = useSettings((s) => s.unit);
  const profile = useSettings((s) => s.profile);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [weeks, setWeeks] = useState<{ weekStart: number; count: number }[]>([]);
  const [prs, setPrs] = useState<PrRow[]>([]);
  const [trained, setTrained] = useState<{ exercise_id: string; name: string; sessions: number }[]>([]);
  const [budget, setBudget] = useState<DailyBudget | null>(null);
  const [burnedToday, setBurnedToday] = useState(0);

  useFocusEffect(useCallback(() => {
    allTimeTotals().then(setTotals).catch(() => {});
    sessionsPerWeek(12).then(setWeeks).catch(() => {});
    recentPrs(8).then(setPrs).catch(() => {});
    mostTrained(5).then(setTrained).catch(() => {});
    kcalToday().then((kcal) => {
      setBurnedToday(kcal);
      setBudget(dailyBudget(profile, kcal));
    }).catch(() => {});
  }, [profile]));

  const fmtPrVal = (p: PrRow): string => {
    if (p.kind === 'duration') return `${Math.round(p.value / 60)} min`;
    if (p.kind === 'reps') return `${p.value} reps`;
    return `${fmtWeight(p.value, unit)} ${unit}`;
  };

  const maxTrained = trained[0]?.sessions ?? 1;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 28 }}
    >
      <Row style={{ paddingHorizontal: 16, height: 52, justifyContent: 'space-between' }}>
        <Title style={{ fontSize: 30 }}>Stats</Title>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={{ padding: 6 }}>
          <GearIcon color={c.emphasisLow} />
        </Pressable>
      </Row>

      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        <Card style={{ padding: 14, gap: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row style={{ gap: 8 }}>
              <FlameIcon color={c.accent} size={17} />
              <Cap>Today</Cap>
            </Row>
            <Pressable onPress={() => router.push('/settings/profile')} hitSlop={8}>
              <Body style={{ fontSize: 12.5, color: c.accent, fontFamily: fonts.semibold }}>
                {budget ? 'Edit profile' : 'Set up profile'}
              </Body>
            </Pressable>
          </Row>
          <Row style={{ gap: 14 }}>
            <View style={{ flex: 1, gap: 1 }}>
              <Title style={{ fontSize: 26 }}>{burnedToday}<Body style={{ fontSize: 13, color: c.secondary }}> kcal burned</Body></Title>
              {budget ? (
                <Body style={{ fontSize: 12.5, color: c.secondary }}>
                  training today, on top of ~{budget.baseTdee} kcal daily life
                </Body>
              ) : (
                <Body style={{ fontSize: 12.5, color: c.secondary }}>
                  Add your body details to get intake targets
                </Body>
              )}
            </View>
            {budget && (
              <View style={{ flex: 1, gap: 1 }}>
                <Title style={{ fontSize: 26, color: c.accent }}>
                  {budget.targetIntake}<Body style={{ fontSize: 13, color: c.secondary }}> kcal to eat</Body>
                </Title>
                <Body style={{ fontSize: 12.5, color: c.secondary }}>
                  to {budget.direction === 'gain' ? 'gain' : budget.direction === 'lose' ? 'lose' : 'hold'} {budget.direction === 'maintain' ? 'weight' : `${profile.goalRateKgPerWeek} kg/wk`}
                </Body>
              </View>
            )}
          </Row>
          {budget && (
            <Row style={{ gap: 8 }}>
              {(
                [['Protein', budget.macros.proteinG], ['Carbs', budget.macros.carbsG], ['Fat', budget.macros.fatG]] as const
              ).map(([label, g]) => (
                <View key={label} style={{
                  flex: 1, backgroundColor: c.input, borderRadius: 9, paddingVertical: 7, alignItems: 'center',
                }}>
                  <Text style={{ fontFamily: fonts.condBold, fontSize: 17, color: c.text }}>{g} g</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: c.secondary }}>{label}</Text>
                </View>
              ))}
            </Row>
          )}
        </Card>

        {totals && (
          <Row style={{ gap: 10 }}>
            <Card style={{ flex: 1, padding: 13, gap: 2 }}>
              <Cap style={{ fontSize: 10 }}>Workouts</Cap>
              <Title style={{ fontSize: 26 }}>{totals.workouts}</Title>
            </Card>
            <Card style={{ flex: 1.25, padding: 13, gap: 2 }}>
              <Cap style={{ fontSize: 10 }}>Volume lifted</Cap>
              <Title style={{ fontSize: 26 }}>
                {totals.volumeKg >= 1000000
                  ? `${Math.round(totals.volumeKg / 100000) / 10}k t`
                  : totals.volumeKg >= 1000
                    ? `${Math.round(totals.volumeKg / 100) / 10} t`
                    : `${Math.round(totals.volumeKg)} kg`}
              </Title>
            </Card>
            <Card style={{ flex: 1, padding: 13, gap: 2 }}>
              <Cap style={{ fontSize: 10 }}>Hours</Cap>
              <Title style={{ fontSize: 26 }}>{Math.round(totals.hours)}</Title>
            </Card>
          </Row>
        )}

        <Card style={{ paddingTop: 14, paddingBottom: 8, paddingHorizontal: 12 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 10 }}>
            <Cap>Sessions per week</Cap>
            <Body style={{ fontSize: 12, color: c.secondary }}>last 12 weeks</Body>
          </Row>
          <BarChart
            width={width - 56}
            bars={weeks.map((w, i) => ({
              value: w.count,
              label: i % 4 === 0 ? fmtDateShort(w.weekStart) : undefined,
            }))}
          />
        </Card>

        {prs.length > 0 && (
          <>
            <Cap style={{ marginTop: 2 }}>Recent records</Cap>
            <Card>
              {prs.map((p, i) => (
                <Pressable key={p.id} onPress={() => router.push(`/exercise/${p.exercise_id}`)}>
                  <Row style={{
                    padding: 12, gap: 11,
                    borderTopWidth: i > 0 ? 1 : 0, borderTopColor: c.divider,
                  }}>
                    <View style={{
                      width: 32, height: 32, borderRadius: 999, backgroundColor: c.accentSoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <TrophyIcon size={15} color={c.accent} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Body style={{ fontFamily: fonts.semibold, fontSize: 14.5 }} numberOfLines={1}>{p.exercise_name}</Body>
                      <Body style={{ fontSize: 11.5, color: c.dim }}>
                        {KIND_SHORT[p.kind]} · {fmtDateShort(p.achieved_at)}
                      </Body>
                    </View>
                    <Title style={{ fontSize: 18, color: c.accent }}>{fmtPrVal(p)}</Title>
                  </Row>
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {trained.length > 0 && (
          <>
            <Cap style={{ marginTop: 2 }}>Most trained</Cap>
            <Card style={{ paddingHorizontal: 13, paddingTop: 4, paddingBottom: 12 }}>
              {trained.map((t) => (
                <Pressable key={t.exercise_id} onPress={() => router.push(`/exercise/${t.exercise_id}`)} style={{ paddingTop: 10, gap: 5 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Body style={{ fontFamily: fonts.semibold, fontSize: 14 }} numberOfLines={1}>{t.name}</Body>
                    <Body style={{ fontSize: 12.5, color: c.secondary }}>{t.sessions} session{t.sessions > 1 ? 's' : ''}</Body>
                  </Row>
                  <View style={{ height: 6, borderRadius: 999, backgroundColor: c.input }}>
                    <View style={{
                      height: 6, borderRadius: 999, backgroundColor: c.accent,
                      width: `${Math.max(6, (t.sessions / maxTrained) * 100)}%`,
                      opacity: 0.55 + 0.45 * (t.sessions / maxTrained),
                    }} />
                  </View>
                </Pressable>
              ))}
            </Card>
          </>
        )}

        {totals?.workouts === 0 && (
          <Body style={{ color: c.secondary, textAlign: 'center', paddingVertical: 24 }}>
            Stats appear after your first saved workout.
          </Body>
        )}
      </View>
    </ScrollView>
  );
}
