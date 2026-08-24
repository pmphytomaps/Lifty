import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackIcon, ChevronRightIcon, FlameIcon, GearIcon, TrophyIcon } from '../../components/icons';
import { MonthCalendar, type CalendarDayInfo } from '../../components/MonthCalendar';
import { Body, Cap, Card, Row, Title } from '../../components/ui';
import { addMonths, dayKey, fmtDuration, fmtMonthYear, startOfMonth } from '../../lib/dates';
import { fmtVolume } from '../../lib/units';
import { restDaysThisWeek, weekStreak } from '../../repo/stats';
import { listFinishedWorkouts, workoutsBetween } from '../../repo/workouts';
import type { Workout } from '../../repo/types';
import { useSettings } from '../../state/settings';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { surface } from '../../lib/reportError';

const PAGE = 30;

export default function HistoryTab() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const unit = useSettings((s) => s.unit);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [rows, setRows] = useState<Workout[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [streak, setStreak] = useState(0);
  const [restDays, setRestDays] = useState(0);
  const [monthStart, setMonthStart] = useState(startOfMonth(Date.now()));
  const [monthDays, setMonthDays] = useState<Map<string, CalendarDayInfo>>(new Map());
  const [monthCount, setMonthCount] = useState(0);

  const reload = useCallback(() => {
    listFinishedWorkouts(PAGE, 0).then((r) => { setRows(r); setHasMore(r.length === PAGE); }).catch(surface('Could not load your history.'));
    weekStreak().then(setStreak).catch(surface('Could not load your history.'));
    restDaysThisWeek().then(setRestDays).catch(surface('Could not load your history.'));
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const loadMonth = useCallback((ms: number) => {
    workoutsBetween(ms, addMonths(ms, 1)).then((ws) => {
      const m = new Map<string, CalendarDayInfo>();
      for (const w of ws) m.set(dayKey(w.started_at), { label: w.name, workoutId: w.id });
      setMonthDays(m);
      setMonthCount(ws.length);
    }).catch(surface('Could not load your history.'));
  }, []);
  useFocusEffect(useCallback(() => { loadMonth(monthStart); }, [loadMonth, monthStart]));

  const more = () => {
    if (!hasMore || view !== 'list') return;
    listFinishedWorkouts(PAGE, rows.length).then((r) => {
      setRows((prev) => [...prev, ...r]);
      setHasMore(r.length === PAGE);
    }).catch(surface('Could not load your history.'));
  };

  // Scrolls with the list; the tab switcher above stays fixed so it is always tappable.
  const listHeader = (
    <View>
      <Row style={{ paddingHorizontal: 16, gap: 10, marginBottom: 16 }}>
        <Card style={{ flex: 1, padding: 11, gap: 1 }}>
          <Cap style={{ fontSize: 10 }}>Streak</Cap>
          <Row style={{ gap: 5 }}>
            <FlameIcon color={c.accent} size={16} />
            <Title style={{ fontSize: 21, color: c.accent }}>{streak}<Body style={{ fontSize: 12, color: c.secondary }}> wk</Body></Title>
          </Row>
        </Card>
        <Card style={{ flex: 1, padding: 11, gap: 1 }}>
          <Cap style={{ fontSize: 10 }}>{view === 'calendar' ? 'This month' : 'Sessions'}</Cap>
          <Title style={{ fontSize: 21 }}>
            {view === 'calendar' ? monthCount : rows.length}{hasMore && view === 'list' ? '+' : ''}
          </Title>
        </Card>
        <Card style={{ flex: 1, padding: 11, gap: 1 }}>
          <Cap style={{ fontSize: 10 }}>Rest days</Cap>
          <Title style={{ fontSize: 21 }}>{restDays}<Body style={{ fontSize: 12, color: c.secondary }}> this wk</Body></Title>
        </Card>
      </Row>

      {view === 'calendar' && (
        <View style={{ marginBottom: 12 }}>
          <Row style={{ paddingHorizontal: 16, height: 44, justifyContent: 'space-between' }}>
            <Pressable onPress={() => setMonthStart((m) => addMonths(m, -1))} hitSlop={16} style={{ padding: 6 }}>
              <BackIcon size={20} color={c.secondary} />
            </Pressable>
            <Title style={{ fontSize: 21 }}>{fmtMonthYear(monthStart)}</Title>
            <Pressable onPress={() => setMonthStart((m) => addMonths(m, 1))} hitSlop={16} style={{ padding: 6 }}>
              <ChevronRightIcon size={20} color={c.secondary} />
            </Pressable>
          </Row>
          <MonthCalendar
            monthStart={monthStart}
            days={monthDays}
            today={Date.now()}
            onDayPress={(info) => router.push(`/workout/${info.workoutId}`)}
          />
          {monthCount === 0 && (
            <Body style={{ color: c.secondary, textAlign: 'center', paddingTop: 12, fontSize: 13 }}>
              Nothing logged in {fmtMonthYear(monthStart)}.
            </Body>
          )}
        </View>
      )}

      {rows.length > 0 && (
        <Cap style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          {view === 'calendar' ? 'Latest sessions' : 'All sessions'}
        </Cap>
      )}
    </View>
  );

  const listRows = view === 'list' ? rows : rows.slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 8 }}>
      <Row style={{ paddingHorizontal: 16, height: 52, justifyContent: 'space-between' }}>
        <Title style={{ fontSize: 30 }}>History</Title>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={{ padding: 6 }}>
          <GearIcon color={c.emphasisLow} />
        </Pressable>
      </Row>

      <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
        <Row style={{ height: 44, borderRadius: 11, backgroundColor: c.input, padding: 3, gap: 3 }}>
          {(['list', 'calendar'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={{
                flex: 1,
                alignSelf: 'stretch',
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: view === v ? c.borderStrong : 'transparent',
              }}
            >
              <Text style={{
                fontFamily: view === v ? fonts.bold : fonts.semibold,
                fontSize: 14.5,
                color: view === v ? c.text : c.secondary,
              }}>
                {v === 'list' ? 'List' : 'Calendar'}
              </Text>
            </Pressable>
          ))}
        </Row>
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28 }}
        data={listRows}
        keyExtractor={(w) => String(w.id)}
        ListHeaderComponent={listHeader}
        onEndReached={more}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={{ paddingHorizontal: 32, paddingVertical: 30, alignItems: 'center' }}>
            <Body style={{ color: c.secondary, textAlign: 'center', lineHeight: 21 }}>
              No workouts yet.{'\n'}Your first saved session shows up here.
            </Body>
          </View>
        }
        renderItem={({ item: w }) => {
          const d = new Date(w.started_at);
          return (
            <Pressable onPress={() => router.push(`/workout/${w.id}`)} style={{ paddingHorizontal: 16, marginBottom: 10 }}>
              <Card style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.condBold, fontSize: 20, color: c.text }}>{d.getDate()}</Text>
                  <Cap style={{ fontSize: 9 }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</Cap>
                </View>
                <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: c.border }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Row style={{ gap: 7 }}>
                    <Title numberOfLines={1} style={{ fontSize: 19, flexShrink: 1 }}>{w.name}</Title>
                    {w.pr_count > 0 && (
                      <Row style={{
                        gap: 3, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 999,
                        backgroundColor: c.accentSoft,
                      }}>
                        <TrophyIcon size={11} color={c.accent} strokeWidth={2.4} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: c.accent }}>{w.pr_count}</Text>
                      </Row>
                    )}
                  </Row>
                  <Body style={{ fontSize: 12.5, color: c.secondary }}>
                    {fmtDuration(w.duration_s ?? 0)} · {fmtVolume(w.total_volume_kg, unit)} {unit} · {w.total_sets} sets
                    {w.calories_kcal > 0 ? ` · ${Math.round(w.calories_kcal)} kcal` : ''}
                  </Body>
                </View>
                <ChevronRightIcon color={c.dim} />
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
