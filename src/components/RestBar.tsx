import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';
import { fmtClock } from '../lib/dates';
import { useActiveWorkout } from '../state/activeWorkout';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { TimerIcon } from './icons';

/** Sticky rest countdown. Vibrates when the timer runs out, then clears itself. */
export function RestBar() {
  const c = useTheme();
  const restEndsAt = useActiveWorkout((s) => s.restEndsAt);
  const restTotalS = useActiveWorkout((s) => s.restTotalS);
  const adjustRest = useActiveWorkout((s) => s.adjustRest);
  const skipRest = useActiveWorkout((s) => s.skipRest);
  const [now, setNow] = useState(Date.now());
  const buzzed = useRef(false);

  useEffect(() => {
    if (!restEndsAt) return;
    buzzed.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [restEndsAt]);

  useEffect(() => {
    if (!restEndsAt) return;
    const remaining = restEndsAt - now;
    if (remaining <= 0 && !buzzed.current) {
      buzzed.current = true;
      Vibration.vibrate([0, 350, 180, 350]);
      const t = setTimeout(() => skipRest(), 1200);
      return () => clearTimeout(t);
    }
  }, [now, restEndsAt, skipRest]);

  if (!restEndsAt) return null;
  const remainingS = Math.max(0, (restEndsAt - now) / 1000);
  const frac = restTotalS > 0 ? Math.min(1, remainingS / restTotalS) : 0;

  return (
    <View style={{
      position: 'absolute', left: 12, right: 12, bottom: 12,
      backgroundColor: c.card, borderColor: c.accentBorder, borderWidth: 1,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <View style={{ height: 3, backgroundColor: c.border }}>
        <View style={{ height: 3, width: `${frac * 100}%`, backgroundColor: c.accent }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 }}>
        <TimerIcon color={c.accent} size={20} />
        <Text style={{ fontFamily: fonts.condBold, fontSize: 26, color: c.text, minWidth: 64 }}>
          {fmtClock(remainingS)}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => adjustRest(-15)} hitSlop={6}
          style={{ height: 38, paddingHorizontal: 13, borderRadius: 9, backgroundColor: c.input, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: c.emphasis }}>-15</Text>
        </Pressable>
        <Pressable onPress={() => adjustRest(15)} hitSlop={6}
          style={{ height: 38, paddingHorizontal: 13, borderRadius: 9, backgroundColor: c.input, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: c.emphasis }}>+15</Text>
        </Pressable>
        <Pressable onPress={skipRest} hitSlop={6}
          style={{ height: 38, paddingHorizontal: 15, borderRadius: 9, backgroundColor: c.accent, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: c.onAccent }}>Skip</Text>
        </Pressable>
      </View>
    </View>
  );
}
