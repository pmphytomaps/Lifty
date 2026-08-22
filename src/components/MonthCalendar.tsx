import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { DAY_MS, dayKey, startOfMonth } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export interface CalendarDayInfo { label: string; workoutId: number }

/** Month grid, Monday first. Days with workouts show a filled disc plus the workout name. */
export function MonthCalendar({ monthStart, days, today, onDayPress }: {
  monthStart: number;
  days: Map<string, CalendarDayInfo>;
  today: number;
  onDayPress: (info: CalendarDayInfo) => void;
}) {
  const c = useTheme();
  const first = new Date(startOfMonth(monthStart));
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const leadBlanks = (first.getDay() + 6) % 7; // Monday-first offset
  const todayKey = dayKey(today);

  const cells: (number | null)[] = [
    ...Array.from({ length: leadBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, height: 24 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <Text key={d} style={{
            flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 10,
            letterSpacing: 0.8, color: c.muted, textTransform: 'uppercase',
          }}>{d}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 }}>
        {cells.map((day, i) => {
          if (day == null) return <View key={i} style={{ width: `${100 / 7}%`, height: 54 }} />;
          const t = first.getTime() + (day - 1) * DAY_MS;
          const key = dayKey(t);
          const info = days.get(key);
          const isToday = key === todayKey;
          const future = t > today;
          return (
            <Pressable
              key={i}
              disabled={!info}
              onPress={() => info && onDayPress(info)}
              style={{ width: `${100 / 7}%`, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 }}
            >
              <View style={{
                width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
                backgroundColor: info ? (isToday ? c.accent : c.accentSoft) : 'transparent',
                borderWidth: !info && isToday ? 1.5 : 0, borderColor: c.accent,
              }}>
                <Text style={{
                  fontFamily: info ? fonts.bold : fonts.regular, fontSize: 14,
                  color: info ? (isToday ? c.onAccent : c.accent) : future ? c.faint : c.dim,
                }}>{day}</Text>
              </View>
              {info && (
                <Text numberOfLines={1} style={{ fontSize: 9, fontFamily: fonts.medium, color: isToday ? c.emphasis : c.muted, maxWidth: 48 }}>
                  {info.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
